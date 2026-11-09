<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'

/**
 * The running figure of the real-schedulers article: what a program declares (top), the
 * scheduler between it and the CPU (its queue structure on the left, what it watches or is told on
 * the right), and the CPU or CPUs below. Each system the article visits redraws the scheduler's
 * queue structure in the same place; nothing moves on its own.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['program', 'queues', 'panel', 'cpu'],
  rules: ['program', 'queues', 'rulemarks', 'panel', 'cpu'],
  windows: ['program', 'win', 'boost', 'panel', 'cpu'],
  sweeper: ['program', 'win', 'starve', 'panel', 'cpu'],
  'win-qos': ['program', 'win', 'boost', 'panel', 'cores'],
  'apple-qos': ['program', 'qos', 'panel', 'inversion', 'cpu'],
  clutch: ['program', 'clutch', 'hier', 'panel', 'cores'],
  o1: ['program', 'o1', 'panel', 'cpu'],
  rsdl: ['program', 'rsdl', 'expired', 'cpu'],
  cfs: ['program', 'tree', 'panel', 'autogroup', 'cpu'],
  eevdf: ['program', 'tree', 'panel', 'cpu'],
  'sched-ext': ['program', 'tree', 'bpf', 'panel', 'cpu'],
  ule: ['program', 'ule', 'ulebars', 'panel', 'cpu'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 436)

type Line = { en: string; zh: string; hi?: boolean; gap?: boolean; dx?: number }
const q = (en: string, zh: string, o: Partial<Line> = {}): Line => ({ en, zh, ...o })
const QUESTIONS = [
  q('Four questions', '四个问题', { hi: true }),
  q('1 · How many levels?', '1 · 有多少层？'),
  q('2 · Who sets priority:', '2 · 优先级由谁定：'),
  q('watching or declaring?', '观察，还是声明？', { dx: 12 }),
  q('3 · What stops gaming?', '3 · 怎么防钻空子？'),
  q('4 · What plays the boost?', '4 · 谁来扮演提升？'),
]
const PANEL: Record<string, Line[]> = {
  overview: QUESTIONS,
  rules: [
    q('Rules 1–2: the mechanism', '规则 1–2：机制', { hi: true }),
    q('highest queue first,', '先跑最高的非空队列，'),
    q('round robin within it', '同一层轮转'),
    q('Rules 3–5: learning', '规则 3–5：学习', { hi: true, gap: true }),
    q('3 · new jobs start on top', '3 · 新工作从最高层开始'),
    q('4 · allotment used: down one', '4 · 用完配额：降一层'),
    q('5 · every S: all to the top', '5 · 每隔 S：全部回到最高层'),
  ],
  windows: [
    q('Boosted when', '何时提升', { hi: true }),
    q('· it comes to the foreground', '· 进程切到前台'),
    q('· its window gets input', '· 窗口收到输入'),
    q('· its wait ends (I/O done)', '· 等待结束（I/O 完成）'),
    q('Then', '然后', { hi: true, gap: true }),
    q('−1 level per time slice,', '每个时间片降一级，'),
    q('never below its base', '绝不低于基础优先级'),
    q('No Rule 3', '没有规则 3', { hi: true, gap: true }),
    q('a new thread starts at base', '新线程从基础优先级起步'),
  ],
  sweeper: [
    q('XP-era boost sizes', 'XP 时代的提升幅度', { hi: true }),
    q('disk, CD-ROM, video +1', '磁盘、光驱、显卡 +1'),
    q('serial, network +2', '串口、网络 +2'),
    q('keyboard, mouse +6', '键盘、鼠标 +6'),
    q('sound +8', '声卡 +8'),
    q('Waking costs quantum', '醒来要付时间片', { hi: true, gap: true }),
    q('a third of a tick per wait', '每次等待扣 1/3 个节拍'),
    q('The sweeper (Rule 5)', '清扫者（规则 5）', { hi: true, gap: true }),
    q('about once a second: ready', '约每秒一次：就绪'),
    q('300 ticks, not run → 15', '300 个节拍未运行 → 15'),
  ],
  'win-qos': [
    q('QoS, inferred', 'QoS，靠推断', { hi: true }),
    q('focused window: High', '有焦点的窗口：High'),
    q('visible, unfocused: Medium', '可见但无焦点：Medium'),
    q('minimized or hidden: Low', '最小化或被遮挡：Low'),
    q('playing audio: High', '正在发声：High'),
    q('Two numbers per thread', '每个线程两个数', { hi: true, gap: true }),
    q('priority: when', '优先级：何时'),
    q('QoS: where and how fast', 'QoS：在哪里、跑多快'),
  ],
  'apple-qos': [
    q('QoS propagates', 'QoS 会传播', { hi: true }),
    q('work sent to a higher-QoS', '提交到更高 QoS 队列的'),
    q('queue runs at its level', '工作，按该队列的级别跑'),
    q('Priority inversion', '优先级反转', { hi: true, gap: true }),
  ],
  clutch: [
    q('blocks more than it runs:', '阻塞多于运行的组：', { gap: true }),
    q('a higher score, favoured', '分数更高，受优待'),
    q('quantum: 10 ms down to 2', '时间片：从 10 ms 降到 2', { gap: true }),
  ],
  o1: [
    q('sleep_avg', 'sleep_avg', { hi: true }),
    q('rises while the task sleeps,', '任务睡眠时上升，'),
    q('falls while it runs', '运行时下降'),
    q('dynamic priority: up to 5', '动态优先级：在静态优先级', { gap: true }),
    q('levels either side of static', '上下各浮动最多 5 级'),
    q('LWN, 2007', 'LWN，2007 年', { hi: true, gap: true }),
    q('“elaborate array of', '“一大套精巧的'),
    q('heuristics”; still complaints', '启发式规则”，抱怨照旧'),
  ],
  cfs: [
    q('No levels, no sleep tracking', '没有层级，不跟踪睡眠', { hi: true }),
    q('a task that sleeps a lot is', '常睡的任务虚拟运行时间'),
    q('behind: it runs on waking', '落后，醒来就能及时运行'),
  ],
  eevdf: [
    q('How soon: a deadline', '多快轮到：截止期', { hi: true }),
    q('a virtual deadline from the', '虚拟截止期由任务'),
    q('slice length a task asks for', '请求的时间片长度推出'),
    q('How much: unchanged', '分多少：不变', { hi: true, gap: true }),
    q('weights, from nice', '权重，来自 nice'),
    q('asked for, not guessed', '是请求的，不是猜的', { hi: true, gap: true }),
  ],
  'sched-ext': [
    q('Unloaded if', '以下情况会被卸载', { hi: true }),
    q('· it hits an error', '· 它出错'),
    q('· a runnable task waits', '· 可运行任务等得太久'),
    q('too long (30 s at most)', '（最多 30 秒）', { dx: 9 }),
    q('· the operator: SysRq-S', '· 操作员按下 SysRq-S'),
    q('→ all back to the fair class', '→ 全部退回公平调度类', { hi: true }),
    q('scx_lavd: latency needs', 'scx_lavd：从行为估计', { gap: true }),
    q('guessed from behaviour', '延迟敏感度'),
  ],
  ule: [
    q('waiting on a run queue', '在运行队列上等待', { gap: true }),
    q('does not count as sleep', '不算睡眠'),
    q('History capped', '历史有上限', { hi: true, gap: true }),
    q('sleep + run over 5 s:', '睡眠 + 运行超过 5 秒：'),
    q('both scaled down', '两者按比例缩小'),
  ],
}
/** where each state's lines start, below any drawing in the panel */
const TOP: Record<string, number> = { clutch: 236, 'sched-ext': 158, ule: 168 }
const lines = computed(() => {
  const ls = PANEL[props.state] ?? PANEL.overview
  let y = TOP[props.state] ?? 98
  return ls.map((l, i) => {
    if (i > 0) y += l.gap ? 22 : 15
    return { ...l, y }
  })
})

