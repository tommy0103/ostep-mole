---
deck: Address spaces, pages, TLBs, page faults, demand zeroing and copy-on-write are not history. A shell, two short C programs and a few files under /proc let you watch every one of them on the machine in front of you.
title: Everything in this part, running on your laptop
---

::scene overview

The Linux machine this article was checked on answers `getconf PAGESIZE` with `4096`. Its processor, according to `lscpu`, is made by Apple. Boot macOS on the same kind of chip and the same command answers `16384`. Same silicon, two page sizes.

A page is not a law of nature. It is a choice the operating system makes from what the hardware offers, and you can inspect that choice, and almost everything built on it, from an ordinary terminal. This piece is a guided tour: each stop names its chapter, gives you a command or a short program, and says which system it works on.

## The question

::chapter vm-complete

The book built virtual memory up from address spaces (chapter 13) through paging, TLBs and multi-level tables (18 to 20), page faults and replacement (21, 22), to the complete systems of chapter 23 with their lazy tricks, [[demand-zero|demand zeroing]] and [[copy-on-write|copy-on-write]]. Where can you *see* each of those on a real machine, and what do the numbers say?

::scene maps

## Your address space, as a text file

On Linux every process has a file describing its own address space. `cat` can show you its own:

```sh
# Linux
cat /proc/self/maps
```

Here is real output, from `cat` on an arm64 Debian 12 userland running on Linux 6.8, with some lines left out:

```text
abf6ec0a0000-abf6ec0a9000 r-xp 00000000 00:2e 1048843   /usr/bin/cat
abf6ec0bf000-abf6ec0c0000 r--p 0000f000 00:2e 1048843   /usr/bin/cat
abf6ec0c0000-abf6ec0c1000 rw-p 00010000 00:2e 1048843   /usr/bin/cat
abf70a097000-abf70a0b8000 rw-p 00000000 00:00 0         [heap]
ef18aa5d0000-ef18aa75c000 r-xp 00000000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa75c000-ef18aa76c000 ---p 0018c000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa76c000-ef18aa770000 r--p 0018c000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa770000-ef18aa772000 rw-p 00190000 00:2e 1049378   /usr/lib/aarch64-linux-gnu/libc.so.6
ef18aa772000-ef18aa77f000 rw-p 00000000 00:00 0
...
ef18aa7c8000-ef18aa7ca000 r--p 00000000 00:00 0         [vvar]
ef18aa7ca000-ef18aa7cb000 r-xp 00000000 00:00 0         [vdso]
ffffe07be000-ffffe07df000 rw-p 00000000 00:00 0         [stack]
```

Each line is one region of virtual addresses, what the kernel calls a [[vma|VMA]]. The columns are the address range, the permissions, the offset into the file that backs the region, the device and [[inode|inode]] of that file, and its name. Read it with chapter 13's picture of an address space in mind:

- **Code, read-only data and data** of the program and of each library are separate regions, with `r-x`, `r--` and `rw-` permissions. These are the protection bits of chapters 16 and 18, applied per page.
- **The fourth letter** is `p` for a private mapping, which the kernel's documentation glosses as "copy on write", or `s` for shared. Every writable region above is private: if this process writes to a page of [[libc|libc]]'s data, it gets its own copy.
- **Inode 0** means no file is behind the region. The unnamed `rw-p` line after libc is most likely its zero-initialised data ([[bss|`.bss`]]). Those pages are **demand-zero**: they exist only as part of the region until first touched.
- **`---p`** is a gap inside libc's span with no permissions at all. Any access to it faults.
- **`[heap]`** is the region [[brk|`brk()`]] grows. **`[stack]`** is the main thread's stack, near the top of the user address space, growing down.
- **[[vdso|`[vdso]`]]** is a small shared library the kernel maps into every process, so that calls like `clock_gettime()` can run without a trap into the kernel. **`[vvar]`** holds the data it reads.

Now run the command twice. Every address changes, because the kernel places each region at a random offset on every [[fork-exec|`exec()`]]. That is address space layout randomization, made possible because addresses are virtual. The [ASLR note](/notes/aslr) explains what it protects against.

