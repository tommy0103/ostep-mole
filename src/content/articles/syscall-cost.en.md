---
deck: A system call is the book’s trap, and since 2018 each one has cost more. Here is where the time goes, and how vDSO, batching and io_uring cut the number of trips.
title: When the trap is too expensive: the price of a system call, and three ways around it
---

::scene overview

In January 2018 the [[spectre|Meltdown]] attack was made public, and within weeks Linux 4.15 shipped the fix: **[[kpti|kernel page-table isolation]]**, or KPTI. Soon after, Brendan Gregg, then at Netflix, published what it cost. The patches, he wrote, “introduce the largest kernel performance regressions I’ve ever seen.” A typical Netflix service would pay well under one percent. A worst case he built, with a high system-call rate and a large [[working-set|working set]], slowed down by more than 800%.

## What Meltdown was, and what KPTI changed

::scene meltdown

Every process has a [[page-table|page table]]: the structure the CPU consults on each memory access to turn the program’s addresses into places in physical memory. Chapters 18 to 20 build it up. Until 2018, Linux, Windows and macOS all put the kernel into every process’s page table too. On 64-bit Linux the lower half of the address space held the program and the upper half held the kernel, including a [[direct-map|direct map]] of all physical memory, which the kernel uses to reach any page. The kernel’s entries were marked supervisor-only: in user mode, a load from one of those addresses faults.

The arrangement saved work. A trap only had to raise the privilege level. The kernel’s code and data were already mapped, so no page tables had to be switched, and the kernel could reach the program’s memory directly, for example to copy the bytes of a `read()` into the program’s buffer. The protection rested on that one permission bit.

Meltdown showed that the bit was checked too late. A modern CPU does not finish one instruction before it starts the next. It runs ahead, executing later instructions as soon as their inputs are ready, and it deals with a fault only when it *retires* the faulting instruction, in program order. On many Intel processors, a load from a kernel address handed its value to the following instructions before the fault was raised. When the fault came, the CPU threw away those instructions’ results. It did not undo what they had done to the [[cpu-cache|cache]].

The core of the attack, in the paper by Moritz Lipp and colleagues (USENIX Security 2018), is a handful of instructions:

```text
; rcx = kernel address, rbx = probe array
xor rax, rax
retry:
mov al, byte [rcx]
shl rax, 0xc
jz retry
mov rbx, qword [rbx + rax]
```

- `mov al, byte [rcx]` loads one byte from a kernel address. It will fault, but not yet.
- `shl rax, 0xc` multiplies the byte by 4096. If the byte came out as 0, `jz retry` tries again: a 0 often means the fault won the race.
- `mov rbx, qword [rbx + rax]` reads one slot of a *probe array*: 256 slots, 4096 bytes apart, which the attacker flushed out of the cache beforehand. The byte’s value picks the slot.

Then the fault arrives. The program catches it with a [[signal|signal]] handler, or suppresses it with Intel’s [[tsx|transactional memory]], and reads all 256 slots, timing each one. One slot answers from the cache in a few nanoseconds; the rest come from memory and take about a hundred. That slot’s number is the byte. The paper dumped kernel memory at 3.2 KB/s to 503 KB/s, depending on the machine. Since the kernel maps all physical memory, this included the memory of other processes, and of other containers sharing the same kernel. The figure steps through one byte.

Three teams found it independently: Jann Horn of Google Project Zero, Werner Haas and Thomas Prescher of Cyberus Technology, and a group at Graz University of Technology. The paper names “modern Intel microarchitectures since 2010”; among Arm cores only the Cortex-A75 was affected, and the authors could not reproduce it on AMD. Nothing was wrong with the page-table permissions. The kernel leaked because it was mapped at all.

::scene kpti

So the fix was to stop mapping it. The design already existed: in 2017 Daniel Gruss and colleagues at Graz had published KAISER, which keeps the kernel out of user page tables in order to stop a different side-channel attack, one on [[kaslr|KASLR]]. A reworked version is the KPTI that shipped in Linux 4.15. With it, each process has two page tables instead of one:

