---
deck: A GPU serving a language model has a memory-management problem that chapter 18 already solved, and vLLM solved it again by copying the chapter almost line for line.
title: PagedAttention: virtual memory for LLM KV caches
---

::scene overview

In June 2023 a team at UC Berkeley announced [[vllm|vLLM]], the serving system that had been running the [[vicuna|Vicuna demo and Chatbot Arena]] for the previous two months. Their blog post opened with a measurement: existing systems wasted 60% to 80% of the memory set aside for each request's [[kv-cache|KV cache]], through fragmentation and over-reservation. With their design, waste was under 4%. The paper behind it, by Woosuk Kwon, Zhuohan Li and colleagues, appeared at [[sosp|SOSP]] that October under the title *Efficient Memory Management for Large Language Model Serving with PagedAttention*.

The paper is plain about where the idea comes from: think of blocks as pages, [[llm-token|tokens]] as bytes and requests as processes. This piece follows that analogy: why contiguous allocation fails as chapters 15 and 16 predict, how the fix maps onto chapter 18, and what the paper did and did not measure.

::scene kvcache

## The KV cache, and why it is large

A [[transformer|transformer]] generates text one token at a time. To produce token *t*, every layer's [[attention|attention]] compares the current token against the *keys* and *values* computed for all earlier tokens of the same request. Recomputing them at every step would repeat nearly all the work done so far, so servers keep them: this is the **KV cache**. It belongs to one request, lives as long as the request does, and grows by one token's worth at every step.

The paper works out the size for [[opt-13b|OPT-13B]]. Each token needs a key and a value vector (2), of [[hidden-size|hidden size]] 5,120, in each of 40 layers, at 2 bytes per number:

> 2 × 5,120 × 40 × 2 bytes = 819,200 bytes ≈ 800 KB per token

A request that reaches the model's 2,048-token limit needs about 1.6 GB. On a 40 GB [[gpu|A100]], the paper's breakdown puts about 65% of memory into the model's [[model-parameters|weights]] and close to 30% into the KV cache. That works out to roughly 12 GB, enough for only about seven requests at full length. The paper's own summary is that even with all available memory given to the KV cache, only a few tens of requests could be accommodated.

Generation is [[memory-bound|memory-bound]]: each step reads all the weights to produce one token per request, so a GPU is used well only by batching many requests, and the batch is limited by how many KV caches fit. The paper notes that compute is growing faster than memory: from A100 to H100, [[flops|FLOPS]] more than doubled while memory stayed at 80 GB at most. Wasted KV cache means requests left out of the batch.

::scene contiguous

## Contiguous allocation: chapters 15 and 16 again

Deep-learning frameworks like their [[tensor|tensors]] contiguous, so earlier serving systems stored each request's KV cache as one contiguous region. The final length of a request is unknown when it starts, so they reserved a region for the *maximum possible* length.

::chapter vm-paging

The paper names three kinds of waste, and each has a name in the book:

- **Reserved slots.** Space for tokens the request will generate later. It will be used eventually, but while it waits it holds memory that another request could have used now.
- **Internal fragmentation.** Space for tokens the request will *never* generate, because it stops long before the maximum. This is chapter 15's waste in base and bounds: one allocation sized for the whole address space, with an unused gap in the middle.
- **External fragmentation.** Gaps between the regions of different requests, left by an allocator handing out variable-sized chunks. This is chapter 16's problem with segments and chapter 17's whole subject.

The paper measured how bad this is. In its reimplementations of existing systems, only 20.4% to 38.2% of KV-cache memory held actual token state. The rest was reservation and fragmentation.

::scene blocks

## Blocks and block tables

PagedAttention applies chapter 18 directly:

- The KV cache is divided into **KV blocks**, each holding the keys and values of a fixed number of tokens. The default is 16.
- Each request sees a sequence of **logical blocks**, numbered 0, 1, 2, … in token order, just as a process sees pages 0, 1, 2, … of its address space.
- GPU memory is divided into **physical blocks**, like page frames. Any physical block can hold any logical block.
- A per-request **block table** maps logical to physical blocks. Each entry also records how many of the block's slots are filled.

Physical blocks are allocated on demand, as a request's tokens fill the previous one, so nothing is reserved for tokens not yet generated. Every block but the last is full, so waste is under one block per request, and external fragmentation disappears because any free block will do.

Here is the paper's worked example, with a block size of 4 to keep it small. A request arrives with a 7-token prompt.

