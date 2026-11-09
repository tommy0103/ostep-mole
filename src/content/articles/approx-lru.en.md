---
deck: Exact LRU needs work on every access, and no fast system can afford that. Linux, Redis, PostgreSQL and your CPU all keep a cheap hint per item instead and decide in batches.
title: Nobody implements real LRU, and that is fine
---

::scene overview

When Salvatore Sanfilippo added LRU eviction to [[redis|Redis]], he could free up 24 bits in each object header, and no more. There was no room for the two pointers a linked list needs, and no budget for a data structure that would have to be updated on every read. So he wrote down the time of each key’s last access in those 24 bits and, when memory ran out, picked three keys at random and evicted the one idle longest. Later the three became a configurable number, with a default of five. In his own account: “since LRU is itself an approximation of what we want to achieve, what about approximating LRU itself?”

Chapter 22 makes the same argument for pages: LRU bets well on locality, but perfect LRU is expensive, so the chapter settles for a use bit and a clock hand. This piece follows that compromise through Linux’s page [[reclaim|reclaim]], Redis, a database [[buffer-pool|buffer pool]] and the caches inside your CPU. None of them implements real LRU.

::scene exact

## Why the real thing is too expensive

::chapter vm-beyondphys-policy

LRU’s rule is simple: evict the item whose most recent use is oldest. The trouble is the bookkeeping. To know which item that is at any moment, you must do work on *every access*, not just on every eviction, and accesses outnumber evictions by orders of magnitude.

The cost shows up differently at each layer:

- **Pages.** To move a page to the front of a list on each access, the hardware would have to trap to the OS on every load and store, or write a timestamp on every one. What it can afford is setting one bit, the accessed bit, in the PTE.
- **Software caches.** A doubly-linked LRU list costs two pointers per item, 16 bytes on a 64-bit machine, and turns every read into a write to shared list pointers. With many [[thread|threads]], that write needs a [[lock|lock]]. The authors of [[sieve|SIEVE]] (NSDI 2024) make this point directly: their algorithm needs no locking on a hit, and their prototype reached twice the throughput of an optimized LRU with 16 threads.
- **[[cpu-cache|CPU caches]].** Each set of an [[set-associative|*n*-way cache]] must remember an order of its *n* [[cache-line|lines]]. There are *n*! possible orders, so exact LRU needs at least log~2~(*n*!) bits per set, updated on every hit.

Here is that arithmetic against the common approximation, [[tree-plru|tree pseudo-LRU]], which needs *n* − 1 bits:

| ways per set | orders (n!) | exact LRU bits | tree-PLRU bits |
|---|---|---|---|
| 4 | 24 | 5 | 3 |
| 8 | 40,320 | 16 | 7 |
| 16 | about 2.1 × 10^13^ | 45 | 15 |

The state grows faster than the cache, and every bit has to be updated as part of the hit. Hardware settles for the right-hand column.

::scene clock

## CLOCK, and what grew out of it

The chapter’s answer is the clock algorithm, from Corbató’s [[multics|Multics]] work. Every page has a use bit that hardware sets on access. Pages sit in a circle, and a hand sweeps it. A page with its bit set gets a second chance: the bit is cleared and the hand moves on. The first page found with a clear bit is evicted. The cost moves from every access to every eviction, and the hardware only ever sets a bit.

::scene family

Almost every practical policy is a refinement of this, and the refinements fall into a few families:

- **More than one bit.** [[postgresql|PostgreSQL]]’s buffer manager keeps a usage counter per buffer, incremented each time the buffer is [[buffer-pin|pinned]], up to a limit of 5 (`BM_MAX_USAGE_COUNT`). Its clock sweep decrements the counter of each buffer it passes and takes the first one at zero. A buffer used often survives several sweeps, not one.
- **Prefer cheap victims.** The chapter’s own variant considers the dirty bit and evicts clean pages first, because evicting a dirty page costs a write.
- **Scan resistance.** The chapter’s looping workload is LRU’s worst case: a sequential scan larger than the cache evicts everything, and then nothing it brought in is ever used again. PostgreSQL handles this outside the policy. A large sequential scan gets a private ring of buffers, 256 KB, and recycles them instead of flooding the shared cache.
- **Do less on a hit.** SIEVE keeps objects in FIFO order with one “visited” bit each. Its hand moves from old to new, clears visited bits, and evicts the first unvisited object. Unlike CLOCK, survivors are never moved.