On macOS there is no [[proc-sys|`/proc`]]. The closest tool is `vmmap <pid>`, which lists the same kind of regions, each labelled with its purpose: [[mach-o|Mach-O]] segments such as `__TEXT` and `__DATA`, malloc regions, stacks. `vmmap -summary <pid>` gives totals instead of the full list.

::scene smaps

## What a page costs: smaps

`maps` tells you what is mapped. `/proc/<pid>/smaps` tells you, region by region, how much of it is actually in memory. This is the heap region of a small process on the same system, abridged:

```text
b561e5f4e000-b561e5f6f000 rw-p 00000000 00:00 0          [heap]
Size:                132 kB
KernelPageSize:        4 kB
MMUPageSize:           4 kB
Rss:                   4 kB
Pss:                   4 kB
Private_Dirty:         4 kB
Anonymous:             4 kB
AnonHugePages:         0 kB
Swap:                  0 kB
```

The heap spans 132 KiB of addresses, but only one 4 KiB page is resident; the rest has never been touched. `KernelPageSize` and `MMUPageSize` tell you which page size backs the region, `AnonHugePages` shows how much of it uses 2 MiB [[thp|transparent huge pages]], and `Swap` shows how much has been paged out. `/proc/<pid>/smaps_rollup` gives the same fields summed over all regions, which is cheaper to read for a large process.

::scene rss

## RSS, VSZ and PSS

Three numbers come up whenever someone asks how much memory a process uses. They measure different things.

- **VSZ** (virtual size) is the total size of all mapped regions: everything in `maps`. It costs almost nothing and can far exceed physical memory.
- **RSS** (resident set size) is the part of that currently in physical frames. It counts a shared library's resident pages in *every* process that maps it, so adding up RSS across processes overcounts.
- **PSS** (proportional set size) divides each shared page by the number of processes sharing it. Summed over processes, it adds up to real memory use.

`ps` prints the first two on both systems, in KiB:

```sh
# Linux and macOS
ps -o pid,vsz,rss,comm -p $$
```

On Linux, `grep -E '^(Rss|Pss)' /proc/$$/smaps_rollup` adds PSS.

::scene pagesize

## Page size: 4 KiB, 16 KiB, and why it is a choice

```sh
getconf PAGESIZE          # Linux and macOS
sysctl hw.pagesize        # macOS
```

On x86-64 the answer is always 4096. The hardware's base page is 4 KiB, with 2 MiB and 1 GiB [[huge-page|huge pages]] one and two levels up the page table, as chapter 23 describes. Four levels of 9 bits each, plus a 12-bit offset, give 48 bits of virtual address. The [five-level note](/notes/five-level) covers what happens beyond that.

On 64-bit Arm the hardware offers a choice of three *translation granules*: 4, 16 or 64 KiB. The operating system picks one. Native arm64 processes on macOS on Apple silicon see 16 KiB pages, and [[asahi|Asahi Linux]] on the same Macs uses 16 KiB because, its documentation explains, the machines' [[iommu|IOMMUs]] only support 16 KiB pages. A Linux [[hypervisor|virtual machine]] on the same chip can still use 4 KiB, which is what the machine at the top of this article does. Android 15 added support for devices that use 16 KiB pages. In Google's initial testing (published 2024–25), such devices used slightly more memory on average, launched apps 3.16% faster on average under memory pressure, and booted about 8% (roughly 950 ms) faster.

Why make pages bigger? Everything in chapters 19 and 20 scales with the page size:

- **TLB reach** grows fourfold: the same TLB entries cover four times as much memory. The [huge-pages note](/notes/huge-pages) explains why reach matters.
- **Page tables** get shallower and smaller, as the fold below works out.
- **Faults** are a quarter as many for memory touched page by page.

The cost is the internal fragmentation of chapter 17. A process that needs one byte of a page gets the whole page, and with 16 KiB pages every partially used page wastes up to four times as much. It also breaks code that hard-codes 4096. Android now asks developers to align native libraries to 16 KiB and to call `getpagesize()` or `sysconf(_SC_PAGESIZE)` instead of assuming a size.

