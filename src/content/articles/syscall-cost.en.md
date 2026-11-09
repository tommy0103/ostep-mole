---
deck: A system call is the book’s trap, and since 2018 each one has cost more. Here is where the time goes, and how vDSO, batching and io_uring cut the number of trips.
title: When the trap is too expensive: the price of a system call, and three ways around it
---

::scene overview

In January 2018 the [[spectre|Meltdown]] attack was made public, and within weeks Linux 4.15 shipped the fix: **[[kpti|kernel page-table isolation]]**, or KPTI. Soon after, Brendan Gregg, then at Netflix, published what it cost. The patches, he wrote, “introduce the largest kernel performance regressions I’ve ever seen.” A typical Netflix service would pay well under one percent. A worst case he built, with a high system-call rate and a large [[working-set|working set]], slowed down by more than 800%.

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

Everything else is software. The kernel’s entry code swaps in its [[per-cpu|per-CPU data]] with `swapgs`, parks the user stack pointer, switches [[page-table|page tables]] if KPTI is on, loads the kernel stack, and pushes every user register into a `struct pt_regs`: the “save registers to the kernel stack” box in the book’s Figure 6.2. On the way out, all of it runs in reverse.

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

The 54 ns figure is the *direct* cost: the cycles spent on the boundary itself. In 2010 Livio Soares and Michael Stumm showed that it is not the whole bill. Their FlexSC paper (OSDI 2010) measured user-mode [[instructions-per-cycle|instructions per cycle]] in a [[spec-cpu|SPEC]] benchmark around a single system call on an Intel Core i7. After the call returned, the program ran at a reduced rate for a while, as it refilled what the kernel had displaced: the [[pipeline|pipeline]], the [[cpu-cache|L1 caches]] and the [[tlb|TLB]]. Their conclusion was that synchronous system calls hurt performance “primarily because of pipeline flushing and pollution of key processor structures.”

Chapter 7 makes the same point about context switches: the price includes the warm state in caches and TLBs that the next piece of code has to rebuild. A trap is a small context switch, into the kernel and back, and pays the same indirect tax.

FlexSC’s remedy foreshadowed [[io-uring|io_uring]]: [[thread|threads]] wrote requests into [[shared-memory|shared memory]], and [[kernel-thread|kernel threads]] on other cores picked them up. The paper reports Apache up to 116% faster, MySQL up to 40% and BIND up to 105%, with no changes to the applications.

::scene kpti

## 2018: the price goes up

Meltdown let user code read kernel memory through speculative execution, as long as the kernel was mapped in the process’s page tables. Linux, like most kernels, mapped itself into every process, marked supervisor-only, so that a trap would not need to switch address spaces. KPTI removed that shortcut. Each process now has two sets of page tables: a full one for the kernel, and a user one that maps only the entry code needed to get in and out. Every system call, interrupt and exception switches [[cr3|`CR3`]], the page-table base register, on entry and again on exit.

::scene pcid

The kernel’s documentation puts writes to `CR3` “on the order of a hundred cycles.” That is the direct part. The larger part is indirect: a `CR3` write normally flushes the TLB, so without help every system call would throw away every cached translation. The help is x86’s **[[pcid|PCID]]**, process-context identifiers, which tag TLB entries so user and kernel translations can coexist. That story belongs to chapter 19 and has [its own note](/notes/pcid). The point here: with PCID, KPTI is a tax on each crossing. Without it, KPTI wipes out your TLB on every crossing.

:::fold How Gregg measured it, and how 800% happens
Gregg’s analysis ran on AWS instances with Linux 4.14, using a microbenchmark that varied the system-call rate and the working-set size separately. He listed five factors that set the overhead: system-call rate, context-switch rate, [[page-fault|page-fault]] rate, working-set size, and cache access pattern.

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

