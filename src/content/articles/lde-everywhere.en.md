---
deck: Run untrusted code at full speed, but keep the right to take control back. The recipe from chapter 6 reappears in hypervisors, microVMs, eBPF, WebAssembly and the Go runtime.
title: Limited direct execution, all the way up
---

::scene overview

In February 2020 the Go 1.14 release notes contained a sentence that could have come from chapter 6: “Goroutines are now asynchronously preemptible. As a result, loops without function calls no longer potentially deadlock the scheduler or significantly delay [[garbage-collection|garbage collection]].” Until then, Go’s scheduler had been cooperative. A [[goroutine|goroutine]] gave up its thread only at certain points in its code, and a tight loop could hold it indefinitely. It is the problem the book describes in early Macintosh systems, where the only cure for a program stuck in an infinite loop was to reboot. Go fixed it the same way operating systems did: with something that fires on a timer and takes control back, whether or not the running code agrees.

This is not a coincidence. Whenever a system wants someone else’s code to run fast *and* wants to stay in charge, it ends up rebuilding limited direct execution. This thread follows the recipe through [[hypervisor|hypervisors]], the kernel, your browser and your language runtime. At each layer the same questions come up, and the answers draw on almost every chapter of Part I.

::scene recipe

## The recipe

::chapter cpu-mechanisms

Chapter 6 solves two problems with three ingredients:

- **A restricted mode.** User code runs directly on the CPU, but privileged operations are refused. Trying one causes a trap.
- **Fixed entry points.** The only way into the kernel is through the trap table, which the kernel set up at boot. User code chooses *which* service, never *where* to jump.
- **A way to take control back.** A timer interrupt fires every few milliseconds, whatever the running code is doing, and hands the CPU to the OS.

Chapter 15 adds a fourth for memory: every address the program issues is checked and translated by hardware, so the program can only touch what the OS mapped for it. With these four in place, the OS can let a program run at full speed and still stay in control.

Step through the timer scenario in the lab below and watch the three lanes: OS, hardware, program. As you read on, place each new system on those lanes. Something always plays the program, which runs directly, and something plays the OS, which decides. The interesting question is what plays the hardware: the thing that guarantees control comes back.

::lab Lde

::scene trap-emulate

## One level down: the hypervisor

In 1974 Gerald Popek and Robert Goldberg asked when a machine can run a whole operating system as a guest. They required three things of a virtual machine monitor: *fidelity* (software behaves as it would on real hardware), *performance* (most instructions run directly, without the monitor) and *safety* (the monitor stays in charge of all resources). The classic way to meet them is **trap-and-emulate**, which is limited direct execution applied one level down. Run the guest kernel in user mode. When it tries a privileged instruction, the hardware traps to the monitor, which does the operation on the *virtual* machine’s state and returns.

For this to work, every instruction that touches privileged state must trap in user mode. For decades x86 failed this test. Keith Adams and Ole Agesen of VMware give the standard example, `popf`. In kernel mode it can change the interrupt-enable flag. In user mode it does not trap; it silently leaves that flag alone, so the monitor never learns that the guest kernel tried to disable interrupts. VMware worked around this with **binary translation**, rewriting guest kernel code on the fly so that problem instructions call into the monitor.

::scene vtx

Intel’s VT-x (2005) and AMD’s AMD-V (2006) fixed it in hardware. They added a new mode for the guest, with its own complete set of privilege levels, and an in-memory control block (VMCS on Intel, VMCB on AMD) that holds the guest’s CPU state and a list of the events that should hand control to the monitor. One instruction enters the guest. When a listed event happens, the hardware saves the guest’s state and returns to the monitor: a **VM exit**. The monitor emulates the operation and re-enters. The ingredients map one to one: guest mode is the restricted mode, the exit conditions are the trap table, and the monitor keeps its own timer and interrupts, which can force an exit whenever it needs the CPU back.

What exits matters a great deal. Here is part of Adams and Agesen’s 2006 measurements on a 3.8 GHz Pentium 4 672, in CPU cycles:

| operation | native | software VMM (binary translation) | hardware VMM (VT-x) |
|---|---|---|---|
| system call and return | 242 | 2,308 | 246 |
| `in` from an [[port-io|I/O port]] | 3,209 | 216 | 15,826 |
| [[page-fault|page fault]] | 1,093 | 3,927 | 11,242 |
| [[page-table|page-table entry]] write | 1 | 391 | 12,733 |

::scene shadow