::scene grow

| step | event | logical 0 | logical 1 | logical 2 |
|---|---|---|---|---|
| prompt | 7 tokens stored | physical 7, 4 filled | physical 1, 3 filled | none |
| decode 1 | token 8 written | physical 7, 4 filled | physical 1, 4 filled | none |
| decode 2 | token 9 needs a new block | physical 7, 4 filled | physical 1, 4 filled | physical 3, 1 filled |

Logical blocks 0 and 1 land in physical blocks 7 and 1, which are not adjacent and do not need to be. The first generated token fills the last free slot of physical block 1. The second finds logical block 1 full, so the block manager allocates a free physical block (3) and adds an entry to the table. Every step is a table update. Nothing is copied.

::scene walk

The cost moves into the attention computation. A standard attention kernel reads one contiguous tensor of keys and values. PagedAttention's kernel walks the block table and fetches keys and values block by block from wherever they live. That is a software page-table walk on every attention call. The paper measured the kernel at 20% to 26% higher latency than [[fastertransformer|FasterTransformer]]'s contiguous kernel. The authors argue the end-to-end effect is small, because only the attention operator is affected.

:::fold From token position to physical slot
::scene split

The translation is chapter 18's address split, with token positions in place of byte addresses. With block size *B*:

```py
# pseudo-code: where does token t of a request live?
def kv_slot(block_table, t, B=16):
    logical = t // B          # like the VPN
    offset  = t % B           # like the page offset
    physical = block_table[logical]
    return physical, offset   # keys/values at kv_pool[physical][offset]
```

When *B* is a power of two, the division and remainder are a shift and a mask, exactly like splitting a virtual address into page number and offset.

The attention kernel for one new token then looks roughly like this:

```py
# pseudo-code: attention over a paged KV cache, one query, one layer
def paged_attention(q, block_table, n_tokens, kv_pool, B=16):
    scores, values = [], []
    for logical in range((n_tokens + B - 1) // B):
        k_blk, v_blk = kv_pool[block_table[logical]]     # gather one block
        filled = min(B, n_tokens - logical * B)
        scores += [q @ k_blk[i] for i in range(filled)]
        values += [v_blk[i] for i in range(filled)]
    w = softmax(scores)
    return sum(wi * vi for wi, vi in zip(w, values))
```

The real kernel processes blocks in parallel across GPU threads and keeps running [[softmax|softmax]] statistics instead of materialising every score, but the indirection is the same: one table lookup per block, not per token. That is why block size matters. Bigger blocks mean fewer lookups and longer contiguous reads, and more waste in the last block.
:::

::scene split

## Watch the address split

The paging lab from this chapter shows the translation PagedAttention uses. Read it with the analogy in mind: the 64-byte address space is one request's token positions, each 16-byte page is a KV block of 16 token slots, and the page table is the request's block table.

::lab Paging

Things to try:

- Slide the virtual address from 0 to 63 and watch the two parts. The top two bits pick the logical block, and the bottom four bits, the slot within the block, are copied through unchanged.
- Note where the four pages land: frames 3, 7, 5 and 2. Consecutive logical blocks are scattered across physical memory, and nothing about the computation cares. That scattering is what lets vLLM allocate any free block to any request.
- Imagine the request growing by one token past address 63. In the lab's fixed table there is no page 4. In vLLM the block manager would take any free frame and append one entry to the table. Growing costs one table entry, never a copy.

The lab is a simplified paging model with byte addresses, not a model of a GPU. The arithmetic is the same.

::scene share

## Sharing: copy-on-write and prefixes

Fixed-size blocks behind a table do more than remove fragmentation. As in an operating system, they make **sharing** cheap. The paper uses this in three ways.

**Parallel sampling.** Ask for several completions of one prompt and the samples share the prompt. vLLM stores the prompt's KV blocks once and points every sample's block table at them, keeping a **[[reference-count|reference count]]** per physical block. In the paper's example two samples share physical blocks 7 and 1, each with a reference count of 2. When a sample wants to write into a shared block, its last, partly filled one, vLLM applies **[[copy-on-write|copy-on-write]] at block granularity**: allocate a new block, copy the data, point this sample's table at the copy and decrement the original's count. It is [[fork-exec|`fork()`]] in miniature, and the same mechanism Redis relies on for snapshots (see [the fork() note](/notes/fork-redis)).

