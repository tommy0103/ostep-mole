import type { SceneDef } from './index'

/** The running figure of “PagedAttention: virtual memory for LLM KV caches”. */
const scene: SceneDef = {
  height: 420,
  bands: {
    overview: [4, 296],
    kvcache: [4, 252],
    contiguous: [140, 334],
    blocks: [4, 340],
    grow: [4, 340],
    walk: [4, 332],
    split: [4, 342],
    share: [4, 300],
    prefix: [4, 352],
    evict: [4, 350],
    measured: [8, 296],
    bends: [4, 344],
  },
  parts: {
    req: [6, 50],
    table: [46, 74],
    links: [66, 178],
    phys: [158, 218],
    free: [222, 240],
    gpu: [158, 250],
    tokens: [6, 50],
    formula: [64, 148],
    contig: [142, 222],
    refs: [156, 232],
    cached: [158, 218],
    cpu: [250, 330],
    attn: [214, 290],
    hashes: [240, 352],
    results: [8, 296],
  },
  states: {
    overview: {
      title: { en: 'Blocks as pages', zh: '把块当作页' },
      caption: {
        en: 'The paper’s analogy, drawn: think of blocks as pages, tokens as bytes and requests as processes. A request’s logical blocks live in any physical blocks of GPU memory, found through a block table. Earlier systems wasted 60% to 80% of the memory set aside for the KV cache; vLLM, under 4%.',
        zh: '把论文的类比画出来：块当作页，token 当作字节，请求当作进程。一个请求的逻辑块可以放在 GPU 显存的任何物理块里，靠块表来找。已有系统浪费了为 KV 缓存所留内存的 60% 到 80%；vLLM 不到 4%。',
      },
    },
    kvcache: {
      title: { en: 'Why the KV cache is large', zh: 'KV 缓存为什么这么大' },
      caption: {
        en: 'Every token keeps a key and a value in every layer: about 800 KB per token for OPT-13B. A 2,048-token request needs about 1.6 GB, and on a 40 GB A100 the KV cache gets roughly 12 GB, room for about seven such requests. Requests that do not fit stay out of the batch.',
        zh: '每个 token 在每一层都要存一份键和值：OPT-13B 上每个 token 约 800 KB。一个 2048 token 的请求约需 1.6 GB，而一块 40 GB 的 A100 上 KV 缓存只分得约 12 GB，只够大约七个这样的请求。放不下的请求，就进不了这个批次。',
      },
    },
    contiguous: {
      title: { en: 'One region per request', zh: '每个请求一整段' },
      caption: {
        en: 'Final length is unknown, so earlier systems reserved a contiguous region for the maximum. The paper names three wastes, each with a name in the book: slots reserved for later, space for tokens never generated, and gaps between regions.',
        zh: '请求最终多长事先不知道，于是早先的系统按最大长度预留一整段连续区域。论文点出三种浪费，每一种在书里都有名字：为以后预留的槽位、留给永远不会生成的 token 的空间，以及区域之间的空隙。',
      },
    },
    blocks: {
      title: { en: 'Blocks and a block table', zh: '块与块表' },
      caption: {
        en: 'The paper’s example, with block size 4 (the default is 16). A 7-token prompt fills logical blocks 0 and 1, stored in physical blocks 7 and 1. Each table entry records where a block is and how many of its slots are filled. Any physical block can hold any logical block.',
        zh: '论文的例子，块大小取 4（默认是 16）。7 个 token 的提示词占了逻辑块 0 和 1，存放在物理块 7 和 1 中。每个表项记录块在哪里、已填了几个槽位。任何物理块都能装任何逻辑块。',
      },
    },
    grow: {
      title: { en: 'A new block on demand', zh: '按需分配新块' },
      caption: {
        en: 'The first generated token fills the last free slot of physical block 1. The second finds logical block 1 full, so the block manager takes a free physical block, 3, and adds one table entry. Nothing is copied, and every block but the last is full.',
        zh: '生成的第一个 token 填满物理块 1 的最后一个空槽。第二个发现逻辑块 1 已满，于是块管理器取一个空闲物理块（3），往表里加一项。什么都不用复制，除最后一块外每块都是满的。',
      },
    },
    walk: {
      title: { en: 'A walk in every attention', zh: '每次注意力都要走表' },
      caption: {
        en: 'The attention kernel can no longer read one contiguous tensor. It walks the block table and gathers keys and values block by block: a software page-table walk. The paper measured the kernel at 20% to 26% higher latency than FasterTransformer’s; the authors argue the end-to-end effect is small.',
        zh: '注意力内核不能再读一整段连续的张量，它要遍历块表，一块一块地取键和值：一次软件实现的页表遍历。论文测得这个内核的延迟比 FasterTransformer 的高 20% 到 26%；作者认为端到端的影响不大。',
      },
    },
    split: {
      title: { en: 'From token to slot', zh: '从 token 到槽位' },
      caption: {
        en: 'Chapter 18’s address split, with token positions for byte addresses. Divide the position by the block size: the quotient picks the logical block, like the VPN, and the remainder picks the slot, like the page offset. The table gives the physical block.',
        zh: '第 18 章的地址拆分，只是把字节地址换成了 token 位置。用块大小去除位置：商选出逻辑块，相当于 VPN；余数选出槽位，相当于页内偏移量。查表得到物理块。',
      },
    },
    share: {
      title: { en: 'Sharing by reference count', zh: '靠引用计数共享' },
      caption: {
        en: 'Two samples of one prompt: both block tables point at physical blocks 7 and 1, each with a reference count of 2. A write into a shared block copies that block first. Beam search shares the same way, with counts going up as beams fork and down as they die.',
        zh: '同一提示词的两个样本：两张块表都指向物理块 7 和 1，引用计数都是 2。要写共享块时，先复制这一块。束搜索也这样共享：候选分叉时计数加一，淘汰时减一。',
      },
      demo: {
        label: { en: 'Copy-on-write, block by block', zh: '写时复制，一块一块来' },
        steps: [
          {
            en: 'Prompt phase: a 7-token prompt, block size 4, two samples A and B. The prompt fills logical blocks 0 and 1, stored once in physical blocks 7 and 1. Both samples’ tables point at them, so each block has reference count 2.',
            zh: '提示词阶段：7 个 token 的提示词，块大小 4，两个样本 A 和 B。提示词填进逻辑块 0 和 1，只在物理块 7 和 1 里存一份。两个样本的块表都指向它们，所以每块的引用计数是 2。',
          },
          {
            en: 'A generates its first token. It belongs in the last slot of logical block 1, but physical block 1 is shared. vLLM takes a new block, 3, copies the three filled slots, writes A’s token into the fourth, points A’s table at 3, and decrements block 1’s count to 1.',
            zh: 'A 生成第一个 token。它应当写进逻辑块 1 的最后一个槽位，但物理块 1 是共享的。vLLM 取一个新块 3，把三个已填槽位复制过去，把 A 的 token 写进第四个槽位，让 A 的表指向 3，并把块 1 的计数减到 1。',
          },
          {
            en: 'B generates its first token. Block 1 now has count 1, so B owns it outright and writes in place. No copy.',
            zh: 'B 生成第一个 token。块 1 现在计数为 1，归 B 独有，直接原地写入，无需复制。',
          },
          {
            en: 'Both continue. Each new block a sample allocates from now on is private from the start (5 and 2 are drawn as examples). Block 7, the first four prompt tokens, stays shared for the life of both samples. Only one block was ever copied.',
            zh: '两者继续生成。此后任一样本新分配的块，一开始就是私有的（图中的 5 和 2 只是举例）。块 7，也就是提示词的前四个 token，在两个样本的整个生命期内都保持共享。自始至终只复制了一个块。',
          },
        ],
      },
    },
    prefix: {
      title: { en: 'Shared prefixes', zh: '共享前缀' },
      caption: {
        en: 'Requests that begin with the same text can map the same physical blocks. In automatic prefix caching each full block is named by a hash of its tokens and of the previous block’s hash, so one hash names a whole prefix. Blocks with no users wait in a least-recently-used queue: a page cache for prompts.',
        zh: '开头相同的请求可以映射同一批物理块。在自动前缀缓存里，每个满块由它自身 token 与前一块哈希值算出的哈希来标识，于是一个哈希值就代表一整段前缀。暂时无人使用的块按最近最少使用的顺序排队：这就是给提示词用的页缓存。',
      },
    },
    evict: {
      title: { en: 'Out of blocks', zh: '块不够了' },
      caption: {
        en: 'Blocks are allocated on demand, so memory can run out mid-generation. Requests are served first-come, first-served, so the most recently arrived go first, and all of a request’s blocks go together. They are copied to CPU memory, or thrown away and recomputed, since the KV cache is derived data.',
        zh: '块是按需分配的，内存可能在生成到一半时用完。请求按先来先服务调度，所以最晚到的最先被抢占，一个请求的块要一起走。这些块要么复制到 CPU 内存，要么直接丢掉、之后重算，因为 KV 缓存是派生数据。',
      },
    },
    measured: {
      title: { en: 'What was measured', zh: '测了什么' },
      caption: {
        en: 'The headline is 2–4× the throughput of FasterTransformer and Orca at the same latency, and the multiples depend on the baseline. Orca (Oracle) is told each request’s true output length, so comparing with it isolates the memory manager; the larger multiples come from baselines that reserve the maximum.',
        zh: '头条结论是：相同延迟下，吞吐量是 FasterTransformer 和 Orca 的 2 到 4 倍，而倍数取决于基线。Orca (Oracle) 事先知道每个请求的真实输出长度，和它比才能单独看出内存管理器的作用；更大的倍数来自预留到上限的基线。',
      },
    },
    bends: {
      title: { en: 'Where it bends', zh: '在哪里弯折' },
      caption: {
        en: 'Block size has chapter 18’s page-size trade-off, and the default became 16. Translation lives in software, so every kernel must be written for paged memory. vAttention takes the CPU’s way: one contiguous virtual range per request, with the GPU’s virtual memory mapping physical memory in on demand.',
        zh: '块大小带着第 18 章的页大小权衡，默认值定为 16。地址转换在软件里，所以每个内核都得专门为分页内存来写。vAttention 走 CPU 的路：每个请求一段连续的虚拟地址范围，由 GPU 的虚拟内存按需把物理内存映射进去。',
      },
    },
  },
  terms: {
    vllm: ['req', 'table', 'phys'],
    'kv-cache': ['req', 'phys'],
    'llm-token': ['req'],
    attention: ['req'],
    gpu: ['gpu'],
    fastertransformer: ['attn'],
    'reference-count': ['refs'],
    'copy-on-write': ['refs'],
    swap: ['cpu'],
    'page-cache': ['cached'],
    lru: ['cached'],
    hash: ['hashes'],
    orca: ['results'],
  },
}

export default scene