The first row is the good news. A system call inside the guest is the *guest’s* limited direct execution, and the hardware lets it run directly: 246 cycles against 242 native. The rest is the bill: each other row in the hardware column is a VM exit. Port I/O exits so the monitor can emulate the device. Page faults and page-table writes exit because in 2006 the monitor had to maintain *shadow* page tables. The guest believed it controlled its own page tables (chapters 18 to 20), but the real [[mmu|MMU]] used a second copy that the monitor kept in sync, trapping every guest edit.

:::fold When the hardware was slower than software
Adams and Agesen’s paper (ASPLOS 2006) has a famous conclusion: on the first generation of VT-x, their hardware-assisted monitor was often *slower* than their software one. Their `forkwait` test creates and destroys 40,000 processes. Natively it took 6.0 seconds. Under the software VMM it took 36.9 seconds. Under the hardware VMM it took “a sobering 106.4 seconds.”

The reason is in the table above. Process creation is little more than page-table manipulation, and every one of those operations became an exit costing thousands of cycles. Binary translation, by contrast, could turn many privileged operations into a few ordinary instructions in the guest’s own address space. On one simple instruction, `rdtsc`, trap-and-emulate cost 2,030 cycles while binary translation emulated it in 216.

The paper’s lesson was that the expensive part of virtualization was memory, not the CPU, and that hardware should make page-table management cheaper rather than just making traps possible. That is what the next hardware generation did. [[nested-paging|Nested paging]], AMD first and then Intel’s Extended Page Tables with Nehalem in 2008, let the guest edit its own page tables without any exit.
:::

::scene nested

[[nested-paging|Nested paging]] has a price of its own, and it is a page-table price. The guest’s page tables map guest-virtual to guest-physical addresses. A second set, owned by the monitor, maps guest-physical to host-physical addresses. On a [[tlb|TLB]] miss the hardware has to walk both, which is why the TLB and [[huge-page|huge pages]] of [chapter 19](/virtualization/vm-tlbs) matter even more inside a VM.

:::fold Why a nested page walk can take 24 memory references
Take a four-level guest page table and a four-level nested table. A native walk reads four entries, one per level. In a VM each of those guest entries sits at a *guest-physical* address, which itself must be translated through the four-level nested table before the hardware can read it.

So for each of the four guest levels the hardware does a nested walk (4 references) and then reads the guest entry (1 reference). That is 4 × 5 = 20. At the end it has a guest-physical address for the data itself, which needs one more nested walk: 4 references. Total: 24, compared with 4 natively.

Bhargava, Serebrin, Spadini and Manne of AMD (ASPLOS 2008) set out exactly this “two-dimensional” walk and showed that the references are not all equally costly: many nested entries are reused, so page-walk caches can absorb much of the cost. This is chapter 20’s multi-level table meeting chapter 19’s TLB, multiplied.
:::

::scene firecracker

## Smaller and closer: microVMs

Hardware virtualization made VMs safe enough to sell. Firecracker, open-sourced by AWS in 2018, made them small enough to give one to each function. It is a virtual machine monitor written in Rust that uses Linux’s [[kvm|KVM]] and offers only a handful of devices. Since 2019 its published specification has promised at most 125 ms from the start command to the guest’s `/sbin/init`, and at most 5 MiB of memory overhead for the monitor, for a microVM with one [[vcpu|vCPU]] and 128 MiB of RAM on the reference hosts. The NSDI 2020 paper reports that it runs AWS [[serverless|Lambda and Fargate]].

The interesting part is how the layers nest. Guest code runs directly on the CPU. A VM exit lands in KVM, inside the host kernel. What KVM does not handle itself, such as device emulation, goes up to the Firecracker process, an ordinary user process. That process is confined in turn, by a *jailer* that gives it its own [[namespace|namespaces]] and [[cgroup|cgroups]] and drops privileges, and by [[seccomp|seccomp]] filters on each thread’s system calls. Every escape route leads into a more restricted place: limited direct execution stacked three deep.

::scene ebpf

## No trap at all: eBPF

[[bpf|eBPF]] turns the recipe inside out. Here the untrusted code is loaded *into* the kernel and runs at kernel privilege, attached to network hooks, [[tracepoint|tracepoints]] or, since Linux 6.12, the scheduler. No hardware boundary separates it from the kernel. A trap cannot catch a bad load, because there is nothing to trap into.

So the checking happens before the code runs. At load time the **verifier** checks the [[control-flow-graph|control-flow graph]], then simulates every possible path, instruction by instruction, tracking what each register and stack slot might contain. It rejects reads of uninitialized registers and stack slots, restricts pointer arithmetic, and checks that every memory access stays within an object of known size. A program can call only the helper functions the kernel exposes for its program type. That list is the trap table again: a fixed set of entry points, chosen by the kernel.

