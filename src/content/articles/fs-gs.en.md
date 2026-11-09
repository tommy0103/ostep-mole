---
deck: x86-64 switched segmentation off, except for two registers. Their bases now hold up thread-local storage in every process and per-CPU data in the kernel, and the kernel’s handling of them has caused trouble for a decade.
title: Where segments survive on x86-64
---

::scene overview

Disassemble almost any function compiled with the stack protector on [[x86-64|x86-64]] Linux and one of the first instructions looks like this:

```text
mov    %fs:0x28,%rax
```

It loads the stack canary, a random value the function puts on its stack so it can check on return that nothing overwrote it. The `%fs:` prefix is a **segment override**. The CPU takes the base address of the FS segment, adds 0x28, and loads from there. That is chapter 16’s mechanism, a segment base added to an offset, running in code compiled today on a 64-bit processor that, by most accounts, abandoned segmentation two decades ago.

Inside the kernel, the same trick appears with the other surviving register. Incrementing a [[per-cpu|per-CPU]] counter compiles to a single instruction, `inc gs:[x]`, with no [[lock-prefix|lock prefix]] and no need to disable [[preemption|preemption]].

This piece is about what is left of segmentation on x86-64, why exactly those two registers survived, and why the kernel code that manages them has been the site of a [[spectre|Spectre]] variant, a [[privilege-escalation|root hole]], and an eight-year wait for four instructions.

## The segments chapter 16 describes

::chapter vm-segmentation

::scene segments

Chapter 16 generalizes base and bounds: instead of one pair per process, keep one pair per **segment**, such as code, heap and stack. The hardware needs a way to know which segment an address belongs to, and the book describes two. In the **explicit** approach, the top bits of the virtual address select the segment. In the **implicit** approach the hardware infers it from how the address was formed: an instruction fetch uses the code segment, and an address based on the stack or base pointer uses the stack segment.

x86 is the implicit approach, with an escape hatch. Instruction fetches go through CS, stack accesses through SS and most data accesses through DS. An instruction can carry a **prefix** byte that overrides the default and names another segment register: ES, FS or GS. FS and GS were added with the 80386 and had no fixed role, which is why they were free to take on new jobs later.

The chapter also ends with an aside on the term *segmentation fault*, which “persists, even on machines with no support for segmentation at all.” On x86-64 that is nearly literal.

## How x86 became flat

Segmentation on x86 had a long history before it was switched off, and that history explains what survived.

::scene descriptors

On the 8086 (1978), segments were simply a way to address more memory than 16 bits allow. A physical address was the segment register shifted left by four bits plus a 16-bit offset, which gave 1 MB of memory reached through windows of 64 KB. The 80286 turned segment registers into **selectors**, indexes into descriptor tables that held a base, a limit and protection bits, much like the segment table in chapter 16. The 80386 widened offsets to 32 bits and added paging.

::scene flat

Once paging existed, most operating systems, Linux and Windows NT among them, chose the **flat model**: every segment has base 0 and a limit covering the whole 4 GB, so a segment-relative address equals the [[linear-address|linear address]] and paging does all the real work. Segmentation was still checked on every access, but it no longer did anything.

When AMD designed the 64-bit extension that shipped in 2003, it made the flat model the only one. The kernel’s documentation puts it plainly: “In 64-bit mode the CS/SS/DS/ES segments are ignored and the base address is always 0.” Limits are not checked either. Two registers were spared: FS and GS keep a base, now a full 64-bit address. They still have no limit.

:::fold Segment arithmetic on the 8086, and why programmers were glad to see it go
An 8086 address was written *segment:offset*. The physical address was:

> physical = segment × 16 + offset

So `1234:0010` is 0x12340 + 0x10 = 0x12350. So is `1235:0000`, and so are about four thousand other pairs: segments overlapped every 16 bytes. Since offsets were 16 bits, any one segment covered 64 KB, and a data structure larger than that had to be split across segments by hand.

C compilers for this machine exposed the mess. They offered *memory models* (small, medium, compact, large, huge) that decided whether code and data pointers were *near* (16-bit offsets in one segment) or *far* (segment and offset), and many programs had to mix both. Comparing two far pointers for equality was not even straightforward, because different pairs could name the same byte.

The 286’s descriptors added protection, and the 386 made segments large enough not to matter. Paging then made them unnecessary. That is chapter 16’s argument, played out in the market: segmentation as a way to manage memory lost to fixed-size pages, for the reasons in [the fixed-versus-variable note](/notes/fixed-vs-variable). What remained was the cheapest part, an extra base added to an address for free.
:::

