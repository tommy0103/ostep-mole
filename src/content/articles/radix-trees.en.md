---
deck: Strip away the hardware and a multi-level page table is a radix tree. The same shape indexes the Linux page cache, routes IP packets and holds file blocks.
title: A multi-level page table is a radix tree, and it is everywhere
---

::scene overview

On 28 October 2018 Linus Torvalds pulled a branch called “[[xarray|XArray]] for 4.20”. It changed how the Linux [[page-cache|page cache]], the kernel’s in-memory copy of file contents, finds the page holding a given offset of a file. The data structure underneath barely changed. Matthew Wilcox kept the kernel’s existing [[radix-tree|radix tree]] and replaced the interface on top of it: the tree was fine, he had argued that January, and the API was the problem.

That radix tree has the same shape as the structure your CPU walks on every TLB miss. Chapter 20 calls it a multi-level page table. A data-structures course calls it a **radix tree**, a [[trie|trie]] keyed by fixed-width digits. Once you see the shape, you find it in IP routers, file systems and functional languages, all answering the chapter’s question: how do you index a huge, mostly empty key space without paying for the empty parts?

::scene two-level

## What chapter 20 built

::chapter vm-smalltables

The chapter starts from a linear page table: an array indexed by virtual page number (VPN). Lookup is one memory access. But a 32-bit address space with 4 KB pages and 4-byte entries needs a 4 MB array per process, almost all of it invalid entries.

The fix is to chop the array into page-sized pieces, drop the pieces that are entirely invalid, and add a page directory that says which pieces exist. In the chapter’s small example, a 14-bit address splits into a 4-bit page-directory index, a 4-bit page-table index and a 6-bit offset.

::scene radix

Look at that procedure without the hardware vocabulary:

- The key (the VPN) is cut into fixed-width **digits**: 4 bits, then 4 bits.
- Each level is an array with one slot per possible digit value: 16 slots.
- The first digit picks a slot in the root. That slot is either empty or points to a node one level down. The second digit picks a slot in that node.
- An empty slot near the top stands for a whole range of keys that do not exist. Nothing below it is allocated.

That is the definition of a radix tree. The “radix” is the number of values a digit can take, 16 here. The height is the key length divided by the digit width, whatever the number of keys stored. No comparisons happen: each step is an array index computed by shifting and masking. So there is nothing to rebalance either. A binary search tree must rotate to stay balanced; a radix tree is balanced by construction.

::scene x86

## The x86-64 version, by the numbers

Real hardware picks the digit width so that one node fills exactly one page. On x86-64 a page-table entry is 8 bytes and a page is 4 KiB, so a node holds 512 entries and each digit is 9 bits. Four digits plus a 12-bit offset cover 48 bits of virtual address:

| level (Linux name) | address bits | entries per node | one entry maps |
|---|---|---|---|
| PGD (x86: PML4) | 47–39 | 512 | 512 GiB |
| PUD (x86: PDPT) | 38–30 | 512 | 1 GiB |
| PMD (x86: PD) | 29–21 | 512 | 2 MiB |
| PTE (x86: PT) | 20–12 | 512 | 4 KiB |

Take a stack address such as `0x7ffde3a45b10`. Shift and mask nine bits at a time and you get the indices 255, 503, 285 and 69, then the offset `0xb10`. The walk reads entry 255 of the top-level table, follows it to a second table and reads entry 503, and so on: four dependent memory reads before the data itself. Newer CPUs add a fifth level for 57-bit addresses, which is the subject of [Four levels, then five](/notes/five-level).

[[riscv|RISC-V]] names the shape outright: Sv39, Sv48 and Sv57 are three, four or five 9-bit digits on top of a 12-bit offset. Linux’s own code is written against a generic five-level tree (PGD, P4D, PUD, PMD, PTE). On a machine with fewer hardware levels the missing ones are *folded*: the generic code still steps through five levels, but the folded steps compile to nothing.

:::fold What sparseness costs, worked out
::scene sparse

The radix tree’s promise is that you pay only for the parts of the key space you use. It is worth checking how literally that holds.

A linear table for a 48-bit address space with 4 KiB pages has 2^36^ entries. At 8 bytes each, that is 512 GiB per process. Nobody builds that.

Now map one isolated 4 KiB page far from anything else. The root table always exists, and the walk needs one table at each of the three lower levels: 3 × 4 KiB = 12 KiB of page tables to map 4 KiB of data. In the worst case, overhead is three times the payload.

Now map a dense 1 GiB region, aligned. It needs 512 leaf tables (one per 2 MiB), one PMD table and one PUD table: 514 pages, a little over 2 MiB. Overhead is about 8 bytes per 4 KiB page, or 1/512, roughly 0.2%.

