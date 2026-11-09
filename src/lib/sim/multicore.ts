/**
 * Chapter 10: single-queue vs. multi-queue multiprocessor scheduling.
 * Time advances in slices; a job that runs on a different CPU than last time pays a cache-refill
 * penalty (it makes less progress in that slice) — the cost of lost cache affinity.
 */
export type McPolicy = 'SQMS' | 'MQMS' | 'MQMS+steal'

export interface McJob {
  id: string
  length: number
}

export interface McSlice {
  cpu: number
  start: number
  end: number
  job: string
  cold: boolean
}

export interface McResult {
  slices: McSlice[]
  migrations: number
  idle: number
  makespan: number
  completion: Record<string, number>
}

export function runMulticore(jobs: McJob[], cpus: number, policy: McPolicy, slice = 10, penalty = 3, maxT = 2000): McResult {
  const left = new Map(jobs.map((j) => [j.id, j.length]))
  const lastCpu = new Map<string, number>()
  const completion: Record<string, number> = {}
  const slices: McSlice[] = []
  let migrations = 0
  let idle = 0
  const global: string[] = jobs.map((j) => j.id)
  const local: string[][] = Array.from({ length: cpus }, () => [])
  jobs.forEach((j, i) => local[i % cpus].push(j.id))

  for (let t = 0; t < maxT && left.size; t += slice) {
    const picked: (string | null)[] = []
    for (let c = 0; c < cpus; c++) {
      let job: string | null = null
      if (policy === 'SQMS') job = global.shift() ?? null
      else {
        if (!local[c].length && policy === 'MQMS+steal') {
          const victim = local.reduce((best, q, i) => (q.length > local[best].length ? i : best), 0)
          if (local[victim].length > 1) local[c].push(local[victim].pop()!)
        }
        job = local[c].shift() ?? null
      }
      picked.push(job)
    }
    picked.forEach((job, c) => {
      if (!job) {
        idle += slice
        return
      }
      const cold = lastCpu.has(job) && lastCpu.get(job) !== c
      if (cold) migrations++
      lastCpu.set(job, c)
      const work = slice - (cold ? penalty : 0)
      const remaining = left.get(job)! - work
      const used = remaining <= 0 ? left.get(job)! + (cold ? penalty : 0) : slice
      slices.push({ cpu: c, start: t, end: t + used, job, cold })
      if (remaining <= 0) {
        left.delete(job)
        completion[job] = t + used
        idle += slice - used
      } else {
        left.set(job, remaining)
        if (policy === 'SQMS') global.push(job)
        else local[c].push(job)
      }
    })
  }
  return { slices, migrations, idle, makespan: Math.max(0, ...Object.values(completion)), completion }
}
