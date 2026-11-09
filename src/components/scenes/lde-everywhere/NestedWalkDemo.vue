<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The two-dimensional page walk in five steps: a native four-level walk; one guest level costs a
 * nested walk plus the guest entry; four levels make 20; the data's address needs one more nested
 * walk, 24 in all; caches absorb much of it. Cells are numbered in the order they are read.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const ROWS = [
  { en: 'guest L4', zh: '客户第 4 级' },
  { en: 'guest L3', zh: '客户第 3 级' },
  { en: 'guest L2', zh: '客户第 2 级' },
  { en: 'guest L1', zh: '客户第 1 级' },
  { en: 'the data', zh: '数据本身' },
]
const Y = (r: number) => 118 + r * 38
const NX = [86, 124, 162, 200]
/** the step at which row r has been read */
const rowAt = (r: number) => (r === 0 ? 1 : r < 4 ? 2 : 3)
const reads = computed(() => (s.value === 0 ? 4 : s.value === 1 ? 5 : s.value === 2 ? 20 : 24))
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 370" role="img" :aria-label="L('A nested page walk, step by step', '嵌套页表遍历，分步演示')">
    <!-- without a VM -->
    <text x="12" y="24" class="tag hi">{{ L('Without a VM: a TLB miss walks one table', '没有虚拟机：TLB 未命中，走一套页表') }}</text>
    <g v-for="i in 4" :key="'n' + i">
      <rect :x="86 + (i - 1) * 38" y="34" width="32" height="24" rx="3" class="cell native" :class="{ on: s === 0 }" />
      <text :x="102 + (i - 1) * 38" y="50" class="tag c">L{{ 5 - i }}</text>
    </g>
    <rect x="248" y="34" width="56" height="24" rx="3" class="cell data" />
    <text x="276" y="50" class="tag c">{{ L('data', '数据') }}</text>
    <text x="12" y="50" class="tag">{{ L('4 reads', '读 4 次') }}</text>

    <!-- in a VM -->
    <g class="fade" :class="{ show: s >= 1 }">
      <text x="12" y="84" class="tag hi">{{ L('In a VM: two tables, walked together', '在虚拟机里：两套页表一起走') }}</text>
      <text x="143" y="104" class="tag c">{{ L('nested walk (monitor’s table)', '嵌套遍历（监控器的页表）') }}</text>
      <text x="276" y="104" class="tag c">{{ L('guest entry', '客户页表项') }}</text>
      <g v-for="(row, r) in ROWS" :key="r">
        <text x="12" :y="Y(r) + 16" class="tag" :class="{ hi: s >= rowAt(r) }">{{ L(row.en, row.zh) }}</text>
        <g v-for="(x, k) in NX" :key="k">
          <rect :x="x" :y="Y(r)" width="32" height="24" rx="3" class="cell nested" :class="{ on: s >= rowAt(r) }" />
          <text :x="x + 16" :y="Y(r) + 16" class="tag c" :class="{ white: s >= rowAt(r) }">{{ r * 5 + k + 1 }}</text>
        </g>
        <template v-if="r < 4">
          <rect x="248" :y="Y(r)" width="56" height="24" rx="3" class="cell guest" :class="{ on: s >= rowAt(r) }" />
          <text x="276" :y="Y(r) + 16" class="tag c" :class="{ white: s >= rowAt(r) }">{{ r * 5 + 5 }}</text>
        </template>
        <template v-else>
          <rect x="248" :y="Y(r)" width="56" height="24" rx="3" class="cell data" />
          <text x="276" :y="Y(r) + 16" class="tag c">{{ L('data', '数据') }}</text>
        </template>
        <!-- the guest entry's address comes out of the nested walk -->
        <path :d="`M234,${Y(r) + 12} L244,${Y(r) + 12}`" class="link solid" :class="{ gone: s < rowAt(r) }" />
      </g>
      <text x="316" :y="Y(0) + 16" class="tag" :class="{ gone: s !== 1 }">= 5</text>
      <text x="316" :y="Y(3) + 16" class="tag" :class="{ gone: s !== 2 }">4 × 5</text>
      <text x="316" :y="Y(4) + 16" class="tag" :class="{ gone: s < 3 }">+ 4</text>
    </g>

    <!-- the tally -->
    <text x="12" y="326" class="lbl">{{ L('Memory reads before the data:', '读到数据之前的内存读取：') }}</text>
    <text x="348" y="326" class="lbl end tally">{{ reads }}</text>
    <text x="12" y="350" class="tag" :class="{ gone: s < 3 }">{{ L('24 in a VM against 4 without one', '虚拟机里 24 次，没有虚拟机时 4 次') }}</text>
    <text x="12" y="364" class="tag hi" :class="{ gone: s < 4 }">{{ L('many repeat walk after walk: page-walk caches keep them', '许多读取在一次次遍历中重复：页表遍历缓存把它们留住') }}</text>
  </svg>
</template>

<style scoped>
.cell {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: fill 0.35s;
}
.cell.native.on {
  fill: var(--p2);
}
.cell.nested.on {
  fill: var(--p1);
}
.cell.guest.on {
  fill: var(--p0);
}
.cell.data {
  fill: none;
  stroke-dasharray: 3 2;
}
.white {
  fill: #fff;
}
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.fade.show {
  opacity: 1;
}
.tally {
  font-size: 16px;
}
</style>
