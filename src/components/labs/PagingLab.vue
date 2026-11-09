<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'
import { pageTranslate, type PTE } from '@/lib/sim/memory'
import { t, uiLang, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** Figure 18.1/18.2: a 64-byte address space with 16-byte pages in a 128-byte physical memory. */
const TABLE: PTE[] = [
  { valid: true, pfn: 3 },
  { valid: true, pfn: 7 },
  { valid: true, pfn: 5 },
  { valid: true, pfn: 2 },
]
const va = ref(21)
const r = computed(() => pageTranslate(va.value, 16, TABLE))
const vaBits = computed(() => va.value.toString(2).padStart(6, '0').split(''))
const pa = computed(() => (r.value.ok ? r.value.pa : 0))
const paBits = computed(() => pa.value.toString(2).padStart(7, '0').split(''))
const pfn = computed(() => TABLE[r.value.vpn].pfn)
const NAMES = ['page 0', 'page 1', 'page 2', 'page 3']
const fy = (f: number) => 26 + f * 34
</script>

<template>
  <LabFrame :title="title" name="paging"
    :hint="{ en: 'The offset is copied through untouched; only the VPN is translated. That is the whole trick.', zh: '偏移量原封不动地复制过去；只有 VPN 需要转换。整个诀窍就这么简单。' }">
    <div class="lab-grid side">
      <div class="lab-grid">
        <label class="field">{{ t({ en: 'virtual address', zh: '虚拟地址' }) }} <input v-model.number="va" type="range" min="0" max="63" /> <span class="mono">{{ va }}</span></label>
        <div class="bitline">
          <span class="lab-label">VA</span>
          <span class="bits">
            <span v-for="(b, i) in vaBits" :key="'v' + i" :class="i < 2 ? 'vpn' : 'off'">{{ b }}</span>
          </span>
          <span class="legend mono"><i class="vpn" /> VPN = {{ r.vpn }} <i class="off" /> offset = {{ r.offset }}</span>
        </div>
        <div class="arrow mono">↓ {{ t({ en: 'page table lookup', zh: '查页表' }) }}: VPN {{ r.vpn }} → PFN {{ pfn }}</div>
        <div class="bitline">
          <span class="lab-label">PA</span>
          <span class="bits">
            <span v-for="(b, i) in paBits" :key="'p' + i + pa" :class="i < 3 ? 'pfn pulse' : 'off'">{{ b }}</span>
          </span>
          <span class="legend mono"><i class="pfn" /> PFN = {{ pfn }} <i class="off" /> offset = {{ r.offset }} → <b>{{ pa }}</b></span>
        </div>
        <ol class="steps">
          <li v-for="s in r.steps" :key="s.id">{{ s[uiLang] }}</li>
        </ol>
      </div>
      <svg class="viz" viewBox="0 0 380 300" role="img" :aria-label="t({ en: 'page table and physical frames', zh: '页表与物理帧' })">
        <text x="0" y="14" class="ttl">{{ t({ en: 'virtual pages', zh: '虚拟页' }) }}</text>
        <g v-for="(n, i) in NAMES" :key="n">
          <rect x="0" :y="26 + i * 40" width="80" height="34" rx="3" :fill="`var(--p${i})`" :opacity="i === r.vpn ? 0.95 : 0.35" class="mv" />
          <text x="40" :y="47 + i * 40" text-anchor="middle" class="in">{{ n }}</text>
        </g>
        <text x="118" y="14" class="ttl">{{ t({ en: 'page table', zh: '页表' }) }}</text>
        <g v-for="(p, i) in TABLE" :key="'pt' + i">
          <rect x="110" :y="26 + i * 40" width="92" height="34" rx="3" :fill="i === r.vpn ? 'var(--accent-soft)' : 'var(--bg)'" :stroke="i === r.vpn ? 'var(--accent)' : 'var(--rule)'" class="mv" />
          <text x="156" :y="47 + i * 40" text-anchor="middle" class="reg">VPN {{ i }} → {{ p.pfn }}</text>
        </g>
        <text x="250" y="14" class="ttl">{{ t({ en: 'physical frames', zh: '物理帧' }) }}</text>
        <g v-for="f in 8" :key="'f' + f">
          <rect x="250" :y="fy(f - 1)" width="100" height="30" rx="2" :fill="TABLE.findIndex((p) => p.pfn === f - 1) >= 0 ? `var(--p${TABLE.findIndex((p) => p.pfn === f - 1)})` : f === 1 ? 'var(--ink-2)' : 'var(--bg-sunk)'" :opacity="TABLE.findIndex((p) => p.pfn === f - 1) === r.vpn ? 0.95 : f === 1 ? 0.7 : 0.35" class="mv" />
          <text x="300" :y="fy(f - 1) + 19" text-anchor="middle" class="in">{{ f === 1 ? t({ en: 'page table', zh: '页表' }) : TABLE.findIndex((p) => p.pfn === f - 1) >= 0 ? NAMES[TABLE.findIndex((p) => p.pfn === f - 1)] : '' }}</text>
          <text x="356" :y="fy(f - 1) + 19" class="ax">{{ f - 1 }}</text>
        </g>
        <path :d="`M 80 ${43 + r.vpn * 40} L 110 ${43 + r.vpn * 40}`" stroke="var(--ink)" stroke-width="1.4" class="mv" />
        <path :d="`M 202 ${43 + r.vpn * 40} C 230 ${43 + r.vpn * 40}, 225 ${fy(pfn) + 15}, 250 ${fy(pfn) + 15}`" fill="none" stroke="var(--accent)" stroke-width="1.6" class="mv" />
        <line x1="250" x2="350" :y1="fy(pfn) + 4 + (r.offset / 16) * 22" :y2="fy(pfn) + 4 + (r.offset / 16) * 22" stroke="var(--ink)" stroke-width="2" class="mv" />
      </svg>
    </div>
  </LabFrame>
</template>

<style scoped>
.bitline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.bits .vpn {
  background: var(--p0);
  color: #fff;
}
.bits .pfn {
  background: var(--accent);
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
.legend i.vpn {
  background: var(--p0);
}
.legend i.pfn {
  background: var(--accent);
}
.legend i.off {
  background: var(--bg-sunk);
  border: 1px solid var(--rule-strong);
}
.legend b {
  color: var(--accent-ink);
}
.arrow {
  font-size: 12px;
  color: var(--muted);
  padding-left: 30px;
}
.steps {
  margin: 0;
  padding-left: 1.2em;
  font-size: 13px;
  display: grid;
  gap: 3px;
  color: var(--ink-2);
}
.ttl {
  font-size: 10.5px !important;
  fill: var(--muted) !important;
}
.in {
  fill: #fff !important;
  font-size: 10.5px !important;
}
.reg {
  font-size: 11px !important;
  fill: var(--ink) !important;
}
.ax {
  font-size: 9.5px !important;
  fill: var(--faint) !important;
}
.mv {
  transition: all 0.35s var(--ease);
}
</style>
