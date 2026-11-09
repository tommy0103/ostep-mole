/** Chapter 17: a free-list allocator with splitting and coalescing (like malloc.py). */
export type FitPolicy = 'BEST' | 'WORST' | 'FIRST' | 'NEXT'

export interface Chunk {
  addr: number
  size: number
  free: boolean
  /** allocation id, for coloring */
  id?: number
}

export interface HeapState {
  chunks: Chunk[]
  nextFitCursor: number
}

export type Op = { kind: 'alloc'; size: number; id: number } | { kind: 'free'; id: number }

export interface OpResult {
  op: Op
  ok: boolean
  addr: number | null
  searched: number
  state: HeapState
}

export function initHeap(size: number): HeapState {
  return { chunks: [{ addr: 0, size, free: true }], nextFitCursor: 0 }
}

export function step(state: HeapState, op: Op, policy: FitPolicy, coalesce: boolean): OpResult {
  const chunks = state.chunks.map((c) => ({ ...c }))
  let cursor = state.nextFitCursor
  if (op.kind === 'free') {
    const i = chunks.findIndex((c) => !c.free && c.id === op.id)
    if (i < 0) return { op, ok: false, addr: null, searched: 0, state }
    chunks[i].free = true
    delete chunks[i].id
    const merged = coalesce ? coalesceAll(chunks) : chunks
    return { op, ok: true, addr: chunks[i].addr, searched: 0, state: { chunks: merged, nextFitCursor: Math.min(cursor, merged.length - 1) } }
  }
  const free = chunks.map((c, i) => ({ c, i })).filter(({ c }) => c.free && c.size >= op.size)
  let pick: { c: Chunk; i: number } | undefined
  let searched = chunks.filter((c) => c.free).length
  if (policy === 'BEST') pick = [...free].sort((a, b) => a.c.size - b.c.size || a.c.addr - b.c.addr)[0]
  else if (policy === 'WORST') pick = [...free].sort((a, b) => b.c.size - a.c.size || a.c.addr - b.c.addr)[0]
  else if (policy === 'FIRST') {
    pick = free[0]
    searched = pick ? chunks.slice(0, pick.i + 1).filter((c) => c.free).length : searched
  } else {
    const n = chunks.length
    for (let k = 0; k < n; k++) {
      const i = (cursor + k) % n
      if (chunks[i].free && chunks[i].size >= op.size) {
        pick = { c: chunks[i], i }
        searched = k + 1
        break
      }
    }
  }
  if (!pick) return { op, ok: false, addr: null, searched, state: { chunks, nextFitCursor: cursor } }
  const { c, i } = pick
  const rest = c.size - op.size
  const used: Chunk = { addr: c.addr, size: op.size, free: false, id: op.id }
  const replacement = rest > 0 ? [used, { addr: c.addr + op.size, size: rest, free: true }] : [used]
  chunks.splice(i, 1, ...replacement)
  cursor = i + (rest > 0 ? 1 : 0)
  return { op, ok: true, addr: c.addr, searched, state: { chunks, nextFitCursor: Math.min(cursor, chunks.length - 1) } }
}

function coalesceAll(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = []
  for (const c of chunks) {
    const last = out[out.length - 1]
    if (last && last.free && c.free && last.addr + last.size === c.addr) last.size += c.size
    else out.push({ ...c })
  }
  return out
}

export function runOps(heapSize: number, ops: Op[], policy: FitPolicy, coalesce: boolean): OpResult[] {
  let s = initHeap(heapSize)
  return ops.map((op) => {
    const r = step(s, op, policy, coalesce)
    s = r.state
    return r
  })
}

/** External fragmentation: 1 − largest free chunk / total free. */
export function fragmentation(state: HeapState): number {
  const free = state.chunks.filter((c) => c.free)
  const total = free.reduce((s, c) => s + c.size, 0)
  if (!total) return 0
  return 1 - Math.max(...free.map((c) => c.size)) / total
}
