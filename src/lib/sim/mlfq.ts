/**
 * Chapter 8: Multi-Level Feedback Queue, following the five rules of the chapter.
 *   1. Priority(A) > Priority(B) → A runs.
 *   2. Equal priority → round robin with that queue's quantum.
 *   3. New jobs enter the topmost queue.
 *   4. Once a job uses up its allotment at a level (regardless of how many times it gave up the
 *      CPU) its priority is reduced.  With `gamingFix: false` the older rules 4a/4b apply instead:
 *      giving up the CPU before the quantum ends resets the allotment, which can be gamed.
 *   5. Every `boost` ticks, move all jobs to the topmost queue.
 */
export interface MlfqJob {
  id: string
  arrival: number
  length: number
  /** issue an I/O after running this many ticks (0 = never) */
  ioEvery?: number
  ioTime?: number
}

export interface MlfqConfig {
  queues: number
  quantum: number[] // per queue, index 0 = highest priority
  allotment: number[] // per queue
  boost: number // 0 = never
  gamingFix: boolean
}

export interface MlfqTick {
  t: number
  running: string | null
  queues: string[][] // ready jobs per level (highest first) at the start of the tick
  level: Record<string, number>
  blocked: string[]
  boosted: boolean
  done: string[]
}

interface State {
  job: MlfqJob
  level: number
  left: number
  allotUsed: number
  quantumUsed: number
  sinceIo: number
  ioLeft: number
  done: boolean
  arrived: boolean
}

export function runMlfq(jobs: MlfqJob[], cfg: MlfqConfig, maxT = 400): MlfqTick[] {
  const st: State[] = jobs.map((job) => ({ job, level: 0, left: job.length, allotUsed: 0, quantumUsed: 0, sinceIo: 0, ioLeft: 0, done: false, arrived: false }))
  const queues: State[][] = Array.from({ length: cfg.queues }, () => [])
  const ticks: MlfqTick[] = []
  let running: State | null = null
  for (let t = 0; t < maxT; t++) {
    let boosted = false
    for (const s of st) {
      if (!s.arrived && s.job.arrival <= t) {
        s.arrived = true
        queues[0].push(s)
      }
    }
    // I/O completion
    for (const s of st) {
      if (s.ioLeft > 0) {
        s.ioLeft--
        if (s.ioLeft === 0 && !s.done) queues[s.level].push(s)
      }
    }
    if (cfg.boost > 0 && t > 0 && t % cfg.boost === 0) {
      boosted = true
      const all = queues.flat()
      queues.forEach((q) => (q.length = 0))
      if (running) all.unshift(running)
      for (const s of st) if (s.arrived && !s.done) { s.level = 0; s.allotUsed = 0 }
      queues[0].push(...all.filter((s, i, a) => a.indexOf(s) === i && s !== running))
    }
    // preemption by a higher-priority job, or quantum expiry
    if (running) {
      const higher = queues.slice(0, running.level).some((q) => q.length > 0)
      if (higher || running.quantumUsed >= cfg.quantum[running.level]) {
        running.quantumUsed = 0
        queues[running.level].push(running)
        running = null
      }
    }
    if (!running) {
      const q = queues.find((q) => q.length > 0)
      running = q ? q.shift()! : null
      if (running) running.quantumUsed = 0
    }
    const snapshot: MlfqTick = {
      t,
      running: running?.job.id ?? null,
      queues: queues.map((q) => q.map((s) => s.job.id)),
      level: Object.fromEntries(st.filter((s) => s.arrived).map((s) => [s.job.id, s.level])),
      blocked: st.filter((s) => s.ioLeft > 0).map((s) => s.job.id),
      boosted,
      done: st.filter((s) => s.done).map((s) => s.job.id),
    }
    ticks.push(snapshot)
    if (running) {
      const r = running
      r.left--
      r.allotUsed++
      r.quantumUsed++
      r.sinceIo++
      if (r.left <= 0) {
        r.done = true
        running = null
      } else if (r.job.ioEvery && r.sinceIo >= r.job.ioEvery) {
        // gives up the CPU to do I/O
        r.sinceIo = 0
        r.ioLeft = r.job.ioTime ?? 1
        if (!cfg.gamingFix) r.allotUsed = 0 // rule 4b: stays at the same level, allotment reset
        else if (r.allotUsed >= cfg.allotment[r.level] && r.level < cfg.queues - 1) { r.level++; r.allotUsed = 0 }
        r.quantumUsed = 0
        running = null
      } else if (r.allotUsed >= cfg.allotment[r.level]) {
        if (r.level < cfg.queues - 1) r.level++
        r.allotUsed = 0
        r.quantumUsed = 0
        queues[r.level].push(r)
        running = null
      }
    }
    if (st.every((s) => s.done)) {
      ticks.push({ ...snapshot, t: t + 1, running: null, queues: queues.map(() => []), blocked: [], boosted: false, done: st.map((s) => s.job.id) })
      break
    }
  }
  return ticks
}

/** Share of CPU each job received in [from, to). */
export function cpuShare(ticks: MlfqTick[], from = 0, to = Infinity): Record<string, number> {
  const out: Record<string, number> = {}
  let n = 0
  for (const k of ticks) {
    if (k.t < from || k.t >= to) continue
    n++
    if (k.running) out[k.running] = (out[k.running] ?? 0) + 1
  }
  for (const key of Object.keys(out)) out[key] /= n || 1
  return out
}
