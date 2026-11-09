import { describe, expect, it } from 'vitest'
import { schedule } from '@/lib/sim/scheduler'
import { runMlfq, cpuShare } from '@/lib/sim/mlfq'
import { lottery, stride, runningShare, lotteryUnfairness } from '@/lib/sim/proportional'
import { runProcesses, programFrom, utilization } from '@/lib/sim/process'
import { baseBounds, segmentTranslate, pageTranslate, twoLevelTranslate, tableCost, type TwoLevel } from '@/lib/sim/memory'
import { simulateCache, hitRate, BELADY, tlbArrayWalk } from '@/lib/sim/caching'
import { runOps, fragmentation } from '@/lib/sim/freelist'
import { mean, pick, runEevdf, type TaskState } from '@/lib/sim/eevdf'

describe('chapter 7 schedulers (numbers from the book)', () => {
  const abc = (a: number, b: number, c: number, arr = [0, 0, 0]) => [
    { id: 'A', arrival: arr[0], length: a },
    { id: 'B', arrival: arr[1], length: b },
    { id: 'C', arrival: arr[2], length: c },
  ]
  it('FIFO with equal jobs: average turnaround 20', () => {
    expect(schedule(abc(10, 10, 10), 'FIFO').avgTurnaround).toBe(20)
  })
  it('convoy effect: FIFO 110 vs SJF 50', () => {
    expect(schedule(abc(100, 10, 10), 'FIFO').avgTurnaround).toBe(110)
    expect(schedule(abc(100, 10, 10), 'SJF').avgTurnaround).toBe(50)
  })
  it('late arrivals: SJF 103.33, STCF 50', () => {
    expect(schedule(abc(100, 10, 10, [0, 10, 10]), 'SJF').avgTurnaround).toBeCloseTo(103.33, 1)
    expect(schedule(abc(100, 10, 10, [0, 10, 10]), 'STCF').avgTurnaround).toBe(50)
  })
  it('RR improves response time: RR 1 vs SJF 5', () => {
    expect(schedule(abc(5, 5, 5), 'RR', 1).avgResponse).toBe(1)
    expect(schedule(abc(5, 5, 5), 'SJF').avgResponse).toBe(5)
    expect(schedule(abc(5, 5, 5), 'RR', 1).avgTurnaround).toBe(14)
  })
  it('slices cover exactly the total work', () => {
    const r = schedule(abc(7, 3, 5, [0, 2, 4]), 'RR', 2)
    expect(r.slices.reduce((s, x) => s + x.end - x.start, 0)).toBe(15)
  })
})

describe('chapter 8 MLFQ', () => {
  const cfg = { queues: 3, quantum: [10, 10, 10], allotment: [10, 10, 10], boost: 0, gamingFix: true }
  it('a long-running job sinks to the bottom queue', () => {
    const ticks = runMlfq([{ id: 'A', arrival: 0, length: 60 }], cfg)
    expect(ticks[5].level.A).toBe(0)
    expect(ticks[15].level.A).toBe(1)
    expect(ticks[35].level.A).toBe(2)
  })
  it('a short job that arrives later runs first (approximates SJF)', () => {
    const ticks = runMlfq([{ id: 'A', arrival: 0, length: 100 }, { id: 'B', arrival: 50, length: 10 }], cfg)
    expect(ticks.slice(50, 60).every((t) => t.running === 'B')).toBe(true)
  })
  it('priority boost rescues starving jobs', () => {
    const jobs = [
      { id: 'A', arrival: 0, length: 200 },
      { id: 'B', arrival: 30, length: 200, ioEvery: 1, ioTime: 1 },
      { id: 'C', arrival: 30, length: 200, ioEvery: 1, ioTime: 1 },
    ]
    const old = { ...cfg, gamingFix: false }
    const starving = cpuShare(runMlfq(jobs, old, 300), 40, 200).A ?? 0
    const boosted = cpuShare(runMlfq(jobs, { ...old, boost: 50 }, 300), 40, 200).A ?? 0
    expect(starving).toBeLessThan(0.05)
    expect(boosted).toBeGreaterThan(starving)
  })
  it('the gaming fix stops a job from monopolising the CPU', () => {
    const jobs = [
      { id: 'A', arrival: 0, length: 300 },
      { id: 'G', arrival: 0, length: 300, ioEvery: 9, ioTime: 1 },
    ]
    const gamed = cpuShare(runMlfq(jobs, { ...cfg, gamingFix: false }, 300), 50, 250).G
    const fixed = cpuShare(runMlfq(jobs, cfg, 300), 50, 250).G
    expect(gamed).toBeGreaterThan(0.8)
    expect(fixed).toBeLessThan(gamed)
  })
})