**Beam search.** Beam search keeps several candidate continuations and repeatedly discards some and extends others. Candidates share not only the prompt but long stretches of generated text, and the sharing pattern changes as beams fork and die. With block tables, forking a beam is copying a small table and bumping reference counts. A dropped beam decrements them, and blocks whose count reaches zero return to the free list.

::scene prefix

**Shared prefixes.** Many requests begin with the same [[system-prompt|system prompt]] or examples. The paper lets a provider reserve physical blocks for predefined prefixes and map them into new requests' tables, so the prefix is computed once. Later vLLM versions generalised this into *automatic prefix caching*: each full block is identified by a [[hash|hash]] of its tokens and of the previous block's hash, so a hash names a whole prefix, and new requests reuse every matching block. Cached blocks with no users wait in a [[lru|least-recently-used]] free queue until memory is needed: a [[page-cache|page cache]] for prompts. [[sglang|SGLang]]'s RadixAttention organises the same reuse as a tree of prefixes (see the [radix tree note](/notes/radix-trees)).

:::fold Copy-on-write, one block at a time
::scene share

Follow the paper's parallel-sampling example with block size 4: a 7-token prompt and two samples, A and B.

1. **Prompt phase.** The prompt fills logical blocks 0 and 1, stored in physical blocks 7 and 1. Both samples' block tables point to 7 and 1, and each block has reference count 2. Only one copy of the prompt's keys and values exists.
2. **A generates its first token.** It belongs in the last slot of logical block 1, but physical block 1 is shared (count 2). vLLM allocates a new physical block, say 3, copies block 1's three filled slots into it, writes A's token into the fourth slot, points A's logical block 1 at 3, and decrements block 1's count to 1.
3. **B generates its first token.** Block 1 now has count 1, so B owns it outright and writes in place. No copy.
4. **Both continue.** Each new block either sample allocates from now on is private from the start. Block 7, the first four prompt tokens, stays shared for the life of both samples.

Only one block was ever copied, and only the part of the prompt that did not fill a whole block. The longer the prompt, the larger the shared fraction. The savings the paper measured, below, depend heavily on the workload's prompt and output lengths.
:::

::scene evict

## When memory runs out: swapping and recomputation

Allocating on demand means memory can run out in the middle of a request's generation, so vLLM has to preempt. Its choices are chapter 21's.

It schedules requests first-come, first-served, so when blocks run out the most recently arrived requests are preempted first. Eviction is **all-or-nothing**: a sequence's blocks are evicted together, because a request missing any of its KV cache cannot take a step. Sequences that share blocks, like the candidates of one beam search, are scheduled and preempted together as a *sequence group*.

An evicted request's blocks can go two ways:

- **Swapping.** Copy the blocks to CPU memory, the request's [[swap|swap space]], and copy them back when it is rescheduled.
- **Recomputation.** Throw the blocks away and regenerate them later by running the prompt and the tokens generated so far through the model again in one pass.

Recomputation works because the KV cache is derived data: like a [[clean-page|clean page]] of a file, it can be rebuilt from its source. The paper found swapping costly with small blocks, because it means many small transfers between CPU and GPU, while recomputation's cost does not depend on block size. For block sizes 16 to 64 the two performed comparably end to end.

::scene measured

## What the paper actually measured

The headline is 2–4× higher throughput than FasterTransformer and [[orca|Orca]] at the same latency.

The setup used OPT-13B, 66B and 175B, plus [[llama|LLaMA-13B]] for the shared-prefix experiment, on Google Cloud A100s: one 40 GB GPU for 13B, four for 66B, eight 80 GB GPUs for 175B. Workloads were traces from the [[sharegpt-alpaca|ShareGPT and Alpaca]] datasets with [[poisson|Poisson arrivals]] at varying rates, run for one hour (15 minutes for 175B, to limit cost). The metric was *normalized latency*: each request's end-to-end latency divided by its output length, averaged. Throughput is, roughly, the request rate a system sustains before that latency shoots up.

The baselines need a note. Orca was not publicly available, so the authors implemented their own version in three variants that differ only in how much they reserve per request. *Orca (Max)* reserves up to the 2,048-token maximum. *Orca (Pow2)* over-reserves by at most 2×. *Orca (Oracle)* is told each request's true output length in advance, which no real system knows. FasterTransformer had no scheduler of its own, so they wrote one.

