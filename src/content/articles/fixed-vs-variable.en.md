---
deck: Every layer that hands out space chooses between pieces that fit and pieces that are easy to manage. The answer keeps being "both, with a table in between".
title: Variable-size vs. fixed-size: the trade-off that keeps coming back
---

::scene overview

In 1968 Brian Randell, then at IBM's research centre in Yorktown Heights, ran a series of simulations of storage allocation. The book cites the journal version of his paper [R69] in this chapter as one of the earliest discussions of fragmentation. The paper separates the two ways memory goes to waste. **External fragmentation** is free space broken into pieces too small to use. **Internal fragmentation** is what you lose by rounding a request up instead of giving out exactly the amount asked for.

His most striking result went against the direction computing was about to take. Rounding requests up to a few standard sizes, he found, generally lost more memory to internal fragmentation than it saved in external fragmentation. Measured in bytes alone, variable-size allocation won.

Paging spread anyway, and so did fixed units in `malloc`, file systems, networks and the GPU servers that run [[llm|large language models]]. Each chose a mixture. This thread follows that choice, because the reasons fixed sizes keep winning are mostly not about bytes.

## Two ways to waste space

::scene external

Chapter 16 ends with the problem stated in its purest form. Segments are variable-sized, so as they are created, grown and freed, physical memory fills with holes of odd sizes. The book's example has 20 bytes free in two chunks of 10, and a request for 15 bytes fails. No byte is wasted inside any allocation. The waste is *between* allocations, and it only shows up as a failure later.

::chapter vm-freespace

Chapter 17 is about living with that: free lists, splitting and coalescing, best and worst fit, and the admission that no policy removes external fragmentation.

::scene paging

Chapter 18 takes the other road. Cut the address space into fixed-size **pages** and physical memory into page frames of the same size, and any free frame can hold any page. A request can never fail because the free space is in the wrong shape. The waste moves *inside* allocations instead. A process that needs 4,097 bytes of heap gets two 4 KiB pages and leaves 4,095 bytes unused at the end of the second one. With many regions of random size, the expected loss is roughly half a page per region.

The two kinds of waste behave differently, and that difference matters more than which is bigger:

- **External fragmentation grows with time.** It depends on the history of allocations and frees, it is hard to predict, and in a long-running system it tends to get worse. The only cure is moving live data, which needs every pointer to it updated.
- **Internal fragmentation is bounded by construction.** It is at most one unit per allocation, it does not accumulate, and you can compute it in advance from the unit size.

A bounded, predictable loss is easier to engineer around than a loss that creeps up over weeks. That is the first reason Randell's arithmetic did not settle the question.

::scene buys

## What a fixed size buys

The other reasons are about time and simplicity, and they are why the book calls paging a solution rather than a different compromise.

- **Allocation is a pop.** With identical units, the free list is just a list (or a [[bitmap|bitmap]]). Take the first entry. There is no search, no split, no policy to choose.
- **Placement stops mattering.** Best fit, worst fit and first fit exist because a variable-size request has to go *somewhere suitable*. With fixed units every free slot is equally suitable.
- **Translation becomes arithmetic.** A virtual address splits into a page number and an offset by shifting bits. The page number indexes a table; the offset passes through untouched.
- **Units can be handled one at a time.** A page can be [[swap|swapped out]], shared [[copy-on-write|copy-on-write]], or moved to another frame without anyone else noticing. A segment has to be dealt with whole.

::scene costs

The costs are just as concrete. The first is internal fragmentation. The second is **metadata**: a table entry per unit, so the table grows as units shrink. Chapter 18 computes it for a 32-bit address space with 4 KiB pages: about a million entries, 4 MB per process for a linear [[page-table|page table]], which is why chapter 20 exists. The third is **lost physical contiguity**: an object that spans several units is scattered across memory or disk, and every access has to go through the table.

::scene pattern

Notice what paging did *not* do. It did not abolish the need for contiguous space. A process still sees its heap as one contiguous range. Paging moved the contiguity into the virtual address space, where it costs nothing to provide, and kept physical memory in interchangeable pieces. That is the pattern this thread keeps finding: **variable-size objects, described by a table, built out of fixed-size units.**

:::fold The arithmetic of rounding up
::scene classes

