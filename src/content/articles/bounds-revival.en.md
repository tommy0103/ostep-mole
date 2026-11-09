---
deck: Chapter 15’s simplest mechanism lost the job of managing memory. It kept a second job, drawing a boundary that one comparison can enforce, and it now shows up in browsers, in the kernel and in new hardware.
title: Base and bounds never really died
---

::scene overview

The [[webassembly|WebAssembly]] specification describes what a load instruction does in a few numbered steps. One of them reads, in effect: *if i + offset + N/8 is greater than the length of the memory, trap.* Here *i* is the address the program computed, *offset* is a constant in the instruction, and *N* is the access width in bits. It is chapter 15’s bounds register check, written into a web standard. WebAssembly 3.0 was finished in September 2025 and still has it.

Chapter 15 presents base and bounds as the first, crude form of address translation, and moves on because it wastes memory and gives a process only one contiguous region. Both criticisms are true. But they are criticisms of base and bounds as the way to build *virtual memory*. As a way to draw a *boundary*, one region and one comparison, it has never stopped being useful. This article follows it through software [[sandbox|sandboxes]], WebAssembly, the Linux kernel’s [[bpf|eBPF]] verifier, a failed Intel extension and the [[cheri|CHERI]] research architecture.

## What the book’s version gets right

::chapter vm-mechanism

::scene mmu

The book’s hardware keeps two registers per CPU. On every memory reference it checks the virtual address against **bounds** and adds **base**:

> if (va ≥ bounds) raise exception; else pa = base + va

That is one comparison and one addition, done in parallel with everything else. The OS can move the process by changing base, and the process cannot tell. The idea is cheap, simple to verify, and has no tables to walk and no per-page state.

::scene inside

Its weaknesses all come from asking it to do too much: describe a whole address space with one region. Ask it instead to fence off one region *inside* an address space that paging already manages, and the weaknesses go away. The region can be as large as you like, because paging decides what is actually backed by memory.

::scene mmu

::lab BaseBounds

Things to try:

- Pick “Out of bounds”. The address is 17 KB, the bounds are 16 KB, and the MMU raises an exception before it ever adds the base. Every system in this article implements this one red box.
- Drag the base while the address stays fixed. The physical address changes and the virtual one does not. A WebAssembly runtime does the same when it places a module’s memory anywhere in the host’s address space.
- Shrink bounds to 4 KB and try “Stack top”. The same program is now out of bounds. In WebAssembly the bound is the memory’s current size, and growing memory just raises it.

The lab is the book’s simplified MMU: one region, bounds stored as a size, checked before the add.

## Software builds its own bounds register

::scene sfi

The book’s reference list for chapter 15 includes a 1993 paper by Wahbe, Lucco, Anderson and Graham, *Efficient Software-based Fault Isolation*. Its idea was to get base-and-bounds-style protection without hardware: have the compiler rewrite every store and jump so that the address is forced into the sandbox’s region before use, for example by masking off its top bits. Untrusted code could then run inside the same address space as its host, with no system call or context switch at the boundary.

::scene nacl32

Google’s [[nacl|Native Client]] (NaCl) brought this idea to the browser at the end of 2008. On 32-bit x86 it did not need to mask addresses at all, because x86 still had real [[segmentation|segments]] with limits, and NaCl simply set up segments that covered only the sandbox. That is base and bounds in hardware, used as the book describes.

::scene nacl64

When NaCl moved to [[x86-64|x86-64]] it lost that tool. In 64-bit mode x86 ignores segment limits, a story told in the [note on FS and GS](/notes/fs-gs). The 2010 NaCl paper describes the replacement: the module’s memory is an aligned 4 GB region, a reserved register (`r15`) holds its base, every address is formed as that base plus a 32-bit offset, and the region is flanked above and below by 40 GB of unmapped address space to catch anything that slips past. The average overhead was 7% on x86-64. The bounds check had moved from a segment register into the [[page-table|page table]].

## WebAssembly: bounds as the size of linear memory

::scene wasm

WebAssembly, which took over NaCl’s role in browsers, makes the same structure part of the language. A module gets a **linear memory**: one contiguous, resizable array of bytes. Addresses in the module are indexes into that array. The engine decides where the array lives in the host’s address space (the base) and tracks its current size (the bounds). Every access is checked against the size, and an out-of-range access [[wasm-trap|traps]] instead of touching the host.

An engine can implement that check in two ways:

