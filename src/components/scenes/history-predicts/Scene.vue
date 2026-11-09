<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CounterDemo from './CounterDemo.vue'

/**
 * The running figure of the history note: one predictor loop. What happened (top) goes through the
 * update rule into a summary of the past; the summary makes a prediction; the outcome, if it is
 * wrong, goes through the way to forget. Each system the article visits fills the same boxes.
 * Nothing moves on its own.
 */
const props = defineProps<DrawingProps>()

const LOOP = ['strip', 'sum', 'upd', 'fgt', 'pred', 'out', 'arrows', 'check']
const SHOW: Record<string, string[]> = {
  overview: [...LOOP, 'spark'],
  oracle: ['strip', 'future', 'cards'],
  parts: [...LOOP, 'kinds'],
  mlfq: [...LOOP, 'ladder'],
  ewma: [...LOOP, 'ewma'],
  rto: [...LOOP, 'rtotab'],
  cwnd: [...LOOP, 'cwnd'],
  bbr: [...LOOP, 'bbr'],
  branch: [...LOOP, 'branch'],
  spectre: [...LOOP, 'spectre'],
  arc: [...LOOP, 'arclists'],
  readahead: [...LOOP, 'ra'],
  fails: [...LOOP, 'stale'],
  advice: ['strip', 'sum', 'upd', 'fgt', 'pred', 'out', 'arrows', 'ask', 'spark'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 396)

type Bi2 = [string, string]
const txt = (b: Bi2) => L(b[0], b[1])

/* the past, as the top strip shows it */
const CHIPS: Record<string, { c: string; hot?: boolean }[]> = {
  ewma: [{ c: '6' }, { c: '4' }, { c: '6' }, { c: '4' }, { c: '13', hot: true }, { c: '13' }, { c: '13' }],
  rto: [{ c: '…' }, { c: '100' }, { c: '100' }, { c: '100' }, { c: '180', hot: true }],
  branch: [{ c: 'T' }, { c: 'T' }, { c: 'T' }, { c: 'T' }, { c: 'T' }, { c: 'T' }, { c: 'N', hot: true }],
  spectre: [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'V', hot: true }],
  arc: [{ c: 'a' }, { c: 'b' }, { c: 'a' }, { c: 'c' }, { c: 'd' }, { c: 'e' }, { c: 'b', hot: true }],
  readahead: [{ c: '0' }, { c: '1' }, { c: '2' }, { c: '3' }, { c: '4' }, { c: '5' }],
}
const STRIP_LABEL: Record<string, Bi2> = {
  overview: ['round-trip samples', '往返时间样本'],
  oracle: ['what has happened', '已经发生的事'],
  parts: ['observations', '观察到的事'],
  mlfq: ['how the job used the CPU', '任务使用 CPU 的情况'],
  ewma: ['CPU bursts, t', 'CPU 突发长度 t'],
  rto: ['round-trip samples, ms', '往返时间样本（ms）'],
  cwnd: ['acknowledgements, losses', '确认与丢包'],
  bbr: ['rate and RTT samples', '速率与 RTT 样本'],
  branch: ['outcomes: taken, not taken', '结果：跳转 T，不跳转 N'],
  spectre: ['code on this core: Attacker, Victim', '这个核心上的代码：攻击者 A、受害者 V'],
  arc: ['pages referenced', '访问的页'],
  readahead: ['blocks read from a file', '从文件读的块'],
  fails: ['observations', '观察到的事'],
  advice: ['observations', '观察到的事'],
}
const label = computed(() => txt(STRIP_LABEL[props.state] ?? STRIP_LABEL.overview))
const chips = computed(() => CHIPS[props.state] ?? null)
// the shape of a stream of samples, where the values do not matter
const BARS = [14, 18, 12, 20, 16, 13, 19, 15, 17, 12, 21, 14, 18, 16, 20, 13, 17, 15, 19, 14]

