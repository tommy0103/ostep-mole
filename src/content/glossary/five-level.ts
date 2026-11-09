import type { Term } from './index'

/** Terms of “Four levels, then five”. */
const terms: Record<string, Term> = {
  'direct-map': {
    title: { en: 'Direct map', zh: '直接映射区（direct map）' },
    body: {
      en: 'A region of the kernel’s half of the address space where all of physical memory is mapped in one contiguous range, so that the kernel can reach any physical page by adding a fixed offset. With four-level page tables on x86-64 Linux that region has room for 64 TiB.',
      zh: '内核那一半地址空间里的一段区域，把全部物理内存连续地映射在这里，这样内核只要加上一个固定偏移，就能访问任何物理页。在 x86-64 Linux 的四级页表下，这段区域能容纳 64 TiB。',
    },
    note: 'five-level',
  },
  'linux-pt-levels': {
    title: { en: 'pgd, p4d, pud, pmd, pte', zh: 'pgd、p4d、pud、pmd、pte' },
    body: {
      en: 'Linux’s own names for the levels of a page table, from the top: page global directory, page level 4 directory, page upper directory, page middle directory, and the page table entries at the bottom. The kernel uses these names on every architecture, whatever the hardware calls its tables.',
      zh: 'Linux 自己给页表各级起的名字，从顶向下依次是：页全局目录、第 4 级页目录、页上级目录、页中间目录，以及最底层的页表项。无论硬件怎么称呼自己的表，内核在所有架构上都用这套名字。',
    },
  },
  cpuid: {
    title: { en: 'CPUID', zh: 'CPUID' },
    body: {
      en: 'The x86 instruction with which a program or kernel asks the processor what it is and which features it has.',
      zh: 'x86 的一条指令，程序或内核用它询问处理器的型号，以及它支持哪些特性。',
    },
  },
  'kernel-cmdline': {
    title: { en: 'Kernel command line', zh: '内核命令行' },
    body: {
      en: 'A string of options the boot loader hands to the Linux kernel, such as `no5lvl`. It is how an administrator changes the kernel’s behaviour from the very start. A running system shows it in [[proc-sys|`/proc/cmdline`]].',
      zh: '引导程序交给 Linux 内核的一串选项，比如 `no5lvl`。管理员靠它从一开始就改变内核的行为。运行中的系统可以在 [[proc-sys|`/proc/cmdline`]] 里看到它。',
    },
  },
  'page-walk-cache': {
    title: { en: 'Page-walk cache', zh: '页表遍历缓存' },
    body: {
      en: 'A small cache in the processor, separate from the [[tlb|TLB]], that holds entries from the upper levels of the page-table tree. A hit lets the hardware begin its [[page-walk|walk]] at a lower table. Intel calls these paging-structure caches.',
      zh: '处理器里一块独立于 [[tlb|TLB]] 的小缓存，存放页表树上面几级的表项。命中时，硬件的[[page-walk|遍历]]可以从较低的某张表开始。Intel 把它们叫作分页结构缓存。',
    },
  },
  'shadow-page-table': {
    title: { en: 'Shadow page table', zh: '影子页表' },
    body: {
      en: 'The method used before processors could do nested translation: a [[hypervisor|hypervisor]] kept, for each guest, a hidden page table mapping guest virtual addresses straight to host physical ones, and pointed the CPU at it. To keep it in step, it had to trap every update the guest made to its own page tables.',
      zh: '在处理器还不能做嵌套转换时用的办法：[[hypervisor|虚拟机监控程序]]为每个客户机维护一张隐藏的页表，把客户机虚拟地址直接映射到宿主机物理地址，并让 CPU 使用它。为了保持同步，客户机对自己页表的每一次修改都必须被拦截下来。',
    },
  },
  'spec-benchmarks': {
    title: { en: 'SPEC benchmarks', zh: 'SPEC 基准测试' },
    body: {
      en: 'Standard suites of programs published by the Standard Performance Evaluation Corporation, widely used to compare processors and systems on CPU-heavy work.',
      zh: '标准性能评估公司（SPEC）发布的一套套标准程序，被广泛用来比较处理器和系统在 CPU 密集型任务上的表现。',
    },
  },
  'pointer-tagging': {
    title: { en: 'Pointer tagging', zh: '指针标记（pointer tagging）' },
    body: {
      en: 'Keeping extra information, such as a type or a garbage-collection mark, in the bits of a pointer that addresses do not use. Hardware features such as Intel’s LAM (Linear Address Masking) and ARM’s top-byte ignore make this safe by defining which high bits the processor ignores when it follows the pointer.',
      zh: '把额外信息（比如类型、垃圾回收标记）放进指针里地址用不到的位。Intel 的 LAM（线性地址掩码）和 ARM 的 top-byte ignore 这类硬件特性，明确规定处理器在使用指针时忽略哪些高位，让这种做法变得安全。',
    },
  },
}

export default terms