Termination is the hard part. For years the verifier simply rejected any program containing a loop. Linux 5.2 lifted the old cap of 4,096 instructions per program for privileged loaders, and Linux 5.3 accepted *bounded* loops, by simulating their iterations like any other path. The verifier gives up after processing one million instructions, so a program is accepted only if its every path can be explored within that budget. That proves it will terminate, with no timer needed.

:::fold Why a proof needs a budget
The [[halting-problem|halting problem]] says no general procedure can decide whether an arbitrary program terminates. The verifier does not try. It accepts only programs whose termination it can show by exploring every path. A loop that runs 100 times is explored as 100 copies of its body, so loops spend the budget quickly.

To stay inside one million instructions, the verifier *prunes*. When it reaches an instruction in a state that is covered by a state it already verified there, it stops exploring that branch. Liveness analysis helps, by ignoring registers and stack slots that will never be read again.

The cost falls on programmers. Safe programs get rejected when the verifier cannot prove them safe within its budget, and BPF developers learn to restructure code so the proof is easier to find. That is the trade-off of checking before running: execution is cheap, but some valid programs cannot be written.
:::

::scene sched-ext

Even a proof does not end the story. The **sched_ext** scheduler class in Linux 6.12 lets a BPF program decide which task runs next: the policies of chapters 7 to 9, written as loadable code. The verifier proves the scheduler cannot crash the kernel. It cannot prove the scheduler is any *good*. So the kernel keeps the right to take control back. If a runnable task stalls, if the BPF scheduler reports an error, or if an operator presses [[sysrq|SysRq-S]], the kernel aborts the BPF scheduler and moves every task back to the [[fair-class|fair-class scheduler]]. Proof covers safety. A [[watchdog|watchdog]] still covers [[liveness|liveness]].

::scene wasm

## In your browser: WebAssembly

[[webassembly|WebAssembly]] runs code from any web page at close to native speed, using both styles of control.

Before running a module, the engine **validates** it. Control flow is structured: branches can only target valid points inside the enclosing function, indirect calls are checked against the expected type signature, and the call stack lives outside the module’s memory, where a [[buffer-overflow|buffer overflow]] cannot reach it. Like the trap table, this means the code cannot jump to arbitrary addresses.

Memory is a single **linear memory**, and every access must fall inside it. That is [[base-bounds|base and bounds]] from [chapter 15](/virtualization/vm-mechanism), and [an old idea that never died](/notes/bounds-revival). On 64-bit hosts, engines often avoid checking each access in software. [[wasmtime|Wasmtime]], for example, documents an 8 GiB virtual reservation for a default 32-bit linear memory: 4 GiB for the memory itself, which is every address a 32-bit index can name, with 2 GiB of unmapped guard region on each side. An access outside the memory lands on an unmapped page. The MMU raises a page fault, the kernel delivers a [[signal|signal]], and Wasmtime’s signal handler turns it into a WebAssembly trap. The runtime borrows the operating system’s limited direct execution, and the page-fault path of [chapter 21](/virtualization/vm-beyondphys), to enforce its own.

::scene epoch

What validation does **not** prove is termination. A WebAssembly function can loop forever. A runtime that must stay in control needs the third ingredient back. Wasmtime offers two versions. *Fuel* charges for executed code and stops the guest deterministically when the budget runs out, at a higher cost. *Epoch interruption* inserts cheap checks of a counter that another thread increments on a timer. Its 2025 documentation puts that at about a 10% slowdown, and it is effectively a software timer interrupt. In a browser, the tab’s renderer is also an ordinary OS process, as in [the browser note](/notes/chrome-processes), so the kernel’s own timer is underneath it all.

::scene go

## Inside your program: language runtimes

Which brings us back to Go. Before 1.14 the runtime could switch goroutines only at compiler-inserted safe points, in practice function calls: chapter 6’s cooperative approach. A loop without calls never reached one, so it could stall garbage collection, which must stop every goroutine, or hang the program. Austin Clements’ 2019 design document records that checks on loop back-edges were too slow in tight loops; even a clever fault-based version cost a 7.8% geometric-mean slowdown on a large benchmark suite.

The fix was the non-cooperative approach. A background runtime thread, `sysmon`, watches for goroutines that have been running for longer than `forcePreemptNS`, which is 10 ms. It then sends a signal to the thread running that goroutine. The signal handler checks whether the goroutine is at a point where it can safely stop. If it is, the runtime switches to another goroutine; if not, it lets the goroutine resume and tries again later. The signal is `SIGURG`, chosen because debuggers pass it through, [[libc|libc]] does not use it, and a spurious delivery is harmless. Read that sequence against the book: a 10 ms time slice, an asynchronous interrupt, and a handler that saves state and switches. The runtime is acting as an operating system for goroutines, and the kernel’s signal delivery plays the role of the timer interrupt.