So the cost depends on *clustering*, not just on the amount mapped. Real address spaces are a few dense regions (code, heap, libraries, stack) separated by vast holes, the case the radix tree handles best.

::scene huge

[[huge-page|Huge pages]] stop the walk early. A PMD entry with the page-size bit set maps 2 MiB directly, with no leaf table under it. In radix-tree terms, the value sits in an interior node and every key with that 27-bit prefix finds it. That idea returns below, in routing tables; [TLB reach and huge pages](/notes/huge-pages) covers what it does for the TLB.
:::

::scene two-level

## Try the walk

The lab below is the chapter’s two-level example: a 16 KB address space with 64-byte pages, so a 4-bit directory index, a 4-bit table index and a 6-bit offset.

::lab MultiLevel

Things to try:

- Start with `0x3F80`. Watch the address split into digits 15, 14 and an offset of 0, and the walk descend two levels. That is a radix-tree lookup with radix 16.
- Pick `0x2000`. The directory slot for digit 8 is empty, and the walk stops after one read. In a radix tree, a null pointer high up answers “not present” for every key below it at once.
- Compare the two sizes under the address space: 1,024 bytes for the linear table, 192 for the two-level one. The saving is the 14 page-table pages that were never allocated, because their part of the key space is empty.
- Count the memory references on a TLB miss: two for the walk, one for the data. Each extra level costs one more read, which is why hardware also caches interior entries (Intel calls these [[page-walk-cache|paging-structure caches]]).

::scene pagecache

## The page cache: one radix tree per file

When a process reads byte 10,000,000 of a file, the kernel needs the cached page that holds it, if there is one. The key is the page index within the file: 10,000,000 / 4,096, so page 2,441. A large database file may have only scattered pages cached. A huge, mostly empty key space looked up by integer index: the page table’s problem, so the page table’s answer.

In early 2002, during the 2.5 development series, Momchil Velikov’s “radix-tree pagecache” patch, posted in updated form by Christoph Hellwig, gave each file its own radix tree in place of a hash-table design. Linus Torvalds replied that it “looks good” and asked to see numbers. The tree’s code lives in `lib/radix-tree.c`, whose copyright line still begins “2001 Momchil Velikov”.

The XArray kept that tree and gave it an array’s interface: store at an index, load from an index, find the next present entry after an index. The kernel documentation is blunt about who it is for: “The most important user of the XArray is the page cache.” Each node holds 64 slots, a 6-bit digit, on a normal kernel configuration.

::scene xarray

The XArray differs from a hardware page table in two ways, both instructive.

- **Variable height.** A page table has a fixed number of levels. An XArray grows taller only when an index outgrows the current tree. With 64 slots per node, one level covers 64 pages of a file, two levels 4,096, three levels 262,144 (1 GiB of 4 KiB pages). A small file pays for a small tree.
- **Summary bits in interior nodes.** Every entry can carry three marks; the page cache uses them for “[[writeback|dirty]]”, “under writeback” and “to write”. Each interior node keeps, per mark, a bitmap of which children have a marked entry somewhere below, so finding a file’s dirty pages skips every subtree whose bit is clear. This is chapter 20’s page directory entry again: a valid PDE means at least one PTE below it is valid.

:::fold What an XArray node looks like
This is the node structure from `include/linux/xarray.h` in Linux 6.12, unchanged apart from layout:

```c
struct xa_node {
	unsigned char	shift;		/* Bits remaining in each slot */
	unsigned char	offset;		/* Slot offset in parent */
	unsigned char	count;		/* Total entry count */
	unsigned char	nr_values;	/* Value entry count */
	struct xa_node __rcu *parent;	/* NULL at top of tree */
	struct xarray	*array;		/* The array we belong to */
	union {
		struct list_head private_list;	/* For tree user */
		struct rcu_head	rcu_head;	/* Used when freeing node */
	};
	void __rcu	*slots[XA_CHUNK_SIZE];
	union {
		unsigned long	tags[XA_MAX_MARKS][XA_MARK_LONGS];
		unsigned long	marks[XA_MAX_MARKS][XA_MARK_LONGS];
	};
};
```

`XA_CHUNK_SIZE` is `1 << XA_CHUNK_SHIFT`, and `XA_CHUNK_SHIFT` is 6, or 4 on kernels built with `CONFIG_BASE_SMALL`. `XA_MAX_MARKS` is 3; `include/linux/fs.h` names them `PAGECACHE_TAG_DIRTY`, `PAGECACHE_TAG_WRITEBACK` and `PAGECACHE_TAG_TOWRITE`. Read the fields as a page-table designer would. `shift` says which digit of the index this node consumes, the job the hardware does with a fixed bit range per level. `slots` is the array of children or entries. `marks` are the summary bits. `count` lets the kernel free a node when its last entry goes, the software version of releasing a page-table page whose PTEs are all invalid.