- The kernel copy maps everything, as before: the program and the whole kernel.
- The user copy maps the program, plus only what the CPU needs to get into the kernel and back out: the entry and exit code, the [[idt|interrupt descriptor table]], and a small per-CPU area that holds the entry stacks.

While your program runs, the user copy is loaded. A kernel address has no translation in it at all, so a speculative load has no value to pass on. Every entry into the kernel, by system call, interrupt or exception, now starts by pointing [[cr3|`CR3`]], the register that holds the page table’s address, at the kernel copy, and every return ends by pointing it back. Windows (KVA Shadow) and macOS (Double Map) shipped the same idea. Newer Intel processors report that they are not affected, and on those, as on AMD’s, Linux leaves KPTI off.

:::fold What the switch looks like in the kernel
The entry code shown further down calls `SWITCH_TO_KERNEL_CR3`. It is a macro in `arch/x86/entry/calling.h`. Here it is, with the macro it uses, from a recent mainline kernel:

```text
.macro ADJUST_KERNEL_CR3 reg:req
	ALTERNATIVE "", "SET_NOFLUSH_BIT \reg", X86_FEATURE_PCID
	/* Clear PCID and "MITIGATION_PAGE_TABLE_ISOLATION bit", point CR3 at kernel pagetables: */
	andq    $(~PTI_USER_PGTABLE_AND_PCID_MASK), \reg
.endm

.macro SWITCH_TO_KERNEL_CR3 scratch_reg:req
	ALTERNATIVE "jmp .Lend_\@", "", X86_FEATURE_PTI
	mov	%cr3, \scratch_reg
	ADJUST_KERNEL_CR3 \scratch_reg
	mov	\scratch_reg, %cr3
.Lend_\@:
.endm
```

- The two copies sit side by side. With KPTI a process’s top-level page table takes two consecutive 4 KB pages instead of one, the kernel copy first, so the user copy’s address is the kernel copy’s plus 4096. In `CR3` that is one bit, bit 12. Switching copies is clearing or setting it: a single `andq` between reading `CR3` and writing it back.
- The same mask clears one bit of the PCID, a tag kept in the low 12 bits of `CR3` that the section on 2018 explains. The kernel and user halves of one process get different tags.
- `SET_NOFLUSH_BIT` sets bit 63, which tells the CPU to keep the TLB entries already cached under that tag instead of flushing them.
- `ALTERNATIVE` is patched at boot. As written, the macro starts with a jump past itself; on a CPU that needs KPTI, the kernel removes the jump.
:::

Nothing in the programs had changed. What had changed was the price of each trip into the kernel. This piece is about that price: what a trap really costs on a modern CPU, why it depends on things the book’s timeline does not show, and three ways systems people make fewer trips.

## The question, in the book’s terms

Chapter 6 calls it *limited* direct execution. User code runs at full speed until it needs something only the kernel may do. Then it executes a trap instruction, the hardware switches to kernel mode and jumps through the trap table, and the kernel later uses return-from-trap to send it back. The “limited” part is what makes the system safe. It is also the part that costs time.

::scene account

So the question is an accounting one. If a program crosses the user/kernel boundary *n* times a second and each crossing costs *c*, it spends *n* · *c* of every second on crossing alone. A system can lower *c*, or it can lower *n*. Since 2018 *c* has gone up, and most of the action has moved to *n*.

::chapter cpu-mechanisms

The chapter’s aside on context-switch cost gives the 1996 baseline: roughly 4 microseconds per system call on a 200 MHz P6. Modern machines are far faster, but the book also quotes Ousterhout’s warning that OS operations do not scale with CPU speed, because so much of their work is memory traffic. That warning is the whole story of this article.

::scene trap

## What one trap actually does

Start with the hardware half. On [[x86-64|x86-64]] a program makes a system call by putting the call number in `rax`, up to six arguments in `rdi`, `rsi`, `rdx`, `r10`, `r8` and `r9`, and executing `SYSCALL`. The instruction does less than you might expect:

