---
deck: A TLB caches a fixed number of translations, so the only way to make it cover more memory is to make each translation cover more. Every trade-off of huge pages follows from that.
title: TLB reach and huge pages
---

::scene overview

Two popular databases give opposite advice about the same Linux switch. Redis’s latency guide puts it on its short checklist: “[[thp|Transparent huge pages]] must be disabled from your kernel.” MongoDB’s production notes for version 8.0 tell you to do the reverse: set [[proc-sys|`/sys/kernel/mm/transparent_hugepage/enabled`]] to `always` before `mongod` starts. Versions 7.0 and earlier said to turn it off.

Both pieces of advice are reasonable. To see why, you need two numbers from chapter 19: how many translations a TLB holds, and how much memory each one covers. This piece is about those two numbers, what an operating system has to do to make the second one bigger, and the bill that comes with it.

::scene reach

## Reach: entries times page size

::chapter vm-tlbs

Chapter 19 ends with a warning. If a program touches more pages in a short time than the TLB can hold, it misses constantly, and the book calls this *exceeding the TLB coverage*. The coverage, usually called **TLB reach**, is simple arithmetic:

> reach = number of TLB entries × page size

A TLB is small because it sits on the path of every load and store and must answer within a cycle or two. Intel’s Skylake cores, for example, have a second-level TLB of 1,536 entries, shared by 4 KiB and 2 MiB translations. Here is what that many entries covers at the page sizes you will meet in this piece:

| page size | reach of 1,536 entries | page-table entries read on a miss (x86-64) |
|---|---|---|
| 4 KiB | 6 MiB | 4 |
| 16 KiB | 24 MiB | (not an x86 size) |
| 2 MiB | 3 GiB | 3 |
| 1 GiB | 1.5 TiB, in principle | 2 |

The last row is in principle only, because real TLBs keep far fewer slots for 1 GiB translations. The point stands anyway. With 4 KiB pages, a TLB covers a few megabytes, which is less than the [[last-level-cache|last-level cache]] of the same chip. A database [[buffer-pool|buffer pool]], a [[jvm|JVM]] heap or an in-memory key-value store is measured in gigabytes and accessed all over the place. For such a program most TLB misses are not bad luck. They are certain, because the [[working-set|working set]] is a thousand times the reach.

::scene walk

The third column is the second benefit. A huge page is a leaf higher up the [[multilevel-table|page-table tree]], so a miss has fewer levels to walk. The book’s “RAM isn’t always RAM” tip is about exactly this: a random access to memory the TLB does not cover costs a [[page-walk|page walk]] on top of the access itself.

::scene reach

## Watch reach in the lab

The lab is the book’s Figure 19.2: ten 4-byte integers starting at virtual address 100, summed in a loop, with tiny pages and a tiny TLB so you can count every miss. It is a toy, but reach works the same way at every scale.

::lab Tlb

Things to try:

- Set the page size to 16 B, the TLB to 2 entries and the passes to 2. The array spans three pages, but the TLB covers only 32 bytes. The second pass misses on every page again, because LRU evicts each page just before the loop needs it. The hit rate stays at 70% (14 of 20).
- Keep the TLB at 2 entries and change the page size to 32 B. The array now spans two pages, the reach is 64 bytes, and the second pass hits every time: 18 of 20. You did not add a single TLB entry.
- Now try 64 B pages. Nothing improves, because the array runs from address 100 to 139 and still straddles the page boundary at 128. Bigger pages help when they reduce the number of distinct pages touched, and where the boundaries fall matters too. Real huge pages have the same alignment rule, as the next section shows.
- Go back to 16 B pages and give the TLB 4 entries. Two passes now score 17 of 20. A bigger TLB also buys reach, but hardware designers cannot add entries for free, which is why operating systems care about the page size.

::scene huge

## What makes a page huge

On x86-64, a virtual address is cut into four 9-bit indexes and a 12-bit offset, one index per level of the page-table tree. Chapter 20 and the [note on four and five levels](/notes/five-level) cover the walk itself. A huge page is what you get when the walk stops early.

Each entry in the second-lowest table, the *page directory*, normally points to a page of 512 page-table entries. If the entry has its **PS** (page size) bit set, it points instead straight at a 2 MiB region of physical memory, and the low 21 bits of the virtual address become the offset. Stop one level higher still, in the page-directory-pointer table, and the entry maps 1 GiB with a 30-bit offset. Nothing about this is a separate mechanism. It is the same tree with a shorter path.