describe('chapter 9 proportional share', () => {
  it('lottery converges to ticket proportions', () => {
    const order = lottery([{ id: 'A', tickets: 75 }, { id: 'B', tickets: 25 }], 4000, 3)
    const share = runningShare(order, ['A', 'B'])
    expect(share.A[share.A.length - 1]).toBeCloseTo(0.75, 1)
  })
  it('stride reproduces the book trace (A=100, B=50, C=250 tickets)', () => {
    const { order } = stride([{ id: 'A', tickets: 100 }, { id: 'B', tickets: 50 }, { id: 'C', tickets: 250 }], 9)
    expect(order.slice(0, 8).join('')).toBe('ABCCCACC')
  })
  it('lottery unfairness approaches 1 for long jobs', () => {
    const avg = (len: number) => Array.from({ length: 30 }, (_, s) => lotteryUnfairness(len, s + 1)).reduce((a, b) => a + b) / 30
    expect(avg(1000)).toBeGreaterThan(avg(2))
    expect(avg(1000)).toBeGreaterThan(0.9)
  })
})

describe('chapter 4 process states (process-run.py)', () => {
  const opt = { ioLength: 5, switchOnIo: true, runImmediate: false }
  it('two CPU-bound processes keep the CPU 100% busy', () => {
    const rows = runProcesses([{ id: 'P0', program: programFrom(5, 100) }, { id: 'P1', program: programFrom(5, 100) }], opt)
    expect(rows.length).toBe(10)
    expect(utilization(rows).cpu).toBe(1)
  })
  it('issuing I/O first overlaps it with computation', () => {
    const a = runProcesses([{ id: 'P0', program: programFrom(4, 100) }, { id: 'P1', program: ['io'] }], opt).length
    const b = runProcesses([{ id: 'P0', program: ['io'] }, { id: 'P1', program: programFrom(4, 100) }], opt).length
    expect(b).toBeLessThan(a)
    const c = runProcesses([{ id: 'P0', program: ['io'] }, { id: 'P1', program: programFrom(4, 100) }], { ...opt, switchOnIo: false }).length
    expect(c).toBeGreaterThan(b)
  })
  it('states follow running → blocked → ready', () => {
    const rows = runProcesses([{ id: 'P0', program: ['io', 'cpu'] }, { id: 'P1', program: programFrom(8, 100) }], opt)
    const seq = rows.map((r) => r.states.P0)
    expect(seq[0]).toBe('running')
    expect(seq[1]).toBe('blocked')
    expect(seq).toContain('ready')
  })
})

describe('address translation', () => {
  it('base & bounds (ch. 15)', () => {
    const r = baseBounds(128, 32768, 16384)
    expect(r.ok && r.pa).toBe(32896)
    expect(baseBounds(16384, 32768, 16384).ok).toBe(false)
  })
  const segs = [
    { name: 'Code', base: 32 * 1024, size: 2 * 1024, growsPositive: true },
    { name: 'Heap', base: 34 * 1024, size: 3 * 1024, growsPositive: true },
    undefined as never,
    { name: 'Stack', base: 28 * 1024, size: 2 * 1024, growsPositive: false },
  ]
  it('segmentation heap example: 4200 → 34920', () => {
    const r = segmentTranslate(4200, segs)
    expect(r.ok && r.pa).toBe(34920)
  })
  it('segmentation stack example: 15KB → 27KB', () => {
    const r = segmentTranslate(15 * 1024, segs)
    expect(r.ok && r.pa).toBe(27 * 1024)
  })
  it('linear paging: VA 21 → PA 117', () => {
    const table = [{ valid: true, pfn: 3 }, { valid: true, pfn: 7 }, { valid: true, pfn: 5 }, { valid: true, pfn: 2 }]
    const r = pageTranslate(21, 16, table)
    expect(r.vpn).toBe(1)
    expect(r.offset).toBe(5)
    expect(r.ok && r.pa).toBe(117)
  })
  it('two-level: VA 0x3F80 → 0x0DC0 (ch. 20)', () => {
    const inv = { valid: false as const }
    const ptes = Array.from({ length: 16 }, () => ({ valid: false, pfn: 0 }))
    ptes[14] = { valid: true, pfn: 55 }
    const pt: TwoLevel = { dir: Array.from({ length: 16 }, () => inv) }
    pt.dir[15] = { valid: true, pfn: 101, ptes }
    const r = twoLevelTranslate(0x3f80, pt)
    expect(r.pdIndex).toBe(15)
    expect(r.ptIndex).toBe(14)
    expect(r.ok && r.pa).toBe(0x0dc0)
  })
  it('two-level tables are cheaper for sparse address spaces', () => {
    const c = tableCost([0, 1, 4, 5, 254, 255], 8, 4, 64)
    expect(c.linear).toBe(1024)
    expect(c.ptPages).toBe(2)
    expect(c.twoLevel).toBeLessThan(c.linear)
  })
})

