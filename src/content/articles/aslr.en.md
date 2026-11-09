---
deck: Virtual addresses are labels the OS hands out. ASLR hands them out at random, and that turns “where is it?” into a secret.
title: Because addresses are virtual, they can lie randomly
---

::scene overview

Chapter 13 ends with a small program, `va.c`, that prints three addresses: one in the code, one on the heap, one on the stack. The book’s run on a Mac printed `0x1095afe50`, `0x1096008c0` and `0x7fff691aea64`. Compile it on any current Linux or macOS machine and run it twice in a row. You will not get the book’s numbers. More interestingly, you will not get the same numbers twice.

Nothing is wrong with the program. The operating system is deliberately placing your code, heap, stack and [[shared-library|libraries]] at different virtual addresses every time a program starts. This is **address space layout randomization**, ASLR. It is one of the most widely deployed security defences there is, and it exists only because of the idea the chapter just taught you: the addresses a program sees are not real. If they are made up anyway, the OS may as well make them up differently each time.

## Why randomize at all

::scene why

Chapter 14 lists the ways C programs get memory wrong: [[buffer-overflow|buffers overrun]], [[use-after-free|memory used after `free()`]], pointers that were never initialized. These are not just crashes. In the hands of an attacker, a memory bug is often a way to overwrite a pointer the program will later follow: a [[return-address|return address]] on the stack, a [[function-pointer|function pointer]] in a heap object. The [memory-safety note](/notes/memory-safety) covers how common these bugs are.

Overwriting a pointer only helps an attacker who knows what to overwrite it *with*. To redirect a program they need the address of something useful: their own data, a function in the [[libc|C library]], a sequence of instructions already in memory. In the early 2000s that was easy. On a given Linux distribution the C library loaded at the same address in every process on every machine. An [[exploit|exploit]] written once worked everywhere.

::scene guess

ASLR attacks that assumption rather than the bug. The bug is still there and the overwrite still happens, but the attacker no longer knows which address to write. A wrong guess usually crashes the process instead of handing it over. ASLR does not make programs correct. It makes one large class of attacks require an extra piece of information, and buys time.

The idea came from the [[pax|PaX]] project, a set of Linux hardening patches, in 2001. Mainline Linux turned on randomization of the stack and memory-mapped regions by default in 2.6.12 in 2005. Windows Vista, macOS, iOS and Android all followed with their own versions over the next several years.

## What moves

::scene regions

ASLR is not one mechanism but a decision, made region by region, about where the kernel places each part of a new address space. On Linux:

| region | where it comes from | randomized |
|---|---|---|
| stack | set up by the kernel at `exec` | yes |
| memory-mapped region | shared libraries, [[mmap|`mmap()`]], large [[malloc|`malloc()`]]s | yes, from a random base |
| heap ([[brk|`brk`]]) | the classic heap that grows up after the program | yes, at setting 2 |
| program code and data | the executable itself | only if it is built position-independent ([[pie|PIE]]) |
| [[vdso|vDSO]] | the kernel’s user-space helper page | yes |
| the kernel itself | kernel code and data | yes, with [[kaslr|KASLR]] |

The system-wide switch is the [[sysctl|sysctl]] `kernel.randomize_va_space`. 0 turns randomization off, 1 randomizes the stack, the vDSO and the mmap base, and 2, the usual default, also randomizes the start of the heap. You can read it with [[proc-sys|`cat /proc/sys/kernel/randomize_va_space`]].

::scene virtual

Notice what the table assumes. Each region can go anywhere because, as chapter 13 put it, every address you see is virtual. The [[page-table|page table]] maps whatever virtual address the kernel picked to whatever [[page-frame|physical frames]] happen to be free. The program cannot tell the difference, and neither can the physical memory.

::lab AddressSpace

In the lab, three processes each believe they own the same tidy address space while their pages are scattered across physical memory. ASLR adds one more layer to that picture. Run the same program twice and even the *virtual* layout differs between the two runs, while each run still sees one consistent address space of its own.

:::fold How much randomness is there?
::scene entropy

“Random” only helps if there are enough possible positions. On [[x86-64|x86-64]] Linux the base of the memory-mapped region is shifted by a random number of [[page|pages]]. Since 2016 the number of random bits is a tunable, `vm.mmap_rnd_bits`, whose minimum and default on 64-bit x86 is 28. Twenty-eight bits of page-sized steps is 2^28^ × 4 KiB = 1 TiB of possible placements. A guess has roughly one chance in 268 million of being right.

