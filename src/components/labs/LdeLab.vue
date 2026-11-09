<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

type Lane = 'os' | 'hw' | 'prog'
interface Step {
  lane: Lane
  text: Bi
  /** where the register sets live after this step */
  regs?: { cpu: 'A' | 'B' | null; kA?: boolean; kB?: boolean; pA?: boolean; pB?: boolean }
  boot?: boolean
}

const SYSCALL: Step[] = [
  { lane: 'os', boot: true, text: { en: 'initialize trap table', zh: '初始化陷阱表' } },
  { lane: 'hw', boot: true, text: { en: 'remember address of the syscall handler', zh: '记住系统调用处理程序的地址' } },
  { lane: 'os', text: { en: 'create process entry; allocate memory; load program; set up stack; fill kernel stack with regs/PC', zh: '创建进程条目；分配内存；加载程序；设置栈；用寄存器/PC 填充内核栈' }, regs: { cpu: null, kA: true } },
  { lane: 'os', text: { en: 'return-from-trap', zh: '从陷阱返回' }, regs: { cpu: null, kA: true } },
  { lane: 'hw', text: { en: 'restore regs from kernel stack · move to user mode · jump to main', zh: '从内核栈恢复寄存器 · 切换到用户模式 · 跳到 main' }, regs: { cpu: 'A' } },
  { lane: 'prog', text: { en: 'run main() … call a system call: trap into OS', zh: '运行 main()……发起系统调用：陷入操作系统' }, regs: { cpu: 'A' } },
  { lane: 'hw', text: { en: 'save regs to kernel stack · move to kernel mode · jump to trap handler', zh: '把寄存器保存到内核栈 · 切换到内核模式 · 跳到陷阱处理程序' }, regs: { cpu: null, kA: true } },
  { lane: 'os', text: { en: 'handle trap: do the work of the syscall · return-from-trap', zh: '处理陷阱：完成系统调用的工作 · 从陷阱返回' }, regs: { cpu: null, kA: true } },
  { lane: 'hw', text: { en: 'restore regs from kernel stack · move to user mode · jump to PC after trap', zh: '从内核栈恢复寄存器 · 切换到用户模式 · 跳到陷阱之后的 PC' }, regs: { cpu: 'A' } },
  { lane: 'prog', text: { en: '… return from main · trap (via exit())', zh: '……从 main 返回 · 陷入（通过 exit()）' }, regs: { cpu: 'A' } },
  { lane: 'os', text: { en: 'free memory of process · remove from process list', zh: '释放进程内存 · 从进程列表中移除' }, regs: { cpu: null } },
]

const TIMER: Step[] = [
  { lane: 'os', boot: true, text: { en: 'initialize trap table · start interrupt timer', zh: '初始化陷阱表 · 启动中断定时器' } },
  { lane: 'hw', boot: true, text: { en: 'remember addresses of syscall & timer handlers · start timer (interrupt every X ms)', zh: '记住系统调用与时钟处理程序的地址 · 启动定时器（每 X 毫秒中断一次）' } },
  { lane: 'prog', text: { en: 'Process A runs …', zh: '进程 A 运行……' }, regs: { cpu: 'A', pB: true, kB: true } },
  { lane: 'hw', text: { en: 'timer interrupt! save regs(A) → k-stack(A) · move to kernel mode · jump to trap handler', zh: '时钟中断！保存 regs(A) → 内核栈(A) · 切换到内核模式 · 跳到陷阱处理程序' }, regs: { cpu: null, kA: true, pB: true, kB: true } },
  { lane: 'os', text: { en: 'handle the trap · call switch(): save regs(A) → proc_t(A)', zh: '处理陷阱 · 调用 switch()：保存 regs(A) → proc_t(A)' }, regs: { cpu: null, kA: true, pA: true, pB: true, kB: true } },
  { lane: 'os', text: { en: 'restore regs(B) ← proc_t(B) · switch to k-stack(B)', zh: '恢复 regs(B) ← proc_t(B) · 切换到内核栈(B)' }, regs: { cpu: null, kA: true, pA: true, kB: true } },
  { lane: 'os', text: { en: 'return-from-trap (into B)', zh: '从陷阱返回（进入 B）' }, regs: { cpu: null, kA: true, pA: true, kB: true } },
  { lane: 'hw', text: { en: 'restore regs(B) ← k-stack(B) · move to user mode · jump to B’s PC', zh: '恢复 regs(B) ← 内核栈(B) · 切换到用户模式 · 跳到 B 的 PC' }, regs: { cpu: 'B', kA: true, pA: true } },
  { lane: 'prog', text: { en: 'Process B runs …', zh: '进程 B 运行……' }, regs: { cpu: 'B', kA: true, pA: true } },
]

const scenario = ref<'syscall' | 'timer'>('timer')
const steps = computed(() => (scenario.value === 'timer' ? TIMER : SYSCALL))
const duration = computed(() => steps.value.length)
const player = usePlayer(duration, { speed: 0.8 })
watch(scenario, () => player.reset())
const shown = computed(() => Math.min(steps.value.length, Math.floor(player.t.value)))
const cur = computed(() => (shown.value > 0 ? steps.value[shown.value - 1] : null))
const regs = computed(() => {
  for (let i = shown.value - 1; i >= 0; i--) if (steps.value[i].regs) return steps.value[i].regs!
  return null
})
const kernelMode = computed(() => !!cur.value && cur.value.lane !== 'prog')
const LANES: { id: Lane; title: Bi }[] = [
  { id: 'os', title: { en: 'OS @ kernel mode', zh: '操作系统 @ 内核模式' } },
  { id: 'hw', title: { en: 'Hardware', zh: '硬件' } },
  { id: 'prog', title: { en: 'Program @ user mode', zh: '程序 @ 用户模式' } },
]
</script>