describe('caching', () => {
  it('TLB array walk: m h h m h h h m h h (70%)', () => {
    const acc = tlbArrayWalk(10, 4, 100, 16, 16)
    expect(acc.map((a) => (a.hit ? 'h' : 'm')).join('')).toBe('mhhmhhhmhh')
  })
  it("Belady's anomaly under FIFO", () => {
    const h3 = simulateCache(BELADY, 3, 'FIFO').filter((s) => s.hit).length
    const h4 = simulateCache(BELADY, 4, 'FIFO').filter((s) => s.hit).length
    expect(h3).toBe(3)
    expect(h4).toBe(2)
  })
  it('ch. 22 example stream: OPT 6 hits, FIFO 4, LRU 6', () => {
    const refs = [0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1]
    expect(simulateCache(refs, 3, 'OPT').filter((s) => s.hit).length).toBe(6)
    expect(simulateCache(refs, 3, 'FIFO').filter((s) => s.hit).length).toBe(4)
    expect(simulateCache(refs, 3, 'LRU').filter((s) => s.hit).length).toBe(6)
    expect(hitRate(simulateCache(refs, 3, 'CLOCK'))).toBeGreaterThan(0)
  })
})

describe('free-space management', () => {
  it('splits, frees and coalesces', () => {
    const ops = [
      { kind: 'alloc' as const, size: 10, id: 1 },
      { kind: 'alloc' as const, size: 20, id: 2 },
      { kind: 'free' as const, id: 1 },
      { kind: 'free' as const, id: 2 },
    ]
    const without = runOps(100, ops, 'FIRST', false)
    expect(without[3].state.chunks.filter((c) => c.free).length).toBe(3)
    expect(fragmentation(without[3].state)).toBeGreaterThan(0)
    const withC = runOps(100, ops, 'FIRST', true)
    expect(withC[3].state.chunks).toEqual([{ addr: 0, size: 100, free: true }])
  })
  it('best fit picks the tightest hole, worst fit the largest', () => {
    const ops = [
      { kind: 'alloc' as const, size: 10, id: 1 },
      { kind: 'alloc' as const, size: 5, id: 2 },
      { kind: 'alloc' as const, size: 30, id: 3 },
      { kind: 'alloc' as const, size: 5, id: 4 },
      { kind: 'free' as const, id: 1 },
      { kind: 'free' as const, id: 3 },
      { kind: 'alloc' as const, size: 8, id: 5 },
    ]
    expect(runOps(100, ops, 'BEST', true)[6].addr).toBe(0)
    expect(runOps(100, ops, 'WORST', true)[6].addr).toBe(50)
  })
})

import { runMulticore } from '@/lib/sim/multicore'
describe('chapter 10 multiprocessor scheduling', () => {
  const jobs = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, length: 50 }))
  it('a single queue bounces jobs between CPUs (no affinity)', () => {
    expect(runMulticore(jobs, 4, 'SQMS').migrations).toBeGreaterThan(5)
  })
  it('per-CPU queues keep affinity: zero migrations', () => {
    expect(runMulticore(jobs, 4, 'MQMS').migrations).toBe(0)
  })
  it('work stealing trades a few migrations for balance', () => {
    const imbalanced = [{ id: 'A', length: 80 }, { id: 'B', length: 80 }, { id: 'C', length: 10 }, { id: 'D', length: 80 }]
    const mq = runMulticore(imbalanced, 2, 'MQMS')
    const steal = runMulticore(imbalanced, 2, 'MQMS+steal')
    expect(steal.makespan).toBeLessThan(mq.makespan)
    expect(steal.migrations).toBeGreaterThan(0)
  })
})

describe('EEVDF', () => {
  const cpu = (name: string, weight: number, slice: number) => ({ name, weight, slice })
  it('splits the CPU by weight, whatever slice each task requests', () => {
    expect(runEevdf([cpu('A', 1, 3), cpu('B', 1, 3)], 600).share[0]).toBeCloseTo(0.5, 2)
    expect(runEevdf([cpu('A', 1, 3), cpu('B', 1, 0.75)], 600).share[0]).toBeCloseTo(0.5, 2)
    expect(runEevdf([cpu('A', 2, 3), cpu('B', 1, 3)], 600).share[0]).toBeCloseTo(2 / 3, 1)
  })
  it('picks the eligible task with the earliest deadline, never an ineligible one', () => {
    const tasks = [cpu('A', 1, 3), cpu('B', 1, 1), cpu('C', 1, 1)]
    const s = (v: number, deadline: number): TaskState => ({ v, deadline, runnable: true, left: Infinity, wakeIn: 0, lag: 0, wokeAt: null, ran: 0 })
    // V = 2: A (v=1) and B (v=2) are eligible, C (v=3) is not although its deadline is earliest
    expect(pick(tasks, [s(1, 4), s(2, 3), s(3, 2.5)])).toBe(1)
  })
  it('gives a waking task that asks for short slices a shorter wait', () => {
    const run = (slice: number) => runEevdf([cpu('A', 1, 3), cpu('B', 1, 3), { name: 'C', weight: 1, slice, burst: 0.5, sleep: 3.75 }], 2000)
    expect(mean(run(0.5).wakeLatency[2])).toBeLessThan(mean(run(3).wakeLatency[2]) / 2)
  })
})
