---
deck: x86-64 took the book’s multi-level page table to four levels, then five. Each level adds one memory reference to a TLB miss, and under virtualization the levels multiply.
title: Four levels, then five
---

::scene overview

When AMD designed [[x86-64|x86-64]] around 2000, it gave virtual addresses 48 significant bits: 256 TiB of address space, a lot for machines that then held a few gigabytes. The page table was a four-level tree. For more than fifteen years nobody needed more.

By 2017 Intel had published a specification for a fifth level, and Linux merged support for it years before any processor shipped. The tighter limit was not virtual space but physical memory. Linux maps all of physical RAM into the kernel’s half of every address space, and with four levels that [[direct-map|direct map]] has room for 64 TiB.

This piece follows the book’s multi-level page table from two levels to five. It looks at what each extra level costs and how hardware hides most of that cost, and at what happens when virtualization stacks one tree on top of another.

::scene four

## From two levels to four

::chapter vm-smalltables

Chapter 20 builds a multi-level table from one rule: every piece of the page table must fit in one page. Chapter 20’s 30-bit example uses 512-byte pages with 4-byte entries, so each page holds 128 entries and each level consumes 7 bits of the virtual page number. When the page directory itself outgrows a page, you add another level above it.

x86-64 applies the same rule with real sizes. A page is 4 KiB and an entry is 8 bytes, so each table page holds 512 entries and each level consumes 9 bits. Four levels of 9 bits plus a 12-bit page offset make 48 bits:

| level | Intel’s name | bits of the address | one entry maps |
|---|---|---|---|
| 4 | PML4 | 47–39 | 512 GiB |
| 3 | page-directory-pointer table | 38–30 | 1 GiB |
| 2 | page directory | 29–21 | 2 MiB |
| 1 | page table | 20–12 | 4 KiB |

[[cr3|CR3]] holds the physical address of the top table. This answers the chapter’s homework question about how many registers you need to locate a multi-level table: one, however deep the tree is. A TLB miss reads one entry at each level, four memory references, before the actual access. An entry at level 2 or 3 can also stop the [[page-walk|walk]] early and map a 2 MiB or 1 GiB region directly. Those are the [huge pages](/notes/huge-pages) of the previous chapter’s notes.

::scene canonical

The remaining 16 bits of a 64-bit pointer are not free for other uses. An address must be *canonical*: bits 63 to 48 must all be copies of bit 47. That splits the space into two 128 TiB halves at the bottom and top of the 64-bit range, with an enormous hole between them. Linux gives the lower half to user space and keeps the upper half for the kernel.

::scene sparse

## Watch a walk in the lab

The lab is the chapter’s own two-level example: a 16 KiB address space with 64-byte pages, so an address is a 4-bit page-directory index, a 4-bit page-table index and a 6-bit offset. It is far smaller than x86-64, but the walk is the same, just with fewer steps.

::lab MultiLevel

Things to try:

- Translate `0x3F80`, the chapter’s example. Count the memory references the walk makes before the data access: one for the page-directory entry and one for the page-table entry, which the lab shows as “2 + 1”. On x86-64 the same walk makes four references before the access, and with five-level paging it makes five.
- Translate `0x2000`. The page-directory entry is invalid, so the walk stops after a single reference and faults. The missing page of PTEs costs no memory at all, which is the whole point of the tree. A five-level table saves memory the same way: an unused 256 TiB region costs one empty top-level entry.
- Look at the space figures under the walk. Only three pages of page table exist instead of sixteen. Now picture a process with a few gigabytes mapped in a 128 PiB address space. Almost all of the tree is absent, and the cost of the fifth level is mostly one extra page per process.

::scene fifth

## The fifth level

**LA57** (57-bit linear addresses) adds a fifth table, the PML5, above the PML4. One more 9-bit index makes 57 bits: 128 PiB of virtual address space, with each PML5 entry mapping 256 TiB, the whole old address space. Physical addresses grow to 52 bits, 4 PiB. The operating system turns it on with bit 12 of CR4, and the top table CR3 points to is then a PML5 instead of a PML4.

The first processors with it were Intel’s Ice Lake server Xeons, released in 2021. AMD followed with its Zen 4 EPYC processors (“Genoa”). On Linux, [[proc-sys|`grep -o la57 /proc/cpuinfo`]] shows whether the CPU supports it.

::scene linux

Linux got ready in two steps. For 4.11, in early 2017, the generic memory-management code gained a fifth level, called the **[[linux-pt-levels|p4d]]**, between the existing top level (the pgd) and the pud. No hardware needed it yet. Kernels built for fewer levels “fold” the unused level away at compile time. x86 support for five-level paging followed in 4.14 in November 2017. The kernel documentation summarises the change in one line: it “bumps the limits to 128 PiB of virtual address space and 4 PiB of physical address space.”

:::fold How one kernel runs on both four and five levels
Linux’s page-table code walks pgd → p4d → pud → pmd → pte everywhere, whether or not the hardware has five levels. On a machine with four, the p4d level is folded. A p4d “table” is just the pgd entry viewed through a different type, and stepping from pgd to p4d costs nothing.

