<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CowDemo from './CowDemo.vue'

/**
 * The running figure of the fork article: the Redis parent (left) and its child (right), each with
 * a page table, and between them the physical frames both point at. Six of a 24 GB instance's 6.3
 * million pages are drawn. What changes from state to state is who maps which frame and whether
 * the entry is read-only; the lower rows hold the disk, a memory gauge and the arithmetic.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['parent', 'child', 'clients', 'pt', 'frames', 'disk', 'write'],
  literal: ['parent', 'child', 'pt', 'frames', 'meter'],
  cow: ['parent', 'child', 'pt', 'frames'],
  ptcopy: ['parent', 'child', 'pt', 'frames', 'ptarc'],
  pause: ['parent', 'child', 'clients', 'pt', 'frames', 'note'],
  afterexit: ['parent', 'child', 'pt', 'frames', 'flip'],
  snapshot: ['parent', 'child', 'clients', 'pt', 'frames', 'disk', 'write', 'temp'],
  aoflog: ['parent', 'clients', 'aoflog'],
  aof: ['parent', 'child', 'clients', 'pt', 'frames', 'write', 'aof'],
  copies: ['parent', 'child', 'clients', 'pt', 'frames', 'meter'],
  model: ['parent', 'child', 'pt', 'frames', 'meter', 'note'],
  promise: ['parent', 'child', 'pt', 'frames', 'meter'],
  oom: ['parent', 'child', 'pt', 'frames', 'meter'],
  huge: ['parent', 'child', 'pt', 'frames', 'note'],
  rules: ['parent', 'child', 'pt', 'frames', 'rules'],
  road: ['parent', 'child', 'threads'],
}
const { part, L, viewBox } = useDrawing(props, SHOW, 440)

const ID = [0, 1, 2, 3, 4, 5]
/** Who maps what: `pm`/`cm` give the frame of each virtual page (null: not mapped); `pf`/`cf`: r read-only, w writable. */
interface World {
  pm: number[]
  cm: (number | null)[]
  pf: string
  cf: string
}
const SHARED: World = { pm: ID, cm: ID, pf: 'rrrrrr', cf: 'rrrrrr' }
const WORLDS: Record<string, World> = {
  overview: { ...SHARED, pm: [0, 1, 6, 3, 4, 5], pf: 'rrwrrr' },
  literal: { pm: ID, cm: [6, 7, 8, 9, 10, 11], pf: 'wwwwww', cf: 'wwwwww' },
  afterexit: { pm: ID, cm: [null, null, null, null, null, null], pf: 'rrwrrr', cf: 'rrrrrr' },
  snapshot: { ...SHARED, pm: [0, 1, 6, 3, 4, 5], pf: 'rrwrrr' },
  aof: { ...SHARED, pm: [0, 1, 6, 3, 4, 5], pf: 'rrwrrr' },
  copies: { ...SHARED, pm: [6, 7, 2, 8, 9, 5], pf: 'wwrwwr' },
  model: { ...SHARED, pm: [0, 6, 2, 3, 7, 5], pf: 'rwrrwr' },
  oom: { ...SHARED, pm: [6, 7, 8, 9, 10, 11], pf: 'wwwwww' },
  rules: { ...SHARED, cm: [0, 1, 2, 3, 4, null], pf: 'rrrrrw' },
}
const world = computed(() => WORLDS[props.state] ?? SHARED)
const isLiteral = computed(() => props.state === 'literal')
const isHuge = computed(() => props.state === 'huge')
/** The states that follow one key through the fork: x is 1 on page 2, and SET x 2 lands on the copy. */
const followsX = computed(() => props.state === 'snapshot' || props.state === 'aof')
const childGone = computed(() => props.state === 'afterexit' || props.state === 'oom')

const y = (i: number) => 100 + i * 22
const mid = (i: number) => y(i) + 10

const PAGES = ID
const FRAMES = [...ID, 6, 7, 8, 9, 10, 11]
const pageName = (i: number) => (props.state === 'rules' && i === 5 ? L('buffers', '缓冲区') : L(`page ${i}`, `页 ${i}`))
function frameName(f: number) {
  if (followsX.value && f === 2) return L('page 2: x=1', '页 2：x=1')
  if (followsX.value && f === 6) return L('copy: x=2', '副本：x=2')
  if (f < 6) return pageName(f)
  if (props.state === 'promise') return L('promised', '已承诺')
  const j = world.value.pm.indexOf(f)
  const k = j >= 0 ? j : world.value.cm.indexOf(f)
  return k >= 0 ? L(`copy of ${k}`, `${k} 的副本`) : L('free', '空闲')
}
const frameKind = (f: number) => {
  if (f < 6) return ''
  if (props.state === 'promise') return 'promised'
  if (isLiteral.value) return 'ghost'
  return world.value.pm.includes(f) ? 'copy' : 'free'
}

