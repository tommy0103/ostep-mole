/** Chapters 19 & 22: the TLB and page-replacement policies are both caches. */
import { rng } from './rng'

export type ReplPolicy = 'FIFO' | 'LRU' | 'OPT' | 'CLOCK' | 'RANDOM'

export interface CacheStep {
  ref: number
  hit: boolean
  evicted: number | null
  /** cache slots after this access (null = empty slot) */
  slots: (number | null)[]
  /** CLOCK only: use bits and hand position after the access */
  useBits?: boolean[]
  hand?: number
}

export function simulateCache(refs: number[], size: number, policy: ReplPolicy, seed = 7): CacheStep[] {
  const slots: (number | null)[] = new Array(size).fill(null)
  const lastUse = new Map<number, number>()
  const loadedAt = new Map<number, number>()
  const use: boolean[] = new Array(size).fill(false)
  let hand = 0
  const r = rng(seed)
  const steps: CacheStep[] = []
  refs.forEach((ref, t) => {
    let idx = slots.indexOf(ref)
    let evicted: number | null = null
    const hit = idx >= 0
    if (!hit) {
      idx = slots.indexOf(null)
      if (idx < 0) {
        if (policy === 'FIFO') idx = argmin(slots, (p) => loadedAt.get(p!)!)
        else if (policy === 'LRU') idx = argmin(slots, (p) => lastUse.get(p!)!)
        else if (policy === 'RANDOM') idx = Math.floor(r() * size)
        else if (policy === 'OPT') {
          // evict the page referenced furthest in the future (or never again)
          idx = argmin(slots, (p) => {
            const next = refs.indexOf(p!, t + 1)
            return next < 0 ? -Infinity : -next
          })
        } else {
          while (use[hand]) {
            use[hand] = false
            hand = (hand + 1) % size
          }
          idx = hand
          hand = (hand + 1) % size
        }
        evicted = slots[idx]
      }
      slots[idx] = ref
      loadedAt.set(ref, t)
    }
    lastUse.set(ref, t)
    use[idx] = true
    steps.push({ ref, hit, evicted, slots: [...slots], ...(policy === 'CLOCK' ? { useBits: [...use], hand } : {}) })
  })
  return steps
}

function argmin<T>(xs: T[], key: (x: T) => number): number {
  let best = 0
  for (let i = 1; i < xs.length; i++) if (key(xs[i]) < key(xs[best])) best = i
  return best
}

export const hitRate = (steps: CacheStep[]) => (steps.length ? steps.filter((s) => s.hit).length / steps.length : 0)

/** Hit rate as a function of cache size — the curve that reveals Belady's anomaly for FIFO. */
export function hitCurve(refs: number[], policy: ReplPolicy, maxSize: number): number[] {
  return Array.from({ length: maxSize }, (_, i) => hitRate(simulateCache(refs, i + 1, policy)))
}

/** The classic reference string showing Belady's anomaly under FIFO (3 vs 4 frames). */
export const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]

// ---------- TLB over an array walk (ch. 19, figure 19.2) ----------
export interface TlbAccess {
  index: number
  va: number
  vpn: number
  hit: boolean
}

/** Walk `count` elements of `elemSize` bytes starting at `startVa`, through an LRU TLB. */
export function tlbArrayWalk(count: number, elemSize: number, startVa: number, pageSize: number, tlbSize: number, passes = 1): TlbAccess[] {
  const tlb: number[] = []
  const out: TlbAccess[] = []
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < count; i++) {
      const va = startVa + i * elemSize
      const vpn = Math.floor(va / pageSize)
      const at = tlb.indexOf(vpn)
      const hit = at >= 0
      if (hit) tlb.splice(at, 1)
      else if (tlb.length >= tlbSize) tlb.shift()
      tlb.push(vpn)
      out.push({ index: i, va, vpn, hit })
    }
  }
  return out
}
