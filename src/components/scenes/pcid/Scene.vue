<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import Cr3Demo from './Cr3Demo.vue'

/**
 * The running figure of the PCID article: a process in user mode above the kernel, one CPU with its
 * CR3 register and its TLB, and the process's top-level page table in memory (one table before
 * KPTI, an 8 KiB pair of kernel copy and user copy after). Rows of the TLB carry the tag (PCID) the
 * article is about; the right side of the CPU holds what a state adds (ASID slots, the flush mask).
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'tables'],
  asid: ['procA', 'procB', 'switch', 'cpu', 'cr3', 'tlb', 'tables', 'tableB'],
  shared: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'tables', 'gnote'],
  meltdown: ['procA', 'kernel', 'cpu', 'cr3', 'tlb', 'tables', 'melt'],
  kpti: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'tables', 'ucopy'],
  flush: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'flushx'],
  tag: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'tables', 'ucopy', 'pair'],
  asids: ['procA', 'procB', 'switch', 'kernel', 'cpu', 'cr3', 'tlb', 'slots'],
  invalidate: ['procA', 'kernel', 'cpu', 'cr3', 'tlb', 'mask'],
  immune: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb', 'tables', 'gnote'],
  vm: ['procA', 'kernel', 'cross', 'hyp', 'cpu', 'cr3', 'tlb', 'flushx'],
  arm: ['procA', 'kernel', 'cross', 'cpu', 'cr3', 'tlb'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 420)
const st = computed(() => props.state)

/* what the lane between user and kernel says */
const laneNote = computed(() => {
  switch (st.value) {
    case 'kpti': return L('in: CR3 ← kernel copy · out: CR3 ← user copy', '进入：CR3 ← 内核副本 · 返回：CR3 ← 用户副本')
    case 'flush': case 'vm': return L('each crossing flushes the TLB', '每次穿越都清空 TLB')
    case 'tag': return L('each crossing flips bits 11 and 12', '每次穿越翻转第 11、12 位')
    case 'invalidate': return L('the kernel unmaps a page of A', '内核解除 A 的一页映射')
    case 'arm': return L('each crossing flips bit 48', '每次穿越翻转第 48 位')
    default: return L('system call, interrupt, return', '系统调用、中断、返回')
  }
})

/* CR3, as a row of fields; `vals` are what the state shows in them */
type Mode = 'off' | 'asid' | 'user' | 'kern'
const MODE: Record<string, Mode> = { asid: 'asid', tag: 'user', asids: 'user', invalidate: 'kern' }
const mode = computed<Mode>(() => MODE[st.value] ?? 'off')
const addr = computed(() => {
  if (st.value === 'kpti' || st.value === 'flush' || st.value === 'vm') return L('A’s user copy', 'A 的用户副本')
  if (mode.value === 'user' || mode.value === 'kern') return L('A’s table pair', 'A 的页表对')
  return L('A’s page table', 'A 的页表')
})
const vals = computed(() => {
  const m = mode.value
  if (m === 'off') return { nf: '–', b12: '', b11: '–', pcid: L('off', '未启用') }
  if (m === 'asid') return { nf: '–', b12: '', b11: '0', pcid: '1' }
  if (m === 'user') return { nf: '1', b12: '1', b11: '1', pcid: '1' }
  return { nf: '1', b12: '0', b11: '0', pcid: '1' }
})