const parentSub = computed(() => {
  if (props.state === 'pause') return L('inside fork()', '卡在 fork() 里')
  if (props.state === 'oom') return 'oom-score-adj 0'
  return L('serves clients', '服务客户端')
})
const childSub = computed(() => {
  if (props.state === 'afterexit') return L('exited', '已退出')
  if (props.state === 'oom') return 'oom-score-adj 800'
  if (props.state === 'literal') return L('a full copy?', '整份拷贝？')
  if (props.state === 'pause') return L('being created', '正在创建')
  if (props.state === 'aof') return L('writes new base', '写新基础文件')
  return L('writes snapshot', '写快照')
})

// the gauge's bar is 108 wide for 48 GB, so 54 is the dataset
const EXTRA: Record<string, { w: number; ghost?: boolean; text: [string, string] }> = {
  literal: { w: 54, ghost: true, text: ['+ 24 GB up front', '预先再要 24 GB'] },
  copies: { w: 36, text: ['approaches 2×', '逼近两倍'] },
  model: { w: 20.5, text: ['about 9 GB more', '约多出 9 GB'] },
  promise: { w: 0, text: ['promised, not yet used', '已承诺，尚未用掉'] },
  oom: { w: 54, text: ['out of memory', '内存耗尽'] },
}
const extra = computed(() => EXTRA[props.state] ?? { w: 0, text: ['', ''] as [string, string] })

const NOTE: Record<string, [string, string][]> = {
  pause: [
    ['24 GB ÷ 4 KB × 8 bytes = 48 MB of page tables', '24 GB ÷ 4 KB × 8 字节 = 48 MB 页表'],
    ['about 10 ms per GB: roughly a quarter of a second', '每 GB 约 10 ms：大约四分之一秒'],
  ],
  model: [
    ['copied fraction ≈ 1 − e^(−n/N)', '复制比例 ≈ 1 − e^(−n/N)'],
    ['4 KB pages, 3 million writes: about 38%', '4 KB 页，300 万次写入：约 38%'],
  ],
  huge: [
    ['until 2020: the first write copies all 2 MB', '2020 年以前：第一次写入复制整个 2 MB'],
    ['since Linux 5.8: split, and copy only the 4 KB touched', 'Linux 5.8 起：拆分映射，只复制被写的 4 KB'],
  ],
}
const note = computed(() => NOTE[props.state] ?? [])
</script>