- It saves the return address in `rcx` and the flags register in `r11`.
- It loads the new instruction pointer from a [[msr|model-specific register]], `IA32_LSTAR`, written by the kernel at boot: the book’s trap table, reduced to one entry.
- It switches to kernel privilege and clears the flag bits named in `IA32_FMASK`; Linux uses this to start with interrupts disabled.
- It does **not** change the stack pointer. The kernel is now running on the user’s stack, which it must not trust.

Everything else is software. The kernel’s entry code swaps in its [[per-cpu|per-CPU data]] with `swapgs`, parks the user stack pointer, switches page tables if KPTI is on, loads the kernel stack, and pushes every user register into a `struct pt_regs`: the “save registers to the kernel stack” box in the book’s Figure 6.2. On the way out, all of it runs in reverse.

The lab shows this sequence at the book’s level of detail. Pick the system-call scenario and step through it. Count the steps in which neither your program nor the system-call handler does work for you: they are all saving, switching and restoring. On real hardware each of those boxes has grown since the book was written.

::lab Lde

Measured in isolation, the direct cost is small. In 2014 Denys Vlasenko timed a 64-bit `getpid()` on a 2.7 GHz Intel Core i7-2620M at about 54 nanoseconds. That was before KPTI and before the Spectre mitigations the entry path runs today.

:::fold What the kernel entry code looks like
This is the start of the 64-bit system-call entry in `arch/x86/entry/entry_64.S` from a recent mainline kernel, trimmed, with some comments added. Each line maps onto a box in the book’s timeline, and several did not exist before 2018.

```text
SYM_CODE_START(entry_SYSCALL_64)
	swapgs                                    /* switch to the kernel's per-CPU base */
	movq	%rsp, PER_CPU_VAR(cpu_tss_rw + TSS_sp2)   /* park the user stack pointer */
	SWITCH_TO_KERNEL_CR3 scratch_reg=%rsp     /* KPTI: switch to the full page tables */
	movq	PER_CPU_VAR(cpu_current_top_of_stack), %rsp

	/* Construct struct pt_regs on stack */
	pushq	$__USER_DS                        /* pt_regs->ss */
	pushq	PER_CPU_VAR(cpu_tss_rw + TSS_sp2) /* pt_regs->sp */
	pushq	%r11                              /* pt_regs->flags */
	pushq	$__USER_CS                        /* pt_regs->cs */
	pushq	%rcx                              /* pt_regs->ip */
	pushq	%rax                              /* pt_regs->orig_ax */
	PUSH_AND_CLEAR_REGS rax=$-ENOSYS

	movq	%rsp, %rdi
	movslq	%eax, %rsi
	IBRS_ENTER                                /* Spectre-class mitigations */
	UNTRAIN_RET
	CLEAR_BRANCH_HISTORY
	call	do_syscall_64
```

Three details are worth noticing.

- The kernel builds by hand the frame the book says “the hardware” saves. `SYSCALL` saves only two registers.
- `PUSH_AND_CLEAR_REGS` saves the user’s registers and then zeroes them, so values the user chose cannot steer [[speculative-execution|speculative execution]] inside the kernel.
- `SWITCH_TO_KERNEL_CR3`, `IBRS_ENTER`, `UNTRAIN_RET` and `CLEAR_BRANCH_HISTORY` are all mitigations for hardware flaws found from 2018 onward. Which of them do real work depends on the CPU and on boot options. When one is not needed, the kernel patches it out at boot.
:::

::scene indirect

## The cost you do not see

The 54 ns figure is the *direct* cost: the cycles spent on the boundary itself. In 2010 Livio Soares and Michael Stumm showed that it is not the whole bill. Their FlexSC paper (OSDI 2010) measured user-mode [[instructions-per-cycle|instructions per cycle]] in a [[spec-cpu|SPEC]] benchmark around a single system call on an Intel Core i7. After the call returned, the program ran at a reduced rate for a while, as it refilled what the kernel had displaced: the [[pipeline|pipeline]], the L1 caches and the [[tlb|TLB]]. Their conclusion was that synchronous system calls hurt performance “primarily because of pipeline flushing and pollution of key processor structures.”

