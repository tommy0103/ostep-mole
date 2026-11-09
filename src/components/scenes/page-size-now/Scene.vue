<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CowDemo from './CowDemo.vue'

/**
 * The running figure of the page-size article: one process's address space as /proc/<pid>/maps
 * lists it (left), the TLB and page table that translate it (middle), physical frames and the disk
 * (right), and under them what the tools print. States light up the regions, frames and paths a
 * passage measures; the layout never moves.
 */
const props = defineProps<DrawingProps>()

const BASE = ['heads', 'stack', 'vdso', 'anon', 'libc', 'heap', 'prog', 'tlb', 'pt', 'frames', 'term']
const SHOW: Record<string, string[]> = {
  overview: [...BASE, 'resident', 'xlate'],
  maps: [...BASE, 'perms', 'gap'],
  smaps: [...BASE, 'resident', 'xlate', 'ticks'],
  rss: [...BASE, 'resident', 'ptB', 'shared'],
  pagesize: [...BASE, 'resident', 'big'],
  levels: [...BASE, 'resident', 'levels'],
  lazy: [...BASE, 'resident', 'mmap', 'handler'],
  touched: [...BASE, 'resident', 'mmap', 'handler', 'touch'],
  faultlab: [...BASE, 'resident', 'handler', 'disk', 'walk'],
  major: [...BASE, 'resident', 'handler', 'disk', 'cache'],
  cow: [...BASE, 'resident', 'mmap', 'handler', 'ptB', 'cow'],
  pagemap: [...BASE, 'resident', 'xlate', 'pte'],
  beyond: [...BASE, 'resident', 'mmap', 'kernelhalf', 'thp'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 392)
const has = (id: string) => shown.value.has(id)
const st = computed(() => props.state)

/** the frames grid: 6 columns, 10 rows */
const fx = (i: number) => 249 + (i % 6) * 17
const fy = (i: number) => 28 + Math.floor(i / 6) * 16
const ALL = Array.from({ length: 60 }, (_, i) => i)
const A_BASE = [1, 4, 8, 13, 19, 24, 27, 33]
const CACHE = [3, 10, 17, 22, 29]
const HEAP = 48
const SHARED = 50
const TOUCHED = ALL.filter((i) => i >= 36 && i !== HEAP)
const COW = [48, 49, 50, 51, 52, 53]
const COPY = 59

function frameClass(i: number) {
  const s = shown.value
  if (s.has('cow') && COW.includes(i)) return 'fa ro'
  if (s.has('cow') && i === COPY) return 'fb'
  if (s.has('touch') && TOUCHED.includes(i)) return 'fnew'
  if (s.has('shared') && i === SHARED) return 'fshared'
  if (s.has('cache') && CACHE.includes(i)) return 'fcache'
  if ((s.has('xlate') || s.has('ticks')) && i === HEAP) return 'fheap'
  if (s.has('resident') && A_BASE.includes(i)) return 'fa'
  return 'free'
}

/** the program's own regions, named after the program the passage runs */
const prog = computed(() =>
  ['maps', 'rss'].includes(st.value) ? 'cat' : ['lazy', 'touched'].includes(st.value) ? 'lazy' : st.value === 'cow' ? 'cow' : L('program', '程序'),
)
const mmapSize = computed(() => (st.value === 'cow' ? '64 MiB' : '256 MiB'))

const VMAS = [
  { id: 'stack', y: 40, h: 16, name: '[stack]', perm: 'rw-p' },
  { id: 'vdso', y: 66, h: 10, name: '[vvar]', perm: 'r--p' },
  { id: 'vdso', y: 77, h: 10, name: '[vdso]', perm: 'r-xp' },
  { id: 'libc', y: 107, h: 10, name: 'libc', perm: 'rw-p' },
  { id: 'libc', y: 118, h: 10, name: 'libc', perm: 'r--p' },
  { id: 'libc', y: 140, h: 20, name: 'libc', perm: 'r-xp' },
  { id: 'prog', y: 278, h: 10, name: '', perm: 'rw-p' },
  { id: 'prog', y: 289, h: 10, name: '', perm: 'r--p' },
  { id: 'prog', y: 300, h: 18, name: '', perm: 'r-xp' },
]
/** the 33 pages of a 132 KiB heap, one of them resident */
const TICKS = Array.from({ length: 33 }, (_, i) => 10 + i * 3.3)

/** the terminal under the drawing: what the passage's tools print */
const TERM = computed<{ t: string; k?: 'cmd' | 'note' }[]>(() => {
  switch (st.value) {
    case 'overview':
      return [
        { t: '$ getconf PAGESIZE', k: 'cmd' },
        { t: L('4096    # the Linux VM this was checked on', '4096    # 核对本文的 Linux 虚拟机') },
        { t: L('16384   # macOS on the same kind of chip', '16384   # 同类芯片上的 macOS') },
      ]
    case 'maps':
      return [
        { t: '$ cat /proc/self/maps', k: 'cmd' },
        { t: 'abf70a097000-abf70a0b8000 rw-p 00000000 00:00 0  [heap]' },
        { t: L('range · perms · offset · device · inode · name', '地址范围 · 权限 · 偏移 · 设备 · inode · 名字'), k: 'note' },
      ]
    case 'smaps':
      return [
        { t: '$ cat /proc/<pid>/smaps     # [heap]', k: 'cmd' },
        { t: 'Size:  132 kB    KernelPageSize: 4 kB' },
        { t: 'Rss:     4 kB    AnonHugePages:  0 kB' },
      ]
    case 'rss':
      return [
        { t: '$ ps -o pid,vsz,rss,comm -p $$', k: 'cmd' },
        { t: L('VSZ: every mapped region · RSS: what is in frames', 'VSZ：所有已映射区域 · RSS：在物理帧里的部分'), k: 'note' },
        { t: L('PSS: each shared page divided by its sharers', 'PSS：每个共享页除以共享它的进程数'), k: 'note' },
      ]
    case 'pagesize':
      return [
        { t: L('$ getconf PAGESIZE     # x86-64: always 4096', '$ getconf PAGESIZE     # x86-64：永远是 4096'), k: 'cmd' },
        { t: L('arm64: 4, 16 or 64 KiB granule, the OS picks', 'arm64：4、16、64 KiB 粒度，由操作系统挑'), k: 'note' },
        { t: L('16 KiB: reach ×4 · faults ÷4 · more waste', '16 KiB：覆盖 ×4 · 页错误 ÷4 · 浪费更多'), k: 'note' },
      ]
    case 'lazy':
      return [
        { t: '$ ./lazy', k: 'cmd' },
        { t: 'Mapped 256 MiB, touched nothing.' },
        { t: L('VSZ: +256 MiB · RSS: still small', 'VSZ：+256 MiB · RSS：仍然很小'), k: 'note' },
      ]
    case 'touched':
      return [
        { t: L('4 KiB:  65536 pages · ≈65,536 minor faults', '4 KiB：65536 页 · 约 65,536 次次要页错误') },
        { t: L('16 KiB: 16384 pages · ≈16,384 minor faults', '16 KiB：16384 页 · 约 16,384 次') },
        { t: L('THP always: one fault may map 512 pages', 'THP 为 always：一次页错误可映射 512 页'), k: 'note' },
      ]
    case 'faultlab':
      return [
        { t: L('Lab: TLB hit · TLB miss · page fault', '实验：TLB 命中 · TLB 未命中 · 缺页'), k: 'note' },
        { t: L('the lab’s times are rough orders of magnitude', '实验里的时间只是粗略的数量级'), k: 'note' },
        { t: L('demand-zero: no disk, so minor and fast', '按需置零：不碰磁盘，所以次要且快'), k: 'note' },
      ]
    case 'major':
      return [
        { t: '# sync; echo 1 > /proc/sys/vm/drop_caches', k: 'cmd' },
        { t: L('1st run: code read from disk → major', '第 1 次：代码从磁盘读入 → 主要'), k: 'note' },
        { t: L('2nd run: in the page cache → minor', '第 2 次：已在页缓存里 → 次要'), k: 'note' },
      ]
    case 'cow':
      return [
        { t: '$ ./cow', k: 'cmd' },
        { t: L('child: 16384 pages · reading ≈0 faults', 'child：16384 页 · 读 ≈0 次页错误') },
        { t: L('              writing ≈16,384 faults', '              写 ≈16,384 次') },
      ]
    case 'beyond':
      return [
        { t: L('VSZ: promised · RSS: delivered', 'VSZ：承诺 · RSS：已兑现'), k: 'note' },
        { t: 'vm.overcommit_memory = 0' },
        { t: L('pages: 4 KiB · 16–64 KiB · 2 MiB (THP)', '页：4 KiB · 16–64 KiB · 2 MiB（THP）'), k: 'note' },
      ]
    default:
      return []
  }
})

/** virtual address bits per page-table level, then the offset (levels state) */
const BITS = [
  { label: '4 KiB', parts: [9, 9, 9, 9, 12] },
  { label: '16 KiB', parts: [1, 11, 11, 11, 14] },
  { label: '64 KiB', parts: [13, 13, 16] },
]
const bitW = (n: number) => Math.max(n * 5.6, 11)
const bitX = (parts: number[], k: number) => 64 + parts.slice(0, k).reduce((a, b) => a + bitW(b), 0)
</script>

<template>
  <CowDemo v-if="demo && state === 'cow'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A process’s address space, its page table and physical memory', '进程的地址空间、页表与物理内存')">
    <defs>
      <marker id="pz-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <g :class="part('heads')">
      <text x="8" y="12" class="tag">{{ L('virtual · process A', '虚拟地址 · 进程 A') }}</text>
      <text x="132" y="12" class="tag">{{ L('translation', '地址转换') }}</text>
      <text x="242" y="12" class="tag">{{ L('physical frames', '物理帧') }}</text>
    </g>

    <!-- ───────── left: the regions of the address space, high addresses on top ───────── -->
    <g :class="part('kernelhalf')">
      <rect x="8" y="20" width="112" height="14" rx="2" class="outline warn" />
      <text x="64" y="30" class="tag c">{{ L('kernel half: not in maps', '内核那一半：不在 maps 里') }}</text>
    </g>
    <g v-for="v in VMAS" :key="v.y" :class="part(v.id)">
      <rect x="8" :y="v.y" width="112" :height="v.h" rx="1.5" class="vma" :class="v.perm.slice(0, 3).replace(/-/g, '_')" />
      <text x="12" :y="v.y + v.h / 2 + 3" class="code tiny">{{ v.name || prog }}</text>
      <text x="116" :y="v.y + v.h / 2 + 3" class="code tiny end">{{ v.perm }}</text>
    </g>
    <g :class="part('libc')">
      <rect x="8" y="129" width="112" height="10" rx="1.5" class="vma none" :class="{ gapon: has('gap') }" />
      <text x="12" y="137" class="code tiny">libc</text>
      <text x="116" y="137" class="code tiny end">---p</text>
    </g>
    <g :class="part('anon')">
      <rect x="8" y="96" width="112" height="10" rx="1.5" class="vma rw_" :class="{ zero: has('gap') }" />
      <text x="12" y="104" class="code tiny">{{ L('unnamed', '无名') }}</text>
      <text x="116" y="104" class="code tiny end">rw-p</text>
    </g>
    <g :class="part('gap')">
      <text x="12" y="176" class="tag">{{ L('---p: no access at all', '---p：完全不可访问') }}</text>
      <text x="12" y="190" class="tag">{{ L('inode 0: no file behind it', 'inode 0：没有文件') }}</text>
    </g>
    <g :class="part('heap')">
      <rect x="8" y="244" width="112" height="22" rx="1.5" class="vma rw_" />
      <text x="12" y="256" class="code tiny">[heap]</text>
      <text x="116" y="256" class="code tiny end">rw-p</text>
    </g>
    <g :class="part('ticks')">
      <rect v-for="(x, i) in TICKS" :key="'t' + i" :x="8 + x - 8" y="259" width="2.4" height="5" :class="i === 0 ? 'tick on' : 'tick'" />
      <text x="64" y="276" class="tag hi c">{{ L('33 pages · 1 in memory', '33 页 · 1 页在内存里') }}</text>
    </g>

    <!-- the anonymous mapping of lazy.c and cow.c -->
    <g :class="part('mmap')">
      <rect x="8" y="172" width="112" height="60" rx="1.5" class="vma rw_" :class="{ empty: st === 'lazy', thp: has('thp') }" />
      <text x="12" y="184" class="code tiny">mmap · {{ mmapSize }}</text>
      <text x="116" y="184" class="code tiny end">rw-p</text>
      <text v-if="st === 'lazy'" x="64" y="210" class="tag c">{{ L('no frames yet', '还没有物理帧') }}</text>
      <template v-if="has('touch') || has('cow')">
        <rect v-for="k in 24" :key="'p' + k" :x="12 + ((k - 1) % 12) * 8.8" :y="192 + Math.floor((k - 1) / 12) * 14" width="7" height="10" rx="1" class="page" />
      </template>
      <template v-if="has('thp')">
        <rect x="12" y="190" width="50" height="36" rx="2" class="thpblock" />
        <rect x="66" y="190" width="50" height="36" rx="2" class="thpblock" />
        <text x="37" y="212" class="tag c">2 MiB</text>
        <text x="91" y="212" class="tag c">2 MiB</text>
      </template>
    </g>

    <!-- ───────── middle: TLB, page table, the kernel's fault handler ───────── -->
    <g :class="part('tlb')">
      <rect x="132" y="20" width="98" height="40" rx="5" class="box" :class="{ focus: has('big') }" />
      <text x="138" y="34" class="lbl">TLB</text>
      <rect v-for="k in 4" :key="'e' + k" :x="138 + (k - 1) * 22" y="42" width="18" height="11" rx="1.5" class="entry" />
    </g>
    <g :class="part('pt')">
      <rect x="132" y="70" width="98" height="126" rx="5" class="box" :class="{ focus: has('levels') || has('pte') }" />
      <text x="138" y="84" class="tag">{{ L('page table', '页表') }}</text>
      <template v-for="(lv, k) in [90, 116, 142, 168]" :key="'l' + k">
        <rect :x="138 + k * 12" :y="lv" width="44" height="18" rx="2" class="level" :class="{ pteon: has('pte') && k === 3 }" />
        <text :x="160 + k * 12" :y="lv + 12" class="code tiny c">{{ has('levels') ? '512' : L('level ' + (k + 1), '第 ' + (k + 1) + ' 级') }}</text>
        <path v-if="k < 3" :d="`M${170 + k * 12},${lv + 18} L${170 + k * 12},${lv + 26}`" class="link solid" marker-end="url(#pz-arrow)" />
      </template>
      <text v-if="has('levels')" x="224" y="84" class="tag end">× 8 B</text>
    </g>
    <g :class="part('levels')">
      <rect x="132" y="208" width="9" height="9" rx="1.5" class="idx" />
      <text x="146" y="216" class="tag">{{ L('address bits per level', '每级翻译的地址位') }}</text>
      <rect x="132" y="222" width="9" height="9" rx="1.5" class="off" />
      <text x="146" y="230" class="tag">{{ L('offset within the page', '页内偏移') }}</text>
    </g>
    <g :class="part('ptB')">
      <rect x="132" y="206" width="98" height="40" rx="5" class="box ptb" />
      <text x="138" y="220" class="lbl">{{ L('process B', '进程 B') }}</text>
      <text x="138" y="236" class="sub">{{ st === 'cow' ? L('child: same frames', '子进程：同一批帧') : L('also maps libc', '也映射了 libc') }}</text>
    </g>
    <g :class="part('handler')">
      <rect x="132" y="262" width="98" height="56" rx="5" class="box floor" />
      <text x="181" y="280" class="lbl c">{{ L('Kernel', '内核') }}</text>
      <text x="181" y="294" class="sub c">{{ L('page-fault handler', '页错误处理程序') }}</text>
      <text x="181" y="310" class="tag hi c">{{
        st === 'touched' ? L('zero a frame ×65,536', '清零一个帧 ×65,536') : st === 'cow' ? L('copy one page', '复制一页') : st === 'lazy' ? L('nothing yet', '还没事做') : st === 'major' ? L('read or reuse', '读入或复用') : L('fault', '页错误')
      }}</text>
    </g>

    <!-- ───────── right: frames and disk ───────── -->
    <g :class="part('frames')">
      <rect x="242" y="20" width="110" height="170" rx="5" class="box" />
      <rect v-for="i in ALL" :key="'f' + i" :x="fx(i)" :y="fy(i)" width="14" height="12" rx="1.5" class="frame" :class="frameClass(i)" />
    </g>
    <g :class="part('disk')">
      <rect x="242" y="214" width="110" height="48" rx="5" class="box floor" />
      <text x="297" y="234" class="lbl c">{{ L('Disk', '磁盘') }}</text>
      <text x="297" y="250" class="sub c">{{ L('files · swap', '文件 · 交换区') }}</text>
    </g>

    <!-- translation of the heap's one resident page -->
    <g :class="part('xlate')">
      <path d="M120,252 C146,252 158,214 172,188" class="call" marker-end="url(#pz-arrow)" />
      <path d="M218,177 C232,177 236,162 247,162" class="call" marker-end="url(#pz-arrow)" />
    </g>

    <!-- PSS: one libc frame, two processes -->
    <g :class="part('shared')">
      <path d="M230,226 C258,226 280,200 288,170" class="link" marker-end="url(#pz-arrow)" />
      <text x="297" y="204" class="tag hi c">{{ L('libc frame: ½ A, ½ B', 'libc 帧：A ½，B ½') }}</text>
    </g>

    <!-- 16 KiB pages: four frames' worth under one entry -->
    <g :class="part('big')">
      <rect x="247" y="26" width="35" height="32" rx="2" class="bigpage" />
      <rect x="281" y="26" width="18" height="16" rx="2" class="smallpage" />
      <text x="297" y="204" class="tag c">{{ L('solid: one 16 KiB page', '实线：一个 16 KiB 页') }}</text>
      <text x="297" y="218" class="tag c">{{ L('dashed: one 4 KiB page', '虚线：一个 4 KiB 页') }}</text>
      <text x="181" y="208" class="tag hi c">{{ L('1 TLB entry = 1 page', '1 个 TLB 项 = 1 页') }}</text>
    </g>

    <!-- a fresh frame for every touched page -->
    <g :class="part('touch')">
      <path d="M200,262 C206,232 230,200 250,188" class="call" marker-end="url(#pz-arrow)" />
      <path d="M120,202 C126,202 128,280 132,284" class="link" marker-end="url(#pz-arrow)" />
    </g>

    <!-- the lab's path: TLB miss, walk, fault, read from swap -->
    <g :class="part('walk')">
      <path d="M120,250 C126,180 124,60 132,48" class="call" marker-end="url(#pz-arrow)" />
      <text x="126" y="66" class="num c">1</text>
      <path d="M220,60 L220,72" class="call" marker-end="url(#pz-arrow)" />
      <text x="226" y="70" class="num">2</text>
      <path d="M220,196 L220,260" class="call" marker-end="url(#pz-arrow)" />
      <text x="224" y="232" class="num">3</text>
      <path d="M230,296 C246,296 270,280 280,264" class="call" marker-end="url(#pz-arrow)" />
      <text x="244" y="284" class="num">4</text>
      <path d="M297,214 L297,192" class="call" marker-end="url(#pz-arrow)" />
      <text x="304" y="206" class="num">5</text>
    </g>

    <!-- major and minor: from the disk, or from the page cache -->
    <g :class="part('cache')">
      <path d="M297,214 L297,192" class="call" marker-end="url(#pz-arrow)" />
      <text x="304" y="206" class="tag hi">{{ L('major', '主要') }}</text>
      <text x="246" y="280" class="tag">{{ L('grey: page cache', '灰色：页缓存') }}</text>
      <text x="246" y="294" class="tag">{{ L('found there: minor', '在其中：次要') }}</text>
    </g>

    <!-- copy-on-write: both tables, the same frames -->
    <g :class="part('cow')">
      <path d="M218,177 C232,177 236,160 247,160" class="call" marker-end="url(#pz-arrow)" />
      <path d="M230,214 C242,206 238,172 247,166" class="link" marker-end="url(#pz-arrow)" />
      <path d="M230,232 C280,232 330,216 341,187" class="call bad" marker-end="url(#pz-arrow)" />
      <text x="250" y="202" class="tag hi">{{ L('read-only', '只读') }}</text>
      <text x="300" y="246" class="tag c">{{ L('orange: the child’s copy', '橙色：子进程的副本') }}</text>
    </g>

    <!-- pagemap: one 8-byte entry per page -->
    <g :class="part('pte')">
      <text x="224" y="84" class="tag end hi">pagemap</text>
    </g>

    <!-- ───────── bottom: the terminal ───────── -->
    <g :class="part('term')">
      <rect x="8" y="330" width="344" height="58" rx="5" class="termbox" />
      <template v-if="!has('levels') && !has('pte')">
        <text v-for="(l, k) in TERM" :key="st + k" x="16" :y="346 + k * 16" class="code term" :class="l.k">{{ l.t }}</text>
      </template>
      <template v-if="has('levels')">
        <g v-for="(b, r) in BITS" :key="b.label">
          <text x="16" :y="344 + r * 16" class="code term">{{ b.label }}</text>
          <template v-for="(n, k) in b.parts" :key="k">
            <rect :x="bitX(b.parts, k)" :y="335 + r * 16" :width="bitW(n) - 1.5" height="12" rx="1.5" :class="k === b.parts.length - 1 ? 'off' : 'idx'" />
            <text :x="bitX(b.parts, k) + (bitW(n) - 1.5) / 2" :y="344 + r * 16" class="bitn c">{{ n }}</text>
          </template>
        </g>
      </template>
      <template v-if="has('pte')">
        <text x="16" y="346" class="code term cmd">{{ L('/proc/<pid>/pagemap: 8 bytes per page', '/proc/<pid>/pagemap：每页 8 字节') }}</text>
        <rect x="16" y="352" width="34" height="14" rx="1.5" class="idx" />
        <text x="33" y="362" class="bitn c">63</text>
        <rect x="52" y="352" width="34" height="14" rx="1.5" class="idx" />
        <text x="69" y="362" class="bitn c">62</text>
        <rect x="88" y="352" width="56" height="14" rx="1.5" class="flags" />
        <text x="116" y="362" class="bitn dark c">61–55</text>
        <rect x="146" y="352" width="198" height="14" rx="1.5" class="off" />
        <text x="245" y="362" class="bitn c">{{ L('54–0: frame number (PFN)', '54–0：物理帧号（PFN）') }}</text>
        <text x="16" y="380" class="tag">{{ L('present · swapped', '在内存 · 已换出') }}</text>
        <text x="344" y="380" class="tag end">{{ L('0 unless CAP_SYS_ADMIN', '无 CAP_SYS_ADMIN 时为 0') }}</text>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.code.tiny {
  font-size: 8.5px;
}
.vma {
  stroke: var(--bg);
  stroke-width: 0.8;
  fill: var(--p0);
  fill-opacity: 0.22;
  transition: fill-opacity 0.3s;
}
.vma.r_x {
  fill-opacity: 0.42;
}
.vma.r__ {
  fill-opacity: 0.14;
}
.vma.none {
  fill: var(--bg-sunk);
  fill-opacity: 1;
  stroke: var(--muted);
  stroke-dasharray: 2 2;
}
.vma.none.gapon {
  stroke: var(--p3);
  stroke-width: 1.2;
}
.vma.zero {
  stroke: var(--accent);
  stroke-width: 1.2;
}
.vma.empty {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 4 3;
}
.vma.thp {
  fill-opacity: 0.1;
}
.lit .vma {
  stroke: var(--accent);
  stroke-width: 1.6;
}
.page {
  fill: var(--p0);
  opacity: 0.85;
}
.thpblock {
  fill: var(--p0);
  fill-opacity: 0.35;
  stroke: var(--p0);
}
.tick {
  fill: var(--muted);
  opacity: 0.5;
}
.tick.on {
  fill: var(--accent);
  opacity: 1;
}
.entry {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.level {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.level.pteon {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.box.focus {
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.box.ptb {
  fill: var(--bg-elev);
  stroke: var(--p1);
  stroke-width: 1.4;
}
.frame {
  stroke: var(--rule-strong);
  stroke-width: 0.8;
  fill: none;
  transition: fill 0.3s;
}
.frame.fa {
  fill: var(--p0);
  stroke: none;
  opacity: 0.75;
}
.frame.fa.ro {
  stroke: var(--ink-2);
  stroke-width: 1;
  stroke-dasharray: 2 1.5;
}
.frame.fb {
  fill: var(--p1);
  stroke: none;
}
.frame.fnew {
  fill: var(--p0);
  stroke: none;
  opacity: 0.45;
}
.frame.fheap {
  fill: var(--accent);
  stroke: none;
}
.frame.fcache {
  fill: var(--muted);
  stroke: none;
  opacity: 0.6;
}
.frame.fshared {
  fill: var(--p1);
  stroke: var(--p0);
  stroke-width: 2.5;
}
.lit .frame {
  stroke: var(--accent);
  stroke-width: 1.2;
}
.bigpage {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.smallpage {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 2 1.5;
}
.call.bad {
  stroke: var(--p1);
}
.num {
  font-size: 9.5px;
  font-weight: 700;
  fill: var(--accent-ink);
}
.termbox {
  fill: var(--code-bg);
  stroke: var(--rule);
}
.code.term {
  font-size: 9px;
}
.code.term.cmd {
  fill: var(--ink);
  font-weight: 600;
}
.code.term.note {
  fill: var(--muted);
  font-family: var(--font-sans);
  font-size: 9.5px;
}
.idx {
  fill: var(--p0);
  opacity: 0.7;
}
.off {
  fill: var(--p2);
  opacity: 0.7;
}
.flags {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
}
.bitn {
  font-size: 8.5px;
  font-weight: 600;
  fill: #fff;
}
.lit .termbox {
  stroke: var(--accent);
  stroke-width: 2.2;
}
.bitn.dark {
  fill: var(--muted);
}
</style>
