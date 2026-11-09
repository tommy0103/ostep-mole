<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import CacheAsideDemo from './CacheAsideDemo.vue'

/**
 * The running figure of the caching article: the six caches of one page view, stacked as the
 * request meets them. Each row is a layer (web, application, database, kernel, silicon); inside
 * it, the caches of that layer with their units drawn as cells. A state shows one layer's
 * mechanism (sets, lists, counts, lifetimes) on those same cells, so the layout never moves.
 */
const props = defineProps<DrawingProps>()

const BASE = ['zones', 'web', 'browser', 'cdn', 'app', 'redis', 'memcached', 'db', 'pg', 'innodb', 'kernel', 'pagecache', 'disk', 'cpu', 'cores', 'l1', 'tlb', 'l3', 'dram', 'pt', 'links']
const SHOW: Record<string, string[]> = {
  overview: [...BASE, 'chips', 'units'],
  cpu: [...BASE, 'sets'],
  coherence: [...BASE, 'coh'],
  tlb: [...BASE, 'reach'],
  shootdown: [...BASE, 'shoot'],
  pagecache: [...BASE, 'lists', 'readahead', 'units'],
  writeback: [...BASE, 'dirty', 'flush', 'units'],
  cdn: [...BASE, 'onehit', 'units'],
  http: [...BASE, 'fresh'],
  bufferpool: [...BASE, 'clock', 'midpoint', 'ring'],
  twice: [...BASE, 'twice', 'wal', 'units'],
  appcache: [...BASE, 'sample', 'segments'],
  scans: [...BASE, 'scans', 'segments', 'midpoint', 'lists', 'ring'],
  invalidation: [...BASE, 'inval', 'units'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 452)
const has = (id: string) => shown.value.has(id)

/** x positions of n cells of width w and gap g starting at x0 */
const row = (x0: number, n: number, w: number, g = 3) => Array.from({ length: n }, (_, i) => x0 + i * (w + g))

// row A: responses of every size
const BROWSER = [
  [134, 10],
  [147, 18],
  [168, 8],
]
const CDN_W = [12, 24, 8, 16, 10, 28, 12]
const CDN = CDN_W.map((w, i) => [210 + CDN_W.slice(0, i).reduce((a, b) => a + b + 2, 0), w])
const ONE_HIT = [2, 4]
// row B and C: items and pages
const REDIS = row(134, 7, 10)
const SAMPLED = [0, 2, 3, 5, 6]
const MEMC = row(242, 7, 10)
const PG = row(134, 7, 10)
const COUNTS = [3, 1, 5, 0, 2, 4, 1]
const INNO = row(242, 8, 9)
// row D: page cache pages
const PC = row(134, 6, 10)
// L3: 4 sets of 8 ways
const WAYS = row(124, 8, 10, 2)
const SETS = [398, 408, 418, 428]

const midpoint = computed(() => has('midpoint'))
</script>

<template>
  <CacheAsideDemo v-if="demo && state === 'appcache'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Six caches, from the web down to the CPU', '从 Web 到 CPU 的六层缓存')">
    <defs>
      <marker id="ce-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- where each layer lives -->
    <g :class="part('zones')">
      <text x="8" y="14" class="tag">{{ L('user space', '用户空间') }}</text>
      <text x="8" y="222" class="tag">{{ L('kernel', '内核') }}</text>
      <text x="8" y="300" class="tag">{{ L('silicon', '芯片') }}</text>
    </g>

    <!-- ───────── row A: the web ───────── -->
    <g :class="part('web')">
      <rect x="8" y="20" width="344" height="54" rx="6" class="box" />
      <text x="16" y="40" class="lbl">{{ L('CDN · browser', 'CDN · 浏览器') }}</text>
      <text x="16" y="54" class="sub">{{ L('HTTP responses', 'HTTP 响应') }}</text>
    </g>
    <g :class="part('browser')">
      <rect x="128" y="26" width="68" height="42" rx="4" class="box inner" />
      <text x="134" y="37" class="tag">{{ L('browser', '浏览器') }}</text>
      <rect v-for="[x, w] in BROWSER" :key="'b' + x" :x="x" y="42" :width="w" height="10" rx="1.5" class="cell" />
      <text x="134" y="64" class="tag" :class="{ gone: has('fresh') }">{{ L('private', '私有') }}</text>
    </g>
    <g :class="part('cdn')">
      <rect x="204" y="26" width="140" height="42" rx="4" class="box inner" />
      <text x="210" y="37" class="tag">{{ L('CDN node · shared', 'CDN 节点 · 共享') }}</text>
      <rect
        v-for="([x, w], i) in CDN"
        :key="'c' + x"
        :x="x"
        y="42"
        :width="w"
        height="10"
        rx="1.5"
        class="cell"
        :class="{ once: has('onehit') && ONE_HIT.includes(i) }"
      />
    </g>
    <g :class="part('onehit')">
      <text x="210" y="64" class="tag">{{ L('dashed: one-hit wonders', '虚线：一次性访问对象') }}</text>
      <text x="16" y="67" class="tag">{{ L('units of any size', '单位大小不一') }}</text>
    </g>
    <g :class="part('fresh')">
      <text x="134" y="64" class="code small">max-age=60</text>
      <text x="210" y="64" class="code small">s-maxage=600</text>
      <text x="16" y="67" class="tag hi">{{ L('lifetime · 304 · purge', '新鲜期 · 304 · 清除') }}</text>
    </g>

    <!-- ───────── row B: application caches ───────── -->
    <g :class="part('app')">
      <rect x="8" y="86" width="344" height="54" rx="6" class="box" />
      <text x="16" y="106" class="lbl">{{ L('App cache', '应用缓存') }}</text>
      <text x="16" y="120" class="sub">{{ L('key → value', '键 → 值') }}</text>
    </g>
    <g :class="part('redis')">
      <rect x="128" y="92" width="100" height="42" rx="4" class="box inner" />
      <text x="134" y="103" class="tag">Redis</text>
      <rect
        v-for="(x, i) in REDIS"
        :key="'r' + x"
        :x="x"
        y="108"
        width="10"
        height="10"
        rx="1.5"
        class="cell"
        :class="{ picked: has('sample') && SAMPLED.includes(i) }"
      />
    </g>
    <g :class="part('sample')">
      <path d="M173,109 l8,8 M181,109 l-8,8" class="danger" />
      <text x="134" y="130" class="tag">{{ L('samples 5 keys', '抽样 5 个键') }}</text>
      <text x="16" y="133" class="tag">{{ L('cache-aside', '旁路缓存') }}</text>
    </g>
    <g :class="part('memcached')">
      <rect x="236" y="92" width="108" height="42" rx="4" class="box inner" />
      <text x="242" y="103" class="tag">memcached</text>
      <rect v-for="x in MEMC" :key="'m' + x" :x="x" y="108" width="10" height="10" rx="1.5" class="cell" />
    </g>
    <g :class="part('segments')">
      <path d="M266.5,105 V121 M305.5,105 V121" class="divider" />
      <rect x="240" y="106" width="28" height="14" rx="2" class="seg" :class="{ warnline: has('scans') }" />
      <text x="254" y="130" class="tag c">HOT</text>
      <text x="286" y="130" class="tag c">WARM</text>
      <text x="318" y="130" class="tag c">COLD</text>
      <path d="M321,109 l8,8 M329,109 l-8,8" class="danger" :class="{ gone: has('scans') }" />
    </g>

    <!-- ───────── row C: database buffer pools ───────── -->
    <g :class="part('db')">
      <rect x="8" y="152" width="344" height="54" rx="6" class="box" />
      <text x="16" y="172" class="lbl">{{ L('Buffer pool', '缓冲池') }}</text>
      <text x="16" y="186" class="sub">{{ L('a database’s own', '数据库自己的') }}</text>
    </g>
    <g :class="part('pg')">
      <rect x="128" y="158" width="100" height="42" rx="4" class="box inner" />
      <text x="134" y="169" class="tag">PostgreSQL</text>
      <rect
        v-for="(x, i) in PG"
        :key="'p' + x"
        :x="x"
        y="174"
        width="10"
        height="10"
        rx="1.5"
        class="cell"
        :class="{ victim: has('clock') && i === 3, same: has('twice') && i === 6 }"
      />
    </g>
    <g :class="part('clock')">
      <text v-for="(x, i) in PG" :key="'n' + x" :x="x + 5" y="182" class="digit c">{{ COUNTS[i] }}</text>
      <path d="M175,189 l3,-3 l3,3" class="hand" />
      <text x="16" y="199" class="tag">{{ L('clock · midpoint LRU', '时钟 · 中点插入') }}</text>
    </g>
    <g :class="part('ring')">
      <text x="134" y="196" class="tag" :class="{ warn: has('scans') }">{{ L('scans: own ring', '扫描：私有小环') }}</text>
    </g>
    <g :class="part('wal')">
      <text x="16" y="199" class="tag hi">{{ L('log first (WAL)', '先写日志（WAL）') }}</text>
    </g>
    <g :class="part('innodb')">
      <rect x="236" y="158" width="108" height="42" rx="4" class="box inner" />
      <text x="242" y="169" class="tag">InnoDB</text>
      <rect
        v-for="(x, i) in INNO"
        :key="'i' + x"
        :x="x"
        y="174"
        width="9"
        height="10"
        rx="1.5"
        class="cell"
        :class="{ fresh: midpoint && !has('scans') && i === 5 }"
      />
    </g>
    <g :class="part('midpoint')">
      <path d="M300.5,171 V187" class="divider" />
      <rect x="300" y="172" width="38" height="14" rx="2" class="seg" :class="{ warnline: has('scans') }" />
      <text x="270" y="196" class="tag c">{{ L('young', '年轻') }}</text>
      <text x="319" y="196" class="tag c">{{ L('old', '老') }}</text>
    </g>

    <!-- ───────── row D: the kernel's page cache, and the disk ───────── -->
    <g :class="part('kernel')">
      <rect x="8" y="230" width="224" height="54" rx="6" class="box" />
      <text x="16" y="250" class="lbl">{{ L('Page cache', '页缓存') }}</text>
      <text x="16" y="264" class="sub">{{ L('file data', '文件数据') }}</text>
    </g>
    <g :class="part('pagecache')">
      <rect x="128" y="236" width="96" height="42" rx="4" class="box inner" />
      <text x="134" y="247" class="tag">Linux</text>
      <rect
        v-for="(x, i) in PC"
        :key="'k' + x"
        :x="x"
        y="252"
        width="10"
        height="10"
        rx="1.5"
        class="cell"
        :class="{ dirtycell: has('dirty') && (i === 1 || i === 4), same: has('twice') && i === 2 }"
      />
    </g>
    <g :class="part('lists')">
      <path d="M171.5,249 V265" class="divider" />
      <rect x="171" y="250" width="40" height="14" rx="2" class="seg" :class="{ warnline: has('scans') }" />
      <text x="151" y="275" class="tag c">{{ L('active', '活跃') }}</text>
      <text x="191" y="275" class="tag c">{{ L('inactive', '非活跃') }}</text>
    </g>
    <g :class="part('disk')">
      <rect x="242" y="230" width="110" height="54" rx="6" class="box floor" />
      <text x="297" y="250" class="lbl c">{{ L('Disk', '磁盘') }}</text>
    </g>
    <g :class="part('readahead')">
      <path d="M262,262 L216,262" class="call" marker-end="url(#ce-arrow)" />
      <text x="297" y="266" class="sub c">{{ L('readahead', '预读') }}</text>
      <text x="297" y="278" class="tag c">{{ L('sequential reads', '遇到顺序读') }}</text>
      <text x="16" y="277" class="tag">{{ L('lists or MGLRU', '双链表或 MGLRU') }}</text>
    </g>
    <g :class="part('dirty')">
      <text x="16" y="277" class="tag">{{ L('write(): mark dirty', 'write()：弄脏即返回') }}</text>
    </g>
    <g :class="part('flush')">
      <path d="M216,262 L262,262" class="call" marker-end="url(#ce-arrow)" />
      <text x="297" y="266" class="sub c">{{ L('every 5 s', '每 5 秒刷写') }}</text>
      <text x="297" y="278" class="tag c">{{ L('fsync(): now', 'fsync()：立刻') }}</text>
    </g>

    <g :class="part('units')">
      <text x="134" y="196" class="tag">8 KiB</text>
      <text x="242" y="196" class="tag">16 KiB</text>
      <text x="134" y="276" class="tag" :class="{ gone: has('lists') }">4 KiB</text>
    </g>
    <!-- ───────── row E: the CPU and memory ───────── -->
    <g :class="part('cpu')">
      <rect x="8" y="308" width="224" height="140" rx="6" class="box floor" />
      <text x="16" y="322" class="lbl">CPU</text>
    </g>
    <g :class="part('dram')">
      <rect x="242" y="308" width="110" height="140" rx="6" class="box floor" />
      <text x="297" y="324" class="lbl c">DRAM</text>
    </g>
    <g :class="part('pt')">
      <rect x="250" y="334" width="94" height="26" rx="3" class="box inner" :class="{ changed: has('shoot') }" />
      <text x="297" y="351" class="sub c">{{ L('page tables', '页表') }}</text>
    </g>
    <g :class="part('cores')">
      <rect x="16" y="334" width="100" height="52" rx="5" class="box" />
      <text x="22" y="381" class="tag">{{ L('core 0', '核 0') }}</text>
      <rect x="124" y="334" width="100" height="52" rx="5" class="box" />
      <text x="130" y="381" class="tag">{{ L('core 1', '核 1') }}</text>
    </g>
    <g :class="part('l1')">
      <rect x="22" y="340" width="40" height="30" rx="3" class="box inner" :class="{ focus: has('coh') }" />
      <text x="42" y="353" class="lbl c">L1</text>
      <rect x="130" y="340" width="40" height="30" rx="3" class="box inner" :class="{ focus: has('coh') }" />
      <text x="150" y="353" class="lbl c">L1</text>
      <rect x="29" y="357" width="26" height="7" rx="1.5" class="cell" :class="{ dirtycell: has('coh') }" />
      <rect x="137" y="357" width="26" height="7" rx="1.5" class="cell" :class="{ once: has('coh') }" />
    </g>
    <g :class="part('tlb')">
      <rect x="68" y="340" width="42" height="30" rx="3" class="box inner" :class="{ focus: has('reach') || has('shoot') }" />
      <text x="89" y="353" class="lbl c">TLB</text>
      <rect x="176" y="340" width="42" height="30" rx="3" class="box inner" :class="{ focus: has('reach') || has('shoot') }" />
      <text x="197" y="353" class="lbl c">TLB</text>
      <rect v-for="x in [74, 85, 96]" :key="'t0' + x" :x="x" y="357" width="9" height="7" rx="1.5" class="cell" />
      <rect v-for="x in [182, 193, 204]" :key="'t1' + x" :x="x" y="357" width="9" height="7" rx="1.5" class="cell" />
    </g>
    <g :class="part('coh')">
      <path d="M42,340 C52,318 140,318 150,340" class="call" marker-end="url(#ce-arrow)" />
      <text x="96" y="317" class="tag hi c">{{ L('write → invalidate', '写 → 让副本失效') }}</text>
      <path d="M146,357 l8,7 M154,357 l-8,7" class="danger" />
    </g>
    <g :class="part('shoot')">
      <path d="M89,340 C99,318 187,318 197,340" class="call" marker-end="url(#ce-arrow)" />
      <text x="143" y="317" class="tag hi c">{{ L('interrupt: flush', '打断：冲掉') }}</text>
      <path d="M85,357 l9,7 M94,357 l-9,7" class="danger" />
      <path d="M193,357 l9,7 M202,357 l-9,7" class="danger" />
      <text x="297" y="376" class="tag bad-text c">{{ L('entry changed', '表项被修改') }}</text>
    </g>
    <g :class="part('l3')">
      <rect x="16" y="392" width="208" height="50" rx="5" class="box" :class="{ focus: has('sets') }" />
      <text x="22" y="407" class="lbl">{{ L('L3 · shared', 'L3 · 共享') }}</text>
      <text x="22" y="421" class="sub">{{ L('64 B lines', '64 B 缓存行') }}</text>
      <template v-for="(y, si) in SETS" :key="'s' + y">
        <rect v-for="x in WAYS" :key="'w' + x" :x="x" :y="y" width="10" height="7" rx="1" class="cell" :class="{ setpick: has('sets') && si === 2 }" />
      </template>
    </g>
    <g :class="part('sets')">
      <text x="22" y="435" class="tag hi">{{ L('one set, 8 ways', '一组，8 路') }}</text>
    </g>
    <g :class="part('reach')">
      <text x="250" y="390" class="tag">{{ L('1,536 entries cover', '1,536 项可覆盖') }}</text>
      <text x="250" y="406" class="sub">{{ L('4 KiB pages: 6 MiB', '4 KiB 页：6 MiB') }}</text>
      <text x="250" y="422" class="sub">{{ L('2 MiB pages: 3 GiB', '2 MiB 页：3 GiB') }}</text>
    </g>

    <g :class="part('links')">
      <path d="M224,257 L242,257" class="link solid" :class="{ gone: has('readahead') || has('flush') }" />
      <path d="M224,417 L242,417" class="link solid" />
      <path d="M218,353 C230,353 236,347 250,347" class="link" />
    </g>
    <!-- the same block, in two caches at once -->
    <g :class="part('twice')">
      <path d="M217,185 C217,215 165,215 165,251" class="link warn-link" />
      <text x="222" y="222" class="tag hi">{{ L('one block, twice', '同一个块，两份') }}</text>
    </g>

    <!-- the hook's request: hits and misses on the way down -->
    <g :class="part('chips')">
      <text x="16" y="67" class="tag hit">{{ L('hit: the image', '命中：那张图片') }}</text>
      <text x="16" y="133" class="tag miss">{{ L('miss ↓', '未命中 ↓') }}</text>
      <text x="16" y="199" class="tag miss">{{ L('miss ↓ 8 KiB read', '未命中 ↓ 读 8 KiB') }}</text>
      <text x="16" y="277" class="tag hit">{{ L('hit: the block', '命中：那个块') }}</text>
      <text x="48" y="322" class="tag">{{ L('every instruction, every address', '每条指令、每个地址都经过这里') }}</text>
    </g>

    <!-- what each layer does about stale copies -->
    <g :class="part('inval')">
      <text x="16" y="67" class="tag hi">{{ L('lifetimes · purge', '新鲜期 · 清除') }}</text>
      <text x="16" y="133" class="tag hi">{{ L('delete · TTL · lease', '删除 · TTL · 租约') }}</text>
      <text x="16" y="199" class="tag hi">{{ L('owns the data', '自己就是主人') }}</text>
      <text x="16" y="277" class="tag hi">{{ L('the only copy', '唯一的副本') }}</text>
      <text x="48" y="322" class="tag hi">{{ L('coherence · TLBs flushed by hand', '一致性协议 · TLB 手动冲刷') }}</text>
    </g>

    <!-- scans held apart: the same marks in every layer -->
    <g :class="part('scans')">
      <text x="16" y="133" class="tag hi">{{ L('scans: HOT → COLD', '扫描：HOT → COLD') }}</text>
      <text x="16" y="199" class="tag hi">{{ L('ring · old sublist', '小环 · 老子链表') }}</text>
      <text x="16" y="277" class="tag hi">{{ L('inactive list', '非活跃链表') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.box.inner {
  fill: var(--bg-sunk);
  stroke: var(--rule);
}
.cell {
  fill: var(--p0);
  opacity: 0.55;
  stroke: none;
  transition: fill 0.3s, opacity 0.3s;
}
.cell.once {
  fill: none;
  opacity: 1;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 2 1.5;
}
.cell.picked {
  opacity: 1;
}
.cell.victim {
  fill: var(--p3);
  opacity: 0.9;
}
.cell.fresh {
  fill: var(--accent);
  opacity: 1;
}
.cell.dirtycell {
  fill: var(--warn);
  opacity: 1;
}
.cell.same {
  fill: var(--warn);
  opacity: 1;
}
.cell.setpick {
  fill: var(--accent);
  opacity: 0.85;
}
.lit .cell {
  opacity: 0.9;
}
.divider {
  stroke: var(--ink-2);
  stroke-width: 1.2;
}
.seg {
  fill: none;
  stroke: none;
}
.seg.warnline {
  stroke: var(--warn);
  stroke-width: 1.6;
}
.mask {
  fill: none;
}
.digit {
  font-size: 8.5px;
  font-weight: 700;
  fill: #fff;
}
.hand {
  fill: none;
  stroke: var(--p3);
  stroke-width: 1.4;
}
.ring {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
}
.ring.warnring {
  stroke: var(--warn);
  stroke-width: 1.8;
}
.tag.warn {
  fill: var(--warn);
  font-weight: 600;
}
.code.small {
  font-size: 9px;
}
.tag.hit {
  fill: var(--ok);
  font-weight: 600;
}
.tag.miss {
  fill: var(--p3);
  font-weight: 600;
}
.warn-link {
  stroke: var(--warn);
  stroke-width: 1.4;
}
.box.focus {
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.box.inner.changed {
  stroke: var(--p3);
  stroke-width: 1.6;
}
</style>