Chapter 7 makes the same point about context switches: the price includes the warm state in caches and TLBs that the next piece of code has to rebuild. A trap is a small context switch, into the kernel and back, and pays the same indirect tax.

FlexSC’s remedy foreshadowed [[io-uring|io_uring]]: [[thread|threads]] wrote requests into [[shared-memory|shared memory]], and [[kernel-thread|kernel threads]] on other cores picked them up. The paper reports Apache up to 116% faster, MySQL up to 40% and BIND up to 105%, with no changes to the applications.

::scene kpti

## 2018: the price goes up

Look at the entry code again with the opening in mind. `SWITCH_TO_KERNEL_CR3` is KPTI’s page-table switch, and its mirror image, `SWITCH_TO_USER_CR3`, runs on every exit. Before 2018 a trap changed the privilege level and left the address space alone. Now every system call, interrupt and exception writes `CR3` on the way in and again on the way out.

::scene pcid

The kernel’s documentation (2018) puts writes to `CR3` “on the order of a hundred cycles.” That is the direct part. The larger part is indirect: a `CR3` write normally flushes the TLB, so without help every system call would throw away every cached translation. The help is x86’s **[[pcid|PCID]]**, process-context identifiers, which tag TLB entries so user and kernel translations can coexist. That story belongs to chapter 19 and has [its own note](/notes/pcid). The point here: with PCID, KPTI is a tax on each crossing. Without it, KPTI wipes out your TLB on every crossing.

:::fold How Gregg measured it, and how 800% happens
Gregg’s 2018 analysis ran on AWS instances with Linux 4.14, using a microbenchmark that varied the system-call rate and the working-set size separately. He listed five factors that set the overhead: system-call rate, context-switch rate, [[page-fault|page-fault]] rate, working-set size, and cache access pattern.

Some of his numbers:

- At 50,000 system calls per second per CPU, the overhead might be about 2%. Below about 10,000, typical of Netflix services, he expected less than 0.5%.
- At 5,000 per second per CPU with a large working set, the overhead was about 2.1% on the older 4.4 and 4.9 kernels, and about 0.5% on 4.14 with PCID in use.
- Working sets beyond about 10 MB added TLB-flush overhead that could turn a 1% cost into 7%. Cache access patterns could add 1% to 10% more.
- In his worst constructed case, instructions per cycle fell from 0.86 to 0.10, with 27.4% of cycles spent walking page tables after data-TLB misses. That is the “over 800%” figure.

His fleet estimate for Netflix was 0.1% to 6%, with a goal of under 2% after tuning: kernels with PCID, [[huge-page|huge pages]], and fewer system calls. Notice the last item. Part of the fix for an expensive trap was to trap less.
:::

::scene vdso

## Strategy one: don’t trap at all

Some system calls only read a value the kernel already knows. The current time is the classic case: a program that timestamps every request calls `clock_gettime()` constantly, and none of those calls needs privileged hardware, only a few numbers the kernel keeps up to date.

The **[[vdso|vDSO]]**, the virtual dynamic shared object, is the kernel’s answer: a small library of kernel-written code that runs in user mode, next to the data it needs. The [[libc|C library]] routes calls such as `clock_gettime()` to it instead of trapping. On x86-64 it exports `clock_gettime`, `gettimeofday`, `time` and `getcpu`. In the [[man-page|man page]]’s words, the call “changes from a system call to a normal function call and a few memory accesses.”

::scene vvar

### Two mappings in every process

Every process’s memory map shows it. On an arm64 machine running Linux 6.8, `/proc/self/maps` has these two lines:

```text
e765c389f000-e765c38a1000 r--p 00000000 00:00 0    [vvar]
e765c38a1000-e765c38a2000 r-xp 00000000 00:00 0    [vdso]
```

The kernel installs both at every [[fork-exec|`execve()`]], before the program’s first instruction runs.

