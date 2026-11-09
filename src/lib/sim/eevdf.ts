/**
 * EEVDF (Earliest Eligible Virtual Deadline First, Stoica & Abdel-Wahab 1995), simplified.
 *
 * Every runnable task i has a weight w_i and a virtual runtime v_i that advances by dt / w_i while it
 * runs. The queue's virtual time V is the weighted average of the v_i. A task is *eligible* when
 * v_i <= V (it has received no more than its fair share: its lag w_i(V - v_i) is >= 0). Each request
 * for r_i ms of CPU gets a *virtual deadline* d_i = v_i + r_i / w_i. The scheduler runs the eligible
 * task with the earliest deadline. A task that sleeps keeps its lag and is placed back at V - lag.
 *
 * Simplifications: fixed time step, wakeup preemption whenever the woken task would be picked
 * (as with Linux 6.12's PREEMPT_SHORT for short slices), no load-balancing, no RUN_TO_PARITY.
 */
export interface EevdfTask {
  name: string
  weight: number
  /** request size (the slice), ms */
  slice: number
  /** for an interactive task: ms of CPU per burst, then ms asleep; omit for always-runnable */
  burst?: number
  sleep?: number
}

export interface TaskState {
  v: number
  deadline: number
  runnable: boolean
  /** CPU left in the current burst (interactive tasks) */
  left: number
  /** ms until wakeup while asleep */
  wakeIn: number
  lag: number
  wokeAt: number | null
  ran: number
}

export interface Frame {
  t: number
  running: number | null
  V: number
  tasks: { v: number; deadline: number; runnable: boolean; eligible: boolean }[]
}

export interface EevdfResult {
  /** which task ran in each step (null = idle) */
  timeline: (number | null)[]
  frames: Frame[]
  /** ms from wakeup to first run, per wakeup, per task */
  wakeLatency: number[][]
  /** fraction of CPU per task */
  share: number[]
  dt: number
}

const avg = (tasks: EevdfTask[], st: TaskState[]) => {
  let num = 0
  let den = 0
  st.forEach((s, i) => {
    if (!s.runnable) return
    num += tasks[i].weight * s.v
    den += tasks[i].weight
  })
  return den ? num / den : 0
}

const EPS = 1e-9

/** The task EEVDF picks: earliest virtual deadline among eligible runnable tasks. */
export function pick(tasks: EevdfTask[], st: TaskState[], V = avg(tasks, st)): number | null {
  let best: number | null = null
  st.forEach((s, i) => {
    if (!s.runnable || s.v > V + EPS) return
    if (best === null || s.deadline < st[best].deadline - EPS) best = i
  })
  return best
}

export function runEevdf(tasks: EevdfTask[], duration: number, dt = 0.25): EevdfResult {
  const st: TaskState[] = tasks.map((t) => ({ v: 0, deadline: t.slice / t.weight, runnable: true, left: t.burst ?? Infinity, wakeIn: 0, lag: 0, wokeAt: null, ran: 0 }))
  const timeline: (number | null)[] = []
  const frames: Frame[] = []
  const wakeLatency: number[][] = tasks.map(() => [])
  let cur: number | null = null
  const steps = Math.round(duration / dt)
  for (let k = 0; k < steps; k++) {
    const t = k * dt
    // wakeups: a sleeper comes back at V minus the lag it left with
    st.forEach((s, i) => {
      if (s.runnable) return
      s.wakeIn -= dt
      if (s.wakeIn > EPS) return
      const V = avg(tasks, st)
      s.runnable = true
      s.v = V - s.lag / tasks[i].weight
      s.deadline = s.v + tasks[i].slice / tasks[i].weight
      s.left = tasks[i].burst ?? Infinity
      s.wokeAt = t
      // wakeup preemption: run it now if it would be picked
      if (pick(tasks, st) === i) cur = i
    })
    if (cur === null || !st[cur].runnable) cur = pick(tasks, st)
    const V = avg(tasks, st)
    frames.push({ t, running: cur, V, tasks: st.map((s) => ({ v: s.v, deadline: s.deadline, runnable: s.runnable, eligible: s.runnable && s.v <= V + EPS })) })
    timeline.push(cur)
    if (cur === null) continue
    const s = st[cur]
    const task = tasks[cur]
    if (s.wokeAt !== null) {
      wakeLatency[cur].push(t - s.wokeAt)
      s.wokeAt = null
    }
    s.v += dt / task.weight
    s.ran += dt
    s.left -= dt
    // burst over: go to sleep, keeping the lag
    if (s.left <= EPS && task.sleep !== undefined) {
      const Vnow = avg(tasks, st)
      s.lag = task.weight * (Vnow - s.v)
      s.runnable = false
      s.wakeIn = task.sleep
      cur = null
      continue
    }
    // request served: a new request gets a new deadline, and the choice is made again
    if (s.v >= s.deadline - EPS) {
      s.deadline = s.v + task.slice / task.weight
      cur = null
    }
  }
  const total = st.reduce((a, s) => a + s.ran, 0) || 1
  return { timeline, frames, wakeLatency, share: st.map((s) => s.ran / total), dt }
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