/* the TLB: tag, what the entry maps, global bit; owner a = process A, b = process B, k = kernel */
type Row = { tag: string; en: string; zh: string; who: 'a' | 'b' | 'k'; g?: boolean; stale?: boolean }
const r = (tag: string, en: string, zh: string, who: Row['who'], g = false, stale = false): Row => ({ tag, en, zh, who, g, stale })
const OLD: Row[] = [
  r('–', 'A: code', 'A：代码', 'a'),
  r('–', 'A: data', 'A：数据', 'a'),
  r('–', 'A: stack', 'A：栈', 'a'),
  r('–', 'kernel: code', '内核：代码', 'k', true),
  r('–', 'kernel: data', '内核：数据', 'k', true),
]
const ROWS: Record<string, Row[]> = {
  overview: OLD,
  shared: OLD,
  meltdown: OLD,
  immune: OLD,
  asid: [r('1', 'A: code', 'A：代码', 'a'), r('1', 'A: data', 'A：数据', 'a'), r('2', 'B: code', 'B：代码', 'b'), r('2', 'B: data', 'B：数据', 'b')],
  kpti: [r('–', 'A: code', 'A：代码', 'a'), r('–', 'A: data', 'A：数据', 'a'), r('–', 'kernel: code', '内核：代码', 'k'), r('–', 'kernel: data', '内核：数据', 'k')],
  flush: [],
  vm: [],
  tag: [r('2049', 'A: code', 'A：代码', 'a'), r('2049', 'A: data', 'A：数据', 'a'), r('1', 'kernel: code', '内核：代码', 'k'), r('1', 'kernel: data', '内核：数据', 'k'), r('1', 'kernel: stack', '内核：栈', 'k')],
  asids: [r('2049', 'A: code', 'A：代码', 'a'), r('2049', 'A: data', 'A：数据', 'a'), r('1', 'kernel: code', '内核：代码', 'k'), r('2050', 'B: code', 'B：代码', 'b'), r('2', 'kernel: code', '内核：代码', 'k')],
  invalidate: [r('2049', 'A: data', 'A：数据', 'a', false, true), r('2049', 'A: code', 'A：代码', 'a'), r('1', 'kernel: code', '内核：代码', 'k'), r('1', 'kernel: data', '内核：数据', 'k')],
  arm: [r('3', 'A: code', 'A：代码', 'a'), r('3', 'A: data', 'A：数据', 'a'), r('2', 'kernel: code', '内核：代码', 'k'), r('2', 'kernel: data', '内核：数据', 'k')],
}
const rows = computed(() => ROWS[st.value] ?? OLD)
const isArm = computed(() => st.value === 'arm')

/* the CR3 → table link, to the copy that is loaded */
const linkTo = computed(() => (shown.value.has('ucopy') ? 272 : 152))
</script>