- `[vdso]` is code, readable and executable. It is a real [[elf|ELF]] shared library, built when the kernel is compiled and embedded in the kernel image. `ldd` lists it as `linux-vdso.so.1`, although no such file exists on disk. Its pages are the same physical pages in every process.
- `[vvar]` is data, and read-only. The kernel allocates these pages once at boot and its timekeeping code writes the current clock parameters there. It does not copy them into the process. The first read of `[vvar]` [[page-fault|faults]], and the fault handler, `vvar_fault()`, maps in the kernel’s own page. Every process on the machine therefore reads the same physical page that the kernel is writing through its own mapping.
- Both land at a random address. The kernel passes the vDSO’s address to the program in the [[auxv|auxiliary vector]], under the tag `AT_SYSINFO_EHDR`. At startup the C library reads the ELF symbol table found there and looks up `__vdso_clock_gettime`, version `LINUX_2.6`, on x86-64.

Before the vDSO, x86-64 Linux offered the *vsyscall page*, which did the same job from a fixed address, `0xffffffffff600000`, the same in every process on every machine. An address that never moves is useful to an attacker who needs known instructions to jump to, and the kernel has spent years emptying that page out.

:::fold The vsyscall page, and how it was emptied
The page sat in the kernel’s half of the address space but was open to user mode. It had three entry points at fixed offsets: `gettimeofday` at `+0x000`, `time` at `+0x400` and `getcpu` at `+0x800`. Old C libraries and statically linked programs called those absolute addresses directly, with nothing to look up. The time data sat in the same page, and the page was executable.

| | vsyscall page | vDSO |
|---|---|---|
| Address | fixed, `0xffffffffff600000` | random, chosen at each `execve()` |
| How a program finds it | calls a hard-coded address | auxiliary vector, then the ELF symbol table |
| Functions | three, at fixed offsets | exported by name, so more can be added |
| Code and data | one executable page | `[vdso]` (r-x) and `[vvar]` (read-only) |
| Architectures | x86-64 only | nearly all |
| Speed today | slow: every call traps and is emulated | fast: no trap |

An attacker who overruns a stack can often make a function “return” to an address of their choosing. [[aslr|ASLR]] hides where the C library is, but the vsyscall page was always in the same place, and it held instructions that make system calls. LWN noted in 2011 that even the time value stored there, when it happened to hold the right bytes, looked like a system-call instruction if jumped into: data in an executable page can serve as code.

The page could not simply be deleted, because old programs call it. So it was emptied in stages:

- In 2011 Andy Lutomirski removed the useful instructions. A call into the page now traps into the kernel, which works out which of the three slots was called, makes the real system call and returns. LWN described the result as “a kernel system call emulating a virtual system call which was put there to avoid the kernel system call in the first place.” Old programs keep working, a little slower.
- The default today, `vsyscall=xonly`, goes further. In the words of the kernel source, “there is no [[pte|PTE]] at all backing the vsyscall page.” Executing it faults and is emulated; reading it fails.
- `vsyscall=none` removes the page entirely. The kernel’s help text says that with glibc 2.14 or newer and no static binaries, this costs nothing.
:::

::scene vdso

### Reading a clock while the kernel rewrites it

The time data is not static. The kernel rewrites it each time its timekeeping advances, normally on every timer tick, and some other CPU may be halfway through reading it at that moment. A lock will not do: the reader is user code, and the kernel’s clock must never wait for a process. The vDSO uses a **sequence counter** instead:

1. The writer increments `seq`, which makes it odd, writes the new values, then increments `seq` again, which makes it even.
2. The reader reads `seq`, waiting while it is odd. It reads the values and the CPU’s [[tsc|timestamp counter]] and does the arithmetic. Then it reads `seq` again. If it changed, the values may be half old and half new, so the reader throws its result away and starts over.

The reader never writes, so the page can be read-only. The writer never waits, so no process can stall the kernel. A collision costs one retry, and updates are brief and far apart. The arithmetic itself converts counter ticks to nanoseconds in fixed point: nanoseconds = ((counter − counter at the last update) × `mult` + base) >> `shift`, with `mult` and `shift` chosen by the kernel for the counter’s frequency.

