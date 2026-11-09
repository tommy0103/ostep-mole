<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * Tree pseudo-LRU on one 8-way set. Ways 0..7 were used in order, so all seven bits point left.
 * A hit on way 0 flips the bits on its path; following the bits then leads to way 4 although way 1
 * is the true LRU line; the new line in way 4 flips its own path. A bit of 0 means the left half
 * was used less recently, 1 the right half.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const NODES = [
  { id: 1, x: 180, y: 30 },
  { id: 2, x: 96, y: 66 },
  { id: 3, x: 264, y: 66 },
  { id: 4, x: 54, y: 100 },
  { id: 5, x: 138, y: 100 },
  { id: 6, x: 222, y: 100 },
  { id: 7, x: 306, y: 100 },
]
const KIDS: Record<number, number[]> = { 1: [2, 3], 2: [4, 5], 3: [6, 7], 4: [0, 1], 5: [2, 3], 6: [4, 5], 7: [6, 7] }
const node = (id: number) => NODES.find((n) => n.id === id)!
const wayX = (w: number) => 12 + 21 + w * 42
// the bits of nodes 1..7 at each step
const BITS = computed(() => {
  if (s.value === 0) return [0, 0, 0, 0, 0, 0, 0]
  if (s.value < 4) return [1, 1, 0, 1, 0, 0, 0]
  return [0, 1, 1, 1, 0, 1, 0]
})
const bit = (id: number) => BITS.value[id - 1]
/** nodes on the path that this step is about */
const path = computed(() => (s.value === 1 ? [1, 2, 4] : s.value === 2 ? [1, 3, 6] : s.value === 4 ? [1, 3, 6] : []))
const times = computed(() => ['t' + (s.value >= 1 ? 9 : 1), 't2', 't3', 't4', s.value >= 4 ? 't10' : 't5', 't6', 't7', 't8'])
const writes = computed(() => (s.value === 1 || s.value === 4 ? 3 : 0))
</script>

<template>
  <svg class="scene-drawing" viewBox="0 0 360 300" role="img" :aria-label="L('Tree pseudo-LRU on one 8-way set, step by step', '一个 8 路组上的树形伪 LRU，分步演示')">
    <!-- the tree of bits -->
    <template v-for="n in NODES" :key="n.id">
      <line
        v-for="(k, side) in KIDS[n.id]"
        :key="side"
        :x1="n.x"
        :y1="n.y + 9"
        :x2="n.id >= 4 ? wayX(k) : node(k).x"
        :y2="n.id >= 4 ? 134 : node(k).y - 9"
        class="edge"
        :class="{ point: bit(n.id) === side, walk: path.includes(n.id) && bit(n.id) === side }"
      />
    </template>
    <template v-for="n in NODES" :key="'n' + n.id">
      <circle :cx="n.x" :cy="n.y" r="10" class="node" :class="{ walk: path.includes(n.id) }" />
      <text :x="n.x" :y="n.y + 4" class="code c">{{ bit(n.id) }}</text>
    </template>

    <!-- the eight ways: leaves of the tree -->
    <g v-for="w in 8" :key="w">
      <rect :x="12 + (w - 1) * 42" y="136" width="39" height="34" rx="3" class="way" :class="{ hit: (s === 1 && w === 1) || (s === 4 && w === 5), victim: s >= 2 && s < 4 && w === 5, lru: s === 3 && w === 2 }" />
      <text :x="wayX(w - 1)" y="158" class="lbl c">{{ w - 1 }}</text>
      <text :x="wayX(w - 1)" y="186" class="code c">{{ times[w - 1] }}</text>
    </g>
    <text x="12" y="204" class="tag">{{ L('ways, and when each was last used', '各路，以及它们最后被使用的时刻') }}</text>

    <text :x="wayX(4)" y="222" class="tag c bad fade" :class="{ show: s === 2 || s === 3 }">{{ L('bits lead here', '这些位指向这里') }}</text>
    <text :x="wayX(1)" y="222" class="tag c hi fade" :class="{ show: s === 3 }">{{ L('true LRU line', '真正最久未用') }}</text>

    <text x="12" y="250" class="tag hi">{{ L('a bit: 0 = left half used less recently, 1 = right half', '一位：0 表示左半较久未用，1 表示右半') }}</text>
    <text x="12" y="268" class="tag">{{ L(`bits written by this step: ${writes}`, `这一步写入的位数：${writes}`) }}</text>
    <text x="12" y="286" class="tag">{{ L('7 bits in all; exact LRU on 8 ways needs 16', '一共 7 位；8 路精确 LRU 要 16 位') }}</text>
  </svg>
</template>

<style scoped>
.edge {
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: stroke 0.3s;
}
.edge.point {
  stroke: var(--ink-2);
  stroke-width: 1.6;
}
.edge.walk {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.node {
  fill: var(--bg-elev);
  stroke: var(--ink-2);
  stroke-width: 1.2;
}
.node.walk {
  stroke: var(--accent);
  stroke-width: 2.4;
  fill: var(--accent-soft);
}
.way {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
}
.way.hit {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 2;
}
.way.victim {
  stroke: var(--p3);
  stroke-width: 2.2;
}
.way.lru {
  stroke: var(--ink-2);
  stroke-width: 2.2;
  stroke-dasharray: 4 3;
}
.bad {
  fill: var(--p3);
  font-weight: 600;
}
.fade {
  opacity: 0;
  transition: opacity 0.3s;
}
.fade.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .edge,
  .fade {
    transition: none;
  }
}
</style>
