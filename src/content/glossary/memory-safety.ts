import type { Term } from './index'

/** Terms of the memory-safety article (“Seventy percent”). */
const terms: Record<string, Term> = {
  'memory-safety': {
    title: { en: 'Memory-safety bug', zh: '内存安全漏洞' },
    body: {
      en: 'A program reading or writing memory it should not: outside the object it means to use (a spatial error, such as a buffer overflow), after the object was freed (a temporal error, such as a [[use-after-free|use-after-free]]), or before anything was written to it. C and C++ leave avoiding them to the programmer.',
      zh: '程序读写了不该读写的内存：越出它本想访问的对象（空间错误，比如缓冲区溢出），在对象被释放之后（时间错误，比如[[use-after-free|释放后使用]]），或者在任何内容写入之前。C 和 C++ 把避免这些错误的责任交给了程序员。',
    },
    chapter: 'vm-api',
    note: 'memory-safety',
  },
  'use-after-free': {
    title: { en: 'Use-after-free', zh: '释放后使用（use-after-free）' },
    body: {
      en: 'Using memory through a pointer after the block it points to has been freed: chapter 14’s dangling pointer, put to use. The allocator may already have handed that memory to another object, so the read or write lands on someone else’s data.',
      zh: '在指针所指的内存块被释放之后，仍通过它去访问：也就是第 14 章的悬挂指针被真正用上了。分配器可能已经把那块内存交给了另一个对象，于是这次读写落在了别人的数据上。',
    },
    chapter: 'vm-api',
    note: 'memory-safety',
  },
  cve: {
    title: { en: 'CVE', zh: 'CVE' },
    body: {
      en: 'Common Vulnerabilities and Exposures: a public catalogue that gives each disclosed security vulnerability an identifier such as CVE-2019-1125, so that vendors, researchers and users can refer to the same bug.',
      zh: 'Common Vulnerabilities and Exposures（通用漏洞披露）：一份公开目录，给每个公开的安全漏洞一个编号，比如 CVE-2019-1125，让厂商、研究者和用户说的是同一个漏洞。',
    },
  },
  exploit: {
    title: { en: 'Exploit', zh: '漏洞利用（exploit）' },
    body: {
      en: 'Input or code that uses a bug to make a program do what its authors never intended, such as run code an attacker chose or reveal data it should keep. Exploiting a bug means turning it into such an attack; many bugs are hard or impossible to exploit.',
      zh: '借助一个漏洞，让程序做出作者从未打算让它做的事的输入或代码，比如运行攻击者选定的代码，或泄露本该保密的数据。“利用”一个漏洞，就是把它变成这样的攻击；许多漏洞很难利用，甚至无法利用。',
    },
  },
  vtable: {
    title: { en: 'vtable (virtual method table)', zh: '虚表（vtable）' },
    body: {
      en: 'The table of function pointers C++ uses to call an object’s virtual methods. Every object of such a class carries a hidden pointer to its class’s table, so whoever overwrites that pointer decides which code the next method call runs.',
      zh: 'C++ 用来调用对象虚函数的函数指针表。这类类的每个对象都带着一个指向本类虚表的隐藏指针，所以谁改写了这个指针，谁就决定了下一次方法调用会运行哪段代码。',
    },
  },
  tcache: {
    title: { en: 'tcache (glibc)', zh: 'tcache（glibc）' },
    body: {
      en: '[[glibc|glibc]]’s per-thread cache of freed heap chunks: for each size class, a last-in, first-out list, so the next `malloc` of a size usually gets back the chunk of that size that was freed last. A *size class* is a range of request sizes the allocator treats as one.',
      zh: '[[glibc|glibc]] 为每个线程维护的已释放堆块缓存：每个大小类一条后进先出链表，所以下一次同样大小的 `malloc` 通常拿回的就是最后释放的那块。*大小类*是分配器当作同一种大小来对待的一段请求大小。',
    },
    note: 'allocators',
  },
  glibc: {
    title: { en: 'glibc', zh: 'glibc' },
    body: {
      en: 'The GNU C library, the standard C library on most Linux systems. It provides `malloc` and `free`, the functions that make [[syscall|system calls]] on a program’s behalf, thread support and much more.',
      zh: 'GNU C 库，大多数 Linux 系统上的标准 C 库。它提供 `malloc` 和 `free`、替程序发起[[syscall|系统调用]]的函数、线程支持，以及其他许多东西。',
    },
  },
  cfg: {
    title: { en: 'Control Flow Guard (CFG)', zh: '控制流防护（CFG）' },
    body: {
      en: 'A Windows protection built by the compiler and the OS together. Before each indirect call, through a function pointer or a [[vtable|vtable]], the program checks that the target is one of the functions marked as valid call targets, and stops if it is not.',
      zh: 'Windows 上由编译器和操作系统合作实现的一种保护。每次经由函数指针或[[vtable|虚表]]的间接调用之前，程序都会检查目标是否是被标记为合法调用目标的函数，不是就终止。',
    },
  },
  'x86-64': {
    title: { en: 'x86-64', zh: 'x86-64' },
    body: {
      en: 'The 64-bit version of the x86 instruction set, designed by AMD (as AMD64) and first shipped in 2003; Intel adopted it too. Most PCs and servers run it.',
      zh: 'x86 指令集的 64 位版本，由 AMD 设计（称为 AMD64），2003 年首次推出，Intel 随后也采用了它。大多数 PC 和服务器运行的都是它。',
    },
  },
  'branch-predictor': {
    title: { en: 'Branch predictor', zh: '分支预测器' },
    body: {
      en: 'The part of a CPU that guesses which way a conditional branch will go before the condition has been computed, so it can keep executing. It learns from each branch’s recent behaviour. A right guess costs almost nothing; after a wrong one, the work done on the guessed path is thrown away.',
      zh: 'CPU 里负责在条件还没算出来之前，就猜测条件分支往哪边走的部件，好让处理器继续往下执行。它从每个分支最近的表现中学习。猜对几乎没有代价；猜错了，沿猜测路径做的工作就被丢弃。',
    },
  },
  clang: {
    title: { en: 'Clang', zh: 'Clang' },
    body: {
      en: 'A C and C++ compiler from the LLVM project, and the main alternative to [[gcc|GCC]].',
      zh: 'LLVM 项目的 C 和 C++ 编译器，是 [[gcc|GCC]] 之外的主要选择。',
    },
  },
  fuzzing: {
    title: { en: 'Fuzzing', zh: '模糊测试（fuzzing）' },
    body: {
      en: 'Testing a program by feeding it large numbers of generated inputs, typically variations of earlier inputs that reached new code, and watching for crashes. Run on a program built with a sanitizer, it finds memory bugs that ordinary tests never trigger.',
      zh: '给程序灌入大量自动生成的输入来测试它，这些输入通常是由先前能走到新代码的输入变化而来，同时观察程序是否崩溃。对用消毒器编译的程序做模糊测试，能找出普通测试永远触发不了的内存错误。',
    },
  },
  jemalloc: {
    title: { en: 'jemalloc', zh: 'jemalloc' },
    body: {
      en: 'A general-purpose implementation of `malloc` and `free`. On Android it remained the allocator of low-memory devices when the rest moved to Scudo.',
      zh: '一个通用的 `malloc`/`free` 实现。Android 其余设备转向 Scudo 之后，低内存设备仍然用它。',
    },
    note: 'allocators',
  },
  'native-code': {
    title: { en: 'Native code (Android)', zh: '原生代码（Android）' },
    body: {
      en: 'Code compiled to the processor’s own instructions, usually from C, C++ or Rust, as opposed to Java and Kotlin code, which runs on the Android runtime. Much of the operating system itself is native code.',
      zh: '直接编译成处理器指令的代码，通常由 C、C++ 或 Rust 写成；与之相对的是运行在 Android 运行时上的 Java 和 Kotlin 代码。操作系统本身有很大一部分是原生代码。',
    },
  },
  'reference-count': {
    title: { en: 'Reference count', zh: '引用计数' },
    body: {
      en: 'A number kept with an object saying how many references to it exist. It goes up when a reference is made and down when one goes away; while it is above zero, something can still reach the object.',
      zh: '和对象放在一起的一个数，记录有多少个引用指向它。多一个引用就加一，少一个就减一；只要它大于零，就还有东西能访问到这个对象。',
    },
  },
  ffi: {
    title: { en: 'Foreign function interface (FFI)', zh: '外部函数接口（FFI）' },
    body: {
      en: 'The way code in one language calls functions written in another, such as Rust calling a C library. The calling language’s compiler cannot check what happens on the other side, so Rust treats such functions as unsafe to call unless the programmer declares otherwise.',
      zh: '一种语言的代码调用另一种语言写的函数的方式，比如 Rust 调用一个 C 库。调用方语言的编译器检查不了另一边发生了什么，所以除非程序员另行声明，Rust 把这类函数都当作调用起来不安全的函数。',
    },
  },
  cheri: {
    title: { en: 'CHERI', zh: 'CHERI' },
    body: {
      en: 'Capability Hardware Enhanced RISC Instructions: a research CPU architecture from SRI International and the University of Cambridge in which every pointer is a *capability* that carries the bounds and permissions of what it may access, checked by the hardware on every use. Arm’s Morello board built it in silicon.',
      zh: 'Capability Hardware Enhanced RISC Instructions（能力硬件增强 RISC 指令）：SRI International 与剑桥大学的研究型 CPU 架构。其中每个指针都是一个*能力*（capability），带着它可访问范围的界限和权限，硬件在每次使用时检查。Arm 的 Morello 开发板把它做进了芯片。',
    },
    note: 'bounds-revival',
  },
  rce: {
    title: { en: 'Remote code execution (RCE)', zh: '远程代码执行（RCE）' },
    body: {
      en: 'A vulnerability that lets someone elsewhere, for example across the network, run code of their choosing inside a program. It is among the worst outcomes a bug can have.',
      zh: '让远处的人（比如隔着网络）能在程序里运行自己选定的代码的漏洞，是漏洞最坏的后果之一。',
    },
  },
  'privilege-escalation': {
    title: { en: 'Privilege escalation (EoP)', zh: '权限提升（EoP）' },
    body: {
      en: 'Also called elevation of privilege (EoP). A bug that lets code gain rights it should not have: an ordinary program acting as the administrator (on Unix, root, so such a bug is also called a *root hole*), or code in a sandbox reaching beyond it.',
      zh: '也叫特权提升（elevation of privilege，EoP）。让代码获得本不该有的权限的漏洞：普通程序得以以管理员身份行事（在 Unix 上就是 root，所以这类漏洞也叫*提权漏洞*，英文俗称 root hole），或者沙箱里的代码越出沙箱。',
    },
  },
}

export default terms