```text
; pseudo-code: one 4-byte load of memory[i + 16]

; (a) explicit check, like the book's MMU
    lea   t, [i + 16 + 4]
    cmp   t, mem_size
    ja    trap
    mov   eax, [mem_base + i + 16]

; (b) guard region: no compare, no branch
    mov   eax, [mem_base + i + 16]   ; i is a zero-extended 32-bit value
                                     ; an out-of-range access hits unmapped
                                     ; pages and the fault becomes a trap
```

::scene guard

Option (b) is the one 64-bit engines prefer for ordinary 32-bit memories. [[wasmtime|Wasmtime]], for example, by default reserves 4 GiB of virtual address space for each such memory and adds a 32 MiB guard region after it. Only the first *size* bytes are mapped accessible. Everything else in the reservation is not, so an out-of-range access causes a [[page-fault|page fault]]. The engine’s [[signal|signal]] handler sees that the fault came from WebAssembly code and turns it into a WebAssembly trap. The bounds register is the page table, and the bounds check is the hardware’s ordinary page-fault path. Growing the memory changes page protections inside the reservation and moves nothing.

:::fold Why 4 GiB plus a guard is enough
With 32-bit indexes, the effective address of a load is:

> ea = base + i + offset, with 0 ≤ i < 2^32^ and offset a constant from the instruction

So *ea* − *base* is at most 2^32^ − 1 + offset, plus the access width. Reserve 4 GiB starting at *base*, followed by a guard of *G* bytes, and every access whose static offset is below roughly *G* lands somewhere inside the reservation or guard. Only the bytes below the memory’s current size are accessible. All other addresses fault.

Wasmtime’s defaults on 64-bit hosts are a 4 GiB reservation and a 32 MiB guard. Its documentation says this removes almost all bounds checks on loads and stores with a static offset under 32 MiB. For a larger offset, the compiler emits an explicit check.

The costs are virtual address space and a dependence on signals:

- Each memory costs gigabytes of address space, even if it uses one page. A 64-bit host has 128 TiB or more of user address space, so this is affordable, but not unlimited. [[nodejs|Node.js]] describes [[v8|V8]]’s version as a “virtual memory cage” of about 10 GB, and offers a `--disable-wasm-trap-handler` flag for environments with restricted virtual memory. It switches back to explicit checks.
- On 32-bit hosts there is no room for the trick. Wasmtime’s default reservation there is 10 MiB, and every access is checked explicitly.
:::

::scene memory64

**Memory64** shows the limit of the guard-region trick. WebAssembly 3.0 lets a memory use 64-bit addresses instead of 32-bit ones. No reservation can cover a 2^64^ range, so Wasmtime’s documentation states that 64-bit linear memories always need bounds checks. On the web, a 64-bit memory is capped at 16 GB. The check goes back to the form in the book: a compare and a branch on every access, which a compiler can sometimes hoist out of a loop.

## eBPF: bounds proved before the program runs

::scene ebpf

The Linux kernel runs small user-supplied programs, eBPF, inside the kernel’s own address space. There is no sandbox region here at all. Instead, before a program is loaded, the **verifier** proves that every memory access stays inside the object it points to.

To do that it tracks, for every register, what kind of pointer it is and what values it might hold: unsigned and signed minimum and maximum, and a *tnum*, a mask of which bits are known. A network packet is a base (`data`) and an end (`data_end`), and a program may read a packet byte only after it has compared the address against the end. This example is from the kernel’s verifier documentation:

```text
4:  r5 = r3          ; r3 points to the start of the packet
5:  r5 += 14
6:  if r5 > r4 goto pc+16    ; r4 = data_end
; fall-through: the verifier now knows bytes [r3, r3 + 14) are safe
```

On the fall-through path the verifier records that 14 bytes after `r3` are safe to read, so a 2-byte load at offset 12 is accepted and one at offset 14 is rejected. This is base and bounds, but the check is done once, symbolically, at load time, and the program carries the comparison as an ordinary branch.

[[speculative-execution|Speculative execution]] added a twist. A CPU can run past a mispredicted bounds branch, so for unprivileged programs the verifier also rewrites pointer arithmetic to mask the offset, so that an access cannot leave its object even speculatively. The comparison in the program alone was no longer enough.

## Bounds in every pointer: MPX

::scene mpx

All of the above give a whole *region* one boundary. C bugs, as in the [memory-safety note](/notes/memory-safety), are about overflowing one *object* into its neighbour inside the same region. To catch those, every pointer needs its own base and bounds.

