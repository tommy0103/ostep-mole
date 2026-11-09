---
deck: In 2018 Meltdown forced kernels to switch page tables on every system call. A 12-bit tag in each TLB entry, the address-space identifier from chapter 19, is what kept that from flushing the TLB thousands of times a second.
title: How ASIDs saved Meltdown’s performance
---

::scene overview

On 7 January 2018, four days after [[spectre|Meltdown]] became public, Gil Tene posted a short note to the mechanical-sympathy mailing list. A CPU feature called [[pcid|PCID]], he wrote, “used to be a virtual no-op” and had become “a performance AND security critical item”. He suggested a check anyone could run, [[proc-sys|`grep pcid /proc/cpuinfo`]], and reported that most of the Linux instances he had looked at did not show the flag, even though all of them ran on modern hardware.

PCID is the address-space identifier of chapter 19 under another name. This piece explains why a tag on TLB entries, which the book introduces as an optimisation for context switches, suddenly decided how much a security fix would cost on every server in the world.

::scene asid

## The book’s ASID, and the question it left open

::chapter vm-tlbs

Chapter 19 poses a problem. The TLB caches translations for the running process. After a context switch those translations belong to someone else. The simple fix is to flush the TLB on every switch, which is correct and slow, because every process then starts with a cold TLB.

The better fix is an **address space identifier (ASID)**: a few bits in each TLB entry that say which address space the entry belongs to. The hardware compares the tag along with the virtual page number, so translations from several processes can sit in the TLB at once. The MIPS TLB entry in the chapter has an 8-bit ASID, and the chapter ends that section with a question: what should the OS do if more than 256 processes are running?

x86 gained the same mechanism late, in Intel’s Westmere generation around 2010, under the name **Process-Context Identifier (PCID)**. For years Linux did not use it. Context switches happen perhaps hundreds or thousands of times a second, and flushing on each was a cost people had learned to live with. What changed in 2018 was that the kernel suddenly needed a TLB-flushing operation on every entry into the kernel and every exit from it.

::scene shared

## What Meltdown broke

Until 2018, every mainstream kernel mapped itself into the address space of every process. The kernel’s pages sat in the upper half of each page table, marked supervisor-only, so a user program could not read them, but a system call or interrupt did not need to switch page tables. A trap ([chapter 6](/virtualization/cpu-mechanisms)) only changed the privilege level. The kernel’s translations were also marked **global**, a bit that tells x86 to keep a TLB entry even when [[cr3|CR3]], the register that points at the page table, is reloaded. Kernel translations therefore survived context switches as well.

::scene meltdown

Meltdown (Lipp et al., USENIX Security 2018) showed that on many Intel processors the permission check could be outrun. A user program issues a load from a kernel address. The CPU executes it [[speculative-execution|speculatively, out of order]], and uses the value in later instructions before it raises the fault. The fault discards the register results, but not the traces left in the cache, and a timing measurement recovers the stolen byte. In the paper’s words, Meltdown can “read arbitrary kernel-memory locations”. Nothing was wrong with the page-table permissions. The leak happened because the kernel was mapped at all.

The fix therefore had to unmap the kernel while user code runs. It was already written. In 2017 Daniel Gruss and colleagues had published **KAISER**, a design that keeps the kernel out of user page tables in order to protect [[kaslr|KASLR]] from [[side-channel|side channels]]. The Meltdown authors noted that KAISER had “the important (but inadvertent) side effect of impeding Meltdown”. Linux merged a reworked version as **kernel page-table isolation (KPTI)** in 4.15, released on 28 January 2018, with [[backport|backports]] to stable kernels. On Linux, `/sys/devices/system/cpu/vulnerabilities/meltdown` reports whether it is active.

::scene kpti

## Two page tables per process

With KPTI every process has two top-level page tables:

- The **kernel** copy maps everything: the process’s user memory and the whole kernel.
- The **user** copy maps the process’s memory plus only the kernel data needed to get in and out. The kernel documentation lists the entry and exit code, the [[idt|interrupt descriptor table]] and a [[per-cpu|per-CPU area]] that holds the entry stacks.

Every entry into the kernel, whether a system call, an interrupt or an exception, now starts by loading CR3 with the kernel copy. Every return to user space ends by loading CR3 with the user copy. The kernel documentation (2018) puts a move to CR3 “on the order of a hundred cycles”. That is a real cost, but not the big one.

::scene flush

