---
deck: The free list of chapter 17 is still in there, but it now sits behind size classes, per-thread caches and a long fight with fragmentation that plays out over months.
title: What malloc really is today
---

::scene overview

On 24 September 2019, [[heroku|Heroku]] changed a default for every new application deployed to its platform. It set one [[env-var|environment variable]], `MALLOC_ARENA_MAX=2`. The reason, in Heroku's own documentation, was that [[glibc|glibc]]'s allocator creates up to eight memory pools per CPU core on 64-bit systems, and that with some allocation patterns, especially in programs that create many [[thread|threads]], those pools cost noticeably more memory. Fewer pools trade a little speed for a smaller footprint.

The allocator in chapter 17 is one free list, searched with best or first fit, coalescing neighbours on free. The one in your process does the same job in nanoseconds, from dozens of threads at once, in servers that run for months. This piece is about what that takes, and how much of it the chapter already described.

::scene book

## Three problems the book's allocator does not have

Chapter 17's toolbox is still what real allocators use: a header recording each chunk's size, a free list threaded through free chunks, splitting and coalescing, and the "other approaches": segregated lists, Bonwick's [[slab-allocator|slab allocator]] and the binary [[buddy-allocator|buddy allocator]].

::chapter vm-freespace

Real allocators add three requirements:

- **Speed.** Allocation-heavy programs call `malloc` and `free` constantly. A list search on every call is too slow. The common case has to be a handful of instructions.
- **Threads.** One free list means one [[lock|lock]]. With 64 threads allocating at once, that lock becomes the program's bottleneck. Allocation has to be mostly local to a thread or a CPU.
- **Time.** Chapter 17 measures fragmentation as requests that fail. A long-running server rarely fails an allocation, because it can always ask the OS for more. Its failure mode is slow growth: memory that has been freed but cannot be given back, until the process is [[oom-kill|killed for using too much]].

Production allocators answer the first two the same way, with **size classes** and **caches**, and differ mostly on the third.

::scene common

## The common design: size classes and caches

Round every small request up to one of a few dozen sizes, and keep for each size class runs of memory holding only objects of that size. Inside a run allocation is a pop or a [[bitmap|bitmap]] scan and freeing is a push: no search, split or coalesce. This is the chapter's segregated free list applied to every size, and the trade the [fixed-vs-variable thread](/notes/fixed-vs-variable) follows: bounded internal fragmentation in return for no external fragmentation inside a run.

Then put a small cache of free objects of each class in front, private to a thread or a CPU, so most calls take no lock. Refill it in batches from a shared structure, and return batches when it overflows.

The allocators differ in how sizes are spaced, whether caches belong to threads or CPUs, how runs are carved from the OS's pages, and when memory goes back.

::scene glibc

## glibc: ptmalloc, arenas, bins and tcache

The default `malloc` on most Linux systems is glibc's, descended from Doug Lea's dlmalloc through Wolfram Gloger's ptmalloc. It is the closest of the four to the book's design.

**Chunks.** Every allocation is a *chunk* with a header holding its size, as in chapter 17. Chunks are aligned, so the size's low bits hold flags, such as whether the previous chunk is in use, which lets `free` coalesce without a search.

**Bins.** Free chunks live in 128 *bins*, free lists by size. Each *small bin* holds one exact size, up to about 1 KiB on 64-bit systems; each *large bin* holds a range kept in size order, for best fit. A freed chunk first goes to an *unsorted bin* and is sorted the next time `malloc` walks past. Requests above the [[mmap|mmap threshold]] (128 KiB by default, raised at run time to at most 32 MiB on 64-bit) skip the bins and get their own mapping from the kernel.

**Arenas.** To scale across threads, glibc keeps several independent heaps, *arenas*, each with its own lock and bins. A thread that finds its arena locked moves to another or creates one, up to eight per core on 64-bit systems: the limit Heroku turned down to 2. Many arenas mean little contention, but memory freed in one arena cannot serve a request in another, and each fragments separately.

**tcache.** glibc 2.26 (2017) added a per-thread cache in front of the arenas, contributed by DJ Delorie with Florian Weimer and Carlos O'Donell. Access needs no lock; refilling an empty cache takes the arena lock. By default it holds up to seven free chunks per small size, for requests up to 1,032 bytes on 64-bit systems, and since glibc 2.42 it can be configured to cache large blocks too. glibc's older *fastbins*, small lists that skipped coalescing, overlapped it, and patches posted in late 2025 removed them from the source tree.

:::fold One call to malloc, step by step
Here is the path a small `malloc` takes through glibc, simplified. It leaves out alignment, `mmap`ed chunks, error checks and the fastbins.