The number is a compromise, and the kernel commit that made it tunable says so. More bits spread mappings over more of the address space and leave less room for large contiguous allocations. On a 64-bit machine with 128 TiB of user address space that costs little. On 32-bit systems it was a real problem. There the mmap base had only 8 bits of randomness, 256 positions. In 2004 Shacham and colleagues showed that against a server that restarts after crashes, 256 positions can simply be tried one by one in minutes. Much of ASLR’s reputation as a weak defence comes from that 32-bit era.

Randomness also degrades with alignment. A region that must be [[alignment|aligned]] to 2 MiB, as [[huge-page|huge pages]] are (see the [huge-pages note](/notes/huge-pages)), has 512 times fewer possible positions in the same range than one aligned to 4 KiB.
:::

## PIE: the piece that was missing

::scene pie

For years one row of that table stayed fixed: the program itself. Libraries had always been compiled as **position-independent code**, because a shared library has to work at whatever address it is loaded. Its instructions refer to data and functions relative to the current instruction, never by absolute address. Ordinary executables were compiled for one fixed address. They were linked to load at the same place every time, so their code was an ideal fixed landmark however well everything else was shuffled.

The fix was to build executables the same way: position-independent executables, PIE. On 32-bit x86 this had a measurable cost, because the architecture had no cheap way to address data relative to the instruction pointer and had to give up one of its few registers to fake it. [[x86-64|x86-64]] added instruction-pointer-relative addressing, which made the cost small. In the second half of the 2010s the major Linux distributions switched their compilers to build PIE by default. Today, on a current distribution, the main program moves along with everything else.

This is chapter 15’s distinction between [[relocation|static and dynamic relocation]], replayed. Code that refers to absolute addresses has to be patched or pinned to move. Code that refers to everything relative to a base can be put anywhere. The [[base-bounds|base-and-bounds]] hardware of that chapter achieved this with a register. PIE achieves it in the instruction encoding.

## The kernel hides too

::scene kaslr

The kernel is the most valuable target in the machine, and for a long time it sat at a fixed virtual address in every process’s address space. **KASLR**, kernel address space layout randomization, chooses a random offset for the kernel image at boot. It was merged for x86 in Linux 3.14 in 2014 and switched on by default for x86 in 4.12 in 2017. A related option randomizes the bases of the kernel’s other large regions, such as the [[direct-map|direct map]] of physical memory.

The kernel has less room to hide in than a process. Its image must sit in a limited window of the address space, at a large alignment, so there are far fewer possible positions. Worse, the kernel is mapped into every process’s address space. Even though user code cannot *read* kernel memory, the hardware still has to translate kernel addresses, and translation leaves traces.

:::fold KASLR, side channels, and how Meltdown’s fix was born
::scene kpti

A user program cannot read a kernel page, but it can time how long an access to a kernel address takes to fail. Mapped and unmapped kernel addresses can fail at measurably different speeds, depending on whether the translation exists, is cached in the [[tlb|TLB]], or needs a [[page-walk|page-table walk]]. Several published attacks between 2013 and 2016 used such [[side-channel|timing differences]], through [[prefetch|prefetch instructions]] or Intel’s [[tsx|transactional memory extensions]], to find the kernel’s random offset in seconds.

In May 2017 researchers at Graz University of Technology proposed a structural fix called **[[kpti|KAISER]]**. Their argument was that if the kernel is not mapped while user code runs, there is nothing to time. They kept almost all kernel mappings out of the page tables used in user mode, leaving only the small piece of entry and exit code needed to switch over. Their paper was titled, fittingly, *KASLR is Dead: Long Live KASLR*.

Months later, [[spectre|Meltdown]] was disclosed. Meltdown let user code read kernel memory through speculative execution, as long as that memory was mapped. KAISER’s separation was exactly the remedy, and it was merged into Linux in early 2018 as **page-table isolation** (KPTI). A defence designed to protect a random number became the emergency fix for one of the decade’s largest hardware vulnerabilities. Its performance cost, and how [[pcid|address-space identifiers]] recovered most of it, is the story of the [PCID note](/notes/pcid).
:::

## Where it bends

ASLR raises the cost of an attack. It does not close the hole, and the ways it falls short are instructive.

::scene leak

**A region moves as a unit.** Randomization picks a base for each region. Inside the region, everything sits at the same offset from the base as always: the C library’s functions are at fixed distances from its start. So the secret is not hundreds of independent addresses but a handful of bases. If a program ever reveals a single pointer into a region, through a log line, an uninitialized buffer, or any of chapter 14’s bugs, the whole region’s layout follows by subtraction. That is why defenders treat an *information leak* as a serious vulnerability even when it leaks “only” an address. Against a real attacker, ASLR usually holds exactly as long as no address leaks.

::scene fork

