import type { SceneDef } from './index'

/** The running figure of “Because addresses are virtual, they can lie randomly”. */
const scene: SceneDef = {
  height: 430,
  bands: {
    overview: [8, 426],
    why: [60, 240],
    guess: [66, 250],
    regions: [8, 410],
    virtual: [8, 426],
    entropy: [76, 298],
    pie: [270, 410],
    kaslr: [8, 149],
    kpti: [8, 128],
    leak: [149, 329],
    fork: [8, 410],
    hardware: [140, 310],
    debug: [60, 410],
    replace: [66, 256],
  },
  parts: {
    kernel: [34, 62],
    stack: [76, 122],
    vdso: [116, 150],
    libs: [150, 246],
    heap: [280, 326],
    prog: [328, 384],
    phys: [30, 404],
    links: [30, 404],
    tlbbox: [168, 232],
    zoom: [150, 300],
  },
  states: {
    overview: {
      title: { en: 'The same program, twice', zh: '同一个程序，运行两次' },
      caption: {
        en: 'The kernel places the stack, libraries, heap and program code at different virtual addresses each time a program starts. Each run still sees one consistent address space, and physical memory neither knows nor cares.',
        zh: '程序每次启动，内核都把栈、共享库、堆和程序代码放到不同的虚拟地址上。每次运行内部看到的仍是一个自洽的地址空间，物理内存对此一无所知，也毫不在意。',
      },
    },
    why: {
      title: { en: 'A known address', zh: '人人知道的地址' },
      caption: {
        en: 'Overwriting a pointer only helps someone who knows what to write into it. In the early 2000s that was easy: on a given Linux distribution the C library loaded at the same address in every process on every machine.',
        zh: '覆盖一个指针，只有在知道该写入什么时才有用。在 2000 年代初这很容易：同一个 Linux 发行版上，C 库在每台机器的每个进程里都加载到同一个地址。',
      },
    },
    guess: {
      title: { en: 'A wrong guess', zh: '猜错了' },
      caption: {
        en: 'ASLR leaves the bug in place and removes the knowledge. The overwrite still happens, but an address that was right in one run leads nowhere in another, and a wrong guess usually crashes the process instead of handing it over.',
        zh: 'ASLR 不动错误本身，而是拿走了那条信息。覆盖照样发生，但在这次运行里正确的地址，换一次运行就无处可去；猜错了，进程通常直接崩溃，而不是被接管。',
      },
    },
    regions: {
      title: { en: 'What moves', zh: '哪些东西会移动' },
      caption: {
        en: 'ASLR is a decision made region by region. On Linux the sysctl kernel.randomize_va_space selects it: 0 is off, 1 randomizes the stack, vDSO and mmap base, and 2, the usual default, adds the start of the heap.',
        zh: 'ASLR 是逐个区域做出的决定。在 Linux 上由 sysctl 参数 kernel.randomize_va_space 选择：0 关闭；1 随机化栈、vDSO 和 mmap 基址；2（通常的默认值）再加上堆的起点。',
      },
    },
    virtual: {
      title: { en: 'Why it can move at all', zh: '为什么能移动' },
      caption: {
        en: 'Every address a program sees is virtual. The page table maps whatever virtual address the kernel picked to whatever physical frames are free. Only some of run 2’s mappings are drawn.',
        zh: '程序看到的每个地址都是虚拟的。页表把内核选定的任意虚拟地址，映射到恰好空闲的物理页帧上。图中只画了第 2 次运行的部分映射。',
      },
    },
    entropy: {
      title: { en: 'How much randomness?', zh: '到底有多少随机性？' },
      caption: {
        en: 'On x86-64 the mmap base moves by a random number of pages, 28 bits by default: 1 TiB of possible placements. Much of ASLR’s reputation as a weak defence comes from 32-bit systems, which had far fewer bits to randomize.',
        zh: '在 x86-64 上，mmap 基址被平移随机数量的页，默认 28 位，也就是 1 TiB 的可能放置范围。ASLR “是个弱防御”的名声，很大程度上来自可用随机位少得多的 32 位系统。',
      },
    },
    pie: {
      title: { en: 'The piece that was missing', zh: '缺失的那一块' },
      caption: {
        en: 'For years the program itself stayed put, however well everything else was shuffled, because executables were built for one fixed address. Position-independent executables refer to everything relative to a base, so they can move too.',
        zh: '很多年里，不管其他部分洗得多乱，程序本身都留在原地，因为可执行文件是为一个固定地址构建的。位置无关可执行文件引用一切都相对于某个基址，于是也能移动了。',
      },
    },
    kaslr: {
      title: { en: 'The kernel hides too', zh: '内核也会躲' },
      caption: {
        en: 'KASLR chooses a random offset for the kernel image at boot, so both runs here see it in the same place; only the next boot moves it. It has less room to hide in than a process, and it is mapped into every address space.',
        zh: 'KASLR 在启动时为内核映像选一个随机偏移，所以这两次运行看到的内核在同一个位置，要到下次启动才会变。内核能藏身的地方比进程少，而且它映射在每个地址空间里。',
      },
    },
    kpti: {
      title: { en: 'Nothing mapped, nothing to time', zh: '不映射，就没什么可测' },
      caption: {
        en: 'User code cannot read a kernel page, but it can time how an access to one fails. KAISER took almost all kernel mappings out of the page tables used in user mode, leaving a little entry and exit code; merged as KPTI, it also became the fix for Meltdown.',
        zh: '用户代码读不了内核页，却能测量访问失败要花多久。KAISER 把几乎所有内核映射移出用户态使用的页表，只留下一小段入口和出口代码；它以 KPTI 之名合入后，也成了 Meltdown 的修补。',
      },
    },
    leak: {
      title: { en: 'A region moves as a unit', zh: '区域整体移动' },
      caption: {
        en: 'Randomization picks one base per region, and inside the region every distance is fixed. So the secret is only a handful of bases, and that is why defenders treat a leak of even one address as a serious vulnerability.',
        zh: '随机化只为每个区域挑一个基址，区域内部的距离都是固定的。所以秘密不过是寥寥几个基址，这也是防御者把哪怕只泄露一个地址也当作严重漏洞的原因。',
      },
    },
    fork: {
      title: { en: 'Copies share a layout', zh: '副本共享布局' },
      caption: {
        en: 'Randomization happens when exec builds a new address space. fork() copies the address space, layout included, so a server that forks per connection gives every child the same “random” layout. Randomness is renewed only when something re-randomizes it.',
        zh: '随机化发生在 exec 构建新地址空间的时候。fork() 连布局一起复制地址空间，所以为每个连接 fork 的服务器，交给每个子进程的都是同一份“随机”布局。随机性只有在有人重新随机化时才会刷新。',
      },
    },
    hardware: {
      title: { en: 'The hardware remembers', zh: '硬件有记忆' },
      caption: {
        en: 'Every access goes through translation, and translation uses shared caches whose timing can be observed. The authors of ASLR on the Line concluded that ASLR should not be trusted as a first line of defence against memory errors.',
        zh: '每次访问都要经过地址翻译，而翻译要用到时序可被观察的共享缓存。《ASLR on the Line》的作者得出结论：不应再把 ASLR 当作对抗内存错误的第一道防线。',
      },
    },
    debug: {
      title: { en: 'Debuggers turn it off', zh: '调试器会关掉它' },
      caption: {
        en: 'Under gdb, randomization is off by default, so both runs get the same layout and breakpoints stay meaningful between them. If addresses in a debugging session look suspiciously stable, that is why.',
        zh: '在 gdb 下，随机化默认是关闭的，两次运行的布局相同，断点才有意义。如果调试时地址稳定得可疑，原因就在这里。',
      },
    },
    replace: {
      title: { en: 'From hiding to checking', zh: '从“藏”到“查”' },
      caption: {
        en: 'ASLR is nearly free and turns many bugs into crashes. But randomization only hides where things are; the newer mechanisms check what a pointer may do. A stack canary, the stripe on each stack here, is randomness verified at use.',
        zh: 'ASLR 几乎零开销，还把许多错误变成了崩溃。但随机化藏的只是东西在哪里；更新的机制检查的是指针能做什么。图中每个栈上的那道条纹是栈金丝雀，也就是在使用时验证的随机性。',
      },
    },
  },
  terms: {
    'shared-library': ['libs'],
    'return-address': ['stack'],
    libc: ['libs'],
    mmap: ['libs'],
    malloc: ['heap', 'libs'],
    brk: ['heap'],
    pie: ['prog'],
    vdso: ['vdso'],
    kaslr: ['kernel'],
    'page-table': ['links'],
    'page-frame': ['phys'],
    page: ['phys'],
    tlb: ['tlbbox'],
    'page-walk': ['tlbbox'],
    kpti: ['kernel'],
    spectre: ['kernel'],
    'cpu-cache': ['tlbbox'],
    'stack-canary': ['stack'],
  },
}

export default scene
