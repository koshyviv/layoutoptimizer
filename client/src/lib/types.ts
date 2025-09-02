import { z } from 'zod'

// Core data types from the requirements
export type ForkliftClass = 'WA' | 'NA' | 'VNA' // wide/narrow/very narrow
export type ModuleKey = 
  | 'pallet_asrs'
  | 'tote_asrs' 
  | 'gtp'
  | 'picking'
  | 'consolidation'
  | 'palletizer'
  | 'depalletizer'
  | 'inbound'
  | 'outbound'
  | 'charging'
  | 'qc'
  | 'maintenance'

export type BlockKey = ModuleKey | 'aisle' | 'dock'

// Zod schemas for validation
export const ThroughputSchema = z.object({
  palletsInPerH: z.number().min(0),
  palletsOutPerH: z.number().min(0),
  totesPerH: z.number().min(0),
  ordersPerH: z.number().min(0),
})

export const SiteSchema = z.object({
  widthM: z.number().min(1),
  heightM: z.number().min(1),
  obstructions: z.array(z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().min(0),
    h: z.number().min(0),
  })).optional(),
  forklift: z.enum(['WA', 'NA', 'VNA']),
  pedestrianDensity: z.enum(['low', 'med', 'high']),
})

export const RequestSchema = z.object({
  site: SiteSchema,
  t: ThroughputSchema,
  modules: z.record(z.enum([
    'pallet_asrs', 'tote_asrs', 'gtp', 'picking', 'consolidation',
    'palletizer', 'depalletizer', 'inbound', 'outbound', 'charging', 'qc', 'maintenance'
  ]), z.boolean()).optional(),
  objectiveWeights: z.object({
    travel: z.number().min(0).max(1),
    adjacency: z.number().min(0).max(1),
    safety: z.number().min(0).max(1),
    compactness: z.number().min(0).max(1),
  }),
})

export const BlockSchema = z.object({
  id: z.string(),
  key: z.enum([
    'pallet_asrs', 'tote_asrs', 'gtp', 'picking', 'consolidation',
    'palletizer', 'depalletizer', 'inbound', 'outbound', 'charging', 'qc', 'maintenance',
    'aisle', 'dock'
  ]),
  x: z.number(),
  y: z.number(),
  w: z.number().min(0),
  h: z.number().min(0),
  rot: z.enum([0, 90]).optional(),
  meta: z.object({
    kpis: z.record(z.string(), z.number()),
    notes: z.array(z.string()).optional(),
  }),
})

export const PlanSchema = z.object({
  id: z.string(),
  blocks: z.array(BlockSchema),
  walkways: z.array(z.object({
    polyline: z.array(z.tuple([z.number(), z.number()])),
  })).optional(),
  score: z.number(),
  scores: z.object({
    travel: z.number(),
    adj: z.number(),
    safety: z.number(),
    compact: z.number(),
  }),
  ruleFindings: z.array(z.string()),
})

// TypeScript types derived from schemas
export type Throughput = z.infer<typeof ThroughputSchema>
export type Site = z.infer<typeof SiteSchema>
export type Request = z.infer<typeof RequestSchema>
export type Block = z.infer<typeof BlockSchema>
export type Plan = z.infer<typeof PlanSchema>

// UI State types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'plan' | 'optimization' | 'validation'
}

export interface OptimizationResult {
  plans: Plan[]
  selectedPlanId?: string
  isOptimizing: boolean
}

export interface ValidationResult {
  findings: RuleFinding[]
  isValidating: boolean
}

export interface RuleFinding {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  blockId?: string
  suggestion?: string
  source?: string
}

export interface CanvasState {
  zoom: number
  pan: { x: number; y: number }
  selectedBlockIds: string[]
  isDragging: boolean
  showGrid: boolean
  showMeasurements: boolean
  showConstraints: boolean
  snapToGrid: boolean
  gridSize: number
}

export interface AppState {
  currentRequest: Partial<Request>
  currentPlan?: Plan
  optimizationResult?: OptimizationResult
  validationResult?: ValidationResult
  canvasState: CanvasState
  chatMessages: ChatMessage[]
  isLoading: boolean
  isSidebarCollapsed: boolean // Right sidebar (insights)
  isChatSidebarCollapsed: boolean // Left sidebar (chat)
  error?: string
}

