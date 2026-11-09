<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import { usePlayer } from '@/lib/usePlayer'
import { twoLevelTranslate, tableCost, type TwoLevel, type PTE, hex } from '@/lib/sim/memory'
import { t, uiLang, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** Figure 20.5: the page directory points to PT pages at PFN 100 and 101. */
const pte = (pfn: number): PTE => ({ valid: true, pfn })
const inv: PTE = { valid: false, pfn: 0 }
const pt100: PTE[] = Array.from({ length: 16 }, () => inv)
pt100[0] = pte(10)
pt100[1] = pte(23)
pt100[4] = pte(80)
pt100[5] = pte(59)
const pt101: PTE[] = Array.from({ length: 16 }, () => inv)
pt101[14] = pte(55)
pt101[15] = pte(45)
const PT: TwoLevel = { dir: Array.from({ length: 16 }, () => ({ valid: false as const })) }
PT.dir[0] = { valid: true, pfn: 100, ptes: pt100 }
PT.dir[15] = { valid: true, pfn: 101, ptes: pt101 }

const presets = [
  { va: 0x3f80, label: '0x3F80 (stack)' },
  { va: 0x0070, label: '0x0070 (code)' },
  { va: 0x0110, label: '0x0110 (heap)' },
  { va: 0x2000, label: '0x2000 (unmapped)' },
]
const va = ref(0x3f80)
const r = computed(() => twoLevelTranslate(va.value, PT))
const duration = computed(() => r.value.steps.length)
const player = usePlayer(duration, { speed: 1.1 })
watch(va, () => {
  player.reset()
  player.play()
})
const k = computed(() => Math.min(r.value.steps.length, Math.ceil(player.t.value)))
const reached = (id: string) => r.value.steps.slice(0, k.value).some((s) => s.id === id)
const bits = computed(() => va.value.toString(2).padStart(14, '0').split(''))
const pde = computed(() => PT.dir[r.value.pdIndex])
const cost = tableCost([0, 1, 4, 5, 254, 255], 8, 4, 64)
const bitClass = (i: number) => (i < 4 ? 'pd' : i < 8 ? 'pt' : 'off')
</script>

<template>
  <LabFrame :title="title" name="page-walk" :player="player" :duration="duration"
    :hint="{ en: '16KB address space, 64-byte pages: VPN = 8 bits, split into a 4-bit page-directory index and a 4-bit page-table index. Only 3 pages of page table exist instead of 16.', zh: '16KB 地址空间、64 字节页：VPN 共 8 位，拆成 4 位页目录索引和 4 位页表索引。页表只需要 3 页，而不是 16 页。' }">
    <div class="lab-row">
      <div class="seg">
        <button v-for="p in presets" :key="p.va" :aria-pressed="va === p.va" @click="va = p.va">{{ p.label }}</button>
      </div>
    </div>
    <div class="lab-row bitsrow">
      <span class="lab-label">VA {{ hex(va, 4) }}</span>
      <span class="bits">
        <span v-for="(b, i) in bits" :key="i" :class="bitClass(i)">{{ b }}</span>
      </span>
      <span class="legend mono"><i class="pd" /> PD {{ r.pdIndex }} <i class="pt" /> PT {{ r.ptIndex }} <i class="off" /> off {{ r.offset }}</span>
    </div>
    <div class="walk">
      <div class="col">
        <div class="lab-label">{{ t({ en: 'page directory', zh: '页目录' }) }} <span class="muted">(PDBR → PFN 200)</span></div>
        <div class="table">
          <div v-for="(d, i) in PT.dir" :key="i" class="ent mono" :class="{ hot: reached('pde') && i === r.pdIndex, valid: d.valid }">
            <span>{{ i }}</span><span>{{ d.valid ? `→ PFN ${d.pfn}` : '✗' }}</span>
          </div>
        </div>
      </div>
      <div class="arrow" :class="{ on: reached('pte') }">→</div>
      <div class="col">
        <div class="lab-label">{{ t({ en: 'page of PTEs', zh: '页表页' }) }} <span class="muted">{{ pde.valid ? `PFN ${pde.pfn}` : '—' }}</span></div>
        <div v-if="pde.valid" class="table">
          <div v-for="(p, i) in pde.ptes" :key="i" class="ent mono" :class="{ hot: reached('pte') && i === r.ptIndex, valid: p.valid }">
            <span>{{ i }}</span><span>{{ p.valid ? `PFN ${p.pfn}` : '✗' }}</span>
          </div>
        </div>
        <div v-else class="table missing mono">{{ t({ en: 'not allocated — that is the saving', zh: '没有分配——这正是节省之处' }) }}</div>
      </div>
      <div class="arrow" :class="{ on: reached('concat') }">→</div>
      <div class="col result">
        <div class="lab-label">{{ t({ en: 'physical address', zh: '物理地址' }) }}</div>
        <Transition name="fade" mode="out-in">
          <div v-if="reached('concat') && r.ok" :key="'ok' + va" class="pa mono">{{ hex(r.pa, 4) }}<small>= {{ r.pa }}</small></div>
          <div v-else-if="reached('fault')" :key="'f' + va" class="pa fault mono">FAULT</div>
          <div v-else key="wait" class="pa wait mono">…</div>
        </Transition>
      </div>
    </div>
    <ol class="steps">
      <li v-for="(s, i) in r.steps" :key="s.id" :class="{ on: i < k, fault: s.id === 'fault' }">{{ s[uiLang] }}</li>
    </ol>
    <div class="stats">
      <div class="stat"><span class="k">{{ t({ en: 'linear table', zh: '线性页表' }) }}</span><span class="v">{{ cost.linear }} B</span></div>
      <div class="stat good"><span class="k">{{ t({ en: 'two-level', zh: '两级页表' }) }}</span><span class="v">{{ cost.dirEntries * 4 + cost.ptPages * 64 }} B</span></div>
      <div class="stat"><span class="k">{{ t({ en: 'memory refs on a TLB miss', zh: 'TLB 未命中时的访存' }) }}</span><span class="v">2 + 1</span></div>
    </div>
  </LabFrame>
</template>

<style scoped>
.bitsrow {
  margin: 10px 0 14px;
}
.bits .pd {
  background: var(--p3);
  color: #fff;
}
.bits .pt {
  background: var(--p0);
  color: #fff;
}
.bits .off {
  background: var(--bg-sunk);
}
.legend {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
.legend .pd {
  background: var(--p3);
}
.legend .pt {
  background: var(--p0);
}
.legend .off {
  background: var(--bg-sunk);
  border: 1px solid var(--rule-strong);
}
.walk {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 0.9fr;
  gap: 10px;
  align-items: start;
}
@media (max-width: 700px) {
  .walk {
    grid-template-columns: 1fr;
  }
  .arrow {
    transform: rotate(90deg);
  }
}
.table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  margin-top: 6px;
}
.table.missing {
  display: block;
  padding: 18px 8px;
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--rule-strong);
  border-radius: 4px;
}
.ent {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--faint);
  background: var(--bg);
  transition: all 0.3s;
}
.ent.valid {
  color: var(--ink);
  background: var(--bg-sunk);
}
.ent.hot {
  background: var(--accent);
  color: #fff;
  transform: scale(1.04);
}
.arrow {
  align-self: center;
  font-size: 22px;
  color: var(--rule-strong);
  transition: color 0.3s;
}
.arrow.on {
  color: var(--accent);
}
.pa {
  margin-top: 10px;
  font-size: 26px;
  color: var(--accent-ink);
  display: grid;
}
.pa small {
  font-size: 12px;
  color: var(--muted);
}
.pa.fault {
  color: var(--bad);
}
.pa.wait {
  color: var(--faint);
}
.steps {
  margin: 14px 0 12px;
  padding-left: 1.2em;
  font-size: 13px;
  display: grid;
  gap: 3px;
  color: var(--faint);
}
.steps li.on {
  color: var(--ink-2);
}
.steps li.on.fault {
  color: var(--bad);
}
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s var(--ease);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