Suppose requests are rounded up to a unit of *u* bytes. If request sizes are spread evenly modulo *u*, the unused tail of the last unit is equally likely to be anything from 0 to *u* − 1 bytes, so the average loss is about *u*/2 per allocation. The worst case is a request one byte larger than a multiple of *u*.

Fixed units are wasteful for small objects and cheap for large ones. A 4 KiB page wastes on average 2 KiB per region whether the region is 10 KiB or 10 GiB.

Allocators therefore round to a *geometric* series of sizes instead of multiples of one unit. Say each power-of-two range [2^n^, 2^n+1^] is split into *k* equally spaced classes, each 2^n^/*k* apart. The worst request is one byte above a class boundary, which wastes almost one spacing. The smallest class it can land in is 2^n^ + 2^n^/*k*, so the worst-case waste fraction is

> (2^n^/k) / (2^n^ + 2^n^/k) = 1 / (k + 1)

With *k* = 1, plain powers of two as in the [[buddy-allocator|buddy allocator]], a request can waste almost half of its block: 1/2. With *k* = 4, the waste is at most about 1/5. [[jemalloc|jemalloc]]'s manual makes exactly that claim: four size classes per doubling limit internal fragmentation to approximately 20%, for all but the smallest classes. In its table, a 257-byte request lands in the 320-byte class and wastes 63 bytes, 19.7% of the block.

More classes means less waste per object but more partly used [[slab-allocator|slabs]], one per class per thread or CPU: external fragmentation again, one level up. Four is a judgement about where those curves cross.
:::

::scene pattern

## The same choice, layer by layer

Once you look for this pattern, it is in almost every system that manages space. The table below lines up the cases this thread visits. In each row the left column is the variable-size thing that users want and the right column is the fixed-size unit the system actually manages.

| layer | variable-size view | fixed-size unit | the table in between |
|---|---|---|---|
| virtual memory | segment, region | page (4 KiB, 2 MiB, 1 GiB) | page table |
| malloc | object of any size | slot in a size class | size-class bins, [[slab-allocator|slab]] metadata |
| kernel memory | physically contiguous block | page, in power-of-two orders | [[buddy-allocator|buddy]] free lists |
| file system | file, extent | block (often 4 KiB) | block map or extent tree |
| network | byte stream | packet, bounded by the MTU | sequence numbers |
| LLM serving | one request's KV cache | block of tokens | block table |

::scene classes

### Inside malloc: size classes

Chapter 17 ends with "other approaches": segregated free lists, the slab allocator, the buddy allocator. Production allocators are built almost entirely from these. A request for 100 bytes is rounded up to a **size class**, and each class is served from runs of memory holding only objects of that size. Inside one run every slot is identical, so there is no external fragmentation there and allocation is a pop. Between runs, of different classes, the variable-size problem remains. It is now coarser and rarer.

This is precisely Randell's rounding, accepted on purpose. Allocators pay a bounded internal loss (the fold above) to make the common path a few instructions long and to make concurrent allocation from many threads cheap. The [note on modern allocators](/notes/allocators) walks through how glibc, [[jemalloc|jemalloc]], tcmalloc, mimalloc and the kernel do it.

::scene hugepage

### The page size itself

The unit size is a dial. x86-64 offers 4 KiB, [[huge-page|2 MiB and 1 GiB pages]]. Bigger pages mean fewer table entries and [[tlb|TLB]] misses, and more internal fragmentation. There is a sneakier cost too. To back a 2 MiB page, the kernel needs 2 MiB of *physically contiguous* memory, so the external-fragmentation problem that paging banished returns inside the kernel's own allocator. The [note on huge pages](/notes/huge-pages) covers the TLB side of this.

:::fold External fragmentation never left
Linux manages physical pages with a buddy allocator: free memory is kept in blocks of 2^order^ pages, typically orders 0 to 10 (4 KiB to 4 MiB with 4 KiB pages). An order-0 request, one page, can always be met if any page is free. A huge page needs an order-9 block on x86-64, and that can fail on a machine with gigabytes free, if every 2 MiB stretch has at least one page in use.

You can watch this on any Linux machine:

```sh
cat /proc/buddyinfo
```

Each line is a [[memory-zone|memory zone]]. Each column is the number of free blocks of one order, from order 0 on the left. A healthy zone has non-zero counts far to the right. A fragmented one has thousands of small blocks and zeros at the high orders. The kernel's own documentation introduces the file by saying that external fragmentation is a problem under some workloads.

The kernel's response is the one chapter 16 describes and dismisses as expensive: **compaction**. It migrates movable pages to one end of a zone to assemble contiguous free blocks. The kernel can do this where `malloc` cannot, because it controls the page tables. Moving a page means copying it and changing one entry, and the process's virtual addresses never change. It also sorts pages by mobility when it allocates them, so that unmovable kernel allocations do not end up scattered through every block. Fixed-size pages did not end the war with external fragmentation. They pushed it down to the one layer that has an indirection table to fight it with.
:::

::scene extents

### Disks: blocks and extents

File systems face the same choice with files. The classic Unix design, still visible in [[ext-fs|ext2 and ext3]], manages the disk in fixed-size blocks and gives each file a map with one pointer per block: twelve direct pointers in the [[inode|inode]], then a single-indirect, a double-indirect and a triple-indirect block. That is a page table for a file, and it has the page table's problems. A large file needs one entry per block even if all its blocks are consecutive on disk.

ext4 replaced the map with **extents**. An extent says "logical blocks *n* to *n* + *len* live at physical block *p*". One extent can describe up to 32,768 blocks, which is 128 MiB with 4 KiB blocks, and the first four extents fit in the inode itself. Larger files get a small tree of extents.

The unit of allocation is still the fixed-size block, and free space is still tracked block by block. What became variable-size is only the *description*, which records runs of consecutive blocks. It keeps metadata small when a file is placed contiguously and costs nothing when it is not: the same move as a huge page.

The cost of the hybrid is that layout matters again. A file written slowly while other files grow can end up in many small extents scattered across the disk. File-system fragmentation is external fragmentation of the extent kind, and tools exist to defragment ext4 online.

:::fold Block map versus extents, in numbers
Take a 1 GiB file stored contiguously on a file system with 4 KiB blocks.

- **Block map (ext2/ext3 style).** The file has 1 GiB / 4 KiB = 262,144 blocks, so it needs 262,144 block pointers. At 4 bytes each, that is 1 MiB of mapping metadata, spread across one double-indirect block and 256 indirect blocks. Reading the end of the file means following the chain through the indirect blocks first.
- **Extents (ext4).** At 32,768 blocks per extent, the same file needs 262,144 / 32,768 = 8 extents, at twelve bytes each 96 bytes in total. Eight no longer fit in the inode's four slots, so ext4 adds one tree level: a single block of extents, instead of 257 blocks of pointers.

For a badly fragmented file the advantage disappears. In the worst case every block is its own extent, and an extent is larger than a block pointer. The extent design is a bet that allocators can usually find contiguous runs, the same bet huge pages make about physical memory.
:::

::scene packets

### Networks: packets and streams

The network replays the trade-off with time instead of space. [[tcp|TCP]] offers a byte stream: one variable-size, unbounded object per connection. Underneath, the network moves packets whose size is bounded by each link's maximum transmission unit (MTU), 1,500 bytes of payload on standard Ethernet. Every [[ip|IPv6]] link must carry at least 1,280 bytes.

Packets are variable-size up to that bound, more like a size class than a page. Oversized packets show variable sizes causing trouble. IPv4 routers could split a packet into fragments mid-path, which made reassembly, loss and filtering much harder. IPv6 removed fragmentation from routers: only the sending host may fragment. [[rfc|RFC 8900]], published as a best-current-practice document in 2020, advises new protocols not to rely on IP fragmentation at all.

The fully fixed-size design was tried too. [[atm|ATM]], the telephone industry's network technology, carried everything in 53-byte cells: a 5-byte header and 48 bytes of payload. Small fixed cells made switch hardware simple and kept the delay a voice call saw behind other traffic short and predictable. The payload size is a compromise between proposals of 32 and 64 bytes. ATM paid the familiar costs: about 9% of every cell is header, and the last cell of each packet is padded. In most networks, bounded variable-size frames, Ethernet and IP, took over from ATM.

::scene kv

### GPUs: KV-cache blocks

The newest replay is on GPUs. While a language model generates text, it keeps a **[[kv-cache|KV cache]]** for each request, about 800 KB per [[llm-token|token]] for a 13-billion-parameter model, and the cache grows by one token's worth at every step. Its final size is unknown until the request ends.

Early serving systems gave each request one contiguous region sized for the maximum possible length: base and bounds from chapter 15, with the internal fragmentation the book describes there, and fragmented free space between requests. The [[vllm|vLLM]] paper (SOSP 2023) measured that in existing systems only 20.4% to 38.2% of KV-cache memory held actual token data.

PagedAttention's answer is chapter 18 applied directly. It cuts the cache into blocks of a fixed number of tokens (16 by default), keeps a per-request **block table** from logical to physical blocks, and hands out blocks on demand. Waste is confined to the last, partly filled block of each request. The [PagedAttention note](/notes/paged-attention) goes through the design and its measurements.

There is a twist. Gathering keys through a block table means changing the [[attention|attention code]] itself. vAttention (ASPLOS 2025) instead uses the GPU's own virtual-memory support to give each request a *contiguous virtual* range, with physical memory mapped in on demand: exactly what a CPU process gets from paging.

::scene external

## Watch external fragmentation happen

The lab from chapter 17 runs a random workload of small allocations and frees on a 100-byte heap. It is the variable-size side of the trade-off, with nothing rounded.

::lab FreeList

Things to try:

- Turn coalescing off and step through until an allocation fails. Then look at the free list. In most runs the total free space is larger than the failed request: that is external fragmentation in its pure form.
- The fragmentation figure the lab shows is 1 − (largest free chunk / total free). It is 0% when all free space is in one piece and approaches 100% when it is shattered. Watch it rise as the run goes on, and compare the policies in the table.
- Now imagine the fixed-size version: every request rounded up to 12 bytes, the largest size this workload asks for. No request could fail while a slot was free, but count the bytes lost in the rounding. With requests spread from 1 to 12 bytes, nearly half of every slot would be empty. That is Randell's result in miniature, and the reason real allocators use many size classes rather than one.

The lab is simplified: real heaps are larger, and real requests cluster around a few sizes, which is why size classes work.

::scene choose

## How to choose the unit

Every system on this thread ends up tuning one number, the unit size, against the same three forces:

1. **Internal waste** grows with the unit: roughly half a unit per object.
2. **Metadata** shrinks with the unit: one entry per unit, in a table that has to be stored and searched.
3. **Contiguity** grows with the unit: bigger units mean fewer pieces per object, fewer table lookups and fewer TLB misses or disk seeks.

The 2023 vLLM paper's block-size experiment shows it cleanly. Very small blocks underuse the GPU's parallelism; very large ones waste space in each request's last block and reduce sharing. Blocks of 16 to 128 tokens did best on one workload, only 16 and 32 on another with shorter sequences, and they chose 16. Page sizes and size classes come from the same kind of measurement.

::scene pattern

And then, nearly always, the system adds a variable-size description on top: extents over blocks, huge pages over base pages, [[span|spans]] over size classes, contiguous virtual ranges over scattered physical memory. Pure fixed-size is too rigid and pure variable-size is too fragile. The design that wins is fixed units for the allocator and variable runs for whoever uses them, with a table in between.

Randell was right about the bytes. It turned out the bytes were the cheap part.

## Further reading

- Brian Randell: *A Note on Storage Fragmentation and Program Segmentation*, IBM Research Report RC 2102, 1968 ([abstract](https://eprints.ncl.ac.uk/161399)); journal version in *Communications of the ACM* 12(7), 1969. The book's [R69], which defines internal and external fragmentation.
- [jemalloc manual](https://jemalloc.net/jemalloc.3.html): the size-class table and the 20% bound on internal fragmentation.
- [/proc/buddyinfo](https://docs.kernel.org/filesystems/proc.html) in the kernel's proc documentation: watching external fragmentation of physical pages.
- [ext4 extent tree](https://docs.kernel.org/filesystems/ext4/ifork.html): the kernel's description of block maps and extents.
- [RFC 8200](https://www.rfc-editor.org/rfc/rfc8200.html) (IPv6, minimum MTU and source-only fragmentation) and [RFC 8900](https://www.rfc-editor.org/rfc/rfc8900.html), *IP Fragmentation Considered Fragile* (2020).
- Woosuk Kwon et al.: [*Efficient Memory Management for Large Language Model Serving with PagedAttention*](https://arxiv.org/abs/2309.06180), SOSP 2023.
- Ramya Prabhu et al.: [*vAttention: Dynamic Memory Management for Serving LLMs without PagedAttention*](https://arxiv.org/abs/2405.04437), ASPLOS 2025.
