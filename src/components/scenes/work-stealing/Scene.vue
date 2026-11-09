<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import FindDemo from './FindDemo.vue'

/**
 * The running figure of the work-stealing article: a language runtime above the kernel. Three Ps
 * (Go's processors; Tokio's and Java's workers in their sections), each with a private queue of
 * tasks, a global queue above them, the threads (Ms) that run them, and the kernel that puts those
 * threads on cores. The queues show 8 slots of Go's 256; the counts under them say how many tasks
 * a passage is about.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['global', 'ps', 'ms', 'kernel', 'cores', 'steal'],
  layers: ['global', 'ps', 'ms', 'kernel', 'cores', 'layers'],
  sqms: ['global', 'ms', 'kernel', 'cores', 'contend'],
  steal: ['global', 'ps', 'ms', 'kernel', 'cores', 'steal', 'idle'],
  gmp: ['global', 'ps', 'ms', 'kernel', 'cores', 'gmp'],
  find: ['global', 'ps', 'ms', 'kernel', 'cores', 'netpoll', 'badges'],
  overflow: ['global', 'ps', 'ms', 'kernel', 'cores', 'overflow'],
  half: ['global', 'ps', 'ms', 'kernel', 'cores', 'steal', 'third'],
  os: ['global', 'ps', 'ms', 'kernel', 'cores', 'sysmon', 'netpoll', 'blocked'],
  tokio: ['global', 'ps', 'ms', 'kernel', 'cores', 'steal'],
  deque: ['ps', 'ms', 'kernel', 'cores', 'steal', 'deque'],
  cilk: ['ps', 'ms', 'kernel', 'cores', 'random', 'bound'],
  bends: ['global', 'ps', 'ms', 'kernel', 'cores', 'ksteal'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 400)
const st = computed(() => props.state)

const CX = [62, 180, 298]
/** tasks drawn in each P's queue (at most 8) */
const COUNTS: Record<string, number[]> = {
  overview: [3, 6, 0],
  layers: [3, 4, 2],
  steal: [2, 6, 0],
  gmp: [3, 5, 1],
  find: [3, 6, 0],
  overflow: [8, 4, 2],
  half: [0, 4, 4],
  os: [3, 4, 2],
  tokio: [3, 5, 1],
  deque: [2, 6, 0],
  cilk: [3, 4, 0],
  bends: [3, 4, 2],
}
const counts = computed(() => COUNTS[st.value] ?? [3, 4, 2])
/** what the count line under each queue says */
const countText = computed(() => {
  if (st.value === 'half') return [L('idle: two queues to try', '空闲：有两个队列可偷'), '40 → 20', '0 → 20']
  if (st.value === 'overflow') return [L('full: 256', '满了：256'), '', '']
  if (st.value === 'steal') return ['', '', L('idle: looks for work', '空闲：去找活')]
  if (st.value === 'cilk') return ['', '', L('idle: the thief', '空闲：窃取者')]
  return ['', '', '']
})
const worker = computed(() => st.value === 'tokio' || st.value === 'deque')
const pName = (i: number) => (worker.value ? L(`worker ${i}`, `worker ${i}`) : `P${i}`)
/** Go's runnext, Tokio's LIFO slot; Java and Cilk have neither */
const nextName = computed(() => (st.value === 'tokio' ? 'LIFO' : st.value === 'deque' || st.value === 'cilk' ? '' : 'runnext'))
const nextX = computed(() => (st.value === 'tokio' ? 14 : 4))
const nextW = computed(() => (st.value === 'tokio' ? 32 : 42))
/** M is Go's word for a thread */
const threadName = (i: number) => (worker.value || st.value === 'cilk' ? L('thread', '线程') : 'M' + i)
/** a thief only goes stealing once the global queue has nothing for it (findRunnable's order) */
const globalEmpty = computed(() => shown.value.has('steal') || shown.value.has('badges'))
/** the runnext (or LIFO) slot holds a task */
const nextFull = (i: number) => (st.value === 'gmp' || st.value === 'tokio' || st.value === 'layers' || st.value === 'os') && i < 2
/** Java: older tasks near the head are bigger pieces of the recursion */
const slotW = (k: number) => (st.value === 'deque' ? 88 - k * 10 : 88)
</script>