<template>
  <CowDemo v-if="demo && state === 'cow'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A parent and child process sharing physical memory', '共享物理内存的父进程和子进程')">
    <defs>
      <marker id="fr-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <g id="fr-lock">
        <path d="M2.5,5 V3.5 a2.5,2.5 0 0 1 5,0 V5" class="shackle" />
        <rect x="1" y="5" width="8" height="6" rx="1.2" class="lockbody" />
      </g>
    </defs>

    <!-- the two processes -->
    <g :class="part('parent')">
      <rect x="12" y="36" width="96" height="40" rx="6" class="box strong" />
      <rect x="12" y="36" width="96" height="5" rx="2" class="p0" />
      <text x="60" y="56" class="lbl c">{{ L('Redis parent', 'Redis 父进程') }}</text>
      <text x="60" y="70" class="sub c" :class="{ 'bad-text': state === 'pause' }">{{ parentSub }}</text>
    </g>
    <g :class="part('child')">
      <rect x="252" y="36" width="96" height="40" rx="6" class="box" :class="{ ghost: isLiteral, dead: childGone }" />
      <rect x="252" y="36" width="96" height="5" rx="2" class="p1" :class="{ dead: childGone || isLiteral }" />
      <text x="300" y="56" class="lbl c" :class="{ dead: childGone }">{{ L('Child', '子进程') }}</text>
      <text x="300" y="70" class="sub c">{{ childSub }}</text>
      <text v-if="childGone" x="340" y="54" class="bad-text c big">✕</text>
    </g>
    <g :class="part('clients')">
      <rect x="132" y="40" width="96" height="32" rx="6" class="box" />
      <text x="180" y="54" class="lbl c">{{ L('Clients', '客户端') }}</text>
      <text x="180" y="66" class="sub c" :class="{ code: followsX }">{{ state === 'pause' ? L('waiting', '等待中') : followsX ? 'SET x 2' : 'SET · GET' }}</text>
      <path d="M132,56 H110" :class="state === 'pause' ? 'link' : 'call'" marker-end="url(#fr-arrow)" />
    </g>

    <!-- fork() copying the entries across -->
    <g :class="part('ptarc')">
      <path d="M110,56 H250" class="call" marker-end="url(#fr-arrow)" />
      <text x="180" y="48" class="tag hi c">{{ L('fork() copies every entry', 'fork() 复制每一个页表项') }}</text>
    </g>

    <!-- the page tables -->
    <g :class="part('pt')">
      <text x="60" y="94" class="tag c">{{ L('page table', '页表') }}</text>
      <text x="300" y="94" class="tag c">{{ L('page table', '页表') }}</text>
      <template v-if="isHuge">
        <rect x="20" :y="y(0)" width="80" :height="y(5) + 20 - y(0)" rx="3" class="box" />
        <text x="60" :y="mid(2) + 8" class="tag c">{{ L('one entry', '一个页表项') }}</text>
        <rect x="260" :y="y(0)" width="80" :height="y(5) + 20 - y(0)" rx="3" class="box" />
        <text x="300" :y="mid(2) + 8" class="tag c">{{ L('one entry', '一个页表项') }}</text>
      </template>
      <template v-else>
        <g v-for="i in PAGES" :key="'p' + i">
          <rect x="20" :y="y(i)" width="80" height="20" rx="3" class="box" />
          <text x="26" :y="y(i) + 14" class="sub">{{ pageName(i) }}</text>
          <text x="94" :y="y(i) + 14" class="flag end" :class="{ rw: world.pf[i] === 'w' }">{{ world.pf[i] === 'w' ? 'RW' : 'RO' }}</text>
        </g>
        <g v-for="i in PAGES" :key="'c' + i" :class="{ dead: childGone }">
          <rect x="260" :y="y(i)" width="80" height="20" rx="3" class="box" :class="{ ghost: isLiteral }" />
          <text x="266" :y="y(i) + 14" class="sub">{{ pageName(i) }}</text>
          <text x="334" :y="y(i) + 14" class="flag end" :class="{ rw: world.cf[i] === 'w' }">{{ world.cf[i] === 'w' ? 'RW' : 'RO' }}</text>
        </g>
      </template>
    </g>

    <!-- physical memory, and who points at what -->
    <g :class="part('frames')">
      <text x="180" y="94" class="tag c">{{ L('physical memory', '物理内存') }}</text>
      <template v-if="isHuge">
        <rect x="140" :y="y(0)" width="80" :height="y(5) + 20 - y(0)" rx="3" class="box" />
        <text x="180" :y="mid(2) + 3" class="lbl c">2 MB</text>
        <text x="180" :y="mid(3) + 2" class="sub c">{{ L('one huge page', '一个大页') }}</text>
        <rect x="140" :y="y(6)" width="80" :height="y(11) + 20 - y(6)" rx="3" class="p0" />
        <text x="180" :y="mid(8) + 3" class="lbl c on-text">2 MB</text>
        <text x="180" :y="mid(9) + 2" class="sub c on-text">{{ L('all copied', '整个复制') }}</text>
        <path d="M100,165 L140,297" class="pline" />
        <path d="M260,165 L220,165" class="cline" />
      </template>
      <template v-else>
        <g v-for="f in FRAMES" :key="f">
          <rect x="140" :y="y(f)" width="80" height="20" rx="3" class="frame" :class="frameKind(f)" />
          <text x="180" :y="y(f) + 14" class="sub c" :class="{ 'on-text': frameKind(f) === 'copy', 'free-text': frameKind(f) === 'free' }">{{ frameName(f) }}</text>
        </g>
        <path v-for="i in PAGES" :key="'pl' + i" :d="`M100,${mid(i)} L140,${mid(world.pm[i])}`" class="pline" />
        <template v-for="i in PAGES" :key="'cl' + i">
          <path v-if="world.cm[i] !== null" :d="`M260,${mid(i)} L220,${mid(world.cm[i] as number)}`" class="cline" :class="{ dash: isLiteral }" />
        </template>
      </template>
    </g>
    <g :class="part('flip')">
      <text x="60" y="250" class="tag c">{{ L('next write: fault,', '下一次写入：页错误，') }}</text>
      <text x="60" y="263" class="tag c">{{ L('then RO → RW, no copy', '然后 RO → RW，不复制') }}</text>
    </g>

    <!-- the snapshot on disk -->
    <g :class="part('write')">
      <path d="M300,234 V286" class="call" marker-end="url(#fr-arrow)" />
      <text x="306" y="264" class="tag">{{ L('writes', '写入') }}</text>
    </g>
    <g :class="part('disk')">
      <rect x="236" y="288" width="112" height="74" rx="6" class="box floor" />
      <text x="246" y="303" class="tag">{{ L('disk', '磁盘') }}</text>
      <g :class="part('temp')">
        <rect x="246" y="308" width="92" height="17" rx="3" class="box" />
        <text x="292" y="320" class="sub c">{{ followsX ? L('temp file: x=1', '临时文件：x=1') : L('temporary file', '临时文件') }}</text>
        <path d="M270,325 V338" class="call" marker-end="url(#fr-arrow)" />
        <text x="278" y="336" class="code small">rename()</text>
      </g>
      <rect x="246" y="340" width="92" height="17" rx="3" class="box" />
      <text x="292" y="352" class="code c small">dump.rdb</text>
    </g>

    <!-- one write command on its way to the AOF, in order -->
    <g :class="part('aoflog')">
      <path d="M60,76 V86 H180 V94" class="call" marker-end="url(#fr-arrow)" />
      <rect x="50" y="96" width="260" height="30" rx="5" class="box" />
      <text x="180" y="115" class="lbl c">{{ L('run the command in memory', '在内存中执行命令') }}</text>
      <path d="M180,126 V138" class="call" marker-end="url(#fr-arrow)" />
      <rect x="50" y="140" width="260" height="30" rx="5" class="box" />
      <text x="180" y="159" class="lbl c">{{ L('append to the buffer (aof_buf)', '追加到缓冲区（aof_buf）') }}</text>
      <path d="M180,170 V182" class="call" marker-end="url(#fr-arrow)" />
      <rect x="50" y="184" width="260" height="30" rx="5" class="box strong" />
      <text x="180" y="203" class="lbl c">{{ L('write() to the AOF file', 'write() 写入 AOF 文件') }}</text>
      <path d="M180,214 V226" class="call" marker-end="url(#fr-arrow)" />
      <rect x="50" y="228" width="260" height="42" rx="5" class="box" />
      <text x="180" y="245" class="code c small">fsync()</text>
      <text x="180" y="261" class="sub c">{{ L('always: before replies · everysec: about 1/s', 'always：回复之前 · everysec：约每秒一次') }}</text>
      <path d="M180,270 V284" class="call" marker-end="url(#fr-arrow)" />
      <rect x="50" y="286" width="260" height="30" rx="5" class="box" />
      <text x="180" y="305" class="lbl c">{{ L('reply to the client', '回复客户端') }}</text>
    </g>

    <!-- an AOF rewrite: the child's base, the parent's increments, and the manifest naming both -->
    <g :class="part('aof')">
      <path d="M60,234 V286" class="call" marker-end="url(#fr-arrow)" />
      <text x="66" y="264" class="tag">{{ L('appends', '追加') }}</text>
      <rect x="12" y="288" width="112" height="74" rx="6" class="box floor" />
      <text x="22" y="303" class="tag">{{ L('disk', '磁盘') }}</text>
      <rect x="22" y="308" width="92" height="17" rx="3" class="box" />
      <text x="68" y="320" class="code c small">incr.aof</text>
      <text x="68" y="345" class="code c small">SET x 2</text>
      <rect x="236" y="288" width="112" height="74" rx="6" class="box floor" />
      <text x="246" y="303" class="tag">{{ L('disk', '磁盘') }}</text>
      <rect x="246" y="308" width="92" height="17" rx="3" class="box" />
      <text x="292" y="320" class="code c small">base.rdb</text>
      <text x="292" y="345" class="code c small">x = 1</text>
      <path d="M68,362 V378 M292,362 V378" class="link solid" />
      <rect x="12" y="378" width="336" height="52" rx="6" class="box" />
      <text x="180" y="400" class="tag hi c">{{ L('manifest: new base + increments', '清单（manifest）：新基础文件 + 增量文件') }}</text>
      <text x="180" y="418" class="tag c">{{ L('restart: load x = 1, then replay SET x 2', '重启：加载 x = 1，再重放 SET x 2') }}</text>
    </g>

    <!-- how much memory is in use -->
    <g :class="part('meter')">
      <text x="16" y="306" class="tag">{{ L('memory in use', '内存占用') }}</text>
      <rect x="16" y="312" width="108" height="10" rx="2" class="sunk" />
      <rect x="16" y="312" width="54" height="10" rx="2" class="muted-fill" />
      <rect x="70" y="312" :width="extra.w" height="10" rx="2" :class="extra.ghost ? 'bar-ghost' : 'p0'" />
      <text x="70" y="335" class="tag c">24 GB</text>
      <text x="124" y="335" class="tag end">48 GB</text>
      <text x="16" y="352" class="tag hi">{{ L(...extra.text) }}</text>
    </g>

    <!-- what Redis does about it -->
    <g :class="part('rules')">
      <text x="14" y="256" class="tag hi">{{ L('while a child lives:', '子进程存活期间：') }}</text>
      <text x="14" y="272" class="tag">{{ L('no LRU/LFU updates', '不更新 LRU/LFU') }}</text>
      <text x="14" y="286" class="tag">{{ L('no hash-table resize', '不调整哈希表大小') }}</text>
      <text x="346" y="256" class="tag hi end">{{ L('the child drops buffers:', '子进程丢弃缓冲区：') }}</text>
      <text x="346" y="272" class="code small end">MADV_DONTNEED</text>
    </g>

    <!-- the arithmetic -->
    <g :class="part('note')">
      <rect x="12" y="378" width="336" height="52" rx="6" class="box" />
      <text v-for="(n, i) in note" :key="i" x="180" :y="400 + i * 18" :class="i === 0 ? 'tag hi c' : 'tag c'">{{ L(n[0], n[1]) }}</text>
    </g>

    <!-- fork and threads -->
    <g :class="part('threads')">
      <rect x="12" y="98" width="130" height="150" rx="9" class="outline" />
      <rect x="218" y="98" width="130" height="150" rx="9" class="outline" />
      <text x="77" y="114" class="tag c">{{ L('parent: three threads', '父进程：三个线程') }}</text>
      <text x="283" y="114" class="tag c">{{ L('child: one thread', '子进程：一个线程') }}</text>
      <g v-for="(t, i) in [L('calls fork()', '调用 fork()'), L('holds a lock', '持有一把锁'), L('working', '在工作')]" :key="i">
        <rect x="24" :y="124 + i * 36" width="106" height="26" rx="13" class="box" />
        <text x="77" :y="141 + i * 36" class="sub c">{{ t }}</text>
      </g>
      <use href="#fr-lock" x="116" y="166" />
      <rect x="230" y="124" width="106" height="26" rx="13" class="box" />
      <text x="283" y="141" class="sub c">{{ L('the calling thread', '调用的那个线程') }}</text>
      <use href="#fr-lock" x="240" y="176" />
      <text x="256" y="186" class="tag">{{ L('still locked,', '仍然锁着，') }}</text>
      <text x="256" y="200" class="tag bad-text">{{ L('nobody to unlock', '没有人来解锁') }}</text>
      <path d="M142,137 H216" class="call" marker-end="url(#fr-arrow)" />
      <text x="180" y="131" class="code c small">fork()</text>
      <text x="180" y="272" class="tag c">{{ L('posix_spawn(): the child borrows memory, no page-table copy', 'posix_spawn()：子进程借用内存，不复制页表') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.frame {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.frame.free {
  stroke: var(--rule);
  stroke-dasharray: 2 2;
}
.frame.copy {
  fill: var(--p0);
  stroke: none;
}
.frame.ghost,
.frame.promised {
  fill: none;
  stroke: var(--warn);
  stroke-dasharray: 4 3;
}
.ghost {
  fill: none;
  stroke-dasharray: 4 3;
}
.bar-ghost {
  fill: none;
  stroke: var(--warn);
  stroke-dasharray: 3 2;
}
.pline,
.cline {
  fill: none;
  stroke-width: 1.1;
}
.pline {
  stroke: var(--p0);
}
.cline {
  stroke: var(--p1);
}
.cline.dash {
  stroke-dasharray: 3 3;
}
.flag {
  font-size: 8.5px;
  font-weight: 700;
  fill: var(--muted);
}
.flag.rw {
  fill: var(--ok);
}
.on-text {
  fill: #fff;
}
.free-text {
  fill: var(--rule-strong);
}
.small {
  font-size: 9.5px;
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
.lit .frame {
  stroke: var(--accent);
  stroke-width: 1.8;
}
</style>
