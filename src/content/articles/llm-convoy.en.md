---
deck: An LLM server is a scheduler for jobs of wildly different, unknown lengths. It has rediscovered chapter 7 one step at a time, from FIFO to preemption to guessing job lengths.
title: The convoy effect, in LLM serving
---

::scene overview

Send a chatbot a one-line question at the moment someone else asks it for an essay 2,000 [[llm-token|tokens]] long. On some early serving systems, your twenty-token answer could not come back until the essay was done. The [[gpu|GPU]] was not too slow. Both requests had been put in the same batch, and the batch ran until its longest member finished.

In 2022 a paper from Seoul National University and FriendliAI showed how much that cost. Their system, Orca, mainly changed *when* the server makes scheduling decisions. On a GPT-3-sized model with [[model-parameters|175 billion parameters]], it reported 36.9 times the throughput of NVIDIA’s [[fastertransformer|FasterTransformer]] at the same latency. Much of that gain is the difference between two policies you met in chapter 7.

This note follows [[llm|LLM]] serving through the chapter’s sequence: FIFO and the convoy effect, then preemption, then [[round-robin|time slices]], and finally the “no oracle” problem of not knowing how long a job will run.

::scene workload

## The workload, in chapter 7’s terms

::chapter cpu-sched

A [[transformer|transformer]] generates text in two phases. In **prefill**, the model reads the whole prompt in one pass, processing all its tokens in parallel, and produces the first output token. In **decode**, it produces the rest one token at a time. Each step takes the previous token as input, and each step is one *iteration* of the model. A request that will produce 2,000 tokens needs one prefill and about 2,000 decode iterations. Nobody knows that number in advance: generation stops when the model emits an end-of-sequence token.

The GPU also differs from the book’s CPU in one important way. A CPU in chapter 7 runs one job at a time. A GPU runs a **batch**: one iteration can advance many requests by one token each. For decode, batching is close to free. Each decode step reads the model’s weights from memory to produce one token per request. Reading them once for 32 requests costs little more than reading them for one. The Anyscale team, measuring this in 2023, described LLM inference as “[[memory-bound|memory-IO bound]], not compute bound.” So the GPU is less like a single checkout clerk and more like a bus. Throughput comes from filling the seats.

With that change in mind, the vocabulary maps closely onto chapter 7:

| chapter 7 | LLM serving |
|---|---|
| job | request |
| run time | prefill of the prompt, plus one decode iteration per output token |
| known in advance? | prompt length yes, output length no |
| turnaround time | end-to-end latency |
| [[response-time|response time]] | time to first token (TTFT) |
| time slice | one iteration: one token for every request in the batch |
| context-switch cost | preemption: the request’s KV cache is swapped out or recomputed |

::scene kv

The last row needs a word. While generating, the model keeps a **KV cache** for every request: the [[attention|attention]] keys and values of every token so far, which can run to many megabytes per request. Stopping a request and resuming it later means keeping that cache somewhere or rebuilding it. How the cache is laid out in GPU memory is [its own story](/notes/paged-attention). Here it matters only as the price of preemption.

::scene static

## Static batching: FIFO with seats

The first generation of serving systems scheduled **whole requests**. The server collected a batch, handed it to the model engine, and waited until every request in it was done before forming the next batch. Orca’s authors name the two problems this causes: requests that finish early cannot return to the client, and requests that arrive after the batch starts must wait until it completes.

Here is a simplified example in iterations. It assumes every iteration takes the same time and ignores prefill. A batch has four seats. Request A will produce 2,000 tokens; B, C and D will produce 20 each. E, another 20-token request, arrives just after the batch starts.

- **Static batching.** The batch runs for 2,000 iterations. B, C and D are finished after 20, but their seats sit empty for the remaining 1,980 iterations and their answers go back with A’s. E starts at iteration 2,001 and finishes at 2,020. Average completion time: (2,000 × 4 + 2,020) / 5 ≈ 2,004 iterations.
- **Deciding every iteration.** B, C and D leave after iteration 20. E takes a free seat and finishes at iteration 40. A still finishes at 2,000. Average: (2,000 + 20 + 20 + 20 + 40) / 5 = 420 iterations. E’s first token arrives after 21 iterations instead of 2,001.