```c
/* pseudo-code, a simplified glibc malloc(n) */
void *malloc(size_t n)
{
    size_t sz = request2size(n);          /* add header, round up to 16 bytes */

    if (tcache_has(sz))                    /* 1. this thread's cache: no lock */
        return tcache_pop(sz);

    arena *a = lock_some_arena();          /* 2. a heap shared with other threads */
    chunk *c = smallbin_pop(a, sz);        /*    exact-size list, if small */
    if (!c)
        c = scan_unsorted(a, sz);          /* 3. recently freed chunks: take an exact
                                                fit, sort the rest into their bins */
    if (!c)
        c = largebin_best_fit(a, sz);      /* 4. smallest chunk that fits; split it */
    if (!c)
        c = split_top(a, sz);              /* 5. carve from the arena's top chunk,
                                                growing it with brk or mmap */
    tcache_refill_from_bins(a, sz);        /*    on the way out, top up the cache */
    unlock(a);
    return chunk2mem(c);
}
```

Steps 3 and 4 are chapter 17 almost word for word. Step 1 is what the chapter lacks, and most calls stop there. `free` mirrors it: a chunk goes into the tcache with no lock, and only when that size's cache is full does it return to the arena, to be coalesced and put in the unsorted bin.
:::

::scene jemalloc

## jemalloc: size classes everywhere

Jason Evans began [[jemalloc|jemalloc]] in 2004 for a language of his own and from 2005 adapted it to replace [[freebsd-solaris|FreeBSD]]'s `malloc`; his BSDCan 2006 paper is the book's [E06]. Mozilla forked it for Firefox, Facebook adopted it after Evans joined in 2009, and Rust used it by default until Rust 1.32 (2019).

jemalloc is the cleanest example of the common design:

- **Size classes**, four per doubling of size. On a 64-bit system with 4 KiB pages they run 16, 32, 48, …, 128, then 160, 192, 224, 256, then 320, 384, 448, 512, and so on. The manual states the consequence: internal fragmentation is limited to about 20% for all but the smallest classes.
- **Slabs.** Small objects, below 16 KiB with 4 KiB pages, are packed into *slabs* of one size class, each with a bitmap of which slots are in use. That is Bonwick's slab allocator, minus the object constructors.
- **Arenas and a thread cache.** By default jemalloc creates four arenas per CPU and assigns threads to them, with a per-thread cache in front.
- **Purging over time.** Freed pages are not returned to the kernel at once. They are marked dirty and purged gradually: by default, dirty pages decay over about 10 seconds. This is jemalloc's answer to the third problem, and it is a policy you can tune.

In June 2025 Evans published a postmortem saying active upstream development had ended. In March 2026 Meta announced a renewed commitment: the repository was unarchived, with a roadmap covering technical debt, [[huge-page|huge pages]], memory efficiency and ARM64.

::scene tcmalloc

## tcmalloc: per-CPU caches and huge pages

Google's [[tcmalloc|TCMalloc]] was named for *thread-caching malloc*, a name its documentation now calls a legacy. It has three tiers:

- The **front end** caches free objects per size class, by default per *CPU*. It uses Linux's restartable sequences (`rseq`), short code sequences the kernel aborts and restarts if the thread is preempted or migrated midway, so per-CPU arrays can be updated without locks or [[atomic-cas|atomic instructions]]. Without `rseq` it falls back to per-thread caches.
- The **middle end** refills it. Each size class has a *transfer cache* of free-pointer arrays, which moves memory between CPUs cheaply, and a *central free list* that carves objects out of *spans*, runs of TCMalloc pages.
- The **back end** gets memory from the OS. Its newer page heap is *hugepage-aware*: it manages 2 MiB chunks on x86 and packs spans into as few huge pages as it can.

Small requests map onto 60 to 80 size classes. On `free`, TCMalloc finds a pointer's span in a two- or three-level [[radix-tree|radix tree]], the shape of a [[multilevel-table|multi-level page table]] (see the [radix tree note](/notes/radix-trees)).

The hugepage-aware back end, described at OSDI 2021 by A.H. Hunter and colleagues at Google, optimises for the whole machine rather than for `malloc` itself. Across eight application studies it raised requests per second by 7.7% and cut RAM use by 2.4%; in the fleet it cut [[tlb|TLB]]-miss stalls by 6% and memory wasted to fragmentation by 26%.

::scene mimalloc

## mimalloc: free-list sharding

mimalloc, by Daan Leijen, Ben Zorn and Leonardo de Moura at Microsoft Research (2019), was written for the Koka and Lean runtimes. CPython's free-threaded build adopted it, because Python's own small-object allocator is not thread-safe without the [[gil|global interpreter lock]].

Its central idea is **free-list sharding**. Instead of one large free list per size class, every mimalloc *page*, usually 64 KiB on 64-bit systems and holding blocks of one size class, has its own free lists. In fact it has three:

- `free`, which `malloc` pops from;
- `local_free`, where the owning thread pushes blocks it frees;
- `xthread_free`, where *other* threads push blocks they free, with a single atomic [[atomic-cas|compare-and-swap]].

So the `malloc` fast path pops from a list only this thread touches, and every so often the allocator leaves it to fold `local_free` and `xthread_free` back into `free`, a rhythm the authors call *temporal cadence*. Their 2019 report measures mimalloc 7% faster than tcmalloc and 14% faster than jemalloc on Redis. Version 3, the current line, simplified the lock-free design.

:::fold Why three free lists and not one
A single free list per page would need to be shared by `malloc` and `free` on the owning thread, and by `free` on any other thread. That forces atomic operations on every call, even the common case where one thread allocates and frees its own objects.

Splitting the list by *who* touches it removes the conflict:

```c
/* pseudo-code, after the mimalloc design */
void *page_malloc(page *p)            /* owner thread only */
{
    block *b = p->free;
    if (b) { p->free = b->next; return b; }    /* fast path: plain loads and stores */
    return malloc_generic(p);                  /* collect local_free, xthread_free */
}

void page_free(page *p, block *b)
{
    if (p->owner == this_thread) {             /* local free: no atomics */
        b->next = p->local_free;
        p->local_free = b;
    } else {                                   /* remote free: one CAS loop */
        do b->next = p->xthread_free;
        while (!cas(&p->xthread_free, b->next, b));
    }
}
```

There is a second, subtler benefit. Because `free` never pushes onto the list `malloc` is popping from, the fast path is guaranteed to run out every so often, at which point the slow path runs. That gives the allocator a regular, bounded moment to do deferred work, such as collecting remote frees and returning empty pages, without a timer or a background thread.
:::

::scene overview

## Side by side

| | glibc | jemalloc | tcmalloc | mimalloc |
|---|---|---|---|---|
| fast path | per-thread tcache | per-thread tcache | per-CPU cache (rseq) | per-page free list |
| small sizes | exact-size bins | 4 classes per doubling | 60 to 80 classes | size-class pages |
| concurrency | arenas, 8 per core | arenas, 4 per CPU | transfer cache, central lists | thread-local heaps, CAS on remote free |
| returning memory | trim the top, `malloc_trim` | time-based decay of dirty pages | hugepage-aware back end | page reset, deferred work |

Each cell hides tunables, but the skeleton is shared: size classes, a lock-free fast path, and a slower shared layer that talks to the OS.

::scene kernel

## In the kernel: buddy and SLUB

The Linux kernel has the same two-layer structure, and both layers are in chapter 17.

Physical pages come from a **buddy allocator**. Free memory is kept in lists by *order*, blocks of 2^order^ contiguous pages, typically orders 0 to 10 (4 KiB to 4 MiB with 4 KiB pages; the limit is `MAX_PAGE_ORDER`, called `MAX_ORDER` before Linux 6.8). An allocation splits the smallest block that fits in halves until it is the right size; a freed block merges with its buddy, whose address differs in one bit, if that is free too. In front sit per-CPU lists of free pages, refilled and drained in batches: the thread-cache idea again, for pages.

Smaller objects come from the **slab allocator** Bonwick designed for [[freebsd-solaris|Solaris]]. Kinds of object such as [[inode|inodes]] and [[dentry|dentries]] have their own caches, and general `kmalloc()` requests use caches like `kmalloc-64` and `kmalloc-192`, visible in [[procfs|`/proc/slabinfo`]]. Linux once had three implementations. SLUB was merged in 2.6.22 and became the default in 2.6.23 (2007); SLOB was removed in 6.4 and SLAB in 6.8, leaving SLUB alone.

:::fold Reading /proc/buddyinfo
The kernel's documentation shows output like this:

```text
Node 0, zone      DMA      0      4      5      4      4      3 ...
Node 0, zone   Normal      1      0      0      1    101      8 ...
Node 0, zone  HighMem      2      0      0      1      1      0 ...
```

Each column is the number of free blocks of one order, starting from order 0. In the `Normal` [[memory-zone|zone]] above there is one free single page, no free blocks of 2 or 4 pages, one of 8 pages and 101 of 16 pages. The documentation says what the file is for: external fragmentation is a problem under some workloads, and this file shows how large an area can safely be allocated.

Single-page requests almost never fail, since any larger block can be split. A request for 2^9^ contiguous pages, a 2 MiB huge page on x86-64, can fail with gigabytes free if no aligned 2 MiB region is entirely free. The kernel then tries *compaction*, moving movable pages aside, which it can do because it owns the page tables: a page moves without any virtual address changing.
:::

