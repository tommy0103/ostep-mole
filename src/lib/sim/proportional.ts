/** Chapter 9: lottery and stride scheduling. */
import { rng } from './rng'

export interface ShareJob {
  id: string
  tickets: number
}

/** Each quantum, draw a winning ticket uniformly at random. */
export function lottery(jobs: ShareJob[], quanta: number, seed = 1): string[] {
  const r = rng(seed)
  const total = jobs.reduce((s, j) => s + j.tickets, 0)
  const out: string[] = []
  for (let q = 0; q < quanta; q++) {
    let winner = Math.floor(r() * total)
    for (const j of jobs) {
      if (winner < j.tickets) {
        out.push(j.id)
        break
      }
      winner -= j.tickets
    }
  }
  return out
}

export const STRIDE_CONSTANT = 10000

/** Deterministic counterpart: always run the job with the lowest pass; pass += stride. */
export function stride(jobs: ShareJob[], quanta: number): { order: string[]; passes: Record<string, number>[] } {
  const pass: Record<string, number> = Object.fromEntries(jobs.map((j) => [j.id, 0]))
  const strideOf: Record<string, number> = Object.fromEntries(jobs.map((j) => [j.id, STRIDE_CONSTANT / j.tickets]))
  const order: string[] = []
  const passes: Record<string, number>[] = []
  for (let q = 0; q < quanta; q++) {
    passes.push({ ...pass })
    let best = jobs[0].id
    for (const j of jobs) if (pass[j.id] < pass[best]) best = j.id
    order.push(best)
    pass[best] += strideOf[best]
  }
  return { order, passes }
}

/** Running share of quanta won by each job after each draw (for convergence plots). */
export function runningShare(order: string[], ids: string[]): Record<string, number[]> {
  const won: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
  const out: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]))
  order.forEach((id, i) => {
    won[id]++
    for (const k of ids) out[k].push(won[k] / (i + 1))
  })
  return out
}

/**
 * Unfairness metric U from the chapter: two jobs with equal tickets and the same run time;
 * U = time the first job completes / time the second completes (1 = perfectly fair).
 */
export function lotteryUnfairness(jobLength: number, seed: number): number {
  const r = rng(seed)
  const left = [jobLength, jobLength]
  let t = 0
  let first = 0
  while (left[0] > 0 || left[1] > 0) {
    const alive = [0, 1].filter((i) => left[i] > 0)
    const w = alive[Math.floor(r() * alive.length)]
    left[w]--
    t++
    if (left[w] === 0 && !first) first = t
  }
  return first / t
}