::scene clock

## Try it

The lab runs the book’s policies on the same reference string. CLOCK is the chapter’s one-bit version.

::lab Replacement

Things to try:

- Pick **80-20** with 3 frames. LRU matches OPT at 20 hits out of 24, while CLOCK only ties FIFO and RANDOM at 18. On a trace this short, one bit of history (“used since the hand last passed?”) is not much to go on. The chapter’s Figure 22.9, on a longer run, shows CLOCK between LRU and the policies that ignore history.
- Pick **Looping**: six pages in five frames. LRU, FIFO and CLOCK miss every time, and RANDOM gets 14 hits. This is the case scan-resistant designs exist for.
- Pick **Belady’s anomaly** and look at the curves. FIFO’s hit rate drops when you go from 3 frames to 4, and so does CLOCK’s. LRU’s cannot, because LRU is a stack algorithm: a cache with *k* frames always holds a subset of what a cache with *k* + 1 would hold. The approximation loses that guarantee.
- Keep OPT on screen throughout. It is the yardstick for all of these policies, and none of them can beat it.

::scene twolist

## Linux: two lists, then generations

For most of its history Linux approximated LRU with two lists, **active** and **inactive**, which the kernel’s comments call “double CLOCK lists”. New file pages start on the inactive list. A page referenced again there is promoted to the active list; when the active list grows too big, pages from its tail are demoted. Reclaim takes victims from the tail of the inactive list. A page must prove itself twice before it is protected, which gives some resistance to scans. There is one pair for anonymous pages and one for file pages, and each memory [[cgroup|cgroup]] has its own.

::scene rmap

How does the kernel know a page was referenced? For a mapped page, the hardware sets the accessed bit in the PTE, and reclaim finds it later by following the [[rmap|reverse map]] from the page to every PTE that maps it. For a page read through `read()` there is no PTE, so the kernel marks it itself.

:::fold What “mark accessed” looks like
This is [[folio|`folio_mark_accessed()`]] from `mm/swap.c` in Linux 6.12, with the comments shortened:

```c
/*
 * folio_mark_accessed - Mark a folio as having seen activity.
 *
 * This function will perform one of the following transitions:
 *
 * * inactive,unreferenced	->	inactive,referenced
 * * inactive,referenced	->	active,unreferenced
 * * active,unreferenced	->	active,referenced
 */
void folio_mark_accessed(struct folio *folio)
{
	if (lru_gen_enabled()) {
		folio_inc_refs(folio);
		return;
	}

	if (!folio_test_referenced(folio)) {
		folio_set_referenced(folio);
	} else if (folio_test_unevictable(folio)) {
		/* unevictable folios are never rotated, so nothing to do */
	} else if (!folio_test_active(folio)) {
		if (folio_test_lru(folio))
			folio_activate(folio);
		else
			__lru_cache_activate_folio(folio);
		folio_clear_referenced(folio);
		workingset_activation(folio);
	}
	if (folio_test_idle(folio))
		folio_clear_idle(folio);
}
```

Two flags per page, `referenced` and `active`, give a small state machine. The first access sets `referenced`. The second, while the page is still inactive, moves it to the active list and clears the flag. This is CLOCK’s second chance, spread over two lists.

Look at the first branch: with the [[mglru|multi-generational LRU]] enabled, the access is just counted with `folio_inc_refs()`, which feeds the “tiers” described below.

::scene refault

