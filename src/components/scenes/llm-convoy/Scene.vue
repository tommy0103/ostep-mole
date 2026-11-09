<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import BatchDemo from './BatchDemo.vue'

/**
 * The running figure of the LLM-serving article: requests wait, a scheduler picks who sits in the
 * GPU's batch, each seat advances a token per iteration, and the GPU's memory holds the model's
 * weights and every seated request's KV cache. A is the 2,000-token essay of the article's example
 * (process colour p0); the short chats are B, C, D and the latecomer E.
 */
const props = defineProps<DrawingProps>()
const CORE = ['sched', 'gpu', 'seats', 'memory']
const SHOW: Record<string, string[]> = {
  overview: [...CORE, 'kvbox', 'queue', 'kv'],
  workload: [...CORE, 'phases', 'weightlink'],
  kv: [...CORE, 'kvbox', 'kv'],
  static: [...CORE, 'kvbox', 'queue', 'kv', 'out', 'iter'],
  iteration: [...CORE, 'kvbox', 'queue', 'kv', 'out', 'iter'],
  reserve: [...CORE, 'kvbox', 'reserve'],
  stall: ['sched', 'gpu', 'seats', 'budget', 'stalled'],
  chunked: ['sched', 'gpu', 'seats', 'budget', 'chunk'],
  distserve: ['sched', 'gpu', 'seats', 'memory', 'kvbox', 'kv', 'pgpu', 'handoff'],
  oracle: ['sched', 'gpu', 'seats', 'queue', 'unknown'],
  mlfq: ['sched', 'gpu', 'seats', 'mlfq'],
  predict: ['sched', 'gpu', 'seats', 'queue', 'rank'],
  bends: [...CORE, 'kvbox', 'kv', 'preempt'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 400)
const st = computed(() => props.state)

interface Seat {
  k: string
  cls: string
  /** the share of its own output that is done */
  pct: number
  note?: string
  free?: boolean
  dim?: boolean
}
const A = (pct: number, note?: string): Seat => ({ k: 'A', cls: 'p0', pct, note })
const S = (k: string, cls: string, pct: number, note?: string): Seat => ({ k, cls, pct, note })
const FREE: Seat = { k: '', cls: '', pct: 0, free: true }
const seats = computed<Seat[]>(() => {
  switch (st.value) {
    case 'static':
      return [A(1, '20 / 2,000'), S('B', 'p1', 100, L('done, seat held', '完成，占着座')), S('C', 'p2', 100, L('done, seat held', '完成，占着座')), S('D', 'p4', 100, L('done, seat held', '完成，占着座'))]
    case 'iteration':
      return [A(1, '21 / 2,000'), S('E', 'p3', 5, '1 / 20'), { ...FREE, note: L('free', '空闲') }, { ...FREE, note: L('free', '空闲') }]
    case 'bends':
      return [A(45), S('B', 'p1', 60), { ...FREE, note: L('preempted', '被抢占') }, S('D', 'p4', 30)]
    default:
      return [A(45), S('B', 'p1', 70), S('C', 'p2', 40), S('D', 'p4', 85)]
  }
})

/** who is waiting, head of the line on the right */
const waiting = computed(() => {
  switch (st.value) {
    case 'static':
      return [{ k: 'E', cls: 'p3' }]
    case 'iteration':
      return []
    case 'stall':
    case 'chunked':
      return []
    case 'oracle':
      return [{ k: '?', cls: 'p1' }, { k: '?', cls: 'p2' }, { k: '?', cls: 'p4' }]
    case 'predict':
      return [{ k: '', cls: 'p0', w: 74 }, { k: '', cls: 'p2', w: 40 }, { k: '', cls: 'p4', w: 26 }, { k: '', cls: 'p1', w: 14 }]
    default:
      return [{ k: 'E', cls: 'p3' }, { k: 'F', cls: 'p2' }]
  }
})
const queueX = (i: number) => {
  let x = 232
  const list = waiting.value as { w?: number }[]
  for (let j = 0; j <= i; j++) x -= (list[j].w ?? 24) + 4
  return x
}
const queueTag = computed(() =>
  st.value === 'oracle' ? L('prompt lengths known, output lengths not', '提示词长度已知，输出长度未知') : st.value === 'predict' ? L('sorted by predicted output length', '按预测的输出长度排序') : L('waiting', '等待中'),
)
const schedSub = computed(() => {
  if (st.value === 'static') return L('once per batch', '每批一次')
  if (st.value === 'chunked') return L('decodes first', '先排解码')
  if (st.value === 'mlfq') return 'skip-join MLFQ'
  if (st.value === 'predict') return L('shortest first', '预测最短的先跑')
  if (st.value === 'overview') return L('picks the batch', '挑选一批')
  return L('every iteration', '每次迭代')
})
const gpuName = computed(() => (st.value === 'distserve' ? L('Decode GPUs', '解码 GPU') : 'GPU'))
const iter = computed(() => (st.value === 'static' ? L('iteration 20', '第 20 次迭代') : L('iteration 21', '第 21 次迭代')))
const returned = computed(() => (st.value === 'iteration' ? [{ k: 'B', cls: 'p1' }, { k: 'C', cls: 'p2' }, { k: 'D', cls: 'p4' }] : []))
const outTag = computed(() => (st.value === 'static' ? L('returned to users: nothing yet', '已返回给用户：还没有') : L('returned to users', '已返回给用户')))

/** each seat's KV cache, as a block in GPU memory */
const kvBlocks = computed(() => {
  const list = st.value === 'iteration' ? [['p0', 96], ['p3', 18]] : st.value === 'bends' ? [['p0', 96], ['p1', 34], ['', 40], ['p4', 26]] : [['p0', 96], ['p1', 34], ['p2', 26], ['p4', 40]]
  let x = 124
  return (list as [string, number][]).map(([cls, w]) => {
    const b = { x, w, cls }
    x += w + 3
    return b
  })
})
</script>

<template>
  <BatchDemo v-if="demo && state === 'static'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('An LLM server: waiting requests, a scheduler, a GPU batch', '大模型推理服务器：等待的请求、调度器、GPU 批')">
    <defs>
      <marker id="llm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- ── who is waiting ── -->
    <g :class="part('queue')">
      <text x="8" y="26" class="tag">{{ queueTag }}</text>
      <rect x="8" y="32" width="228" height="30" rx="3" class="lane" />
      <g v-for="(q, i) in waiting" :key="i">
        <rect :x="queueX(i)" y="36" :width="(q as { w?: number }).w ?? 24" height="22" rx="2" :class="q.cls" />
        <text v-if="q.k" :x="queueX(i) + 12" y="51" class="tag c w">{{ q.k }}</text>
      </g>
      <path d="M236,47 L244,47" class="link solid" marker-end="url(#llm-arrow)" />
    </g>
    <g :class="part('unknown')">
      <text x="122" y="74" class="tag hi c">{{ L('each will generate ? tokens', '每个请求要生成 ? 个 token') }}</text>
    </g>
    <g :class="part('rank')">
      <text x="8" y="74" class="tag">{{ L('long', '长') }}</text>
      <text x="232" y="74" class="tag end">{{ L('short, runs first', '短，先跑') }}</text>
    </g>
    <g :class="part('mlfq')">
      <text x="8" y="26" class="tag">{{ L('high', '高') }}</text>
      <rect x="40" y="16" width="196" height="16" rx="2" class="lane" />
      <rect x="208" y="18" width="24" height="12" rx="2" class="p1" />
      <text x="8" y="46" class="tag">{{ L('mid', '中') }}</text>
      <rect x="40" y="36" width="196" height="16" rx="2" class="lane" />
      <rect x="208" y="38" width="24" height="12" rx="2" class="p2" />
      <text x="170" y="48" class="tag end">{{ L('enters by input length', '按输入长度进入') }}</text>
      <text x="8" y="66" class="tag">{{ L('low', '低') }}</text>
      <rect x="40" y="56" width="196" height="16" rx="2" class="lane" />
      <rect x="208" y="58" width="24" height="12" rx="2" class="p0" />
      <text x="202" y="68" class="tag end">{{ L('sinks as it keeps generating', '不断生成，逐级下沉') }}</text>
      <path d="M236,44 L244,44" class="link solid" marker-end="url(#llm-arrow)" />
    </g>

    <!-- ── the scheduler ── -->
    <g :class="part('sched')">
      <rect x="246" y="20" width="106" height="52" rx="6" class="box strong" />
      <text x="299" y="42" class="lbl c">{{ L('Scheduler', '调度器') }}</text>
      <text x="299" y="58" class="sub c">{{ schedSub }}</text>
      <path d="M299,72 L299,82" class="link solid" marker-end="url(#llm-arrow)" />
    </g>

    <!-- ── the GPU ── -->
    <g :class="part('gpu')">
      <rect x="8" y="84" width="344" height="234" rx="7" class="box" />
      <text x="18" y="102" class="lbl">{{ gpuName }}</text>
      <text :x="state === 'distserve' ? 96 : 62" y="102" class="tag">{{ L('one batch, four seats', '一批，四个座位') }}</text>
    </g>
    <g :class="part('iter')">
      <text x="344" y="102" class="tag hi end">{{ iter }}</text>
    </g>
    <g :class="part('seats')">
      <g v-for="(s, i) in seats" :key="i">
        <template v-if="!s.free">
          <rect x="18" :y="110 + i * 25" width="22" height="20" rx="2" :class="s.cls" />
          <text x="29" :y="124 + i * 25" class="tag c w">{{ s.k }}</text>
          <rect x="46" :y="112 + i * 25" width="210" height="16" rx="2" class="lane" />
          <rect x="46" :y="112 + i * 25" :width="(210 * s.pct) / 100" height="16" rx="2" :class="s.cls" class="bar" />
        </template>
        <rect v-else x="18" :y="110 + i * 25" width="238" height="20" rx="3" class="freeseat" />
        <text x="262" :y="124 + i * 25" class="tag">{{ s.note }}</text>
      </g>
    </g>
    <g :class="part('phases')">
      <rect x="46" y="112" width="96" height="16" rx="2" class="prompt" />
      <text x="94" y="124" class="tag c">{{ L('prefill', '预填充') }}</text>
      <rect v-for="i in 8" :key="i" :x="146 + (i - 1) * 9" y="112" width="7" height="16" rx="1" class="p0" />
      <text x="262" y="124" class="tag">{{ L('decode', '解码') }}</text>
      <text x="262" y="149" class="tag">{{ L('prefill: the', '预填充：') }}</text>
      <text x="262" y="161" class="tag">{{ L('whole prompt,', '一次读完提示词') }}</text>
      <text x="262" y="173" class="tag">{{ L('one pass', '') }}</text>
      <text x="262" y="193" class="tag hi">{{ L('decode: a token', '解码：每次迭代') }}</text>
      <text x="262" y="205" class="tag hi">{{ L('per iteration', '每座一个 token') }}</text>
    </g>

    <!-- ── what one iteration holds ── -->
    <g :class="part('budget')">
      <text x="18" y="224" class="tag">{{ L('one iteration:', '一次迭代：') }}</text>
      <rect x="18" y="230" width="326" height="26" rx="3" class="lane" />
      <rect v-for="(c, i) in ['p0', 'p1', 'p2', 'p4']" :key="c" :x="22 + i * 11" y="234" width="9" height="18" rx="1" :class="c" />
      <text x="44" y="272" class="tag c">{{ L('decodes', '解码') }}</text>
    </g>
    <g :class="part('stalled')">
      <rect x="68" y="234" width="272" height="18" rx="1" class="p3" />
      <text x="204" y="247" class="tag c w">{{ L('the whole of one long prompt', '一个长提示词，整个塞进来') }}</text>
      <text x="344" y="224" class="tag bad-text end">{{ L('a much longer iteration: every chat waits', '这次迭代长得多：每个聊天都得等') }}</text>
    </g>
    <g :class="part('chunk')">
      <rect x="68" y="234" width="184" height="18" rx="1" class="p3" />
      <text x="160" y="247" class="tag c w">{{ L('one chunk of the prompt', '提示词的一块') }}</text>
      <path d="M258,226 L258,262" class="budgetline" />
      <text x="258" y="272" class="tag hi c">{{ L('token budget', 'token 预算') }}</text>
      <text x="344" y="224" class="tag end">{{ L('the rest waits for later iterations', '其余的留给后面的迭代') }}</text>
    </g>

    <!-- ── GPU memory ── -->
    <g :class="part('memory')">
      <rect x="18" y="248" width="92" height="60" rx="4" class="box gate" />
      <text x="64" y="274" class="lbl c">{{ L('Weights', '权重') }}</text>
      <text x="64" y="290" class="sub c">{{ L('read every step', '每步都要读') }}</text>
      <text x="344" y="240" class="tag end">{{ L('GPU memory', 'GPU 内存') }}</text>
    </g>
    <g :class="part('kvbox')">
      <rect x="118" y="248" width="226" height="60" rx="4" class="lane" />
      <text x="124" y="262" class="tag hi">{{ L('KV cache', 'KV 缓存') }}</text>
    </g>
    <g :class="part('weightlink')">
      <path d="M64,246 L64,212" class="link solid" marker-end="url(#llm-arrow)" />
      <text x="72" y="226" class="tag">{{ L('read once for all four seats', '读一次，四个座位都用上') }}</text>
    </g>
    <g :class="part('kv')">
      <g v-for="(b, i) in kvBlocks" :key="i">
        <rect :x="b.x" y="270" :width="b.w" height="30" rx="2" :class="b.cls || 'discard'" />
      </g>
    </g>
    <g :class="part('reserve')">
      <g v-for="(c, i) in ['p0', 'p1', 'p2', 'p4']" :key="c">
        <rect :x="124 + i * 54" y="270" width="50" height="30" rx="2" class="held" />
        <rect :x="124 + i * 54" y="270" :width="i === 0 ? 20 : 6" height="30" rx="2" :class="c" />
      </g>
      <text x="338" y="262" class="tag end">{{ L('reserved for max_tokens on admission', '接纳时按 max_tokens 预留') }}</text>
    </g>
    <g :class="part('preempt')">
      <text x="267" y="262" class="tag bad-text">{{ L('✕ discarded', '✕ 已丢弃') }}</text>
    </g>

    <!-- ── what comes out; a second pool of GPUs ── -->
    <g :class="part('out')">
      <text x="8" y="340" class="tag">{{ outTag }}</text>
      <rect x="8" y="346" width="228" height="30" rx="3" class="lane" />
      <g v-for="(r, i) in returned" :key="r.k">
        <rect :x="14 + i * 28" y="350" width="24" height="22" rx="2" :class="r.cls" />
        <text :x="26 + i * 28" y="365" class="tag c w">{{ r.k }}</text>
      </g>
    </g>
    <g :class="part('pgpu')">
      <rect x="246" y="334" width="106" height="58" rx="6" class="box strong" />
      <text x="299" y="358" class="lbl c">{{ L('Prefill GPUs', '预填充 GPU') }}</text>
      <text x="299" y="374" class="sub c">{{ L('whole prompts', '整个提示词') }}</text>
    </g>
    <g :class="part('handoff')">
      <path d="M299,333 L299,311" class="call" marker-end="url(#llm-arrow)" />
      <text x="292" y="329" class="tag hi end">{{ L('hands over the KV cache', '把 KV 缓存交过去') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.lane {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.bar {
  transition: width 0.4s ease;
}
.freeseat {
  fill: none;
  stroke: var(--rule-strong);
  stroke-dasharray: 4 3;
}
.prompt {
  fill: var(--accent-soft);
  stroke: var(--rule-strong);
}
.held {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 3 2;
}
.discard {
  fill: none;
  stroke: var(--p3);
  stroke-dasharray: 3 2;
}
.budgetline {
  stroke: var(--ink);
  stroke-width: 1.6;
}
text.w {
  fill: #fff;
  font-weight: 600;
}
.lit .lane,
.lit .held {
  stroke: var(--accent);
  stroke-width: 2;
}
</style>
