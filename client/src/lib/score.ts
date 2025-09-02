import { Block, Plan } from './types'
import { GridIndex, PathMask, RectM } from './grid'

// Score weights
export interface ScoreWeights {
  lambdaPath: number
  lambdaClear: number
  lambdaAdj: number
}

export interface FlowMatrix {
  // flows[i][j] in moves/hour between block i and j (by id)
  [fromId: string]: { [toId: string]: number }
}

export interface AdjacencyWeights {
  // desirability [-1,1] by pair key `${a}-${b}` sorted
  [pairKey: string]: number
}

export interface ScoreBreakdown {
  mhc: number
  overlapWithPath: number
  clearanceViolations: number
  adjacencyHits: number
  total: number
}

export interface ScoreContext {
  cellSize: number // meters
  minAisle: number // meters
  site: RectM
  pathMask: PathMask
  flows?: FlowMatrix
  adjacency?: AdjacencyWeights
  weights?: Partial<ScoreWeights>
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  lambdaPath: 1e6,
  lambdaClear: 5e5,
  lambdaAdj: 1e3,
}

export function manhattanDistance(a: Block, b: Block): number {
  const ax = a.x + a.w / 2
  const ay = a.y + a.h / 2
  const bx = b.x + b.w / 2
  const by = b.y + b.h / 2
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

export function scoreLayout(blocks: Block[], ctx: ScoreContext): ScoreBreakdown {
  const W = { ...DEFAULT_WEIGHTS, ...(ctx.weights || {}) }

  // Precompute lookup
  const idToBlock: Record<string, Block> = {}
  for (const b of blocks) idToBlock[b.id] = b

  // Material Handling Cost: sum F_ij * d_ij (Manhattan over free space approx)
  let mhc = 0
  if (ctx.flows) {
    for (const i in ctx.flows) {
      for (const j in ctx.flows[i]) {
        if (i === j) continue
        const bi = idToBlock[i]; const bj = idToBlock[j]
        if (!bi || !bj) continue
        const dij = manhattanDistance(bi, bj)
        mhc += (ctx.flows[i][j] || 0) * dij
      }
    }
  }

  // Overlap with path: count how many reserved cells are within any block
  let overlap = 0
  for (const b of blocks) {
    overlap += +ctx.pathMask.anyOccupied({ x: b.x, y: b.y, w: b.w, h: b.h })
  }

  // Clearance violations: for each block, check enlarged rect against others and path
  let clearViol = 0
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i]
    // clearance to path
    if (ctx.pathMask.anyOccupied({ x: a.x - ctx.minAisle, y: a.y - ctx.minAisle, w: a.w + 2*ctx.minAisle, h: a.h + 2*ctx.minAisle })) {
      clearViol += 1
    }
    // clearance to other blocks
    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j]
      const ax0 = a.x - ctx.minAisle, ay0 = a.y - ctx.minAisle
      const aw = a.w + 2 * ctx.minAisle, ah = a.h + 2 * ctx.minAisle
      const overlapX = !(ax0 + aw <= b.x || b.x + b.w <= ax0)
      const overlapY = !(ay0 + ah <= b.y || b.y + b.h <= ay0)
      if (overlapX && overlapY) clearViol += 1
    }
  }

  // Adjacency: reward pairs that are close
  let adjHits = 0
  if (ctx.adjacency) {
    for (const key in ctx.adjacency) {
      const [ka, kb] = key.split('-')
      const a = blocks.find(b => b.key === ka)
      const b = blocks.find(b => b.key === kb)
      if (!a || !b) continue
      const dist = manhattanDistance(a, b)
      const near = dist <= Math.max(a.w, a.h, b.w, b.h) * 3
      adjHits += (near ? 1 : 0) * (ctx.adjacency[key] || 0)
    }
  }

  const total = mhc + W.lambdaPath * overlap + W.lambdaClear * clearViol - W.lambdaAdj * adjHits
  return { mhc, overlapWithPath: overlap, clearanceViolations: clearViol, adjacencyHits: adjHits, total }
}


