import type { Bi } from '@/lib/i18n'

export type ChapterKind = 'dialogue' | 'chapter' | 'interlude'

export interface ChapterMeta {
  num: number
  slug: string
  title: Bi
  kind: ChapterKind
  /** sub-group inside the part, e.g. CPU vs memory virtualization */
  group: string
  /** short one-line hook written for this site */
  hook: Bi
  /** the Chinese edition translates a different (older) version of this chapter */
  zhNote?: Bi
}

export interface PartMeta {
  id: 'virtualization' | 'concurrency' | 'persistence'
  numeral: string
  title: Bi
  tagline: Bi
  ready: boolean
  groups: { id: string; title: Bi }[]
  chapters: ChapterMeta[]
}

const c = (num: number, slug: string, en: string, zh: string, kind: ChapterKind, group: string, hook: Bi, zhNote?: Bi): ChapterMeta => ({
  num,
  slug,
  title: { en, zh },
  kind,
  group,
  hook,
  zhNote,
})

export const PARTS: PartMeta[] = [
  {
    id: 'virtualization',
    numeral: 'I',
    title: { en: 'Virtualization', zh: '虚拟化' },
    tagline: {
      en: 'One CPU, one memory — and the illusion that every program has its own.',
      zh: '只有一个 CPU、一块内存——却让每个程序都以为自己独占了它们。',
    },
    ready: true,
    groups: [
      { id: 'cpu', title: { en: 'Virtualizing the CPU', zh: 'CPU 虚拟化' } },
      { id: 'memory', title: { en: 'Virtualizing Memory', zh: '内存虚拟化' } },
    ],
    chapters: [
      c(3, 'dialogue-virtualization', 'A Dialogue on Virtualization', '关于虚拟化的对话', 'dialogue', 'cpu', { en: 'One peach, many eaters.', zh: '一个桃子，许多人吃。' }),
      c(4, 'cpu-intro', 'The Abstraction: The Process', '抽象：进程', 'chapter', 'cpu', { en: 'A program is a lifeless thing; a process is a program running.', zh: '程序是静止的；进程是运行起来的程序。' }),
      c(5, 'cpu-api', 'Interlude: Process API', '插叙：进程 API', 'interlude', 'cpu', { en: 'fork(), exec(), wait(): the strangest API you will love.', zh: 'fork()、exec()、wait()：最古怪却最优雅的接口。' }),
      c(6, 'cpu-mechanisms', 'Mechanism: Limited Direct Execution', '机制：受限直接执行', 'chapter', 'cpu', { en: 'Run programs at full speed — without losing control of the machine.', zh: '让程序全速运行，同时不丢掉对机器的控制。' }),
      c(7, 'cpu-sched', 'Scheduling: Introduction', '进程调度：介绍', 'chapter', 'cpu', { en: 'Turnaround vs. response time: you cannot have both for free.', zh: '周转时间与响应时间：鱼与熊掌不可兼得。' }),
      c(8, 'cpu-sched-mlfq', 'Scheduling: The Multi-Level Feedback Queue', '调度：多级反馈队列', 'chapter', 'cpu', { en: 'Learn from the past to predict the future.', zh: '从历史中学习，预测未来。' }),
      c(9, 'cpu-sched-lottery', 'Scheduling: Proportional Share', '调度：比例份额', 'chapter', 'cpu', { en: 'Randomness as a scheduling policy — and its deterministic cousin.', zh: '用随机数做调度，以及它的确定性表亲。' }),
      c(10, 'cpu-sched-multi', 'Multiprocessor Scheduling (Advanced)', '多处理器调度（高级）', 'chapter', 'cpu', { en: 'Caches, affinity and the cost of moving work around.', zh: '缓存、亲和性，以及搬运任务的代价。' }),
      c(11, 'cpu-dialogue', 'Summary Dialogue on CPU Virtualization', '关于 CPU 虚拟化的总结对话', 'dialogue', 'cpu', { en: 'What did we really learn?', zh: '我们到底学到了什么？' }),
      c(12, 'dialogue-vm', 'A Dialogue on Memory Virtualization', '关于内存虚拟化的对话', 'dialogue', 'memory', { en: 'Every address you see is fake.', zh: '你看到的每个地址都是假的。' }),
      c(13, 'vm-intro', 'The Abstraction: Address Spaces', '抽象：地址空间', 'chapter', 'memory', { en: 'Code, heap, stack — a private universe per process.', zh: '代码、堆、栈——每个进程的私有宇宙。' }),
      c(14, 'vm-api', 'Interlude: Memory API', '插叙：内存操作 API', 'interlude', 'memory', { en: 'malloc() and free(), and every way to get them wrong.', zh: 'malloc() 与 free()，以及所有用错它们的方式。' }),
      c(15, 'vm-mechanism', 'Mechanism: Address Translation', '机制：地址转换', 'chapter', 'memory', { en: 'Two registers and an adder: the first virtual memory.', zh: '两个寄存器加一个加法器：最早的虚拟内存。' }),
      c(16, 'vm-segmentation', 'Segmentation', '分段', 'chapter', 'memory', { en: 'One base/bounds pair per logical segment.', zh: '每个逻辑段一对基址/界限。' }),
      c(17, 'vm-freespace', 'Free-Space Management', '空闲空间管理', 'chapter', 'memory', { en: 'Splitting, coalescing and the fight against fragmentation.', zh: '分割、合并，以及与碎片的斗争。' }),
      c(18, 'vm-paging', 'Paging: Introduction', '分页：介绍', 'chapter', 'memory', { en: 'Chop memory into fixed-size pages and fragmentation (mostly) disappears.', zh: '把内存切成固定大小的页，碎片（大多）就消失了。' }),
      c(19, 'vm-tlbs', 'Paging: Faster Translations (TLBs)', '分页：快速地址转换（TLB）', 'chapter', 'memory', { en: 'A tiny cache that makes paging affordable.', zh: '一块小小的缓存，让分页变得可以承受。' }),
      c(20, 'vm-smalltables', 'Paging: Smaller Tables', '分页：较小的表', 'chapter', 'memory', { en: 'Page tables are too big — so page the page table.', zh: '页表太大了——那就给页表也分页。' }),
      c(21, 'vm-beyondphys', 'Beyond Physical Memory: Mechanisms', '超越物理内存：机制', 'chapter', 'memory', { en: 'Pretend memory is bigger than it is: swap space and the page fault.', zh: '假装内存比实际更大：交换空间与缺页。' }),
      c(22, 'vm-beyondphys-policy', 'Beyond Physical Memory: Policies', '超越物理内存：策略', 'chapter', 'memory', { en: 'Which page should go? LRU, clock, and the optimal you cannot build.', zh: '该踢走哪一页？LRU、时钟算法，以及无法实现的最优解。' }),
      c(23, 'vm-complete', 'Complete Virtual Memory Systems', 'VAX/VMS 虚拟内存系统', 'chapter', 'memory', { en: 'VAX/VMS and Linux: the ideas, assembled into real systems.', zh: 'VAX/VMS 与 Linux：把所有思想装配成真实系统。' }, {
        en: 'The Chinese edition translates the older version of this chapter (“The VAX/VMS Virtual Memory System”); the English v1.10 chapter adds Linux. Paragraphs are shown where they correspond.',
        zh: '中文版翻译的是本章的旧版本（《VAX/VMS 虚拟内存系统》）；英文 v1.10 版增加了 Linux 部分。仅在内容对应处并排显示。',
      }),
      c(24, 'vm-dialogue', 'Summary Dialogue on Memory Virtualization', '内存虚拟化总结对话', 'dialogue', 'memory', { en: 'Mapping it all back together.', zh: '把一切重新串起来。' }),
    ],
  },
  {
    id: 'concurrency',
    numeral: 'II',
    title: { en: 'Concurrency', zh: '并发' },
    tagline: { en: 'Many threads, one memory — and the art of not tripping over each other.', zh: '多个线程，同一块内存——以及互不绊倒的艺术。' },
    ready: false,
    groups: [],
    chapters: [],
  },
  {
    id: 'persistence',
    numeral: 'III',
    title: { en: 'Persistence', zh: '持久性' },
    tagline: { en: 'Making data survive crashes, power loss and time.', zh: '让数据挺过崩溃、断电与时间。' },
    ready: false,
    groups: [],
    chapters: [],
  },
]

export function findChapter(slug: string): { part: PartMeta; chapter: ChapterMeta; index: number } | null {
  for (const part of PARTS) {
    const index = part.chapters.findIndex((ch) => ch.slug === slug)
    if (index >= 0) return { part, chapter: part.chapters[index], index }
  }
  return null
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