// Module definitions with metadata
export interface ModuleDefinition {
  key: ModuleKey
  name: string
  description: string
  category: 'storage' | 'processing' | 'movement' | 'support'
  color: string
  icon: string
  defaultSize: { w: number; h: number }
  areaCoefficient: number // m² per unit throughput
}

export const MODULE_DEFINITIONS: Record<ModuleKey, ModuleDefinition> = {
  pallet_asrs: {
    key: 'pallet_asrs',
    name: 'Pallet ASRS',
    description: 'Automated Storage & Retrieval System for pallets',
    category: 'storage',
    color: '#3B82F6',
    icon: '📦',
    defaultSize: { w: 32, h: 18 },
    areaCoefficient: 0.8
  },
  tote_asrs: {
    key: 'tote_asrs',
    name: 'Tote ASRS',
    description: 'Automated Storage & Retrieval System for totes',
    category: 'storage',
    color: '#10B981',
    icon: '📋',
    defaultSize: { w: 24, h: 12 },
    areaCoefficient: 0.3
  },
  gtp: {
    key: 'gtp',
    name: 'Goods-to-Person',
    description: 'Automated picking stations',
    category: 'processing',
    color: '#F59E0B',
    icon: '🤖',
    defaultSize: { w: 18, h: 12 },
    areaCoefficient: 0.05
  },
  picking: {
    key: 'picking',
    name: 'Order Picking',
    description: 'Manual picking areas',
    category: 'processing',
    color: '#EF4444',
    icon: '👤',
    defaultSize: { w: 26, h: 16 },
    areaCoefficient: 0.1
  },
  consolidation: {
    key: 'consolidation',
    name: 'Order Consolidation',
    description: 'Order assembly and packing',
    category: 'processing',
    color: '#8B5CF6',
    icon: '📦',
    defaultSize: { w: 20, h: 14 },
    areaCoefficient: 0.08
  },
  palletizer: {
    key: 'palletizer',
    name: 'Palletizer',
    description: 'Automated palletizing equipment',
    category: 'processing',
    color: '#06B6D4',
    icon: '🏗️',
    defaultSize: { w: 12, h: 8 },
    areaCoefficient: 0.15
  },
  depalletizer: {
    key: 'depalletizer',
    name: 'Depalletizer',
    description: 'Automated depalletizing equipment',
    category: 'processing',
    color: '#84CC16',
    icon: '🔧',
    defaultSize: { w: 12, h: 8 },
    areaCoefficient: 0.15
  },
  inbound: {
    key: 'inbound',
    name: 'Inbound Staging',
    description: 'Receiving and staging area',
    category: 'movement',
    color: '#F97316',
    icon: '📥',
    defaultSize: { w: 24, h: 12 },
    areaCoefficient: 1.2
  },
  outbound: {
    key: 'outbound',
    name: 'Outbound Staging',
    description: 'Shipping and staging area',
    category: 'movement',
    color: '#EC4899',
    icon: '📤',
    defaultSize: { w: 24, h: 12 },
    areaCoefficient: 1.2
  },
  charging: {
    key: 'charging',
    name: 'Charging/AMR',
    description: 'Robot charging and maintenance',
    category: 'support',
    color: '#6366F1',
    icon: '🔋',
    defaultSize: { w: 8, h: 6 },
    areaCoefficient: 0.5
  },
  qc: {
    key: 'qc',
    name: 'QC/Repack',
    description: 'Quality control and repacking',
    category: 'support',
    color: '#14B8A6',
    icon: '🔍',
    defaultSize: { w: 16, h: 10 },
    areaCoefficient: 0.12
  },
  maintenance: {
    key: 'maintenance',
    name: 'Maintenance',
    description: 'Equipment maintenance area',
    category: 'support',
    color: '#64748B',
    icon: '🔧',
    defaultSize: { w: 12, h: 8 },
    areaCoefficient: 0.3
  }
}

// Adjacency weights for optimization
export const ADJACENCY_WEIGHTS: Record<string, number> = {
  'inbound-depalletizer': 0.9,
  'depalletizer-pallet_asrs': 0.8,
  'pallet_asrs-picking': 0.7,
  'tote_asrs-gtp': 0.9,
  'gtp-picking': 0.8,
  'picking-consolidation': 0.8,
  'consolidation-palletizer': 0.7,
  'palletizer-outbound': 0.9,
  'charging-gtp': 0.6,
  'qc-consolidation': 0.6,
  'maintenance-pallet_asrs': 0.4,
  'maintenance-tote_asrs': 0.4,
}
