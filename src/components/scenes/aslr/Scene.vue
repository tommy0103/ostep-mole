<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'

/**
 * The running figure of the ASLR article: the same program started twice, as two virtual address
 * spaces side by side (high addresses at the top), with physical memory to the right. A state
 * moves the regions (that is the point of the article) and fills the right-hand column with what
 * the passage says about them.
 *
 * The kernel's offset is chosen at boot, so it is the same in both runs: only the next boot moves it.
 * Everything here stays at the article's level: where things are placed and what that costs an
 * attacker, not how an attack is carried out.
 */
const props = defineProps<DrawingProps>()

const RUNS = ['run1', 'run2', 'kernel', 'stack', 'vdso', 'libs', 'heap', 'prog']
const SHOW: Record<string, string[]> = {
  overview: [...RUNS, 'phys'],
  why: [...RUNS, 'pointer', 'notes'],
  guess: [...RUNS, 'wrong', 'notes'],
  regions: [...RUNS, 'notes'],
  virtual: [...RUNS, 'phys', 'links'],
  entropy: [...RUNS, 'range', 'notes'],
  pie: [...RUNS, 'landmark', 'notes'],
  kaslr: [...RUNS, 'window', 'notes'],
  kpti: [...RUNS, 'notes'],
  leak: [...RUNS, 'zoom'],
  fork: [...RUNS, 'notes'],
  hardware: [...RUNS, 'tlbbox'],
  debug: [...RUNS, 'notes'],
  replace: [...RUNS, 'canary', 'notes'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 430)
const st = computed(() => props.state)

type Pos = { stack: number; vdso: number; libs: number; heap: number; prog: number }
// y of each region's top edge; low addresses at the bottom
const FIXED: Pos = { stack: 72, vdso: 106, libs: 170, heap: 306, prog: 344 }
const RUN1: Pos = { stack: 78, vdso: 118, libs: 150, heap: 300, prog: 352 }
const RUN2: Pos = { stack: 96, vdso: 136, libs: 200, heap: 282, prog: 330 }
const H = { stack: 24, vdso: 12, libs: 44, heap: 24, prog: 30 }
const KERNEL_Y = 36

const layout = (run: number): Pos => {
  const s = st.value
  if (s === 'why' || s === 'debug') return FIXED
  if (s === 'fork') return RUN1
  const p = run === 0 ? RUN1 : RUN2
  // a program that is not position-independent loads at the same address every run
  if (s === 'pie') return { ...p, prog: FIXED.prog, heap: FIXED.heap }
  return p
}
const COLUMNS = [
  { run: 0, x: 60, id: 'run1', fill: 'r0' },
  { run: 1, x: 156, id: 'run2', fill: 'r1' },
]
const W = 74
const heading = (run: number) => {
  if (st.value === 'fork') return run === 0 ? L('parent', '父进程') : L('forked child', 'fork 出的子进程')
  return run === 0 ? L('run 1', '第 1 次运行') : L('run 2', '第 2 次运行')
}
const name = (r: keyof typeof H) =>
  ({ stack: L('stack', '栈'), vdso: 'vDSO', libs: L('libraries', '共享库'), heap: L('heap', '堆'), prog: L('program', '程序') })[r]
const REGIONS: (keyof typeof H)[] = ['stack', 'vdso', 'libs', 'heap', 'prog']
const off = computed(() => st.value === 'kpti')

// physical memory: frames of the two runs, scattered
const FRAMES = 'abkaxbaxkbxabxakbxabaxbkxabx'.split('').map((c, i) => ({
  c,
  x: i % 2 ? 322 : 292,
  y: 42 + Math.floor(i / 2) * 26,
}))
const LINKS = [
  { from: 'stack', to: 3 },
  { from: 'libs', to: 9 },
  { from: 'libs', to: 14 },
  { from: 'heap', to: 21 },
  { from: 'prog', to: 26 },
] as const
const linkPath = (l: (typeof LINKS)[number]) => {
  const y1 = RUN2[l.from] + H[l.from] / 2
  const f = FRAMES[l.to]
  return `M230,${y1} C256,${y1} 262,${f.y + 11} ${f.x},${f.y + 11}`
}

type Note = [number, string, string, ('hi' | 'bad')?]
const NOTES = computed<Note[]>(
  () =>
    (
      ({
        why: [
          [86, 'a pointer a memory', '内存错误能覆盖的'],
          [98, 'bug can overwrite', '一个指针'],
          [176, 'the C library: the', 'C 库：每台机器上', 'hi'],
          [188, 'same address on', '每个进程的地址', 'hi'],
          [200, 'every machine', '都一样', 'hi'],
        ],
        guess: [
          [78, 'a value aimed at', '瞄准第 1 次运行时'],
          [90, 'run 1’s library…', '库的地址……'],
          [190, 'in run 2 nothing', '第 2 次运行时，', 'bad'],
          [202, 'is mapped there:', '那里什么都没有：', 'bad'],
          [214, 'usually a crash', '进程通常直接崩溃', 'bad'],
        ],
        regions: [
          [50, 'kernel: KASLR', '内核：靠 KASLR'],
          [112, 'stack: yes', '栈：是'],
          [146, 'vDSO: yes', 'vDSO：是'],
          [226, 'mmap base: yes', 'mmap 基址：是'],
          [298, 'heap: at setting 2', '堆：设置为 2 时'],
          [349, 'program: only if PIE', '程序：仅当 PIE'],
        ],
        entropy: [
          [116, 'dots: where the mmap', '圆点：mmap 基址'],
          [128, 'base might land', '可能落在的位置'],
          [140, 'mmap base: 28 bits', 'mmap 基址：28 位', 'hi'],
          [152, 'of page-sized steps', '以页为步长'],
          [176, '2^28 × 4 KiB = 1 TiB', '2^28 × 4 KiB = 1 TiB'],
          [188, 'a guess: about 1 in', '随便一猜：约'],
          [200, '268 million', '2.68 亿分之一'],
          [232, '32-bit: 8 bits, 256', '32 位：8 位，256', 'hi'],
          [244, 'positions, tried one', '个位置，几分钟'],
          [256, 'by one in minutes', '就能逐个试完'],
          [278, '2 MiB alignment:', '按 2 MiB 对齐：'],
          [290, '512 times fewer', '位置少 512 倍'],
        ],
        pie: [
          [340, 'not PIE: built for', '非 PIE：为一个', 'hi'],
          [352, 'one fixed address,', '固定地址构建，', 'hi'],
          [364, 'a fixed landmark', '成了固定地标', 'hi'],
          [388, 'PIE: moves with', 'PIE：和其他部分'],
          [400, 'everything else', '一起移动'],
        ],
        kaslr: [
          [46, 'one random offset,', '启动时选定', 'hi'],
          [58, 'chosen at boot', '一个随机偏移', 'hi'],
          [82, 'dashed: where the', '虚线：下次启动'],
          [94, 'next boot may put it', '可能的位置'],
          [118, 'a small window and', '窗口小、对齐大，'],
          [130, 'large alignment:', '可选的位置'],
          [142, 'far fewer positions', '少得多'],
        ],
        kpti: [
          [46, 'user mode: almost', '用户态：内核', 'hi'],
          [58, 'no kernel mappings', '几乎不映射', 'hi'],
          [82, 'only entry and exit', '只留进出内核的'],
          [94, 'code stays mapped', '一小段代码'],
          [118, 'nothing left to time', '没有可测的了'],
        ],
        fork: [
          [86, 'fork() copies the', 'fork() 把布局', 'hi'],
          [98, 'layout as well', '也一起复制', 'hi'],
          [122, 'a new random layout', '新的随机布局'],
          [134, 'only comes at exec', '只在 exec 时产生'],
          [170, 'a crash in one child', '一个子进程的崩溃'],
          [182, 'tells something', '透露了其他'],
          [194, 'about all the others', '所有子进程的信息'],
          [230, 'Android’s zygote', 'Android 的 zygote'],
          [242, 'raised the same', '引发了同样的'],
          [254, 'concern', '担忧'],
        ],
        debug: [
          [176, 'under gdb, ASLR is', '在 gdb 下默认', 'hi'],
          [188, 'off by default', '关闭随机化', 'hi'],
          [212, 'addresses repeat,', '地址次次相同，'],
          [224, 'so breakpoints', '断点才有意义'],
          [236, 'stay meaningful', ''],
          [260, 'setarch -R does', 'setarch -R'],
          [272, 'the same', '效果相同'],
        ],
        replace: [
          [90, 'stack canary:', '栈金丝雀：', 'hi'],
          [102, 'checked on return', '返回前检查'],
          [126, 'control-flow integrity:', '控制流完整性：', 'hi'],
          [138, 'only legitimate targets', '只许合法目标'],
          [162, 'pointer authentication:', '指针认证：', 'hi'],
          [174, 'pointers carry a signature', '给指针签名'],
          [198, 'tags and capabilities:', '标记与能力硬件：', 'hi'],
          [210, 'checks on every pointer', '给指针附上检查'],
          [234, 'memory-safe languages:', '内存安全的语言：', 'hi'],
          [246, 'fewer bugs to begin with', '从源头减少错误'],
        ],
      }) as Record<string, Note[]>
    )[st.value] ?? [],
)
</script>

<template>
  <svg class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('One program started twice: two randomized virtual layouts over physical memory', '同一个程序运行两次：物理内存之上的两种随机虚拟布局')">
    <defs>
      <marker id="as-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="as-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="badhead" />
      </marker>
    </defs>

    <text x="8" y="44" class="tag">{{ L('high', '高地址') }}</text>
    <text x="8" y="400" class="tag">{{ L('low', '低地址') }}</text>

    <g v-for="c in COLUMNS" :key="c.id" :class="part(c.id)">
      <text :x="c.x + W / 2" y="22" class="sub c">{{ heading(c.run) }}</text>
      <rect :x="c.x" y="30" :width="W" height="374" rx="4" class="space" />

      <!-- the kernel: mapped into every address space, at one offset per boot -->
      <g :class="part('kernel')">
        <rect :x="c.x + 3" :y="KERNEL_Y" :width="W - 6" height="24" rx="3" class="box floor" :class="{ ghost: off }" />
        <text :x="c.x + W / 2" :y="KERNEL_Y + 16" class="lbl c small" :class="{ dimmed: off }">{{ L('kernel', '内核') }}</text>
        <template v-if="off">
          <rect :x="c.x + 22" :y="KERNEL_Y + 18" :width="W - 44" height="6" rx="1" class="stub" />
        </template>
      </g>

      <g v-for="r in REGIONS" :key="r" :class="part(r)">
        <g class="mover" :style="{ transform: `translateY(${layout(c.run)[r]}px)` }">
          <rect :x="c.x + 3" y="0" :width="W - 6" :height="H[r]" rx="3" class="r" :class="c.fill" />
          <text :x="c.x + W / 2" :y="H[r] / 2 + 3.2" class="rl c" :class="{ mini: r === 'vdso' }">{{ name(r) }}</text>
        </g>
      </g>
    </g>

    <!-- a stored pointer, and the known address it could be made to hold -->
    <g :class="part('pointer')">
      <circle :cx="134" :cy="FIXED.stack + 12" r="2.6" class="dot bad" />
      <path :d="`M136,${FIXED.stack + 12} C154,${FIXED.stack + 40} 154,${FIXED.libs - 10} 137,${FIXED.libs + 16}`" class="danger" marker-end="url(#as-arrow-bad)" />
    </g>

    <!-- a value aimed at run 1's library, in run 2 -->
    <g :class="part('wrong')">
      <path :d="`M134,${RUN1.libs + 18} L212,${RUN1.libs + 18}`" class="link" />
      <circle :cx="230" :cy="RUN2.stack + 12" r="2.6" class="dot bad" />
      <path :d="`M232,${RUN2.stack + 12} C250,${RUN2.stack + 30} 250,${RUN1.libs + 18} 222,${RUN1.libs + 18}`" class="danger" marker-end="url(#as-arrow-bad)" />
      <text x="205" :y="RUN1.libs + 23" class="bad-text c big">✕</text>
    </g>

    <!-- where the mmap base could fall -->
    <g :class="part('range')">
      <path d="M145,110 L145,290" class="link" />
      <circle v-for="k in 9" :key="k" cx="145" :cy="110 + (k - 1) * 22.5" r="1.8" class="dot" />
    </g>

    <!-- the program that does not move -->
    <g :class="part('landmark')">
      <path :d="`M134,${FIXED.prog + 15} L156,${FIXED.prog + 15}`" class="link solid" />
      <rect x="56" :y="FIXED.prog - 4" width="178" height="38" rx="5" class="outline warn" />
    </g>

    <!-- KASLR's window, and where another boot could put the kernel -->
    <g :class="part('window')">
      <rect v-for="c in COLUMNS" :key="c.id" :x="c.x + 3" y="62" :width="W - 6" height="8" rx="2" class="nextboot" />
    </g>

    <!-- a canary between local data and the return address -->
    <g :class="part('canary')">
      <template v-for="c in COLUMNS" :key="c.id">
        <rect :x="c.x + 3" :y="layout(c.run).stack + 20" :width="W - 6" height="4" class="canary" />
      </template>
    </g>

    <!-- what the passage says -->
    <g :class="part('notes')">
      <text v-for="(n, i) in NOTES" :key="i + n[1]" x="244" :y="n[0]" class="tag" :class="{ hi: n[3] === 'hi', 'bad-text': n[3] === 'bad' }">{{ L(n[1], n[2]) }}</text>
    </g>

    <!-- physical memory, and the translation that gets there -->
    <g :class="part('phys')">
      <text x="319" y="22" class="sub c">{{ L('physical', '物理内存') }}</text>
      <rect x="286" y="30" width="66" height="374" rx="4" class="space" />
      <rect v-for="(f, i) in FRAMES" :key="i" :x="f.x" :y="f.y" width="26" height="22" rx="2" :class="{ a: 'r r0', b: 'r r1', k: 'kf', x: 'free' }[f.c]" />
      <text x="180" y="421" class="tag c">{{ L('frames: blue run 1 · orange run 2 · grey kernel · white free', '页帧：蓝色第 1 次运行 · 橙色第 2 次 · 灰色内核 · 白色空闲') }}</text>
    </g>
    <g :class="part('links')">
      <text x="258" y="22" class="tag c">{{ L('page tables', '页表') }}</text>
      <path v-for="(l, i) in LINKS" :key="i" :d="linkPath(l)" class="link" />
    </g>

    <!-- one region, enlarged: everything sits at a fixed distance from its base -->
    <g :class="part('zoom')">
      <path :d="`M230,${RUN2.libs} L246,150 M230,${RUN2.libs + 44} L246,300`" class="link" />
      <rect x="246" y="150" width="106" height="150" rx="4" class="r r1 zoomed" />
      <text x="299" y="165" class="rl c">{{ L('C library', 'C 库') }}</text>
      <template v-for="(y, i) in [186, 216, 246]" :key="y">
        <rect x="254" :y="y" width="54" height="16" rx="2" class="fn" :class="{ known: i === 1 }" />
        <text x="281" :y="y + 11.5" class="tiny c ink">{{ L(`function ${'ABC'[i]}`, `函数 ${'ABC'[i]}`) }}</text>
      </template>
      <path d="M314,280 L314,194 M252,280 L346,280" class="ruler" />
      <text x="318" y="228" class="tiny on">{{ L('fixed', '固定') }}</text>
      <text x="318" y="239" class="tiny on">{{ L('offsets', '偏移') }}</text>
      <text x="254" y="293" class="tiny on">{{ L('base (the secret)', '基址（秘密）') }}</text>
      <text x="246" y="313" class="tag hi">{{ L('one leaked address', '泄露一个地址') }}</text>
      <text x="246" y="325" class="tag hi">{{ L('gives away the base', '基址就暴露了') }}</text>
    </g>

    <!-- shared hardware that remembers translations -->
    <g :class="part('tlbbox')">
      <path :d="`M230,${RUN2.libs + 20} L246,200`" class="link" />
      <rect x="246" y="170" width="106" height="60" rx="5" class="box gate" />
      <text x="299" y="190" class="lbl c small">{{ L('TLB · caches', 'TLB · 缓存') }}</text>
      <text x="299" y="205" class="tiny c">{{ L('hold page-walk data', '存放页表项') }}</text>
      <text x="299" y="218" class="tiny c">{{ L('timing is observable', '时序可被观察') }}</text>
      <text x="246" y="252" class="tag hi">{{ L('2017: JavaScript', '2017 年：网页里的') }}</text>
      <text x="246" y="264" class="tag hi">{{ L('in a page recovered', 'JavaScript 还原出') }}</text>
      <text x="246" y="276" class="tag hi">{{ L('code and heap', '代码和堆的地址') }}</text>
      <text x="246" y="288" class="tag">{{ L('addresses, 28 bits,', '（28 位随机性，') }}</text>
      <text x="246" y="300" class="tag">{{ L('in about 150 s', '约 150 秒）') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.space {
  fill: var(--bg-sunk);
  stroke: var(--rule);
}
.r0 {
  fill: var(--p0);
}
.r1 {
  fill: var(--p1);
}
.kf {
  fill: var(--faint);
}
.tiny.ink {
  fill: var(--ink-2);
}
.free {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 0.7;
}
.rl {
  font-size: 9.5px;
  font-weight: 600;
  fill: #fff;
}
.rl.mini {
  font-size: 8.5px;
}
.lbl.small {
  font-size: 10px;
}
.dimmed {
  opacity: 0.35;
}
.ghost {
  stroke-dasharray: 3 3;
  opacity: 0.45;
}
.stub {
  fill: var(--ink-2);
}
.nextboot {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 3 2;
}
.mover {
  transition: transform 0.5s ease;
}
.canary {
  fill: var(--warn);
}
.badhead {
  fill: var(--p3);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.on {
  fill: #fff;
}
.zoomed {
  stroke: none;
}
.fn {
  fill: #fff;
  opacity: 0.92;
}
.fn.known {
  stroke: var(--p3);
  stroke-width: 2;
}
.ruler {
  fill: none;
  stroke: #fff;
  stroke-width: 1;
}
.lit .r {
  stroke: var(--accent);
  stroke-width: 2.2;
}
@media (prefers-reduced-motion: reduce) {
  .mover {
    transition: none;
  }
}
</style>
