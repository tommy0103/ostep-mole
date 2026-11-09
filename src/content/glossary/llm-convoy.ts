import type { Term } from './index'

/** Terms of “The convoy effect, in LLM serving”. */
const terms: Record<string, Term> = {
  gpu: {
    title: { en: 'GPU', zh: 'GPU（图形处理器）' },
    body: {
      en: 'Graphics processing unit: a processor with thousands of simple cores that run the same operation on many numbers at once, with fast memory of its own. Language models run on them. NVIDIA’s A100, used in several of the papers here, comes with 40 or 80 GB of memory.',
      zh: '图形处理器：拥有数千个简单核心、能同时对大量数字执行同一操作的处理器，还有自己的高速内存。语言模型就运行在它上面。这里几篇论文用到的 NVIDIA A100，配有 40 GB 或 80 GB 内存。',
    },
  },
  'model-parameters': {
    title: { en: 'Parameters (weights)', zh: '参数（权重）' },
    body: {
      en: 'The numbers a neural network learned in training, used in every computation it does and stored as large matrices. A model’s size is given by how many it has: OPT-13B has 13 billion, Falcon-180B has 180 billion.',
      zh: '神经网络在训练中学到的那些数，它的每一步计算都要用到，以大矩阵的形式存放。模型的规模就用参数个数来表示：OPT-13B 有 130 亿个，Falcon-180B 有 1800 亿个。',
    },
  },
  fastertransformer: {
    title: { en: 'FasterTransformer', zh: 'FasterTransformer' },
    body: {
      en: 'NVIDIA’s open-source library for running [[transformer|transformer]] models quickly on its GPUs. It is the baseline the Orca paper compares itself with.',
      zh: 'NVIDIA 开源的程序库，用于在它的 GPU 上高效运行 [[transformer|Transformer]] 模型。Orca 论文拿它作为比较的基线。',
    },
  },
  transformer: {
    title: { en: 'Transformer', zh: 'Transformer' },
    body: {
      en: 'The neural-network design behind today’s language models, introduced in 2017. Each layer lets every token draw on the tokens before it, through [[attention|attention]], and then passes the result through large matrix multiplications.',
      zh: '当今语言模型背后的神经网络结构，2017 年提出。每一层都让每个 token 通过[[attention|注意力]]利用它之前的 token，再让结果经过大规模矩阵乘法。',
    },
  },
  'memory-bound': {
    title: { en: 'Memory-bound', zh: '受内存限制' },
    body: {
      en: 'Limited by how fast data can be read from memory, not by how fast it can be computed on. A step that does little arithmetic per byte it reads leaves the processor’s arithmetic units waiting.',
      zh: '瓶颈在于从内存读取数据的速度，而不是计算的速度。每读一个字节只做很少计算的步骤，会让处理器的运算单元闲着等数据。',
    },
  },
  'response-time': {
    title: { en: 'Response time', zh: '响应时间' },
    body: {
      en: 'The time from a job’s arrival until it first runs, as opposed to turnaround time, which runs until it finishes. Chapter 7 introduces it right after this point, to measure how responsive a system feels.',
      zh: '从任务到达到它第一次运行的时间；周转时间则一直算到任务完成。第 7 章紧接着这里引入它，用来衡量系统的响应有多快。',
    },
    chapter: 'cpu-sched',
  },
  'round-robin': {
    title: { en: 'Round robin and time slices', zh: '轮转与时间片' },
    body: {
      en: 'A scheduler that runs each job for a short *time slice*, a few milliseconds, then switches to the next one in the queue, round and round. Short slices let every job start soon but stretch the turnaround of all of them. Chapter 7 reaches it right after this point.',
      zh: '一种调度方式：每个任务运行一小段*时间片*（几毫秒），然后切到队列里的下一个，如此循环。时间片短，每个任务都能很快开始，但所有任务的周转时间都被拉长。第 7 章紧接着这里就会讲到它。',
    },
    chapter: 'cpu-sched',
  },
  starvation: {
    title: { en: 'Starvation', zh: '饥饿' },
    body: {
      en: 'A job waits indefinitely because the scheduler keeps choosing others ahead of it, as a long job can under SJF while short ones keep arriving.',
      zh: '一个任务无限期地等下去，因为调度器总在选别的任务排在它前面。比如在 SJF 下，只要短任务源源不断，长任务就可能一直等。',
    },
    chapter: 'cpu-sched-mlfq',
  },
  'pipeline-parallelism': {
    title: { en: 'Pipeline parallelism', zh: '流水线并行' },
    body: {
      en: 'Splitting a model too large for one GPU by its layers: the first GPUs run the first layers and pass their results on to the next, like an assembly line.',
      zh: '把一个单块 GPU 放不下的模型按层切开：前面的 GPU 运行前几层，把结果传给后面的 GPU，就像流水线。',
    },
  },
  aging: {
    title: { en: 'Aging', zh: '老化（aging）' },
    body: {
      en: 'Raising a job’s priority the longer it has waited, so that nothing waits forever. MLFQ’s periodic priority boost is a blunt form of it.',
      zh: '任务等得越久，优先级提得越高，这样谁也不会永远等下去。MLFQ 的定期优先级提升就是它的一种粗放形式。',
    },
    chapter: 'cpu-sched-mlfq',
  },
  paging: {
    title: { en: 'Paging', zh: '分页' },
    body: {
      en: 'Dividing memory into fixed-size pages and placing each page wherever there is room, with a [[page-table|page table]] to find it. Nothing has to be contiguous, so free memory is not lost in gaps between regions.',
      zh: '把内存分成定长的页，每一页放在任何有空位的地方，用[[page-table|页表]]来查找。什么都不必连续，空闲内存也就不会浪费在各区域之间的缝隙里。',
    },
    chapter: 'vm-paging',
  },
}

export default terms