/* the words in the boxes */
interface Words {
  upd: Bi2[]
  fgt: Bi2[]
  pred: Bi2
  out: Bi2[]
}
const W: Record<string, Words> = {
  overview: {
    upd: [['each round trip is a', '每个往返是一个样本，'], ['sample, folded in', '以 1/8 的权重'], ['with weight 1/8', '并入估计值']],
    fgt: [['timer fires: double', '定时器触发：加倍，'], ['the timer, and cut', '窗口砍到'], ['the window to', '一个报文段'], ['one segment', '']],
    pred: ['when the next ACK is due', '下一个确认何时该到'],
    out: [['ACK arrives, or', '确认到了，或者'], ['the timer fires', '定时器先触发']],
  },
  parts: {
    upd: [['how each observation', '每次观察如何改变它，'], ['changes the summary,', '旧观察还保留'], ['how much weight', '多少权重'], ['old ones keep', '']],
    fgt: [['a reset, a decay or', '一次重置、一种衰减'], ['a cap, for when the', '或一个上限，用于概括'], ['summary is stale or', '过时或有人钻空子时'], ['someone games it', '']],
    pred: ['a guess at the near future', '对不久将来的猜测'],
    out: [['right, or wrong', '猜对，还是猜错']],
  },
  mlfq: {
    upd: [['Rule 4: use up the', '规则 4：用完配额，'], ['allotment, move', '降一层'], ['down a level', '']],
    fgt: [['Rule 5: every S, all', '规则 5：每隔 S，'], ['predictions are', '所有预测'], ['thrown away', '一笔勾销']],
    pred: ['how CPU-hungry the job will be', '这个任务有多吃 CPU'],
    out: [['a job turned', '任务变成交互式；'], ['interactive; a long', '长任务挨饿'], ['job starving', '']],
  },
  ewma: {
    upd: [['τ′ = α t + (1 − α) τ', 'τ′ = α t + (1 − α) τ'], ['α = 1/2', 'α = 1/2']],
    fgt: [['nobody resets it:', '没有人重置它：'], ['old samples lose', '旧样本按几何级数'], ['weight geometrically', '失去权重']],
    pred: ['next burst: 9, then 11, then 12', '下一次突发：9，然后 11，然后 12'],
    out: [['phase change to 13:', '阶段变成 13：'], ['wrong by 8', '一开始错了 8']],
  },
  rto: {
    upd: [['per sample:', '每个样本：'], ['SRTT weight 1/8,', 'SRTT 权重 1/8，'], ['RTTVAR weight 1/4', 'RTTVAR 权重 1/4']],
    fgt: [['timer fires: RTO', '定时器触发：RTO'], ['doubles. Karn: no', '加倍。Karn：重传过'], ['samples from a', '的报文段不采样'], ['retransmitted segment', '']],
    pred: ['wait 220 ms before resending', '等 220 ms 再重传'],
    out: [['a slow packet, or', '是慢了，'], ['a lost one?', '还是丢了？']],
  },
  cwnd: {
    upd: [['going well: about +1', '顺利：每往返约加'], ['segment per round', '一个报文段；'], ['trip; loss: about', '丢包：大致减半'], ['half', '']],
    fgt: [['timeout: 1 segment.', '超时：一个报文段。'], ['Idle longer than RTO:', '空闲超过 RTO：'], ['back to the initial', '回到初始窗口'], ['window', '']],
    pred: ['how much the path can hold in flight', '路径上能容纳多少在途数据'],
    out: [['duplicate ACKs,', '重复确认，'], ['or a timeout', '或一次超时']],
  },
  bbr: {
    upd: [['two windowed filters:', '两个窗口滤波器：'], ['max delivery rate,', '最大投递速率，'], ['min RTT over 10 s', '10 秒内最小 RTT']],
    fgt: [['ProbeRTT: cut data in', 'ProbeRTT：压低在途'], ['flight at least 200', '数据至少 200 ms，'], ['ms so the queue', '队列排空，'], ['drains, then measure', '再量一次'], ['afresh', '']],
    pred: ['the path’s bandwidth and true delay', '路径带宽与真实时延'],
    out: [['a busy sender keeps', '忙碌的发送方总有'], ['a queue that hides', '队列，遮住真实 RTT'], ['the true RTT', '']],
  },
  branch: {
    upd: [['taken: +1', '跳转：加一'], ['not taken: −1', '不跳转：减一']],
    fgt: [['stops at 0 and 3, so', '停在 0 和 3，'], ['memory is bounded.', '记忆有界。TAGE：'], ['TAGE: resets useful', '定期重置 useful'], ['counters', '计数器']],
    pred: ['taken, or not taken?', '跳转，还是不跳转？'],
    out: [['wrong: fetched work', '猜错：取来的工作'], ['is thrown away', '被扔掉']],
  },
  spectre: {
    upd: [['learns from whatever', '从这个核心上跑过的'], ['ran on the core,', '任何代码中学习，'], ['mostly without', '基本不记'], ['recording whose', '那是谁的代码']],
    fgt: [['IBPB clears the', 'IBPB 清空分支目标'], ['branch target buffer', '缓冲区，按启动时的'], ['on context switches,', '策略在上下文切换时'], ['per boot-time policy', '发出']],
    pred: ['a jump to the attacker’s chosen code', '跳到攻击者选定的代码'],
    out: [['work discarded;', '结果被丢弃；'], ['cache traces can', '缓存痕迹可能'], ['leak data', '泄露数据']],
  },
  arc: {
    upd: [['miss on a page it', '在刚扔掉的页上未'], ['just evicted: shift', '命中：把空间挪给'], ['space to that list', '那个链表']],
    fgt: [['lists are bounded;', '链表长度有界；'], ['practical LFU', '实用的 LFU 变体'], ['variants decay', '让计数衰减'], ['their counts', '']],
    pred: ['which pages to keep', '留下哪些页'],
    out: [['a one-time scan', '一次性扫描'], ['passes through', '直接穿过']],
  },
  readahead: {
    upd: [['pattern holds: next', '模式保持：下一个'], ['window scaled up,', '窗口放大，'], ['usually doubled', '通常翻倍']],
    fgt: [['stream misses and', '顺序流未命中、'], ['restarts: back to', '重新开始：回到'], ['the initial size', '初始大小']],
    pred: ['how far ahead to read', '往前读多远'],
    out: [['small random read:', '孤立的随机小读：'], ['served as is, no', '按原样处理，'], ['state touched', '不污染预读状态']],
  },
  fails: {
    upd: [['accounting that can’t', '躲不掉的计账'], ['be dodged (Rule 4);', '（规则 4）；拒绝含糊'], ['refuse ambiguous', '样本（Karn）；清空'], ['samples (Karn); flush', '共享历史（IBPB）'], ['shared history (IBPB)', '']],
    fgt: [['decay (PELT);', '衰减（PELT）；周期性'], ['periodic resets', '重置（提升、TAGE、'], ['(boost, TAGE,', 'ProbeRTT）；代价高'], ['ProbeRTT); react fast', '的方向快速反应'], ['where wrong is costly', '']],
    pred: ['a bet that can fail in three ways', '一个会以三种方式押错的注'],
    out: [['each failure has', '每种失败都'], ['grown a defence', '长出了对策']],
  },
  advice: {
    upd: [['guess from history', '程序不知道的时候，'], ['when the program', '从历史里猜'], ['does not know', '']],
    fgt: [['keep a reset ready', '备好一次重置，'], ['for when the guess', '留给猜错的时候'], ['goes wrong', '']],
    pred: ['both feed the same decision', '两条路通向同一个决定'],
    out: [['nice, madvise,', 'nice、madvise、'], ['posix_fadvise, QoS,', 'posix_fadvise、QoS、'], ['EEVDF slice requests', 'EEVDF 时间片请求']],
  },
}
const words = computed<Words>(() => W[props.state] ?? W.overview)
const lines = (ls: Bi2[]) => ls.map(txt).filter(Boolean)

