<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * SWITCH_TO_USER_CR3 in six steps (arch/x86/entry/calling.h): read CR3, keep the low 11 bits (the
 * ASID), test the flush mask, set the no-flush bit, set bit 11 (user PCID), set bit 12 (user half of
 * the table pair) and write CR3. The TLB keeps both PCIDs' entries throughout.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const CODE = [
  'mov    %cr3, reg',
  'andq   $0x7FF, reg      /* mask ASID */',
  'bt     reg, user_pcid_flush_mask',
  'SET_NOFLUSH_BIT reg',
  'orq    $PTI_USER_PCID_MASK, reg',
  'orq    $PTI_USER_PGTABLE_MASK, reg ; mov reg, %cr3',
]
// the value being built (the copy of CR3 the macro edits)
const reg = computed(() => ({ nf: s.value >= 3 ? '1' : '0', b12: s.value >= 5 ? '1' : '0', b11: s.value >= 4 ? '1' : '0', low: '1' }))
// CR3 itself changes only at the final write; bit 63 is not stored in it
const cr3 = computed(() => ({ b12: s.value >= 5 ? '1' : '0', b11: s.value >= 5 ? '1' : '0', low: '1' }))
const userHalf = computed(() => s.value >= 5)
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 304" role="img" :aria-label="L('CR3 on the way back to user space', '返回用户态时的 CR3')">
    <defs>
      <marker id="pcd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the instruction of this step -->
    <rect x="8" y="6" width="344" height="22" rx="4" class="code-box" />
    <text x="16" y="21" class="code">{{ CODE[s] }}</text>

    <!-- bit positions -->
    <text x="67" y="42" class="tiny c">63 {{ L('no-flush', '不清空') }}</text>
    <text x="243" y="42" class="tiny c">12</text>
    <text x="265" y="42" class="tiny c">11</text>
    <text x="310" y="42" class="tiny c">10 … 0</text>

    <!-- CR3 -->
    <text x="8" y="59" class="lbl">CR3</text>
    <rect x="52" y="46" width="30" height="18" class="field off" />
    <rect x="82" y="46" width="150" height="18" class="field addr" />
    <rect x="232" y="46" width="22" height="18" class="field" :class="{ hot: s === 5 }" />
    <rect x="254" y="46" width="22" height="18" class="field" :class="{ hot: s === 5 }" />
    <rect x="276" y="46" width="68" height="18" class="field" />
    <text x="67" y="58.5" class="tiny c">–</text>
    <text x="157" y="58.5" class="tiny c strongt">{{ userHalf ? L('A’s pair, user half', 'A 的页表对，用户半') : L('A’s pair, kernel half', 'A 的页表对，内核半') }}</text>
    <text x="243" y="58.5" class="tiny c">{{ cr3.b12 }}</text>
    <text x="265" y="58.5" class="tiny c">{{ cr3.b11 }}</text>
    <text x="310" y="58.5" class="tiny c">{{ cr3.low }}</text>
    <text x="52" y="78" class="tiny">{{ s >= 5 ? L('PCID 2049 (user)', 'PCID 2049（用户）') : L('PCID 1 (kernel)', 'PCID 1（内核）') }}</text>

    <!-- the register the macro edits -->
    <path d="M30,64 L30,86" class="link solid" :class="{ gone: s !== 0 }" marker-end="url(#pcd-arrow)" />
    <path d="M40,86 L40,64" class="call" :class="{ gone: s !== 5 }" marker-end="url(#pcd-arrow)" />
    <text x="8" y="101" class="lbl">{{ L('reg', '寄存器') }}</text>
    <rect x="52" y="88" width="30" height="18" class="field" :class="{ hot: s === 3 }" />
    <rect x="82" y="88" width="150" height="18" class="field addr" />
    <rect x="232" y="88" width="22" height="18" class="field" :class="{ hot: s === 5 }" />
    <rect x="254" y="88" width="22" height="18" class="field" :class="{ hot: s === 4 }" />
    <rect x="276" y="88" width="68" height="18" class="field" :class="{ hot: s === 1 }" />
    <text x="67" y="100.5" class="tiny c">{{ reg.nf }}</text>
    <text x="157" y="100.5" class="tiny c strongt">{{ s >= 5 ? L('A’s pair, user half', 'A 的页表对，用户半') : L('A’s pair, kernel half', 'A 的页表对，内核半') }}</text>
    <text x="243" y="100.5" class="tiny c">{{ reg.b12 }}</text>
    <text x="265" y="100.5" class="tiny c">{{ reg.b11 }}</text>
    <text x="310" y="100.5" class="tiny c">{{ reg.low }}</text>

    <!-- the ASID and the flush mask -->
    <g class="fade" :class="{ show: s >= 1 }">
      <rect x="276" y="114" width="68" height="18" rx="3" class="chip" />
      <text x="310" y="126.5" class="tiny c on-fill">ASID = 1</text>
      <path d="M310,106 L310,113" class="link solid" />
    </g>
    <g class="fade" :class="{ show: s >= 2 }">
      <text x="52" y="126" class="code small">user_pcid_flush_mask</text>
      <g v-for="j in 6" :key="j">
        <rect :x="52 + (j - 1) * 19" y="132" width="17" height="16" rx="2" class="slot" :class="{ tested: j === 2 }" />
        <text :x="60.5 + (j - 1) * 19" y="143.5" class="tiny c">0</text>
        <text :x="60.5 + (j - 1) * 19" y="158" class="tiny c">{{ j - 1 }}</text>
      </g>
      <text x="172" y="144" class="tag hi">{{ L('bit 1 clear: user entries still good', '第 1 位为 0：用户表项仍有效') }}</text>
    </g>

    <!-- the TLB keeps both PCIDs' entries -->
    <text x="8" y="182" class="lbl">TLB</text>
    <text x="76" y="174" class="tiny c">PCID</text>
    <g v-for="(row, i) in [['1', L('kernel: code', '内核：代码'), 'k'], ['1', L('kernel: data', '内核：数据'), 'k'], ['2049', L('A: code', 'A：代码'), 'a'], ['2049', L('A: data', 'A：数据'), 'a']]" :key="i">
      <rect x="52" :y="178 + i * 13" width="164" height="12" rx="1" class="row" :class="[row[2], { cur: (s >= 5) === (row[2] === 'a') }]" />
      <text x="76" :y="187.5 + i * 13" class="tiny c ink">{{ row[0] }}</text>
      <text x="148" :y="187.5 + i * 13" class="tiny c ink">{{ row[1] }}</text>
    </g>
    <text x="228" y="192" class="tag" :class="{ hi: s >= 3 }">{{ s >= 5 ? L('nothing flushed:', '什么都没清空：') : s >= 3 ? L('bit 63 = 1:', '第 63 位 = 1：') : L('in use now:', '当前使用：') }}</text>
    <text x="228" y="205" class="tag">{{ s >= 5 ? L('PCID 2049 in use,', '用 PCID 2049，') : s >= 3 ? L('the write will keep', '写入时保留') : L('the PCID 1 rows', 'PCID 1 的表项') }}</text>
    <text x="228" y="218" class="tag">{{ s >= 5 ? L('PCID 1 rows wait', 'PCID 1 的等着') : s >= 3 ? L('every entry', '所有表项') : '' }}</text>

    <!-- the table pair; CR3 points at one half -->
    <rect x="52" y="244" width="120" height="44" rx="4" class="box" :class="{ cur: !userHalf }" />
    <text x="112" y="262" class="lbl c">{{ L('kernel copy', '内核副本') }}</text>
    <text x="112" y="277" class="tiny c">{{ L('first 4 KiB', '前 4 KiB') }}</text>
    <rect x="172" y="244" width="120" height="44" rx="4" class="box" :class="{ cur: userHalf }" />
    <text x="232" y="262" class="lbl c">{{ L('user copy', '用户副本') }}</text>
    <text x="232" y="277" class="tiny c">{{ L('second 4 KiB', '后 4 KiB') }}</text>
    <path :d="userHalf ? 'M232,234 L232,242' : 'M112,234 L112,242'" class="call" marker-end="url(#pcd-arrow)" />
    <text :x="userHalf ? 238 : 118" y="238" class="tiny">{{ L('CR3 points here', 'CR3 指向这里') }}</text>
    <text x="300" y="270" class="tiny">{{ L('8 KiB pair', '8 KiB 一对') }}</text>
  </svg>