::scene rules

That shortcut comes with three hard requirements, and all of the operating system’s difficulty comes from them:

1. **Physical contiguity.** A 2 MiB page is 512 consecutive 4 KiB frames, and they must all be free at the same time.
2. **Alignment.** Both the virtual and the physical start must be multiples of 2 MiB, because the offset is just the low 21 bits.
3. **All or nothing.** One entry carries one set of permission and dirty bits for the whole 2 MiB. You cannot write-protect, [[swap|swap out]] or share half of it.

:::fold Why the sizes are 2 MiB and 1 GiB (and 32 MiB on a phone)
The huge sizes are not chosen. They fall out of the table geometry.

On x86-64 a page-table page is 4 KiB and an entry is 8 bytes, so a table holds 4096 / 8 = 512 = 2^9^ entries. One page-table page therefore maps 512 × 4 KiB = 2 MiB, and a directory entry that skips the bottom table maps exactly that much. One level up, 512 × 2 MiB = 1 GiB.

ARMv8 lets the operating system choose the base page, the *translation granule*, from 4 KiB, 16 KiB and 64 KiB, and the block sizes follow the same rule:

| granule | entries per table | block one level up | block two levels up |
|---|---|---|---|
| 4 KiB | 512 | 2 MiB | 1 GiB |
| 16 KiB | 2048 | 32 MiB | 64 GiB |
| 64 KiB | 8192 | 512 MiB | 4 TiB |

The 16 KiB granule, which Apple silicon uses, has a 32 MiB first huge size. That is a big jump to make in one step, which is one reason ARM also has a *contiguous* hint bit. It tells the TLB that a run of adjacent entries (16 of them with a 4 KiB granule) maps contiguous, aligned memory, so the TLB may hold them as one entry. Linux’s multi-size THP, described below, can use that hint on arm64.

The table above follows from the rule, not from a survey of chips. Not every implementation supports every block size at every level.
:::

## Two ways to get them on Linux

Linux offers huge pages through two very different interfaces. The difference between them is the whole story of this article.

::scene hugetlbfs

**[[hugetlbfs|hugetlbfs]]** is the explicit one, and it is old. The administrator reserves a pool of huge pages, either at runtime through `/proc/sys/vm/nr_hugepages` or at boot with `hugepagesz=2M hugepages=512`. The kernel documentation calls boot-time reservation “the most reliable method”, because memory has not yet become fragmented. 1 GiB pages are usually reserved at boot for the same reason. Pages in the pool can be used for nothing else, and they cannot be swapped. A program gets them by [[mmap|mapping a file]] on a hugetlbfs mount, or with `MAP_HUGETLB`. PostgreSQL works this way. Its `huge_pages` setting defaults to `try`, which asks for the shared buffer pool in huge pages and falls back to ordinary pages if the pool is empty.

::scene thp

**Transparent huge pages (THP)** are the automatic one. Andrea Arcangeli’s patches were merged for Linux 2.6.38 in 2011 with the goal, as LWN put it, of making huge pages “just happen”. On a [[page-fault|page fault]] in an [[anonymous-memory|anonymous region]] the kernel tries to allocate a whole 2 MiB page. If none is free it falls back to 4 KiB pages without telling anyone. Later, a kernel thread called **[[khugepaged|khugepaged]]** scans address spaces and *collapses* runs of small pages into huge ones when memory becomes available. When a huge page has to be partly unmapped, protected or reclaimed, the kernel *splits* it back into 512 small ones.

```c
#include <sys/mman.h>

size_t len = 64UL << 20;                 /* 64 MiB */

/* THP: an ordinary mapping plus a hint. Used when THP "enabled" is always or madvise. */
void *a = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
madvise(a, len, MADV_HUGEPAGE);

/* hugetlb: draw from the reserved pool. Fails if the pool has too few free pages. */
void *b = mmap(NULL, len, PROT_READ | PROT_WRITE,
               MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
```

The two calls look alike and behave very differently. The second either gets huge pages or fails. The first may get huge pages now, later or never, and only the 2 MiB-aligned parts of the range are candidates at all.

System-wide THP behaviour is set by two files in `/sys/kernel/mm/transparent_hugepage/`:

- `enabled`: `always` (every suitable anonymous region), `madvise` (only regions marked with [[madvise|`MADV_HUGEPAGE`]]) or `never`. The default is chosen when the kernel is built, so it differs between distributions.
- `defrag`: what to do when no 2 MiB page is free at fault time. `always` stalls the faulting thread while the kernel reclaims and [[compaction|compacts memory]]. `defer` wakes background threads and lets khugepaged install the page later. `madvise`, the default, does direct compaction only for `MADV_HUGEPAGE` regions. `defer+madvise` combines the two. `never` never compacts at fault time.