The **[[vdso|vDSO]]**, the virtual dynamic shared object, is the kernel’s answer. At every [[fork-exec|`execve()`]] the kernel maps a small [[elf|ELF]] library into the new process and announces its (randomized) address in the [[auxv|auxiliary vector]]. The [[libc|C library]] routes calls such as `clock_gettime()` to it instead of trapping; on x86-64 it exports `clock_gettime`, `gettimeofday`, `time` and `getcpu`. Next to the code sits a read-only data page where the kernel publishes the current clock parameters. The vDSO function reads that page, typically reads the CPU’s [[tsc|timestamp counter]], and does the arithmetic in user mode. In the [[man-page|man page]]’s words, the call “changes from a system call to a normal function call and a few memory accesses.”

This is still limited direct execution, with the limit moved: the process may *read* the kernel’s published values but not write them. If no fast path is possible, for example because the clock source cannot be read from user mode, the vDSO function quietly makes the real system call. The idea keeps spreading: Linux 6.11 added a vDSO `getrandom()` by Jason Donenfeld, who reported it “around 15x” faster for 32-bit values.

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

Numbers vary a lot with CPU, kernel, mitigations and virtualization, which is why it is worth measuring. In a VM whose clock source cannot be read through the vDSO, the “fast” path falls back to the trap.
:::

::scene surface

## Where it bends

Each strategy moves the cost somewhere else.

- **The vDSO works only for read-mostly data:** clocks, CPU numbers, now random bytes. It cannot help a call that changes kernel state.
- **Batching adds latency.** Waiting for 64 packets to send in one `sendmmsg()` makes the first one wait: response time traded for throughput, as with a longer time slice in chapter 7.
- **Polling burns a core.** An SQPOLL thread spinning on an idle ring occupies a CPU; the idle timeout is the compromise.
- **Shared memory is a larger attack surface.** A trap has one narrow, checked entry point. io_uring is a large asynchronous subsystem reading requests from memory the user can change at any moment. In June 2023 Google reported that 60% of the kernel [[exploit|exploits]] submitted to its kCTF bug bounty in the past year had used io_uring. It disabled io_uring on ChromeOS and its production servers, and uses a [[seccomp|seccomp-bpf]] filter so Android apps cannot reach it.

The last point is the book’s safety argument in reverse. Chapter 6 warns the kernel to treat user input with suspicion, and a trap is a good place to do it, because there is only one way in. Every design that bypasses the trap has to rebuild that suspicion elsewhere.

::scene overview

## The thread back to the book

The three strategies come down to two ideas from the book’s first chapters.

The first is amortization: if a fixed cost cannot shrink, spread it over more work, as chapter 7 does with time slices.

The second is the shape of limited direct execution itself. The vDSO turns “must not touch kernel state” into “may read it.” io_uring turns “must enter through the trap table” into “may leave a request in a queue the kernel agreed to watch.” The kernel keeps control in both cases; the boundary moves, and crossing it gets cheaper. The same tension between running directly and keeping control appears at every layer above the kernel, the subject of [the thread at the end of this chapter](/notes/lde-everywhere).

## Further reading

- [The current state of kernel page-table isolation](https://lwn.net/Articles/741878/) (LWN, December 2017): how KPTI splits the page tables.
- [Page Table Isolation (PTI)](https://docs.kernel.org/arch/x86/pti.html): the kernel’s own documentation, including its overhead section.
- [KPTI/KAISER Meltdown Initial Performance Regressions](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html) (Brendan Gregg, February 2018): the five factors, the measurements and the 800% case.
- [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html): what the vDSO exports on each architecture.
- [Ringing in a new asynchronous I/O API](https://lwn.net/Articles/776703/) (LWN, January 2019): io_uring’s design as first proposed, including SQPOLL and fixed buffers.
- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html): ring layout, head/tail ownership, and an example without liburing.
- Livio Soares, Michael Stumm: [FlexSC: Flexible System Call Scheduling with Exception-Less System Calls](https://www.usenix.org/conference/osdi10/flexsc-flexible-system-call-scheduling-exception-less-system-calls), OSDI 2010: the indirect cost of system calls, measured.
- [Learnings from kCTF VRP’s 42 Linux kernel exploits submissions](https://security.googleblog.com/2023/06/learnings-from-kctf-vrps-42-linux.html) (Google, June 2023): the io_uring security data.