One more piece makes the two-list design adaptive. When a file page is evicted, the kernel leaves a *[[shadow-entry|shadow entry]]* in the [[page-cache|page cache]] slot it occupied, recording a timestamp of evictions. If the page is read back soon, the kernel computes its *[[refault|refault distance]]*: how many other pages were evicted meanwhile. If that distance is small enough that the page would have survived with a larger active list, the page is activated at once. (`mm/workingset.c` explains the design.) The shadow entry is a value stored in the page cache’s radix tree; see [A multi-level page table is a radix tree](/notes/radix-trees).
:::

The two-list design lasted a long time, but its weaknesses were well known by 2021, when Yu Zhao posted the [[mglru|multi-generational LRU]]. [[lwn|LWN]]’s summary of his case: active and inactive is too coarse a split for good decisions, the lists of different cgroups cannot be compared with each other, and finding the accessed bits of mapped pages through the reverse map is expensive.

::scene mglru

**MGLRU** was merged for Linux 6.1; Linus Torvalds’s 6.1-rc1 announcement in October 2022 named it among the “core things that have been brewing for a long time”. It replaces two lists with a sliding window of **generations**, between 2 and 4 at any time (`MIN_NR_GENS`, `MAX_NR_GENS`), each a group of pages with similar access recency. Zhao described it as a clock with two hands: the *aging* hand moves accessed pages into the youngest generation, and the *eviction* hand takes pages from the oldest.

::scene walk

The interesting decision is where the aging hand looks. Instead of visiting each page and searching for the PTEs that map it, MGLRU walks processes’ page tables directly, which has better locality: neighbouring PTEs share cache lines. Page tables can be very sparse, so a [[bloom-filter|Bloom filter]] remembers which page-table pages held enough young entries to be worth scanning again. On x86 the walk can also skip ranges whose upper-level entries show no access.

:::fold Generations, tiers and a feedback loop
::scene mglru

The kernel documentation (`Documentation/mm/multigen_lru.rst`) describes the moving parts precisely. In summary:

- **Sequence numbers.** Each [[lruvec|lruvec]] keeps `max_seq`, the youngest generation, and `min_seq`, the oldest, separately for anonymous and file pages. Both only increase. A page’s generation is stored in a small counter in its flags, truncated modulo `MAX_NR_GENS`.
- **Aging.** When the number of generations approaches the minimum, aging increments `max_seq`, creating a new youngest generation. Pages found accessed through page tables have their accessed bit cleared and are promoted to the new generation. Everything else falls one generation behind without being touched: demotion happens “consequently” in the documentation’s word, which is what makes the scheme cheap.
- **Eviction.** Eviction takes pages from the oldest generation and increments `min_seq` when it is empty. If both types are equally old, it chooses between anonymous and file pages by comparing refault rates.
- **Tiers.** Within a generation, pages accessed *N* times through file descriptors sit in tier log~2~(*N*). Moving between tiers needs only atomic flag updates, not the LRU lock.
- **A [[pid-controller|PID controller]].** A feedback loop modelled on a proportional-integral-derivative controller watches refaults per tier and per type, and decides which tiers to protect. It uses generations rather than wall-clock time as its time base, because scanning speed varies with pressure.

Because each generation is timestamped at birth, there is also a direct answer to chapter 22’s thrashing problem: with `min_ttl_ms` set, a working set younger than that is protected, and if it cannot be kept, the [[oom-kill|OOM killer]] runs instead (see [Swapping today](/notes/zram-oom)).

The claims made for MGLRU, as LWN reported them in 2021, are qualitative but broad: fewer low-memory kills on Android, fewer out-of-memory kills on Chrome OS, and better memory use on servers. It is still an approximation of LRU, just a finer-grained one, and it is built from the same parts as CLOCK: a hardware bit, a periodic sweep, and a cheap batch decision.
:::

MGLRU is optional. A kernel built with [[kconfig|`CONFIG_LRU_GEN`]] exposes `/sys/kernel/mm/lru_gen/enabled`, and `CONFIG_LRU_GEN_ENABLED` decides the default. Both designs coexist in the source, and [[folio|`folio_mark_accessed()`]] above shows the fork in the road.

::scene redis

## Redis: sampling instead of ordering

