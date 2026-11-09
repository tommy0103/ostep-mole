<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import ZramDemo from './ZramDemo.vue'

/**
 * The running figure of the swapping-today article: one machine under memory pressure. User space
 * on top (four apps, and the daemon that may kill them); the kernel below it (kswapd, PSI, the OOM
 * killer); physical memory as a row of frames (anonymous, file, compressed pool, free); the places
 * evicted pages go at the bottom (the file system, a swap partition, zram). Under them, a strip that
 * each state fills with its own numbers: costs, the zram arithmetic, badness scores, a PSI timeline,
 * kill rules. Nothing moves; states change what is on view.
 */
const props = defineProps<DrawingProps>()
type T = [string, string]

// physical memory: 24 frames. A anonymous, F file, Z compressed pool, . free
const FRAMES: Record<string, string> = {
  overview: 'AAAAAAAAFFFFFFFZZZZ.....',
  book: 'AAAAAAAAAAAFFFFFFFFFFFF.',
  'two-kinds': 'AAAAAAAAAAAFFFFFFFFFF...',
  zram: 'AAAAAAAAFFFFFFFZZZZ.....',
  zswap: 'ZZZZAAAAAAAAFFFFFFF.....',
  slowpath: 'AAAAAAAAAAAFFFFFFFFFFFF.',
  oom: 'AAAAAAAAAAAAAAAAAFFFFFFF',
  livelock: 'AAAAAAAAAAAAAAAAFFFFFFF.',
  psi: 'AAAAAAAAAAAAAAAAFFFFFFF.',
  trigger: 'AAAAAAAAAAAAAAAAFFFFFFF.',
  oomd: 'AAAAAAAAFFFFFFFZZZZ.....',
  lmkd: 'AAAAAAAAFFFFFFFZZZZ.....',
  bends: 'AAAAAAAFFFFZZZZZZZZZ....',
}
const FX = 16
const FW = 13.6
const fx = (i: number) => FX + i * FW

// the apps: what each is, per state
const APPS: Record<string, { name: T; sub: T }[]> = {
  plain: [
    { name: ['App 1', '应用 1'], sub: ['', ''] },
    { name: ['App 2', '应用 2'], sub: ['', ''] },
    { name: ['App 3', '应用 3'], sub: ['', ''] },
    { name: ['App 4', '应用 4'], sub: ['', ''] },
  ],
  lmkd: [
    { name: ['adj 0', 'adj 0'], sub: ['foreground', '前台'] },
    { name: ['adj 200', 'adj 200'], sub: ['perceptible', '可感知'] },
    { name: ['adj 700', 'adj 700'], sub: ['previous', '上一个'] },
    { name: ['adj 900', 'adj 900'], sub: ['cached', '缓存的'] },
  ],
  oom: [
    { name: ['App 1', '应用 1'], sub: ['2 GiB', '2 GiB'] },
    { name: ['App 2', '应用 2'], sub: ['adj −1000', 'adj −1000'] },
    { name: ['App 3', '应用 3'], sub: ['1 GiB', '1 GiB'] },
    { name: ['App 4', '应用 4'], sub: ['512 MiB', '512 MiB'] },
  ],
}
const appSet = computed(() => APPS[props.state === 'lmkd' ? 'lmkd' : props.state === 'oom' ? 'oom' : 'plain'])
/** the app that is killed in this state */
const killed = computed(() => (props.state === 'oom' ? [0] : props.state === 'lmkd' ? [3] : props.state === 'oomd' ? [2, 3] : []))
const AX = [16, 70, 124, 178]

