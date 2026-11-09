import type { SceneDef } from './index'

/** The running figure of “Base and bounds never really died”. */
const scene: SceneDef = {
  height: 296,
  bands: {
    overview: [4, 292],
    mmu: [4, 270],
    inside: [130, 216],
    sfi: [4, 216],
    nacl32: [68, 292],
    nacl64: [68, 292],
    wasm: [4, 292],
    guard: [68, 292],
    memory64: [68, 292],
    ebpf: [4, 292],
    mpx: [68, 292],
    cheri: [68, 292],
    table: [122, 292],
  },
  parts: {
    code: [8, 50],
    check: [68, 112],
    trap: [68, 112],
    region: [144, 210],
    lives: [218, 268],
  },
  states: {
    overview: {
      title: { en: 'One region, one comparison', zh: '一块区域，一次比较' },
      caption: {
        en: 'A WebAssembly load compares its address with the length of the module’s memory and traps if the access would run past the end. It is chapter 15’s bounds check, written into a web standard.',
        zh: 'WebAssembly 的读指令拿地址和模块内存的长度比较，访问一旦越过末尾就陷入。这就是第 15 章的界限检查，被写进了一项 Web 标准。',
      },
    },
    mmu: {
      title: { en: 'The book’s MMU', zh: '书里的 MMU' },
      caption: {
        en: 'Two registers per CPU. On every reference the hardware compares the virtual address with bounds, raising an exception if it is not below them, and adds base. Changing base moves the process, and the process cannot tell.',
        zh: '每个 CPU 两个寄存器。每次访存，硬件先拿虚拟地址和界限比较，不小于界限就抛出异常，否则加上基址。改一下基址就能搬动进程，而进程毫无察觉。',
      },
    },
    inside: {
      title: { en: 'A fence inside paging', zh: '分页之内的一道篱笆' },
      caption: {
        en: 'One region is too little to describe a whole address space. As a fence around one region inside an address space that paging already manages, it is enough, and the region can be as large as you like: paging decides which pages are backed by memory.',
        zh: '用一块区域描述整个地址空间，它不够用；但若只是在已由分页管理的地址空间里圈出一块，它就够了，而且区域想多大都行：哪些页真正有内存撑着，由分页决定。',
      },
    },
    sfi: {
      title: { en: 'Software draws the fence', zh: '软件来画这道篱笆' },
      caption: {
        en: 'Software fault isolation has the compiler rewrite every store and jump so that the address is forced into the sandbox’s region, for example by masking off its top bits. Untrusted code then shares the host’s address space, with no system call or context switch at the boundary.',
        zh: '软件故障隔离让编译器改写每一条存储和跳转指令，把地址强行压进沙箱的区域，比如屏蔽掉高位。这样，不受信任的代码就能和宿主共用一个地址空间，跨越边界时既不需要系统调用，也不需要上下文切换。',
      },
    },
    nacl32: {
      title: { en: 'Real segments on x86-32', zh: 'x86-32 上真正的段' },
      caption: {
        en: 'Native Client on 32-bit x86 needed no masking. It set up segments that covered only the sandbox, and the hardware checked every access against the segment limit.',
        zh: '32 位 x86 上的 Native Client 根本不需要屏蔽地址：它设置好只覆盖沙箱的段，由硬件拿每次访问去对照段界限。',
      },
    },
    nacl64: {
      title: { en: 'Guards instead of limits', zh: '用保护区代替段界限' },
      caption: {
        en: 'x86-64 ignores segment limits. NaCl’s 64-bit sandbox is an aligned 4 GB region whose base is kept in the reserved register r15; every address is r15 plus a 32-bit offset, and 40 GB of unmapped address space on each side catches anything that slips past.',
        zh: 'x86-64 忽略段界限。NaCl 的 64 位沙箱是一块按 4 GB 对齐的区域，基址存在保留寄存器 r15 里；每个地址都是 r15 加一个 32 位偏移，两侧各 40 GB 未映射的地址空间接住任何溜出去的访问。',
      },
    },
    wasm: {
      title: { en: 'Linear memory', zh: '线性内存' },
      caption: {
        en: 'A WebAssembly module’s memory is one contiguous, resizable array of bytes. The engine decides where it lives in the host’s address space (the base) and tracks its current size (the bounds). With an explicit check, every access compares against the size and branches to a trap.',
        zh: 'WebAssembly 模块的内存是一个连续、可增长的字节数组。引擎决定它放在宿主地址空间的哪里（基址），并记录它的当前大小（界限）。用显式检查时，每次访问都和大小比较，越界就跳去陷入。',
      },
    },
    guard: {
      title: { en: 'The page table as bounds', zh: '页表充当界限寄存器' },
      caption: {
        en: 'Wasmtime reserves 4 GiB of address space for a 32-bit memory and adds a 32 MiB guard; only the first size bytes are accessible. An out-of-range access needs no compare: it lands on an inaccessible page, and the engine turns the page fault into a trap. Not to scale.',
        zh: 'Wasmtime 为一块 32 位内存预留 4 GiB 地址空间，再加 32 MiB 保护区；只有前 size 个字节可以访问。越界访问不需要比较：它落在不可访问的页上，引擎把页错误变成一次陷入。图未按比例。',
      },
      demo: {
        label: { en: 'How a guard region traps', zh: '保护区怎么触发陷入' },
        steps: [
          {
            en: 'The engine reserves 4 GiB of address space for the memory, plus a 32 MiB guard after it. Reserving costs address space, not memory: nothing in it is accessible yet.',
            zh: '引擎为这块内存预留 4 GiB 地址空间，后面再加 32 MiB 保护区。预留占的是地址空间，不是内存：此时里面还没有任何地方可以访问。',
          },
          {
            en: 'Only the memory’s current size, at the start of the reservation, is made accessible. The rest of the 4 GiB and the guard stay inaccessible in the page table.',
            zh: '只有预留区开头、等于内存当前大小的那一段被设为可访问。4 GiB 里其余的部分和保护区，在页表里仍是不可访问的。',
          },
          {
            en: 'An access inside the memory is one plain instruction, base + i + 16: no compare, no branch. The page table allows it.',
            zh: '内存范围内的访问就是一条普通指令，base + i + 16：没有比较，没有分支。页表放行。',
          },
          {
            en: 'An index past the size still lands inside the reservation, because i is below 2³² and the offset below the guard’s size. It hits an inaccessible page, and the CPU raises a page fault.',
            zh: '超出大小的下标仍然落在预留区之内，因为 i 小于 2³²，偏移又小于保护区的大小。它碰到一个不可访问的页，CPU 引发页错误。',
          },
          {
            en: 'The kernel delivers a signal to the engine. Its handler sees that the faulting instruction is in WebAssembly code and turns the fault into a WebAssembly trap.',
            zh: '内核把一个信号递送给引擎。引擎的信号处理程序发现出错的指令位于 WebAssembly 代码里，就把这个错误变成一次 WebAssembly 陷入。',
          },
          {
            en: 'Growing the memory only changes page protections inside the reservation. The base does not move, so nothing has to be relocated.',
            zh: '增长内存只是修改预留区内部的页保护。基址不动，所以什么都不用搬。',
          },
        ],
      },
    },
    memory64: {
      title: { en: 'Back to compare and branch', zh: '回到比较加分支' },
      caption: {
        en: 'With 64-bit addresses no reservation can cover the range, so Wasmtime always checks 64-bit memories explicitly: a compare and a branch on every access, which a compiler can sometimes hoist out of a loop. On the web a 64-bit memory is capped at 16 GB.',
        zh: '用 64 位地址时，没有哪块预留区能覆盖整个范围，所以 Wasmtime 对 64 位内存总是做显式检查：每次访问一次比较、一个分支，编译器有时能把它提到循环外面。在 Web 上，64 位内存的上限是 16 GB。',
      },
    },
    ebpf: {
      title: { en: 'Bounds proved in advance', zh: '运行之前就证明界限' },
      caption: {
        en: 'eBPF programs run in the kernel’s own address space, with no sandbox region. Before loading, the verifier tracks what each register may hold: once the program has compared r3 + 14 with data_end, 14 bytes from r3 are known safe, so a 2-byte load at offset 12 is accepted and one at offset 14 rejected.',
        zh: 'eBPF 程序在内核自己的地址空间里运行，没有沙箱区域。加载之前，校验器追踪每个寄存器可能取的值：程序把 r3 + 14 和 data_end 比较过之后，r3 起的 14 个字节就被认定安全，于是偏移 12 处的 2 字节读被接受，偏移 14 处的被拒绝。',
      },
    },
    mpx: {
      title: { en: 'A bound per pointer: MPX', zh: '每个指针一个界限：MPX' },
      caption: {
        en: 'C bugs overflow one object into its neighbour inside the same region. Intel MPX gave each pointer its own bounds: four bounds registers, and for pointers stored in memory, bounds tables found through a bounds directory. Pointer and bounds were written by separate instructions, one of the reasons it failed.',
        zh: 'C 的漏洞是在同一块区域里从一个对象溢出到邻居。Intel MPX 给每个指针各自的界限：四个界限寄存器；存在内存里的指针，其界限放进界限表，经由界限目录找到。指针和界限由不同的指令写入，这是它失败的原因之一。',
      },
    },
    cheri: {
      title: { en: 'Bounds inside the pointer', zh: '界限装进指针里' },
      caption: {
        en: 'A CHERI capability is 128 bits: an address with compressed bounds, permissions and an object type, plus a tag bit kept out of band. malloc narrows the heap’s capability to one object and nothing can widen it again; overwriting a capability with ordinary data clears its tag, so a pointer cannot be forged.',
        zh: 'CHERI 的能力有 128 位：一个地址，加上压缩过的界限、权限和对象类型，另有一个存在带外的标签位。malloc 把整个堆的能力收窄到一个对象，谁也没法再把它放宽；用普通数据覆盖能力会清掉标签，所以指针无法伪造。',
      },
    },
    table: {
      title: { en: 'Coarse or fine', zh: '粗粒度还是细粒度' },
      caption: {
        en: 'The coarser the boundary, the cheaper it is to check, down to the guard region’s zero instructions. The finer it is, the more bugs it catches and the more it costs, until CHERI moves the bound into every pointer and pays with wider pointers and new hardware.',
        zh: '边界越粗，检查越便宜，一直便宜到保护区的零条指令；边界越细，能抓的漏洞越多，代价也越高，直到 CHERI 把界限搬进每个指针，用更宽的指针和新的硬件来买单。',
      },
    },
  },
  terms: {
    sandbox: ['region'],
    'wasm-trap': ['trap'],
  },
}

export default scene
