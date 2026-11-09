import type { SceneDef } from './index'

/** The running figure of “The convoy effect, in LLM serving”. */
const scene: SceneDef = {
  height: 400,
  bands: {
    overview: [14, 320],
    workload: [83, 318],
    kv: [228, 318],
    static: [14, 382],
    iteration: [14, 382],
    reserve: [228, 318],
    stall: [83, 282],
    chunked: [83, 282],
    distserve: [83, 396],
    oracle: [14, 82],
    mlfq: [10, 80],
    predict: [14, 82],
    bends: [83, 318],
  },
  parts: {
    sched: [18, 76],
    gpu: [84, 318],
    seats: [108, 212],
    memory: [234, 310],
    kvbox: [246, 310],
    kv: [244, 310],
    reserve: [232, 310],
    weightlink: [210, 248],
  },
  states: {
    overview: {
      title: { en: 'A server for tokens', zh: '生产 token 的服务器' },
      caption: {
        en: 'Requests wait, a scheduler picks who sits in the GPU’s batch, and the batch advances each seat by one token per iteration. In GPU memory sit the model’s weights and each running request’s KV cache.',
        zh: '请求排队等候，调度器决定谁坐进 GPU 的这一批，每次迭代让每个座位前进一个 token。GPU 内存里放着模型权重，以及每个运行中请求的 KV 缓存。',
      },
    },
    workload: {
      title: { en: 'A batch is a bus', zh: '一批就是一辆公交车' },
      caption: {
        en: 'Prefill reads the whole prompt in one pass; decode then produces one token per iteration. One decode iteration advances every seat by a token and reads the weights once for all of them, which is why batching decode is close to free.',
        zh: '预填充一次读完整个提示词；解码则每次迭代产生一个 token。一次解码迭代让每个座位前进一个 token，权重只读一次、大家共用，所以解码的批处理几乎是免费的。',
      },
    },
    kv: {
      title: { en: 'The KV cache', zh: 'KV 缓存' },
      caption: {
        en: 'While it generates, each request keeps the attention keys and values of every token so far, which can run to many megabytes. Stopping a request and resuming it later means keeping that somewhere or rebuilding it: the price of preemption.',
        zh: '生成过程中，每个请求都留着迄今为止每个 token 的注意力键和值，可以多达许多兆字节。暂停一个请求、稍后恢复，就得把这些存在某处或重算一遍——这就是抢占的代价。',
      },
    },
    static: {
      title: { en: 'Static batching', zh: '静态批处理' },
      caption: {
        en: 'Iteration 20 of the simplified example. B, C and D are done, but their seats stay empty until A finishes at 2,000, and their answers go back with A’s. E, which arrived just after the start, waits for the whole batch.',
        zh: '简化例子的第 20 次迭代。B、C、D 已经完成，座位却要一直空到 A 在第 2000 次结束，它们的答案也要和 A 的一起返回。刚开始后到达的 E，要等这一整批跑完。',
      },
      demo: {
        label: { en: 'The example, iteration by iteration', zh: '这个例子，一次次迭代看下来' },
        steps: [
          {
            en: 'A batch has four seats: A will write 2,000 tokens, B, C and D write 20 each. E, another 20 tokens, arrives just after the batch starts. Simplified: every iteration takes the same time and prefill is ignored.',
            zh: '一批有四个座位：A 要写 2000 个 token，B、C、D 各写 20 个。E 也是 20 个 token，在这批刚开始后到达。这里做了简化：每次迭代耗时相同，忽略预填充。',
          },
          {
            en: 'Static batching, at iteration 20. Every seat has advanced by one token per iteration, so B, C and D are finished. The batch does not end, because A is not. E is still outside, waiting.',
            zh: '静态批处理，第 20 次迭代。每个座位每次迭代前进一个 token，所以 B、C、D 写完了。但 A 没写完，这批就不结束，E 还在外面等。',
          },
          {
            en: 'The batch runs to iteration 2,000. The seats of B, C and D stay empty for 1,980 iterations and their answers go back with A’s. E starts at 2,001 and finishes at 2,020. The average completion time is about 2,004 iterations.',
            zh: '这批一直跑到第 2000 次迭代。B、C、D 的座位空了 1980 次迭代，答案和 A 的一起返回。E 从第 2001 次开始，到第 2020 次完成。平均完成时间约 2004 次迭代。',
          },
          {
            en: 'Now the scheduler decides again after every iteration. After iteration 20, B, C and D leave and their answers go back at once. E takes a free seat.',
            zh: '现在调度器每次迭代后都重新决策。第 20 次迭代后，B、C、D 离开，答案立刻返回；E 坐进空出来的座位。',
          },
          {
            en: 'E finishes at iteration 40, and A still at 2,000. The average completion time falls to 420 iterations, and E’s first token arrives after 21 iterations instead of 2,001.',
            zh: 'E 在第 40 次迭代完成，A 仍在第 2000 次完成。平均完成时间降到 420 次迭代；E 的第一个 token 在 21 次迭代后就到了，而不是 2001 次。',
          },
        ],
      },
    },
    iteration: {
      title: { en: 'Decide every iteration', zh: '每次迭代都决策' },
      caption: {
        en: 'Iteration 21, with Orca’s scheduling. After iteration 20, B, C and D left and their answers went back; E took a free seat and has its first token. The seat is given up as soon as the work is done.',
        zh: '第 21 次迭代，用 Orca 的调度。第 20 次迭代后，B、C、D 离开，答案已经返回；E 坐进空位，拿到了第一个 token。活一干完，座位就让出来。',
      },
    },
    reserve: {
      title: { en: 'Reserved for the worst case', zh: '按最坏情况预留' },
      caption: {
        en: 'Orca reserves KV-cache space for a request’s maximum output length, max_tokens, on admission, because it cannot know the real one. A request that stops after 20 tokens keeps a reservation sized for thousands.',
        zh: 'Orca 在接纳请求时按最大输出长度 max_tokens 预留 KV 缓存空间，因为它不可能知道真实长度。一个 20 个 token 就停下的请求，占着按数千个 token 准备的预留。',
      },
    },
    stall: {
      title: { en: 'A generation stall', zh: '生成停顿' },
      caption: {
        en: 'A request with a very long prompt arrives. If its whole prefill goes into the next iteration, that iteration takes much longer, and every chat in the batch waits. Users see a pause in the middle of an answer.',
        zh: '来了一个提示词很长的请求。如果把它的整个预填充塞进下一次迭代，这次迭代就长得多，批里的每个聊天都得等。用户看到的，是回答中途卡了一下。',
      },
    },
    chunked: {
      title: { en: 'Chunked prefill', zh: '分块预填充' },
      caption: {
        en: 'Each iteration gets a token budget. Decodes are scheduled first and a chunk of the prompt fills what is left, so new requests join without pausing anyone. In vLLM the budget is max_num_batched_tokens: chapter 7’s time-slice dilemma.',
        zh: '每次迭代有一个 token 预算：先安排解码，提示词的一块填满剩下的空间，新请求加入时就不会让任何人停下。在 vLLM 里这个预算叫 max_num_batched_tokens，它就是第 7 章的时间片两难。',
      },
    },
    distserve: {
      title: { en: 'Separate GPUs', zh: '分开的 GPU' },
      caption: {
        en: 'DistServe runs prefill and decode on different GPUs and hands the KV cache from one to the other, so each pool is sized for its own phase and latency target.',
        zh: 'DistServe 把预填充和解码放在不同的 GPU 上运行，再把 KV 缓存从一边交给另一边，于是每个资源池都能针对自己的阶段和延迟目标来配置。',
      },
    },
    oracle: {
      title: { en: 'A half-oracle', zh: '半个先知' },
      caption: {
        en: 'The server knows exactly how long each prompt is, and so roughly what its prefill will cost. It does not know how many tokens the model will generate.',
        zh: '服务器确切知道每个提示词有多长，因此大致知道预填充的代价；但它不知道模型会生成多少个 token。',
      },
    },
    mlfq: {
      title: { en: 'Skip-join MLFQ', zh: '跳跃加入的 MLFQ' },
      caption: {
        en: 'FastServe’s queues: a request enters the level that matches its input length rather than always the top, and moves down as it keeps generating. Long generators sink and new short ones go first.',
        zh: 'FastServe 的多级队列：请求不总是从最高级开始，而是按输入长度进入相应的一级，随着不断生成而逐级下沉。生成得长的请求沉下去，新来的短请求先跑。',
      },
    },
    predict: {
      title: { en: 'Guessing the order', zh: '猜顺序' },
      caption: {
        en: 'Exact output lengths are hard to predict, but their order is easier. Fu et al. train a model to rank the requests by expected output length and schedule the shortest predicted first: SJF on an estimate.',
        zh: '精确的输出长度很难预测，它们的相对顺序要容易些。Fu 等训练一个模型，把请求按预期输出长度排序，让预测最短的先跑：按估计值执行的 SJF。',
      },
    },
    bends: {
      title: { en: 'Preemption is expensive', zh: '抢占很昂贵' },
      caption: {
        en: 'Saving a process’s registers takes nanoseconds, but a preempted request’s KV cache can be large. When vLLM runs out of KV-cache space it preempts requests, and in its current engine the default is to discard their caches and recompute them later.',
        zh: '保存一个进程的寄存器只要几纳秒，一个被抢占请求的 KV 缓存却可能很大。vLLM 的 KV 缓存空间不够时就会抢占请求，在它现在的引擎里，默认做法是丢弃这些缓存，之后重新计算。',
      },
    },
  },
  terms: {
    gpu: ['gpu'],
    'model-parameters': ['memory'],
    attention: ['kvbox', 'kv'],
    vllm: ['sched'],
    'memory-bound': ['memory', 'weightlink'],
    'base-bounds': ['reserve'],
    mlfq: ['sched'],
  },
}

export default scene
