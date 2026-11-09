---
deck: CPU caches, the TLB, the page cache, a CDN, a database buffer pool and Redis all make the same bet and face the same question. Chapter 22 already taught you how to think about each of them.
title: One idea, six layers: how chapter 22 explains every cache you use
---

::scene overview

Load a product page and follow one picture on it. The image comes from a nearby [[cdn|CDN]] server that kept a copy. The page around it was built by an application server that asked [[redis|Redis]] for the product record. Redis missed, so the application asked [[postgresql|PostgreSQL]], which looked in its [[buffer-pool|buffer pool]], missed again, and asked the kernel for an 8 KiB block of a file. The kernel found the block in its [[page-cache|page cache]]. Every instruction along the way was fetched through an [[cpu-cache|L1 cache]], and every address was translated through a TLB.

That is six caches in one page view, in silicon, in the kernel and in user space. All six do the same thing: **keep a small, fast copy of part of something big and slow, and bet that what was used recently will be used again soon.** Each also has to answer chapter 22's question: when the copy is full and something new arrives, what do you throw away?

This piece walks down the stack asking four questions at each layer: what is the unit, who decides what to evict, what happens on a write, and how does a stale copy get removed? The details differ. The structure does not.

## The book's version, in one paragraph

::chapter vm-beyondphys-policy

Chapter 22 treats physical memory as a cache for virtual pages. It measures a cache by its **hit rate** and turns that into the **average memory access time**, AMAT = T~M~ + P~miss~ · T~D~. With a disk 100,000 times slower than memory, even a 0.1% miss rate dominates. Belady's **OPT** evicts the page used furthest in the future: perfect, unbuildable, and the yardstick for everything else. **LRU** uses the past to guess the future and works when programs have **locality**. Exact LRU is too expensive for millions of pages, so a **use bit** and the **clock** algorithm approximate it. **Dirty** pages cost more to evict. And when the **working set** does not fit, the system **thrashes** and no policy can save it.

::scene cpu

## Layer 1: CPU caches

The unit is a **cache line**: 64 bytes on current x86 processors, and 128 bytes as Apple's M1 reports it (`sysctl hw.cachelinesize`). The cache is divided into *sets*. A line from a given address may live only in one set, in any of its few *ways*, say 8 or 12. Hardware decides everything, in a few cycles.

That shrinks the replacement problem from "which of a million lines" to "which of these 8 ways". Chips can afford exact LRU there, or a small tree of bits (*pseudo-LRU*) that approximates it the way clock does for pages. Small associativity also creates one of the book's "three C's", the **conflict miss**: lines evicting each other from one set while other sets sit idle.

Large [[last-level-cache|last-level caches]] went further. In 2013 Henry Wong found by measurement that Intel's [[ivy-bridge|Ivy Bridge]] L3 was no longer pseudo-LRU. In each 2048-set slice, 64 sets ran an LRU-like policy, 64 ran one designed to resist thrashing, and the rest followed whichever group was missing less. The CPU runs chapter 22's experiment on itself, against the looping workload of section 22.6, and picks the winner.

::scene coherence

**Writes** are almost always *write-back*: a store dirties the line, and memory is updated on eviction, the book's dirty bit at 64-byte scale. **Invalidation** is the hard part on a multicore machine. A write by one core invalidates other cores' copies through the coherence protocol, the bus snooping of [chapter 10](/virtualization/cpu-sched-multi). Two [[thread|threads]] writing different variables on one line keep invalidating each other: *false sharing*, thrashing at the scale of one line.

::scene tlb

## Layer 2: the TLB

The TLB of [chapter 19](/virtualization/vm-tlbs) caches page-table entries. Its unit is one translation, and what that covers depends on page size. Take a TLB with 1,536 entries. Holding 4 KiB pages, it covers 6 MiB. Holding 2 MiB pages, the same entries cover 3 GiB. This product, the TLB's **reach**, is a working-set limit that no replacement policy can beat. The [huge-pages note](/notes/huge-pages) works through this.