:::fold Where the page-table levels come from
::scene levels

A page-table page is itself one page, and each entry is 8 bytes. So the page size fixes how many entries a table holds, hence how many address bits each level of the [[radix-tree|radix tree]] translates:

| page size | offset bits | entries per table | bits per level | huge page one level up |
|---|---|---|---|---|
| 4 KiB | 12 | 512 | 9 | 2 MiB |
| 16 KiB | 14 | 2,048 | 11 | 32 MiB |
| 64 KiB | 16 | 8,192 | 13 | 512 MiB |

With 4 KiB pages, 12 + 4 × 9 = 48 bits takes four levels. With 16 KiB pages, 14 + 3 × 11 = 47 bits takes only three, and a 48th bit needs a tiny extra level with just two entries. With 64 KiB pages, Linux on arm64 uses two levels for a 42-bit address space: 16 + 2 × 13 = 42.

The last column is the size of a "block" mapping one level up, a leaf entry that maps a whole table's worth of memory at once. That is where the familiar 2 MiB huge page comes from: 512 × 4 KiB. On a 16 KiB system the equivalent is 32 MiB, which is why Linux's arm64 documentation lists 32 MiB as the [[pmd|PMD]]-level huge page size for that granule.

This is the trade-off of chapter 20 in one table: bigger pages make shallower trees, at the price of coarser allocation. The [radix-trees note](/notes/radix-trees) looks at the tree itself.
:::

::scene lazy

## Lazy allocation, measured

Chapter 23's VAX/VMS section describes **demand zeroing**: when a process asks for memory, the OS only records the request (VMS in a page-table entry marked invalid, Linux in a VMA) and does nothing else until the first access traps. This program lets you count the traps. It [[mmap|maps]] 256 MiB, pauses so you can look at it from outside, writes one byte to each page, and reports how many [[minor-fault|minor page faults]] that took.

```c
/* lazy.c: virtual memory costs nothing until you touch it.
   Linux and macOS:  cc -O2 -o lazy lazy.c && ./lazy */
#include <stdio.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

static void pause_here(const char *what) {
    printf("%s. In another terminal: ps -o pid,vsz,rss -p %d\n", what, (int)getpid());
    printf("Press Enter to continue.\n");
    getchar();
}

int main(void) {
    long page = sysconf(_SC_PAGESIZE);
    size_t len = (size_t)256 << 20;                       /* 256 MiB */

    char *mem = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0);
    if (mem == MAP_FAILED) { perror("mmap"); return 1; }
    volatile char *p = mem;                               /* keep the stores below */
    pause_here("Mapped 256 MiB, touched nothing");

    long before = minor_faults();
    for (size_t off = 0; off < len; off += (size_t)page)
        p[off] = 1;                                       /* first write to each page */
    long after = minor_faults();

    printf("page size %ld: touched %zu pages, took %ld minor faults\n",
           page, len / (size_t)page, after - before);
    pause_here("Touched every page");
    return 0;
}
```

At the first pause, VSZ already includes the 256 MiB while RSS is still small: the memory exists only as a VMA. At the second pause, RSS has grown by about 256 MiB too.

::scene touched

The fault count is where the page size shows. With 4 KiB pages there are 65,536 pages to touch, so expect about 65,536 minor faults, one per page. As a check, the same loop written in JavaScript and run under Node on the Linux VM used for this article took 65,692, the small excess presumably from the runtime itself. With 16 KiB pages there are only 16,384 pages to touch, so expect about a quarter as many. If transparent huge pages are set to `always` (see `/sys/kernel/mm/transparent_hugepage/enabled`), Linux may back the region with 2 MiB pages, a single fault can map 512 pages at once, and the count drops sharply. `AnonHugePages` in the region's `smaps` entry will show it.

Every one of those faults is *minor*. The kernel found a free frame, zeroed it and filled in the page-table entry. The page was not on disk waiting to be read; it did not exist anywhere until you wrote to it.

