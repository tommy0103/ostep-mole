/**
 * Chapters 15, 16, 18, 20: address translation, from base-and-bounds to multi-level page tables.
 * Every function returns the steps it took, so the labs can animate the hardware's reasoning.
 */

export interface Step {
  /** stable id used by the labs to highlight the right part of the diagram */
  id: string
  en: string
  zh: string
}

export type Translation = { ok: true; pa: number; steps: Step[] } | { ok: false; fault: string; steps: Step[] }

const hex = (n: number, w = 0) => '0x' + n.toString(16).toUpperCase().padStart(w, '0')
export { hex }

// ---------- base & bounds (ch. 15) ----------
export function baseBounds(va: number, base: number, bounds: number): Translation {
  const steps: Step[] = [{ id: 'check', en: `Is ${va} < bounds (${bounds})?`, zh: `${va} < 界限（${bounds}）吗？` }]
  if (va < 0 || va >= bounds) {
    steps.push({ id: 'fault', en: 'No → out of bounds: raise an exception, the OS likely kills the process', zh: '否 → 越界：触发异常，操作系统很可能终止该进程' })
    return { ok: false, fault: 'bounds', steps }
  }
  const pa = base + va
  steps.push({ id: 'add', en: `Yes → physical = base + virtual = ${base} + ${va} = ${pa}`, zh: `是 → 物理地址 = 基址 + 虚拟地址 = ${base} + ${va} = ${pa}` })
  return { ok: true, pa, steps }
}

// ---------- segmentation (ch. 16) ----------
export interface Segment {
  name: string
  base: number
  size: number
  growsPositive: boolean
}

/** Top 2 bits of a 14-bit (16KB) address select the segment: 00 code, 01 heap, 11 stack. */
export function segmentTranslate(va: number, segs: Segment[], addrBits = 14): Translation {
  const segBits = 2
  const offBits = addrBits - segBits
  const maxSeg = 1 << offBits
  const segIdx = va >>> offBits
  const offset = va & (maxSeg - 1)
  const steps: Step[] = [
    { id: 'split', en: `Segment = top 2 bits = ${segIdx.toString(2).padStart(2, '0')}, offset = ${offset}`, zh: `段号 = 高 2 位 = ${segIdx.toString(2).padStart(2, '0')}，偏移量 = ${offset}` },
  ]
  const seg = segs[segIdx]
  if (!seg) {
    steps.push({ id: 'fault', en: 'No such segment → segmentation fault', zh: '没有这个段 → 段错误（segmentation fault）' })
    return { ok: false, fault: 'segment', steps }
  }
  if (seg.growsPositive) {
    if (offset >= seg.size) {
      steps.push({ id: 'fault', en: `Offset ${offset} ≥ size ${seg.size} → segmentation fault`, zh: `偏移量 ${offset} ≥ 段大小 ${seg.size} → 段错误` })
      return { ok: false, fault: 'bounds', steps }
    }
    const pa = seg.base + offset
    steps.push({ id: 'add', en: `${seg.name}: base ${seg.base} + offset ${offset} = ${pa}`, zh: `${seg.name}：基址 ${seg.base} + 偏移量 ${offset} = ${pa}` })
    return { ok: true, pa, steps }
  }
  // negative growth (stack): offset counts down from the top of the segment
  const neg = offset - maxSeg
  steps.push({ id: 'neg', en: `Stack grows down: negative offset = ${offset} − ${maxSeg} = ${neg}`, zh: `栈反向增长：负偏移量 = ${offset} − ${maxSeg} = ${neg}` })
  if (-neg > seg.size) {
    steps.push({ id: 'fault', en: `|${neg}| > size ${seg.size} → segmentation fault`, zh: `|${neg}| > 段大小 ${seg.size} → 段错误` })
    return { ok: false, fault: 'bounds', steps }
  }
  const pa = seg.base + neg
  steps.push({ id: 'add', en: `${seg.name}: base ${seg.base} + (${neg}) = ${pa}`, zh: `${seg.name}：基址 ${seg.base} + (${neg}) = ${pa}` })
  return { ok: true, pa, steps }
}

// ---------- linear paging (ch. 18) ----------
export interface PTE {
  valid: boolean
  pfn: number
}