::scene bloat

## Where it bends

The book names the cost of big pages in the first section of chapter 20: **[[internal-fragmentation|internal fragmentation]]**. A 2 MiB page that the program uses 4 KiB of still occupies 2 MiB. THP adds three more costs, and each comes from one of the requirements above.

**Bloat.** khugepaged’s `max_ptes_none` tunable sets how many of the 512 small slots in a range may be empty when it collapses the range. The default is 511. The kernel source comment explains the choice: collapse “if there is at least one pte mapped”, just as a page fault in a large enough region would have done. A sparse heap, where an allocator has freed most of the pages in each 2 MiB range, can therefore grow in [[rss|resident size]] after khugepaged has run.

::scene compaction

**Compaction stalls.** Contiguity is the hard part. After a few days of uptime, free memory is scattered across 4 KiB holes, and producing a free, aligned 2 MiB block means migrating pages out of the way. With `defrag` set to `always`, that work happens inside the page fault of whichever thread asked, so a memory access can take milliseconds. The `defer` and `madvise` modes exist to keep that cost off latency-sensitive paths.

::scene cow

**Copy-on-write in 2 MiB units.** The all-or-nothing rule meets `fork()`. [[copy-on-write|Copy-on-write]], which [the fork note](/notes/fork-redis) describes, copies a page when either process first writes to it. With huge pages, a one-byte write copies 2 MiB.

:::fold Redis, fork() and a 2 MiB copy
Redis takes snapshots by forking. The child writes the dataset to disk while the parent keeps serving requests, and copy-on-write keeps the two views separate. With 4 KiB pages, a write in the parent copies 4 KiB. Most of memory stays shared, and the extra memory the snapshot costs is proportional to how much the parent writes.

Redis’s latency documentation describes what happens with THP. After the fork, “a few [[event-loop|event loops]] runs will cause commands to target a few thousand of pages, causing the copy on write of almost the whole process memory.” A few thousand writes to random keys land on a few thousand different 2 MiB pages, and each first write copies 2 MiB. A few thousand pages × 2 MiB is several gigabytes, copied inside the latency of ordinary commands. That is the “big latency and big memory usage” the guide warns about.

The same document puts a number on the page tables. A 24 GB instance with 4 KiB pages needs “24 GB / 4 kB * 8 = 48 MB” of page-table entries, all copied at `fork()`. Huge pages would shrink that by a factor of 512, which is the benefit side of the same trade.

Redis no longer relies on administrators alone. Its configuration file has a `disable-thp` option, `yes` by default, which turns THP off for the Redis process only when the system setting is `always`. Linux supports this with a per-process control, `prctl(PR_SET_THP_DISABLE)`.
:::

::scene hugetlbfs

These costs explain the long tradition of turning THP off for databases. PostgreSQL’s documentation still says THP use “is currently discouraged”, while recommending explicit huge pages for the shared buffer pool. Databases want huge pages, but reserved and predictable ones.

:::fold What MongoDB 8.0 changed
MongoDB’s reversal shows what the problem really was. Its 8.0 documentation ties the change to an upgraded [[tcmalloc|TCMalloc]] allocator that uses per-CPU caches, and it asks for a specific combination of settings, not just THP on:

| setting | value | what it rules out |
|---|---|---|
| `transparent_hugepage/enabled` | `always` | (turns THP on) |
| `transparent_hugepage/defrag` | `defer+madvise` | compaction stalls inside faults, except where a region asked for them |
| `khugepaged/max_ptes_none` | `0` | collapsing ranges that are not fully used, so no bloat |

MongoDB’s page does not explain each value. The table’s last column is a reading of what each knob does, based on the kernel documentation. Read that way, the combination keeps the TLB benefit and removes two of the three costs above. The third, copy-on-write amplification, matters for a program that forks a large, busy heap, which is Redis’s design but not MongoDB’s.

The page also notes that on the PPC64LE and s390x architectures, where MongoDB keeps the older allocator, you should still disable THP. The advice depends on the allocator as much as on the kernel.
:::

::scene base

## Bigger base pages

There is a blunter approach: make the smallest page bigger for everything.