const sumTitle = computed(() => (props.state === 'fails' ? L('the history is stale', '历史过时了') : L('summary of the past', '对过去的概括')))
const updTitle = computed(() => (props.state === 'fails' ? L('someone games the rule', '有人钻规则空子') : L('update rule', '更新规则')))
const fgtTitle = computed(() => (props.state === 'fails' ? L('the workload changes', '负载换了阶段') : L('way to forget', '遗忘的办法')))
const outTitle = computed(() => (props.state === 'advice' ? L('ask the program', '去问程序') : L('outcome', '结果')))

/* the exponential average: the article's table, and the next value it gives */
const T = [6, 4, 6, 4, 13, 13, 13]
const TAU = [10, 8, 6, 6, 5, 9, 11, 12]
const ex = (n: number) => 46 + n * 23
const ey = (v: number) => 276 - v * 11
const tauPath = TAU.map((v, n) => `${n ? 'L' : 'M'}${ex(n)},${ey(v)}`).join(' ')

/* a congestion window over time, simplified */
const CWND = 'M26,262 Q36,262 44,226 L52,202 L118,160 L120,201 L176,166 L178,262 Q188,262 196,228 L204,214'
/* round-trip samples while a queue builds, and the dip when ProbeRTT drains it */
const RTTLINE = 'M26,172 L60,160 L100,150 L128,146 L134,186 L154,186 L160,152 L204,142'
const FLIGHT = 'M26,232 L128,232 L134,268 L154,268 L160,232 L204,232'