The big one is what a CR3 write does to the TLB. On systems without PCID support, the documentation says, “each CR3 write flushes the entire TLB.” The global bit cannot help, because KPTI turns it off for kernel structures that are not mapped in both tables. That leaves a TLB flush on every kernel entry and another on every exit:

1. A user program is running with a warm TLB.
2. It makes a system call. The entry code switches to the kernel page table, and the TLB is flushed. The kernel now takes misses on its own code, stack and data.
3. The system call returns. The exit code switches back, and the TLB is flushed again. The program now takes misses on everything it touches.

A server making 50,000 system calls per second per CPU now performs 100,000 TLB flushes per second per CPU. The direct cost of each flush is small. The misses that follow are what costs: in the worst case each one is a four-level [[page-walk|page walk]], repeated for every page the program and the kernel touch after each switch.

::scene tag

## Tagging the two halves

PCID makes the CR3 write cheap for the TLB. When the feature is enabled (bit 17 of CR4), the low 12 bits of CR3 hold a PCID, so there are 4,096 possible tags. TLB entries are tagged with the PCID that was current when they were created and are used only when the current PCID matches. Bit 63 of the value written to CR3 is a *no-flush* bit. If it is set, loading CR3 switches address spaces without discarding anything.

KPTI gives each address space two PCIDs, one for the kernel copy and one for the user copy. Linux’s source calls them the kPCID and the uPCID, and the uPCID is the kPCID plus 2048, which means bit 11 of the PCID. The kernel’s top-level table is allocated as an 8 KiB pair, with the user copy in the second 4 KiB page, so bit 12 of CR3 selects the table. Crossing the boundary in either direction flips those two bits and, in the common case, sets the no-flush bit. The kernel’s translations and the program’s translations then stay in the TLB side by side, which is exactly the book’s picture of a TLB holding two address spaces at once. Here the two are the same process seen at two privilege levels.

:::fold The return-to-user code, line by line
This is the macro that runs on the way back to user space, from `arch/x86/entry/calling.h` in current mainline Linux. `ALTERNATIVE` is patched at boot. On CPUs without PCID, the first `ALTERNATIVE` becomes a jump straight to the final CR3 write, which then flushes.

```text
.macro SWITCH_TO_USER_CR3 scratch_reg:req scratch_reg2:req
	mov	%cr3, \scratch_reg

	ALTERNATIVE "jmp .Lwrcr3_\@", "", X86_FEATURE_PCID

	/*
	 * Test if the ASID needs a flush.
	 */
	movq	\scratch_reg, \scratch_reg2
	andq	$(0x7FF), \scratch_reg		/* mask ASID */
	bt	\scratch_reg, THIS_CPU_user_pcid_flush_mask
	jnc	.Lnoflush_\@

	/* Flush needed, clear the bit */
	btr	\scratch_reg, THIS_CPU_user_pcid_flush_mask
	movq	\scratch_reg2, \scratch_reg
	jmp	.Lwrcr3_pcid_\@

.Lnoflush_\@:
	movq	\scratch_reg2, \scratch_reg
	SET_NOFLUSH_BIT \scratch_reg

.Lwrcr3_pcid_\@:
	/* Flip the ASID to the user version */
	orq	$(PTI_USER_PCID_MASK), \scratch_reg

.Lwrcr3_\@:
	/* Flip the PGD to the user version */
	orq     $(PTI_USER_PGTABLE_MASK), \scratch_reg
	mov	\scratch_reg, %cr3
.endm
```

Read it in three steps:

1. Take the current CR3 and mask off the low 11 bits. That is the kernel-side PCID, which the code calls the ASID.
2. Look that number up in a per-CPU bitmap, `user_pcid_flush_mask`. A set bit means the kernel changed this address space’s user mappings while it was in the kernel and has not yet flushed the user-side entries. In that case clear the bit and write CR3 *without* the no-flush bit, so the user PCID’s entries are discarded on the way out. Otherwise set bit 63, and nothing is flushed.
3. Set bit 11 (switch to the user PCID) and bit 12 (switch to the user half of the 8 KiB table pair), and write CR3.

The way in, `SWITCH_TO_KERNEL_CR3`, is shorter. It sets the no-flush bit if PCID is present, clears bits 11 and 12, and writes CR3. Each direction costs a few instructions and a CR3 write, with no TLB flush in the common case.
:::

::scene asids

## Six ASIDs are enough