::scene months

## Fragmentation over months

A server that runs for a month shows a different symptom from chapter 17's failed requests. [[redis|Redis]]'s documentation describes it: fill an instance with 5 GB of data, delete 2 GB, and the process's [[rss|resident set size]] will probably still be about 5 GB, though Redis reports about 3 GB in use. This is not a Redis bug, the documentation adds, but how most `malloc` implementations work. The remaining keys are spread across the same pages as the deleted ones, and a page with even one live object cannot be returned to the kernel.

Some causes, roughly in the order you meet them:

- **Pinned pages and slabs.** One long-lived object in a run of short-lived ones keeps the whole run, and the page it sits on, resident.
- **Caches and arenas.** Every per-thread cache and arena holds memory the others cannot use, and there may be hundreds of them.
- **Shifting workloads.** When object sizes change over time, slabs of old size classes stay partly full while new ones are created.

::scene defrag

The remedies follow: fewer arenas, as at Heroku; returning memory on a schedule, as in jemalloc; packing objects so whole huge pages stay free, as in TCMalloc. Or what the book says a C allocator cannot do: **compaction**. `malloc` cannot move an object the program holds pointers to, but the program can. Redis's *active defragmentation*, which only works with the copy of jemalloc bundled with Redis and is off by default, asks jemalloc whether an allocation sits in a poorly used region, copies the value to a better place, and updates its own pointer to it. The application does the relocation, because only it knows where the pointers are.

::scene book

## Try it in the lab

The lab is the book's allocator: one free list, a choice of fit policy, and optional coalescing, on a 100-byte heap.

::lab FreeList

Things to try:

- Watch the **searched** column. Best and worst fit walk the whole free list on every allocation. With thousands of free chunks that is the cost size classes remove: with a list per size, the first entry always fits.
- Turn coalescing off and count failed allocations under each policy, then turn it on. glibc still coalesces in its bins; size-class allocators need not inside a slab, where every slot is the same size.
- Press **new workload** a few times and note which policy fails least. There is no consistent winner, the chapter's own conclusion, and one reason real allocators stopped relying on fit policies for small objects.

The lab's heap is tiny and its requests uniformly random, so it overstates fragmentation: real requests cluster around a few sizes, which is what makes size classes work.

::scene overview

## Back to the book

Reread chapter 17's last section with these systems in mind. Segregated lists became size classes. Bonwick's slab became jemalloc's slabs, TCMalloc's spans and mimalloc's pages, and still runs in the kernel as SLUB. The buddy allocator hands out every physical page on a Linux machine. Free lists and fit policies survive in glibc's bins. What is new is about threads and time: caches that avoid locks, and policies for giving memory back.

The chapter also cites Hoard [B+00], which used per-processor heaps to scale while bounding wasted memory. Every allocator here answers Hoard's question: how do you make `malloc` scale across threads without letting memory grow without bound?

## Further reading

- [mallopt(3)](https://man7.org/linux/man-pages/man3/mallopt.3.html): glibc's arena, mmap-threshold and trim parameters, with their defaults.
- [Tuning glibc memory behavior](https://devcenter.heroku.com/articles/tuning-glibc-memory-behavior) (Heroku): the `MALLOC_ARENA_MAX=2` default and why.
- [jemalloc manual](https://jemalloc.net/jemalloc.3.html): size classes, slabs, arenas and decay.
- Jason Evans: [jemalloc Postmortem](https://jasone.github.io/2025/06/12/jemalloc-postmortem/) (June 2025), and Meta: [Investing in Infrastructure: Meta's Renewed Commitment to jemalloc](https://engineering.fb.com/2026/03/02/data-infrastructure/investing-in-infrastructure-metas-renewed-commitment-to-jemalloc/) (March 2026).
- [TCMalloc design](https://google.github.io/tcmalloc/design.html): front end, middle end, back end and per-CPU caches.
- A.H. Hunter et al.: [*Beyond malloc efficiency to fleet efficiency: a hugepage-aware memory allocator*](https://www.usenix.org/conference/osdi21/presentation/hunter), OSDI 2021.
- Daan Leijen, Ben Zorn, Leonardo de Moura: [*Mimalloc: Free List Sharding in Action*](https://www.microsoft.com/en-us/research/publication/mimalloc-free-list-sharding-in-action/), Microsoft Research, 2019; and the [mimalloc repository](https://github.com/microsoft/mimalloc).
- [Physical memory](https://docs.kernel.org/mm/physical_memory.html) in the kernel documentation: zones, free areas and per-CPU page lists.
- Jonathan Corbet: [What's next for the SLUB allocator](https://lwn.net/Articles/974138/) (LWN, May 2024).
- [Redis memory optimization](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/): why RSS stays high after deleting keys.
