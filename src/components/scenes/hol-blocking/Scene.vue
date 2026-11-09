<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import SwitchDemo from './SwitchDemo.vue'

/**
 * The running figure of the head-of-line blocking article: one queue, drawn in the four places the
 * article finds it. Every row reads the same way, work waiting on the left and whatever serves it
 * on the right, with the head of the line next to it; A (blue) is always the long or stuck item,
 * and the short ones waiting behind it are B, C, D. A state shows one row; a fix changes that
 * row's queue in place.
 */
const props = defineProps<DrawingProps>()
const R1 = ['server', 'browser']
const R2 = ['fabric', 'in2']
const SHOW: Record<string, string[]> = {
  overview: ['res', 'convoy', 'rejoin', ...R1, 'http1', ...R2, 'switch', 'drive', 'disk'],
  shape: ['res', 'jobs'],
  http1: [...R1, 'http1'],
  six: [...R1, 'six'],
  http2: [...R1, 'http2'],
  tcp: [...R1, 'tcp'],
  quic: [...R1, 'quic'],
  switch: [...R2, 'switch'],
  voq: [...R2, 'voq'],
  disk: ['drive', 'disk'],
  deadline: ['drive', 'deadline'],
  device: ['drive', 'device'],
  kyber: ['drive', 'kyber'],
  moves: ['res', 'convoy', 'grant', ...R1, 'quic', ...R2, 'voq', 'drive', 'deadline', 'move'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 460)

const ROW: Record<string, number> = { shape: 0, http1: 1, six: 1, http2: 1, tcp: 1, quic: 1, switch: 2, voq: 2, disk: 3, deadline: 3, device: 3, kyber: 3 }
const now = (r: number) => ({ now: ROW[props.state] === r || ROW[props.state] === undefined })
const resource = computed(() => (props.state === 'shape' ? 'CPU' : L('Lock', '锁')))
const firstHeader = computed(() => (props.state === 'shape' ? L('Chapter 7: three jobs', '第 7 章：三个任务') : L('A FIFO lock (System R, 1979)', 'FIFO 锁（System R，1979）')))
const idle5 = computed(() => !['voq', 'moves'].includes(props.state))

// HTTP/2: one connection, frames of the streams taking turns (first out on the right)
const FRAMES = ['p0', 'p1', 'p0', 'p2', 'p0', 'p4', 'p0', 'p0', 'p0', 'p0', 'p0', 'p0', 'p0', 'p0']
</script>

<template>
  <SwitchDemo v-if="demo && state === 'switch'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('One queue, in four places', '同一条队列，出现在四个地方')">
    <defs>
      <marker id="hol-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the four rows -->
    <line x1="8" x2="352" y1="114" y2="114" class="rule" />
    <line x1="8" x2="352" y1="234" y2="234" class="rule" />
    <line x1="8" x2="352" y1="346" y2="346" class="rule" />
    <text x="8" y="18" class="head" :class="now(0)">{{ firstHeader }}</text>
    <text x="8" y="128" class="head" :class="now(1)">{{ L('An HTTP connection', '一条 HTTP 连接') }}</text>
    <text x="8" y="248" class="head" :class="now(2)">{{ L('Inside a switch', '交换机内部') }}</text>
    <text x="8" y="360" class="head" :class="now(3)">{{ L('Disk I/O', '磁盘 I/O') }}</text>
    <g :class="part('move')">
      <text x="352" y="18" class="tag hi end">{{ L('let the waiting overtake', '让等待者超车') }}</text>
      <text x="352" y="128" class="tag hi end">{{ L('a queue per stream', '每个流一个队列') }}</text>
      <text x="352" y="248" class="tag hi end">{{ L('a queue per output', '每个输出一个队列') }}</text>
      <text x="352" y="360" class="tag hi end">{{ L('a queue per kind of work', '每类工作一个队列') }}</text>
    </g>

    <!-- ── a lock; a CPU ── -->
    <g :class="part('res')">
      <rect x="278" y="30" width="74" height="42" rx="6" class="box strong" />
      <text x="315" y="56" class="lbl c">{{ resource }}</text>
      <rect x="40" y="38" width="224" height="26" rx="3" class="lane" />
    </g>
    <g :class="part('convoy')">
      <text x="262" y="31" class="tag hi end">{{ L('the holder stalls: a page fault, an I/O', '持锁者停住了：页错误、I/O') }}</text>
      <rect x="218" y="41" width="44" height="20" rx="2" class="p0" />
      <text x="232" y="55" class="tag c w">A</text>
      <rect x="246" y="46" width="3" height="10" class="on-fill" />
      <rect x="252" y="46" width="3" height="10" class="on-fill" />
      <g v-for="(c, i) in [['B', 'p1'], ['C', 'p2'], ['D', 'p4']]" :key="c[0]">
        <rect :x="190 - i * 28" y="41" width="24" height="20" rx="2" :class="c[1]" />
        <text :x="202 - i * 28" y="55" class="tag c w">{{ c[0] }}</text>
      </g>
    </g>
    <g :class="part('rejoin')">
      <path d="M314,72 C314,100 48,100 46,68" class="link solid" marker-end="url(#hol-arrow)" />
      <text x="180" y="107" class="tag c">{{ L('released, it asks again: the whole convoy is ahead of it', '放开锁又来申请：整支车队已排在它前面') }}</text>
    </g>
    <g :class="part('grant')">
      <text x="152" y="88" class="tag c">{{ L('the fix: stop granting in FIFO order', '解法：不再按 FIFO 顺序授予') }}</text>
    </g>
    <g :class="part('jobs')">
      <text x="64" y="31" class="tag hi">{{ L('B and C: 10 each', 'B、C 各 10') }}</text>
      <rect x="102" y="41" width="160" height="20" rx="2" class="p0" />
      <text x="182" y="55" class="tag c w">A · 100</text>
      <rect x="84" y="41" width="16" height="20" rx="2" class="p1" />
      <text x="92" y="55" class="tag c w">B</text>
      <rect x="66" y="41" width="16" height="20" rx="2" class="p2" />
      <text x="74" y="55" class="tag c w">C</text>
      <text x="40" y="84" class="tag">{{ L('FIFO, A first: (100 + 110 + 120) / 3 =', 'FIFO，A 先：(100 + 110 + 120) / 3 =') }}</text>
      <text x="262" y="84" class="tag hi end">110</text>
      <text x="40" y="100" class="tag">{{ L('SJF, short first: (10 + 20 + 120) / 3 =', 'SJF，短的先：(10 + 20 + 120) / 3 =') }}</text>
      <text x="262" y="100" class="tag hi end">50</text>
    </g>

    <!-- ── an HTTP connection ── -->
    <g :class="part('server')">
      <rect x="8" y="140" width="54" height="84" rx="6" class="box" />
      <text x="35" y="186" class="sub c">{{ L('Server', '服务器') }}</text>
    </g>
    <g :class="part('browser')">
      <rect x="298" y="140" width="54" height="84" rx="6" class="box" />
      <text x="325" y="186" class="sub c">{{ L('Browser', '浏览器') }}</text>
    </g>
    <g :class="part('http1')">
      <text x="180" y="164" class="tag c">{{ L('responses go in the order they were asked for', '响应必须按请求的顺序发送') }}</text>
      <rect x="68" y="172" width="224" height="24" rx="3" class="lane" />
      <rect x="218" y="175" width="72" height="18" rx="2" class="p0" />
      <text x="254" y="188" class="tag c w">{{ L('image 2 MB', '图片 2 MB') }}</text>
      <g v-for="(f, i) in ['p1', 'p2', 'p4']" :key="i">
        <rect :x="192 - i * 26" y="175" width="24" height="18" rx="2" :class="f" />
        <text :x="204 - i * 26" y="188" class="tag c w">css</text>
      </g>
      <text x="166" y="212" class="tag c">{{ L('ready at once, and still waiting', '早已备好，照样得等') }}</text>
    </g>
    <g :class="part('six')">
      <rect v-for="i in 6" :key="i" x="68" :y="136 + (i - 1) * 14" width="224" height="11" rx="2" class="lane" />
      <rect x="230" y="137" width="60" height="9" rx="1.5" class="p0" />
      <rect x="270" y="151" width="20" height="9" rx="1.5" class="p1" />
      <rect x="270" y="165" width="20" height="9" rx="1.5" class="p2" />
      <rect x="270" y="179" width="20" height="9" rx="1.5" class="p4" />
      <text x="180" y="228" class="tag c">{{ L('six connections per host, and each is still a FIFO', '每个主机六条连接，每条依然是 FIFO') }}</text>
    </g>
    <g :class="part('http2')">
      <text x="180" y="164" class="tag c">{{ L('streams cut into frames, taking turns', '流被切成帧，轮流发送') }}</text>
      <rect x="68" y="172" width="224" height="24" rx="3" class="lane" />
      <rect v-for="(f, i) in FRAMES" :key="i" :x="275 - i * 15" y="175" width="13" height="18" rx="1.5" :class="f" />
      <text x="180" y="212" class="tag c">{{ L('every frame carries its stream’s number', '每帧都带着所属流的编号') }}</text>
    </g>
    <g :class="part('tcp')">
      <rect x="68" y="172" width="146" height="24" rx="3" class="lane" />
      <rect v-for="i in 6" :key="i" :x="74 + (i - 1) * 15" y="175" width="13" height="18" rx="1.5" class="p0" />
      <text x="198" y="164" class="tag c bad-text">{{ L('lost', '丢了') }}</text>
      <rect x="190" y="175" width="16" height="18" rx="1.5" class="lost" />
      <text x="198" y="189" class="bad-text c big">✕</text>
      <text x="254" y="160" class="tag c">{{ L('receive buffer', '接收缓冲区') }}</text>
      <rect x="218" y="168" width="72" height="32" rx="4" class="outline" />
      <rect x="225" y="175" width="16" height="18" rx="1.5" class="p1" />
      <rect x="246" y="175" width="16" height="18" rx="1.5" class="p2" />
      <rect x="267" y="175" width="16" height="18" rx="1.5" class="p4" />
      <text x="180" y="214" class="tag c">{{ L('these arrived, and wait for the lost packet to be resent', '这些已经到了，却要等丢的包重传') }}</text>
    </g>
    <g :class="part('quic')">
      <text x="127" y="162" class="tag c">{{ L('QUIC, over UDP', 'QUIC，跑在 UDP 上') }}</text>
      <rect x="68" y="172" width="118" height="24" rx="3" class="lane" />
      <rect v-for="(f, i) in ['p1', 'p0', 'p2', 'p0', 'p4', 'p0', 'p0']" :key="i" :x="170 - i * 15" y="175" width="13" height="18" rx="1.5" :class="f" />
      <path v-for="y in [147, 166, 185, 204]" :key="y" :d="`M186,184 L196,${y}`" class="link solid" />
      <rect v-for="y in [140, 159, 178, 197]" :key="'l' + y" x="196" :y="y" width="96" height="14" rx="2" class="lane" />
      <rect x="274" y="141" width="14" height="12" rx="1.5" class="lost" />
      <text x="281" y="152" class="bad-text c tiny-x">✕</text>
      <rect x="256" y="141" width="14" height="12" rx="1.5" class="p0" />
      <rect x="238" y="141" width="14" height="12" rx="1.5" class="p0" />
      <rect x="274" y="160" width="14" height="12" rx="1.5" class="p1" />
      <rect x="274" y="179" width="14" height="12" rx="1.5" class="p2" />
      <rect x="274" y="198" width="14" height="12" rx="1.5" class="p4" />
      <path v-for="y in [166, 185, 204]" :key="'a' + y" :d="`M289,${y} L297,${y}`" class="link solid" marker-end="url(#hol-arrow)" />
      <text x="180" y="225" class="tag c">{{ L('a lost packet delays only its own stream', '丢一个包，只耽误它所在的那个流') }}</text>
    </g>

    <!-- ── a switch ── -->
    <g :class="part('fabric')">
      <text x="8" y="321" class="tag">{{ L('in 2', '输入 2') }}</text>
      <rect x="172" y="258" width="52" height="70" rx="5" class="box gate" />
      <text x="198" y="324" class="tag c">{{ L('fabric', '交换结构') }}</text>
      <rect x="240" y="266" width="112" height="24" rx="4" class="box strong" />
      <text x="296" y="282" class="tag hi c">{{ L('output 3 · busy', '输出 3 · 忙') }}</text>
      <rect x="240" y="306" width="112" height="24" rx="4" class="box" :class="{ idle: idle5 }" />
      <text x="296" y="322" class="tag c" :class="{ hi: !idle5 }">{{ idle5 ? L('output 5 · idle', '输出 5 · 空闲') : L('output 5 · busy', '输出 5 · 忙') }}</text>
    </g>
    <g :class="part('in2')">
      <rect x="40" y="306" width="116" height="24" rx="3" class="lane" />
      <rect x="130" y="308" width="24" height="20" rx="2" class="p4" />
      <text x="142" y="322" class="tag c w">→3</text>
      <rect x="104" y="308" width="24" height="20" rx="2" class="muted-fill" />
      <path d="M156,318 L172,318 L224,280 L238,278" class="call" marker-end="url(#hol-arrow)" />
    </g>
    <g :class="part('switch')">
      <text x="8" y="281" class="tag">{{ L('in 1', '输入 1') }}</text>
      <rect x="40" y="266" width="116" height="24" rx="3" class="lane" />
      <rect x="130" y="268" width="24" height="20" rx="2" class="p0" />
      <text x="142" y="282" class="tag c w">→3</text>
      <rect x="104" y="268" width="24" height="20" rx="2" class="p1" />
      <text x="116" y="282" class="tag c w">→5</text>
      <rect x="78" y="268" width="24" height="20" rx="2" class="muted-fill" />
      <path d="M156,278 L166,278" class="danger" />
      <text x="166" y="283" class="bad-text c big">✕</text>
      <text x="180" y="342" class="tag c">{{ L('throughput at most 2 − √2 ≈ 58.6%', '吞吐率至多 2 − √2 ≈ 58.6%') }}</text>
    </g>
    <g :class="part('voq')">
      <text x="8" y="281" class="tag">{{ L('in 1', '输入 1') }}</text>
      <rect x="40" y="258" width="116" height="20" rx="3" class="lane" />
      <text x="46" y="272" class="tag">{{ L('for 3', '去 3') }}</text>
      <rect x="130" y="260" width="24" height="16" rx="2" class="p0" />
      <text x="142" y="272" class="tag c w">→3</text>
      <rect x="40" y="282" width="116" height="20" rx="3" class="lane" />
      <text x="46" y="296" class="tag">{{ L('for 5', '去 5') }}</text>
      <rect x="130" y="284" width="24" height="16" rx="2" class="p1" />
      <text x="142" y="296" class="tag c w">→5</text>
      <path d="M156,292 L172,292 L224,314 L238,316" class="call" marker-end="url(#hol-arrow)" />
      <text x="180" y="342" class="tag c">{{ L('a scheduler picks a matching of inputs to outputs', '调度器为输入和输出挑选匹配') }}</text>
    </g>

    <!-- ── disk I/O ── -->
    <g :class="part('drive')">
      <rect x="240" y="374" width="112" height="72" rx="6" class="box strong" />
      <text x="296" y="391" class="lbl c">{{ L('Drive', '磁盘') }}</text>
    </g>
    <g :class="part('disk')">
      <rect x="40" y="398" width="186" height="24" rx="3" class="lane" />
      <rect x="112" y="401" width="112" height="18" rx="2" class="p0" />
      <text x="168" y="414" class="tag c w">{{ L('A: write-back', 'A：后台写回') }}</text>
      <rect x="84" y="401" width="26" height="18" rx="2" class="p1" />
      <text x="97" y="414" class="tag c w">B</text>
      <text x="97" y="392" class="tag hi c">{{ L('4 KB read', '4 KB 读请求') }}</text>
      <text x="133" y="438" class="tag c">{{ L('a user waits for B; nobody waits for A', '用户在等 B，没人在等 A') }}</text>
    </g>
    <g :class="part('deadline')">
      <rect x="40" y="376" width="186" height="20" rx="3" class="lane" />
      <text x="46" y="390" class="tag">{{ L('reads · 500 ms', '读 · 500 ms') }}</text>
      <rect x="200" y="379" width="24" height="14" rx="2" class="p1" />
      <text x="212" y="390" class="tag c w">B</text>
      <rect x="40" y="402" width="186" height="20" rx="3" class="lane" />
      <text x="46" y="416" class="tag">{{ L('writes · 5 s', '写 · 5 s') }}</text>
      <rect x="146" y="405" width="78" height="14" rx="2" class="p0" />
      <text x="185" y="416" class="tag c w">A</text>
      <text x="40" y="438" class="tag">{{ L('batches of 16 in sector order;', '按扇区顺序成批，每批 16 个；') }}</text>
      <text x="40" y="450" class="tag">{{ L('an expired request goes at the next batch', '过期的请求在下一批转去服务') }}</text>
    </g>
    <g :class="part('device')">
      <rect x="40" y="398" width="186" height="24" rx="3" class="lane" />
      <rect x="196" y="401" width="26" height="18" rx="2" class="p1" />
      <text x="209" y="414" class="tag c w">B</text>
      <g v-for="i in 8" :key="i">
        <rect :x="248 + (i - 1) * 12" y="400" width="10" height="10" rx="1" class="p0" />
        <rect :x="248 + (i - 1) * 12" y="413" width="10" height="10" rx="1" class="p0" />
      </g>
      <text x="296" y="438" class="tag c">{{ L('NCQ: up to 32', 'NCQ：最多 32 条') }}</text>
      <text x="133" y="392" class="tag hi c">{{ L('the new read comes after them', '新的读请求只能排在后面') }}</text>
      <text x="133" y="438" class="tag c">{{ L('inside the drive, the kernel cannot reorder', '进了设备，内核就无法重排') }}</text>
    </g>
    <g :class="part('kyber')">
      <rect x="40" y="398" width="186" height="24" rx="3" class="lane" />
      <rect x="196" y="401" width="26" height="18" rx="2" class="p1" />
      <text x="209" y="414" class="tag c w">B</text>
      <rect x="110" y="401" width="82" height="18" rx="2" class="p0" />
      <text x="151" y="414" class="tag c w">A</text>
      <g v-for="i in 3" :key="i">
        <rect :x="278 + (i - 1) * 12" y="406" width="10" height="10" rx="1" class="p0" />
      </g>
      <text x="296" y="438" class="tag c">{{ L('a few in flight', '在途的只有几个') }}</text>
      <text x="40" y="438" class="tag">{{ L('Kyber limits what is in the drive;', 'Kyber 限制设备里的请求数；') }}</text>
      <text x="40" y="450" class="tag">{{ L('targets: reads 2 ms, writes 10 ms', '目标：读 2 ms、写 10 ms') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.rule {
  stroke: var(--rule);
  stroke-width: 1;
}
.head {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--muted);
  transition: fill 0.3s;
}
.head.now {
  fill: var(--ink);
}
.lane {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.lost {
  fill: none;
  stroke: var(--p3);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}
.idle {
  stroke-dasharray: 4 3;
}
text.w {
  fill: #fff;
  font-weight: 600;
}
text.tiny-x {
  font-size: 9px;
}
.lit .lane {
  stroke: var(--accent);
  stroke-width: 2;
}
</style>