:::fold The numbers, and what each one compares
- **Request rate, ShareGPT.** 1.7× to 2.7× higher than Orca (Oracle), and 2.7× to 8× higher than Orca (Max), at similar latency. Up to 22× higher than FasterTransformer.
- **Batch size.** On OPT-13B with ShareGPT, vLLM processed 2.2× more requests at once than Orca (Oracle) and 4.3× more than Orca (Max).
- **Memory used by token state.** 20.4% to 38.2% in the Orca variants. The blog post gives under 4% waste for vLLM.
- **Memory saved by sharing.** Parallel sampling: 6.1% to 9.8% on Alpaca, 16.2% to 30.5% on ShareGPT. Beam search: 37.6% to 55.2% on Alpaca, 44.3% to 66.3% on ShareGPT.
- **Gain over Orca (Oracle) by decoding method,** OPT-13B on Alpaca: from 1.3× for basic sampling up to 2.3× for beam search with width 6.
- **Shared prefix,** LLaMA-13B translation: 1.67× throughput over Orca (Oracle) with a one-shot prefix and 3.58× with a five-shot prefix.
- **Cost.** The attention kernel alone is 20% to 26% slower than FasterTransformer's.

Two cautions. The comparison against Orca (Oracle) is the fair one for the memory manager, because Oracle reserves exactly what each request needs and so isolates fragmentation and sharing. The larger multiples come from baselines that reserve the maximum. And the blog's "up to 24× higher throughput" compares against Hugging Face Transformers, a general-purpose model library rather than a serving system, which is a different claim from the paper's.
:::

::scene bends

## Where it bends

The design has the trade-offs of paging, and each has a counterpart in the book.

- **Block size.** Blocks too small underuse the GPU's parallelism; blocks too large waste more of each last block and share less. On ShareGPT 16 to 128 tokens worked best, on Alpaca's shorter sequences 16 and 32, and the default became 16: chapter 18's page-size trade-off on a new workload, which the [fixed-vs-variable thread](/notes/fixed-vs-variable) follows elsewhere.
- **Translation in software.** The block-table lookup lives inside every attention kernel, so every new kernel has to be written for paged memory. vAttention (Prabhu et al., ASPLOS 2025) argues for the CPU's approach instead: use the GPU's virtual-memory support to give each request a contiguous virtual range and map physical memory into it on demand. It reports up to 1.23× higher throughput than PagedAttention-based kernels from [[flashattention|FlashAttention and FlashInfer]]. Contiguity in virtual space and paging underneath are exactly what chapter 18 gives a process.
- **Scheduling.** Memory management decides how many requests fit. Which ones run, and when, is a scheduling question. vLLM builds on iteration-level scheduling, which re-forms the batch at every step, the subject of the [convoy-effect note](/notes/llm-convoy). Freed blocks and admitted requests are two sides of the same decision.

::scene overview

## The thread back to the book

Line up chapter 18 and the paper and almost every term has a partner:

1. **Page** ↔ KV block, **page frame** ↔ physical block, **page table** ↔ block table.
2. **Demand allocation** ↔ a new block only when the last one is full.
3. **Copy-on-write after `fork()`** ↔ reference-counted blocks shared between samples and beams.
4. **Swap space and page replacement** ↔ swapping blocks to CPU memory, or recomputing them.
5. **Page cache** ↔ prefix caching of shared prompt blocks.

The book traces paging to the Atlas computer of the early 1960s. The problem it solved there was the one PagedAttention solved on GPUs: many independent, growing regions of unknown final size, competing for one physical memory. When a problem has that shape, chapter 18's answer works again.

## Further reading

- Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang, Ion Stoica: [*Efficient Memory Management for Large Language Model Serving with PagedAttention*](https://arxiv.org/abs/2309.06180), SOSP 2023.
- [vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention](https://vllm.ai/blog/2023-06-20-vllm) (vLLM blog, June 2023): the announcement, with the 60–80% and under-4% figures.
- [Automatic prefix caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html) in vLLM's design documentation: block hashing and eviction.
- Ramya Prabhu, Ajay Nayak, Jayashree Mohan, Ramachandran Ramjee, Ashish Panwar: [*vAttention: Dynamic Memory Management for Serving LLMs without PagedAttention*](https://arxiv.org/abs/2405.04437), ASPLOS 2025.
- Lianmin Zheng et al.: [*SGLang: Efficient Execution of Structured Language Model Programs*](https://arxiv.org/abs/2312.07104), 2023: RadixAttention for prefix reuse.