<template>
  <Cr3Demo v-if="demo && state === 'tag'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A process, the kernel, a CPU’s CR3 and TLB, and page tables', '进程、内核、CPU 的 CR3 与 TLB，以及页表')">
    <defs>
      <marker id="pc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="pc-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="badhead" />
      </marker>
    </defs>

    <!-- lanes: user mode above, kernel below -->
    <text x="8" y="30" class="tag">{{ L('user', '用户态') }}</text>
    <g :class="part('procA')">
      <rect x="52" y="10" width="120" height="34" rx="6" class="box" />
      <text x="112" y="25" class="lbl c">{{ L('Process A', '进程 A') }}</text>
      <text x="112" y="38" class="sub c">{{ L('user code', '用户代码') }}</text>
    </g>
    <g :class="part('procB')">
      <rect x="224" y="10" width="120" height="34" rx="6" class="box" />
      <text x="284" y="25" class="lbl c">{{ L('Process B', '进程 B') }}</text>
      <text x="284" y="38" class="sub c">{{ L('user code', '用户代码') }}</text>
    </g>
    <g :class="part('switch')">
      <path d="M174,30 L221,30" class="call" marker-end="url(#pc-arrow)" />
      <text x="198" y="23" class="tag c">{{ L('switch', '切换') }}</text>
    </g>

    <g :class="part('kernel')">
      <text x="8" y="85" class="tag">{{ L('kernel', '内核态') }}</text>
      <rect x="52" y="66" width="292" height="30" rx="6" class="box floor" />
      <text x="198" y="85" class="lbl c">{{ isArm ? L('Kernel (EL1)', '内核（EL1）') : L('Kernel', '内核') }}</text>
    </g>
    <g :class="part('cross')">
      <path d="M78,45 L78,64" class="call" marker-end="url(#pc-arrow)" />
      <path d="M96,65 L96,46" class="call" marker-end="url(#pc-arrow)" />
      <text x="106" y="59" class="tag" :class="{ 'bad-text': st === 'flush' || st === 'vm' }">{{ laneNote }}</text>
    </g>
    <g :class="part('flushx')">
      <text x="78" y="58" class="bad-text c big">✕</text>
      <text x="96" y="58" class="bad-text c big">✕</text>
    </g>
    <g v-if="st === 'invalidate'">
      <text x="106" y="59" class="tag">{{ laneNote }}</text>
    </g>

    <!-- a hypervisor under a guest -->
    <g :class="part('hyp')">
      <rect x="52" y="101" width="292" height="18" rx="4" class="box gate" />
      <text x="198" y="113.5" class="tiny c strongt">{{ L('hypervisor: the pcid flag is not passed to the guest', '虚拟机监控程序：没把 pcid 标志透传给客户机') }}</text>
    </g>

    <!-- one CPU: CR3 and the TLB -->
    <g :class="part('cpu')">
      <rect x="8" y="124" width="344" height="162" rx="8" class="outline" />
      <text x="14" y="136" class="tag">CPU</text>
    </g>

    <g :class="part('cr3')">
      <text x="16" y="158" class="lbl">{{ isArm ? 'TTBR' : 'CR3' }}</text>
      <template v-if="!isArm">
        <text x="67" y="142" class="tiny c">{{ L('no-flush', '不清空') }}</text>
        <text x="157" y="142" class="tiny c">{{ L('top-level table address', '顶层页表地址') }}</text>
        <text x="310" y="142" class="tiny c">PCID</text>
        <rect x="52" y="145" width="30" height="18" class="field" :class="{ off: vals.nf === '–' }" />
        <rect x="82" y="145" :width="vals.b12 ? 150 : 172" height="18" class="field addr" />
        <rect v-if="vals.b12" x="232" y="145" width="22" height="18" class="field addr" :class="{ hot: vals.b12 === '1' }" />
        <rect x="254" y="145" width="22" height="18" class="field" :class="{ off: vals.b11 === '–', hot: vals.b11 === '1' }" />
        <rect x="276" y="145" width="68" height="18" class="field" :class="{ off: mode === 'off' }" />
        <text x="67" y="157.5" class="tiny c">{{ vals.nf }}</text>
        <text :x="vals.b12 ? 157 : 168" y="157.5" class="tiny c strongt">{{ addr }}</text>
        <text v-if="vals.b12" x="243" y="157.5" class="tiny c">{{ vals.b12 }}</text>
        <text x="265" y="157.5" class="tiny c">{{ vals.b11 }}</text>
        <text x="310" y="157.5" class="tiny c">{{ vals.pcid }}</text>
        <text x="67" y="173" class="tiny c">{{ vals.nf === '1' ? L('63, write only', '63，只写') : '63' }}</text>
        <text v-if="vals.b12" x="243" y="173" class="tiny c">12</text>
        <text x="265" y="173" class="tiny c">11</text>
        <text x="310" y="173" class="tiny c">10 … 0</text>
      </template>
      <template v-else>
        <text x="113" y="142" class="tiny c">ASID</text>
        <text x="260" y="142" class="tiny c">{{ L('table address', '页表地址') }}</text>
        <rect x="52" y="145" width="102" height="18" class="field" />
        <rect x="154" y="145" width="22" height="18" class="field hot" />
        <rect x="176" y="145" width="168" height="18" class="field addr" />
        <text x="103" y="157.5" class="tiny c">{{ L('upper bits', '高位') }}</text>
        <text x="165" y="157.5" class="tiny c">1</text>
        <text x="260" y="157.5" class="tiny c strongt">{{ L('user table', '用户页表') }}</text>
        <text x="103" y="173" class="tiny c">63 … 49</text>
        <text x="165" y="173" class="tiny c">48</text>
        <text x="260" y="173" class="tiny c">47 … 0</text>
      </template>
      <!-- CR3 points at the top-level table in memory -->
      <path :class="{ gone: !shown.has('tables') }" :d="`M222,163 L222,296 L${linkTo},296 L${linkTo},305`" class="link solid" marker-end="url(#pc-arrow)" />
    </g>

    <g :class="part('tlb')">
      <text x="16" y="196" class="lbl">TLB</text>
      <text x="76" y="194" class="tiny c">{{ isArm ? 'ASID' : 'PCID' }}</text>
      <text x="148" y="194" class="tiny c">{{ L('translation', '转换') }}</text>
      <text x="206" y="194" class="tiny c">G</text>
      <g v-for="i in 6" :key="i">
        <rect x="52" :y="186 + i * 13" width="164" height="12" rx="1" class="row" :class="rows[i - 1] ? rows[i - 1].who : 'empty'" />
        <template v-if="rows[i - 1]">
          <text x="76" :y="195.5 + i * 13" class="tiny c ink">{{ rows[i - 1].tag }}</text>
          <text x="148" :y="195.5 + i * 13" class="tiny c ink">{{ L(rows[i - 1].en, rows[i - 1].zh) }}</text>
          <text v-if="rows[i - 1].g" x="206" :y="195.5 + i * 13" class="tiny c ink">G</text>
          <path v-if="rows[i - 1].stale" :d="`M56,${192.5 + i * 13} L212,${192.5 + i * 13}`" class="danger" />
        </template>
      </g>
      <path d="M100,199 L100,277 M196,199 L196,277" class="sep" />
      <text v-if="!rows.length" x="134" y="243" class="bad-text c big">{{ L('flushed', '已清空') }}</text>
    </g>

    <!-- right of the TLB: what this state adds -->
    <g :class="part('gnote')">
      <text x="230" y="214" class="tag hi">{{ L('G = global:', 'G = 全局：') }}</text>
      <text x="230" y="228" class="tag">{{ L('kept when CR3', '重新加载 CR3') }}</text>
      <text x="230" y="241" class="tag">{{ L('is reloaded', '也保留') }}</text>
    </g>
    <g :class="part('flushx')">
      <text x="230" y="214" class="tag hi">{{ L('50,000 calls/s', '每秒 5 万次调用') }}</text>
      <text x="230" y="228" class="tag">{{ L('→ 100,000 flushes/s', '→ 每秒 10 万次清空') }}</text>
      <text x="230" y="241" class="tag">{{ L('per CPU', '（每 CPU）') }}</text>
    </g>
    <g :class="part('slots')">
      <text x="230" y="196" class="tag">{{ L('this CPU’s 6 slots', '本 CPU 的 6 个槽位') }}</text>
      <g v-for="(who, j) in ['A', 'B', 'C', 'D', '', '']" :key="j">
        <rect :x="230 + (j % 3) * 38" :y="202 + Math.floor(j / 3) * 26" width="34" height="22" rx="3" class="slot" :class="{ a: who === 'A', b: who === 'B' }" />
        <text :x="247 + (j % 3) * 38" :y="211 + Math.floor(j / 3) * 26" class="tiny c">{{ j }}</text>
        <text :x="247 + (j % 3) * 38" :y="221 + Math.floor(j / 3) * 26" class="tiny c strongt">{{ who || '–' }}</text>
      </g>
      <text x="230" y="267" class="tiny">{{ L('kernel PCID = slot + 1', '内核 PCID = 槽位号 + 1') }}</text>
      <text x="230" y="279" class="tiny">{{ L('user PCID = that + 2048', '用户 PCID = 再加 2048') }}</text>
    </g>
    <g :class="part('mask')">
      <text x="230" y="196" class="code small">user_pcid_flush_mask</text>
      <g v-for="j in 6" :key="j">
        <rect :x="230 + (j - 1) * 19" y="202" width="17" height="16" rx="2" class="slot" :class="{ set: j === 2 }" />
        <text :x="238.5 + (j - 1) * 19" y="213.5" class="tiny c" :class="{ 'on-fill': j === 2 }">{{ j === 2 ? 1 : 0 }}</text>
      </g>
      <text x="230" y="228" class="tiny">{{ L('bit 1: A’s user entries are stale', '第 1 位：A 的用户表项已过时') }}</text>
      <text x="230" y="250" class="tag hi">{{ L('INVPCID: drop it now,', 'INVPCID：立刻清掉，') }}</text>
      <text x="230" y="263" class="tag">{{ L('or flush on the way out', '或在出门时清空') }}</text>
    </g>

    <!-- memory: the top-level page tables -->
    <g :class="part('tables')">
      <text x="8" y="352" class="tag">{{ L('memory', '内存') }}</text>
      <text x="112" y="303" class="tag c">{{ shown.has('ucopy') ? L('kernel copy', '内核副本') : L('A’s page table', 'A 的页表') }}</text>
      <rect x="52" y="308" width="120" height="90" rx="5" class="box" />
      <rect x="58" y="314" width="108" height="36" rx="3" class="half k" :class="{ hit: st === 'meltdown' }" />
      <text x="112" y="329" class="tiny c ink">{{ L('kernel', '内核') }}</text>
      <text x="112" y="342" class="tiny c ink">{{ L('supervisor-only', '仅限特权态') }}</text>
      <rect x="58" y="356" width="108" height="36" rx="3" class="half a" />
      <text x="112" y="377" class="tiny c ink">{{ L('A’s memory', 'A 的内存') }}</text>
    </g>
    <g :class="part('tableB')">
      <text x="284" y="303" class="tag c">{{ L('B’s page table', 'B 的页表') }}</text>
      <rect x="224" y="308" width="120" height="90" rx="5" class="box" />
      <rect x="230" y="314" width="108" height="36" rx="3" class="half k" />
      <text x="284" y="335" class="tiny c ink">{{ L('kernel', '内核') }}</text>
      <rect x="230" y="356" width="108" height="36" rx="3" class="half b" />
      <text x="284" y="377" class="tiny c ink">{{ L('B’s memory', 'B 的内存') }}</text>
    </g>
    <g :class="part('ucopy')">
      <text x="232" y="303" class="tag c">{{ L('user copy', '用户副本') }}</text>
      <rect x="172" y="308" width="120" height="90" rx="5" class="box" />
      <rect x="178" y="314" width="108" height="36" rx="3" class="half gap" />
      <rect x="182" y="340" width="34" height="6" rx="1" class="half k" />
      <text x="232" y="326" class="tiny c">{{ L('no kernel, except', '没有内核，只留') }}</text>
      <text x="252" y="345.5" class="tiny c">{{ L('entry, IDT…', '入口、IDT…') }}</text>
      <rect x="178" y="356" width="108" height="36" rx="3" class="half a" />
      <text x="232" y="377" class="tiny c ink">{{ L('A’s memory', 'A 的内存') }}</text>
    </g>
    <g :class="part('pair')">
      <path d="M52,402 L52,406 L292,406 L292,402" class="link solid" />
      <text x="172" y="416" class="tag c">{{ L('one 8 KiB pair: bit 12 of CR3 picks the half', '一个 8 KiB 的页表对：CR3 第 12 位选哪一半') }}</text>
    </g>

    <!-- Meltdown: a user load that reaches the kernel half -->
    <g :class="part('melt')">
      <path d="M52,32 C38,32 40,60 40,90 L40,320 C40,330 46,332 56,332" class="danger dash" marker-end="url(#pc-bad)" />
      <text x="182" y="330" class="tag hi bad-text">{{ L('A loads a kernel address:', 'A 读一个内核地址：') }}</text>
      <text x="182" y="344" class="tag">{{ L('it runs before the permission', '在权限检查之前') }}</text>
      <text x="182" y="357" class="tag">{{ L('check faults it, and the cache', '就执行了；异常来了，') }}</text>
      <text x="182" y="370" class="tag">{{ L('keeps a trace of the value', '缓存里的痕迹还在') }}</text>
    </g>
  </svg>
</template>

<style scoped>
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
.code.small {
  font-size: 8.5px;
}
.field {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
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
}
.row {
  stroke: none;
}
.row.empty {
  fill: var(--bg-sunk);
}
.row.a,
.half.a {
  fill: color-mix(in srgb, var(--p0) 22%, var(--bg-elev));
}
.row.b,
.half.b {
  fill: color-mix(in srgb, var(--p1) 22%, var(--bg-elev));
}
.row.k,
.half.k {
  fill: var(--rule-strong);
}
.half.gap {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.half.hit {
  stroke: var(--p3);
  stroke-width: 1.6;
}
.sep {
  stroke: var(--bg-elev);
  stroke-width: 1.2;
}
.slot {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.slot.a {
  fill: color-mix(in srgb, var(--p0) 22%, var(--bg-elev));
}
.slot.b {
  fill: color-mix(in srgb, var(--p1) 22%, var(--bg-elev));
}
.slot.set {
  fill: var(--p3);
  stroke: var(--p3);
}
.danger.dash {
  stroke-dasharray: 4 3;
}
.badhead {
  fill: var(--p3);
}
.lit .row,
.lit .field {
  stroke: var(--accent);
  stroke-width: 1.4;
}
</style>