::scene pattern

## The pattern, side by side

| layer | runs directly | restricted by | control comes back via |
|---|---|---|---|
| process on an OS (ch. 6) | user code | user mode, trap table | timer interrupt |
| guest OS (VT-x, AMD-V) | the whole guest kernel | guest mode, exit conditions | VM exit, host interrupts |
| Firecracker microVM | guest code | KVM, then a jailed and seccomp-filtered VMM | VM exit into a restricted process |
| eBPF program | verified bytecode, [[jit|JIT-compiled]] | the verifier, helper list | proof of termination; sched_ext watchdog |
| WebAssembly module | validated code | validation, linear-memory bounds | guard-page faults, fuel or epochs |
| goroutine | compiled Go | the runtime’s scheduler | `sysmon` and `SIGURG` |

## Where it bends

Reading down the table, you can see two strategies, usually combined.

One is to **catch problems during execution**: traps, VM exits, guard-page faults, timers. This works for any code, but every catch costs something. Adams and Agesen’s table shows a VM exit costing thousands of cycles, and epoch checks cost Wasmtime about 10%. Even Go’s preemption had side effects. The release notes warn that programs now receive more signals, so slow system calls fail with [[eintr|`EINTR`]] more often and code has to retry them.

The other is to **check before execution**: the eBPF verifier, WebAssembly validation. Checked code runs with little or no supervision, but the check restricts what you can write, and it can only prove what it was built to prove. The eBPF verifier proves termination but not good scheduling. WebAssembly validation proves type and control-flow safety but not termination.

Every mature system here does both. eBPF verifies and keeps a watchdog. WebAssembly validates and relies on page faults and epochs. Firecracker uses hardware virtualization and still filters its own system calls. The book’s privilege bit plus a timer is the simplest point on this spectrum.

::scene overview

## The thread back to the book

The connections cover most of Part I. The process abstraction of [chapter 4](/virtualization/cpu-intro) is what each layer offers its guest: a virtual CPU that feels like the whole machine. Chapter 6 supplies the recipe. The time slices of [chapter 7](/virtualization/cpu-sched) reappear as Go’s 10 ms and as sched_ext policies. Chapter 15’s base and bounds survives as WebAssembly’s linear memory. The page tables of chapters 18 to 20 are walked twice under nested paging, and chapter 19’s TLB keeps that affordable. Chapter 21’s page fault is how a WebAssembly runtime catches an out-of-bounds access. And every crossing back to the supervisor has a cost, which [the note on system-call cost](/notes/syscall-cost) examines at the lowest layer.

The question at every layer is how you let someone run fast without giving them the keys. Every layer answers in two parts: restrict what the code can do directly, by hardware or by proof; then make sure that, whatever it does, control comes back.

## Further reading

- [Go 1.14 release notes](https://go.dev/doc/go1.14): asynchronous preemption, and the `EINTR` side effect.
- Austin Clements: [Proposal: Non-cooperative goroutine preemption](https://go.googlesource.com/proposal/+/master/design/24543-non-cooperative-preemption.md): why loop checks were too slow, and why `SIGURG`.
- Keith Adams, Ole Agesen: [A Comparison of Software and Hardware Techniques for x86 Virtualization](https://pdos.csail.mit.edu/6.1810/2019/readings/adams06vmware.pdf), ASPLOS 2006: `popf` and the nanobenchmarks.
- Ravi Bhargava et al.: [Accelerating Two-Dimensional Page Walks for Virtualized Systems](https://courses.physics.illinois.edu/ece598ms/fa2019/papers/paper223.pdf), ASPLOS 2008: the nested page walk, step by step.
- Alexandru Agache et al.: [Firecracker: Lightweight Virtualization for Serverless Applications](https://www.usenix.org/conference/nsdi20/presentation/agache), NSDI 2020; and the [Firecracker specification](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md).
- [eBPF verifier](https://docs.kernel.org/bpf/verifier.html): what is checked, and how pruning works.
- [Bounded loops in BPF for the 5.3 kernel](https://lwn.net/Articles/794934/) (LWN, July 2019).
- [Extensible Scheduler Class](https://docs.kernel.org/scheduler/sched-ext.html): including when the kernel takes scheduling back.
- [WebAssembly security](https://webassembly.org/docs/security/): validation, structured control flow and bounds-checked memory.
- [Wasmtime: interrupting Wasm execution](https://docs.wasmtime.dev/examples-interrupting-wasm.html), and its [architecture notes](https://docs.wasmtime.dev/contributing-architecture.html) on guard regions and traps.