Back to Redis, which keeps its keys in no order at all. Each object’s header has a 24-bit `lru` field. Under LRU policies it holds a clock with one-second resolution (`LRU_CLOCK_RESOLUTION` is 1000 ms), so it wraps after 2^24^ seconds, about 194 days, which is harmless because active keys are touched far more often. To evict, Redis samples `maxmemory-samples` keys at random, default 5, and evicts the one idle longest.

Redis 3.0 added one refinement, an **eviction pool** of candidates (16 of them in today’s source, `EVPOOL_SIZE`). Each round of sampling offers its keys to the pool, which keeps the best candidates seen so far, so good candidates are no longer thrown away between evictions. In the Redis documentation’s comparison with true LRU, 10 samples bring Redis 3.0 “very close to the theoretical performance”, and for power-law access patterns the difference was minimal or nonexistent.

:::fold How good is a sample of five?
Assume keys are ranked by idle time, and sampling picks *N* of them uniformly at random. The sample’s oldest key lands in the oldest fraction *q* of all keys unless every sampled key misses it, so the probability is 1 − (1 − *q*)^N^:

| sample size N | lands in oldest 10% | lands in oldest 50% |
|---|---|---|
| 1 (random eviction) | 10% | 50% |
| 5 (Redis default) | 41% | 97% |
| 10 | 65% | 99.9% |

With five samples you rarely evict the very oldest key, but you almost never evict a young one. That is the right failure mode for a cache: LRU’s value comes from not throwing away the hot set, and the hot set is a small fraction of keys. The pool improves the first column, because candidates accumulate across rounds. This model ignores the pool and assumes independent uniform samples, so treat it as a lower bound.

::scene lfu

The same 24 bits do double duty under [[lfu|LFU]] policies, added in Redis 4.0. The top 16 bits store the last access time in minutes and the low 8 bits a logarithmic counter, a [[morris-counter|Morris counter]], that approximates access frequency. From `evict.c` in today’s Redis:

```c
uint8_t LFULogIncr(uint8_t counter) {
    if (counter == 255) return 255;
    double r = (double)rand()/RAND_MAX;
    double baseval = counter - LFU_INIT_VAL;
    if (baseval < 0) baseval = 0;
    double p = 1.0/(baseval*server.lfu_log_factor+1);
    if (r < p) counter++;
    return counter;
}
```

New keys start at `LFU_INIT_VAL`, which is 5, so they are not evicted before they have had a chance. After that, each increment is less likely than the one before. With the default `lfu-log-factor` of 10, the documentation’s table shows the counter at 10 after 100 hits, 18 after 1,000, 142 after 100,000 and saturated at 255 by a million. A counter that only grew would remember last year’s hot keys forever, so it also decays: by default it drops by one for each minute (`lfu-decay-time`) since the key’s last access, applied when the key is next examined. Eight bits, randomness and a clock, standing in for a frequency histogram.
:::

Redis 8.6 added LRM (least recently modified), which updates the timestamp only on writes and uses the same sampler. Once you have a cheap per-key hint and a sampler, a new policy is mostly a new rule for updating the hint.

::scene plru

## Inside the CPU: pseudo-LRU, and guessing on insertion

Processor vendors rarely document their replacement policies, so what is known comes from measurement. Andreas Abel and Jan Reineke’s nanoBench tool infers policies from microbenchmarks, and uops.info publishes the results. They found tree-PLRU in the 8-way [[cache-levels|L1]] data caches of Intel cores from [[intel-microarch|Haswell]] through Coffee Lake. In Ice Lake’s 12-way L1 it is a variant built from three PLRU trees of four ways each.

Tree-PLRU is CLOCK’s cousin in hardware. The ways of a set are the leaves of a binary tree, and each internal node holds one bit pointing towards the half that was used less recently. On a hit, the bits along the path are flipped to point away from the line just used. To evict, follow the bits from the root. That is *n* − 1 bits and one path update per hit.

::scene dueling