The lost limits mattered to at least one project. Google’s [[nacl|Native Client]] [[sandbox|sandbox]] relied on x86-32 segment limits to fence untrusted code into a region, and on x86-64 it had to rebuild that fence out of guard pages and a reserved register. That story is in [Base and bounds never really died](/notes/bounds-revival).

## What FS and GS are good for

::scene tls

A segment base with no limit is not a protection mechanism. What it gives you is an addition that every memory instruction can do for free: `%fs:off` means “*off* bytes from wherever FS points”, and the program does not need to know where that is. Point FS somewhere different in each [[thread|thread]], and the same instruction reaches a different place in each thread. That is a **per-context pointer** that costs no general-purpose register and no extra instruction.

There are two kinds of context to point at, and x86-64 Linux uses one register for each.

### User space: thread-local storage

Each thread has its own block of [[tls|thread-local storage]] (TLS), and [[glibc|glibc]] points FS at the thread’s control block. The kernel’s documentation says FS “is commonly used” this way, and that applications relying on such a runtime should leave FS alone. GS has no common use in 64-bit user space.

A thread-local variable is then a fixed offset from FS:

```c
__thread int counter;     /* one copy per thread */

int bump(void) { return ++counter; }
```

```text
# typical x86-64 code in an executable (local-exec TLS model), simplified
mov    %fs:counter@tpoff, %eax
add    $1, %eax
mov    %eax, %fs:counter@tpoff
```

The [[linker|linker]] turns `counter@tpoff` into a constant, so the variable costs exactly as much as a global. [[shared-library|Shared libraries]] loaded at run time cannot always know their offset in advance and use slower sequences, such as a call to `__tls_get_addr`. glibc keeps other per-thread data at fixed places in the same block. A pointer to the control block itself is at `%fs:0`, and the stack canary from the opening example is at `%fs:0x28`. On 32-bit x86 the same job was done by GS, and the canary sat at `%gs:0x14`.

::scene settls

Setting FS is the kernel’s job, since writing a segment base is privileged by default. When a thread is created, [[clone|`clone()`]] with `CLONE_SETTLS` takes the new value; on x86-64 it is, in the man page’s words, “the new value to be set for the %fs base register”. A program can also call `arch_prctl(ARCH_SET_FS, addr)`. The kernel saves and restores the FS base of each thread on every context switch, just like its other registers.

Architectures designed later simply provide a register for this. [[aarch64|AArch64]] has `TPIDR_EL0`, which user code can read with an ordinary `mrs` instruction. On x86 the job went to a leftover segment register because it was there.

### The kernel: per-CPU data

::scene percpu

The kernel has the same problem, but per CPU instead of per thread: run queues, counters and statistics that each CPU keeps for itself to avoid sharing [[cache-line|cache lines]]. On x86-64 Linux the GS base on each CPU points at that CPU’s per-CPU area. The kernel’s `this_cpu` documentation explains why that matters:

```c
DEFINE_PER_CPU(int, x);

z = this_cpu_read(x);     /* compiles to a single instruction: mov ax, gs:[x] */
this_cpu_inc(x);          /* inc gs:[x], with no lock prefix */
```

Without a segment base, reading a per-CPU variable means finding the current CPU’s number, computing the address, and loading from it, and the thread must not migrate to another CPU in between, so preemption has to be disabled around the sequence. With the base folded into the instruction, there is no gap between computing the address and using it, and so, in the documentation’s words, “it is not necessary to disable preemption or interrupts to ensure that the processor is not changed.” One instruction cannot be interrupted halfway.

## Two GS bases and SWAPGS

::scene swapgs

Here is the catch. User space may use GS for its own purposes, and the kernel uses GS for per-CPU data. When the CPU enters the kernel, through a system call, an interrupt or an exception, the user’s GS base is still loaded. The kernel needs its own before it can touch any per-CPU data, including the data that tells it which kernel stack to use.

AMD64’s answer is a second, hidden GS base held in a [[msr|model-specific register]], `MSR_KERNEL_GS_BASE`, and an instruction, `SWAPGS`, that exchanges it with the active one. The kernel executes SWAPGS on the way in and again on the way out. While the kernel runs, the MSR holds the *user’s* GS base, the opposite of what its name suggests, as the kernel documentation points out.

SWAPGS is a toggle, so the kernel must execute it exactly once on entry from user space and never on entry from kernel space. An interrupt that arrives while the kernel is already running must not swap, or it would load the user’s GS base inside the kernel. The entry code therefore has to decide on every entry whether it came from user mode.

