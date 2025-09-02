// Lightweight geometry + constraints helpers for CAD-like editor
// Units: meters. Render scale handled by components (e.g., 20 px/m).

export interface RectM {
  x: number
  y: number
  w: number
  h: number
}

export interface GridIndexOptions {
  cellSize: number // grid cell size (meters), e.g., 0.25 m
  width: number // total width of index coverage (meters)
  height: number // total height (meters)
}

// Occupancy index over a regular grid; supports marking blocked cells
export class GridIndex {
  readonly cellSize: number
  readonly cols: number
  readonly rows: number
  private readonly data: Uint8Array

  constructor(opts: GridIndexOptions) {
    this.cellSize = Math.max(0.05, opts.cellSize)
    this.cols = Math.ceil(opts.width / this.cellSize)
    this.rows = Math.ceil(opts.height / this.cellSize)
    this.data = new Uint8Array(this.cols * this.rows)
  }

  private idx(c: number, r: number): number { return r * this.cols + c }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows
  }

  set(c: number, r: number, value = 1): void {
    if (!this.inBounds(c, r)) return
    this.data[this.idx(c, r)] = value ? 1 : 0
  }

  get(c: number, r: number): number {
    if (!this.inBounds(c, r)) return 1 // treat OOB as blocked
    return this.data[this.idx(c, r)]
  }

  fillRect(rect: RectM, value = 1): void {
    const c0 = Math.floor(rect.x / this.cellSize)
    const r0 = Math.floor(rect.y / this.cellSize)
    const c1 = Math.ceil((rect.x + rect.w) / this.cellSize)
    const r1 = Math.ceil((rect.y + rect.h) / this.cellSize)
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        this.set(c, r, value)
      }
    }
  }

  anyOccupied(rect: RectM): boolean {
    const c0 = Math.floor(rect.x / this.cellSize)
    const r0 = Math.floor(rect.y / this.cellSize)
    const c1 = Math.ceil((rect.x + rect.w) / this.cellSize)
    const r1 = Math.ceil((rect.y + rect.h) / this.cellSize)
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (this.get(c, r)) return true
      }
    }
    return false
  }
}

// Path mask: reserved (non-placeable) cells; built from polylines or rects
export class PathMask extends GridIndex {
  // mark polyline corridors with width (meters)
  addPolyline(points: Array<[number, number]>, width: number): void {
    if (points.length < 2) return
    const half = Math.max(0, width / 2)
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      const minX = Math.min(x0, x1) - half
      const maxX = Math.max(x0, x1) + half
      const minY = Math.min(y0, y1) - half
      const maxY = Math.max(y0, y1) + half
      this.fillRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, 1)
    }
  }
}

export interface LegalityOptions {
  minAisle: number // minimum clearance to paths (meters), e.g., 3.0
  site: RectM // site boundary
}

export function inflate(rect: RectM, m: number): RectM {
  return { x: rect.x - m, y: rect.y - m, w: rect.w + 2 * m, h: rect.h + 2 * m }
}

export function aabbOverlap(a: RectM, b: RectM): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

export function inside(rect: RectM, bounds: RectM): boolean {
  return rect.x >= bounds.x && rect.y >= bounds.y && rect.x + rect.w <= bounds.x + bounds.w && rect.y + rect.h <= bounds.y + bounds.h
}

export interface LegalityResult {
  ok: boolean
  reason?: string
}

export function checkPlacementLegality(
  candidate: RectM,
  others: RectM[],
  pathMask: GridIndex,
  opts: LegalityOptions
): LegalityResult {
  // inside site
  if (!inside(candidate, opts.site)) {
    return { ok: false, reason: 'outside site bounds' }
  }

  // overlap with reserved path cells
  if (pathMask.anyOccupied(candidate)) {
    return { ok: false, reason: 'overlaps path' }
  }

  // clearance to paths
  if (pathMask.anyOccupied(inflate(candidate, opts.minAisle))) {
    return { ok: false, reason: `violates aisle clearance ${opts.minAisle} m` }
  }

  // clearance to other blocks (minAisle around both)
  const expanded = inflate(candidate, opts.minAisle)
  for (const other of others) {
    if (aabbOverlap(expanded, inflate(other, 0))) {
      return { ok: false, reason: `too close to another block (< ${opts.minAisle} m)` }
    }
  }

  return { ok: true }
}

// Simple BFS over grid cells to nudge to nearest legal position
export function nudgeToNearestLegal(
  start: RectM,
  others: RectM[],
  pathMask: GridIndex,
  opts: LegalityOptions,
  maxRadius = 10
): RectM {
  const step = pathMask.cellSize
  const visited = new Set<string>()
  const q: RectM[] = [start]
  const key = (r: RectM) => `${r.x.toFixed(3)}:${r.y.toFixed(3)}`
  while (q.length) {
    const cur = q.shift()!
    if (visited.has(key(cur))) continue
    visited.add(key(cur))
    if (checkPlacementLegality(cur, others, pathMask, opts).ok) return cur
    // explore neighbors in Manhattan ring
    const neighbors: RectM[] = [
      { x: cur.x + step, y: cur.y, w: cur.w, h: cur.h },
      { x: cur.x - step, y: cur.y, w: cur.w, h: cur.h },
      { x: cur.x, y: cur.y + step, w: cur.w, h: cur.h },
      { x: cur.x, y: cur.y - step, w: cur.w, h: cur.h },
    ]
    for (const n of neighbors) {
      if (Math.abs(n.x - start.x) + Math.abs(n.y - start.y) <= maxRadius) q.push(n)
    }
  }
  return start
}