For x86 the harder problem was that one distribution kernel must boot on machines with and without LA57. Early support was a build-time option, `CONFIG_X86_5LEVEL`. A later series made the choice at boot time: early boot code checks [[cpuid|CPUID]] for LA57 and, if it is present and the `no5lvl` [[kernel-cmdline|command-line option]] is not given, enables five-level paging. The rest of the kernel asks `pgtable_l5_enabled()` and folds the p4d level at run time instead of at compile time.

In May 2025 the build option was removed. The commit, by Kirill Shutemov, makes five-level support unconditional on 64-bit x86, noting that both Intel and AMD CPUs support it and that “all major x86 Linux distributions have the feature enabled.” The boot-time check remains, so a kernel on an older CPU still runs with four levels.
:::

::scene optin

There is a catch for user space. Some programs use the high bits of a pointer for their own purposes. The kernel documentation notes that “at least some [[jit|JIT compilers]] use higher bits in pointers to encode their information.” If the kernel suddenly returned addresses above 2^47^, those programs would break. So Linux does not hand out user addresses above 47 bits by default, even on a five-level machine. A program opts in, one mapping at a time, by passing a hint address above that boundary to [[mmap|`mmap()`]]:

```c
#include <sys/mman.h>

/* A hint above 2^47 opts this one mapping in to the full 56-bit user space. */
void *hint = (void *)(1UL << 52);
void *p = mmap(hint, 1UL << 30, PROT_READ | PROT_WRITE,
               MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
/* Without five-level paging the hint cannot be honoured, and the kernel picks a
   normal address below 2^47 instead (the hint is only a hint, not MAP_FIXED). */
```

::scene direct

The user half of a five-level address space is 64 PiB. Most programs never ask for it. The beneficiaries are the kernel’s direct map of physical memory, which grows from 64 TiB to 32 PiB, and the few programs, such as large in-memory databases, that want to map more than 128 TiB.

::scene cached

## What an extra level costs

The chapter calls the multi-level table “a small example of a time-space trade-off”. Every level saves space and adds one memory reference to a TLB miss. So a fifth level should make every miss 25% more expensive: five references instead of four.

In practice it does not, because walks rarely start at the top. Processors cache the upper levels of the tree in dedicated **[[page-walk-cache|page-walk caches]]**. Intel calls them paging-structure caches and keeps separate ones for the upper levels. AMD’s page walk cache holds entries from any level. A hit lets the walker skip straight to a lower table. Thomas Barr, Alan Cox and Scott Rixner’s ISCA 2010 paper, “Translation Caching: Skip, Don’t Walk (the Page Table)”, compares these designs and concludes that the most effective ones cache partial translations so the walk can skip levels.

The upper levels are very easy to cache because there are so few of them. The table above shows the reason:

- A process that uses less than 256 TiB, which is nearly every process, uses exactly **one** PML5 entry.
- Each PML4 entry covers 512 GiB, so a process with a few hundred gigabytes mapped touches one or two.
- Even page-directory-pointer entries cover a gigabyte each.

A small cache can hold all of them for the running process, so most walks can start near the bottom of the tree. The fifth level adds a reference only when the walker misses in its upper-level caches, such as after a context switch or for a program whose accesses are scattered across terabytes. The memory cost is one more 4 KiB page per process for the extra top table. The time and space cost of the fifth level is real but small. It is not a 25% tax on every miss.

::scene nested

## Two dimensions: page tables under virtualization

Virtualization makes all of this worse. A guest operating system manages its own page tables, translating guest virtual addresses to what it believes are physical addresses: *guest physical* addresses. The [[hypervisor|hypervisor]] must then translate guest physical to the real *host physical* address. Since around 2008, x86 processors do both in hardware. AMD calls the second table *nested page tables* and Intel calls it *extended page tables* (EPT). Before that, hypervisors kept [[shadow-page-table|shadow page tables]] in software and trapped every guest page-table update.

::scene grid

Here is the catch. Every pointer in the guest’s page table is a guest-physical address, including CR3 itself. To read the guest’s PML4 entry, the hardware must first translate the address of the guest’s PML4 table through the host’s tables. The same goes for the guest’s next table, and the next, and finally for the guest physical address of the data. Each guest step costs a full host walk plus one reference. Ravi Bhargava, Ben Serebrin, Francesco Spadini and Srilatha Manne named this a **two-dimensional page walk** in their ASPLOS 2008 paper, and gave the count: with *n* guest levels and *m* host levels, a 2D walk needs *nm* + *n* + *m* page-table references.

| guest levels | host levels | references on a full walk |
|---|---|---|
| 4 | (native) | 4 |
| 5 | (native) | 5 |
| 4 | 4 | 24 |
| 5 | 5 | 35 |
| 4 | 3 (host uses 2 MiB pages) | 19 |
| 4 | 2 (host uses 1 GiB pages) | 14 |

::scene grid35

The third row is the famous 24: six times the native walk. Adding one level to both dimensions does not add two references. It adds eleven.