export function pageTranslate(va: number, pageSize: number, table: PTE[]): Translation & { vpn: number; offset: number } {
  const offBits = Math.log2(pageSize)
  const vpn = va >>> offBits
  const offset = va & (pageSize - 1)
  const steps: Step[] = [{ id: 'split', en: `VPN = va >> ${offBits} = ${vpn}, offset = va & ${pageSize - 1} = ${offset}`, zh: `VPN = va >> ${offBits} = ${vpn}，偏移量 = va & ${pageSize - 1} = ${offset}` }]
  const pte = table[vpn]
  steps.push({ id: 'lookup', en: `PTE = PageTable[${vpn}]`, zh: `页表项 = 页表[${vpn}]` })
  if (!pte || !pte.valid) {
    steps.push({ id: 'fault', en: 'Invalid PTE → exception (segfault, or a page fault if it is swapped out)', zh: '页表项无效 → 异常（段错误；若页被换出则是缺页）' })
    return { ok: false, fault: 'invalid', steps, vpn, offset }
  }
  const pa = (pte.pfn << offBits) | offset
  steps.push({ id: 'concat', en: `Physical = (PFN ${pte.pfn} << ${offBits}) | ${offset} = ${pa}`, zh: `物理地址 = (PFN ${pte.pfn} << ${offBits}) | ${offset} = ${pa}` })
  return { ok: true, pa, steps, vpn, offset }
}

// ---------- two-level page table (ch. 20 worked example) ----------
/**
 * 16KB address space, 64-byte pages → 14-bit VA = 8-bit VPN + 6-bit offset.
 * 256 PTEs × 4 bytes = 1KB = 16 pages of PTEs → 4-bit page-directory index + 4-bit page-table index.
 */
export interface TwoLevel {
  /** page directory: 16 entries; each points to a page of PTEs (or is invalid) */
  dir: ({ valid: false } | { valid: true; pfn: number; ptes: PTE[] })[]
}

export function twoLevelTranslate(va: number, pt: TwoLevel) {
  const offset = va & 0x3f
  const vpn = va >>> 6
  const pdIndex = vpn >>> 4
  const ptIndex = vpn & 0xf
  const steps: Step[] = [
    { id: 'split', en: `VPN = ${vpn} → PD index = ${pdIndex}, PT index = ${ptIndex}; offset = ${offset}`, zh: `VPN = ${vpn} → 页目录索引 = ${pdIndex}，页表索引 = ${ptIndex}；偏移量 = ${offset}` },
  ]
  const pde = pt.dir[pdIndex]
  steps.push({ id: 'pde', en: `PDE = PageDir[${pdIndex}]`, zh: `页目录项 = 页目录[${pdIndex}]` })
  if (!pde || !pde.valid) {
    steps.push({ id: 'fault', en: 'PDE invalid: no page of the page table is even allocated here → fault', zh: '页目录项无效：这里连页表页都没有分配 → 异常' })
    return { ok: false as const, fault: 'pde', steps, pdIndex, ptIndex, offset }
  }
  const pte = pde.ptes[ptIndex]
  steps.push({ id: 'pte', en: `PTE = page ${pde.pfn} of the page table, entry ${ptIndex}`, zh: `页表项 = 页表所在物理页 ${pde.pfn} 中的第 ${ptIndex} 项` })
  if (!pte || !pte.valid) {
    steps.push({ id: 'fault', en: 'PTE invalid → fault', zh: '页表项无效 → 异常' })
    return { ok: false as const, fault: 'pte', steps, pdIndex, ptIndex, offset }
  }
  const pa = (pte.pfn << 6) | offset
  steps.push({ id: 'concat', en: `Physical = (PFN ${pte.pfn} << 6) | ${offset} = ${pa}`, zh: `物理地址 = (PFN ${pte.pfn} << 6) | ${offset} = ${pa}` })
  return { ok: true as const, pa, steps, pdIndex, ptIndex, offset }
}

/** Bytes needed by a linear vs. a two-level table for the given set of used virtual pages. */
export function tableCost(usedVpns: number[], vpnBits: number, pteSize: number, pageSize: number) {
  const linear = (1 << vpnBits) * pteSize
  const ptesPerPage = pageSize / pteSize
  const pages = new Set(usedVpns.map((v) => Math.floor(v / ptesPerPage)))
  const dirEntries = Math.ceil((1 << vpnBits) / ptesPerPage)
  const twoLevel = dirEntries * pteSize + pages.size * pageSize
  return { linear, twoLevel, ptPages: pages.size, dirEntries }
}