The first schedule is the book’s Figure 7.2 with a twist. In the book, B and C wait behind A for the CPU. Here B, C and D even share the GPU with A, finish their work early, and still wait. Even a system that let them return early would leave E waiting until A was done. That is the **convoy effect**: short consumers of a resource queued behind a heavy one.

::scene iteration

## Iteration-level scheduling: Orca

Orca’s change sounds small. The scheduler asks the engine to run **one iteration** at a time instead of a whole request. After each iteration it removes finished requests, returns their output, and may add waiting requests to the batch. The industry now usually calls this *continuous batching*. A second technique, *selective batching*, makes it possible. Requests in one iteration may be at very different positions, some in prefill and some at token 1,500. So Orca batches the operations that work token by token, such as the large matrix multiplications, and runs attention separately for each request.

Which of the book’s policies is this? It is not quite STCF, though it is tempting to call it that. Orca deliberately keeps the order of service: its scheduler admits requests by arrival time and guarantees what the paper calls an iteration-level first-come-first-served property. If request *x* arrived before *y*, then *x* has run at least as many iterations as *y*. Within the batch, every request advances one token per iteration, so the batch behaves like round robin with a one-token quantum, except that all the seats move at once.

What Orca really changed is the **granularity of preemption**. In chapter 7 the key step from SJF to STCF is not a better ordering. It is allowing the scheduler to decide again when a new job arrives, rather than only when the running job finishes. Iteration-level scheduling gives the server that ability, once per token. Better orderings can then be added on top, as later sections show.

The effect is large. Anyscale’s 2023 benchmark of OPT-13B on one 40 GB A100 measured continuous batching alone at up to 8 times the throughput of naive static batching, and up to 23 times with [[vllm|vLLM]], which adds memory management on top. Iteration-level scheduling is now the default in vLLM and most other serving systems.

:::fold Orca’s admission rule, and why it reserved too much memory

::scene reserve

Orca’s Algorithm 1 is short. Here it is as simplified pseudo-code:

```py
# pseudo-code, simplified from Orca's Algorithm 1 (OSDI 2022)
def select(pool, reserved, max_bs, n_slots):
    batch = []
    for req in sorted(pool, key=lambda r: r.arrival):   # FCFS order
        if len(batch) == max_bs:
            break
        if req.never_scheduled:                         # first time: reserve KV space
            if reserved + req.max_tokens > n_slots:
                break
            reserved += req.max_tokens
        batch.append(req)
    return batch, reserved
```

Two details are worth noticing.

- The loop stops at the first request that does not fit, instead of skipping it to admit smaller ones behind it. That keeps the FCFS property and prevents [[starvation|starvation]]. It also means a request with a large reservation can hold up everyone behind it.
- On admission, Orca reserves KV-cache space for the request’s **maximum** output length, `max_tokens`, because it cannot know the real one. A request that stops after 20 tokens keeps a reservation sized for thousands. This is chapter 15’s [[base-bounds|base and bounds]], with the same waste. Fixing it with paging is what vLLM’s PagedAttention did, in [the note on PagedAttention](/notes/paged-attention). Less wasted memory means more seats on the bus, which is a large part of that 23×.
:::

::scene iteration

## Try it on the book’s simulator

The lab is chapter 7’s scheduler, not an LLM server, but the shapes carry over.

::lab Scheduler

- Load **Convoy**. Job A (100) is the essay and B and C (10 each) are chat replies. FIFO gives an average turnaround of 110. Switch to SJF and it drops to 50. That is what a server could gain if it knew output lengths.
- Load **Late arrivals**. Non-preemptive SJF is stuck behind A, at 103.33, like static batching with E arriving just after the batch starts. STCF preempts and gets 50. That is the step iteration-level scheduling took.
- Switch to RR with quantum 1. Response times become excellent and turnaround gets worse. Remember that the lab’s CPU runs one job at a time. A GPU runs a batch, so a one-token quantum costs much less turnaround, as long as the batch fits in memory.