:::fold Counting the 24
Draw the guest walk as a row of five steps: the guest’s CR3 points to the PML4, the PML4 entry to the PDPT, then to the PD, then to the PT, and the PT entry gives the guest physical address of the data. Each of those five values is a guest physical address that the hardware must turn into a host physical address before it can use it.

Translating one guest physical address takes a host walk: *m* = 4 references, one per level of the host’s table. Then, for the first four of the five steps, the hardware also reads the guest entry itself, one more reference each. The fifth step, the data, is the access the program asked for and is not counted as part of the walk.

Total: 5 host walks × 4 references = 20, plus 4 guest entries = 24. In general (*n* + 1) host walks of *m* references, plus *n* guest entries, is (*n* + 1)*m* + *n* = *nm* + *n* + *m*. Equivalently, it is (*n* + 1)(*m* + 1) − 1, a grid of guest steps by host steps with only the final corner missing, which is where the name *two-dimensional* comes from.

Two things follow from the formula. Making the host’s pages bigger shortens *m* for every one of the *n* + 1 host walks, which is why the host’s huge pages pay off more than the guest’s. And going to five levels in both dimensions turns 24 into 35.
:::

The worst case is rare for the same reason as before: caches. Bhargava and his colleagues started from AMD’s existing page walk cache and extended it to hold entries from the nested dimension too. For their mix of server and [[spec-benchmarks|SPEC]] workloads, that improved guest performance by 15% to 38%, and caching nested translations directly added another 3% to 7%. Real processors keep such caches, and a TLB hit skips the whole grid anyway, because the TLB caches the final guest-virtual-to-host-physical translation.

::scene hostpages

That is also why the advice for virtualized hosts is so consistent. Back guest memory with [[huge-page|huge pages]] on the host. Expose [[pcid|PCID]] and similar features so guests can keep their TLBs warm (see [the PCID note](/notes/pcid)). Remember that in a virtual machine a TLB miss that walks the whole grid makes six times as many page-table references as on bare metal.

::scene direct

## Where it bends

- **Who needs five levels?** Only machines with more than 64 TiB of RAM, or programs that want more than 128 TiB of virtual space. Everyone else pays a slightly longer walk and gets nothing for it. Linux enables five-level paging whenever the CPU supports it, and the `no5lvl` boot option turns it off for those who prefer the shorter walk.
- **Guests and hosts choose separately.** Intel’s specification, titled “5-Level Paging and 5-Level EPT”, extends both dimensions, but each is set independently. A guest may run four-level paging on top of five-level EPT, or the other way round, and the formula gives the count for each combination.
- **The pointer bits are an [[abi|ABI]].** Programs that hid tags in the top 16 bits of a pointer turned a page-table change into a compatibility problem. That is why user space is opted in one mapping at a time, and why newer hardware features that let programs mask high pointer bits, such as [[pointer-tagging|Intel’s LAM and ARM’s top-byte ignore]], define exactly which bits the hardware will ignore.

::scene sparse

## The thread back to the book

Chapter 20 tours a wide space of page-table designs: segment-and-paging hybrids, inverted tables searched through a hash, tables that are themselves paged, and the freedom a software-managed TLB gives. x86-64 picked the plainest of them, the multi-level table with every piece one page in size, and has stretched it from two levels in 32-bit x86 to five today. The design scales because the tree is sparse. Unused regions cost nothing, so a 128 PiB address space is no more expensive to hold than a 256 TiB one.

Strip away the hardware and what remains is a [[radix-tree|radix tree]] keyed by address bits, which [the radix-tree note](/notes/radix-trees) follows through file systems and other kernel data structures. The trade-off the chapter names, space against time, came back at every step. Each level saves space and costs a reference. Page-walk caches recover most of the time, and under virtualization the time comes back multiplied.

## Further reading

- [5-level paging](https://docs.kernel.org/arch/x86/x86_64/5level-paging.html): the kernel’s documentation, including the user-space opt-in.
- [Memory management](https://docs.kernel.org/arch/x86/x86_64/mm.html): the x86-64 virtual memory map for four and five levels, including the direct map.
- [Five-level page tables](https://lwn.net/Articles/717293/) (LWN, March 2017): the p4d level and why it was added before the hardware existed.
- [x86/mm/64: Make 5-level paging support unconditional](https://lkml.rescloud.iu.edu/2505.2/01622.html) (Kirill Shutemov, May 2025): the commit that removed the build option.
- [5-Level Paging and 5-Level EPT white paper](https://www.intel.com/content/www/us/en/content-details/671442/5-level-paging-and-5-level-ept-white-paper.html) (Intel).
- [Accelerating two-dimensional page walks for virtualized systems](https://www.sciweavers.org/node/201015) (Bhargava, Serebrin, Spadini, Manne, ASPLOS 2008): the 2D walk, its reference count and nested page walk caches.
- Thomas W. Barr, Alan L. Cox, Scott Rixner: *Translation Caching: Skip, Don’t Walk (the Page Table)*, ISCA 2010.
