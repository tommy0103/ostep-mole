import type { SceneDef } from './index'

/** The running figure of “How ASIDs saved Meltdown’s performance”. */
const scene: SceneDef = {
  height: 420,
  bands: {
    overview: [0, 412],
    asid: [0, 412],
    shared: [46, 412],
    meltdown: [0, 412],
    kpti: [46, 412],
    flush: [0, 290],
    tag: [46, 418],
    asids: [0, 290],
    invalidate: [46, 290],
    immune: [46, 412],
    vm: [0, 290],
    arm: [124, 290],
  },
  parts: {
    procA: [8, 46],
    procB: [8, 46],
    kernel: [64, 98],
    cross: [42, 70],
    hyp: [98, 120],
    cpu: [122, 288],
    cr3: [140, 176],
    tlb: [182, 280],
    slots: [184, 276],
    mask: [184, 276],
    tables: [296, 404],
    ucopy: [296, 404],
  },
  states: {
    overview: {
      title: { en: 'A CPU, its TLB, a page table', zh: 'CPU、TLB 与页表' },
      caption: {
        en: 'A process runs in user mode and enters the kernel on every system call or interrupt. CR3 points at its page table, and the TLB caches the translations it has used. PCID is a tag on those TLB entries.',
        zh: '进程在用户态运行，每次系统调用或中断都会进入内核。CR3 指向它的页表，TLB 缓存它用过的转换。PCID 就是打在这些 TLB 项上的一个标签。',
      },
    },
    asid: {
      title: { en: 'Tags instead of flushes', zh: '用标签代替清空' },
      caption: {
        en: 'Without tags, a switch from A to B must flush the TLB, because A’s translations are wrong for B. With an address-space identifier in each entry, A’s and B’s translations sit in the TLB together, and only those whose tag matches are used.',
        zh: '没有标签时，从 A 切换到 B 必须清空 TLB，因为 A 的转换对 B 是错的。每个表项带上地址空间标识符后，A 和 B 的转换可以同时待在 TLB 里，只有标签匹配的才会被使用。',
      },
    },
    shared: {
      title: { en: 'The kernel in every process', zh: '每个进程里都有内核' },
      caption: {
        en: 'Until 2018 the kernel was mapped into the upper half of every process’s page table, marked supervisor-only. A system call only changed the privilege level, and the kernel’s TLB entries, marked global, survived even a CR3 reload.',
        zh: '2018 年以前，内核被映射在每个进程页表的上半部分，标记为仅限特权态访问。系统调用只改变特权级；内核的 TLB 项标记为全局，连重新加载 CR3 都能存活。',
      },
    },
    meltdown: {
      title: { en: 'Meltdown outruns the check', zh: 'Meltdown 抢在检查之前' },
      caption: {
        en: 'On many Intel processors, a user program’s load from a kernel address ran speculatively and passed its value on before the permission fault arrived. The fault discarded the registers but not the trace in the cache. The kernel leaked because it was mapped at all.',
        zh: '在许多 Intel 处理器上，用户程序对内核地址的加载会被推测执行，在权限异常到来之前就把值传了下去。异常丢弃了寄存器，却抹不掉缓存里的痕迹。内核之所以泄漏，是因为它根本就被映射着。',
      },
    },
    kpti: {
      title: { en: 'Two tables per process', zh: '每个进程两张页表' },
      caption: {
        en: 'KPTI keeps the kernel out of the user copy, apart from the entry and exit code, the interrupt descriptor table and a per-CPU area. Every entry into the kernel loads CR3 with the kernel copy, and every return loads the user copy.',
        zh: 'KPTI 把内核从用户副本里拿掉，只留下入口与出口代码、中断描述符表和一块每 CPU 区域。每次进入内核都把内核副本装进 CR3，每次返回都装回用户副本。',
      },
    },
    flush: {
      title: { en: 'A flush on every crossing', zh: '每次穿越都清空' },
      caption: {
        en: 'Without PCID, every CR3 write flushes the whole TLB, and KPTI turns the global bit off for kernel mappings not in both tables. A system call flushes on the way in and again on the way out: 50,000 calls a second per CPU means 100,000 flushes, and the misses after each.',
        zh: '没有 PCID 时，每次写 CR3 都清空整个 TLB，而 KPTI 又对不在两张表里的内核映射关掉了全局位。一次系统调用，进去清一次，出来再清一次：每 CPU 每秒 5 万次调用，就是 10 万次清空，外加每次之后的未命中。',
      },
    },
    tag: {
      title: { en: 'Tagging the two halves', zh: '给两半各打标签' },
      caption: {
        en: 'With PCID on, the low 12 bits of CR3 are a tag and bit 63 says “don’t flush”. KPTI gives each address space a kernel PCID and a user PCID 2048 higher (bit 11), and bit 12 picks the user half of an 8 KiB table pair. A crossing flips bits 11 and 12; both halves’ entries stay in the TLB.',
        zh: '启用 PCID 后，CR3 的低 12 位是标签，第 63 位表示“不清空”。KPTI 给每个地址空间一个内核 PCID 和一个大 2048 的用户 PCID（第 11 位），第 12 位则在 8 KiB 的页表对里选中用户那一半。穿越边界就是翻转第 11、12 位，两边的表项都留在 TLB 里。',
      },
      demo: {
        label: { en: 'CR3 on the way out', zh: '返回用户态时的 CR3' },
        steps: [
          {
            en: 'The kernel is about to return to the program. SWITCH_TO_USER_CR3 starts by reading CR3: the kernel copy’s address (bit 12 clear) and the kernel PCID, here 1.',
            zh: '内核正要返回用户程序。SWITCH_TO_USER_CR3 先读出 CR3：内核副本的地址（第 12 位为 0），以及内核 PCID，这里是 1。',
          },
          {
            en: 'It keeps only the low 11 bits. That number, 1, is the kernel-side PCID, which the code calls the ASID.',
            zh: '它只保留低 11 位。得到的数 1 就是内核侧的 PCID，代码里叫它 ASID。',
          },
          {
            en: 'It tests bit 1 of this CPU’s user_pcid_flush_mask. The kernel sets that bit when it changed this address space’s user mappings without flushing the user entries. Here it is clear: the user entries are still good.',
            zh: '它检查这个 CPU 的 user_pcid_flush_mask 的第 1 位。内核改了这个地址空间的用户映射、却还没清掉用户侧表项时，会置上这一位。这里它是 0：用户侧的表项仍然有效。',
          },
          {
            en: 'So it sets bit 63, the no-flush bit: loading CR3 will keep the TLB. Had the mask bit been set, it would clear it and leave bit 63 clear, so the user PCID’s entries are flushed on the way out.',
            zh: '于是它置上第 63 位，即不清空位：加载 CR3 时保留 TLB。假如掩码那一位是 1，它会清掉这一位、让第 63 位保持为 0，于是用户 PCID 的表项在出门时被清空。',
          },
          {
            en: 'It sets bit 11: PCID 1 becomes 2049, the user PCID.',
            zh: '它置上第 11 位：PCID 从 1 变成 2049，也就是用户 PCID。',
          },
          {
            en: 'It sets bit 12, so the address points at the user copy, the second 4 KiB of the 8 KiB pair, and writes CR3. The TLB still holds the kernel’s entries under PCID 1 and the program’s under 2049. Nothing was flushed.',
            zh: '它置上第 12 位，地址于是指向用户副本，即 8 KiB 页表对的后 4 KiB，然后写入 CR3。TLB 里仍然留着 PCID 1 下的内核表项和 2049 下的程序表项，什么都没清空。',
          },
        ],
      },
    },
    asids: {
      title: { en: 'Six slots per CPU', zh: '每个 CPU 六个槽位' },
      caption: {
        en: 'Linux gives no process a permanent tag. Each CPU keeps six recently used address spaces. Switching back to one reuses its slot, flushing only if its page tables changed meanwhile; a new one takes the next slot round-robin. The kernel PCID is the slot number plus one, and the user PCID adds 2048.',
        zh: 'Linux 不给任何进程永久标签。每个 CPU 记着六个最近用过的地址空间：切回其中一个就沿用它的槽位，只在它的页表此间改过时才清空；新来的按轮转取下一个槽位。内核 PCID 是槽位号加一，用户 PCID 再加 2048。',
      },
    },
    invalidate: {
      title: { en: 'Flushing what you can’t see', zh: '清掉看不见的表项' },
      caption: {
        en: 'In the kernel the current PCID is the kernel’s, and an ordinary invlpg is guaranteed to reach only that one. To drop a stale user entry, Linux uses INVPCID, or sets the address space’s bit in user_pcid_flush_mask so that the return to user space does a flushing CR3 write.',
        zh: '在内核里，当前 PCID 是内核的，普通的 invlpg 只保证作用于它。要丢掉一条过时的用户表项，Linux 用 INVPCID；或者在 user_pcid_flush_mask 里置上这个地址空间的位，让返回用户态时那次写 CR3 顺带清空。',
      },
    },
    immune: {
      title: { en: 'Where KPTI is off', zh: '不需要 KPTI 的地方' },
      caption: {
        en: 'On processors not affected by Meltdown, AMD’s among them and Intel parts that report RDCL_NO, Linux leaves KPTI off by default: one table per process, the kernel mapped and global, no CR3 switch on a system call.',
        zh: '在不受 Meltdown 影响的处理器上（包括 AMD 的各家族，以及声明了 RDCL_NO 的 Intel 处理器），Linux 默认不开 KPTI：每个进程一张页表，内核照旧映射且为全局，系统调用不切换 CR3。',
      },
    },
    vm: {
      title: { en: 'A guest without the flag', zh: '没有标志的客户机' },
      caption: {
        en: 'A virtual machine sees only the CPU features its hypervisor exposes. A guest that is not shown pcid runs KPTI without it and flushes the TLB on every kernel crossing, on hardware that could have avoided it.',
        zh: '虚拟机只看得到虚拟机监控程序暴露给它的 CPU 特性。看不到 pcid 的客户机只能在没有它的情况下运行 KPTI，每次穿越内核都清空 TLB，而底下的硬件本可以避免这一切。',
      },
    },
    arm: {
      title: { en: 'ARM’s pair of ASIDs', zh: 'ARM 的一对 ASID' },
      caption: {
        en: 'arm64 has always tagged TLB entries with ASIDs. Its version of the mitigation gives each address space two ASIDs that differ only in the lowest bit, bit 48 of the translation table base register, and makes the kernel’s mappings non-global.',
        zh: 'arm64 的 TLB 项一直带着 ASID。它的缓解方案给每个地址空间一对只在最低位上不同的 ASID（转换表基址寄存器的第 48 位），并把内核映射改成非全局。',
      },
    },
  },
  terms: {
    pcid: ['cr3', 'tlb'],
    cr3: ['cr3'],
    spectre: ['kernel', 'tables'],
    'page-walk': ['tables'],
    idt: ['ucopy'],
    'per-cpu': ['ucopy'],
    'tlb-shootdown': ['tlb'],
    invlpg: ['tlb'],
    hypervisor: ['hyp'],
    'exception-level': ['procA', 'kernel'],
  },
}

export default scene