/* readahead: successive windows, each a run of blocks; the drawn sizes are only relative */
const WINDOWS = [
  { x: 26, n: 1, y: 128, label: ['the read', '这次读取'] as Bi2 },
  { x: 26, n: 4, y: 164, label: ['initial window', '初始窗口'] as Bi2 },
  { x: 26, n: 8, y: 200, label: ['scaled up', '放大'] as Bi2 },
  { x: 26, n: 12, y: 236, label: ['up to the maximum', '直到上限'] as Bi2 },
]
</script>

<template>
  <CounterDemo v-if="demo && state === 'branch'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A loop that predicts from history', '一个用历史做预测的循环')">
    <defs>
      <marker id="hp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- what has happened, up to now -->
    <g :class="part('strip')">
      <text x="14" y="20" class="tag">{{ label }}</text>
      <template v-if="chips">
        <g v-for="(c, i) in chips" :key="i">
          <rect :x="14 + i * 34" y="30" width="30" height="24" rx="4" class="box" :class="{ chiphot: c.hot }" />
          <text :x="29 + i * 34" y="46" class="code c">{{ c.c }}</text>
        </g>
      </template>
      <template v-else>
        <rect v-for="(h, i) in BARS" :key="i" :x="14 + i * 12" :y="58 - h" width="8" :height="h" rx="1" class="muted-fill" />
      </template>
      <line x1="262" y1="12" x2="262" y2="64" class="now" />
      <text x="268" y="22" class="tag hi">{{ L('now', '现在') }}</text>
      <text x="306" y="52" class="c qm">?</text>
    </g>
    <g :class="part('future')">
      <rect x="264" y="26" width="86" height="38" rx="5" class="outline warn" />
    </g>

    <!-- the three parts -->
    <g :class="part('sum')">
      <rect x="12" y="84" width="210" height="218" rx="7" class="box" />
      <text x="20" y="99" class="tag hi">{{ sumTitle }}</text>
    </g>
    <g :class="part('upd')">
      <rect x="232" y="84" width="118" height="102" rx="7" class="box gate" />
      <text x="240" y="99" class="tag hi">{{ updTitle }}</text>
      <text v-for="(t, i) in lines(words.upd)" :key="i" x="240" :y="117 + i * 13" class="tag">{{ t }}</text>
    </g>
    <g :class="part('fgt')">
      <rect x="232" y="200" width="118" height="102" rx="7" class="box gate" />
      <text x="240" y="215" class="tag hi">{{ fgtTitle }}</text>
      <text v-for="(t, i) in lines(words.fgt)" :key="i" x="240" :y="233 + i * 13" class="tag">{{ t }}</text>
    </g>
    <g :class="part('pred')">
      <rect x="12" y="326" width="210" height="60" rx="7" class="box strong" />
      <text x="20" y="341" class="tag hi">{{ L('prediction', '预测') }}</text>
      <text x="20" y="366" class="pred">{{ txt(words.pred) }}</text>
    </g>
    <g :class="part('out')">
      <rect x="232" y="326" width="118" height="60" rx="7" class="box" />
      <text x="240" y="341" class="tag hi">{{ outTitle }}</text>
      <text v-for="(t, i) in lines(words.out)" :key="i" x="240" :y="354 + i * 12" class="tag">{{ t }}</text>
    </g>

    <!-- the loop -->
    <g :class="part('arrows')">
      <path d="M290,66 L290,82" class="call" marker-end="url(#hp-arrow)" />
      <path d="M232,134 L224,134" class="call" marker-end="url(#hp-arrow)" />
      <path d="M232,250 L224,250" class="call" marker-end="url(#hp-arrow)" />
      <path d="M117,302 L117,324" class="call" marker-end="url(#hp-arrow)" />
    </g>
    <g :class="part('check')">
      <path d="M222,356 L230,356" class="call" marker-end="url(#hp-arrow)" />
      <path d="M290,326 L290,304" class="call" marker-end="url(#hp-arrow)" />
      <text x="296" y="319" class="tag">{{ L('wrong', '猜错') }}</text>
    </g>
    <g :class="part('ask')">
      <path d="M232,356 L224,356" class="call" marker-end="url(#hp-arrow)" />
    </g>

    <!-- a smoothed estimate over noisy samples -->
    <g :class="part('spark')">
      <circle v-for="(h, i) in BARS" :key="i" :cx="28 + i * 9.4" :cy="210 + (h - 16) * 3.4" r="2.2" class="muted-fill" />
      <path d="M26,212 C70,204 120,216 208,208" class="est" />
      <text x="28" y="164" class="tag">{{ L('one estimate, kept up to date', '一个随时更新的估计值') }}</text>
      <text x="28" y="282" class="tag">{{ L('dots: samples · line: the estimate', '圆点：样本 · 线：估计值') }}</text>
    </g>

    <!-- what the oracle would need, and what stands in for it -->
    <g :class="part('cards')">
      <rect x="12" y="84" width="164" height="100" rx="7" class="box" />
      <text x="20" y="102" class="tag hi">{{ L('Chapter 7: SJF, STCF', '第 7 章：SJF、STCF') }}</text>
      <text x="20" y="122" class="tag">{{ L('need to know how long', '需要知道每个任务') }}</text>
      <text x="20" y="136" class="tag">{{ L('each job will run', '要运行多久') }}</text>
      <rect x="186" y="84" width="164" height="100" rx="7" class="box" />
      <text x="194" y="102" class="tag hi">{{ L('Chapter 22: Belady’s OPT', '第 22 章：Belady 的最优策略') }}</text>
      <text x="194" y="122" class="tag">{{ L('needs to know which page', '需要知道哪一页') }}</text>
      <text x="194" y="136" class="tag">{{ L('is used furthest ahead', '最晚才会被用到') }}</text>
      <path d="M150,84 C180,70 240,70 276,66" class="danger" />
      <path d="M268,84 C278,78 292,74 300,66" class="danger" />
      <text x="20" y="166" class="tag bad-text">{{ L('out of reach', '谁也看不见') }}</text>
      <text x="194" y="166" class="tag bad-text">{{ L('out of reach', '谁也看不见') }}</text>
      <path d="M94,184 L94,206" class="call" marker-end="url(#hp-arrow)" />
      <path d="M268,184 L268,206" class="call" marker-end="url(#hp-arrow)" />
      <rect x="12" y="208" width="164" height="80" rx="7" class="box strong" />
      <text x="20" y="226" class="tag hi">MLFQ</text>
      <text x="20" y="246" class="tag">{{ L('watches how a job', '观察一个任务') }}</text>
      <text x="20" y="260" class="tag">{{ L('has behaved', '过去的表现') }}</text>
      <rect x="186" y="208" width="164" height="80" rx="7" class="box strong" />
      <text x="194" y="226" class="tag hi">LRU</text>
      <text x="194" y="246" class="tag">{{ L('watches which pages', '观察哪些页') }}</text>
      <text x="194" y="260" class="tag">{{ L('were used recently', '最近被用过') }}</text>
    </g>

    <!-- the kinds of summary -->
    <g :class="part('kinds')">
      <text x="20" y="122" class="tag">{{ L('small and cheap to update:', '小，而且更新便宜：') }}</text>
      <g v-for="(k, i) in [
        ['a queue level', '一个队列层级'],
        ['one averaged number', '一个平均值'],
        ['a two-bit counter', '一个两位计数器'],
        ['a window size', '一个窗口大小'],
      ]" :key="k[0]">
        <rect x="26" :y="136 + i * 38" width="182" height="30" rx="5" class="box floor" />
        <text x="117" :y="155 + i * 38" class="tag hi c">{{ L(k[0], k[1]) }}</text>
      </g>
    </g>

    <!-- MLFQ: a job's level is the summary -->
    <g :class="part('ladder')">
      <g v-for="(y, i) in [114, 176, 238]" :key="y">
        <rect x="40" :y="y" width="110" height="40" rx="5" class="box floor" />
        <text x="50" :y="y + 24" class="sub">Q{{ 2 - i }}</text>
      </g>
      <circle cx="104" cy="134" r="8" class="p0" />
      <circle cx="104" cy="196" r="8" class="ghost" />
      <circle cx="104" cy="258" r="8" class="ghost" />
      <path d="M124,156 L124,174" class="call" marker-end="url(#hp-arrow)" />
      <path d="M124,218 L124,236" class="call" marker-end="url(#hp-arrow)" />
      <path d="M38,258 C14,258 14,134 38,134" class="call warn" marker-end="url(#hp-arrow)" />
      <text x="156" y="138" class="tag">{{ L('starts here', '从这里起步') }}</text>
      <text x="156" y="168" class="tag">{{ L('sinks as it', '用掉配额') }}</text>
      <text x="156" y="181" class="tag">{{ L('uses allotment', '就下沉') }}</text>
      <text x="18" y="288" class="tag">{{ L('the level is the running prediction', '层级就是滚动的预测') }}</text>
    </g>

    <!-- the exponential average -->
    <g :class="part('ewma')">
      <line x1="36" y1="276" x2="216" y2="276" class="axis" />
      <rect v-for="(v, n) in T" :key="n" :x="ex(n) - 7" :y="ey(v)" width="14" :height="v * 11" rx="2" class="p0" opacity="0.4" />
      <path :d="tauPath" class="est" />
      <circle v-for="(v, n) in TAU" :key="'t' + n" :cx="ex(n)" :cy="ey(v)" r="2.6" :class="n === 7 ? 'p1' : 'dark'" />
      <text v-for="(v, n) in TAU" :key="'l' + n" :x="ex(n)" :y="ey(v) - 5" class="val c">{{ v }}</text>
      <text v-for="n in 8" :key="'x' + n" :x="ex(n - 1)" y="289" class="val c">{{ n - 1 }}</text>
      <text x="212" y="99" class="tag end">{{ L('bars: t · line: τ', '柱：t · 线：τ') }}</text>
    </g>

    <!-- one RTO update -->
    <g :class="part('rtotab')">
      <text x="110" y="124" class="tag c">{{ L('before', '之前') }}</text>
      <text x="184" y="124" class="tag c">{{ L('after 180 ms', '180 ms 之后') }}</text>
      <g v-for="(r, i) in [['SRTT', '100', '110'], ['RTTVAR', '10', '27.5'], ['RTO', '140', '220']]" :key="r[0]">
        <text x="24" :y="150 + i * 30" class="code">{{ r[0] }}</text>
        <text x="110" :y="150 + i * 30" class="code c">{{ r[1] }}</text>
        <text x="184" :y="150 + i * 30" class="code c" :class="{ hot: i === 2 }">{{ r[2] }}</text>
      </g>
      <line x1="22" y1="196" x2="212" y2="196" class="axis" />
      <text x="24" y="240" class="code">RTO = SRTT + 4 · RTTVAR</text>
      <text x="24" y="264" class="tag">{{ L('the mean moved 10 ms,', '均值动了 10 ms，') }}</text>
      <text x="24" y="278" class="tag">{{ L('the timeout 80 ms', '超时动了 80 ms') }}</text>
    </g>

    <!-- the congestion window, simplified -->
    <g :class="part('cwnd')">
      <text x="20" y="114" class="tag">{{ L('cwnd over time, simplified', 'cwnd 随时间变化（简化）') }}</text>
      <line x1="24" y1="264" x2="212" y2="264" class="axis" />
      <path :d="CWND" class="est" />
      <text x="119" y="216" class="tag c">{{ L('loss: about half', '丢包：大致减半') }}</text>
      <text x="172" y="284" class="tag end">{{ L('timeout: one segment', '超时：一个报文段') }}</text>
    </g>

    <!-- BBR: two filtered numbers -->
    <g :class="part('bbr')">
      <text x="212" y="99" class="tag end">{{ L('a sketch, not data', '示意，非实测') }}</text>
      <text x="24" y="128" class="tag">{{ L('RTT samples', 'RTT 样本') }}</text>
      <line x1="26" y1="186" x2="208" y2="186" class="minline" />
      <path :d="RTTLINE" class="est" />
      <text x="208" y="199" class="tag end">{{ L('true delay', '真实时延') }}</text>
      <text x="24" y="218" class="tag">{{ L('data in flight', '在途数据') }}</text>
      <path :d="FLIGHT" class="est thin" />
      <path d="M131,280 L157,280" class="call" marker-start="url(#hp-arrow)" marker-end="url(#hp-arrow)" />
      <text x="145" y="294" class="tag c">ProbeRTT</text>
    </g>

    <!-- the two-bit counter -->
    <g :class="part('branch')">
      <text x="68" y="124" class="tag c">{{ L('predict not taken', '预测不跳转') }}</text>
      <text x="166" y="124" class="tag c">{{ L('predict taken', '预测跳转') }}</text>
      <rect x="24" y="132" width="88" height="72" rx="8" class="outline" />
      <rect x="122" y="132" width="88" height="72" rx="8" class="outline" />
      <g v-for="n in 4" :key="n">
        <circle :cx="44 + (n - 1) * 49" cy="168" r="15" class="box" />
        <text :x="44 + (n - 1) * 49" y="172.5" class="lbl c">{{ n - 1 }}</text>
      </g>
      <path v-for="n in 3" :key="'u' + n" :d="`M${48 + (n - 1) * 49},152 C${58 + (n - 1) * 49},140 ${73 + (n - 1) * 49},140 ${84 + (n - 1) * 49},152`" class="link solid" marker-end="url(#hp-arrow)" />
      <path v-for="n in 3" :key="'d' + n" :d="`M${84 + (n - 1) * 49},184 C${73 + (n - 1) * 49},196 ${58 + (n - 1) * 49},196 ${48 + (n - 1) * 49},184`" class="link solid" marker-end="url(#hp-arrow)" />
      <text x="24" y="228" class="tag">{{ L('upper arrows: taken', '上方箭头：跳转') }}</text>
      <text x="24" y="242" class="tag">{{ L('lower arrows: not taken', '下方箭头：不跳转') }}</text>
      <text x="24" y="270" class="tag hi">{{ L('A loop of ten: one miss', '十次的循环：每轮错一次') }}</text>
      <text x="24" y="284" class="tag hi">{{ L('per run, not two', '而不是两次') }}</text>
    </g>

    <!-- one predictor, two programs -->
    <g :class="part('spectre')">
      <rect x="62" y="136" width="110" height="94" rx="5" class="box floor" />
      <text x="117" y="130" class="tag c">{{ L('branch target buffer', '分支目标缓冲区') }}</text>
      <rect v-for="i in 4" :key="i" x="70" :y="122 + i * 20" width="94" height="14" rx="2" :class="i === 3 ? 'p3' : 'sunk'" :opacity="i === 3 ? 0.75 : 1" />
      <circle cx="30" cy="192" r="11" class="p3" />
      <text x="30" y="196" class="sub c onf">A</text>
      <path d="M41,192 L68,192" class="danger" marker-end="url(#hp-arrow)" />
      <text x="30" y="218" class="tag c">{{ L('trains', '训练') }}</text>
      <circle cx="200" cy="192" r="11" class="p0" />
      <text x="200" y="196" class="sub c onf">V</text>
      <path d="M189,192 L166,192" class="call" marker-end="url(#hp-arrow)" />
      <text x="200" y="218" class="tag c">{{ L('looks up', '查询') }}</text>
      <text x="20" y="256" class="tag">{{ L('one predictor, shared by whoever', '一个预测器，') }}</text>
      <text x="20" y="270" class="tag">{{ L('runs on this core', '由这个核心上跑的代码共用') }}</text>
    </g>

    <!-- ARC's lists -->
    <g :class="part('arclists')">
      <text x="24" y="122" class="tag">{{ L('seen once recently', '最近只见过一次') }}</text>
      <rect v-for="i in 5" :key="'a' + i" :x="24 + (i - 1) * 21" y="130" width="18" height="24" rx="3" class="p0" opacity="0.55" />
      <text x="24" y="170" class="tag">{{ L('evicted from it (remembered only)', '从这边淘汰的（只记名字）') }}</text>
      <rect v-for="i in 5" :key="'b' + i" :x="24 + (i - 1) * 21" y="176" width="18" height="24" rx="3" class="ghostbox" />
      <text x="24" y="222" class="tag">{{ L('seen more than once', '见过不止一次') }}</text>
      <rect v-for="i in 7" :key="'c' + i" :x="24 + (i - 1) * 21" y="228" width="18" height="24" rx="3" class="p1" opacity="0.55" />
      <text x="24" y="270" class="tag">{{ L('evicted from it (remembered only)', '从这边淘汰的（只记名字）') }}</text>
      <rect v-for="i in 7" :key="'d' + i" :x="24 + (i - 1) * 21" y="275" width="18" height="20" rx="3" class="ghostbox" />
    </g>

    <!-- readahead windows -->
    <g :class="part('ra')">
      <g v-for="w in WINDOWS" :key="w.y">
        <text x="26" :y="w.y - 6" class="tag">{{ txt(w.label) }}</text>
        <rect v-for="k in w.n" :key="k" :x="w.x + (k - 1) * 14.5" :y="w.y" width="12" height="16" rx="2" class="p0" opacity="0.55" />
      </g>
      <text x="26" y="282" class="tag">{{ L('commonly 128 KB at most', '上限常见为 128 KB') }}</text>
    </g>

    <!-- stale history -->
    <g :class="part('stale')">
      <text x="24" y="138" class="tag">{{ L('explicit expiry:', '显式过期：') }}</text>
      <rect x="24" y="152" width="186" height="46" rx="5" class="box floor" />
      <text x="117" y="172" class="tag hi c">{{ L('TCP’s restart after idle', 'TCP 空闲后重新起步') }}</text>
      <text x="117" y="187" class="tag c">{{ L('(RFC 5681)', '（RFC 5681）') }}</text>
      <rect x="24" y="208" width="186" height="46" rx="5" class="box floor" />
      <text x="117" y="228" class="tag hi c">{{ L('ULE’s five-second cap', 'ULE 的 5 秒上限') }}</text>
      <text x="117" y="243" class="tag c">{{ L('on remembered sleep and run', '记住的睡眠与运行时间') }}</text>
    </g>
  </svg>
</template>

<style scoped>
text.onf {
  fill: #fff;
}
.chiphot {
  stroke: var(--accent);
  stroke-width: 2;
}
.now {
  stroke: var(--ink-2);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}
.qm {
  font-size: 24px;
  fill: var(--faint);
}
.est {
  fill: none;
  stroke: var(--p1);
  stroke-width: 1.8;
}
.est.thin {
  stroke: var(--p0);
}
.minline {
  stroke: var(--ink-2);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.axis {
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.val {
  font-size: 8.5px;
  fill: var(--muted);
}
.dark {
  fill: var(--p1);
}
.pred {
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink);
}
.ghost {
  fill: none;
  stroke: var(--rule-strong);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.ghostbox {
  fill: none;
  stroke: var(--rule-strong);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.call.warn {
  stroke: var(--warn);
}
.code.hot {
  fill: var(--accent-ink);
  font-weight: 600;
}
</style>