<template>
  <LabFrame :title="title" name="lde" :player="player" :duration="duration"
    :hint="{ en: 'Figures 6.2 and 6.3 as a timeline. Note who saves the registers: the hardware (implicitly, on the trap) and the OS (explicitly, in switch()).', zh: '把图 6.2 与 6.3 画成时间线。注意寄存器由谁保存：硬件（陷入时隐式保存）和操作系统（在 switch() 中显式保存）。' }">
    <div class="lab-row top">
      <div class="seg">
        <button :aria-pressed="scenario === 'syscall'" @click="scenario = 'syscall'">{{ t({ en: 'system call (Fig. 6.2)', zh: '系统调用（图 6.2）' }) }}</button>
        <button :aria-pressed="scenario === 'timer'" @click="scenario = 'timer'">{{ t({ en: 'timer interrupt → switch (Fig. 6.3)', zh: '时钟中断 → 切换（图 6.3）' }) }}</button>
      </div>
      <span class="mode mono" :class="{ k: kernelMode }">{{ cur ? (kernelMode ? t({ en: 'KERNEL MODE', zh: '内核模式' }) : t({ en: 'USER MODE', zh: '用户模式' })) : '—' }}</span>
    </div>
    <div class="lab-grid side">
      <div class="lanes">
        <div class="lane-heads">
          <div v-for="l in LANES" :key="l.id" class="lh mono" :class="l.id">{{ t(l.title) }}</div>
        </div>
        <TransitionGroup name="row" tag="div" class="rows">
          <div v-for="(s, i) in steps.slice(0, shown)" :key="scenario + i" class="srow" :class="{ now: i === shown - 1, boot: s.boot }">
            <div v-for="l in LANES" :key="l.id" class="cell">
              <div v-if="s.lane === l.id" class="box" :class="l.id">{{ t(s.text) }}</div>
            </div>
          </div>
        </TransitionGroup>
        <div v-if="!shown" class="empty muted">{{ t({ en: 'Press play — boot happens first.', zh: '点击播放——先从开机开始。' }) }}</div>
      </div>
      <div class="machine">
        <div class="lab-label">{{ t({ en: 'where are the registers?', zh: '寄存器在哪里？' }) }}</div>
        <div class="cpu" :class="{ k: kernelMode }">
          <span class="mono">CPU</span>
          <Transition name="fade" mode="out-in">
            <span v-if="regs?.cpu" :key="regs.cpu" class="chip" :class="regs.cpu === 'A' ? 'p0' : 'p1'">regs({{ regs.cpu }})</span>
            <span v-else key="none" class="mono muted small">{{ kernelMode ? 'OS' : '' }}</span>
          </Transition>
        </div>
        <div class="mem">
          <div v-for="p in ['A', 'B']" :key="p" class="pmem">
            <div class="mono pl">{{ t({ en: 'process', zh: '进程' }) }} {{ p }}</div>
            <div class="slot"><span class="mono">k-stack({{ p }})</span><Transition name="fade"><span v-if="p === 'A' ? regs?.kA : regs?.kB" class="chip" :class="p === 'A' ? 'p0' : 'p1'">regs</span></Transition></div>
            <div class="slot"><span class="mono">proc_t({{ p }})</span><Transition name="fade"><span v-if="p === 'A' ? regs?.pA : regs?.pB" class="chip" :class="p === 'A' ? 'p0' : 'p1'">regs</span></Transition></div>
          </div>
        </div>
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.top {
  justify-content: space-between;
  margin-bottom: 12px;
}
.mode {
  font-size: 11px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--rule-strong);
  color: var(--ok);
  transition: all 0.3s;
}
.mode.k {
  color: var(--bad);
  border-color: var(--bad);
}
.lane-heads,
.srow {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.lh {
  font-size: 10.5px;
  color: var(--muted);
  padding: 4px 6px;
  border-bottom: 2px solid var(--rule-strong);
}
.lh.os {
  border-color: var(--bad);
}
.lh.prog {
  border-color: var(--ok);
}
.rows {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}
.srow.boot .box {
  border-style: dashed;
}
.box {
  font-size: 12px;
  line-height: 1.4;
  padding: 5px 7px;
  border-radius: 4px;
  border: 1px solid var(--rule-strong);
  background: var(--bg);
}
.box:lang(zh) {
  font-family: var(--font-zh);
}
.box.os {
  border-left: 3px solid var(--bad);
}
.box.hw {
  border-left: 3px solid var(--muted);
}
.box.prog {
  border-left: 3px solid var(--ok);
}
.srow.now .box {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.row-enter-active {
  transition: all 0.4s var(--ease);
}
.row-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.empty {
  padding: 18px 4px;
  font-size: 13px;
}
.machine {
  display: grid;
  gap: 10px;
  align-content: start;
}
.cpu {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 2px solid var(--ok);
  border-radius: 6px;
  min-height: 46px;
  transition: border-color 0.3s;
}
.cpu.k {
  border-color: var(--bad);
}
.small {
  font-size: 11px;
}
.mem {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.pmem {
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 6px;
  display: grid;
  gap: 5px;
}
.pl {
  font-size: 11px;
  color: var(--muted);
}
.slot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  min-height: 26px;
  padding: 2px 6px;
  border: 1px dashed var(--rule-strong);
  border-radius: 4px;
}
.fade-enter-active,
.fade-leave-active {
  transition: all 0.35s var(--ease);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.7);
}
</style>