Further out, the measured policies look less like LRU and more like prediction. The same measurements describe the L2 and L3 caches of recent Intel cores with a family of age-based policies called QLRU, which keep a small age per line instead of an order. On Haswell and Broadwell, a few dedicated sets of L3 run each of two competing policies, and the rest of the cache follows whichever is currently missing less. That technique is *set dueling*, introduced by Qureshi and colleagues at ISCA 2007. Their key observation was that *where* a new line is inserted matters as much as what is evicted. Inserting new lines at the LRU end, instead of the MRU end, protects the cache from access patterns larger than itself. RRIP (Jaleel and colleagues, ISCA 2010) generalized this by predicting, per line, how soon it will be referenced again.

This is the chapter’s scan-resistance problem again, solved in silicon with a few bits per line: a line has to show it will be reused before it is allowed to push out lines that already have.

::scene bends

## Where it bends

Each of these approximations has a characteristic failure:

- **One bit forgets too fast.** CLOCK with a single bit cannot tell a page used once since the last sweep from a page used a thousand times. Counters (PostgreSQL), tiers (MGLRU) and LFU counters (Redis) add memory of frequency.
- **Scanning the hint costs something.** Linux’s reverse-map walk to read accessed bits was a known CPU cost under pressure. MGLRU attacks it with page-table walks and Bloom filters, which add complexity of their own.
- **Recency is the wrong signal for scans.** Every system above has a special case for data that will not be reused: inactive lists, buffer rings, LRU-position insertion. The book’s summary names [[arc|ARC]] as another answer, and the search continues.

::scene overview

## The thread back to the book

Chapter 22 says that any approach that periodically clears the use bits and then tells 1s from 0s would do. The systems here carry out that sentence at four layers:

1. A **cheap per-item hint**, updated on access: a PTE accessed bit, a 24-bit clock or Morris counter, a usage count, a few PLRU bits.
2. A **periodic or batched decision**, made at eviction time: a clock hand, a sample of five, a generation bump, a walk down a bit tree.
3. A **guard against scans**, because recency alone is fooled by data that is used once.

What none of them does is the bookkeeping that real LRU requires on every access. The approximation is the design. The same trade-off appears in every layer of [caching](/notes/caching-everywhere).

## Further reading

- [Multi-Gen LRU](https://docs.kernel.org/mm/multigen_lru.html): the kernel’s design document for generations, tiers, Bloom filters and the PID controller.
- [Multi-Gen LRU (admin guide)](https://docs.kernel.org/admin-guide/mm/multigen_lru.html): enabling it and `min_ttl_ms` thrashing prevention.
- [The multi-generational LRU](https://lwn.net/Articles/851184/) (LWN, April 2021): the original patch set and the problems with active and inactive lists.
- [Merging the multi-generational LRU](https://lwn.net/Articles/894859/) (LWN, May 2022): the LSFMM discussion and Yu Zhao’s two-handed clock.
- [Linux 6.1-rc1](https://lwn.net/Articles/911366/): Linus Torvalds’s announcement naming the merge.
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/): Redis’s approximated LRU, LFU and LRM, and `maxmemory-samples`.
- [Random notes on improving the Redis LRU algorithm](http://antirez.com/news/109) (antirez, 2016): the 24-bit genesis, sampling and the eviction pool.
- [PostgreSQL buffer manager README](https://raw.githubusercontent.com/postgres/postgres/master/src/backend/storage/buffer/README): the clock sweep with usage counts and buffer rings.
- [SIEVE is Simpler than LRU](https://www.usenix.org/conference/nsdi24/presentation/zhang-yazhuo) (NSDI 2024): a FIFO-based eviction algorithm with lock-free hits.
- [uops.info: caches](https://uops.info/cache.html): measured replacement policies of Intel L1, L2 and L3 caches.
- Moinuddin Qureshi, Aamer Jaleel, Yale Patt, Simon Steely Jr., Joel Emer: *Adaptive Insertion Policies for High Performance Caching*, ISCA 2007: insertion policy and set dueling.
- Aamer Jaleel, Kevin Theobald, Simon Steely Jr., Joel Emer: *High Performance Cache Replacement Using Re-Reference Interval Prediction (RRIP)*, ISCA 2010.