Intel tried to do this in hardware with **Memory Protection Extensions** (MPX), which shipped with Skylake processors in 2015. MPX added four 128-bit bounds registers, `bnd0`–`bnd3`, each holding a lower and an upper bound, and instructions to make bounds (`bndmk`), check a pointer against them (`bndcl`, `bndcu`) and save or load them (`bndstx`, `bndldx`). Since only four bounds fit in registers, the bounds of pointers stored in memory went into **bounds tables**, found through a **bounds directory**, a two-level structure that its evaluators compared to a page table.

MPX was dead within five years. [[gcc|GCC]] removed its support in GCC 9 in 2019. Linux removed the kernel side over the 5.4 and 5.6 releases; the commit message cites “a lack of support in the toolchain going forward”.

:::fold Why MPX failed
A 2017–2018 evaluation by Oleksenko, Kuvaiskii, Bhatotia, Felber and Fetzer (“Intel MPX Explained”) found an average performance overhead of about 50%. Its design had problems that a faster implementation could not fix:

- **Bounds lived apart from pointers.** A pointer and its bounds-table entry were written by separate instructions, so another thread could see one updated without the other. The evaluation found false positives and false negatives in multithreaded code.
- **Memory.** The kernel allocated bounds tables on demand when a bounds store hit an empty directory entry. Linux’s MPX documentation warned that in the worst case the tables could be four times the size of the data they described.
- **Unchecked code removed protection.** A pointer that passed through code built without MPX came back with no bounds. If the memory allocator was not [[instrumentation|instrumented]], every heap pointer was unbounded, making the protection useless.
- **No temporal safety.** MPX checked where a pointer pointed, not whether the object was still alive. [[use-after-free|Use-after-free]] was out of scope.
- **Memory-layout restrictions.** By default MPX restricted the memory layouts a program could use, and 8–13% of the programs tested did not run correctly without substantial code changes. Bugs in the supporting compilers and libraries stopped another 3–10% from compiling or running at all.

The lesson that later designs took: bounds must travel *with* the pointer, atomically, and the hardware must be able to tell a real pointer from an integer that looks like one.
:::

## Bounds in every pointer, done properly: CHERI

::scene cheri

**CHERI** (Capability Hardware Enhanced RISC Instructions), a research project of SRI International and the University of Cambridge with DARPA funding since 2010, is the design that took that lesson. A CHERI pointer is a **capability**: twice the width of an ordinary pointer, so 128 bits on a 64-bit machine. It holds a 64-bit address plus compressed metadata: **bounds**, **permissions** (load, store, execute and others) and an object type. Each capability-sized word of memory also has a **1-bit validity tag**, stored out of band where software cannot write it directly.

The hardware enforces a few rules:

- Every load and store through a capability is checked against its bounds and permissions. That is the book’s bounds check, for each pointer.
- **Monotonicity**: a new capability can be derived from an existing one, but only with equal or smaller bounds and permissions. `malloc` takes a capability for the whole heap, narrows it to the exact allocation, and returns that. The caller cannot widen it again.
- **Provenance**: the tag is set only when a capability is produced from a valid capability by a capability instruction. Overwriting any of its bytes with ordinary data clears the tag, and an untagged capability cannot be used. A pointer can no longer be forged from an integer.

These rules solve the problems that sank MPX. Bounds and address are one 128-bit value written by one instruction. An uninstrumented path cannot quietly drop the bounds, because a value without a valid tag cannot be dereferenced.

CHERI also keeps one bounds register from the book. For code not compiled for capabilities, a special **default data capability** (DDC) constrains every ordinary integer-addressed load and store. That is a base-and-bounds register for an entire legacy compartment, the chapter 15 mechanism with permissions attached.

Arm built the architecture into silicon. The **Morello** board, released in January 2022 under the UK’s Digital Security by Design programme, uses a modified quad-core Neoverse N1 at 2.5 GHz. It runs CheriBSD, a FreeBSD-based system where ordinary C and C++ programs are recompiled so that every pointer is a capability. Morello is a research prototype, not a product, but it showed that capabilities can be added to a mainstream 64-bit core and carry a complete operating system and its applications.

:::fold What a capability looks like
Here is the 128-bit format from the CHERI introduction, simplified (field widths vary by architecture):

| part | contents | where it lives |
|---|---|---|
| address | 64-bit virtual address: what an ordinary pointer holds | in the 128-bit word |
| bounds | base and top, compressed relative to the address | in the 128-bit word |
| permissions | load, store, execute, load/store capabilities and more | in the 128-bit word |
| object type | if set, the capability is *sealed*: it cannot be changed or dereferenced, only passed on | in the 128-bit word |
| validity tag | 1 bit: is this a real capability? | out of band, one per 128-bit granule |