</template>

<style scoped>
.demo {
  width: 100%;
  height: auto;
  display: block;
}
.code-box {
  fill: var(--code-bg);
  stroke: var(--rule);
}
.code {
  font-family: var(--font-mono);
  font-size: 9.5px;
  fill: var(--accent-ink);
  font-weight: 600;
}
.code.small {
  font-size: 8.5px;
  fill: var(--ink-2);
  font-weight: 400;
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.ink {
  fill: var(--ink);
}
.tiny.on-fill {
  fill: #fff;
}
.strongt {
  fill: var(--ink);
  font-weight: 600;
}
.field {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
  transition: fill 0.3s, stroke 0.3s;
}
.field.addr {
  fill: var(--bg-sunk);
}
.field.off {
  fill: var(--bg-sunk);
  opacity: 0.55;
}
.field.hot {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.6;
}
.chip {
  fill: var(--accent);
}
.slot {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.slot.tested {
  stroke: var(--accent);
  stroke-width: 1.8;
}
.row {
  stroke: none;
  opacity: 0.55;
  transition: opacity 0.3s;
}
.row.cur {
  opacity: 1;
}
.row.a {
  fill: color-mix(in srgb, var(--p0) 22%, var(--bg-elev));
}
.row.k {
  fill: var(--rule-strong);
}
.box.cur {
  stroke: var(--accent);
  stroke-width: 2;
  fill: var(--accent-soft);
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
</style>