The kernel developers had answered the book’s “more than 256 processes” question before Meltdown was public. Andy Lutomirski’s PCID support was merged for Linux 4.14 in November 2017 to keep TLB entries across ordinary context switches. Instead of giving every process a permanent tag, it gives each CPU a small cache of recently used address spaces:

```c
/*
 * 6 because 6 should be plenty and struct tlb_state will fit in two cache
 * lines.
 */
#define TLB_NR_DYN_ASIDS	6
```

On a context switch, `choose_new_asid()` looks through the CPU’s six slots for the incoming address space. If it finds it, it reuses that ASID and flushes only if the address space’s page tables have changed since, which it tells from a generation counter, `tlb_gen`, kept per address space and per slot. If not, it takes the next slot round-robin and flushes whatever that slot held. The ASIDs are per CPU and short-lived, so it does not matter that a machine runs thousands of processes. What matters is how many address spaces a single CPU alternates between in a short time, and that is usually a handful.

The ASID-to-PCID mapping is visible in the source. The kernel PCID is the slot number plus one, because PCID 0 is left for code that does not know about PCIDs, and the user PCID adds 2048. Recent kernels have added a second range of *global* ASIDs, the same on every CPU, for AMD processors that can [[tlb-shootdown|broadcast TLB invalidations]] to other CPUs with the INVLPGB instruction.

::scene invalidate

## Flushing what you can’t see

Tagging creates a new problem: the TLB now holds entries for address spaces that are not current. When the kernel unmaps a page from a process, say in [[mmap|`munmap()`]], it must remove the user-side translation too. But while the kernel is running, the current PCID is the kernel’s, and an ordinary [[invlpg|`invlpg`]] is guaranteed to affect only the current PCID.

Two tools handle this. **INVPCID**, added in Intel’s Haswell generation, can invalidate entries belonging to a PCID that is not current, so to drop a single page Linux flushes the user-side entry directly. When INVPCID is not available, and for whole-TLB flushes, Linux uses the bitmap from the fold above: it sets the bit for the user PCID and lets the exit path do a flushing CR3 write. The kernel documentation calls this deferring the user flush “until the exit to userspace, minimizing the cost.” If the process never returns to user space on this CPU, the flush never has to happen.

::scene flush

## What it cost, and what PCID recovered

Brendan Gregg measured KPTI’s overhead at Netflix in February 2018 and published one of the clearest accounts. He found the cost depends on five factors: the system call rate, the context switch rate, the page fault rate, the [[working-set|working set]] size, and the cache access pattern. As a rule of thumb, at 50,000 system calls per second per CPU “the overhead may be 2%, and climbs as the syscall rate increases”, and services below 10,000 should see less than 0.5%.

::scene tag

The TLB part of that cost is where PCID shows. In a microbenchmark at 5,000 system calls per second per CPU with a 100 MB working set, he measured about 2.1% overhead on the 4.4 and 4.9 [[lts-kernel|long-term kernels]] with the KPTI patches, and about 0.5% on 4.14, which “has pcid support”. With [[huge-page|huge pages]] added as well, the overhead turned into a 3.0% *gain*.

:::fold Brendan Gregg’s TLB counters
Gregg used [[perf-counter|hardware performance counters]] to measure the share of cycles spent walking page tables after data-TLB and instruction-TLB misses, at one point of that same microbenchmark, on a system where the overhead of KPTI without PCID was 8.7%. These are his figures:

| configuration | DTLB walk cycles | ITLB walk cycles |
|---|---|---|
| no KPTI | 0.23% | 0.01% |
| KPTI, no PCID | 2.91% | 2.21% |
| KPTI with PCID | 0.22% | 0.32% |
| KPTI, PCID and [[thp|THP]] | 0.00% | 0.22% |

The second row is the flush-on-every-crossing problem: walk cycles rise more than tenfold for data and more than two-hundredfold for instructions. The third row is the book’s ASID at work. With the two halves tagged, data-TLB walk cycles fall back to the unmitigated level. The fourth row adds [huge pages](/notes/huge-pages): with more reach, the data walks disappear entirely.

He also checked his estimates against real workloads. For a MySQL OLTP benchmark at about 75,000 system calls per second per CPU on 8 CPUs, he estimated about 4% overhead and measured 5%. For a stress test at 210,000 system calls per second per CPU he estimated under 12% and measured 25%. His worst synthetic case was over 800%, with [[instructions-per-cycle|instructions per cycle]] falling from 0.86 to 0.10.
:::