This laziness has a consequence chapter 21 hints at. Because untouched memory costs nothing, Linux by default lets processes map more than it could ever back: `vm.overcommit_memory` is 0, a heuristic mode that refuses only obviously excessive requests. The bill arrives when the pages are touched. What Linux does if it cannot pay is the subject of the [zram-oom note](/notes/zram-oom).

::scene faultlab

## Watch one fault in slow motion

::lab PageFault

The lab follows a single memory access through the TLB, the page-table walk and the page-fault handler. Try these:

- Run **TLB hit**, then **TLB miss, page in memory**. The difference is a page walk, chapter 20's multi-level lookup; the fold above says how many levels it has on your machine.
- Run **page fault, free frame**. This is close to what each iteration of `lazy.c` does, with one difference: the lab reads the page from swap, while a demand-zero fault simply zeroes a fresh frame. That is why `lazy.c`'s faults are minor and fast.
- Run **page fault, memory full, dirty victim** and compare the time bar. That path, a write and then a read of the disk, is a major fault, the kind you want to see zero of.

The lab's times are rough orders of magnitude, and real page walks are often helped by caches of upper-level page-table entries.

## Counting faults from the outside

You do not need to write C to count faults. Three standard tools report them for any command:

```sh
# Linux, GNU time (often the package "time"; the shell's builtin time does not do this)
/usr/bin/time -v ./lazy        # "Minor (reclaiming a frame) page faults", "Major (requiring I/O) page faults"

# Linux, perf
perf stat -e page-faults,minor-faults,major-faults -- ./lazy

# macOS, BSD time: "page reclaims" are minor faults, "page faults" are major
/usr/bin/time -l ./lazy
```

::scene major

To see major faults, make the kernel forget a file and then use it. On Linux, as [[root|root]], `sync; echo 1 > /proc/sys/vm/drop_caches` empties the [[page-cache|page cache]] without losing data, since dirty pages are not dropped. Run a large program right afterwards and its code is paged in from disk, so it shows major faults. Run it again and the faults are minor, because the code is now in the page cache: the kernel only has to point the page table at a frame that is already there. `free` shows the page cache as `buff/cache`. That is chapter 22's AMAT, visible in two runs of the same program.

:::fold Copy-on-write, measured
::scene cow

Chapter 23 explains that `fork()` does not copy memory. It copies page tables, marks private pages read-only in both processes, and copies a page only when one of them writes to it. This program shows that. The parent fills 64 MiB, then forks. The child reads every page, then writes every page, counting minor faults for each pass.

```c
/* cow.c: copy-on-write after fork().  cc -O2 -o cow cow.c && ./cow */
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

int main(void) {
    long page = sysconf(_SC_PAGESIZE);
    size_t len = (size_t)64 << 20;                        /* 64 MiB */
    char *mem = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0);
    if (mem == MAP_FAILED) { perror("mmap"); return 1; }
    memset(mem, 1, len);                                  /* parent owns real pages */

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {
        volatile char *p = mem;
        long sum = 0, a = minor_faults();
        for (size_t off = 0; off < len; off += (size_t)page) sum += p[off];   /* read */
        long b = minor_faults();
        for (size_t off = 0; off < len; off += (size_t)page) p[off] = 2;      /* write */
        long c = minor_faults();
        printf("child: %zu pages, %ld faults reading, %ld faults writing (sum %ld)\n",
               len / (size_t)page, b - a, c - b, sum);
        _exit(0);
    }
    waitpid(pid, NULL, 0);
    return 0;
}
```

On Linux with 4 KiB pages, expect close to zero faults for the reads. `fork()` copied the page-table entries, so the shared pages are already mapped. Expect about 16,384 faults for the writes: each first write hits a read-only entry, and the kernel copies that one page and gives the child a private, writable mapping. If transparent huge pages back the region, the numbers will differ. The parent's memory is untouched throughout, which is the whole point. The [fork-redis note](/notes/fork-redis) shows a database that relies on this to take snapshots.
:::

:::fold Your page table, readable (almost)
::scene pagemap

Linux exposes one more layer: `/proc/<pid>/pagemap`, a binary file with one 8-byte entry per virtual page. Bit 63 says whether the page is present in memory, bit 62 whether it is swapped, and bits 0 to 54 hold the physical frame number, the PFN of chapter 18. Seek to (virtual address / page size) × 8 and you are reading the translation the TLB would cache.