Compressing the bounds is what makes 128 bits enough. Like a floating-point number, the encoding is exact for small objects and requires larger objects to be suitably aligned, so allocators round big allocations up a little. That is a mild version of the internal fragmentation the book blames on base and bounds.

CHERI on its own gives spatial safety. Temporal safety, preventing use-after-free, needs extra software. CheriBSD has a mechanism that finds and revokes capabilities to freed memory before that memory is reused, and the CHERI introduction lists non-stack temporal memory safety for user space among CheriBSD’s properties.
:::

## Where each version draws the line

::scene table

| system | what the bounds cover | where the bound lives | who checks | when |
|---|---|---|---|---|
| book’s MMU | a whole process | bounds register | hardware | every access |
| NaCl x86-32 | a sandbox | segment limit | hardware | every access |
| NaCl x86-64, Wasm32 with guard | a sandbox | unmapped pages in the page table | hardware, via page fault | every access |
| Wasm memory64 | a sandbox | a size kept by the runtime | compiled compare and branch | every access |
| eBPF | each object a pointer refers to | verifier’s register state | kernel verifier | once, before loading |
| Intel MPX | each pointer | bounds registers and tables | compiled check instructions | [[instrumentation|when instrumented]] |
| CHERI | each pointer | inside the 128-bit capability | hardware | every access |

Read down the table and the trade-off is visible. The coarser the boundary, the cheaper it is to check, down to the zero-instruction guard region. The finer the boundary, the more bugs it catches, and the more it costs, until CHERI moves the bound into the pointer and pays with wider pointers and new hardware.

## The thread back to the book

::scene inside

Chapter 15 introduces base and bounds and then lists its problems: one contiguous region per process, and wasted space inside it. Chapter 16 fixes the first by giving each segment its own base and bounds, and chapter 18 replaces both with pages. That is the right history for *virtual memory*.

But a protection boundary is a different job. The book’s aside on software relocation cites the 1993 software fault isolation paper, and the systems in this article are what came of it: a boundary that one comparison can enforce, nested inside paging rather than replacing it. Seen this way, CHERI is chapter 16’s fine-grained segmentation, with a segment for every C object, arriving half a century after [[multics|Multics]] and the Burroughs machines first tried something like it.

Base and bounds lost one job and kept another. Variable-sized regions are hard to *allocate*, as [the fixed-versus-variable note](/notes/fixed-vs-variable) explains. They are easy to *check*.

## Further reading

- [WebAssembly core specification](https://webassembly.github.io/spec/core/exec/instructions.html), execution of memory instructions: the bounds rule quoted at the top.
- [Wasm 3.0 completed](https://webassembly.org/news/2025-09-17-wasm-3.0/) (Andreas Rossberg, September 2025): memory64 and the 16 GB web limit.
- [Wasmtime `Config` documentation](https://docs.wasmtime.dev/api/wasmtime/struct.Config.html): `memory_reservation` and `memory_guard_size`, and when bounds checks can be elided.
- David Sehr et al., [*Adapting Software Fault Isolation to Contemporary CPU Architectures*](https://www.scs.stanford.edu/~zyedidia/docs/papers/nacl2.pdf), USENIX Security 2010: NaCl on x86-64 and ARM.
- Robert Wahbe, Steven Lucco, Thomas E. Anderson, Susan L. Graham: *Efficient Software-based Fault Isolation*, SOSP 1993. This is the book’s [WL+93].
- [eBPF verifier](https://docs.kernel.org/bpf/verifier.html), Linux kernel documentation: register bounds tracking and the packet-access example.
- Oleksii Oleksenko et al., [*Intel MPX Explained*](https://intel-mpx.github.io/), SIGMETRICS 2018 (also [arXiv:1702.00719](https://arxiv.org/abs/1702.00719)).
- [Intel MPX](https://docs.kernel.org/5.5/x86/intel_mpx.html), Linux 5.5 kernel documentation: how the kernel managed bounds tables, shortly before removal.
- Robert N. M. Watson, Simon W. Moore, Peter Sewell, Peter G. Neumann, [*An Introduction to CHERI*](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-941.html), Cambridge technical report UCAM-CL-TR-941, 2019.
- [CHERI project page](https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/) (Cambridge) and the [Morello programme](https://www.morello-project.org/).