The rest of the cost is the kernel crossing itself, which got more expensive and stayed that way. [The note on system call cost](/notes/syscall-cost) takes up that side of the story.

::scene immune

## Where it bends

**Not every CPU needs it.** The Meltdown flaw was specific to certain processor designs. Linux’s CPU setup code skips the mitigation on processors on a list marked `NO_MELTDOWN`, which includes AMD’s families, and on Intel processors that report themselves immune through the `RDCL_NO` bit of the [[msr|`IA32_ARCH_CAPABILITIES` register]]. On such machines KPTI is off by default, and the CR3 dance does not happen.

::scene vm

**The cloud had to pass the flag through.** A virtual machine sees only the CPU features its [[hypervisor|hypervisor]] exposes. Tene’s 2018 note reported that most KVM guests he checked did not have the `pcid` flag, that all the VMware guests did, and that AWS instances were split about half and half. A guest without the flag paid the full flush cost on hardware that could have avoided it.

:::fold Checking a machine for yourself
Three files tell you where a Linux machine stands. These commands read them and change nothing.

```sh
grep -o -w 'pcid\|invpcid' /proc/cpuinfo | sort | uniq -c   # are the features exposed?
cat /sys/devices/system/cpu/vulnerabilities/meltdown          # "Not affected" or "Mitigation: PTI"
grep -o 'nopti\|pti=[a-z]*' /proc/cmdline                     # was it switched off at boot?
```

The flag counts come out once per logical CPU. On a virtual machine, a `Mitigation: PTI` line without `pcid` in the first command is the situation Tene was warning about: the guest pays the full TLB flush on every kernel crossing.
:::

::scene arm

**ARM did the same thing with its own ASIDs.** Some ARM cores were also affected, and arm64 Linux gained its own version, which the kernel calls “unmap kernel at [[exception-level|EL0]]”. ARM has always had ASIDs in its TLBs. The arm64 implementation gives each address space a pair that differs in the lowest ASID bit, `USER_ASID_BIT` at bit 48 of the translation table base register, and makes the kernel’s mappings non-global. Later ARM architecture versions added a hardware feature, E0PD, which the kernel’s own comment describes as doing “a similar job to KPTI”.

::scene asid

## The thread back to the book

Chapter 19 offers two answers to the context-switch problem: flush, or tag. For decades x86 kernels could get away with flushing, because context switches were rare enough and the global bit protected the kernel’s entries. Meltdown turned every system call into an address-space switch. At that rate flushing was unaffordable, and the tag the book describes, sitting unused in hardware since 2010, became what kept the mitigation affordable.

::scene asids

Linux’s answer to the book’s “more than 256 processes” question is worth keeping: treat the tag space as a small per-CPU cache of address spaces with LRU-like recycling, not as a name for each process. It is the same idea as the TLB, applied to the tags of the TLB.

The tagging trick appears elsewhere too. [[virtually-indexed-cache|Caches that match lines by virtual address]] tag them with address-space identifiers for the same reason, and hardware virtualization tags TLB entries with a virtual-machine identifier (VPID on Intel, ASID on AMD, VMID on ARM), so that switching between guests does not flush the TLB either. Whenever a cache sits in front of something that is switched often, a tag beats a flush.

## Further reading

- [Page Table Isolation (PTI)](https://docs.kernel.org/arch/x86/pti.html): the kernel’s documentation, including the overhead list quoted above.
- [Meltdown: Reading Kernel Memory from User Space](https://www.usenix.org/conference/usenixsecurity18/presentation/lipp) (Lipp et al., USENIX Security 2018).
- Daniel Gruss, Moritz Lipp, Michael Schwarz, Richard Fellner, Clémentine Maurice, Stefan Mangard: *KASLR is Dead: Long Live KASLR*, ESSoS 2017. The KAISER paper.
- [The current state of kernel page-table isolation](https://lwn.net/Articles/741878/) (LWN, December 2017): KPTI shortly before disclosure.
- [KPTI/KAISER Meltdown Initial Performance Regressions](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html) (Brendan Gregg, February 2018): the measurements above.
- [PCID is now a critical performance/security feature on x86](https://groups.google.com/g/mechanical-sympathy/c/L9mHTbeQLNU) (Gil Tene, January 2018).
- [Linux 4.14](https://kernelnewbies.org/Linux_4.14) (KernelNewbies): the release that started using PCID.