const SHOW: Record<string, string[]> = {
  overview: ['apps', 'kernel', 'kswapd', 'psi', 'oomk', 'ram', 'zram', 'tozram', 'daemon', 'watch', 'fedora'],
  book: ['apps', 'kernel', 'kswapd', 'ram', 'wm', 'disk', 'evict', 'fault', 'cost'],
  'two-kinds': ['apps', 'kernel', 'kswapd', 'ram', 'fs', 'disk', 'evict', 'drop', 'noswap'],
  zram: ['apps', 'kernel', 'kswapd', 'ram', 'zram', 'tozram', 'arith'],
  zswap: ['apps', 'kernel', 'kswapd', 'ram', 'disk', 'zswap', 'zswaprule'],
  slowpath: ['apps', 'kernel', 'kswapd', 'ram', 'disk', 'zram', 'evict', 'fault', 'path'],
  oom: ['apps', 'kernel', 'oomk', 'ram', 'kill', 'badness'],
  livelock: ['apps', 'kernel', 'kswapd', 'psi', 'oomk', 'ram', 'disk', 'evict', 'fault', 'waiting'],
  psi: ['apps', 'kernel', 'psi', 'ram', 'disk', 'evict', 'fault', 'timeline'],
  trigger: ['apps', 'kernel', 'psi', 'ram', 'disk', 'evict', 'fault', 'timeline', 'window', 'daemon', 'watch'],
  oomd: ['apps', 'kernel', 'psi', 'ram', 'zram', 'daemon', 'watch', 'cgroups', 'dkill', 'oomdrule'],
  lmkd: ['apps', 'kernel', 'psi', 'ram', 'zram', 'daemon', 'watch', 'dkill', 'lmkdrule'],
  bends: ['apps', 'kernel', 'kswapd', 'oomk', 'ram', 'zram', 'tozram', 'warn'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 440)
const T = (s: T) => L(s[0], s[1])
const frames = computed(() => (FRAMES[props.state] ?? FRAMES.overview).split(''))
const poolName = computed(() => (props.state === 'zswap' ? L('zswap pool', 'zswap 池') : L('zram pool', 'zram 池')))
const daemonName = computed(() => (props.state === 'oomd' ? 'systemd-oomd' : 'lmkd'))
/** PSI gauge fill, some and full, per state */
const gauge = computed(() =>
  ['livelock', 'psi', 'trigger', 'oomd'].includes(props.state) ? [0.62, 0.3] : props.state === 'lmkd' ? [0.4, 0.12] : [0.08, 0],
)

// the PSI timeline: three tasks' stalls in one window; some = any stalled, full = all stalled
const STALLS = [
  [[0.1, 0.35], [0.6, 0.8]],
  [[0.2, 0.4], [0.65, 0.9]],
  [[0.25, 0.38], [0.7, 0.78]],
]
const SOME = [[0.1, 0.4], [0.6, 0.9]]
const FULL = [[0.25, 0.35], [0.7, 0.78]]
const TX = 70
const TW = 274
</script>

<template>
  <ZramDemo v-if="demo && state === 'zram'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Memory under pressure: apps, the kernel, physical memory and swap', '内存压力之下：应用、内核、物理内存与交换')">
    <defs>
      <marker id="zo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="zo-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head-bad" />
      </marker>
    </defs>

    <!-- user space: the apps, grouped in cgroups for systemd-oomd -->
    <g :class="part('apps')">
      <text x="16" y="11" class="tag">{{ L('user space', '用户态') }}</text>
      <g v-for="(a, i) in appSet" :key="i">
        <rect :x="AX[i]" y="18" width="50" height="42" rx="5" class="box" :class="{ dead: killed.includes(i) && shown.has(state === 'oom' ? 'kill' : 'dkill') }" />
        <text :x="AX[i] + 25" y="36" class="lbl c small">{{ T(a.name) }}</text>
        <text :x="AX[i] + 25" y="51" class="tiny c">{{ T(a.sub) }}</text>
      </g>
    </g>
    <g :class="part('cgroups')">
      <rect x="12" y="14" width="104" height="50" rx="7" class="outline" />
      <rect x="120" y="14" width="112" height="50" rx="7" class="outline warn" />
      <text x="176" y="72" class="tiny c">{{ L('one cgroup, killed whole', '整个 cgroup 一起杀掉') }}</text>
    </g>
    <g :class="part('daemon')">
      <rect x="244" y="18" width="104" height="42" rx="5" class="box strong" />
      <text x="296" y="36" class="lbl c small">{{ daemonName }}</text>
      <text x="296" y="51" class="tiny c">{{ L('user-space killer', '用户态杀手') }}</text>
    </g>

    <!-- the kernel -->
    <g :class="part('kernel')">
      <rect x="8" y="78" width="344" height="72" rx="6" class="box floor" />
      <text x="14" y="90" class="tag">{{ L('kernel', '内核') }}</text>
    </g>
    <g :class="part('kswapd')">
      <rect x="16" y="96" width="88" height="46" rx="5" class="box" />
      <text x="60" y="114" class="lbl c small">kswapd</text>
      <text x="60" y="129" class="tiny c">{{ L('evicts pages', '淘汰页') }}</text>
    </g>
    <g :class="part('psi')">
      <rect x="112" y="96" width="128" height="46" rx="5" class="box" />
      <text x="120" y="110" class="lbl small">PSI</text>
      <text x="146" y="110" class="tiny">{{ L('time stalled', '停滞时间') }}</text>
      <text x="120" y="124" class="tiny">some</text>
      <rect x="146" y="117" width="86" height="8" rx="2" class="gauge" />
      <rect x="146" y="117" :width="86 * gauge[0]" height="8" rx="2" class="gauge-fill" />
      <text x="120" y="137" class="tiny">full</text>
      <rect x="146" y="130" width="86" height="8" rx="2" class="gauge" />
      <rect x="146" y="130" :width="86 * gauge[1]" height="8" rx="2" class="gauge-fill" />
    </g>
    <g :class="part('oomk')">
      <rect x="248" y="96" width="96" height="46" rx="5" class="box" />
      <text x="296" y="114" class="lbl c small">{{ L('OOM killer', 'OOM killer') }}</text>
      <text x="296" y="129" class="tiny c">{{ state === 'livelock' ? L('memory not out yet', '内存还没耗尽') : state === 'bends' ? L('chooses by size only', '只按大小来选') : L('last resort', '最后手段') }}</text>
    </g>

    <!-- physical memory -->
    <g :class="part('ram')">
      <text x="16" y="168" class="tag">{{ L('physical memory:', '物理内存：') }}</text>
      <rect x="102" y="160" width="9" height="9" rx="1.5" class="frame kA" />
      <text x="114" y="168" class="tiny">{{ L('anonymous', '匿名页') }}</text>
      <rect x="168" y="160" width="9" height="9" rx="1.5" class="frame kF" />
      <text x="180" y="168" class="tiny">{{ L('file', '文件页') }}</text>
      <rect x="212" y="160" width="9" height="9" rx="1.5" class="frame kfree" />
      <text x="224" y="168" class="tiny">{{ L('free', '空闲') }}</text>
      <g v-if="frames.includes('Z')">
        <rect x="256" y="160" width="9" height="9" rx="1.5" class="frame kZ" />
        <text x="268" y="168" class="tiny">{{ poolName }}</text>
      </g>
      <rect x="13" y="173" width="334" height="30" rx="4" class="box" />
      <rect v-for="(k, i) in frames" :key="i" :x="fx(i) + 0.8" y="176" :width="FW - 1.6" height="24" rx="1.5" class="frame" :class="'k' + (k === '.' ? 'free' : k)" />
    </g>
    <!-- watermarks: kswapd wakes below low, stops at high -->
    <g :class="part('wm')">
      <path :d="`M${fx(20)},166 L${fx(20)},206 M${fx(22)},166 L${fx(22)},206`" class="wmark" />
      <text :x="fx(20) - 3" y="166" class="tiny end">{{ L('high', '高水位') }}</text>
      <text :x="fx(22) + 2" y="166" class="tiny">{{ L('low', '低水位') }}</text>
    </g>

    <!-- where pages go -->
    <g :class="part('fs')">
      <rect x="124" y="262" width="96" height="46" rx="5" class="box floor" />
      <text x="172" y="280" class="lbl c small">{{ L('File system', '文件系统') }}</text>
      <text x="172" y="295" class="tiny c">{{ L('the files, on disk', '文件，在磁盘上') }}</text>
    </g>
    <g :class="part('disk')">
      <rect x="16" y="262" width="96" height="46" rx="5" class="box floor" />
      <text x="64" y="280" class="lbl c small">{{ L('Swap partition', '交换分区') }}</text>
      <text x="64" y="295" class="tiny c">{{ L('disk or SSD', '磁盘或 SSD') }}</text>
    </g>
    <g :class="part('zram')">
      <rect x="232" y="262" width="112" height="46" rx="5" class="box gate" />
      <text x="288" y="280" class="lbl c small">/dev/zram0</text>
      <text x="288" y="295" class="tiny c">{{ L('compressor + RAM', '压缩器 + 内存') }}</text>
      <!-- its pool is RAM: the purple frames -->
      <path v-if="frames.includes('Z')" :d="`M300,262 L${fx(17)},204`" class="link" />
      <text v-if="state === 'slowpath'" x="288" y="320" class="tiny c">{{ L('or this one, in RAM', '或者换成它，在内存里') }}</text>
    </g>

    <!-- flows -->
    <g :class="part('evict')">
      <path :d="`M${fx(6)},204 L64,260`" class="call" marker-end="url(#zo-arrow)" />
      <text x="100" y="236" class="tiny">{{ L('anonymous: swap out', '匿名页：换出') }}</text>
    </g>
    <g :class="part('fault')">
      <path :d="`M96,260 L${fx(23) + 4},206`" class="call dashed" marker-end="url(#zo-arrow)" />
      <text x="214" y="254" class="tiny">{{ L('fault: read back', '缺页：读回') }}</text>
    </g>
    <g :class="part('drop')">
      <path :d="`M${fx(15)},204 L172,260`" class="link solid" marker-end="url(#zo-arrow)" />
      <text :x="fx(15) + 6" y="232" class="tiny">{{ L('clean: drop, reread later', '干净的：丢掉，以后再读') }}</text>
    </g>
    <g :class="part('tozram')">
      <path :d="`M${fx(4)},204 L262,260`" class="call" marker-end="url(#zo-arrow)" />
      <text x="54" y="250" class="tiny">{{ L('swap out = compress', '换出 = 压缩') }}</text>
    </g>
    <g :class="part('zswap')">
      <path :d="`M${fx(7)},204 C${fx(7)},234 ${fx(2)},234 ${fx(2)},206`" class="call" marker-end="url(#zo-arrow)" />
      <text :x="fx(8)" y="228" class="tiny">{{ L('compress into the pool', '压缩进池') }}</text>
      <path :d="`M${fx(0) + 8},204 L${fx(0) + 14},260`" class="call dashed" marker-end="url(#zo-arrow)" />
      <text x="48" y="254" class="tiny">{{ L('pool full: oldest entries go out', '池满：最老的条目写出') }}</text>
    </g>

    <!-- killing -->
    <g :class="part('kill')">
      <path :d="`M276,96 L${AX[0] + 40},62`" class="danger" marker-end="url(#zo-arrow-bad)" />
      <path :d="`M${AX[0] + 40},22 l6,6 m0,-6 l-6,6`" class="danger" />
      <text x="180" y="72" class="tiny bad-text">{{ L('highest badness: killed', '劣度最高：被杀') }}</text>
    </g>
    <g :class="part('watch')">
      <path d="M220,96 L268,62" class="link solid" marker-end="url(#zo-arrow)" />
      <text x="262" y="73" class="tiny">{{ L('reads PSI', '读 PSI') }}</text>
    </g>
    <g :class="part('dkill')">
      <path :d="state === 'oomd' ? 'M244,30 L234,30' : 'M244,46 L230,46'" class="danger" marker-end="url(#zo-arrow-bad)" />
      <path v-for="i in killed" :key="i" :d="`M${AX[i] + 40},22 l6,6 m0,-6 l-6,6`" class="danger" />
    </g>
    <g :class="part('waiting')">
      <text x="124" y="288" class="tag bad-text">{{ L('evicted, faulted back, again and again', '换出、缺页读回，周而复始') }}</text>
    </g>

    <!-- the strip under it all: this state's numbers -->
    <g :class="part('fedora')">
      <text x="16" y="336" class="tag hi">{{ L('Fedora 33 and later:', 'Fedora 33 起：') }}</text>
      <text x="16" y="352" class="tag">{{ L('zram0 = half of RAM, at most 4 GiB', 'zram0 = 内存的一半，最多 4 GiB') }}</text>
      <text x="16" y="368" class="tag">{{ L('Android: zram, and lmkd kills background apps', 'Android：zram，再由 lmkd 杀后台应用') }}</text>
    </g>
    <g :class="part('cost')">
      <text x="16" y="336" class="tag hi">{{ L('what a fault from disk costs (the lab’s figures)', '从磁盘缺页的代价（实验里的数字）') }}</text>
      <rect x="16" y="346" width="2" height="12" class="bar" />
      <text x="24" y="356" class="tag">{{ L('memory access: 100 ns', '内存访问：100 ns') }}</text>
      <rect x="16" y="364" width="328" height="12" class="bar slow" />
      <text x="22" y="374" class="tag on-fill">{{ L('disk read: 10 ms, 100,000 times longer', '磁盘读：10 ms，长 100,000 倍') }}</text>
      <text x="16" y="394" class="tiny">{{ L('(bars not to scale: the slow one would be 100,000 times wider)', '（条形未按比例：慢的那条应宽 100,000 倍）') }}</text>
    </g>
    <g :class="part('noswap')">
      <text x="16" y="336" class="tag hi">{{ L('without swap', '没有交换时') }}</text>
      <text x="16" y="352" class="tag">{{ L('idle anonymous pages are pinned in memory', '闲置的匿名页被钉死在内存里') }}</text>
      <text x="16" y="368" class="tag">{{ L('all reclaim falls on file pages, program code too', '回收全落在文件页上，包括程序代码') }}</text>
      <text x="16" y="384" class="tag">{{ L('swap: “equality of reclamation” (Chris Down)', '交换：“让回收机会均等”（Chris Down）') }}</text>
    </g>
    <g :class="part('arith')">
      <text x="16" y="336" class="tag hi">{{ L('Fedora’s example: 16 GiB of RAM, 4 GiB zram', 'Fedora 的例子：16 GiB 内存，4 GiB zram') }}</text>
      <rect x="16" y="346" width="160" height="14" rx="2" class="frame kA" />
      <text x="96" y="357" class="tiny c on-fill">{{ L('4 GiB of pages swapped out', '换出 4 GiB 的页') }}</text>
      <rect x="16" y="366" width="80" height="14" rx="2" class="frame kZ" />
      <text x="56" y="377" class="tiny c on-fill">{{ L('2 GiB of RAM', '占 2 GiB 内存') }}</text>
      <text x="104" y="377" class="tag">{{ L('at the expected 2:1', '按预期的 2:1') }}</text>
      <text x="16" y="398" class="tag hi">{{ L('net gain 2 GiB, not 4; but ≥ 10× faster than disk', '净收益 2 GiB 而非 4；但比磁盘快至少 10 倍') }}</text>
    </g>
    <g :class="part('zswaprule')">
      <text x="16" y="336" class="tag hi">{{ L('zswap: a cache in front of the swap device', 'zswap：交换设备前的一层缓存') }}</text>
      <text x="16" y="352" class="tag">{{ L('a page that compresses never reaches the disk', '压缩成功的页不会写到磁盘') }}</text>
      <text x="16" y="368" class="tag">{{ L('when the pool is full: oldest entries, LRU order', '池满时：按 LRU 把最老的条目写出') }}</text>
      <text x="16" y="384" class="tag">{{ L('still needs a disk; zram does not', '仍然需要磁盘；zram 不需要') }}</text>
    </g>
    <g :class="part('path')">
      <text x="16" y="336" class="tag hi">{{ L('the fault path with a dirty victim', '牺牲页是脏页时的缺页路径') }}</text>
      <text x="16" y="352" class="tag">{{ L('TLB · page walk · fault · free frame · evict', 'TLB · 页表遍历 · 缺页 · 找空闲帧 · 淘汰') }}</text>
      <text x="16" y="368" class="tag">{{ L('swap out + swap in: 2 × 10 ms on disk', '换出 + 换入：磁盘上 2 × 10 ms') }}</text>
      <text x="16" y="384" class="tag">{{ L('with zram: a compression and a decompression', '换成 zram：一次压缩，一次解压') }}</text>
    </g>
    <g :class="part('badness')">
      <text x="16" y="334" class="tag hi">{{ L('badness on 16 GiB, no swap (1 unit of adj = 4,194 pages)', '16 GiB 无交换时的劣度（adj 一单位 = 4,194 页）') }}</text>
      <text x="16" y="352" class="tiny">{{ L('2 GiB resident', '驻留 2 GiB') }}</text>
      <rect x="100" y="344" width="40" height="11" rx="2" class="frame kA" />
      <text x="146" y="353" class="tiny">524,288</text>
      <text x="16" y="370" class="tiny">{{ L('+ adj 500', '+ adj 500') }}</text>
      <rect x="100" y="362" width="40" height="11" rx="2" class="frame kA" />
      <rect x="140" y="362" width="160" height="11" rx="2" class="frame adj" />
      <text x="306" y="371" class="tiny">+2,097,000</text>
      <text x="16" y="388" class="tiny">{{ L('adj −1000', 'adj −1000') }}</text>
      <text x="100" y="388" class="tiny">{{ L('never chosen', '永远不会被选中') }}</text>
      <text x="16" y="408" class="tag">{{ L('size only: resident + swapped + page tables', '只看大小：驻留 + 已换出 + 页表') }}</text>
    </g>
    <g :class="part('timeline')">
      <text x="16" y="334" class="tag hi">{{ L('one window of time', '一个时间窗口') }}</text>
      <g v-for="(st, i) in STALLS" :key="i">
        <text x="16" :y="352 + i * 14" class="tiny">{{ L(`task ${i + 1}`, `任务 ${i + 1}`) }}</text>
        <rect :x="TX" :y="345 + i * 14" :width="TW" height="9" rx="1.5" class="gauge" />
        <rect v-for="(s, j) in st" :key="j" :x="TX + s[0] * TW" :y="345 + i * 14" :width="(s[1] - s[0]) * TW" height="9" rx="1.5" class="stall" />
      </g>
      <text x="16" y="400" class="tiny">some</text>
      <rect :x="TX" y="393" :width="TW" height="9" rx="1.5" class="gauge" />
      <rect v-for="(s, j) in SOME" :key="'s' + j" :x="TX + s[0] * TW" y="393" :width="(s[1] - s[0]) * TW" height="9" rx="1.5" class="gauge-fill" />
      <text x="16" y="414" class="tiny">full</text>
      <rect :x="TX" y="407" :width="TW" height="9" rx="1.5" class="gauge" />
      <rect v-for="(s, j) in FULL" :key="'f' + j" :x="TX + s[0] * TW" y="407" :width="(s[1] - s[0]) * TW" height="9" rx="1.5" class="gauge-fill" />
      <text x="16" y="432" class="tiny">{{ L('red: waiting for memory · some: any task waits · full: all do', '红色：在等内存 · some：有任务在等 · full：全都在等') }}</text>
    </g>
    <g :class="part('window')">
      <path :d="`M${TX + 0.05 * TW},389 L${TX + 0.05 * TW},386 L${TX + 0.45 * TW},386 L${TX + 0.45 * TW},389`" class="brace" />
      <text :x="TX + 0.47 * TW" y="390" class="tiny hi">{{ L('150 ms stalled in 1 s → wake', '1 s 内停滞 150 ms → 唤醒') }}</text>
    </g>
    <g :class="part('oomdrule')">
      <text x="16" y="336" class="tag hi">{{ L('systemd-oomd’s defaults', 'systemd-oomd 的默认值') }}</text>
      <text x="16" y="352" class="tag">{{ L('a cgroup’s full pressure over 60% for 30 s,', '某 cgroup 的 full 压力持续 30 秒高于 60%，') }}</text>
      <text x="16" y="368" class="tag">{{ L('or memory and swap both over 90% used:', '或内存和交换的使用率都超过 90%：') }}</text>
      <text x="16" y="384" class="tag">{{ L('SIGKILL to every process in the cgroup', '向该 cgroup 里每个进程发 SIGKILL') }}</text>
    </g>
    <g :class="part('lmkdrule')">
      <text x="16" y="336" class="tag hi">{{ L('lmkd kills from the highest adj down', 'lmkd 从 adj 最高的往下杀') }}</text>
      <text x="16" y="352" class="tag">{{ L('medium pressure: only adj 800 and above', '中等压力：只杀 adj ≥ 800') }}</text>
      <text x="16" y="368" class="tag">{{ L('critical pressure: down to adj 0', '临界压力：一直杀到 adj 0') }}</text>
      <text x="16" y="384" class="tiny">{{ L('(documented defaults of the vmpressure configuration)', '（基于 vmpressure 的配置下，文档给出的默认值）') }}</text>
    </g>
    <g :class="part('warn')">
      <rect :x="fx(11) - 2" y="172" :width="FW * 9 + 4" height="32" rx="5" class="outline warn" />
      <text x="347" y="218" class="tiny end hi">{{ L('the pool is RAM too', '池子也是内存') }}</text>
      <rect x="229" y="259" width="118" height="52" rx="7" class="outline warn" />
      <text x="288" y="322" class="tiny c hi">{{ L('CPU for every page', '每一页都要花 CPU') }}</text>
      <rect x="245" y="93" width="102" height="52" rx="7" class="outline warn" />
      <text x="16" y="342" class="tag hi">{{ L('2:1 is an expectation, not a guarantee:', '2:1 只是预期，并无保证：') }}</text>
      <text x="16" y="358" class="tag">{{ L('encrypted, compressed or random data does not shrink', '加密、已压缩或随机的数据压不小') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.small {
  font-size: 10.5px;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.hi {
  fill: var(--ink-2);
  font-weight: 600;
}
.tag.on-fill,
.tiny.on-fill {
  fill: #fff;
}
.frame {
  stroke: none;
}
.frame.kA {
  fill: var(--p0);
}
.frame.kF {
  fill: var(--p1);
}
.frame.kZ {
  fill: var(--p4);
}
.frame.kfree {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.frame.adj {
  fill: var(--p3);
}
.gauge {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 0.8;
}
.gauge-fill {
  fill: var(--warn);
}
.stall {
  fill: var(--p3);
}
.wmark {
  stroke: var(--ink-2);
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
}
.dashed {
  stroke-dasharray: 4 3;
}
.bar {
  fill: var(--ink-2);
}
.bar.slow {
  fill: var(--p3);
}
.brace {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1;
}
.head-bad {
  fill: var(--p3);
}
.lit .frame.kZ,
.lit .gauge-fill {
  fill: var(--accent);
}
.lit .tiny {
  fill: var(--accent-ink);
}
</style>
