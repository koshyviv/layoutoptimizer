import { Block, Plan } from './types'
import { scoreLayout, ScoreContext } from './score'
import { RectM } from './grid'

export interface OptimizeOptions {
  iterations?: number
  grid?: number // snap grid (m)
  cooling?: number // 0..1, multiplier per iteration for accepting worse moves
}

export interface OptimizeResult {
  bestPlan: Plan
  bestScore: number
  history: Array<{ plan: Plan; score: number; move: string }>
}

type NeighborGenerator = (blocks: Block[]) => { blocks: Block[]; move: string }

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map(b => ({ ...b, meta: b.meta ? { ...b.meta } : undefined }))
}

function randInt(n: number): number { return Math.floor(Math.random() * n) }

function genSwap(): NeighborGenerator {
  return (blocks) => {
    if (blocks.length < 2) return { blocks, move: 'noop' }
    const i = randInt(blocks.length)
    let j = randInt(blocks.length)
    if (j === i) j = (j + 1) % blocks.length
    const nb = cloneBlocks(blocks)
    const ai = { x: nb[i].x, y: nb[i].y }
    nb[i].x = nb[j].x; nb[i].y = nb[j].y
    nb[j].x = ai.x; nb[j].y = ai.y
    return { blocks: nb, move: `swap(${i},${j})` }
  }
}

function genShift(grid: number): NeighborGenerator {
  const dirs: Array<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1]]
  return (blocks) => {
    if (blocks.length === 0) return { blocks, move: 'noop' }
    const i = randInt(blocks.length)
    const [dx, dy] = dirs[randInt(dirs.length)]
    const nb = cloneBlocks(blocks)
    nb[i].x = Math.max(0, nb[i].x + dx * grid)
    nb[i].y = Math.max(0, nb[i].y + dy * grid)
    return { blocks: nb, move: `shift(${i},${dx},${dy})` }
  }
}

function genRotate(): NeighborGenerator {
  return (blocks) => {
    if (blocks.length === 0) return { blocks, move: 'noop' }
    const i = randInt(blocks.length)
    const nb = cloneBlocks(blocks)
    // 90-degree rotate by swapping w/h
    const w = nb[i].w; nb[i].w = nb[i].h; nb[i].h = w
    return { blocks: nb, move: `rotate(${i})` }
  }
}

function genPullTogether(): NeighborGenerator {
  return (blocks) => {
    if (blocks.length < 2) return { blocks, move: 'noop' }
    const i = randInt(blocks.length - 1)
    const j = i + 1
    const nb = cloneBlocks(blocks)
    const cx = (nb[i].x + nb[j].x) / 2
    const cy = (nb[i].y + nb[j].y) / 2
    nb[i].x = cx - nb[i].w
    nb[j].x = cx + 0.1
    nb[i].y = cy
    nb[j].y = cy
    return { blocks: nb, move: `pullTogether(${i},${j})` }
  }
}

export async function optimizeHeuristic(
  initial: Plan,
  ctx: ScoreContext,
  opts: OptimizeOptions = {}
): Promise<OptimizeResult> {
  const iterations = opts.iterations ?? 40
  const grid = opts.grid ?? Math.max(0.25, ctx.cellSize)
  const cooling = opts.cooling ?? 0.95

  let bestBlocks = cloneBlocks(initial.blocks)
  let best = scoreLayout(bestBlocks, ctx)

  const gens: NeighborGenerator[] = [genSwap(), genShift(grid), genRotate(), genPullTogether()]

  const history: Array<{ plan: Plan; score: number; move: string }> = []
  let temperature = 1.0

  for (let iter = 0; iter < iterations; iter++) {
    const g = gens[randInt(gens.length)]
    const { blocks: candidateBlocks, move } = g(bestBlocks)
    // Reject illegal candidates outright
    if (!isPlanLegal(candidateBlocks, ctx)) {
      continue
    }
    const s = scoreLayout(candidateBlocks, ctx)

    const acceptBetter = s.total < best.total
    const acceptWorse = Math.random() < Math.exp(-(s.total - best.total) / Math.max(1, best.total)) * temperature
    if (acceptBetter || acceptWorse) {
      bestBlocks = candidateBlocks
      best = s
      history.push({ plan: { ...initial, id: `${initial.id}-iter-${iter}`, blocks: bestBlocks }, score: s.total, move })
    }
    temperature *= cooling
  }

  return {
    bestPlan: { ...initial, blocks: bestBlocks },
    bestScore: best.total,
    history,
  }
}

// ---------- Legality helpers ----------
function inflate(r: RectM, m: number): RectM {
  return { x: r.x - m, y: r.y - m, w: r.w + 2*m, h: r.h + 2*m }
}

function aabbOverlap(a: RectM, b: RectM): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

function inside(r: RectM, bounds: RectM): boolean {
  return r.x >= bounds.x && r.y >= bounds.y && r.x + r.w <= bounds.x + bounds.w && r.y + r.h <= bounds.y + bounds.h
}

function isPlanLegal(blocks: Block[], ctx: ScoreContext): boolean {
  // inside site and path overlap/clearance
  for (let i = 0; i < blocks.length; i++) {
    const bi = blocks[i]
    const rect: RectM = { x: bi.x, y: bi.y, w: bi.w, h: bi.h }
    if (!inside(rect, ctx.site)) return false
    if (ctx.pathMask.anyOccupied(rect)) return false
    if (ctx.pathMask.anyOccupied(inflate(rect, ctx.minAisle))) return false
  }
  // clearance to others
  for (let i = 0; i < blocks.length; i++) {
    const ai: RectM = { x: blocks[i].x, y: blocks[i].y, w: blocks[i].w, h: blocks[i].h }
    const aexp = inflate(ai, ctx.minAisle)
    for (let j = i + 1; j < blocks.length; j++) {
      const bj: RectM = { x: blocks[j].x, y: blocks[j].y, w: blocks[j].w, h: blocks[j].h }
      if (aabbOverlap(aexp, bj)) return false
    }
  }
  return true
}


