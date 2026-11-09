<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import AsanDemo from './AsanDemo.vue'

/**
 * The running figure of the memory-safety article: a C or C++ program’s pointers, the heap blocks
 * they point to, the allocator below them and the OS’s pages under everything. The bug families
 * are drawn on the heap; each defence adds its check where it acts (shadow memory, the allocator,
 * tags, the compiler). No motion: states only change what is drawn.
 */
const props = defineProps<DrawingProps>()

const BASE = ['program', 'heap', 'objA', 'objB', 'objC', 'alloc', 'freelist', 'os']
const PTRS = ['chip-s', 'chip-p', 'chip-c']
const SHOW: Record<string, string[]> = {
  overview: [...BASE, ...PTRS],
  families: [...BASE, ...PTRS, 'chip-q', 'leak', 'bugs', 'overflow'],
  padding: [...BASE, 'chip-p', 'overflow', 'padding'],
  reuse: ['program', 'heap', 'objA', 'objB', 'objC', 'chip-s', 'chip-msg', 'alloc', 'freelist', 'reuse', 'os'],
  memcheck: [...BASE, ...PTRS, 'memcheck'],
  asan: [...BASE, ...PTRS, 'shadow', 'overflow', 'caught', 'quarantine'],
  msan: [...BASE, ...PTRS, 'shadow'],
  harden: [...BASE, ...PTRS, 'freelist', 'headers', 'tkey', 'miracle', 'quarantine', 'mte'],
  rust: [...BASE, 'chip-s', 'chip-p', 'gate', 'rustnotes'],
  android: [...BASE, ...PTRS, 'split', 'unsafe', 'gate'],
  bends: [...BASE, 'split', 'unsafe', 'gate', 'bends'],
  levels: [...BASE, ...PTRS, 'levels'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 356)

const st = computed(() => props.state)
/** chunk A: a live session, a freed block, or the session’s chunk reused for msg */
const a = computed(() =>
  st.value === 'reuse' ? 'reused' : ['families', 'asan', 'harden', 'rust'].includes(st.value) ? 'freed' : 'live',
)
/** s is a dangling pointer, drawn red, where it reaches a freed block nothing defends */
const sBad = computed(() => a.value === 'freed' && st.value !== 'rust')
const msan = computed(() => st.value === 'msan')
/** the program is split into old C/C++ and new Rust */
const split = computed(() => shown.value.has('split'))
/** the compiler gate covers the whole program (Rust) or only its new part */
const gateX = computed(() => (split.value ? 236 : 8))
</script>

<template>
  <AsanDemo v-if="demo && state === 'asan'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A program’s pointers, its heap, the allocator and the OS', '程序的指针、堆、分配器和操作系统')">
    <defs>
      <marker id="ms-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="ms-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head-bad" />
      </marker>
      <pattern id="ms-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="hatch-line" />
      </pattern>
      <pattern id="ms-poison" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" class="poison-bg" />
        <line x1="0" y1="0" x2="0" y2="6" class="poison-line" />
      </pattern>
    </defs>

    <!-- Valgrind: the whole program on a synthetic CPU -->
    <g :class="part('memcheck')">
      <rect x="3" y="3" width="354" height="157" rx="9" class="outline warn" />
      <text x="180" y="170" class="tag hi c">{{ L('Memcheck: the program runs on a synthetic CPU', 'Memcheck：程序跑在一颗合成的 CPU 上') }}</text>
      <text x="180" y="182" class="tag c">{{ L('tracks every byte · 20–30× slower', '追踪每个字节 · 慢 20–30 倍') }}</text>
    </g>

    <!-- the program and its pointer variables -->
    <g :class="part('program')">
      <rect x="8" y="8" width="344" height="46" rx="6" class="box strong" />
      <text v-if="!split" x="18" y="24" class="lbl">{{ st === 'rust' ? L('Program (Rust)', '程序（Rust）') : L('Program', '程序') }}</text>
      <text v-if="!split" x="342" y="24" class="sub end">{{ st === 'rust' ? '' : L('C or C++ · pointers', 'C 或 C++ · 指针') }}</text>
    </g>
    <g :class="part('split')">
      <line x1="236" y1="8" x2="236" y2="54" class="divider" />
      <text x="18" y="24" class="lbl">{{ L('C / C++: old code', 'C / C++：老代码') }}</text>
      <text x="244" y="24" class="lbl">{{ L('Rust: new', 'Rust：新代码') }}</text>
    </g>
    <g :class="part('unsafe')">
      <rect x="290" y="32" width="54" height="16" rx="3" fill="url(#ms-hatch)" class="unsafe" />
      <text x="317" y="44" class="code c small">unsafe</text>
    </g>

    <!-- the Rust compiler between the code and the memory -->
    <g :class="part('gate')">
      <rect :x="gateX" y="57" :width="352 - gateX" height="22" rx="4" class="box gate" />
      <text x="344" y="72" class="sub end">{{ split ? L('compiler checks', '编译器检查') : L('compiler: ownership · lifetimes', '编译器：所有权与生命周期') }}</text>
    </g>

    <!-- pointers -->
    <g :class="part('chip-s')">
      <rect x="45" y="30" width="26" height="18" rx="3" class="chip" />
      <text x="58" y="43" class="code c">s</text>
      <path :d="st === 'rust' ? 'M58,48 L58,62' : 'M58,48 L58,102'" :class="sBad ? 'danger' : 'call'" :marker-end="st === 'rust' ? undefined : sBad ? 'url(#ms-arrow-bad)' : 'url(#ms-arrow)'" />
    </g>
    <g :class="part('chip-msg')">
      <rect x="76" y="30" width="26" height="18" rx="3" class="chip" />
      <text x="89" y="43" class="code c">msg</text>
      <path d="M89,48 L89,102" class="call" marker-end="url(#ms-arrow)" />
    </g>
    <g :class="part('chip-p')">
      <rect x="125" y="30" width="26" height="18" rx="3" class="chip" />
      <text x="138" y="43" class="code c">p</text>
      <path d="M138,48 L138,102" class="call" marker-end="url(#ms-arrow)" />
    </g>
    <g :class="part('chip-c')">
      <rect x="199" y="30" width="26" height="18" rx="3" class="chip" />
      <text x="212" y="43" class="code c">c</text>
      <path d="M212,48 L212,102" class="call" marker-end="url(#ms-arrow)" />
    </g>
    <g :class="part('chip-q')">
      <rect x="242" y="30" width="26" height="18" rx="3" class="chip" />
      <text x="255" y="43" class="code c">q</text>
      <path d="M255,48 L255,112" class="danger dashed" />
      <text x="255" y="128" class="bad-text c big">?</text>
      <text x="262" y="80" class="tag bad-text">{{ L('wild: never set', '野指针：从未赋值') }}</text>
    </g>

    <!-- the heap and its blocks -->
    <g :class="part('heap')">
      <rect x="8" y="94" width="344" height="60" rx="7" class="outline" />
      <text x="14" y="90" class="tag">{{ L('heap', '堆') }}</text>
    </g>

    <!-- chunk A: the session object -->
    <g :class="part('objA')">
      <rect
        x="16"
        y="104"
        width="84"
        height="40"
        rx="4"
        class="box"
        :class="{ freed: a === 'freed' }"
        :fill="st === 'harden' ? 'url(#ms-poison)' : undefined"
      />
      <template v-if="a === 'live'">
        <text x="58" y="121" class="lbl c">session</text>
        <text x="58" y="136" class="sub c">on_close · name</text>
      </template>
      <template v-else-if="a === 'reused'">
        <text x="58" y="121" class="lbl c">msg</text>
        <text x="58" y="136" class="sub c">{{ L('attacker’s data', '攻击者的数据') }}</text>
      </template>
      <template v-else>
        <text x="58" y="121" class="lbl c" :class="{ faded: st !== 'harden' }">{{ st === 'rust' ? L('dropped', '已 drop') : L('freed', '已释放') }}</text>
        <text x="58" y="136" class="sub c">{{ st === 'harden' ? L('poisoned', '已下毒') : 'session' }}</text>
      </template>
      <!-- granule boundary (MTE): 32 bytes are two 16-byte granules -->
      <line v-if="st === 'harden'" x1="58" y1="104" x2="58" y2="110" class="tick-line" />
    </g>

    <!-- chunk B: the book's 5-byte buffer -->
    <g :class="part('objB')">
      <rect x="112" y="104" width="52" height="40" rx="4" class="box" />
      <text x="138" y="121" class="code c">hello</text>
      <text x="138" y="136" class="sub c">{{ L('5 bytes', '5 字节') }}</text>
    </g>

    <!-- chunk C: a new block, never written -->
    <g :class="part('objC')">
      <rect x="176" y="104" width="72" height="40" rx="4" class="box" :fill="msan ? 'url(#ms-hatch)' : undefined" />
      <text x="212" y="121" class="lbl c">{{ L('block', '新块') }}</text>
      <text x="212" y="136" class="sub c">{{ shown.has('bugs') || msan ? L('old data', '旧数据') : L('16 bytes', '16 字节') }}</text>
    </g>

    <!-- the leaked block: nothing points to it -->
    <g :class="part('leak')">
      <rect x="262" y="104" width="82" height="40" rx="4" class="box" />
      <text x="303" y="121" class="lbl c">{{ L('lost block', '丢失的块') }}</text>
      <text x="303" y="136" class="sub c">{{ L('no pointer', '无指针指向') }}</text>
    </g>

    <!-- the byte p writes one past its block -->
    <g :class="part('overflow')">
      <rect x="165" y="110" width="9" height="28" rx="1.5" class="p3" />
      <template v-if="shown.has('padding')">
        <path d="M170,140 C176,150 188,150 192,145" class="danger dashed" marker-end="url(#ms-arrow-bad)" />
      </template>
    </g>

    <!-- the four families, and the leak -->
    <g :class="part('bugs')">
      <text x="58" y="168" class="tag hi c">{{ L('temporal', '时间错误') }}</text>
      <text x="58" y="180" class="tag c">{{ L('use after free', '释放后使用') }}</text>
      <text x="140" y="168" class="tag hi c">{{ L('spatial', '空间错误') }}</text>
      <text x="140" y="180" class="tag c">{{ L('overflow', '越界写入') }}</text>
      <text x="212" y="168" class="tag hi c">{{ L('uninitialized', '未初始化') }}</text>
      <text x="212" y="180" class="tag c">{{ L('reads leftovers', '读到旧数据') }}</text>
      <text x="303" y="168" class="tag hi c">{{ L('leak', '泄露') }}</text>
      <text x="303" y="180" class="tag c">{{ L('not counted', '不算安全漏洞') }}</text>
    </g>

    <!-- padding: in testing the byte is harmless -->
    <g :class="part('padding')">
      <text x="170" y="170" class="tag c">{{ L('testing: lands in padding, no harm', '测试时：落在填充区，无事发生') }}</text>
      <text x="170" y="183" class="tag bad-text c">{{ L('a chosen heap layout: lands on its neighbour', '精心布置的堆：落在邻居身上') }}</text>
    </g>

    <!-- ASan / MSan shadow memory -->
    <g :class="part('shadow')">
      <text x="14" y="172" class="tag">{{ msan ? L('MSan shadow: 1 bit per bit, marks what was never written', 'MSan 影子：每位 1 个影子位，标出从未写过的位') : L('shadow memory: 1 byte per 8 bytes of heap', '影子内存：每 8 字节堆对应 1 字节') }}</text>
      <template v-if="!msan">
        <g v-for="i in 4" :key="'sa' + i">
          <rect :x="16 + (i - 1) * 21" y="178" width="19" height="16" rx="2" :class="a === 'freed' ? 'sh-bad' : 'sh'" />
          <text :x="25.5 + (i - 1) * 21" y="190" class="code c small" :class="{ 'on-fill': a === 'freed' }">{{ a === 'freed' ? '−' : '0' }}</text>
        </g>
        <rect x="101" y="178" width="10" height="16" rx="2" class="sh-bad" />
        <rect x="112" y="178" width="52" height="16" rx="2" class="sh" />
        <text x="138" y="190" class="code c small">5</text>
        <rect x="165" y="178" width="10" height="16" rx="2" class="sh-bad" />
        <rect x="176" y="178" width="35" height="16" rx="2" class="sh" />
        <text x="193.5" y="190" class="code c small">0</text>
        <rect x="213" y="178" width="35" height="16" rx="2" class="sh" />
        <text x="230.5" y="190" class="code c small">0</text>
        <rect x="249" y="178" width="10" height="16" rx="2" class="sh-bad" />
        <text x="266" y="190" class="tag">{{ L('− : redzone, freed', '− ：红区、已释放') }}</text>
      </template>
      <template v-else>
        <rect x="16" y="178" width="84" height="16" rx="2" class="sh" />
        <rect x="112" y="178" width="52" height="16" rx="2" class="sh" />
        <rect x="176" y="178" width="72" height="16" rx="2" class="sh-un" />
        <text x="212" y="190" class="tag c on-fill">{{ L('never written', '从未写过') }}</text>
      </template>
    </g>
    <!-- ASan stops the overflow at the redzone -->
    <g :class="part('caught')">
      <text x="170" y="103" class="bad-text c big">✕</text>
      <text x="68" y="100" class="bad-text c big">✕</text>
    </g>

    <!-- hardening: chunk headers with checksums -->
    <g :class="part('headers')">
      <rect x="16" y="104" width="6" height="40" rx="1" class="hdr" />
      <rect x="112" y="104" width="6" height="40" rx="1" class="hdr" />
      <rect x="176" y="104" width="6" height="40" rx="1" class="hdr" />
      <text x="236" y="168" class="tag c">{{ L('Scudo: a checksum in each header', 'Scudo：每个块头里有校验和') }}</text>
    </g>

    <!-- MiraclePtr: a hidden count, poison, quarantine -->
    <g :class="part('miracle')">
      <rect x="14" y="95" width="38" height="14" rx="7" class="badge" />
      <text x="33" y="105" class="code c small on-fill">refs 1</text>
      <text x="58" y="168" class="tag c">{{ L('MiraclePtr: poison', 'MiraclePtr：毒值') }}</text>
    </g>

    <!-- MTE: tags on memory and pointers -->
    <g :class="part('mte')">
      <circle cx="79" cy="39" r="6.5" class="tagdot" />
      <text x="79" y="42" class="code c small on-fill">3</text>
      <circle cx="158" cy="39" r="6.5" class="tagdot" />
      <text x="158" y="42" class="code c small on-fill">5</text>
      <circle cx="232" cy="39" r="6.5" class="tagdot" />
      <text x="232" y="42" class="code c small on-fill">9</text>
      <circle cx="92" cy="104" r="6.5" class="tagdot bad" />
      <text x="92" y="107" class="code c small on-fill">7</text>
      <circle cx="156" cy="104" r="6.5" class="tagdot" />
      <text x="156" y="107" class="code c small on-fill">5</text>
      <circle cx="240" cy="104" r="6.5" class="tagdot" />
      <text x="240" y="107" class="code c small on-fill">9</text>
      <text x="58" y="180" class="tag bad-text c">{{ L('MTE: tag 3 ≠ 7', 'MTE：标签 3 ≠ 7') }}</text>
      <text x="236" y="180" class="tag c">{{ L('MTE: a tag per 16-byte granule', 'MTE：每 16 字节颗粒一个标签') }}</text>
    </g>

    <!-- Rust: a compile error and a run-time bounds check -->
    <g :class="part('rustnotes')">
      <text x="58" y="74" class="bad-text c big">✕</text>
      <text x="68" y="72" class="tag bad-text">{{ L('compile error', '编译错误') }}</text>
      <line x1="166" y1="100" x2="166" y2="148" class="stop" />
      <text x="58" y="170" class="tag c">{{ L('s outlives its value', 's 比它的值活得久') }}</text>
      <text x="212" y="170" class="tag c">{{ L('index out of bounds:', '越界索引：') }}</text>
      <text x="212" y="182" class="tag c">{{ L('the thread stops', '线程停下') }}</text>
    </g>

    <!-- the allocator -->
    <g :class="part('alloc')">
      <rect x="8" y="206" width="344" height="62" rx="6" class="box" />
      <text x="18" y="222" class="lbl">{{ L('Allocator', '分配器') }}</text>
      <text x="96" y="222" class="sub">{{ L('malloc / free', 'malloc / free') }}</text>
    </g>
    <g :class="part('freelist')">
      <text x="18" y="250" class="tag">tcache</text>
      <rect x="56" y="236" width="30" height="20" rx="3" class="box" :class="{ hot: st === 'reuse' }" />
            <path d="M86,246 L100,246" class="link solid" marker-end="url(#ms-arrow)" />
      <rect x="102" y="236" width="30" height="20" rx="3" class="box" />
      <path d="M132,246 L146,246" class="link solid" marker-end="url(#ms-arrow)" />
      <rect x="148" y="236" width="30" height="20" rx="3" class="box" />
      <text v-if="st !== 'harden'" x="186" y="250" class="tag">{{ L('last in, first out', '后进先出') }}</text>
    </g>
    <g :class="part('reuse')">
      <path d="M76,236 C84,222 84,196 50,148" class="call" marker-end="url(#ms-arrow)" />
      <text x="90" y="182" class="tag">{{ L('the next malloc of this size gets the same chunk', '下一次同样大小的 malloc 拿回同一块') }}</text>
    </g>
    <g :class="part('tkey')">
      <circle cx="86" cy="236" r="6" class="keydot" />
      <text x="86" y="239" class="code c small on-fill">k</text>
      <text x="186" y="250" class="tag bad-text">{{ L('2nd free: abort', '释放两次 → 中止') }}</text>
    </g>
    <g :class="part('quarantine')">
      <rect x="262" y="228" width="82" height="32" rx="4" class="outline" />
      <text x="303" y="224" class="tag c">{{ L('quarantine', '隔离区') }}</text>
      <rect x="276" y="236" width="54" height="18" rx="3" class="box freed" />
      <text x="303" y="249" class="code c small">session</text>
    </g>

    <!-- the OS: pages -->
    <g :class="part('os')">
      <rect x="8" y="284" width="344" height="46" rx="6" class="box floor" />
      <text x="18" y="300" class="lbl">{{ L('OS', '操作系统') }}</text>
      <text x="342" y="300" class="sub end">{{ L('pages, mapped by the page table', '页，由页表映射') }}</text>
      <rect v-for="i in 4" :key="'pg' + i" :x="16 + (i - 1) * 83" y="308" width="79" height="16" rx="2" class="page" />
      <text v-for="i in 4" :key="'pt' + i" :x="55.5 + (i - 1) * 83" y="320" class="tag c">{{ L('page', '页') }}</text>
    </g>

    <!-- the two levels -->
    <g :class="part('levels')">
      <text x="180" y="170" class="tag bad-text c">{{ L('object boundaries: nothing checks', '对象边界：没有任何检查') }}</text>
      <line x1="106" y1="98" x2="106" y2="150" class="unchecked" />
      <line x1="170" y1="98" x2="170" y2="150" class="unchecked" />
      <line x1="255" y1="98" x2="255" y2="150" class="unchecked" />
      <text x="180" y="346" class="tag hi c">{{ L('pages: the hardware checks every access', '页：硬件检查每一次访问') }}</text>
    </g>

    <!-- where each response stops -->
    <g :class="part('bends')">
      <rect x="286" y="29" width="62" height="22" rx="5" class="outline warn" />
      <text x="180" y="172" class="tag c">{{ L('sanitizers: only the paths that run', '消毒器：只看跑到的路径') }}</text>
      <text x="342" y="222" class="tag hi end">{{ L('hardening: probabilistic', '加固：概率性的') }}</text>
      <rect x="4" y="280" width="352" height="54" rx="8" class="outline warn" />
      <text x="180" y="346" class="tag hi c">{{ L('kernel, C library, drivers: still C', '内核、C 库、驱动：仍是 C') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.chip {
  fill: var(--bg-sunk);
  stroke: var(--ink-2);
  stroke-width: 1.1;
}
.lit .chip {
  stroke: var(--accent);
  stroke-width: 2;
}
.small {
  font-size: 9px;
}
.faded {
  fill: var(--muted);
}
.box.freed {
  fill: none;
  stroke-dasharray: 4 3;
}
.box.hot {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.danger.dashed {
  stroke-dasharray: 4 3;
}
.head-bad {
  fill: var(--p3);
}
.divider {
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch-line {
  stroke: var(--warn);
  stroke-width: 1.4;
}
.poison-bg {
  fill: var(--bg-elev);
}
.poison-line {
  stroke: var(--p3);
  stroke-width: 1.6;
}
.unsafe {
  stroke: var(--warn);
  stroke-width: 1;
}
.sh {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.sh-bad {
  fill: var(--p3);
}
.sh-un {
  fill: var(--warn);
}
.on-fill {
  fill: #fff;
}
.hdr {
  fill: var(--ink-2);
}
.badge {
  fill: var(--ink-2);
}
.tagdot {
  fill: var(--p2);
}
.tagdot.bad {
  fill: var(--p3);
}
.keydot {
  fill: var(--warn);
}
.stop {
  stroke: var(--ok);
  stroke-width: 3;
}
.unchecked {
  stroke: var(--p3);
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}
.tick-line {
  stroke: var(--muted);
  stroke-width: 1;
}
.page {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
</style>