const PROGRAM: Record<string, [string, string]> = {
  overview: ['nice: a hint it may use', 'nice：调度器可以参考的提示'],
  windows: ['priority class + thread level → base priority', '优先级类别 + 线程相对级别 → 基础优先级'],
  'apple-qos': ['a QoS class per piece of work, via dispatch queues', '经由派发队列，为每份工作声明 QoS 类别'],
  o1: ['nice → static priority', 'nice → 静态优先级'],
  cfs: ['nice → weight', 'nice → 权重'],
  eevdf: ['nice → weight, and a requested slice', 'nice → 权重，外加请求的时间片'],
  'sched-ext': ['nice, slice; an operator loads a BPF scheduler', 'nice、时间片；操作员加载 BPF 调度器'],
  ule: ['nice', 'nice'],
}
const SAME: Record<string, string> = { rules: 'overview', sweeper: 'windows', 'win-qos': 'windows', clutch: 'apple-qos', rsdl: 'o1' }
const program = computed(() => {
  const p = PROGRAM[props.state] ?? PROGRAM[SAME[props.state]] ?? PROGRAM.overview
  return L(p[0], p[1])
})

/* Windows: 32 levels, 31 at the top */
const wy = (l: number) => 326 - l * 7.2
const levels = Array.from({ length: 32 }, (_, l) => l)
const BASE = 8
const PEAK = 13 // drawn, not documented: the size of a boost depends on its cause
const stairs = computed(() => {
  let d = `M60,${wy(PEAK)}`
  for (let l = PEAK; l > BASE; l--) d += ` h9 V${wy(l - 1)}`
  return d
})

