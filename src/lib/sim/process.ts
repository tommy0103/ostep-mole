/**
 * Chapter 4: process states. A tiny re-implementation of process-run.py:
 * each process is a list of instructions, either 'cpu' (one tick on the CPU) or 'io'
 * (one tick on the CPU to issue, then `ioLength` ticks blocked).
 */
export type Instr = 'cpu' | 'io'
export type PState = 'ready' | 'running' | 'blocked' | 'done'

export interface ProcSpec {
  id: string
  program: Instr[]
}

export interface ProcOptions {
  ioLength: number
  /** SWITCH_ON_IO: run someone else while a process waits for I/O; SWITCH_ON_END: don't */
  switchOnIo: boolean
  /** IO_RUN_IMMEDIATE: when an I/O completes, switch to the process that issued it */
  runImmediate: boolean
}

export interface TraceRow {
  t: number
  states: Record<string, PState>
  cpuBusy: boolean
  ioBusy: boolean
  event?: string
}

export function runProcesses(procs: ProcSpec[], opt: ProcOptions): TraceRow[] {
  const pc: Record<string, number> = Object.fromEntries(procs.map((p) => [p.id, 0]))
  const state: Record<string, PState> = Object.fromEntries(procs.map((p) => [p.id, 'ready' as PState]))
  const ioDone: Record<string, number> = {}
  const rows: TraceRow[] = []
  let current: string | null = procs[0]?.id ?? null
  const ids = procs.map((p) => p.id)
  const prog = Object.fromEntries(procs.map((p) => [p.id, p.program]))
  const finished = (id: string) => pc[id] >= prog[id].length
  for (const id of ids) if (finished(id)) state[id] = 'done'

  for (let t = 1; t < 500; t++) {
    let event: string | undefined
    // I/O completions at the start of the tick
    for (const id of ids) {
      if (state[id] === 'blocked' && ioDone[id] === t) {
        state[id] = finished(id) ? 'done' : 'ready'
        event = `${id}: I/O done`
        if (opt.runImmediate && state[id] === 'ready' && current && state[current] === 'running') {
          state[current] = 'ready'
          current = id
        }
      }
    }
    if (ids.every((id) => state[id] === 'done')) break
    // choose who runs
    const curOk = current !== null && (state[current] === 'running' || state[current] === 'ready')
    const someoneBlocked = ids.some((id) => state[id] === 'blocked')
    if (!curOk) {
      if (!opt.switchOnIo && current !== null && state[current] === 'blocked') {
        // SWITCH_ON_END: wait for the blocked process
      } else {
        const start: number = current ? ids.indexOf(current) : -1
        current = null
        for (let k = 1; k <= ids.length; k++) {
          const id: string = ids[(start + k) % ids.length]
          if (state[id] === 'ready') {
            current = id
            break
          }
        }
      }
    }
    let cpuBusy = false
    if (current && state[current] !== 'blocked' && state[current] !== 'done') {
      state[current] = 'running'
      const ins = prog[current][pc[current]]
      pc[current]++
      cpuBusy = true
      if (ins === 'io') {
        // issuing the I/O takes this tick; the process blocks from the next tick on
        ioDone[current] = t + opt.ioLength + 1
        event = event ?? `${current}: issues I/O`
      }
    }
    const snapshot: Record<string, PState> = { ...state }
    const ioBusy = ids.some((id) => state[id] === 'blocked')
    rows.push({ t, states: snapshot, cpuBusy, ioBusy: ioBusy || someoneBlocked, event })
    // transitions effective at end of tick
    if (current && cpuBusy) {
      const ins = prog[current][pc[current] - 1]
      if (ins === 'io') state[current] = 'blocked'
      else if (finished(current)) {
        state[current] = 'done'
        current = null
      }
    }
  }
  return rows
}

export function utilization(rows: TraceRow[]): { cpu: number; io: number } {
  const n = rows.length || 1
  return { cpu: rows.filter((r) => r.cpuBusy).length / n, io: rows.filter((r) => r.ioBusy).length / n }
}

/** Parse "5:100" (5 instructions, 100% CPU) into a deterministic instruction list. */
export function programFrom(count: number, cpuPercent: number): Instr[] {
  const out: Instr[] = []
  let acc = 0
  for (let i = 0; i < count; i++) {
    acc += cpuPercent
    if (acc >= 100) {
      out.push('cpu')
      acc -= 100
    } else out.push('io')
  }
  return out
}