There is a catch. Since Linux 4.0 the frame numbers are reserved for processes with [[root|`CAP_SYS_ADMIN`]], and since 4.2 an unprivileged reader sees the PFN field as zero while the flag bits still work. The kernel documentation gives the reason: physical addresses help an attacker carry out [[rowhammer|Rowhammer]], which flips bits in DRAM rows next to ones the attacker hammers. Even the address translation the book treats as plain bookkeeping turns out to be something to hide.
:::

::scene beyond

## Where the machine goes beyond the book

The book's model holds up well, but your laptop goes past it in three places:

- **Pages are not one size.** Linux can back [[anonymous-memory|anonymous memory]] with 2 MiB transparent huge pages and, in recent kernels, with intermediate sizes such as 16, 32 or 64 KiB ("multi-size THP").
- **The kernel is not in `maps`.** Apart from oddities such as x86-64's legacy `[vsyscall]` page, the kernel half of the address space does not appear there. Since [[spectre|Meltdown]], which chapter 23 discusses, x86 kernels may keep most of it out of the user page tables entirely, and the [PCID note](/notes/pcid) explains how they keep that affordable.
- **Memory is promised before it is provided.** Overcommit means VSZ is a promise and RSS is what has been delivered. When too many promises are called in at once, the answer is compression, swap and finally killing processes, which the [zram-oom note](/notes/zram-oom) covers.

::scene overview

## The thread back to the book

Here is the whole part as a set of commands:

| book idea | chapter | Linux | macOS |
|---|---|---|---|
| address space | 13 | `cat /proc/<pid>/maps` | `vmmap <pid>` |
| page size | 18 | `getconf PAGESIZE` | `getconf PAGESIZE`, `sysctl hw.pagesize` |
| huge pages and TLB reach | 19, 23 | `AnonHugePages` in `smaps` | not exposed the same way |
| resident pages | 21 | `Rss` and `Pss` in `smaps_rollup`, `ps` | `ps`, `vmmap -summary` |
| page faults | 21 | `/usr/bin/time -v`, `perf stat` | `/usr/bin/time -l` |
| demand zeroing | 23 | `lazy.c` | `lazy.c` |
| copy-on-write | 23 | `cow.c` | `cow.c` |
| page cache | 22, 23 | `free`, `drop_caches` | `vm_stat` |
| physical frames | 18 | `/proc/<pid>/pagemap` (root) | none |

None of this is a simulation. The book drew the mechanisms on paper; the machine you are reading this on runs all of them, constantly. The tools above let you watch.

## Further reading

- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html): `maps`, `smaps`, `smaps_rollup` and `status`.
- [Examining process page tables](https://docs.kernel.org/admin-guide/mm/pagemap.html): the `pagemap` format and its permission rules.
- [Transparent Hugepage Support](https://docs.kernel.org/admin-guide/mm/transhuge.html): THP settings, `AnonHugePages` and multi-size THP.
- [HugeTLBpage on ARM64](https://docs.kernel.org/arch/arm64/hugetlbpage.html): huge page sizes for each translation granule.
- [Documentation for /proc/sys/vm](https://docs.kernel.org/admin-guide/sysctl/vm.html): `overcommit_memory` and `drop_caches`.
- [getrusage(2)](https://man7.org/linux/man-pages/man2/getrusage.2.html), [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) and [vdso(7)](https://man7.org/linux/man-pages/man7/vdso.7.html) manual pages.
- [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes): Android's guide, with Google's measurements.
- [Prepare your apps for Google Play's 16 KB page size compatibility requirement](https://android-developers.googleblog.com/2025/05/prepare-play-apps-for-devices-with-16kb-page-size.html) (Android Developers Blog, May 2025).
- [Asahi Linux: broken software](https://asahilinux.org/docs/sw/broken-software/): why Linux on Apple silicon uses 16 KiB pages.
- Brendan Gregg: [perf examples](https://www.brendangregg.com/perf.html).