::scene shootdown

The interesting difference is **invalidation**. CPU caches are kept coherent automatically. The TLB is not. When the kernel changes a page-table entry, on [[mmap|`munmap()`]], `mprotect()` or when it evicts a page, it must flush the stale translation itself. If other cores may hold it, they must flush theirs too: on x86 the kernel usually interrupts each of them, and on arm64 the hardware broadcasts the flush. This *TLB shootdown* is a real cost on large machines. Tagging entries with an address-space ID avoids flushing everything at every context switch, the story of the [PCID note](/notes/pcid).

The TLB is a read cache. On x86 the only writes go the other way: hardware sets the accessed and dirty bits that the OS's clock algorithm reads.

::scene pagecache

## Layer 3: the page cache

Now the book's own layer. The Linux page cache of chapter 23 keeps file data in memory, page by page. Every `read()`, `write()` and file-backed `mmap()` goes through it, which is why so much of the memory that looks used on a busy Linux machine is page cache.

**Eviction** is chapter 22 nearly verbatim: inactive and active lists (the book's 2Q) fed by page-table reference bits (the clock idea), or since 6.1 [[mglru|multi-generational LRU]]. The [approx-lru note](/notes/approx-lru) covers both, and the [zram-oom note](/notes/zram-oom) covers what happens when eviction is not enough. Section 22.10's **prefetching** is *readahead*. On sequential reads the kernel reads ahead, growing the window up to a per-device limit in `/sys/block/<dev>/queue/read_ahead_kb` (often 128).

::scene writeback

**Writes** are write-back. `write()` dirties pages and returns. Flusher threads wake every 5 seconds and write out data that has been dirty for 30 seconds (`dirty_expire_centisecs` = 3000). Background writeback also starts when dirty pages reach 10% of available memory (`dirty_background_ratio`), and at 20% (`dirty_ratio`) a writing process must do writeback itself. To force data to disk now, you call [[fsync|`fsync()`]].

**Invalidation** is nearly free: on one machine there is only one copy, shared by everyone who reads or writes the file. The trouble starts when another cache sits on top.

::scene cdn

## Layer 4: CDNs and your browser

[[http-caching|HTTP caching]] (RFC 9111) has *private* caches, such as your browser's, which serve one user, and *shared* caches, such as a CDN node, which serve many. The unit is a whole response, from bytes to gigabytes: unlike the book's pages, units differ in size, so reuse must be weighed against space.

**Eviction** in a CDN node is typically from the LRU family, and some of the best recent work on replacement came from studying these workloads. Many objects are **one-hit wonders**, requested once and never again. The S3-FIFO paper ([[sosp|SOSP 2023]]) reports a median one-hit-wonder ratio of 26% across 6,594 production [[access-trace|traces]], and much higher ratios over the shorter stretches a cache actually holds. LRU gives each a full trip down the list. Policies that make newcomers prove themselves in a small probation area first can beat it.

::scene http

**Invalidation** is where HTTP is most explicit, because nobody can flush a cache on the other side of the internet. The origin attaches a freshness lifetime to each response and the caches decide for themselves:

```text
# A fingerprinted asset, e.g. /static/app.3f9a1c.js
Cache-Control: max-age=31536000, immutable

# The HTML page that refers to it
Cache-Control: no-cache
ETag: "v42"

# An API response: 1 minute in browsers, 10 in shared caches, served stale up to 30 s while refreshing
Cache-Control: max-age=60, s-maxage=600, stale-while-revalidate=30
```

The first sidesteps invalidation: a new version gets a new URL, and `immutable` (RFC 8246) says not to revalidate even on reload. The second revalidates every time with `If-None-Match: "v42"`, getting a tiny `304 Not Modified` if nothing changed. The third trades bounded staleness for speed: `s-maxage` applies only to shared caches, and `stale-while-revalidate` (RFC 5861) lets a cache answer from an expired copy while it refreshes. Beyond that, CDNs offer purge APIs: a TLB shootdown sent across the network.

::scene bufferpool

## Layer 5: the database buffer pool

A database caches its own table and index pages (8 KiB in PostgreSQL, 16 KiB by default in [[innodb|InnoDB]]), because it knows things the kernel cannot: which pages belong to a one-off scan, and when a dirty page may be written.

**PostgreSQL** uses a clock. Each buffer has a `usage_count`, bumped on use up to 5 (`BM_MAX_USAGE_COUNT`). The sweeping hand decrements counts and evicts the first [[buffer-pin|unpinned]] buffer it finds at zero: the book's use bit with a few more bits of history. For the looping workload, PostgreSQL uses a **ring buffer**. A large sequential scan cycles through a private 256 KiB ring instead of the main pool, so one big query cannot flush everyone else's hot pages.

**InnoDB** uses LRU with *midpoint insertion*. A new page enters the "old" sublist three eighths of the way from the tail (`innodb_old_blocks_pct` = 37). It moves to the young head only if accessed again more than 1,000 ms after its first access (`innodb_old_blocks_time`). A table scan touches each page several times within milliseconds and never again, so its pages stay old and leave quickly: 2Q with a timer.

::scene twice

**Writes** obey a rule the book's dirty bit lacks. A dirty page may reach disk only after the log records describing the change have been flushed, which PostgreSQL's documentation calls the central concept of [[wal|write-ahead logging]]. Durability comes from the log, so the pool can keep dirty pages long and write them in batches: section 22.10's clustering, made safe.

Stacking caches has a cost. PostgreSQL's documentation suggests `shared_buffers` of 25% of RAM, doubting more than 40% helps, *because PostgreSQL also relies on the operating system cache*, so one block can sit in memory twice. InnoDB can instead use [[o-direct|`O_DIRECT`]] and skip the page cache.

::scene appcache

## Layer 6: application caches

At the top, the cache is a separate server and the unit is whatever the application stores under a key.

**Eviction.** Out of the box Redis evicts nothing: the default `maxmemory-policy` is `noeviction`, and 64-bit builds set no memory limit unless you configure one. With `allkeys-lru`, Redis samples 5 keys (`maxmemory-samples`) and evicts the one idle longest, helped since 3.0 by a small pool of candidates kept between evictions, as the [approx-lru note](/notes/approx-lru) explains. `allkeys-lfu`, since Redis 4.0, keeps an 8-bit logarithmic counter per key that decays over time, so yesterday's popular key does not stay forever.

**[[memcached|memcached]]** gives each size its own cache: slab classes of fixed chunk sizes, each with its own LRU. Since 1.5.0 that LRU has been *segmented*. New items enter HOT. Items hit again move to WARM, which protects them from scans such as a crawler reading old content. The rest drain into COLD, where eviction happens. A background thread does the promotions, so a cache hit never waits for a [[lock|lock]] on the list.

**Writes and invalidation** are the application's job, and most cache bugs live here. In the usual *cache-aside* pattern, a miss reads the database and fills the cache, and a write updates the database and *deletes* the key, since overwriting it could let two concurrent writers leave the older value cached for good. A [[race-condition|race]] remains: a reader misses and fetches the old row, a writer updates the row and deletes the key, and the reader then stores its stale value until the [[ttl|TTL]] expires. Facebook's 2013 memcache paper describes its fix: a *lease* handed out with each miss and cancelled by a delete, so the late, stale fill is rejected. Leases also stop a stampede of clients refilling one hot key at once.

::scene scans

## Try it: one policy question, every layer

::lab Replacement

The lab runs chapter 22's policies on short reference strings, and each pattern showed up above:

- Pick **Looping** with 5 frames: LRU and FIFO miss on every reference, RANDOM gets some hits, and at 6 frames everything hits. This is the scan that PostgreSQL's ring, InnoDB's old sublist, Linux's inactive list and memcached's HOT queue all exist to contain.
- Pick **80-20**. LRU beats FIFO because history predicts the hot pages. Skew like this lets a small cache serve most requests.
- Pick **Belady's anomaly** and compare FIFO at 3 and 4 frames: more cache, more misses. LRU and OPT never do this, because they are *stack algorithms*: a smaller cache's contents are always a subset of a larger one's.

The lab, like the book, assumes equal-sized pages and equal miss costs.

::scene overview

## The shared vocabulary

The whole stack in one table. Capacities are orders of magnitude.

| layer | unit | typical capacity | eviction | writes | invalidation |
|---|---|---|---|---|---|
| CPU cache | 64 B line | KiB to tens of MiB | LRU, pseudo-LRU or adaptive, per set | write-back | coherence protocol |
| TLB | one translation | tens to thousands of entries | hardware, per set | none (sets A/D bits) | explicit flush, shootdown |
| page cache | 4 KiB page | most of free RAM | active/inactive lists or MGLRU | write-back, `fsync` | single copy per machine |
| CDN / browser | HTTP response | RAM and disk, per server | LRU family, size-aware | none (origin owns data) | TTL, revalidation, purge |
| buffer pool | 8 or 16 KiB page | set by config | clock with counts, midpoint LRU | write-back after WAL | owner of the data |
| Redis / memcached | key-value item | set by config | sampled LRU/LFU, segmented LRU | cache-aside | delete, TTL, leases |

The columns are the shared vocabulary:

- **Hit rate.** Every layer counts it, from CPU performance counters to `keyspace_hits` in Redis's `INFO`. AMAT says why small changes matter.
- **Working set.** Peter Denning's 1968 term for the pages a process has used recently. Every layer thrashes above some size: a loop that overflows L1, a heap beyond TLB reach, indexes that outgrow the buffer pool.
- **Locality.** The bet itself. Temporal locality justifies keeping things; spatial locality justifies fetching a whole line, readahead window or response.
- **Write policy.** Write-back wherever a layer owns data, plus a way to say "now, for real": a flush instruction, `fsync()`, a WAL flush.
- **Invalidation.** Harder going up: hardware coherence, then manual TLB flushes, then TTLs and validators that bound staleness instead of preventing it.

:::fold One formula for the whole stack
The book's AMAT has one level. Nest it and it covers a stack. For three levels:

AMAT = T~1~ + m~1~ · (T~2~ + m~2~ · T~3~)

where T~i~ is the time to reach level *i* and m~i~ is the miss ratio among the requests that reach it.

Take illustrative round numbers, not measurements: an application cache answering in 0.2 ms, a database in 2 ms when its buffer pool hits, and 10 ms when it must go to storage. With 90% hits in the application cache and 99% in the buffer pool:

AMAT = 0.2 + 0.10 · (2 + 0.01 · 10) = 0.2 + 0.10 · 2.1 = 0.41 ms.

Raising the top hit rate to 95% gives about 0.31 ms. Dropping the buffer pool to 90% instead gives 0.2 + 0.10 · 3 = 0.5 ms. Misses at the slowest level are so expensive that a slip low in the stack costs about as much as a big gain at the top saves.

The miss ratios are also not independent. The upper cache absorbs the hot requests, so the lower one sees a stream with *less* locality than the original workload, and its hit rate falls. This is why an origin's own cache can look worse after a CDN is put in front of it.
:::

::scene cdn

## Where the book's model bends

The book assumes uniform pages, uniform miss costs and one thread. Real caches bend it in three ways:

- **Size and cost.** Evicting one large object can make room for hundreds of small ones, and a miss that recomputes a page for 2 seconds is worth more than a 4 KiB [[ssd|SSD]] read. Size-aware policies and memcached's slab classes exist for this.
- **Concurrency.** Exact LRU moves an entry on *every hit*, putting a lock on the hottest path. The SIEVE and S3-FIFO papers report about 2× and more than 6× the throughput of an optimized LRU at 16 threads, because a hit only sets a bit.
- **Admission.** The book admits every missed page. CDNs and flash caches often decide *whether* to admit, since writing a one-hit wonder to flash wears it out for nothing.

:::fold FIFO strikes back: how SIEVE works
SIEVE (NSDI 2024) is one FIFO queue, one bit per object and a moving hand:

```text
# pseudo-code, after Zhang et al., NSDI 2024
on hit(x):   x.visited = 1                     # no list movement at all
on miss(x):
    if cache is full:
        o = hand or tail
        while o.visited == 1:
            o.visited = 0                      # survivor stays where it is
            o = o.prev or tail                 # hand moves from tail toward head
        hand = o.prev
        evict(o)
    insert x at head with visited = 0
```

That is nearly the clock algorithm. The difference is where a survivor goes. CLOCK effectively puts it back at the head among the newcomers. SIEVE leaves it in place, so old popular objects collect behind the hand and the hand spends its time among the newest entries. Newcomers that are not hit again leave quickly, which the authors call *quick demotion*. Popular objects are kept by flipping a bit at eviction time, not by moving them on every hit, which they call *lazy promotion*.

Across 1,559 traces from 7 sources, the authors report that SIEVE had a lower miss ratio than 9 other algorithms on more than 45% of traces, and up to 63.2% lower than [[arc|ARC]]. S3-FIFO (SOSP 2023), from an overlapping group, makes quick demotion explicit: a small FIFO with 10% of the space for newcomers, a main FIFO for objects hit again while still in the small one, and a "ghost" queue that remembers recently evicted keys without their data. A use bit, it turns out, is not just a cheap stand-in for LRU.
:::

::scene invalidation

## The thread back to the book

Chapter 22 calls main memory a cache for virtual pages and asks how to manage it. Every layer here is that sentence with different nouns, and the book's answers carry over almost unchanged.

What the higher layers add is mostly invalidation. The page cache can be simple because it is the only copy. Each cache above it copies something that someone else may change, so each needs a rule for how stale it may be. Hardware solves this exactly and pays in coherence traffic. The web solves it approximately and pays in staleness. Applications solve it themselves and pay in bugs.

The pattern continues: [[dns|DNS]] resolvers with TTLs, build caches keyed by content hash, and the [[kv-cache|KV cache]] inside an LLM server, which has its own paging story in the [PagedAttention note](/notes/paged-attention). Learn the vocabulary once and you can reason about all of them.

## Further reading

- [HTTP Caching, RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) (2022), with [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html) (stale-while-revalidate) and [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html) (immutable).
- [Linux sysctl documentation for vm](https://docs.kernel.org/admin-guide/sysctl/vm.html): the dirty-page writeback knobs.
- [PostgreSQL buffer manager README](https://github.com/postgres/postgres/blob/master/src/backend/storage/buffer/README).
- [MySQL 8.4: Making the buffer pool scan resistant](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-midpoint_insertion.html): midpoint insertion and `innodb_old_blocks_time`.
- [Redis: key eviction](https://redis.io/docs/latest/develop/reference/eviction/).
- [Replacing the cache replacement algorithm in memcached](https://memcached.org/blog/modern-lru/) (dormando, 2018): the segmented LRU.
- Rajesh Nishtala et al.: [Scaling Memcache at Facebook](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala), NSDI 2013. See also the [MIT 6.824 notes](https://pdos.csail.mit.edu/6.824/notes/l-memcached.txt) on leases.
- Yazhuo Zhang et al.: [SIEVE is Simpler than LRU](https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo), NSDI 2024. Juncheng Yang et al.: [FIFO queues are all you need for cache eviction](https://junchengyang.com/publication/sosp23-s3fifo.pdf), SOSP 2023.
- Henry Wong: [Intel Ivy Bridge cache replacement policy](https://blog.stuffedcow.net/2013/01/ivb-cache-replacement/) (2013).
- Peter J. Denning: *The working set model for program behavior*, Communications of the ACM 11(5), 1968.
