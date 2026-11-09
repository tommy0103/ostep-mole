import type { Term } from './index'

/** Terms of “Variable-size vs. fixed-size”: allocators, file systems, networks and LLM serving. */
const terms: Record<string, Term> = {
  llm: {
    title: { en: 'Large language model (LLM)', zh: '大语言模型（LLM）' },
    body: {
      en: 'A neural network trained on large amounts of text that generates text one [[llm-token|token]] at a time, as chat assistants do. Its *parameters*, the numbers learned in training, run to billions, and serving the model means keeping them in GPU memory.',
      zh: '在海量文本上训练出来的神经网络，像聊天助手那样一次生成一个 [[llm-token|token]]。它的*参数*（训练学到的那些数）多达数十亿个，提供服务就得把它们放在 GPU 显存里。',
    },
  },
  bitmap: {
    title: { en: 'Bitmap', zh: '位图（bitmap）' },
    body: {
      en: 'A row of bits, one per unit of space, each saying whether that unit is free or in use. Finding a free unit is a scan for a 0 bit, and freeing one is clearing its bit. It works only when the units are all the same size.',
      zh: '一排二进制位，每个空间单位对应一位，表示这个单位是空闲还是在用。找空闲单位就是找一个 0 位，释放就是把那一位清零。只有所有单位一样大时，它才行得通。',
    },
  },

  'buddy-allocator': {
    title: { en: 'Buddy allocator', zh: '伙伴分配器' },
    body: {
      en: 'An allocator that hands out blocks whose sizes are powers of two. A request is rounded up to the next power of two, and a larger free block is split in halves until one fits; when a block is freed and its *buddy*, the other half it was split from, is free too, the two merge again. Linux hands out every physical page this way.',
      zh: '一种只分配二次幂大小的块的分配器。请求被向上取整到下一个二次幂，再把一个更大的空闲块不断对半分，直到大小合适；一个块被释放时，如果它的*伙伴*（当初和它一起分出来的另一半）也空闲，两者就重新合并。Linux 的每一个物理页都是这样分配出去的。',
    },
    chapter: 'vm-freespace',
    note: 'allocators',
  },
  'slab-allocator': {
    title: { en: 'Slab allocator', zh: 'slab 分配器（厚块分配程序）' },
    body: {
      en: 'An allocator Jeff Bonwick designed for Solaris that keeps a cache for each kind or size of object, built from *slabs*: runs of memory cut into slots of that one size. Allocating takes a free slot, with nothing to search, split or coalesce. Linux’s version is SLUB.',
      zh: 'Jeff Bonwick 为 Solaris 设计的分配器：为每一种（或每一种大小的）对象维护一个缓存，缓存由 *slab* 组成，即切成同样大小槽位的一段内存。分配就是取一个空闲槽位，无须查找、分割或合并。Linux 里的实现叫 SLUB。',
    },
    chapter: 'vm-freespace',
    note: 'allocators',
  },

  'memory-zone': {
    title: { en: 'Memory zone (Linux)', zh: '内存区域（zone，Linux）' },
    body: {
      en: 'A range of physical memory the Linux kernel manages separately because of what it can be used for: `DMA` for old devices that reach only the lowest addresses, `Normal` for most memory, and on 32-bit machines `HighMem`, which the kernel cannot keep permanently mapped. Each zone has its own [[buddy-allocator|buddy]] free lists.',
      zh: 'Linux 内核按用途分开管理的一段物理内存：`DMA` 区给只能访问最低地址的老设备用，`Normal` 区是大部分内存，32 位机器上还有 `HighMem` 区，内核无法把它一直映射着。每个区域都有自己的一套[[buddy-allocator|伙伴系统]]空闲列表。',
    },
  },
  'ext-fs': {
    title: { en: 'ext2, ext3, ext4', zh: 'ext2、ext3、ext4' },
    body: {
      en: 'Linux’s standard family of file systems. ext2 (1993) keeps each file’s list of blocks in its [[inode|inode]], with indirect blocks for large files; ext3 added a journal; ext4 (2008) describes a file’s blocks with extents instead.',
      zh: 'Linux 的标准文件系统家族。ext2（1993 年）把每个文件的块列表记在它的 [[inode|inode]] 里，大文件再借助间接块；ext3 加上了日志；ext4（2008 年）改用区段来描述文件的块。',
    },
  },
  tcp: {
    title: { en: 'TCP', zh: 'TCP' },
    body: {
      en: 'Transmission Control Protocol, the Internet’s protocol for reliable connections. It gives two programs an ordered stream of bytes: it cuts the stream into packets, numbers the bytes so the receiver can put them back in order, and resends whatever is lost.',
      zh: '传输控制协议（Transmission Control Protocol），互联网上提供可靠连接的协议。它给两个程序一条有序的字节流：把字节流切成分组，给字节编号，好让接收方按顺序拼回去，丢了的再重发。',
    },
  },
  ip: {
    title: { en: 'IP, IPv4 and IPv6', zh: 'IP、IPv4 与 IPv6' },
    body: {
      en: 'Internet Protocol, the layer that carries single packets from one host to another across many networks, each packet forwarded on its own by routers. IPv4 (1981) has 32-bit addresses; IPv6 has 128-bit addresses and was designed to replace it.',
      zh: '网际协议（Internet Protocol），负责把一个个分组跨越许多网络从一台主机送到另一台，每个分组都由路由器单独转发。IPv4（1981 年）用 32 位地址；IPv6 用 128 位地址，是为取代它而设计的。',
    },
  },
  rfc: {
    title: { en: 'RFC', zh: 'RFC' },
    body: {
      en: 'Request for Comments: the numbered series in which Internet standards and best practices are published, most of them written in the IETF. A published RFC never changes; a revision gets a new number.',
      zh: 'Request for Comments（征求意见稿）：发布互联网标准和最佳实践的编号文档系列，大多出自 IETF。RFC 一经发布就不再修改，修订版会得到一个新编号。',
    },
  },
  atm: {
    title: { en: 'ATM (Asynchronous Transfer Mode)', zh: 'ATM（异步传输模式）' },
    body: {
      en: 'A network technology from the telephone industry, standardised from the late 1980s, that carried voice and data alike in fixed 53-byte cells. It ran in telephone backbones and early DSL lines and was largely replaced by Ethernet and IP. Not the cash machine.',
      zh: '电信业在 20 世纪 80 年代末开始标准化的网络技术，把语音和数据统统装进 53 字节的定长信元传输。它用在电话骨干网和早期的 DSL 宽带上，后来大多被以太网和 IP 取代。和取款机无关。',
    },
  },
  'kv-cache': {
    title: { en: 'KV cache', zh: 'KV 缓存' },
    body: {
      en: 'The keys and values a language model has already computed for every earlier token of a request, kept so that the [[attention|attention]] step for each new token does not compute them again. It belongs to one request, grows by one token’s worth at every step, and for a 13-billion-parameter model takes about 800 KB per token.',
      zh: '语言模型为一个请求里所有已有 token 算好的 key 和 value，存下来，好让每个新 token 做[[attention|注意力计算]]时不必重算。它属于单个请求，每生成一步就长一个 token 的量；对 130 亿参数的模型，每个 token 约占 800 KB。',
    },
    note: 'paged-attention',
  },
  vllm: {
    title: { en: 'vLLM', zh: 'vLLM' },
    body: {
      en: 'An open-source system for serving large language models, from UC Berkeley, announced in June 2023. It is built around PagedAttention: each request’s [[kv-cache|KV cache]] is stored in fixed-size blocks, found through a per-request block table, the way pages are found through a page table.',
      zh: '加州大学伯克利分校开源的大语言模型推理服务系统，2023 年 6 月发布。它的核心是 PagedAttention：每个请求的 [[kv-cache|KV 缓存]]存放在定长的块里，通过每个请求一张的块表来找，就像通过页表找页一样。',
    },
    note: 'paged-attention',
  },
  attention: {
    title: { en: 'Attention', zh: '注意力（attention）' },
    body: {
      en: 'The step in a transformer where each token looks back over the request so far: its *query* vector is compared with the *key* of every token up to it, and the resulting weights mix those tokens’ *values*. Generating one token runs it once in every layer, over the keys and values of the whole request so far.',
      zh: 'Transformer 里让每个 token 回看请求中已有内容的那一步：拿它的 *query* 向量和到它为止每个 token 的 *key* 比较，用得到的权重把那些 token 的 *value* 加权混合起来。每生成一个 token，每一层都要做一次，范围是这个请求到目前为止的全部 key 和 value。',
    },
  },
  span: {
    title: { en: 'Span (TCMalloc)', zh: 'span（TCMalloc）' },
    body: {
      en: 'In TCMalloc, a run of contiguous pages given either to one size class, to be cut into objects of that size, or to one large object. On `free`, TCMalloc looks up which span a pointer falls in to know what it is freeing.',
      zh: 'TCMalloc 里一段连续的页：要么交给某一个尺寸类别，切成该尺寸的对象；要么整段给一个大对象。`free` 时，TCMalloc 查出指针落在哪个 span 里，才知道释放的是什么。',
    },
    note: 'allocators',
  },
}

export default terms