<template>
  <FindDemo v-if="demo && state === 'find'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A runtime scheduler above the kernel: per-P queues, a global queue, threads and cores', '内核之上的运行时调度器：每个 P 的队列、全局队列、线程与核心')">
    <defs>
      <marker id="ws-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="ws-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="hothead" />
      </marker>
      <g id="ws-lock">
        <path d="M2.5,5 V3.5 a2.5,2.5 0 0 1 5,0 V5" class="shackle" />
        <rect x="1" y="5" width="8" height="6" rx="1.2" class="lockbody" />
      </g>
    </defs>

    <!-- threads onto cores, under the kernel box -->
    <g :class="part('cores')">
      <path v-for="(cx, i) in CX" :key="'mc' + i" :d="`M${cx},262 L${[48, 136, 312][i]},318`" class="link" :class="{ solid: shown.has('layers') }" />
    </g>

    <!-- the global run queue, behind a lock -->
    <g :class="part('global')">
      <rect x="96" y="8" width="168" height="38" rx="5" class="box" />
      <text x="180" y="22" class="lbl c">{{ worker ? L('global queue', '全局队列') : L('global run queue', '全局运行队列') }}</text>
      <use href="#ws-lock" x="248" y="12" />
      <text v-if="globalEmpty" x="180" y="38" class="tiny c">{{ L('(empty)', '（空）') }}</text>
      <template v-else><rect v-for="k in shown.has('contend') ? 6 : 2" :key="'gq' + k" :x="116 + (k - 1) * 20" y="29" width="16" height="10" rx="2" class="g" /></template>
    </g>

    <!-- SQMS: every thread takes the one lock -->
    <g :class="part('contend')">
      <path v-for="(cx, i) in CX" :key="'ct' + i" :d="`M${cx},240 L${[122, 180, 238][i]},48`" class="call" marker-end="url(#ws-arrow)" />
    </g>

    <!-- the Ps, each with a runnext slot and a private queue -->
    <g :class="part('ps')">
      <g v-for="(cx, i) in CX" :key="'p' + i">
        <rect :x="cx - 54" y="64" width="108" height="164" rx="6" class="box strong" :class="{ idle: (shown.has('idle') || shown.has('random')) && i === 2 }" />
        <text :x="cx - 44" y="81" class="lbl">{{ pName(i) }}</text>
        <g v-if="nextName">
          <rect :x="cx + nextX" y="69" :width="nextW" height="16" rx="3" :class="nextFull(i) ? 'g' : 'slot'" />
          <text :x="cx + nextX + nextW / 2" y="80" class="tiny c" :class="{ 'on-fill': nextFull(i) }">{{ nextName }}</text>
        </g>
        <!-- 8 of the queue's slots; the head (oldest) at the top -->
        <rect v-for="k in 8" :key="'s' + k" :x="cx - 44 + (88 - slotW(k - 1)) / 2" :y="94 + (k - 1) * 13" :width="slotW(k - 1)" height="11" rx="2" :class="k <= counts[i] ? (st === 'half' && i === 2 ? 'g moved' : 'g') : 'slot'" />
        <text :x="cx" y="212" class="tiny c">{{ shown.has('deque') ? L('↑ oldest · newest ↓', '↑ 最老 · 最新 ↓') : L('local queue', '本地队列') }}</text>
        <text :x="cx" y="223" class="tiny c strong-tiny">{{ countText[i] }}</text>
      </g>
    </g>

    <!-- the threads that run them -->
    <g :class="part('ms')">
      <g v-for="(cx, i) in CX" :key="'m' + i">
        <path v-if="shown.has('ps') && !(shown.has('blocked') && i === 1)" :d="`M${cx},228 L${cx},240`" class="link solid" />
        <template v-if="shown.has('blocked') && i === 1">
          <rect x="126" y="240" width="50" height="22" rx="4" class="box dead" />
          <text x="151" y="255" class="lbl c dead">M1</text>
          <rect x="184" y="240" width="50" height="22" rx="4" class="box" />
          <text x="209" y="255" class="lbl c">M3</text>
        </template>
        <template v-else>
          <rect :x="cx - 30" y="240" width="60" height="22" rx="4" class="box" />
          <text :x="cx" y="255" class="lbl c">{{ threadName(i) }}</text>
        </template>
      </g>
    </g>

    <!-- the kernel and the cores -->
    <g :class="part('kernel')">
      <rect x="8" y="276" width="344" height="26" rx="5" class="box floor" />
      <text x="180" y="293" class="lbl c">{{ L('kernel: threads onto cores', '内核：把线程放到核心上') }}</text>
    </g>
    <g :class="part('cores')">
      <g v-for="k in 4" :key="'c' + k">
        <rect :x="8 + (k - 1) * 88" y="318" width="80" height="26" rx="4" class="box" />
        <text :x="48 + (k - 1) * 88" y="335" class="sub c">{{ L(`core ${k - 1}`, `核心 ${k - 1}`) }}{{ shown.has('ksteal') && k === 4 ? L(' · idle', ' · 空闲') : '' }}</text>
      </g>
    </g>

    <!-- stealing: from P1's head to the idle P2 -->
    <g :class="part('steal')">
      <path d="M200,64 C214,48 270,48 286,64" class="call hot" marker-end="url(#ws-arrow-hot)" />
      <text x="292" y="59" class="tag hi">{{ st === 'deque' ? L('one task', '一个任务') : st === 'half' ? L('takes 20', '拿走 20 个') : L('steal half', '偷一半') }}</text>
    </g>
    <g :class="part('third')">
      <path d="M86,64 C100,52 150,52 164,64" class="link solid" marker-end="url(#ws-arrow)" />
    </g>

    <!-- Cilk: victims chosen at random -->
    <g :class="part('random')">
      <path d="M286,64 C270,50 214,50 200,64" class="link solid" marker-end="url(#ws-arrow)" />
      <path d="M310,64 C300,48 78,48 70,64" class="link solid" marker-end="url(#ws-arrow)" />
    </g>

    <!-- full queue: half of it, and the new goroutine, go to the global queue -->
    <g :class="part('overflow')">
      <path d="M92,64 L106,48" class="call hot" marker-end="url(#ws-arrow-hot)" />
      <text x="8" y="58" class="tag hi">{{ L('half + new G', '一半 + 新 G') }}</text>
    </g>

    <!-- what used to be the OS's work -->
    <g :class="part('sysmon')">
      <rect x="8" y="8" width="80" height="38" rx="5" class="box gate" />
      <text x="48" y="24" class="lbl c">sysmon</text>
      <text x="48" y="38" class="sub c">{{ L('monitor thread', '监控线程') }}</text>
      <path d="M70,46 L70,54 L121,54 L121,251 L94,251" class="call hot" marker-end="url(#ws-arrow-hot)" />
      <text x="48" y="62" class="tag hi c">SIGURG</text>
    </g>
    <g :class="part('netpoll')">
      <rect x="272" y="8" width="80" height="38" rx="5" class="box gate" />
      <text x="312" y="22" class="lbl c">netpoller</text>
      <template v-if="shown.has('blocked')">
        <rect x="286" y="29" width="16" height="10" rx="2" class="g" />
        <rect x="306" y="29" width="16" height="10" rx="2" class="g" />
        <text x="326" y="38" class="tiny">epoll</text>
      </template>
      <text v-else x="312" y="38" class="sub c">epoll</text>
    </g>
    <g :class="part('blocked')">
      <path d="M151,262 L151,276" class="danger" />
      <path d="M180,228 L209,240" class="link solid" />
    </g>

    <!-- findRunnable's order, as numbered stops -->
    <g :class="part('badges')">
      <g v-for="b in [
        { n: '1', x: 104, y: 14 }, { n: '3', x: 104, y: 36 }, { n: '2', x: 290, y: 77 }, { n: '4', x: 344, y: 38 },
        { n: '5', x: 243, y: 52 }, { n: '6', x: 336, y: 251 },
      ]" :key="b.n">
        <circle :cx="b.x" :cy="b.y" r="6.5" class="badge" />
        <text :x="b.x" :y="b.y + 3.2" class="tiny c on-fill b">{{ b.n }}</text>
      </g>
      <path d="M200,64 C214,48 270,48 286,64" class="link solid" marker-end="url(#ws-arrow)" />
    </g>

    <!-- the kernel steals too -->
    <g :class="part('ksteal')">
      <path d="M48,345 C90,360 270,360 310,346" class="call hot" marker-end="url(#ws-arrow-hot)" />
    </g>

    <!-- the words for each passage -->
    <g class="legend">
      <text x="8" y="368" class="tag hi">
        {{
          {
            overview: L('An idle P takes half of a busy P’s queue.', '空闲的 P 拿走繁忙 P 队列的一半。'),
            layers: L('Runtime: tasks onto threads. Kernel: threads onto cores.', '运行时：把任务放到线程上；内核：把线程放到核心上。'),
            sqms: L('SQMS: one queue, one lock, for every core.', 'SQMS：所有核心共用一个队列、一把锁。'),
            steal: L('Per-P queues drift apart; the idle one steals.', '各 P 的队列会失衡；闲着的那个去偷。'),
            gmp: L('G goroutine · P processor · M OS thread', 'G 是 goroutine · P 是处理器 · M 是操作系统线程'),
            find: L('M2’s P is empty: findRunnable() tries 1 to 6.', 'M2 的 P 空了：findRunnable() 依次尝试 1 到 6。'),
            overflow: L('A full local queue pushes half to the global one.', '本地队列满了，就把一半推到全局队列。'),
            half: L('P1 had 40, P2 none: one steal evens them.', 'P1 有 40 个，P2 没有：偷一次就平了。'),
            os: L('M1 is blocked in a system call; P1 moves to M3.', 'M1 阻塞在系统调用里；P1 交给 M3。'),
            tokio: L('Tokio: a worker per thread, 256-task queues.', 'Tokio：每个线程一个 worker，队列容量 256。'),
            deque: L('Java: the owner runs the newest, small task;', 'Java：主人运行最新、最小的任务；'),
            cilk: L('Cilk: a thief picks its victim at random.', 'Cilk：窃取者随机挑选受害者。'),
            bends: L('Linux: an idle core pulls a thread from a busy one.', 'Linux：空闲的核心从繁忙的核心拉一个线程。'),
          }[state]
        }}
      </text>
      <text x="8" y="384" class="tag">
        {{
          {
            overview: L('The kernel below schedules the threads.', '下面的内核再调度这些线程。'),
            layers: L('Each layer sees only its own.', '每一层只看得见自己这一层。'),
            sqms: L('Tasks run wherever a core is free; caches go cold.', '任务哪个核心空就在哪儿跑，缓存一次次变冷。'),
            steal: L('Busy Ps never pay for balancing.', '忙碌的 P 从不为均衡付出代价。'),
            gmp: L('GOMAXPROCS Ps; an M must hold a P to run Go code.', 'P 共 GOMAXPROCS 个；M 必须持有 P 才能运行 Go 代码。'),
            find: L('The global queue sits behind a lock.', '全局队列有一把锁守着。'),
            overflow: L('Work spreads both ways: pulled and pushed.', '工作朝两个方向扩散：被拉走，也被推出。'),
            half: L('Now a third idle P finds two queues to try.', '第三个空闲的 P 现在有两个队列可试。'),
            os: L('sysmon signals the thread of a goroutine past 10 ms.', 'sysmon 向运行超过 10 ms 的 goroutine 所在的线程发信号。'),
            tokio: L('The LIFO slot runs next and cannot be stolen.', 'LIFO 槽里的任务下一个运行，窃取者拿不走。'),
            deque: L('a thief takes the oldest, biggest one.', '窃取者拿最老、最大的那个。'),
            cilk: L('Steals grow with the span, not the work.', '窃取次数随跨度增长，而不是随工作量。'),
            bends: L('Neither layer knows what the other is doing.', '两层都不知道对方在做什么。'),
          }[state]
        }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.g {
  fill: var(--p0);
}
.g.moved {
  fill: var(--p1);
}
.slot {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.8;
}
.box.idle {
  stroke-dasharray: 4 3;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-fill {
  fill: #fff;
}
.strong-tiny {
  fill: var(--ink-2);
  font-weight: 600;
}
.b {
  font-weight: 700;
}
.badge {
  fill: var(--accent);
}
.call.hot {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.hothead {
  fill: var(--accent);
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
.legend .tag {
  transition: opacity 0.3s;
}
.lit .g {
  stroke: var(--accent);
  stroke-width: 1.5;
}
</style>
