import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { 
  AppState, 
  ChatMessage, 
  Plan, 
  Block, 
  Request, 
  OptimizationResult, 
  ValidationResult,
  CanvasState 
} from './types'
import { generateId } from './utils'

interface AppStore extends AppState {
  // Chat actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  
  // Request actions
  updateRequest: (updates: Partial<Request>) => void
  clearRequest: () => void
  
  // Plan actions
  setPlan: (plan: Plan) => void
  updateBlock: (blockId: string, updates: Partial<Block>) => void
  addBlock: (block: Block) => void
  removeBlock: (blockId: string) => void
  clearPlan: () => void
  
  // Optimization actions
  setOptimizationResult: (result: OptimizationResult) => void
  selectPlan: (planId: string) => void
  clearOptimization: () => void
  
  // Validation actions
  setValidationResult: (result: ValidationResult) => void
  clearValidation: () => void
  
  // Canvas actions
  updateCanvasState: (updates: Partial<CanvasState>) => void
  setSelectedBlocks: (blockIds: string[]) => void
  toggleBlockSelection: (blockId: string) => void
  clearSelection: () => void
  
  // UI actions
  setLoading: (loading: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setError: (error: string | undefined) => void
}

export const useAppStore = create<AppStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      currentRequest: {
        objectiveWeights: {
          travel: 0.3,
          adjacency: 0.3,
          safety: 0.25,
          compactness: 0.15,
        }
      },
      canvasState: {
        zoom: 1,
        pan: { x: 0, y: 0 },
        selectedBlockIds: [],
        isDragging: false,
        showGrid: true,
        showMeasurements: false,
        showConstraints: true,
        snapToGrid: true,
        gridSize: 2, // 2 meter grid
      },
      chatMessages: [{
        id: generateId(),
        role: 'assistant',
        content: "Hi! I'm here to help you design your warehouse layout. Let's start by understanding your requirements. What's your expected throughput - how many pallets in and out per hour?",
        timestamp: new Date(),
        type: 'text'
      }],
      isLoading: false,
      isSidebarCollapsed: true, // Collapsed by default

      // Chat actions
      addMessage: (message) =>
        set((state) => {
          state.chatMessages.push({
            ...message,
            id: generateId(),
            timestamp: new Date(),
          })
        }),

      clearMessages: () =>
        set((state) => {
          state.chatMessages = []
        }),

      // Request actions
      updateRequest: (updates) =>
        set((state) => {
          Object.assign(state.currentRequest, updates)
        }),

      clearRequest: () =>
        set((state) => {
          state.currentRequest = {
            objectiveWeights: {
              travel: 0.3,
              adjacency: 0.3,
              safety: 0.25,
              compactness: 0.15,
            }
          }
        }),

      // Plan actions
      setPlan: (plan) =>
        set((state) => {
          state.currentPlan = plan
        }),

      updateBlock: (blockId, updates) =>
        set((state) => {
          if (state.currentPlan) {
            const block = state.currentPlan.blocks.find(b => b.id === blockId)
            if (block) {
              Object.assign(block, updates)
            }
          }
        }),

      addBlock: (block) =>
        set((state) => {
          if (state.currentPlan) {
            state.currentPlan.blocks.push(block)
          } else {
            state.currentPlan = {
              id: generateId(),
              blocks: [block],
              score: 0,
              scores: { travel: 0, adj: 0, safety: 0, compact: 0 },
              ruleFindings: []
            }
          }
        }),

      removeBlock: (blockId) =>
        set((state) => {
          if (state.currentPlan) {
            state.currentPlan.blocks = state.currentPlan.blocks.filter(
              b => b.id !== blockId
            )
            state.canvasState.selectedBlockIds = state.canvasState.selectedBlockIds.filter(
              id => id !== blockId
            )
          }
        }),

      clearPlan: () =>
        set((state) => {
          state.currentPlan = undefined
          state.canvasState.selectedBlockIds = []
        }),

      // Optimization actions
      setOptimizationResult: (result) =>
        set((state) => {
          state.optimizationResult = result
        }),

      selectPlan: (planId) =>
        set((state) => {
          if (state.optimizationResult) {
            const selectedPlan = state.optimizationResult.plans.find(p => p.id === planId)
            if (selectedPlan) {
              state.currentPlan = selectedPlan
              state.optimizationResult.selectedPlanId = planId
            }
          }
        }),

      clearOptimization: () =>
        set((state) => {
          state.optimizationResult = undefined
        }),

      // Validation actions
      setValidationResult: (result) =>
        set((state) => {
          state.validationResult = result
        }),

      clearValidation: () =>
        set((state) => {
          state.validationResult = undefined
        }),

      // Canvas actions
      updateCanvasState: (updates) =>
        set((state) => {
          Object.assign(state.canvasState, updates)
        }),

      setSelectedBlocks: (blockIds) =>
        set((state) => {
          state.canvasState.selectedBlockIds = blockIds
        }),

      toggleBlockSelection: (blockId) =>
        set((state) => {
          const selected = state.canvasState.selectedBlockIds
          const index = selected.indexOf(blockId)
          if (index >= 0) {
            selected.splice(index, 1)
          } else {
            selected.push(blockId)
          }
        }),

      clearSelection: () =>
        set((state) => {
          state.canvasState.selectedBlockIds = []
        }),

      // UI actions
      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading
        }),

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.isSidebarCollapsed = collapsed
        }),

      setError: (error) =>
        set((state) => {
          state.error = error
        }),
    })),
    { name: 'warehouse-layout-store' }
  )
)
