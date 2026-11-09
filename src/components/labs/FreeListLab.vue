<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { runOps, fragmentation, initHeap, type FitPolicy, type Op } from '@/lib/sim/freelist'
import { rng } from '@/lib/sim/rng'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

const HEAP = 100
const POLICIES: FitPolicy[] = ['BEST', 'WORST', 'FIRST', 'NEXT']
const policy = ref<FitPolicy>('BEST')
const coalesce = ref(false)
const seed = ref(3)

/** A random workload in the style of malloc.py: allocations of 1–12 bytes, frees of live ones. */
const ops = computed<Op[]>(() => {
  const r = rng(seed.value)
  const live: number[] = []
  const out: Op[] = []
  let id = 0
  for (let k = 0; k < 18; k++) {
    if (live.length && r() < 0.45) {
      const i = Math.floor(r() * live.length)
      out.push({ kind: 'free', id: live.splice(i, 1)[0] })
    } else {
      id++
      live.push(id)
      out.push({ kind: 'alloc', size: 1 + Math.floor(r() * 12), id })
    }
  }
  return out
})
const results = computed(() => runOps(HEAP, ops.value, policy.value, coalesce.value))
const duration = computed(() => ops.value.length)
const player = usePlayer(duration, { speed: 1.5 })
watch([policy, coalesce, seed], () => player.reset())
const k = computed(() => Math.floor(player.t.value))
const state = computed(() => (k.value === 0 ? initHeap(HEAP) : results.value[k.value - 1].state))
const last = computed(() => (k.value === 0 ? null : results.value[k.value - 1]))
const failed = computed(() => results.value.slice(0, k.value).filter((r) => !r.ok).length)
const freeChunks = computed(() => state.value.chunks.filter((c) => c.free))
const compare = computed(() =>
  POLICIES.map((p) => {
    const res = runOps(HEAP, ops.value, p, coalesce.value)
    const end = res[res.length - 1].state
    return { p, failed: res.filter((r) => !r.ok).length, frag: fragmentation(end), searched: res.reduce((s, r) => s + r.searched, 0), free: end.chunks.filter((c) => c.free).length }
  }),
)
const W = 640
const sx = (a: number) => 8 + (a / HEAP) * (W - 16)
const opText = (op: Op) => (op.kind === 'alloc' ? `ptr[${op.id}] = Alloc(${op.size})` : `Free(ptr[${op.id}])`)
</script>

<template>
  <LabFrame :title="title" name="malloc" :player="player" :duration="duration"
    :hint="{ en: 'A 100-byte heap. Coloured chunks are allocated; grey ones are on the free list. Without coalescing, freed neighbours stay separate and big requests start to fail.', zh: '一个 100 字节的堆。彩色块已分配，灰色块在空闲列表上。不合并时，相邻的空闲块仍然各自独立，较大的请求开始失败。' }">
    <div class="lab-grid">
      <div class="lab-row">
        <div class="seg">
          <button v-for="p in POLICIES" :key="p" :aria-pressed="policy === p" @click="policy = p">{{ p }}</button>
        </div>
        <label class="field"><input v-model="coalesce" type="checkbox" /> {{ t({ en: 'coalesce on free', zh: '释放时合并' }) }}</label>
      </div>
      <div class="op mono" :class="{ fail: last && !last.ok }">
        <template v-if="last">
          {{ opText(last.op) }}
          <span v-if="last.op.kind === 'alloc'">→ {{ last.ok ? `addr ${last.addr}` : 'NULL (' + t({ en: 'no chunk large enough', zh: '没有足够大的块' }) + ')' }}</span>
          <span class="muted"> · {{ t({ en: 'searched', zh: '查找' }) }} {{ last.searched }}</span>
        </template>
        <template v-else>{{ t({ en: 'press play or step', zh: '点击播放或单步' }) }}</template>
      </div>
      <svg class="viz" :viewBox="`0 0 ${W} 74`" role="img" :aria-label="t({ en: 'heap layout', zh: '堆布局' })">
        <TransitionGroup tag="g" name="chunk">
          <g v-for="c in state.chunks" :key="c.addr + ':' + (c.free ? 'f' : c.id)">
            <rect :x="sx(c.addr)" y="8" :width="Math.max(1, sx(c.addr + c.size) - sx(c.addr) - 1.5)" height="38" rx="2" :fill="c.free ? 'var(--bg-sunk)' : `var(--p${(c.id ?? 0) % 5})`" :stroke="c.free ? 'var(--rule-strong)' : 'none'" :stroke-dasharray="c.free ? '3 2' : ''" />
            <text v-if="sx(c.addr + c.size) - sx(c.addr) > 18" :x="(sx(c.addr) + sx(c.addr + c.size)) / 2" y="31" text-anchor="middle" :class="c.free ? 'fr' : 'in'">{{ c.free ? c.size : `#${c.id}` }}</text>
          </g>
        </TransitionGroup>
        <text v-for="a in [0, 25, 50, 75, 100]" :key="a" :x="sx(a)" y="64" text-anchor="middle" class="ax">{{ a }}</text>
      </svg>
      <div class="lab-row">
        <span class="lab-label">free list</span>
        <span class="flist mono">
          head <template v-for="c in freeChunks" :key="c.addr">→ <span class="node">[{{ c.addr }}:{{ c.size }}]</span></template> → NULL
        </span>
      </div>
      <div class="lab-grid two">
        <div class="stats">
          <div class="stat"><span class="k">{{ t({ en: 'free chunks', zh: '空闲块' }) }}</span><span class="v">{{ freeChunks.length }}</span></div>
          <div class="stat" :class="fragmentation(state) > 0.4 ? 'bad' : ''"><span class="k">{{ t({ en: 'fragmentation', zh: '碎片率' }) }}</span><span class="v">{{ Math.round(fragmentation(state) * 100) }}%</span></div>
          <div class="stat" :class="failed ? 'bad' : 'good'"><span class="k">{{ t({ en: 'failed allocs', zh: '分配失败' }) }}</span><span class="v">{{ failed }}</span></div>
        </div>
        <table class="mono-table">
          <thead>
            <tr><th>{{ t({ en: 'policy (whole run)', zh: '策略（整轮）' }) }}</th><th>{{ t({ en: 'failed', zh: '失败' }) }}</th><th>{{ t({ en: 'free chunks', zh: '空闲块' }) }}</th><th>{{ t({ en: 'searched', zh: '查找' }) }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in compare" :key="c.p" :class="{ now: c.p === policy }">
              <td>{{ c.p }}</td><td>{{ c.failed }}</td><td>{{ c.free }}</td><td>{{ c.searched }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #controls>
      <button class="btn" @click="seed++">↻ {{ t({ en: 'new workload', zh: '换一组负载' }) }}</button>
    </template>
  </LabFrame>
</template>

<style scoped>
.op {
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 5px;
  background: var(--bg-sunk);
}
.op.fail {
  color: var(--bad);
}
.in {
  fill: #fff !important;
  font-size: 10.5px !important;
}
.fr {
  fill: var(--muted) !important;
  font-size: 10.5px !important;
}
.ax {
  fill: var(--faint) !important;
  font-size: 9.5px !important;
}
.flist {
  font-size: 12px;
  color: var(--muted);
  overflow-x: auto;
  white-space: nowrap;
}
.node {
  color: var(--ink);
}
.chunk-enter-active {
  transition: opacity 0.35s;
}
.chunk-enter-from {
  opacity: 0;
}
</style>