:::fold The entry code that decides whether to SWAPGS
::scene sign

The kernel’s x86-64 entry documentation shows both ways of deciding. The cheap one looks at the code segment saved on the kernel stack by the interrupt. Its low two bits are the [[ring|privilege level]] the CPU was in:

```text
xorl %ebx,%ebx
testl $3,CS+8(%rsp)
je error_kernelspace
SWAPGS
```

That fails for [[nmi|NMIs]] and a few other “paranoid” entries, which can arrive at any instruction, including the one between a normal entry saving CS and executing SWAPGS. There the stack cannot be trusted, and the only reliable test is to read the current GS base and look at its sign:

```text
movl $1,%ebx
movl $MSR_GS_BASE,%ecx
rdmsr
testl %edx,%edx
js 1f   /* negative -> in kernel */
SWAPGS
xorl %ebx,%ebx
1:    ret
```

Kernel addresses on x86-64 Linux live in the upper half of the address space, so a kernel GS base is “negative” as a signed number and a user GS base never is, *as long as user space cannot set an arbitrary GS base*. That assumption is the reason for most of the rest of this article.
:::

## SWAPGS meets Spectre

::scene spectre

In August 2019 researchers at Bitdefender disclosed a Spectre variant 1 problem in exactly this code, tracked as [[cve|CVE-2019-1125]]. The decision whether to execute SWAPGS is a conditional branch, and conditional branches are [[branch-predictor|predicted]]. The kernel’s Spectre documentation describes two directions:

- An attacker in user space trains the branch predictor so that, on an interrupt from user mode, the CPU [[speculative-execution|speculatively]] *skips* SWAPGS. For the rest of the speculation window, GS-relative per-CPU loads use a value the attacker chose, and their effect on the cache can leak kernel memory.
- On an entry from kernel mode, the CPU speculatively *executes* SWAPGS, and kernel code speculatively runs with the user’s GS base.

The fix was to put `LFENCE` barriers after the SWAPGS decision in interrupt, exception and NMI entry paths, so that nothing runs speculatively until the branch is resolved. On a patched machine, `/sys/devices/system/cpu/vulnerabilities/spectre_v1` reports “Mitigation: usercopy/swapgs barriers and __user pointer sanitization”. It is one of a family of 2018–2019 fixes that made the kernel entry path more expensive. Another, page-table isolation for Meltdown, is the subject of [the PCID note](/notes/pcid).

## FSGSBASE: eight years for four instructions

::scene fsgsbase

Changing the FS base through `arch_prctl()` costs a system call, and reading it costs another. For most programs that does not matter, since FS is set once per thread. For a few it matters a lot: [[user-threads|user-level threading]] runtimes that switch TLS on every switch between tasks, and runtimes for [[sgx|Intel SGX enclaves]], which change these bases on enclave entries and exits. The [note on system-call cost](/notes/syscall-cost) explains why a call per operation adds up.

Intel added four instructions to [[ivy-bridge|Ivy Bridge]] processors in 2012 that solve this: `RDFSBASE`, `WRFSBASE`, `RDGSBASE` and `WRGSBASE`. They read and write the bases directly from user mode. The CPU only allows them if the kernel sets a bit in control register CR4, and for eight years Linux did not.

::scene danger

The reason is the sign test in the fold above. Once user space can execute `WRGSBASE`, it can load any GS base it likes, including a negative one. The [[nmi|NMI]] entry code would then decide it had come from the kernel, skip SWAPGS, and run the kernel with a GS base the attacker controlled. Enabling the instructions safely meant rewriting the most delicate part of the entry code first.

::scene fix59

That took several attempts. A version of the patches was merged into the x86 tree in 2019 and reverted when new problems appeared. In the meantime, some research projects running code in SGX enclaves shipped kernel modules that simply set the CR4 bit. As LWN reported in June 2020, that left the kernel’s assumptions about GS broken and the system open to easily exploited attacks. The series reached version 13, and support finally landed in **Linux 5.9**, released in October 2020. The paranoid entry path no longer guesses. When FSGSBASE is enabled it reads the current GS base, saves it, and loads the kernel’s own value unconditionally, then restores the saved value on exit.

:::fold Reading the FS base, before and after 5.9
::scene fsgsbase

