<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { tlbArrayWalk } from '@/lib/sim/caching'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** Figure 19.2: int a[10] starting at VA 100 in an 8-bit address space with 16-byte pages. */
const pageSize = ref(16)
const tlbSize = ref(4)
const passes = ref(1)
const START = 100
const N = 10
const acc = computed(() => tlbArrayWalk(N, 4, START, pageSize.value, tlbSize.value, passes.value))
const duration = computed(() => acc.value.length)
const player = usePlayer(duration, { speed: 2.4 })
watch([pageSize, tlbSize, passes], () => player.reset())
const k = computed(() => Math.min(acc.value.length, Math.floor(player.t.value)))
const done = computed(() => acc.value.slice(0, k.value))
const cur = computed(() => (k.value > 0 ? acc.value[k.value - 1] : null))
const hits = computed(() => done.value.filter((a) => a.hit).length)
/** TLB contents after the k-th access (LRU order, most recent last) */
const tlb = computed(() => {
  const out: number[] = []
  for (const a of done.value) {
    const i = out.indexOf(a.vpn)
    if (i >= 0) out.splice(i, 1)
    else if (out.length >= tlbSize.value) out.shift()
    out.push(a.vpn)
  }
  return out
})
// layout: show the pages that the array touches, each 16 bytes wide = 4 ints
const firstVpn = computed(() => Math.floor(START / pageSize.value))
const lastVpn = computed(() => Math.floor((START + N * 4 - 1) / pageSize.value))
const pages = computed(() => Array.from({ length: lastVpn.value - firstVpn.value + 3 }, (_, i) => firstVpn.value - 1 + i))
const BYTE = computed(() => 560 / (pages.value.length * pageSize.value))
const bx = (va: number) => 40 + (va - pages.value[0] * pageSize.value) * BYTE.value
const result = (i: number) => {
  const a = done.value.filter((d) => d.index === i)
  return a.length ? a[a.length - 1] : null
}
</script>

<template>
  <LabFrame :title="title" name="tlb" :player="player" :duration="duration"
    :hint="{ en: 'Only the first access to each page misses; the neighbours on the same page hit. Bigger pages → fewer misses. A second pass hits every time if the TLB can hold all the pages (temporal locality).', zh: '只有每页的第一次访问会未命中，同一页上的相邻元素都会命中。页越大，未命中越少。如果 TLB 能装下所有页，第二遍遍历会全部命中（时间局部性）。' }">
    <div class="lab-grid">
      <div class="lab-row">
        <code class="mono loop">for (i = 0; i &lt; 10; i++) sum += a[i];</code>
        <span v-if="cur" class="mono">a[{{ cur.index }}] @ VA {{ cur.va }} → VPN {{ cur.vpn }} · <b :class="cur.hit ? 'hit' : 'miss'">{{ cur.hit ? 'TLB HIT' : 'TLB MISS' }}</b></span>
      </div>
      <svg class="viz" viewBox="0 0 640 120" role="img" :aria-label="t({ en: 'array laid out across pages', zh: '数组跨页分布' })">
        <g v-for="p in pages" :key="p">
          <rect :x="bx(p * pageSize)" y="20" :width="pageSize * BYTE - 2" height="70" rx="3" fill="var(--bg-sunk)" :stroke="tlb.includes(p) ? 'var(--accent)' : 'var(--rule)'" :stroke-width="tlb.includes(p) ? 1.6 : 1" class="mv" />
          <text :x="bx(p * pageSize) + 4" y="14" class="ax">VPN {{ p }}</text>
        </g>
        <g v-for="i in N" :key="i">
          <rect :x="bx(START + (i - 1) * 4) + 1" y="44" :width="4 * BYTE - 3" height="30" rx="2" :fill="result(i - 1) ? (result(i - 1)!.hit ? 'var(--ok)' : 'var(--bad)') : 'var(--p0)'" :opacity="result(i - 1) ? 0.9 : 0.35" class="mv" />
          <text :x="bx(START + (i - 1) * 4) + 2 * BYTE" y="63" text-anchor="middle" class="in">{{ i - 1 }}</text>
          <text v-if="result(i - 1)" :x="bx(START + (i - 1) * 4) + 2 * BYTE" y="106" text-anchor="middle" :class="result(i - 1)!.hit ? 'h' : 'm'">{{ result(i - 1)!.hit ? 'h' : 'm' }}</text>
        </g>
        <path v-if="cur" :d="`M ${bx(cur.va) + 2 * BYTE} 36 l -5 -8 h 10 z`" fill="var(--ink)" class="mv" />
      </svg>
      <div class="lab-grid two">
        <div>
          <div class="lab-label">TLB ({{ tlbSize }} {{ t({ en: 'entries, LRU', zh: '项，LRU' }) }})</div>
          <div class="tlb">
            <TransitionGroup name="tl">
              <div v-for="v in tlb" :key="v" class="entry mono">VPN {{ v }} → PFN …</div>
            </TransitionGroup>
            <div v-for="n in Math.max(0, tlbSize - tlb.length)" :key="'e' + n" class="entry empty mono">—</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><span class="k">{{ t({ en: 'accesses', zh: '访问' }) }}</span><span class="v">{{ k }}</span></div>
          <div class="stat good"><span class="k">hits</span><span class="v">{{ hits }}</span></div>
          <div class="stat bad"><span class="k">misses</span><span class="v">{{ k - hits }}</span></div>
          <div class="stat"><span class="k">{{ t({ en: 'hit rate', zh: '命中率' }) }}</span><span class="v">{{ k ? Math.round((hits / k) * 100) : 0 }}%</span></div>
        </div>
      </div>
    </div>
    <template #controls>
      <label class="field">{{ t({ en: 'page size', zh: '页大小' }) }} <select v-model.number="pageSize"><option :value="16">16 B</option><option :value="32">32 B</option><option :value="64">64 B</option></select></label>
      <label class="field">TLB <select v-model.number="tlbSize"><option :value="1">1</option><option :value="2">2</option><option :value="4">4</option></select></label>
      <label class="field">{{ t({ en: 'passes', zh: '遍历次数' }) }} <select v-model.number="passes"><option :value="1">1</option><option :value="2">2</option></select></label>
    </template>
  </LabFrame>
</template>

<style scoped>
.loop {
  font-size: 13px;
  padding: 4px 8px;
  background: var(--code-bg);
  border-radius: 4px;
}
.hit,
.h {
  color: var(--ok);
  fill: var(--ok) !important;
}
.miss,
.m {
  color: var(--bad);
  fill: var(--bad) !important;
}
.h,
.m {
  font-size: 12px !important;
  font-weight: 600;
}
.ax {
  font-size: 10px !important;
  fill: var(--muted) !important;
}
.in {
  fill: #fff !important;
  font-size: 10.5px !important;
}
.mv {
  transition: all 0.3s var(--ease);
}
.tlb {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}
.entry {
  padding: 4px 8px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  font-size: 12px;
  background: var(--accent-soft);
}
.entry.empty {
  border-color: var(--rule);
  background: transparent;
  color: var(--faint);
}
.tl-move,
.tl-enter-active,
.tl-leave-active {
  transition: all 0.3s var(--ease);
}
.tl-enter-from,
.tl-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
.tl-leave-active {
  position: absolute;
}
</style>
