/**
 * Chapter 7 schedulers: FIFO, SJF, STCF and Round Robin over a CPU-only workload,
 * simulated in unit time steps. Mirrors scheduler.py from the OSTEP homework.
 */
export type Policy = 'FIFO' | 'SJF' | 'STCF' | 'RR'

export interface Job {
  id: string
  arrival: number
  length: number
}

export interface Slice {
  job: string
  start: number
  end: number
}

export interface JobStats {
  id: string
  arrival: number
  firstRun: number
  completion: number
  response: number
  turnaround: number
  wait: number
}

export interface ScheduleResult {
  slices: Slice[]
  stats: JobStats[]
  avgTurnaround: number
  avgResponse: number
  avgWait: number
  makespan: number
}

export function schedule(jobs: Job[], policy: Policy, quantum = 1): ScheduleResult {
  const remaining = new Map(jobs.map((j) => [j.id, j.length]))
  const firstRun = new Map<string, number>()
  const completion = new Map<string, number>()
  const order = new Map(jobs.map((j, i) => [j.id, i]))
  const slices: Slice[] = []
  const rrQueue: string[] = []
  const arrived = new Set<string>()
  let current: string | null = null
  let quantumLeft = 0
  let t = 0
  const total = jobs.reduce((s, j) => s + j.length, 0)
  const byArrival = (a: Job, b: Job) => a.arrival - b.arrival || order.get(a.id)! - order.get(b.id)!
  const sorted = [...jobs].sort(byArrival)
  const guard = total + Math.max(0, ...jobs.map((j) => j.arrival)) + 1

  while (completion.size < jobs.length && t <= guard) {
    for (const j of sorted) {
      if (j.arrival <= t && !arrived.has(j.id)) {
        arrived.add(j.id)
        if (j.length > 0) rrQueue.push(j.id)
        else completion.set(j.id, t)
      }
    }
    const ready = sorted.filter((j) => arrived.has(j.id) && remaining.get(j.id)! > 0)
    let pick: string | null = null
    if (ready.length) {
      if (policy === 'FIFO') pick = current && remaining.get(current)! > 0 ? current : ready[0].id
      else if (policy === 'SJF') {
        pick = current && remaining.get(current)! > 0 ? current : [...ready].sort((a, b) => a.length - b.length || byArrival(a, b))[0].id
      } else if (policy === 'STCF') {
        pick = [...ready].sort((a, b) => remaining.get(a.id)! - remaining.get(b.id)! || byArrival(a, b))[0].id
      } else {
        if (current && remaining.get(current)! > 0 && quantumLeft > 0) pick = current
        else {
          if (current && remaining.get(current)! > 0) rrQueue.push(current)
          pick = rrQueue.shift() ?? null
          quantumLeft = quantum
        }
      }
    }
    if (pick === null) {
      current = null
      t++
      continue
    }
    current = pick
    if (!firstRun.has(pick)) firstRun.set(pick, t)
    const last = slices[slices.length - 1]
    if (last && last.job === pick && last.end === t) last.end = t + 1
    else slices.push({ job: pick, start: t, end: t + 1 })
    remaining.set(pick, remaining.get(pick)! - 1)
    quantumLeft--
    t++
    if (remaining.get(pick) === 0) {
      completion.set(pick, t)
      current = null
      quantumLeft = 0
    }
  }

  const stats = jobs.map((j) => {
    const fr = firstRun.get(j.id) ?? j.arrival
    const c = completion.get(j.id) ?? j.arrival
    return { id: j.id, arrival: j.arrival, firstRun: fr, completion: c, response: fr - j.arrival, turnaround: c - j.arrival, wait: c - j.arrival - j.length }
  })
  const avg = (k: keyof JobStats) => (stats.length ? stats.reduce((s, x) => s + (x[k] as number), 0) / stats.length : 0)
  return { slices, stats, avgTurnaround: avg('turnaround'), avgResponse: avg('response'), avgWait: avg('wait'), makespan: Math.max(0, ...stats.map((s) => s.completion)) }
}