**Copies share a layout.** Randomization happens at `exec`, when a new address space is built. `fork()` copies the address space, layout included. Chapter 5 explained why that is the point of fork. A server that forks a child per connection therefore hands every child the same “random” layout. A crash in one child reveals something about all the others, and the server restarts the child for the next attempt. Android’s [[zygote|zygote]], a pre-initialized process that forks every new app for speed, raised the same concern: all apps shared the zygote’s layout. A 2014 paper on this problem proposed preparing a pool of independently started template processes, so that each app gets its own layout without paying the full startup cost at launch. Chrome’s Linux zygote, described in the [Chrome note](/notes/chrome-processes), faces the same trade-off between fast startup and fresh layouts. The general lesson is that randomness is renewed only when something re-randomizes it.

::scene hardware

**The hardware remembers.** Every memory access goes through address translation, and translation uses caches: the [[tlb|TLB]], and ordinary [[cpu-cache|data caches]] that hold page-table entries during a [[page-walk|walk]]. Those caches are shared, and their timing is observable. In 2017 researchers at VU Amsterdam showed in *ASLR on the Line* that JavaScript in a web page could measure which page-table entries the processor’s page walks touched. From that it could recover code and heap addresses protected by 28 bits of randomness in about 150 seconds, on every modern processor family they tested. Their conclusion was blunt: ASLR should not be trusted as a first line of defence against memory errors.

::scene debug

**Debuggers turn it off.** One practical side note: when you run a program under [[gdb|`gdb`]], randomization is disabled by default so that addresses repeat between runs and breakpoints stay meaningful. The `setarch -R` command does the same for any program you start through it, using the `ADDR_NO_RANDOMIZE` [[personality|personality]] flag. If addresses in a debugging session look suspiciously stable, that is why.

## What is left, and what replaces it

::scene replace

None of this makes ASLR useless. It is nearly free at run time, it is on by default everywhere, and it turns many bugs that would have been reliably exploitable into crashes. Every serious exploit chain today has to spend effort on an information leak or a [[side-channel|side channel]] just to get started. That is real value for a few random bits.

But the direction of modern defences is clear. Randomization hides where things are. The newer mechanisms check what a pointer may do:

- **[[stack-canary|Stack canaries]]** put a random value between local buffers and the return address and check it before returning. That is randomness again, but verified at use.
- **Control-flow integrity** limits indirect jumps and calls to targets the compiler knows are legitimate.
- **Pointer authentication** (Arm) signs pointers with a key the attacker cannot read, using spare high bits of each 64-bit address.
- **[[memory-tagging|Memory tagging]]** and [[cheri|capability hardware]], covered in the [bounds note](/notes/bounds-revival), attach checks to every pointer.
- **[[memory-safety|Memory-safe languages]]** remove most of the bugs in the first place.

Each of these leans on the same fact ASLR does. A 64-bit virtual address space is vast and mostly empty, and the OS and hardware control what every address means.

::chapter vm-intro

## The thread back to the book

::scene overview

Chapter 13 sets the goal of virtual memory as giving each process the illusion of a large, private, contiguous address space starting at zero. Chapter 15 shows the first way to build that illusion: relocation, a base register added to every address. ASLR is relocation with the base chosen by dice. Nothing in the hardware changed to make it possible. The OS simply stopped choosing the same numbers.

That is the deeper lesson about indirection that runs through this part of the book. Once every name a program uses goes through a translation the system controls, the system can change what the names mean without the program noticing. It can move memory (paging, swapping), share it (copy-on-write, shared libraries), compress it, or, as here, scramble it. ASLR is the security community noticing that a layer of indirection is also a place to hide.

## Further reading

- [kernel.randomize_va_space and related sysctls](https://docs.kernel.org/admin-guide/sysctl/kernel.html): the Linux documentation of the system-wide switch.
- [x86: mm: support ARCH_MMAP_RND_BITS](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=9e08f57d684ac2f40685f55f659564bfd91a971e) (2016): the commit that made mmap randomness tunable, and the trade-off it describes.
- [ASLR on the Line: Practical Cache Attacks on the MMU](https://www.ndss-symposium.org/ndss2017/ndss-2017-programme/aslrcache-practical-cache-attacks-mmu/) (Gras et al., NDSS 2017).
- [Linux 4.12 to enable KASLR by default](https://www.phoronix.com/news/KASLR-Default-Linux-4.12) (Phoronix, 2017).
- Daniel Gruss et al.: *KASLR is Dead: Long Live KASLR*, ESSoS 2017. The KAISER design that became KPTI.
- Hovav Shacham et al.: *On the Effectiveness of Address-Space Randomization*, ACM CCS 2004. Why 32-bit ASLR was weak.