::scene shadow

Slots need not hold pointers. An entry can be a small integer, a *value entry*, told apart from a pointer by its low bits. The page cache uses this to leave a *[[shadow-entry|shadow entry]]* in the slot of a page it evicts, recording when the eviction happened, so that a quick re-read reveals a bad eviction (see [Nobody implements real LRU](/notes/approx-lru)). A non-present PTE plays the same trick: its other bits are free, and Linux stores the [[swap|swap location]] there.
:::

The same structure keeps turning up in memory management. [[zswap|zswap]], the compressed swap cache described in [Swapping today](/notes/zram-oom), finds a compressed page by its [[swap|swap offset]], and its documentation says the mapping “is achieved with an xarray per swap type.” Swap offsets are integers in a large, sparse range, so the radix tree fits again.

::scene lpm

## Routing tables: a radix tree with longest-prefix match

A router faces a related problem with a twist. Its table holds [[ip-prefix|prefixes]] such as `10.0.0.0/8` and `10.1.2.0/24`, and for each packet it must find the *longest* prefix that matches the 32-bit IPv4 destination.

Write the prefixes into a binary trie, one bit per level, and [[longest-prefix-match|longest-prefix match]] is a walk down the tree that remembers the last node carrying a route. That is a radix tree with radix 2, and its height of 32 is far too deep for a fast path. Two ideas make it practical.

The first is **wider digits**. Linux’s IPv4 [[forwarding-table|forwarding table]] is an [[lc-trie|LC-trie]], and has been the only implementation since the older hash-based one was removed in 2011. The design comes from Stefan Nilsson and Gunnar Karlsson’s paper *IP-address lookup using LC-tries* (IEEE JSAC, 1999). Level compression replaces a run of full binary levels with one node whose child array is indexed by several bits at once, and the kernel’s `inflate()` and `halve()` resize those arrays as routes come and go. A page table always uses 9-bit digits because the hardware fixed them. The LC-trie picks the digit width per node, from the data.

The second is **skipping**. Path compression lets a node jump over “skipped bits” that every key below it shares, so the search must check the full key stored at the leaf. Page tables have no equivalent: the hardware consumes every digit.

::scene dir24

The other classic design looks even more like chapter 20. [[dpdk|DPDK]], a packet-processing library used in software routers, implements longest-prefix match with a variation of the DIR-24-8 scheme from Gupta, Lin and McKeown’s 1998 INFOCOM paper. It is a two-level table:

- `tbl24` has 2^24^ entries, indexed by the top 24 bits of the address. An entry holds either the next hop itself or the index of a `tbl8` group, plus a valid flag.
- Each `tbl8` group has 2^8^ entries, indexed by the last 8 bits. It exists only for 24-bit prefixes that have longer routes under them.

Read that with chapter 20 open. `tbl24` is the page directory. A `tbl8` group is a page of the page table, allocated only where needed. An entry holding the next hop directly is a [[huge-page|huge page]]: the lookup ends a level early. A route shorter than 24 bits is handled by *prefix expansion*, copying the entry into every slot it covers (16 slots for a /20, in the DPDK guide’s example). The result, in the page-table designer’s currency: one memory read for most lookups, two for the rest.

:::fold Why page tables do not do longest-prefix match (except that they do)
::scene huge

A page-table walk looks like exact-match lookup: every VPN maps to at most one translation. But consider what a 2 MiB mapping on x86-64 is. The PMD entry with the page-size bit set is reached by the top 27 bits of the virtual address (9 + 9 + 9). Every address that shares those 27 bits is translated by that one entry. That is a route for a /27 prefix of the 48-bit address space.

The difference from a router is that the hardware never has to *choose* between overlapping prefixes. A range is mapped either by a huge page or by a leaf table, never both, so the first leaf entry the walk meets is the answer. A router’s table really does hold `10.0.0.0/8` and `10.1.2.0/24` at once. DIR-24-8 resolves the overlap at update time: installing the /24 overwrites the slots that used to say “use the /8”. The LC-trie resolves it at lookup time: on a miss, the kernel’s notes say, the search keeps “chopping off” the lowest set bit of the child index and backtracks up the trie.

Resolving overlaps at update time keeps lookups fast and predictable. The MMU goes further and makes overlap impossible.
:::

::scene inode

## More of the same shape

A few more places to recognise it, briefly:

- **File systems (Part III of the book).** A classic Unix [[inode|inode]] holds a few direct block pointers, then a pointer to an indirect block full of pointers, then a double-indirect block, then a triple. That is a radix tree over the file’s block numbers, with variable depth. With 4 KB blocks and 4-byte block numbers, an indirect block holds 1,024 pointers, as many as a 32-bit x86 page directory.
- **[[persistent-vector|Persistent vectors]].** Clojure’s immutable vector is a 32-way trie indexed by 5-bit chunks of the element’s position. An update copies only the path from root to leaf and shares every other node with the old version: [[copy-on-write|copy-on-write]] applied to the nodes of a radix tree.

The shape does not fit everything. Linux’s set of a process’s [[vma|memory regions (VMAs)]], each a range such as “the heap, from here to there”, moved from a [[red-black-tree|red-black tree]] to the *[[maple-tree|maple tree]]*, a [[b-tree|B-tree]] variant designed for ranges, in Linux 6.1. A process has dozens or hundreds of VMAs with arbitrary boundaries, and cutting their addresses into fixed digits would waste nodes. Radix trees suit many keys packed into clusters; range trees suit a few long intervals.

::scene depth

## Where it bends: depth is the price

Every level of a radix tree is a dependent memory read: you cannot fetch level three until level two says where it is. For page tables this shapes the whole memory system:

- The TLB exists so that most accesses skip the walk entirely ([chapter 19](/virtualization/vm-tlbs)).
- Paging-structure caches keep upper-level entries, so a miss can restart near the bottom of the tree.
- Under [[nested-paging|hardware virtualization]] the guest’s tree is walked through the host’s, and the worst case grows to 24 memory references (see the [five-level note](/notes/five-level)).

Chapter 20 also describes the alternative: an inverted page table searched through a hash, as on the PowerPC. Hashing gives up order and gains one probe in the common case. The debate never ended. In *Hash, Don’t Cache (the Page Table)* (SIGMETRICS 2016), Idan Yaniv and Dan Tsafrir argued that a hashed page table that packs neighbouring pages’ entries into one [[cache-line|cache line]] can beat x86-64’s four-reference radix walk. The page cache moved the other way in 2002, for scalability, and gained ordered iteration (“the next cached page after this offset”), which a hash cannot give. Which shape wins depends on the operations you need.

::scene overview

## The thread through the book

Follow the shape back through the chapters:

1. **Chapter 18** gives you a linear page table: a radix tree with one level and one digit as wide as the whole VPN.
2. **Chapter 19** caches the result of a lookup in the TLB, so the tree is walked only on a miss.
3. **Chapter 20** cuts the digit into pieces, and empty subtrees disappear. Each extra level costs a memory read on a miss.
4. **Chapters 21 and 22** put more in the leaves: present bits, swap locations in non-present entries, accessed and dirty bits for the replacement policy. x86 also sets accessed bits in interior entries, and Linux’s [[mglru|multi-generational LRU]] uses them to skip page-table subtrees nobody touched: the XArray’s summary-bit trick again.
5. **Part III** uses the same tree for file blocks, and the page cache between file systems and memory is one more radix tree, keyed by file offset.

When a system must map a large integer key space, mostly empty and clustered where used, to small fixed-size records, expect a radix tree. It may be called a page table, an XArray, a trie, an indirect block or a forwarding table.

## Further reading

- [Page Tables](https://docs.kernel.org/mm/page_tables.html): the kernel’s documentation of its five-level generic tree, folding, and huge mappings at higher levels.
- [XArray](https://docs.kernel.org/core-api/xarray.html): Matthew Wilcox’s documentation of the API, marks, value entries and multi-index entries.
- [The XArray data structure](https://lwn.net/Articles/745073/) (LWN, January 2018): why the radix tree got a new interface rather than a new implementation.
- [Radix-tree pagecache patch](https://static.lwn.net/2002/0110/a/radix-tree.php3) (January 2002): the patch that put per-file radix trees under the page cache, as archived by LWN.
- [LC-trie implementation notes](https://docs.kernel.org/networking/fib_trie.html): node types, path and level compression, and the backtracking search in Linux’s IPv4 FIB.
- [DPDK LPM library](https://doc.dpdk.org/guides/prog_guide/lpm_lib.html): the DIR-24-8 variant, tbl24 and tbl8, and prefix expansion.
- Stefan Nilsson, Gunnar Karlsson: *IP-address lookup using LC-tries*, IEEE Journal on Selected Areas in Communications, 1999.
- Pankaj Gupta, Steven Lin, Nick McKeown: *Routing Lookups in Hardware at Memory Access Speeds*, IEEE INFOCOM 1998: the DIR-24-8 design.
- Idan Yaniv, Dan Tsafrir: *Hash, Don’t Cache (the Page Table)*, ACM SIGMETRICS 2016: the case for hashed page tables against radix walks.
