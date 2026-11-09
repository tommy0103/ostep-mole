<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Cache-aside in seven steps: a read misses and fetches v1, a write updates the row to v2 and
 * deletes the key, the late fill leaves v1 cached; then the same with a lease, which the delete
 * cancels so the late fill is refused; and a lease against a stampede.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
const row = computed(() => (s.value >= 2 ? 'v2' : 'v1'))
const cached = computed(() => (s.value === 3 ? 'v1' : s.value === 6 ? L('(missing)', '（没有）') : L('(none)', '（没有）')))
const holds = computed(() => (s.value >= 1 && s.value <= 5 ? 'v1' : s.value === 6 ? 'v2' : ''))
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 452" role="img" :aria-label="L('Cache-aside and leases, step by step', '旁路缓存与租约，分步演示')">
    <defs>
      <marker id="ca-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="ca-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="headbad" />
      </marker>
    </defs>

    <!-- the cache, with the key for row 42 -->
    <rect x="100" y="24" width="160" height="84" rx="6" class="box strong" />
    <text x="180" y="42" class="lbl c">{{ L('Cache', '缓存') }}</text>
    <text x="180" y="56" class="sub c">Redis · memcached</text>
    <text x="180" y="72" class="tag c">{{ L('key for row 42', '第 42 行的键') }}</text>
    <rect x="124" y="78" width="112" height="22" rx="3" class="slot" :class="{ stale: s === 3 }" />
    <text x="180" y="93" class="code c" :class="{ 'bad-text': s === 3 }">{{ cached }}</text>
    <g class="fade" :class="{ show: s === 3 }">
      <text x="180" y="122" class="tag bad-text c">{{ L('stale until the TTL expires', '陈旧，直到 TTL 到期') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 5 }">
      <text x="180" y="122" class="tag bad-text c">{{ L('fill refused: lease cancelled', '回填被拒：租约已作废') }}</text>
    </g>

    <!-- the two app servers -->
    <rect x="8" y="186" width="104" height="64" rx="6" class="box" :class="{ litbox: s === 1 || s === 3 || s === 5 || s === 6 }" />
    <text x="60" y="204" class="lbl c">{{ L('Reader', '读者') }}</text>
    <text x="60" y="218" class="sub c">{{ L('app server 1', '应用服务器 1') }}</text>
    <g class="fade" :class="{ show: !!holds }">
      <rect x="34" y="226" width="52" height="16" rx="3" class="chip" :class="{ old: holds === 'v1' }" />
      <text x="60" y="238" class="code c">{{ L('has', '持有') }} {{ holds }}</text>
    </g>

    <g :class="{ dead: s === 6 }">
      <rect x="248" y="186" width="104" height="64" rx="6" class="box" :class="{ litbox: s === 2 || s === 4 }" />
      <text x="300" y="204" class="lbl c">{{ L('Writer', '写者') }}</text>
      <text x="300" y="218" class="sub c">{{ L('app server 2', '应用服务器 2') }}</text>
    </g>

    <!-- the database, with row 42 -->
    <rect x="100" y="340" width="160" height="72" rx="6" class="box floor" />
    <text x="180" y="358" class="lbl c">{{ L('Database', '数据库') }}</text>
    <rect x="124" y="368" width="112" height="22" rx="3" class="slot" :class="{ fresh: s >= 2 }" />
    <text x="180" y="383" class="code c">{{ L('row 42', '第 42 行') }}: {{ row }}</text>

    <!-- 1: the miss, and the read of v1 -->
    <g class="fade" :class="{ show: s === 1 || s === 4 }">
      <path d="M66,186 C70,150 92,116 118,104" class="call" marker-end="url(#ca-arrow)" />
      <text x="26" y="140" class="tag hi">{{ L('get: miss', '查：未命中') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 1 }">
      <path d="M118,370 C80,350 60,300 60,254" class="call" marker-end="url(#ca-arrow)" />
      <text x="26" y="318" class="tag hi">{{ L('read: v1', '读到 v1') }}</text>
    </g>

    <!-- 2: the write and the delete -->
    <g class="fade" :class="{ show: s === 2 || s === 4 }">
      <path d="M300,254 C300,300 280,350 242,370" class="call" marker-end="url(#ca-arrow)" />
      <text x="334" y="318" class="tag hi end">{{ L('update: v2', '更新为 v2') }}</text>
      <path d="M294,186 C290,150 268,116 242,104" class="call" marker-end="url(#ca-arrow)" />
      <text x="334" y="140" class="tag hi end">{{ L('delete key', '删除键') }}</text>
    </g>

    <!-- 3 and 5: the late fill of v1 -->
    <g class="fade" :class="{ show: s === 3 || s === 5 }">
      <path d="M44,186 C46,140 80,100 120,92" class="call bad" marker-end="url(#ca-arrow-bad)" />
      <text x="14" y="120" class="tag bad-text">{{ L('set v1', '写入 v1') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 5 }">
      <text x="110" y="97" class="bad-text c big">✕</text>
    </g>

    <!-- 4 and 5: the lease, handed out on the miss and cancelled by the delete -->
    <g class="fade" :class="{ show: s === 4 || s === 5 }">
      <rect x="86" y="144" width="48" height="16" rx="8" class="lease" />
      <text x="110" y="156" class="tag c">{{ L('lease', '租约') }}</text>
      <text x="141" y="157" class="bad-text big c">✕</text>
      <text x="151" y="156" class="tag">{{ L('the delete cancels it', '删除让它作废') }}</text>
    </g>

    <!-- 6: a stampede, stopped by one lease -->
    <g class="fade" :class="{ show: s === 6 }">
      <rect x="86" y="144" width="48" height="16" rx="8" class="lease" />
      <text x="110" y="156" class="tag c">{{ L('lease', '租约') }}</text>
      <path d="M118,370 C80,350 60,300 60,254" class="call" marker-end="url(#ca-arrow)" />
      <text x="26" y="318" class="tag hi">{{ L('read: v2', '读到 v2') }}</text>
      <rect x="248" y="268" width="48" height="36" rx="5" class="box" />
      <text x="272" y="284" class="sub c">{{ L('client', '客户端') }}</text>
      <text x="272" y="297" class="tag c">{{ L('waits', '等待') }}</text>
      <rect x="304" y="268" width="48" height="36" rx="5" class="box" />
      <text x="328" y="284" class="sub c">{{ L('client', '客户端') }}</text>
      <text x="328" y="297" class="tag c">{{ L('waits', '等待') }}</text>
      <text x="300" y="322" class="tag c">{{ L('no lease: retry later', '没有租约：稍后重试') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.slot {
  fill: var(--code-bg);
  stroke: var(--rule-strong);
  transition: stroke 0.3s;
}
.slot.stale {
  stroke: var(--p3);
  stroke-width: 1.8;
}
.slot.fresh {
  stroke: var(--ok);
  stroke-width: 1.6;
}
.chip {
  fill: var(--bg-sunk);
  stroke: var(--ok);
}
.chip.old {
  stroke: var(--warn);
}
.lease {
  fill: var(--bg-sunk);
  stroke: var(--accent);
  stroke-width: 1.4;
}
.box.litbox {
  stroke: var(--accent);
  stroke-width: 2;
}
.call.bad {
  stroke: var(--p3);
  stroke-width: 1.6;
}
.headbad {
  fill: var(--p3);
}
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.fade.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .slot {
    transition: none;
  }
}
</style>