::scene stall

## The convoy comes back: prefill

Iteration-level scheduling assumes iterations are short and similar. Decode iterations are. A prefill is not: it processes the whole prompt in a single pass. The Sarathi-Serve paper (OSDI 2024) summarizes the difference: prefill iterations “have high latency but saturate GPU compute,” while decode iterations “have low latency but also low compute utilization.”

So picture a server running a batch of decoding chats when a request with a very long prompt arrives. If the scheduler puts its whole prefill into the next iteration, that iteration takes much longer, and every chat in the batch waits for it. Users see a pause in the middle of a streamed answer. Sarathi-Serve calls it a *generation stall*. It is the convoy effect again, inside a single iteration: one heavy job holding up many light ones.

::scene chunked

The fix is the next idea in chapter 7: a time slice. **Chunked prefill** splits a long prefill into chunks of roughly equal size and runs one chunk per iteration, alongside the ongoing decodes. Each iteration gets a token budget. Decodes are scheduled first, and prefill chunks fill what is left, so new requests join without pausing anyone. Sarathi-Serve reports 2.6 times the serving capacity of vLLM for Mistral-7B on one A100, up to 3.7 times for Yi-34B on two A100s, and up to 5.6 times for Falcon-180B with [[pipeline-parallelism|pipeline parallelism]].

vLLM’s current engine works the same way. Its documentation says chunked prefill “is enabled by default whenever possible.” The scheduler batches all pending decodes first and gives the rest of the budget to prefills. The budget, `max_num_batched_tokens`, is chapter 7’s time-slice dilemma with new labels. A smaller budget improves inter-token latency, because there are fewer prefill tokens slowing down each decode step. A larger budget improves time to first token, because new prompts get through prefill faster.

::scene distserve

A second fix separates the two kinds of work entirely. DistServe (OSDI 2024) runs prefill and decode on **different GPUs** and hands the KV cache from one to the other. Each pool can be sized and parallelized for its own phase and its own latency target: time to first token for prefill, time per output token for decode. The paper reports serving up to 7.4 times more requests, or meeting a 12.6 times tighter latency target. This is the move chapter 8’s [[mlfq|multi-level feedback queue]] makes: once you can tell job types apart, give them separate queues.

:::fold Why prefill and decode load the GPU so differently
The difference comes from how much arithmetic each byte read from memory supports.

- In **decode**, each request contributes one new token per iteration. The GPU must read every weight matrix of the model from memory to multiply it by a handful of vectors, one per request. Very little arithmetic is done per byte read, so memory bandwidth is the limit. Adding requests to the batch reuses the same weight reads, which is why batching decode is nearly free until something else runs out.
- In **prefill**, one request contributes all its prompt tokens at once. The same weight reads are now multiplied by thousands of vectors. Arithmetic per byte is high, and the GPU’s compute units become the limit.

What usually runs out first for decode is memory for KV caches. Anyscale estimated about 1 MB of state per token for a 13-billion-parameter model. A few thousand tokens of context per request across a large batch fill a GPU quickly. This is why admission in LLM serving is mainly a memory question, and why the [[paging|paging]] ideas of chapter 18 ended up on GPUs.
:::

::scene oracle

## No oracle: guessing how long a job will run

Chapter 7 ends with its hardest assumption. SJF and STCF need to know how long each job will run, and a real OS does not know. LLM serving has a half-oracle. The server knows exactly how long the prompt is, and so roughly what the prefill will cost. It does not know how many tokens the model will generate.

Researchers have tried both of the book’s answers to that problem.

::scene mlfq

The first answer is chapter 8’s: let the job’s behaviour reveal its length. FastServe (Wu et al., 2023) preempts at the granularity of single output tokens and schedules with a **skip-join MLFQ**. A request enters the queue that matches its input length instead of always starting at the top, and moves down as it keeps generating. Long generators sink, and new short ones go first, which is what MLFQ does for interactive jobs. Against vLLM, the authors report up to 31.4 times the throughput under the same average-latency requirement, and 17.9 times under the same [[tail-latency|tail-latency]] requirement.