:::fold The reader, in the kernel’s generic vDSO code
This is the high-resolution path of `clock_gettime()` from `lib/vdso/gettimeofday.c` and `include/vdso/helpers.h` in a recent mainline kernel, trimmed and simplified: the handling of time namespaces and of counter overflow is left out. It is compiled into the vDSO and runs in user mode:

```c
static u32 vdso_read_begin(const struct vdso_clock *vc)
{
	u32 seq;

	while (unlikely((seq = READ_ONCE(vc->seq)) & 1))
		cpu_relax();                    /* an update is in progress */
	smp_rmb();
	return seq;
}

static u64 vdso_calc_ns(const struct vdso_clock *vc, u64 cycles, u64 base)
{
	u64 delta = (cycles - vc->cycle_last) & vc->mask;

	return ((delta * vc->mult) + base) >> vc->shift;
}

bool do_hres(const struct vdso_time_data *vd, const struct vdso_clock *vc,
	     clockid_t clk, struct __kernel_timespec *ts)
{
	u64 sec, ns;
	u32 seq;

	do {
		seq = vdso_read_begin(vc);
		if (!vdso_get_timestamp(vd, vc, clk, &sec, &ns))
			return false;           /* no usable counter: make the real call */
	} while (vdso_read_retry(vc, seq));

	vdso_set_timespec(ts, sec, ns);
	return true;
}
```

- `vdso_get_timestamp()` reads the hardware counter, on x86 the timestamp counter, and calls `vdso_calc_ns()`. It returns false when the kernel has marked the clock source as unreadable from user mode, and `clock_gettime()` then falls back to the system call.
- `smp_rmb()` is a read [[memory-barrier|memory barrier]]. It keeps the CPU from reading the values before `seq`, or `seq` the second time before the values.
- The writer is `update_vsyscall()` in `kernel/time/vsyscall.c`. It brackets its stores with `vdso_write_begin()` and `vdso_write_end()`, each of which increments `seq` with a write barrier on the inside.
:::

This is still limited direct execution, with the limit moved: the process may *read* the kernel’s published values but not write them. If no fast path is possible, for example because the clock source cannot be read from user mode, the vDSO function quietly makes the real system call. Because the fast path never traps, `strace`, the tool that lists a program’s system calls, does not show these calls, and [[seccomp|seccomp]] filters cannot see them, as the man page notes. The idea keeps spreading: Linux 6.11 (2024) added a vDSO `getrandom()` by Jason Donenfeld, who reported it “around 15x” faster for 32-bit values.

::scene batch

## Strategy two: one trap, many requests

When the work really does need the kernel, a system can pay the fixed cost once for many operations. This is amortization, the same trick chapter 7 recommends for time slices: when an operation has a fixed cost, do it less often and spread the cost over more work.

UNIX has done this for a long time. `readv()` and `writev()` move several buffers in one call. `sendmmsg()` (Linux 3.0) and `recvmmsg()` handle many datagrams per call. [[epoll|`epoll_wait()`]] returns many ready [[handle|file descriptors]] at once. The pattern is always the same: replace *n* traps with one trap that carries *n* requests.

The limit is that the batch must be assembled first and handed over in a call that the program waits for. To keep issuing work while earlier work is still running, you have to get the call out of the way.

::scene rings

## Strategy three: share the queue

**[[io-uring|io_uring]]**, written by Jens Axboe and merged in Linux 5.1 in May 2019, removes the call from the hand-over. Its central idea is two [[ring-buffer|ring buffers]] in memory that the process and the kernel share:

- The **submission queue** (SQ). The application writes request descriptors, called SQEs, and advances the tail. The kernel reads from the head.
- The **completion queue** (CQ). The kernel writes results, called CQEs, and advances the tail. The application reads from the head.

Each side writes only its own end of each ring, so the two work in parallel without locks, using [[memory-barrier|memory barriers]] to publish updates. Setup costs a few system calls (`io_uring_setup()` and some [[mmap|`mmap()`]]s). After that, one `io_uring_enter()` can submit everything queued so far *and* wait for completions, in the same trap.

::scene compare

Like the vDSO, io_uring works by putting memory the kernel also uses into the process’s address space. The resemblance ends there:

| | vDSO | io_uring |
|---|---|---|
| Who maps it | the kernel, at every `execve()`, unasked | the program, with `mmap()` on the ring’s file descriptor, or by handing the kernel its own memory (`IORING_SETUP_NO_MMAP`) |
| Shared by | every process on the machine | one ring, set up by one program |
| Who writes | only the kernel; the program’s mapping is read-only | both: the program writes requests and the SQ tail, the kernel writes results and the CQ tail |
| Contains code | yes, kernel-built code that runs in user mode | no; the kernel does the work |
| Staying consistent | a sequence counter, and readers retry | each index has one writer, and barriers order the entries before the index |
| Kernel reads memory the program writes | never | on every request |

The last row matters most. The vDSO’s data flows one way, out of the kernel, so a program can at worst misread its own clock. io_uring’s kernel reads requests from memory the program can change at any moment, even while the kernel is reading them. It reads each field of a request once, `READ_ONCE(sqe->opcode)` in the source, and works only from its own copy. The next section shows what that exposure has cost.

::scene sqpoll

By default, then, io_uring is strategy two with a better interface: many requests per trap, and completions that arrive asynchronously. With `IORING_SETUP_SQPOLL` it goes further. A kernel thread polls the submission ring, so the application submits by writing to memory and makes no system call at all. If the ring stays idle, by default for about a second, the thread sleeps and sets `IORING_SQ_NEED_WAKEUP`, and the application must make one `io_uring_enter()` to wake it. Registered (“fixed”) buffers and files set up mappings and file references once instead of on every operation.

Here is the shape of a program that reads eight blocks of a file using the `liburing` helper library. It needs Linux 5.6 or later for `IORING_OP_READ`, and is built with `-luring`.

```c
#include <fcntl.h>
#include <liburing.h>
#include <stdio.h>

#define N  8
#define BS 4096

int main(int argc, char **argv)
{
    struct io_uring ring;
    static char buf[N][BS];
    if (argc < 2) return 1;
    int fd = open(argv[1], O_RDONLY);
    if (fd < 0 || io_uring_queue_init(N, &ring, 0) < 0) return 1;

    for (int i = 0; i < N; i++) {              /* fill N slots in the shared ring: no system calls */
        struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
        io_uring_prep_read(sqe, fd, buf[i], BS, (__u64)i * BS);
        io_uring_sqe_set_data(sqe, (void *)(long)i);
    }
    io_uring_submit(&ring);                     /* one io_uring_enter() hands over all N */

    for (int i = 0; i < N; i++) {               /* completions may arrive in any order */
        struct io_uring_cqe *cqe;
        io_uring_wait_cqe(&ring, &cqe);         /* enters the kernel only if the CQ is empty */
        printf("block %ld: %d bytes\n", (long)io_uring_cqe_get_data(cqe), cqe->res);
        io_uring_cqe_seen(&ring, cqe);
    }
    io_uring_queue_exit(&ring);
    return 0;
}
```

Submitting costs one trap however many reads are queued, and waiting traps only when no completion is ready yet. With SQPOLL, a busy steady state can make none.

:::fold Measure it yourself
Chapter 6’s homework asks you to time a system call. This version also times one operation, reading the monotonic clock, twice: through the vDSO, and forced through a real trap with `syscall()`.

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

static double now(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec + ts.tv_nsec / 1e9;
}

