<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import GuardDemo from './GuardDemo.vue'

/**
 * The running figure of the bounds article: code making one access, the check that decides it
 * (and the trap it raises), the memory the bound fences off, and where the bound is kept. These
 * are the article's final table drawn as one machine: each state changes what the fence covers,
 * who checks, and where an out-of-range access is stopped. No motion.
 */
const props = defineProps<DrawingProps>()

const ALL = ['code', 'check', 'trap', 'mem', 'region', 'lives', 'when', 'ok', 'oob']
const SHOW: Record<string, string[]> = {
  overview: ALL,
  mmu: ALL,
  inside: ['mem', 'region', 'pages'],
  sfi: ['code', 'check', 'mem', 'region', 'lives', 'when', 'ok', 'oob'],
  nacl32: ALL,
  nacl64: [...ALL, 'guards'],
  wasm: ALL,
  guard: [...ALL, 'reserve'],
  memory64: ALL,
  ebpf: ALL,
  mpx: [...ALL, 'objects'],
  cheri: [...ALL, 'objects', 'heapcap'],
  table: ['mem', 'region', 'objects', 'scale'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 296)

type Info = {
  who: [string, string]
  code: string
  check: [string, string]
  checkSub?: [string, string]
  trap: [string, string]
  mem: [string, string]
  region: [string, string]
  bound: [string, string]
  lives: [string, string][]
  when: [string, string]
  /** where an out-of-range access is stopped */
  stop: 'check' | 'guard' | 'mask' | 'verify'
}
const INFO: Record<string, Info> = {
  overview: {
    who: ['Wasm module', 'Wasm 模块'],
    code: 'load memory[i + offset]',
    check: ['i + offset + N/8 > length?', 'i + offset + N/8 > 长度？'],
    checkSub: ['the spec’s check, in effect', '规范里的检查，大意如此'],
    trap: ['trap', '陷入'],
    mem: ['memory', '内存'],
    region: ['the module’s memory', '模块的内存'],
    bound: ['length', '长度'],
    lives: [['the memory’s length', '内存的长度']],
    when: ['checked on every access', '每次访问都检查'],
    stop: 'check',
  },
  mmu: {
    who: ['Process', '进程'],
    code: 'load va',
    check: ['MMU: va ≥ bounds?', 'MMU：va ≥ 界限？'],
    checkSub: ['if not: pa = base + va', '否则：pa = 基址 + va'],
    trap: ['exception', '异常'],
    mem: ['physical memory', '物理内存'],
    region: ['the process', '进程'],
    bound: ['bounds', '界限'],
    lives: [
      ['base register', '基址寄存器'],
      ['bounds register', '界限寄存器'],
    ],
    when: ['hardware · every access', '硬件 · 每次访问'],
    stop: 'check',
  },
  sfi: {
    who: ['Untrusted code', '不受信任的代码'],
    code: 'store [addr]',
    check: ['inserted by the compiler', '编译器插入的指令'],
    checkSub: ['mask the top bits of addr', '屏蔽 addr 的高位'],
    trap: ['', ''],
    mem: ['one address space', '同一个地址空间'],
    region: ['sandbox', '沙箱'],
    bound: ['region', '区域'],
    lives: [['the mask in the rewritten code', '改写后代码里的掩码']],
    when: ['software · every store and jump', '软件 · 每次存储和跳转'],
    stop: 'mask',
  },
  nacl32: {
    who: ['NaCl module', 'NaCl 模块'],
    code: 'load [addr]',
    check: ['x86-32 segment limit', 'x86-32 段界限'],
    checkSub: ['checked by the hardware', '由硬件检查'],
    trap: ['fault', '错误'],
    mem: ['the host’s address space', '宿主地址空间'],
    region: ['sandbox', '沙箱'],
    bound: ['segment', '段'],
    lives: [['segment descriptor: base, limit', '段描述符：基址、界限']],
    when: ['hardware · every access', '硬件 · 每次访问'],
    stop: 'check',
  },
  nacl64: {
    who: ['NaCl module', 'NaCl 模块'],
    code: 'load [r15 + offset]',
    check: ['no limit check', '没有界限检查'],
    checkSub: ['address = r15 + 32-bit offset', '地址 = r15 + 32 位偏移'],
    trap: ['fault', '错误'],
    mem: ['the host’s address space', '宿主地址空间'],
    region: ['4 GB, aligned', '4 GB，对齐'],
    bound: ['4 GB', '4 GB'],
    lives: [
      ['r15: base', 'r15：基址'],
      ['page table: guards unmapped', '页表：保护区未映射'],
    ],
    when: ['hardware · page fault', '硬件 · 页错误'],
    stop: 'guard',
  },
  wasm: {
    who: ['Wasm module', 'Wasm 模块'],
    code: 'load memory[i + 16]',
    check: ['cmp t, mem_size · ja trap', 'cmp t, mem_size · ja trap'],
    checkSub: ['(a) explicit check', '(a) 显式检查'],
    trap: ['trap', '陷入'],
    mem: ['host address space', '宿主地址空间'],
    region: ['linear memory', '线性内存'],
    bound: ['size', '大小'],
    lives: [
      ['engine: mem_base', '引擎：mem_base'],
      ['engine: mem_size', '引擎：mem_size'],
    ],
    when: ['compiled compare · every access', '编译出的比较 · 每次访问'],
    stop: 'check',
  },
  guard: {
    who: ['Wasm module', 'Wasm 模块'],
    code: 'load memory[i + 16]',
    check: ['no compare, no branch', '不比较，不分支'],
    checkSub: ['(b) guard region', '(b) 保护区'],
    trap: ['trap', '陷入'],
    mem: ['host address space', '宿主地址空间'],
    region: ['size', 'size'],
    bound: ['', ''],
    lives: [['page table: only the first size bytes accessible', '页表：只有前 size 个字节可访问']],
    when: ['hardware · page fault → signal → trap', '硬件 · 页错误 → 信号 → 陷入'],
    stop: 'guard',
  },
  memory64: {
    who: ['Wasm module', 'Wasm 模块'],
    code: 'load memory[i + 16]',
    check: ['cmp t, mem_size · ja trap', 'cmp t, mem_size · ja trap'],
    checkSub: ['64-bit index: always checked', '64 位下标：总要检查'],
    trap: ['trap', '陷入'],
    mem: ['host address space', '宿主地址空间'],
    region: ['memory64', 'memory64'],
    bound: ['size (web: ≤ 16 GB)', '大小（Web 上 ≤ 16 GB）'],
    lives: [['engine: mem_size', '引擎：mem_size']],
    when: ['compiled compare · every access', '编译出的比较 · 每次访问'],
    stop: 'check',
  },
  ebpf: {
    who: ['eBPF program', 'eBPF 程序'],
    code: 'load 2 bytes at r3 + 12',
    check: ['verifier: within r3 + 14?', '校验器：在 r3 + 14 之内？'],
    checkSub: ['proved once, before loading', '加载前证明一次'],
    trap: ['rejected', '拒绝加载'],
    mem: ['kernel address space', '内核地址空间'],
    region: ['packet', '数据包'],
    bound: ['14 bytes proved safe', '已证明安全的 14 字节'],
    lives: [['verifier: r5 = r3 + 14, checked ≤ data_end', '校验器：r5 = r3 + 14，已比较 ≤ data_end']],
    when: ['kernel verifier · once, at load time', '内核校验器 · 加载时一次'],
    stop: 'verify',
  },
  mpx: {
    who: ['C program', 'C 程序'],
    code: 'store p[i]',
    check: ['bndcl / bndcu', 'bndcl / bndcu'],
    checkSub: ['compiled check instructions', '编译出的检查指令'],
    trap: ['fault', '错误'],
    mem: ['heap', '堆'],
    region: ['', ''],
    bound: ['p’s bounds', 'p 的界限'],
    lives: [
      ['bnd0–bnd3', 'bnd0–bnd3'],
      ['directory → bounds tables', '界限目录 → 界限表'],
    ],
    when: ['only where instrumented', '只在插桩的代码里'],
    stop: 'check',
  },
  cheri: {
    who: ['C program', 'C 程序'],
    code: 'store p[i]',
    check: ['hardware: bounds, permissions, tag', '硬件：界限、权限、标签'],
    checkSub: ['on every use of a capability', '每次使用能力时'],
    trap: ['fault', '错误'],
    mem: ['heap', '堆'],
    region: ['', ''],
    bound: ['p: from malloc', 'p：malloc 返回的'],
    lives: [],
    when: ['hardware · every access', '硬件 · 每次访问'],
    stop: 'check',
  },
}
const info = computed<Info>(() => INFO[props.state] ?? INFO.overview)
const T = (p: [string, string]) => L(p[0], p[1])
const st = computed(() => props.state)

/** the region the bound fences off */
const region = computed(() => {
  if (st.value === 'guard') return { x: 110, w: 40 }
  if (st.value === 'ebpf') return { x: 120, w: 140 }
  return { x: 110, w: 120 }
})
/** where an in-bounds access lands */
const okX = computed(() => (shown.value.has('objects') ? 174 : st.value === 'guard' ? 130 : st.value === 'ebpf' ? 150 : 150))
/** the boxes that hold the bound, spread across the row */
const livesBoxes = computed(() => {
  const n = info.value.lives.length
  const gap = 8
  const w = n ? (328 - gap * (n - 1)) / n : 0
  return info.value.lives.map((t, i) => ({ x: 16 + i * (w + gap), w, t }))
})
</script>

<template>
  <GuardDemo v-if="demo && state === 'guard'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('An access, the check on it, and the region its bound fences off', '一次访问、对它的检查，以及界限圈出的区域')">
    <defs>
      <marker id="br-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="br-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head-bad" />
      </marker>
      <pattern id="br-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="5" class="hatch-line" />
      </pattern>
    </defs>

    <!-- the code making the access -->
    <g :class="part('code')">
      <rect x="8" y="8" width="344" height="42" rx="6" class="box strong" />
      <text x="18" y="33" class="lbl">{{ T(info.who) }}</text>
      <text x="342" y="33" class="code end">{{ info.code }}</text>
    </g>

    <!-- the check, and what it raises -->
    <g :class="part('check')">
      <path d="M120,50 L120,68" class="call" marker-end="url(#br-arrow)" />
      <rect x="8" y="70" width="262" height="40" rx="5" class="box gate" :class="{ none: info.stop === 'guard' }" />
      <text x="139" y="87" class="lbl c" :class="{ 'code-lbl': st === 'wasm' || st === 'memory64' || st === 'mpx' }">{{ T(info.check) }}</text>
      <text v-if="info.checkSub" x="139" y="102" class="sub c">{{ T(info.checkSub) }}</text>
    </g>
    <g :class="part('trap')">
      <rect x="284" y="70" width="68" height="40" rx="5" class="box trapbox" />
      <text x="318" y="94" class="lbl c bad-text">{{ T(info.trap) }}</text>
    </g>

    <!-- an in-bounds access goes through -->
    <g :class="part('ok')">
      <path :d="`M120,110 C120,128 ${okX},126 ${okX},144`" class="call" marker-end="url(#br-arrow)" />
    </g>
    <!-- memory, and the region the bound fences off -->
    <g :class="part('mem')">
      <text v-if="st !== 'inside'" x="16" y="140" class="tag">{{ T(info.mem) }}</text>
      <rect x="16" y="146" width="328" height="36" rx="3" class="space" />
    </g>
    <g :class="part('region')">
      <rect :x="region.x" y="146" :width="region.w" height="36" rx="2" class="region" />
      <text v-if="!shown.has('objects') && st !== 'inside' && st !== 'table'" :x="st === 'ebpf' ? 225 : region.x + region.w / 2" y="168" class="sub c on-region">{{ T(info.region) }}</text>
      <template v-if="info.bound[0] && !shown.has('objects') && !['inside', 'table', 'ebpf'].includes(st)">
        <path :d="`M${region.x},188 L${region.x},192 L${region.x + region.w},192 L${region.x + region.w},188`" class="bracket" />
        <text :x="region.x + region.w / 2" y="204" class="tag c">{{ T(info.bound) }}</text>
      </template>
      <template v-if="st === 'mmu' || st === 'wasm' || st === 'memory64'">
        <text :x="region.x" y="216" class="tag c">{{ L('base', '基址') }}</text>
      </template>
      <template v-if="st === 'ebpf'">
        <text x="120" y="216" class="code c small">data</text>
        <text x="260" y="216" class="code c small">data_end</text>
        <path d="M120,188 L120,192 L190,192 L190,188" class="bracket hi" />
        <text x="155" y="204" class="tag hi c">{{ T(info.bound) }}</text>
        <line x1="190" y1="146" x2="190" y2="182" class="mark" />
      </template>
    </g>

    <!-- paging under the fence -->
    <g :class="part('pages')">
      <line v-for="i in 9" :key="'pg' + i" :x1="16 + i * 32.8" y1="146" :x2="16 + i * 32.8" y2="182" class="page-line" />
      <text x="170" y="204" class="tag c">{{ L('pages: the page table decides which are backed', '页：由页表决定哪些有内存撑着') }}</text>
      <text x="170" y="168" class="sub c on-region">{{ L('one region, one comparison', '一块区域，一次比较') }}</text>
      <text x="16" y="140" class="tag">{{ L('an address space managed by paging', '由分页管理的地址空间') }}</text>
    </g>

    <!-- NaCl x86-64: unmapped guards on both sides -->
    <g :class="part('guards')">
      <rect x="66" y="146" width="44" height="36" rx="2" fill="url(#br-hatch)" class="guard" />
      <rect x="230" y="146" width="44" height="36" rx="2" fill="url(#br-hatch)" class="guard" />
      <text x="88" y="216" class="tag c">{{ L('40 GB unmapped', '40 GB 未映射') }}</text>
      <text x="252" y="216" class="tag c">{{ L('40 GB unmapped', '40 GB 未映射') }}</text>
    </g>

    <!-- Wasmtime: a 4 GiB reservation and a 32 MiB guard -->
    <g :class="part('reserve')">
      <rect x="150" y="146" width="100" height="36" rx="2" class="reserved" />
      <rect x="250" y="146" width="32" height="36" rx="2" fill="url(#br-hatch)" class="guard" />
      <path d="M110,188 L110,192 L250,192 L250,188" class="bracket" />
      <text x="180" y="204" class="tag c">{{ L('4 GiB reserved', '预留 4 GiB') }}</text>
      <text x="266" y="216" class="tag c">{{ L('32 MiB guard', '32 MiB 保护区') }}</text>
    </g>

    <!-- objects inside the region: a bound per pointer -->
    <g :class="part('objects')">
      <rect x="114" y="150" width="34" height="28" rx="2" class="obj" />
      <rect x="152" y="150" width="44" height="28" rx="2" class="obj mine" />
      <rect x="200" y="150" width="26" height="28" rx="2" class="obj" />
      <text x="174" y="168" class="code c small">obj</text>
      <template v-if="st !== 'table'">
        <path d="M152,188 L152,192 L196,192 L196,188" class="bracket hi" />
        <text x="174" y="204" class="tag hi c">{{ T(info.bound) }}</text>
      </template>
    </g>
    <g :class="part('heapcap')">
      <path d="M110,144 L110,140 L230,140 L230,144" class="bracket" />
      <text x="290" y="140" class="tag c">{{ L('heap capability', '整个堆的能力') }}</text>
      <path d="M248,138 L234,141" class="link" />
    </g>

    <!-- an out-of-range access is stopped -->
    <g :class="part('oob')">
      <template v-if="info.stop === 'check' || info.stop === 'verify'">
        <path d="M270,90 L282,90" class="danger" marker-end="url(#br-arrow-bad)" />
      </template>
      <template v-else-if="info.stop === 'guard'">
        <path :d="st === 'guard' ? 'M200,110 L200,144' : 'M240,110 L250,144'" class="danger" marker-end="url(#br-arrow-bad)" />
        <text :x="st === 'guard' ? 200 : 250" y="168" class="bad-text c big">✕</text>
        <path :d="st === 'guard' ? 'M214,156 C260,150 318,140 318,112' : 'M262,156 C300,150 318,140 318,112'" class="danger dashed" marker-end="url(#br-arrow-bad)" />
        <text x="322" y="132" class="tag bad-text">{{ L('fault', '页错误') }}</text>
      </template>
      <template v-else>
        <path d="M220,110 C226,124 214,130 212,144" class="call" marker-end="url(#br-arrow)" />
        <text x="226" y="128" class="tag">{{ L('masked: lands inside', '屏蔽后：落在区域内') }}</text>
      </template>
    </g>

    <!-- coarse and fine boundaries -->
    <g :class="part('scale')">
      <path d="M110,188 L110,192 L230,192 L230,188" class="bracket" />
      <text x="170" y="204" class="tag c">{{ L('a region: cheap to check', '一块区域：检查便宜') }}</text>
      <path d="M152,142 L152,138 L196,138 L196,142" class="bracket hi" />
      <text x="174" y="132" class="tag hi c">{{ L('an object: catches more bugs', '一个对象：抓到更多漏洞') }}</text>
      <path d="M24,250 L336,250" class="call" marker-start="url(#br-arrow)" marker-end="url(#br-arrow)" />
      <circle v-for="x in [60, 170, 290]" :key="x" :cx="x" cy="250" r="3.5" class="axisdot" />
      <text x="60" y="240" class="tag hi c">{{ L('a process', '整个进程') }}</text>
      <text x="60" y="266" class="tag c">{{ L('book’s MMU', '书中的 MMU') }}</text>
      <text x="170" y="240" class="tag hi c">{{ L('a sandbox', '一个沙箱') }}</text>
      <text x="170" y="266" class="tag c">NaCl · Wasm</text>
      <text x="290" y="240" class="tag hi c">{{ L('each object or pointer', '每个对象或指针') }}</text>
      <text x="290" y="266" class="tag c">eBPF · MPX · CHERI</text>
      <text x="16" y="288" class="tag">{{ L('← cheaper to check', '← 检查更便宜') }}</text>
      <text x="344" y="288" class="tag end">{{ L('catches more bugs →', '抓到更多漏洞 →') }}</text>
    </g>

    <!-- where the bound is kept -->
    <g :class="part('lives')">
      <text x="16" y="228" class="tag">{{ L('where the bound is kept', '界限存放在') }}</text>
      <g v-for="b in livesBoxes" :key="b.t[0]">
        <rect :x="b.x" y="234" :width="b.w" height="26" rx="4" class="box floor" />
        <text :x="b.x + b.w / 2" y="251" class="sub c ink">{{ T(b.t) }}</text>
      </g>
      <!-- CHERI: the bound travels inside the 128-bit capability -->
      <template v-if="st === 'cheri'">
        <rect x="16" y="234" width="104" height="26" rx="3" class="field" />
        <text x="68" y="251" class="sub c ink">{{ L('address · 64', '地址 · 64 位') }}</text>
        <rect x="120" y="234" width="70" height="26" rx="3" class="field hi" />
        <text x="155" y="251" class="sub c ink">{{ L('bounds', '界限') }}</text>
        <rect x="190" y="234" width="64" height="26" rx="3" class="field" />
        <text x="222" y="251" class="sub c ink">{{ L('perms', '权限') }}</text>
        <rect x="254" y="234" width="50" height="26" rx="3" class="field" />
        <text x="279" y="251" class="sub c ink">{{ L('type', '类型') }}</text>
        <rect x="314" y="234" width="30" height="26" rx="3" class="tagbit" />
        <text x="329" y="251" class="sub c on-fill">tag</text>
        <text x="160" y="272" class="tag c">{{ L('one 128-bit capability', '一个 128 位能力') }}</text>
        <text x="329" y="272" class="tag c">{{ L('out of band', '带外') }}</text>
      </template>
    </g>
    <g :class="part('when')">
      <text x="180" y="288" class="tag hi c">{{ T(info.when) }}</text>
    </g>
  </svg>
</template>

<style scoped>
.head-bad {
  fill: var(--p3);
}
.danger.dashed {
  stroke-dasharray: 4 3;
}
.box.gate.none {
  fill: none;
  stroke-dasharray: 4 3;
}
.trapbox {
  stroke: var(--p3);
}
.code-lbl {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 10.5px;
}
.space {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.region {
  fill: var(--p0);
  fill-opacity: 0.22;
  stroke: var(--p0);
  stroke-width: 1.4;
}
.lit .region {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.on-region {
  fill: var(--ink);
}
.reserved {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-dasharray: 3 2;
}
.guard {
  stroke: var(--warn);
  stroke-width: 1;
}
.hatch-bg {
  fill: var(--bg-elev);
}
.hatch-line {
  stroke: var(--warn);
  stroke-width: 1.3;
}
.bracket {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
}
.bracket.hi {
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.mark {
  stroke: var(--ok);
  stroke-width: 2;
}
.page-line {
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.obj {
  fill: var(--bg-elev);
  stroke: var(--p0);
  stroke-width: 1;
}
.obj.mine {
  stroke-width: 2;
}
.small {
  font-size: 9px;
}
.ink {
  fill: var(--ink-2);
}
.on-fill {
  fill: #fff;
}
.field {
  fill: var(--bg-sunk);
  stroke: var(--ink-2);
  stroke-width: 1;
}
.field.hi {
  fill: var(--accent-soft);
}
.axisdot {
  fill: var(--ink-2);
}
.tagbit {
  fill: var(--ink-2);
}
</style>
