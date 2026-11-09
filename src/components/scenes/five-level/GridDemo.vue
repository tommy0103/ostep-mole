<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * The 24 references of a two-dimensional walk (4 guest levels, 4 host levels), one column at a time:
 * a host walk to find a guest table, then a read of the guest's entry. The last column finds the data,
 * whose own access is the one corner not counted.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const COLS = [
  { x: 110, name: ['PML4', 'PML4'] },
  { x: 160, name: ['PDPT', 'PDPT'] },
  { x: 210, name: ['PD', '页目录'] },
  { x: 260, name: ['PT', '页表'] },
  { x: 318, name: ['data', '数据'] },
]
const HOST = ['PML4', 'PDPT', 'PD', 'PT']
const Y = (r: number) => 88 + r * 24
const GUEST_Y = Y(4) + 6

// which column each step is working on, and how far it has got
const hostDone = (c: number) => {
  // step 0: host walk of column 0; step 1 reads its entry; afterwards one column per step
  if (s.value === 0) return c === 0
  return c <= s.value - 1
}
const guestDone = (c: number) => c <= s.value - 1 && c <= 3
const count = computed(() => [4, 5, 10, 15, 20, 24][s.value])
const active = computed(() => (s.value === 0 ? 0 : s.value - 1))
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 262" role="img" :aria-label="L('Counting the references of a two-dimensional walk', '数出二维遍历的访问次数')">
    <text x="8" y="14" class="tag">{{ L('the guest’s tables, and what the hardware must find for each', '客户机的各张表，以及硬件要为每一张查的东西') }}</text>
    <!-- the guest's tables -->
    <rect x="12" y="26" width="44" height="34" rx="5" class="box gate" />
    <text x="34" y="47" class="lbl c">CR3</text>
    <g v-for="(c, i) in COLS" :key="c.x">
      <rect :x="c.x - 21" y="26" :width="42" height="34" rx="5" class="box" :class="{ act: i === active }" />
      <text :x="c.x" y="47" class="lbl c">{{ L(c.name[0], c.name[1]) }}</text>
    </g>
    <path d="M56,43 L88,43" class="edge" />
    <path v-for="i in 4" :key="'e' + i" :d="`M${COLS[i - 1].x + 21},43 L${COLS[i].x - 21},43`" class="edge" />

    <!-- each column: a host walk, then the guest's entry -->
    <template v-for="(h, r) in HOST" :key="h">
      <text x="12" :y="Y(r) + 3" class="tiny">{{ L('host ', '宿主机 ') }}{{ h }}</text>
      <template v-for="(c, i) in COLS" :key="c.x + h">
        <circle :cx="c.x" :cy="Y(r)" r="6" class="dot-h" :class="{ on: hostDone(i) }" />
      </template>
    </template>
    <text x="12" :y="GUEST_Y + 3" class="tiny strongt">{{ L('guest entry', '客户机表项') }}</text>
    <template v-for="(c, i) in COLS" :key="'g' + c.x">
      <circle v-if="i < 4" :cx="c.x" :cy="GUEST_Y" r="6" class="dot-g" :class="{ on: guestDone(i) }" />
      <circle v-else :cx="c.x" :cy="GUEST_Y" r="6" class="corner" />
    </template>
    <text x="318" :y="GUEST_Y + 18" class="tiny c">{{ L('not counted', '不计入') }}</text>

    <text x="180" y="248" class="tally c">{{ count }}</text>
    <text x="206" y="248" class="tag">{{ L('references so far', '次访问') }}</text>
  </svg>
</template>

<style scoped>
.demo {
  width: 100%;
  height: auto;
  display: block;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.strongt {
  fill: var(--ink);
  font-weight: 600;
}
.edge {
  stroke: var(--muted);
  stroke-width: 1.1;
  fill: none;
}
.box.act {
  stroke: var(--accent);
  stroke-width: 2.2;
  fill: var(--accent-soft);
}
.dot-h,
.dot-g {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: fill 0.3s;
}
.dot-h.on {
  fill: var(--p1);
  stroke: none;
}
.dot-g.on {
  fill: var(--p0);
  stroke: none;
}
.corner {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
}
.tally {
  font-size: 22px;
  font-weight: 700;
  fill: var(--accent-ink);
  text-anchor: middle;
}
</style>