int main(void)
{
    enum { N = 10000000 };
    struct timespec ts;
    double t0 = now();
    for (int i = 0; i < N; i++)
        syscall(SYS_getpid);                               /* a real trap every time */
    double t1 = now();
    for (int i = 0; i < N; i++)
        clock_gettime(CLOCK_MONOTONIC, &ts);               /* vDSO: normally no trap */
    double t2 = now();
    for (int i = 0; i < N; i++)
        syscall(SYS_clock_gettime, CLOCK_MONOTONIC, &ts);  /* same work, forced through a trap */
    double t3 = now();
    printf("getpid, trap          %6.1f ns\n", (t1 - t0) / N * 1e9);
    printf("clock_gettime, vDSO   %6.1f ns\n", (t2 - t1) / N * 1e9);
    printf("clock_gettime, trap   %6.1f ns\n", (t3 - t2) / N * 1e9);
    return 0;
}
```

Build it with `cc -O2 cost.c` and pin it to one CPU with `taskset -c 0 ./a.out`. Three things are worth trying:

- Compare the second and third lines. The work is identical; the difference is the price of the trap.
- Look at `/sys/devices/system/cpu/vulnerabilities/`, which lists your CPU’s known flaws and the active mitigations: what your entry path is paying for.
- On a throwaway test machine, boot once with `nopti` and compare. This removes the Meltdown protection; never do it where untrusted code runs.

In a VM whose clock source cannot be read through the vDSO, the “fast” path falls back to the trap.
:::

::scene surface

## Where it bends

Each strategy moves the cost somewhere else.

- **The vDSO works only for read-mostly data:** clocks, CPU numbers, now random bytes. It cannot help a call that changes kernel state.
- **Batching adds latency.** Waiting for 64 packets to send in one `sendmmsg()` makes the first one wait: response time traded for throughput, as with a longer time slice in chapter 7.
- **Polling burns a core.** An SQPOLL thread spinning on an idle ring occupies a CPU; the idle timeout is the compromise.
- **Shared memory is a larger attack surface.** A trap has one narrow, checked entry point. io_uring is a large asynchronous subsystem reading requests from memory the user can change at any moment. In June 2023 Google reported that 60% of the kernel [[exploit|exploits]] submitted to its kCTF bug bounty in the past year had used io_uring. It disabled io_uring on ChromeOS and its production servers, and uses a seccomp-bpf filter so Android apps cannot reach it.

The last point is the book’s safety argument in reverse. Chapter 6 warns the kernel to treat user input with suspicion, and a trap is a good place to do it, because there is only one way in. Every design that bypasses the trap has to rebuild that suspicion elsewhere.

::scene overview

## The thread back to the book

The three strategies come down to two ideas from the book’s first chapters.

The first is amortization: if a fixed cost cannot shrink, spread it over more work, as chapter 7 does with time slices.

The second is the shape of limited direct execution itself. The vDSO turns “must not touch kernel state” into “may read it.” io_uring turns “must enter through the trap table” into “may leave a request in a queue the kernel agreed to watch.” The kernel keeps control in both cases; the boundary moves, and crossing it gets cheaper. The same tension between running directly and keeping control appears at every layer above the kernel, the subject of [the thread at the end of this chapter](/notes/lde-everywhere).

## Further reading

- Moritz Lipp et al.: [Meltdown: Reading Kernel Memory from User Space](https://www.usenix.org/conference/usenixsecurity18/presentation/lipp), USENIX Security 2018: the attack, the code in this piece, and the operating systems’ responses.
- [The current state of kernel page-table isolation](https://lwn.net/Articles/741878/) (LWN, December 2017): how KPTI splits the page tables.
- [Page Table Isolation (PTI)](https://docs.kernel.org/arch/x86/pti.html): the kernel’s own documentation, including its overhead section.
- [KPTI/KAISER Meltdown Initial Performance Regressions](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html) (Brendan Gregg, February 2018): the five factors, the measurements and the 800% case.
- [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html): what the vDSO exports on each architecture.
- [Ringing in a new asynchronous I/O API](https://lwn.net/Articles/776703/) (LWN, January 2019): io_uring’s design as first proposed, including SQPOLL and fixed buffers.
- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html): ring layout, head/tail ownership, and an example without liburing.
- Livio Soares, Michael Stumm: [FlexSC: Flexible System Call Scheduling with Exception-Less System Calls](https://www.usenix.org/conference/osdi10/flexsc-flexible-system-call-scheduling-exception-less-system-calls), OSDI 2010: the indirect cost of system calls, measured.
- [Learnings from kCTF VRP’s 42 Linux kernel exploits submissions](https://security.googleblog.com/2023/06/learnings-from-kctf-vrps-42-linux.html) (Google, June 2023): the io_uring security data.