User space can tell whether the kernel has enabled the instructions from the `HWCAP2_FSGSBASE` bit in the [[auxv|auxiliary vector]]. The kernel documentation recommends checking it rather than [[cpuid|CPUID]], since a CPU that supports the instructions will still fault with [[invalid-opcode|#UD]] if the kernel has not enabled them.

```c
#include <stdio.h>
#include <sys/auxv.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <asm/prctl.h>       /* ARCH_GET_FS */
#include <immintrin.h>       /* _readfsbase_u64; build with -mfsgsbase */

#ifndef HWCAP2_FSGSBASE
#define HWCAP2_FSGSBASE (1 << 1)
#endif

int main(void)
{
    unsigned long base;
    syscall(SYS_arch_prctl, ARCH_GET_FS, &base);    /* any x86-64 kernel: one system call */
    printf("FS base via arch_prctl: %#lx\n", base);

    if (getauxval(AT_HWCAP2) & HWCAP2_FSGSBASE)     /* Linux 5.9+ on a capable CPU */
        printf("FS base via RDFSBASE:   %#llx\n", _readfsbase_u64());   /* one instruction */
    return 0;
}
```

Both lines print the same address, the thread’s control block. The first goes through the kernel, the second does not. Compilers also offer a more direct notation: [[gcc|GCC]] 6 and later understand `__seg_fs` and `__seg_gs` as address-space qualifiers, so `*(int __seg_gs *)8` is a load from GS base + 8. [[clang|Clang]] uses `__attribute__((address_space(256)))` for GS and `address_space(257)` for FS.
:::

## FRED: the hardware takes over the swap

::scene fred

The SWAPGS story is now ending the way many such stories do, with the hardware taking over the job. Intel’s **FRED** (Flexible Return and Event Delivery) replaces the 1980s-era interrupt-delivery mechanism with new ring transitions. With FRED enabled, an event from [[ring|ring 3]] swaps the GS base with `IA32_KERNEL_GS_BASE` as part of delivery, and the return to user mode swaps it back. SWAPGS is then not just unnecessary but forbidden: it raises [[invalid-opcode|#UD]]. A companion instruction, `LKGS`, lets the kernel load a user GS selector without disturbing its own GS base. Linux merged FRED support in 6.9, in 2024.

There is no branch left to mispredict and no sign test to fool, because the hardware always knows which ring it came from. The cleanest fix for a fragile convention was to stop doing it in software.

## The thread back to the book

::scene overview

Segmentation, as chapter 16 presents it, is a bundle of three ideas: a base added to every address, a limit checked on every access, and a way of choosing which pair applies. As a memory-management scheme, the bundle lost to paging. Variable-sized segments fragment physical memory, which is chapter 17’s problem, and paging solved it.

x86-64 kept exactly one of the three ideas. FS and GS are **base without bounds**, chosen by the implicit-plus-override rule from 1978. They survived because a free addition in the address path is the cheapest way to give the same code a different view in each context: per thread in user space, per CPU in the kernel. Everything that went wrong around them, the sign test, the Spectre gadget, the long wait for FSGSBASE, came from one register having two owners and software having to switch it at exactly the right moment.

The bounds half did not die either. It moved elsewhere: into guard pages, WebAssembly runtimes and capability hardware, as the [bounds note](/notes/bounds-revival) traces. Even [[cheri|CHERI]], which puts bounds in every pointer, notes that its architecture may need extensions for capability-based access to thread-local storage. The per-context base pointer is a need that new designs keep running into.

## Further reading

- [Using FS and GS segments in user space applications](https://docs.kernel.org/arch/x86/x86_64/fsgs.html), Linux kernel documentation: 64-bit segment semantics, `arch_prctl()`, FSGSBASE, compiler support and the SWAPGS details.
- [this_cpu operations](https://docs.kernel.org/core-api/this_cpu_ops.html), Linux kernel documentation: per-CPU access through a segment prefix.
- [Kernel entries](https://docs.kernel.org/arch/x86/entry_64.html), Linux kernel documentation: where the entry code decides whether to SWAPGS.
- [Spectre side channels](https://docs.kernel.org/admin-guide/hw-vuln/spectre.html), Linux kernel documentation: the SWAPGS variant and its LFENCE mitigation.
- Jonathan Corbet, [*A possible end to the FSGSBASE saga*](https://lwn.net/Articles/821723/), LWN, June 2020.
- [5.9 Merge window, part 1](https://lwn.net/Articles/828120/), LWN, August 2020: FSGSBASE merged.
- [Flexible Return and Event Delivery (FRED)](https://docs.kernel.org/arch/x86/x86_64/fred.html), Linux kernel documentation.
- Fangrui Song, [*All about thread-local storage*](https://maskray.me/blog/2021-02-14-all-about-thread-local-storage): TLS models and the code compilers emit for them.
