import type { Term } from './index'

/** Terms of “PagedAttention: virtual memory for LLM KV caches”. */
const terms: Record<string, Term> = {
  vicuna: {
    title: { en: 'Vicuna and Chatbot Arena', zh: 'Vicuna 与 Chatbot Arena' },
    body: {
      en: 'Vicuna is an open chat model released in 2023 by researchers from several universities, made by further training Meta’s LLaMA. Chatbot Arena is a website from the same group where people compare chat models without being told which is which.',
      zh: 'Vicuna 是几所大学的研究者在 2023 年发布的开放聊天模型，由 Meta 的 LLaMA 进一步训练而来。Chatbot Arena 是同一批人办的网站，人们在不知道模型身份的情况下比较各个聊天模型。',
    },
  },
  'opt-13b': {
    title: { en: 'OPT-13B', zh: 'OPT-13B' },
    body: {
      en: 'One of the Open Pre-trained Transformers, language models Meta released in 2022 in sizes up to 175 billion [[model-parameters|parameters]]. The name gives the size: OPT-13B has 13 billion.',
      zh: 'Meta 在 2022 年发布的开放预训练 Transformer（Open Pre-trained Transformer）系列语言模型之一，最大的有 1750 亿个[[model-parameters|参数]]。名字里写着大小：OPT-13B 有 130 亿个。',
    },
  },
  'hidden-size': {
    title: { en: 'Hidden size', zh: '隐藏维度（hidden size）' },
    body: {
      en: 'How many numbers are in each vector a [[transformer|transformer]] computes inside its layers. A token’s key and its value are each a vector of this length.',
      zh: '[[transformer|Transformer]] 在各层内部算出的每个向量由多少个数组成。一个 token 的键和值，都是这个长度的向量。',
    },
  },
  flops: {
    title: { en: 'FLOPS', zh: 'FLOPS' },
    body: {
      en: 'Floating-point operations per second: the usual measure of how much arithmetic a processor can do.',
      zh: 'Floating-point operations per second，每秒浮点运算次数：衡量处理器算力的常用指标。',
    },
  },
  tensor: {
    title: { en: 'Tensor', zh: '张量（tensor）' },
    body: {
      en: 'A multi-dimensional array of numbers, the basic data structure of deep-learning programs. A framework normally lays one out as a single contiguous stretch of memory, so that its elements can be found by arithmetic.',
      zh: '多维的数字数组，深度学习程序的基本数据结构。框架通常把它排成一整段连续的内存，这样靠算术就能找到其中的元素。',
    },
  },
  softmax: {
    title: { en: 'Softmax', zh: 'softmax' },
    body: {
      en: 'A function that turns a list of scores into weights that are positive and add up to 1, giving most of the weight to the highest scores. [[attention|Attention]] uses it to decide how much each earlier token counts.',
      zh: '一个把一列分数变成权重的函数：权重都是正数，加起来等于 1，分数最高的项分到大部分权重。[[attention|注意力]]用它来决定之前每个 token 占多大分量。',
    },
  },
  'system-prompt': {
    title: { en: 'System prompt', zh: '系统提示词' },
    body: {
      en: 'Text placed before the user’s message that tells a language model how to behave. Every request to one service can begin with the same one.',
      zh: '放在用户消息之前、告诉语言模型该怎么表现的一段文字。同一个服务的每个请求，开头都可以是同一段系统提示词。',
    },
  },
  hash: {
    title: { en: 'Hash', zh: '哈希（hash）' },
    body: {
      en: 'A short fixed-size number computed from data of any length. Equal inputs always give equal hashes and different inputs almost never do, so comparing hashes can stand in for comparing the data.',
      zh: '由任意长度的数据算出的一个定长的短数字。相同的输入一定得到相同的哈希，不同的输入几乎不会相同，所以比较哈希可以代替比较数据本身。',
    },
  },
  sglang: {
    title: { en: 'SGLang', zh: 'SGLang' },
    body: {
      en: 'A language and runtime for programs that call language models many times. Its RadixAttention keeps cached [[kv-cache|KV blocks]] in a [[radix-tree|radix tree]] of prompt prefixes, so requests that begin alike can reuse them.',
      zh: '一门语言及其运行时，用于多次调用语言模型的程序。它的 RadixAttention 把缓存的 [[kv-cache|KV 块]]组织在一棵按提示词前缀排列的[[radix-tree|基数树]]里，开头相同的请求就能复用它们。',
    },
  },
  'clean-page': {
    title: { en: 'Clean page', zh: '干净页' },
    body: {
      en: 'A page whose contents have not changed since they were read from a file. The OS can simply drop it and read the file again later; a page that has been modified, a *dirty* page, must be written out first.',
      zh: '内容自从文件读入后没有变过的页。操作系统可以直接丢掉它，以后再从文件读回来；被修改过的*脏*页则必须先写出去。',
    },
    chapter: 'vm-beyondphys-policy',
  },
  llama: {
    title: { en: 'LLaMA', zh: 'LLaMA' },
    body: {
      en: 'A family of language models Meta released from 2023. As with OPT, the number gives the size: LLaMA-13B has 13 billion [[model-parameters|parameters]].',
      zh: 'Meta 从 2023 年开始发布的语言模型系列。和 OPT 一样，数字表示大小：LLaMA-13B 有 130 亿个[[model-parameters|参数]]。',
    },
  },
  'sharegpt-alpaca': {
    title: { en: 'ShareGPT and Alpaca', zh: 'ShareGPT 与 Alpaca' },
    body: {
      en: 'Two public datasets of text for language models. ShareGPT is a collection of conversations people shared from ChatGPT; Alpaca, from Stanford, is a set of short instructions, so its sequences are shorter.',
      zh: '两个公开的语言模型文本数据集。ShareGPT 收集了人们分享出来的 ChatGPT 对话；Alpaca 来自斯坦福大学，是一组简短的指令，所以序列更短。',
    },
  },
  poisson: {
    title: { en: 'Poisson arrivals', zh: '泊松到达' },
    body: {
      en: 'A model of arrivals at random moments with a steady average rate, each independent of the last. It is the usual way to simulate requests from many unrelated users.',
      zh: '一种到达模型：到达发生在随机时刻，平均速率稳定，每次到达都与上一次无关。模拟大量互不相干的用户发来的请求时，通常就用它。',
    },
  },
  flashattention: {
    title: { en: 'FlashAttention and FlashInfer', zh: 'FlashAttention 与 FlashInfer' },
    body: {
      en: 'Open-source GPU implementations of the [[attention|attention]] computation, written for speed. Serving systems plug them in as their attention kernel.',
      zh: '开源的、为速度而写的 GPU [[attention|注意力]]计算实现。推理服务系统把它们接进来，作为自己的注意力内核。',
    },
  },
  orca: {
    title: { en: 'Orca', zh: 'Orca' },
    body: {
      en: 'A serving system for transformer models, described at OSDI 2022, known for scheduling at the level of single generation steps instead of whole requests.',
      zh: '一个 Transformer 模型的推理服务系统，发表于 OSDI 2022，以按单个生成步骤、而不是按整个请求来调度而闻名。',
    },
    note: 'llm-convoy',
  },
}

export default terms