Apple took it with Apple silicon. Macs with Apple’s own chips use 16 KiB pages natively, where Intel Macs used 4 KiB. Apple’s porting guidance warns that `PAGE_SIZE` is no longer a compile-time constant and that code should read `vm_page_size` at run time. [[rosetta|Rosetta]] gives translated Intel processes 4 KiB pages so that they see what they expect. Asahi Linux, which runs Linux on these machines, uses 16 KiB pages too. Its documentation explains that the chips’ [[iommu|IOMMUs]] only support 16K-aligned pages, so a 4 KiB kernel would need workarounds that cost performance.

Android is moving the same way. Starting with Android 15, AOSP supports devices configured with 16 KiB pages. Google’s developer documentation reports, from its own initial testing, app launches under memory pressure 3.16% faster on average (up to 30% for some apps), 4.56% lower power draw during launch, and boot about 8% (roughly 950 ms) faster. The same page says 16 KiB devices use “slightly more memory on average”. That is chapter 20’s internal fragmentation again, now applied to every page in the system.

The base page is an [[abi|ABI]] as well as a hardware setting, so the move takes years. Shared libraries must align their [[elf|ELF]] segments to 16 KiB or they cannot be mapped at all. [[ndk|NDK]] r28 does this by default. Older toolchains need `-Wl,-z,max-page-size=16384`. Google Play requires apps targeting Android 15 and higher to support 16 KiB pages on 64-bit devices. Code that hard-codes 4096, or allocators tuned for 4 KiB, waste memory or crash. To see what your own machine uses, and what the rest of this part of the book looks like there, see [the page-size note](/notes/page-size-now).

Linux is also filling in the middle ground. **Multi-size THP**, an opt-in feature since Linux 6.8, lets anonymous memory be allocated in blocks between the base page and 2 MiB, such as 16 KiB or 64 KiB, each with its own `hugepages-<size>kB` control. These sizes are much easier to find free than 2 MiB, waste less when they are only partly used, and on arm64 they can use the contiguous hint described in the first fold. It is a way to get some of 16 KiB pages’ benefit without changing the ABI.

::scene three

## The thread back to the book

Chapter 19 named the problem, TLB coverage. Chapter 20 opened with the simplest fix, bigger pages, and dismissed it in a paragraph because of internal fragmentation. Real systems did not get to dismiss it. They split the fix into pieces:

1. **Explicit huge pages** (hugetlbfs): programs that know they need reach reserve it up front and accept the cost.
2. **Transparent huge pages**: the kernel guesses, promoting memory to huge pages and splitting it again behind the program’s back.
3. **Bigger base pages**: everything pays a little internal fragmentation, and everything gets 4× the reach.

The second approach has a precise ancestor in the book’s own reference list. [N+02], Navarro, Iyer, Druschel and Cox’s “Practical, Transparent Operating System Support for Superpages” (OSDI 2002), describes reserving contiguous physical memory at fault time, *promoting* a region to a superpage once it fills up, and *demoting* it when part of it must be evicted or protected. Change the names and you have THP’s fault-time allocation, khugepaged collapse and splitting. The book’s one-line annotation of that paper could stand as a summary of THP’s first decade: “Not as easy as you might think, alas.”

Cache lines, disk blocks, database pages and the blocks of [PagedAttention](/notes/paged-attention) all make the same choice of unit size, trading overhead per unit against waste inside it. Huge pages make it for the cache of translations.

## Further reading

- [Transparent Hugepage Support](https://docs.kernel.org/admin-guide/mm/transhuge.html): the kernel’s documentation for THP, including the `enabled` and `defrag` modes, khugepaged and multi-size THP.
- [HugeTLB Pages](https://docs.kernel.org/admin-guide/mm/hugetlbpage.html): the explicit pool, boot parameters and the `/proc/meminfo` fields.
- [Transparent huge pages in 2.6.38](https://lwn.net/Articles/423584/) (LWN, January 2011): how THP was designed when it was merged.
- [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/) (Redis documentation): the fork and THP sections quoted above.
- [TCMalloc performance optimization](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/) (MongoDB documentation): the 8.0 THP settings.
- [Resource consumption: huge_pages](https://www.postgresql.org/docs/current/runtime-config-resource.html) (PostgreSQL documentation): explicit huge pages, and the note on THP.
- [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes) (Android developers): the measured gains and what app developers must change.
- Juan Navarro, Sitaram Iyer, Peter Druschel, Alan Cox: *Practical, Transparent Operating System Support for Superpages*, OSDI 2002. This is the book’s [N+02].