/* the CFS / EEVDF tree */
const NODES = [
  { x: 100, y: 138 },
  { x: 62, y: 188 },
  { x: 138, y: 188 },
  { x: 40, y: 238 },
  { x: 84, y: 238 },
]
const treeTitle = computed(() =>
  props.state === 'eevdf'
    ? L('one tree: lag and virtual deadline', '一棵树：滞后量与虚拟截止期')
    : props.state === 'sched-ext'
      ? L('the fair class, the fallback', '公平调度类：退路')
      : L('one tree, by virtual runtime', '一棵树，按虚拟运行时间'),
)
const treePick = computed(() => (props.state === 'eevdf' ? L('picked: eligible, earliest deadline', '选中：合格且截止期最早') : L('smallest vruntime runs next', 'vruntime 最小的先跑')))
const cores = computed(() => shown.value.has('cores'))
</script>

<template>
  <svg class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A scheduler between programs and the CPU', '程序与 CPU 之间的调度器')">
    <defs>
      <marker id="rs-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- what the program declares -->
    <g :class="part('program')">
      <rect x="8" y="10" width="344" height="46" rx="6" class="box" />
      <text x="18" y="30" class="lbl">{{ L('Program', '程序') }}</text>
      <text x="18" y="46" class="sub">{{ L('declares', '声明') }}</text>
      <text x="92" y="38" class="tag hi">{{ program }}</text>
      <path d="M60,56 L60,72" class="call" marker-end="url(#rs-arrow)" />
    </g>
    <text x="348" y="70" class="tag end">{{ L('kernel scheduler', '内核调度器') }}</text>
    <rect x="8" y="74" width="344" height="264" rx="9" class="outline" />

    <!-- chapter 8's MLFQ -->
    <g :class="part('queues')">
      <text x="18" y="94" class="tag">{{ L('MLFQ, chapter 8', 'MLFQ，第 8 章') }}</text>
      <g v-for="(r, i) in [104, 176, 248]" :key="r">
        <rect x="52" :y="r" width="100" height="36" rx="5" class="box" />
        <text x="62" :y="r + 22" class="sub">Q{{ 2 - i }}</text>
      </g>
      <circle cx="108" cy="122" r="8" class="p0" /><text x="108" y="125.5" class="sub c onf">A</text>
      <circle cx="108" cy="194" r="8" class="p1" /><text x="108" y="197.5" class="sub c onf">B</text>
      <circle cx="98" cy="266" r="8" class="p2" /><text x="98" y="269.5" class="sub c onf">C</text>
      <circle cx="124" cy="266" r="8" class="p3" /><text x="124" y="269.5" class="sub c onf">D</text>
      <g :class="part('rulemarks')">
        <path d="M180,122 L156,122" class="call" marker-end="url(#rs-arrow)" />
        <text x="168" y="116" class="tag hi c">3</text>
        <path d="M140,142 L140,172" class="call" marker-end="url(#rs-arrow)" />
        <path d="M140,214 L140,244" class="call" marker-end="url(#rs-arrow)" />
        <text x="160" y="162" class="tag hi c">4</text>
        <text x="160" y="234" class="tag hi c">4</text>
        <path d="M50,266 C24,266 24,122 48,122" class="call" marker-end="url(#rs-arrow)" />
        <text x="20" y="198" class="tag hi">5</text>
      </g>
    </g>

    <!-- Windows: 32 priority levels -->
    <g :class="part('win')">
      <text x="18" y="94" class="tag">{{ L('32 priority levels', '32 个优先级') }}</text>
      <rect v-for="l in levels" :key="l" x="44" :y="wy(l) - 3" width="68" height="6" rx="1" class="rung" :class="l >= 16 ? 'rt' : l === 0 ? 'zp' : 'dyn'" />
      <text x="38" :y="wy(31) + 3.5" class="sub end">31</text>
      <text x="38" :y="wy(15) + 3.5" class="sub end">15</text>
      <text x="38" :y="wy(8) + 3.5" class="sub end">8</text>
      <text x="38" :y="wy(0) + 3.5" class="sub end">0</text>
      <text x="118" :y="wy(24) + 3.5" class="tag">{{ L('real-time', '实时段') }}</text>
      <text x="118" :y="wy(24) + 16" class="tag">16–31</text>
      <text x="118" :y="wy(4) + 3.5" class="tag">{{ L('dynamic', '动态段') }}</text>
      <text x="118" :y="wy(4) + 16" class="tag">1–15</text>
      <text x="118" :y="wy(0) + 3.5" class="tag">{{ L('zero page', '零页线程') }}</text>
      <g :class="part('boost')">
        <path :d="`M54,${wy(BASE) - 6} L54,${wy(PEAK) + 4}`" class="call" marker-end="url(#rs-arrow)" />
        <path :d="stairs" class="call" />
        <circle cx="54" :cy="wy(BASE)" r="5" class="p0" />
        <text x="118" :y="wy(BASE) + 3.5" class="tag hi">{{ L('base', '基础') }}</text>
      </g>
      <g :class="part('starve')">
        <circle cx="90" :cy="wy(4)" r="5" class="p1" />
        <path :d="`M90,${wy(4) - 7} L90,${wy(15) + 5}`" class="call warn" marker-end="url(#rs-arrow)" />
      </g>
    </g>

    <!-- Apple: QoS classes -->
    <g :class="part('qos')">
      <text x="18" y="94" class="tag">{{ L('QoS classes', 'QoS 类别') }}</text>
      <g v-for="(c, i) in [
        ['User-interactive', 'virtually instant', '几乎瞬时'],
        ['User-initiated', 'a few seconds or less', '几秒以内'],
        ['Utility', 'seconds to minutes', '几秒到几分钟'],
        ['Background', 'minutes to hours', '几分钟到几小时'],
      ]" :key="c[0]">
        <rect x="18" :y="102 + i * 58" width="162" height="50" rx="5" class="box" />
        <circle cx="32" :cy="120 + i * 58" r="5" :class="`p${i}`" />
        <text x="44" :y="124 + i * 58" class="tag hi">{{ c[0] }}</text>
        <text x="44" :y="140 + i * 58" class="tag">{{ L(c[1], c[2]) }}</text>
      </g>
    </g>
    <g :class="part('inversion')">
      <circle cx="206" cy="182" r="7" class="p0" />
      <text x="220" y="186" class="tag">{{ L('high QoS: waits', '高 QoS：在等') }}</text>
      <path d="M206,190 L206,214" class="link" />
      <rect x="200" y="216" width="12" height="9" rx="1.5" class="lockbody" />
      <path d="M202.5,216 V213 a3.5,3.5 0 0 1 7,0 V216" class="shackle" />
      <circle cx="206" cy="250" r="7" class="p3" />
      <text x="220" y="254" class="tag">{{ L('low QoS: holds the lock', '低 QoS：持有这把锁') }}</text>
      <path d="M206,288 L206,261" class="call warn" marker-end="url(#rs-arrow)" />
      <text x="218" y="280" class="tag hi">{{ L('raised for a while', '被临时提高') }}</text>
    </g>

    <!-- XNU Clutch: root buckets -->
    <g :class="part('clutch')">
      <text x="18" y="94" class="tag">{{ L('root buckets (times in ms)', '根桶（时间单位 ms）') }}</text>
      <text x="136" y="108" class="tag end">WCEL</text>
      <text x="178" y="108" class="tag end">{{ L('quantum', '时间片') }}</text>
      <g v-for="(b, i) in [
        ['foreground', '前台', '0', '10'],
        ['user-initiated', 'user-initiated', '37.5', '8'],
        ['default', 'default', '75', '6'],
        ['utility', 'utility', '150', '4'],
        ['background', 'background', '250', '2'],
      ]" :key="b[0]">
        <rect x="16" :y="114 + i * 42" width="166" height="34" rx="5" class="box" />
        <text x="24" :y="135 + i * 42" class="tag hi">{{ L(b[0], b[1]) }}</text>
        <text x="136" :y="135 + i * 42" class="code end">{{ b[2] }}</text>
        <text x="174" :y="135 + i * 42" class="code end">{{ b[3] }}</text>
      </g>
    </g>
    <g :class="part('hier')">
      <g v-for="(h, i) in [
        ['root bucket', '根桶', 'one per class · EDF', '每类一个 · EDF'],
        ['thread groups', '线程组', 'interactivity score', '交互性分数'],
        ['threads', '线程', 'base − decayed usage', '基础 − 衰减使用量'],
      ]" :key="h[0]">
        <rect x="196" :y="90 + i * 46" width="148" height="34" rx="5" class="box" />
        <text x="270" :y="104 + i * 46" class="lbl c sm">{{ L(h[0], h[1]) }}</text>
        <text x="270" :y="118 + i * 46" class="tag c">{{ L(h[2], h[3]) }}</text>
        <path v-if="i < 2" :d="`M270,${124 + i * 46} L270,${134 + i * 46}`" class="call" marker-end="url(#rs-arrow)" />
      </g>
    </g>

    <!-- Linux O(1): 140 levels -->
    <g :class="part('o1')">
      <text x="18" y="94" class="tag">{{ L('140 levels, a run queue each', '140 级，每级一个运行队列') }}</text>
      <rect x="44" y="102" width="70" height="92" rx="3" class="rung rt" />
      <text x="120" y="146" class="tag">{{ L('100', '100 个') }}</text>
      <text x="120" y="160" class="tag">{{ L('real-time', '实时级') }}</text>
      <rect x="44" y="204" width="70" height="96" rx="3" class="rung dyn" />
      <line v-for="k in 39" :key="k" x1="44" :y1="204 + k * 2.4" x2="114" :y2="204 + k * 2.4" class="tick" />
      <text x="120" y="214" class="tag">{{ L('40 nice', '40 个 nice') }}</text>
      <text x="120" y="228" class="tag">{{ L('levels', '级') }}</text>
      <path d="M118,240 h5 V264 h-5" class="bracket" />
      <circle cx="79" cy="252" r="5" class="p0" />
      <text x="128" y="256" class="tag hi">±5</text>
    </g>

    <!-- RSDL: an active array and an expired one -->
    <g :class="part('rsdl')">
      <text x="18" y="96" class="tag hi">{{ L('active', '活跃数组') }}</text>
      <g v-for="i in 5" :key="i">
        <rect x="18" :y="104 + (i - 1) * 40" width="132" height="30" rx="4" class="box" />
        <rect x="22" :y="128 + (i - 1) * 40" :width="i === 1 ? 0 : [0, 100, 80, 124, 124][i - 1]" height="3" rx="1" class="quota" />
      </g>
      <circle cx="40" cy="117" r="6" class="p0" /><circle cx="58" cy="117" r="6" class="p1" />
      <circle cx="40" cy="157" r="6" class="p2" />
      <circle cx="40" cy="237" r="6" class="p3" />
      <text x="146" y="123" class="tag end">{{ L('quota used', '配额用完') }}</text>
      <path d="M100,136 L100,142" class="call" marker-end="url(#rs-arrow)" />
      <text x="20" y="308" class="tag">{{ L('bar: the level’s quota left', '绿条：这一级剩余的配额') }}</text>
      <text x="20" y="321" class="tag">{{ L('used up: whole level drops', '用完：整层下降一级') }}</text>
      <text x="20" y="334" class="tag hi">{{ L('a minor rotation', '这叫小轮转') }}</text>
    </g>
    <g :class="part('expired')">
      <text x="200" y="96" class="tag hi">{{ L('expired', '过期数组') }}</text>
      <g v-for="i in 5" :key="i">
        <rect x="200" :y="104 + (i - 1) * 40" width="140" height="30" rx="4" class="box faint" />
      </g>
      <circle cx="222" cy="157" r="6" class="p4" />
      <text x="200" y="308" class="tag">{{ L('tasks that used up their time', '用完时间的任务') }}</text>
      <text x="200" y="321" class="tag">{{ L('wait at their original level', '按原来的优先级在此等候') }}</text>
      <path d="M153,208 L197,208" class="call" marker-start="url(#rs-arrow)" marker-end="url(#rs-arrow)" />
      <text x="175" y="190" class="tag hi c">{{ L('major', '大轮转') }}</text>
      <text x="175" y="202" class="tag hi c">{{ L('rotation', '：对调') }}</text>
    </g>

    <!-- CFS, EEVDF and the fair class: one tree -->
    <g :class="part('tree')">
      <text x="18" y="94" class="tag">{{ treeTitle }}</text>
      <path d="M100,138 L62,188 M100,138 L138,188 M62,188 L40,238 M62,188 L84,238" class="link solid" />
      <g v-for="(n, i) in NODES" :key="i">
        <circle :cx="n.x" :cy="n.y" r="11" class="node" />
      </g>
      <template v-if="state !== 'sched-ext'">
        <circle cx="40" cy="238" r="7" class="p0" />
        <circle cx="40" cy="238" r="14" class="ring" />
        <text x="18" y="270" class="tag hi">{{ treePick }}</text>
      </template>
      <text v-else x="18" y="270" class="tag">{{ L('where ordinary tasks run', '普通任务本来运行的地方') }}</text>
    </g>
    <g :class="part('autogroup')">
      <text x="196" y="160" class="tag hi">{{ L('autogroup (2.6.38)', '自动分组（2.6.38）') }}</text>
      <rect x="196" y="168" width="148" height="44" rx="5" class="box" />
      <text x="204" y="182" class="tag">{{ L('session 1: make -j10', '会话 1：make -j10') }}</text>
      <circle v-for="k in 10" :key="k" :cx="200 + k * 12" cy="199" r="4" class="p1" />
      <rect x="196" y="220" width="148" height="44" rx="5" class="box" />
      <text x="204" y="234" class="tag">{{ L('session 2: video player', '会话 2：视频播放器') }}</text>
      <circle cx="212" cy="251" r="4" class="p0" />
      <text x="196" y="290" class="tag hi">{{ L('player’s share:', '播放器的份额：') }}</text>
      <text x="196" y="306" class="tag hi">{{ L('about 9% → about 50%', '约 9% → 约 50%') }}</text>
    </g>
    <g :class="part('bpf')">
      <rect x="196" y="90" width="148" height="42" rx="6" class="box gate" />
      <text x="270" y="107" class="lbl c sm">{{ L('BPF scheduler', 'BPF 调度器') }}</text>
      <text x="270" y="123" class="tag c">{{ L('loaded at run time', '运行时加载') }}</text>
      <path d="M196,124 C170,140 150,140 126,140" class="link" marker-end="url(#rs-arrow)" />
      <text x="160" y="128" class="tag c">{{ L('fallback', '退路') }}</text>
    </g>

    <!-- FreeBSD ULE: one score -->
    <g :class="part('ule')">
      <text x="18" y="94" class="tag">{{ L('interactivity score', '交互性分数') }}</text>
      <rect x="48" y="104" width="22" height="200" rx="3" class="rung dyn" />
      <rect x="48" y="104" width="22" height="60" rx="3" class="rung rt" />
      <path d="M48,164 L150,164" class="vline" />
      <text x="42" y="110" class="sub end">0</text>
      <text x="42" y="168" class="sub end">30</text>
      <text x="42" y="304" class="sub end">100</text>
      <circle cx="59" cy="128" r="5" class="p0" />
      <text x="78" y="124" class="tag hi">{{ L('interactive', '交互区间') }}</text>
      <text x="78" y="138" class="tag">{{ L('served first', '先得到服务') }}</text>
      <text x="78" y="236" class="tag hi">{{ L('batch', '批处理区间') }}</text>
    </g>
    <g :class="part('ulebars')">
      <text x="196" y="98" class="tag hi">{{ L('Compares', '比较的是') }}</text>
      <text x="196" y="116" class="tag">{{ L('voluntary sleep', '主动睡眠') }}</text>
      <rect x="196" y="121" width="140" height="7" rx="2" class="p0" opacity="0.6" />
      <text x="196" y="144" class="tag">{{ L('run time', '运行时间') }}</text>
      <rect x="196" y="149" width="30" height="7" rx="2" class="p1" opacity="0.6" />
    </g>

    <!-- what the scheduler watches or is told -->
    <g :class="part('panel')">
      <text v-for="(l, i) in lines" :key="state + i" :x="196 + (l.dx ?? 0)" :y="l.y" class="tag" :class="{ hi: l.hi }">{{ L(l.en, l.zh) }}</text>
    </g>

    <!-- the CPU, or two kinds of core -->
    <g :class="part('cpu')">
      <rect v-if="!cores" x="8" y="352" width="344" height="76" rx="6" class="box floor" />
      <text v-if="!cores" x="180" y="394" class="lbl c">CPU</text>
    </g>
    <g :class="part('cores')">
      <rect x="8" y="352" width="168" height="76" rx="6" class="box floor" />
      <text x="92" y="386" class="lbl c">{{ L('Performance cores', '性能核') }}</text>
      <text x="92" y="402" class="tag c">{{ L('fast, power-hungry', '快，费电') }}</text>
      <rect x="184" y="352" width="168" height="76" rx="6" class="box floor" />
      <text x="268" y="386" class="lbl c">{{ L('Efficiency cores', '能效核') }}</text>
      <text x="268" y="402" class="tag c">{{ L('slower, frugal', '慢些，省电') }}</text>
    </g>
  </svg>
</template>

<style scoped>
text.onf {
  fill: #fff;
}
.rung {
  stroke: var(--rule-strong);
  stroke-width: 0.8;
}
.rung.rt {
  fill: var(--rule-strong);
}
.rung.dyn {
  fill: var(--bg-elev);
}
.rung.zp {
  fill: var(--bg-sunk);
}
.tick {
  stroke: var(--rule);
  stroke-width: 0.6;
}
.call.warn {
  stroke: var(--warn);
}
.bracket {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.1;
}
.vline {
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
}
.node {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.ring {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
}
.quota {
  fill: var(--ok);
}
.box.faint {
  stroke-dasharray: 4 3;
}
.lbl.sm {
  font-size: 10.5px;
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
.lit .rung.dyn {
  fill: var(--accent-soft);
}
</style>