::scene predict

The second answer is prediction, the idea chapter 8 introduces as using the past to predict the future and [the history note](/notes/history-predicts) takes further: estimate the length, then run SJF on the estimate. Fu et al. (2024) observe that exact output lengths are hard to predict but their *order* is easier. They train a model to rank the requests in a batch by expected output length and schedule shortest-predicted first. They report 2.8 times lower latency for chatbot serving and 6.5 times higher throughput for synthetic data generation.

Both inherit SJF’s weakness: a long request can [[starvation|starve]] while short ones keep arriving. The book’s fixes apply here too: MLFQ’s periodic priority boost, [[aging|aging]], or a fairness layer on top that tracks how many tokens each user has received. That bookkeeping is the same virtual-time idea as [EEVDF](/notes/eevdf), counted in tokens.

::scene bends

## Where it bends

The book’s model gets you surprisingly far, but LLM serving breaks it in several places:

- **The processor is a batch, not a single slot.** Round robin over a batch barely stretches turnaround, so the book’s RR penalty mostly disappears. What limits the batch is memory, not time.
- **Iterations differ in length.** The book’s time slice is a fixed amount of time. Here an iteration’s length depends on what is in it, which is why chunked prefill caps the tokens per iteration instead of the duration.
- **Preemption is expensive.** Saving a process’s registers takes nanoseconds. A preempted request’s KV cache can be large. When vLLM runs out of KV-cache space, it preempts requests, and in its current engine the default is to discard their caches and recompute them later. The documentation warns that this can hurt end-to-end latency.
- **There are two latency targets.** Chapter 7 trades turnaround against response time. LLM services set targets for time to first token and for time per output token at once, and the two pull scheduling in different directions.

::scene overview

## The thread back to the book

Seen from far enough away, LLM serving is chapter 7 replayed in fast motion. Request-level batching is FIFO, and it produces the convoy effect. Iteration-level scheduling adds what STCF adds to SJF: the right to decide again before the current job finishes. Chunked prefill is a time slice, and its token budget is the slice-length trade-off. Length-aware schedulers are attempts to get near SJF without an oracle, using MLFQ-style observation or learned prediction. The memory under all of this is chapter 18’s [[paging|paging]].

The same lesson shows up wherever work of very different sizes shares one queue, from HTTP to transport protocols, which is the subject of [the head-of-line blocking thread](/notes/hol-blocking). The book states it in one sentence about grocery stores. LLM servers relearned it one token at a time.

## Further reading

- Gyeong-In Yu et al.: [Orca: A Distributed Serving System for Transformer-Based Generative Models](https://www.usenix.org/conference/osdi22/presentation/yu), OSDI 2022: iteration-level scheduling and selective batching.
- Cade Daniel et al.: [How continuous batching enables 23x throughput in LLM inference while reducing p50 latency](https://www.anyscale.com/blog/continuous-batching-llm-inference) (Anyscale, June 2023): static versus continuous batching, measured.
- Amey Agrawal et al.: [Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve](https://www.usenix.org/conference/osdi24/presentation/agrawal), OSDI 2024: generation stalls and chunked prefill.
- [vLLM: optimization and tuning](https://docs.vllm.ai/en/latest/configuration/optimization.html): chunked prefill, the token budget, and preemption in a production engine.
- Yinmin Zhong et al.: [DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin), OSDI 2024.
- Bingyang Wu et al.: [Fast Distributed Inference Serving for Large Language Models](https://arxiv.org/abs/2305.05920) (FastServe), arXiv 2023: token-level preemption and skip-join MLFQ.
- Yichao Fu et al.: [Efficient LLM Scheduling by Learning to Rank](https://arxiv.org/abs/2408.15792), arXiv 2024: approximating SJF by predicting the order of output lengths.
