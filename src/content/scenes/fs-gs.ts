import type { SceneDef } from './index'

/** The running figure of “Where segments survive on x86-64”. */
const scene: SceneDef = {
  height: 416,
  bands: {
    overview: [4, 412],
    segments: [4, 330],
    descriptors: [4, 410],
    flat: [4, 232],
    tls: [124, 412],
    settls: [124, 412],
    percpu: [4, 330],
    swapgs: [4, 340],
    sign: [4, 412],
    spectre: [152, 398],
    fsgsbase: [124, 412],
    danger: [4, 360],
    fix59: [4, 360],
    fred: [4, 360],
  },
  parts: {
    cpu: [8, 228],
    fs: [128, 152],
    gs: [152, 176],
    msr: [184, 224],
    percpu: [28, 142],
    tls1: [228, 312],
    tls2: [320, 402],
    khalf: [8, 196],
    uhalf: [204, 412],
  },
  states: {
    overview: {
      title: { en: 'Two segment registers survive', zh: '幸存的两个段寄存器' },
      caption: {
        en: 'On x86-64, FS and GS still add a base to an address. In user space FS points at each thread’s own block, where the stack canary sits at %fs:0x28; in the kernel GS points at each CPU’s own data, so inc gs:[x] updates this CPU’s copy of x in one instruction.',
        zh: '在 x86-64 上，FS 和 GS 仍会给地址加上一个基址。用户空间里，FS 指向每个线程自己的那块区域，栈金丝雀就在 %fs:0x28；内核里，GS 指向每个 CPU 自己的数据，一条 inc gs:[x] 就更新了本 CPU 的那一份 x。',
      },
    },
    segments: {
      title: { en: 'Implicit, with an override', zh: '隐式选择，外加超越前缀' },
      caption: {
        en: 'x86 picks the segment from how an address is formed: instruction fetches use CS, stack accesses SS, most data accesses DS. A prefix byte on an instruction names another register instead: ES, FS or GS. FS and GS arrived with the 80386 and had no fixed role.',
        zh: 'x86 根据地址是怎么形成的来选择段：取指令用 CS，栈访问用 SS，大多数数据访问用 DS。指令前的一个前缀字节可以改用另一个段寄存器：ES、FS 或 GS。FS 和 GS 是 80386 才加入的，没有固定用途。',
      },
    },
    descriptors: {
      title: { en: 'Selectors and descriptors', zh: '选择子与描述符' },
      caption: {
        en: 'From the 80286 on, a segment register holds a selector: an index into a descriptor table whose entry holds the segment’s base, limit and protection bits, much like chapter 16’s segment table.',
        zh: '从 80286 起，段寄存器里装的是选择子：描述符表的下标，表项里存着段的基址、界限和保护位，很像第 16 章的段表。',
      },
    },
    flat: {
      title: { en: 'Flat, except FS and GS', zh: '全平坦，FS 和 GS 除外' },
      caption: {
        en: 'In 64-bit mode the CPU ignores the bases of CS, SS, DS and ES, which are always 0, and checks no limits, so paging does all the real work. FS and GS keep a base, now a full 64-bit address, and still have no limit.',
        zh: '在 64 位模式下，CPU 忽略 CS、SS、DS、ES 的基址（总是 0），也不检查界限，真正干活的全是分页。FS 和 GS 保留了基址，而且是完整的 64 位地址，但依然没有界限。',
      },
    },
    tls: {
      title: { en: 'FS: one block per thread', zh: 'FS：每个线程一块' },
      caption: {
        en: 'glibc points FS at the running thread’s control block. A thread-local variable is a fixed offset from it, and the canary sits at %fs:0x28, so the same instruction reaches a different copy in each thread.',
        zh: 'glibc 让 FS 指向当前线程的控制块。线程局部变量就是相对它的一个固定偏移，金丝雀在 %fs:0x28，于是同一条指令在每个线程里访问到的是不同的副本。',
      },
    },
    settls: {
      title: { en: 'Switching threads switches FS', zh: '切换线程就切换 FS' },
      caption: {
        en: 'Writing a segment base is privileged by default, so the kernel sets FS: through clone() with CLONE_SETTLS when a thread is created, or arch_prctl(ARCH_SET_FS). On every context switch it saves each thread’s FS base and restores the next one’s.',
        zh: '默认情况下写段基址是特权操作，所以由内核来设置 FS：创建线程时通过 clone() 配合 CLONE_SETTLS，或者通过 arch_prctl(ARCH_SET_FS)。每次上下文切换，内核都保存当前线程的 FS 基址，恢复下一个线程的。',
      },
    },
    percpu: {
      title: { en: 'GS: one area per CPU', zh: 'GS：每个 CPU 一块' },
      caption: {
        en: 'In the kernel, each CPU’s GS base points at that CPU’s per-CPU area. inc gs:[x] finds and updates this CPU’s copy of x in a single instruction, which cannot be interrupted halfway, so preemption need not be disabled around it.',
        zh: '在内核里，每个 CPU 的 GS 基址指向该 CPU 的每 CPU 区域。一条 inc gs:[x] 就找到并更新了本 CPU 的那份 x；一条指令不会被打断在一半，所以前后不必关抢占。',
      },
    },
    swapgs: {
      title: { en: 'Two GS bases and SWAPGS', zh: '两个 GS 基址与 SWAPGS' },
      caption: {
        en: 'On entry from user mode the user’s GS base is still loaded. SWAPGS exchanges it with the kernel’s, kept in MSR_KERNEL_GS_BASE; while the kernel runs, that MSR holds the user’s value. It is a toggle, so the entry code must swap exactly once, and only when it came from user mode.',
        zh: '从用户态进入时，装着的还是用户的 GS 基址。SWAPGS 把它和存在 MSR_KERNEL_GS_BASE 里的内核基址互换；内核运行期间，这个 MSR 里装的反而是用户的值。它是个开关，所以入口代码必须恰好交换一次，而且只在从用户态进来时交换。',
      },
      demo: {
        label: { en: 'SWAPGS on the way in and out', zh: '进出内核时的 SWAPGS' },
        steps: [
          {
            en: 'In user mode, the active GS base is the program’s own. MSR_KERNEL_GS_BASE holds the kernel’s: the address of this CPU’s per-CPU area.',
            zh: '在用户态，生效的 GS 基址是程序自己的；MSR_KERNEL_GS_BASE 里存着内核的那个：本 CPU 每 CPU 区域的地址。',
          },
          {
            en: 'A system call or interrupt arrives from user mode. The entry code looks at the code segment the CPU saved on the kernel stack: its low two bits are the privilege level, here 3, user mode.',
            zh: '一次来自用户态的系统调用或中断到来。入口代码查看 CPU 压在内核栈上的代码段：它的低两位是特权级，这里是 3，用户态。',
          },
          {
            en: 'So it executes SWAPGS and the two bases trade places. GS now points at the per-CPU area; the MSR keeps the user’s value until the way out.',
            zh: '于是它执行 SWAPGS，两个基址互换。GS 现在指向每 CPU 区域；MSR 替用户保管原来的值，直到出门。',
          },
          {
            en: 'Now gs: accesses reach this CPU’s data, including the data that tells the kernel which kernel stack to use.',
            zh: '现在 gs: 访问到的是本 CPU 的数据，包括告诉内核该用哪个内核栈的那些数据。',
          },
          {
            en: 'An interrupt arrives while the kernel is running. The saved code segment says privilege level 0, so the entry code must not swap: GS already points at the per-CPU area, and a swap would load the user’s base inside the kernel.',
            zh: '内核正在运行时来了一个中断。压栈的代码段说特权级是 0，所以入口代码绝不能交换：GS 已经指向每 CPU 区域，再换一次就会在内核里装上用户的基址。',
          },
          {
            en: 'On the way back to user mode the kernel executes SWAPGS again. The user’s GS base is active once more, and the kernel’s is back in the MSR.',
            zh: '返回用户态时，内核再执行一次 SWAPGS。用户的 GS 基址重新生效，内核的那个回到 MSR 里。',
          },
        ],
      },
    },
    sign: {
      title: { en: 'The sign test', zh: '符号检查' },
      caption: {
        en: 'An NMI can arrive at any instruction, even between an entry saving CS and executing SWAPGS, so the stack cannot be trusted. The entry code reads the GS base instead: kernel addresses live in the upper half and look negative, and a user GS base never does, as long as user space cannot set an arbitrary one.',
        zh: 'NMI 可能在任何一条指令处到来，甚至在普通入口刚压入 CS、还没执行 SWAPGS 的那一刻，所以栈不可信。入口代码改为读出 GS 基址：内核地址位于上半部，看起来是负数，用户的 GS 基址永远不是——前提是用户空间不能随意设置它。',
      },
    },
    spectre: {
      title: { en: 'A predicted decision', zh: '被预测的判断' },
      caption: {
        en: 'Whether to execute SWAPGS is a conditional branch, and branches are predicted. A trained predictor can make the CPU speculatively skip the swap, or perform it when it should not, and run GS-relative loads with the wrong base. The fix puts an LFENCE after the decision, so nothing runs speculatively until the branch is resolved.',
        zh: '要不要执行 SWAPGS 是一个条件分支，而分支是会被预测的。被训练过的预测器能让 CPU 推测性地跳过交换，或在不该交换时交换，用错误的基址执行基于 GS 的读取。修复办法是在判断之后放一条 LFENCE，分支结果确定之前什么都不推测执行。',
      },
    },
    fsgsbase: {
      title: { en: 'Four instructions', zh: '四条指令' },
      caption: {
        en: 'Reading or changing the FS base through arch_prctl() costs a system call each time. RDFSBASE, WRFSBASE, RDGSBASE and WRGSBASE do it directly from user mode, but the CPU allows them only if the kernel sets a bit in CR4.',
        zh: '通过 arch_prctl() 读或改 FS 基址，每次都要一次系统调用。RDFSBASE、WRFSBASE、RDGSBASE、WRGSBASE 可以在用户态直接完成，但只有内核在 CR4 里置上一位，CPU 才允许使用它们。',
      },
    },
    danger: {
      title: { en: 'Why Linux waited', zh: 'Linux 为什么一直等' },
      caption: {
        en: 'With WRGSBASE, user space can load any GS base, including a negative one. The NMI entry’s sign test would then decide it came from the kernel, skip SWAPGS, and run the kernel with a GS base the attacker chose.',
        zh: '有了 WRGSBASE，用户空间可以装入任何 GS 基址，包括负数。NMI 入口的符号检查会因此认定自己来自内核、跳过 SWAPGS，让内核带着攻击者选定的 GS 基址运行。',
      },
    },
    fix59: {
      title: { en: 'Linux 5.9 stops guessing', zh: 'Linux 5.9 不再靠猜' },
      caption: {
        en: 'Since Linux 5.9, with FSGSBASE enabled, the paranoid entry path reads the current GS base, saves it, loads the kernel’s own value unconditionally, and restores the saved value on exit.',
        zh: '从 Linux 5.9 起，启用 FSGSBASE 时，偏执入口路径读出当前的 GS 基址并保存起来，无条件装入内核自己的值，退出时再恢复保存的值。',
      },
    },
    fred: {
      title: { en: 'The hardware swaps', zh: '由硬件来交换' },
      caption: {
        en: 'With FRED, an event from ring 3 swaps the GS base with IA32_KERNEL_GS_BASE as part of its delivery, and the return to user mode swaps it back. SWAPGS itself raises #UD. There is no branch left to mispredict.',
        zh: '有了 FRED，来自 ring 3 的事件在投递时就把 GS 基址与 IA32_KERNEL_GS_BASE 互换，返回用户态时再换回来。SWAPGS 本身则会触发 #UD。不再有可以预测错的分支。',
      },
    },
  },
  terms: {
    'per-cpu': ['percpu', 'gs'],
    tls: ['tls1', 'tls2', 'fs'],
    thread: ['tls1', 'tls2'],
    msr: ['msr'],
  },
}

export default scene
