import type { SceneDef } from './index'

/** The running figure of “Variable-size vs. fixed-size: the trade-off that keeps coming back”. */
const scene: SceneDef = {
  height: 380,
  bands: {
    overview: [4, 278],
    external: [70, 226],
    paging: [4, 226],
    buys: [76, 350],
    costs: [4, 312],
    pattern: [4, 286],
    classes: [4, 362],
    hugepage: [76, 318],
    extents: [4, 308],
    packets: [4, 312],
    kv: [4, 310],
    choose: [140, 376],
  },
  parts: {
    view: [6, 52],
    table: [76, 124],
    links: [114, 148],
    frames: [144, 224],
    tails: [22, 176],
    freelist: [234, 292],
    groups: [144, 210],
    orders: [234, 314],
    runs: [144, 224],
    ladder: [234, 360],
    extable: [76, 148],
    blocks: [144, 224],
    stream: [6, 52],
    packets: [144, 224],
    atm: [234, 310],
    reserve: [234, 308],
  },
  states: {
    overview: {
      title: { en: 'Two kinds of waste', zh: '两种浪费' },
      caption: {
        en: 'Users want pieces of any size (top); systems keep managing fixed-size units instead (bottom), with a table in between. The hatched tails are internal fragmentation, the price of rounding up. Randell found that, counted in bytes, rounding usually lost more than it saved.',
        zh: '使用者想要任意大小的块（上），系统却一再改用定长单位来管理（下），中间夹一张表。斜线部分是内部碎片，即向上取整的代价。Randell 发现，只按字节算，取整损失的通常比省下的多。',
      },
    },
    external: {
      title: { en: 'Holes between segments', zh: '段与段之间的空洞' },
      caption: {
        en: 'Segments go straight into physical memory. 20 bytes are free, in two holes of 10, so a 15-byte request fails. Nothing is wasted inside any segment: the waste is between them, and it depends on the whole history of allocations and frees.',
        zh: '段直接放进物理内存。空闲 20 字节，分成两个 10 字节的空洞，于是 15 字节的请求失败。没有哪个段内部浪费了空间：浪费在段与段之间，取决于分配与释放的全部历史。',
      },
    },
    paging: {
      title: { en: 'Cut into pages', zh: '切成页' },
      caption: {
        en: 'Each region is cut into fixed-size pages, and any free frame can hold any page, so no request fails because free space has the wrong shape. The waste moves inside: B needs 4,097 bytes, gets two 4 KiB pages and leaves 4,095 bytes unused. That loss is under a page per region and known in advance.',
        zh: '每个区域切成定长的页，任何空闲页帧都能装任何一页，请求不会再因为空闲空间形状不对而失败。浪费转到了内部：B 需要 4097 字节，拿到两个 4 KiB 的页，4095 字节没用上。这种损失每个区域不到一页，而且事先就能算出来。',
      },
    },
    buys: {
      title: { en: 'What a fixed size buys', zh: '定长换来了什么' },
      caption: {
        en: 'With identical units the free list is just a list: allocation takes the first entry, and every free frame suits as well as any other. Translation is arithmetic: the page number indexes the table and the offset passes through. Each page can be swapped out, shared or moved on its own.',
        zh: '单位一模一样，空闲列表就只是个列表：分配就是取第一个，每个空闲页帧都同样合适。地址转换只是算术：页号去查表，偏移量原样通过。每一页都可以单独换出、共享或挪动。',
      },
    },
    costs: {
      title: { en: 'What it costs', zh: '代价' },
      caption: {
        en: 'Three costs: the unused tail of each last page; a table entry per unit, which for a 32-bit address space with 4 KiB pages is about a million entries, 4 MB per process; and objects scattered across frames, so every access goes through the table.',
        zh: '三项代价：每个对象最后一页没用上的尾巴；每个单位一条表项，32 位地址空间、4 KiB 页时约一百万条，每个进程 4 MB；对象散落在各个页帧里，每次访问都要经过那张表。',
      },
    },
    pattern: {
      title: { en: 'A table in between', zh: '中间夹一张表' },
      caption: {
        en: 'Paging did not abolish contiguity; it moved it. Each region is still one contiguous range in the virtual view, while physical memory stays in interchangeable pieces. Every layer this thread visits has the same three rows.',
        zh: '分页没有取消连续性，只是把它搬了家：每个区域在虚拟视图里仍是一段连续的范围，物理内存则保持为可以互换的碎块。这篇文章走访的每一层，都是这三行。',
      },
    },
    classes: {
      title: { en: 'Size classes', zh: '尺寸类别' },
      caption: {
        en: 'malloc rounds each small request up to a size class, and each run of memory holds slots of one class only. With four classes per doubling, jemalloc keeps the waste to about 20% for all but the smallest classes: a 257-byte request lands in the 320-byte class and leaves 63 bytes unused.',
        zh: 'malloc 把每个小请求向上取整到某个尺寸类别，每个内存区块只装一种类别的槽位。jemalloc 每翻一倍分四类，除最小的几类外，浪费限制在约 20%：257 字节的请求落进 320 字节那一类，63 字节没用上。',
      },
    },
    hugepage: {
      title: { en: 'External fragmentation returns', zh: '外部碎片又回来了' },
      caption: {
        en: 'A huge page needs physically contiguous frames. Seven frames are free, but every aligned group holds a page in use, so it fails: the buddy allocator counts seven free single pages and no larger block. Simplified: a group of 4 frames stands for the 512 of a 2 MiB page.',
        zh: '大页需要物理上连续的页帧。有 7 个页帧空闲，但每个对齐的组里都有一页在用，于是分配失败：伙伴分配器数得出 7 个空闲单页，却没有更大的块。简化：这里 4 帧一组，代表 2 MiB 大页的 512 帧。',
      },
      demo: {
        label: { en: 'How compaction makes room', zh: '紧凑怎样腾出空间' },
        steps: [
          {
            en: 'A huge page needs one aligned run of free frames; here a run of 4 stands for the 512 frames of a 2 MiB page. Seven frames are free, but every aligned group of 4 holds a page in use, so the request fails.',
            zh: '大页需要一段对齐的、连续的空闲页帧，这里用连续 4 帧代表 2 MiB 大页的 512 帧。有 7 帧空闲，但每个对齐的 4 帧组里都有一页在用，请求失败。',
          },
          {
            en: 'Compaction picks a group to empty, frames 0–3, and free frames at the other end to take its pages: 15 and 13. Both pages in the group belong to ordinary processes, so the kernel can move them.',
            zh: '紧凑选定一个要腾空的组，第 0–3 帧，再在另一端找空闲帧来接收它的页：第 15 帧和第 13 帧。组里的两页都属于普通进程，内核可以搬动。',
          },
          {
            en: 'C’s page in frame 0 is copied to frame 15, and one page-table entry changes from 0 to 15. C’s virtual pages are where they were, and C notices nothing. Frame 0 is free now, and with frame 1 it makes a free block of order 1.',
            zh: 'C 在第 0 帧的那一页被复制到第 15 帧，页表里只有一条表项从 0 改成 15。C 的虚拟页原地不动，C 毫无察觉。第 0 帧空了出来，和第 1 帧合成一个 1 阶的空闲块。',
          },
          {
            en: 'A’s page in frame 2 goes to frame 13 the same way: one copy, one changed entry. Frames 0–3 are now free and aligned, and the buddy allocator merges them into one block of order 2.',
            zh: 'A 在第 2 帧的那一页照样搬到第 13 帧：复制一次，改一条表项。第 0–3 帧现在全空且对齐，伙伴分配器把它们合并成一个 2 阶的块。',
          },
          {
            en: 'The huge page takes frames 0–3. malloc cannot move objects like this, because it does not know where the program keeps pointers to them. The kernel can, because it controls the page tables.',
            zh: '大页放进了第 0–3 帧。malloc 没法这样搬动对象，因为它不知道程序把指向它们的指针存在哪里；内核能，因为页表在它手里。',
          },
        ],
      },
    },
    extents: {
      title: { en: 'Blocks and extents', zh: '块与区段' },
      caption: {
        en: 'Disk space is still allocated in fixed-size blocks; only the description became variable. One extent says “from block 3, six blocks”, where a block map needs a pointer per block. For a contiguous 1 GiB file that is 96 bytes of extents against 1 MiB of pointers.',
        zh: '磁盘空间仍按定长的块分配，变长的只是描述。一个区段写的是“从第 3 块起，共 6 块”，块映射却得每块记一个指针。对一个连续的 1 GiB 文件，区段只要 96 字节，指针要 1 MiB。',
      },
    },
    packets: {
      title: { en: 'Packets and cells', zh: '分组与信元' },
      caption: {
        en: 'TCP’s byte stream travels in packets whose size varies up to the link’s MTU, more like a size class than a page; sequence numbers say where each packet’s bytes belong. ATM went fully fixed with 53-byte cells and paid about 9% in headers, plus a padded last cell.',
        zh: 'TCP 的字节流装在分组里传输，分组大小在链路 MTU 以内可变，更像尺寸类别而不像页；序列号标明每个分组的字节在流中的位置。ATM 彻底定长，信元一律 53 字节，代价是约 9% 的信头，外加补满的最后一个信元。',
      },
    },
    kv: {
      title: { en: 'KV-cache blocks', zh: 'KV 缓存块' },
      caption: {
        en: 'The same picture on a GPU. Each request’s KV cache is cut into blocks of 16 tokens, and a block table maps them to physical blocks handed out on demand, so waste is confined to each request’s last block. In earlier systems, which reserved one region per request, only 20.4–38.2% of KV-cache memory held token data.',
        zh: '同一幅图搬到 GPU 上：每个请求的 KV 缓存切成 16 个 token 一块，块表把它们映射到按需分配的物理块，浪费只在每个请求的最后一块。早期系统给每个请求预留一整块区域，KV 缓存内存只有 20.4%–38.2% 存着 token 数据。',
      },
    },
    choose: {
      title: { en: 'Choosing the unit', zh: '单位取多大' },
      caption: {
        en: 'Every system tunes one number against three forces. A bigger unit wastes more inside each object, about half a unit, but needs fewer table entries and keeps objects in fewer pieces. vLLM measured block sizes and chose 16 tokens.',
        zh: '每个系统都在三股力量之间调同一个数。单位越大，每个对象内部浪费越多（约半个单位），但表项更少，对象切成的片也更少。vLLM 测量了不同的块大小，选了 16 个 token。',
      },
    },
  },
  terms: {
    'page-table': ['table', 'links'],
    tlb: ['table'],
    bitmap: ['freelist'],
    'buddy-allocator': ['orders', 'groups'],
    jemalloc: ['ladder'],
    'slab-allocator': ['runs'],
    'huge-page': ['groups'],
    'memory-zone': ['frames'],
    'ext-fs': ['extable', 'blocks'],
    inode: ['extable'],
    tcp: ['stream'],
    ip: ['packets'],
    atm: ['atm'],
    'kv-cache': ['view'],
    'llm-token': ['view'],
    vllm: ['table', 'frames'],
  },
}

export default scene
