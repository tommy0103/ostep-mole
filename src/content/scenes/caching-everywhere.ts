import type { SceneDef } from './index'

/** The running figure of “One idea, six layers: how chapter 22 explains every cache you use”. */
const scene: SceneDef = {
  height: 452,
  bands: {
    overview: [6, 452],
    cpu: [304, 450],
    coherence: [304, 390],
    tlb: [304, 450],
    shootdown: [304, 390],
    pagecache: [212, 288],
    writeback: [212, 288],
    cdn: [6, 78],
    http: [6, 78],
    bufferpool: [146, 210],
    twice: [146, 288],
    appcache: [80, 144],
    scans: [80, 288],
    invalidation: [6, 452],
  },
  parts: {
    browser: [24, 70],
    cdn: [24, 70],
    redis: [90, 136],
    memcached: [90, 136],
    pg: [156, 202],
    innodb: [156, 202],
    pagecache: [234, 280],
    disk: [230, 284],
    l1: [338, 372],
    tlb: [338, 372],
    l3: [392, 442],
    dram: [308, 448],
    pt: [334, 362],
  },
  states: {
    overview: {
      title: { en: 'Six caches, one page view', zh: '一次访问，六个缓存' },
      caption: {
        en: 'In user space, in the kernel and in silicon, each layer keeps a small, fast copy of part of something bigger and slower. Here the image was a CDN hit; the product record missed in Redis and in PostgreSQL’s buffer pool, and the kernel’s page cache had the block.',
        zh: '在用户空间、内核和芯片里，每一层都为更大更慢的东西保留一份又小又快的局部副本。这一次，图片在 CDN 命中；商品记录在 Redis 和 PostgreSQL 的缓冲池里都没命中，最后内核的页缓存里有那个块。',
      },
    },
    cpu: {
      title: { en: 'Sets and ways', zh: '组与路' },
      caption: {
        en: 'A CPU cache holds 64-byte lines (on x86). A line from a given address may live only in its own set, in any of that set’s few ways, here 8, so replacement chooses among 8, not among a million. Lines crowding one set while others sit idle are conflict misses.',
        zh: 'CPU 缓存以 64 字节的行为单位（x86 上）。某个地址的行只能放进它所属的那一组，落在这组少数几路中的任一路，这里是 8 路；于是替换只需在 8 个里挑，而不是在一百万个里挑。几行挤在同一组、别的组却闲着，就是冲突未命中。',
      },
    },
    coherence: {
      title: { en: 'Write-back, kept coherent', zh: '写回，并保持一致' },
      caption: {
        en: 'A store only dirties the line in its core’s cache; memory is updated when the line is evicted. When one core writes a line, the coherence protocol invalidates the copies in other cores’ caches. Two threads writing different variables on one line keep doing this to each other: false sharing.',
        zh: '一次存储只把本核缓存里的那一行弄脏，等它被淘汰时才写回内存。一个核写某一行时，一致性协议让其他核缓存里的副本失效。两个线程写同一行里的不同变量，就会这样不停地互相折腾：这就是伪共享。',
      },
    },
    tlb: {
      title: { en: 'TLB reach', zh: 'TLB 覆盖范围' },
      caption: {
        en: 'Each core’s TLB caches page-table entries, one translation each, and the page size decides how much memory they cover: 1,536 entries reach 6 MiB of 4 KiB pages, or 3 GiB of 2 MiB pages. A working set beyond that reach misses whatever the replacement policy.',
        zh: '每个核的 TLB 缓存页表项，一项就是一条地址转换；它们能覆盖多少内存，由页大小决定：1,536 项装 4 KiB 的页覆盖 6 MiB，装 2 MiB 的页覆盖 3 GiB。工作集超出这个范围，什么替换策略都免不了未命中。',
      },
    },
    shootdown: {
      title: { en: 'Flushed by hand', zh: '靠手动冲刷' },
      caption: {
        en: 'Unlike CPU caches, TLBs are not kept coherent automatically. When the kernel changes a page-table entry, it flushes the stale translation from its own TLB, and every other core that may hold it must flush too (on x86, usually by being interrupted): a TLB shootdown.',
        zh: 'TLB 不像 CPU 缓存那样自动保持一致。内核修改一个页表项后，要冲掉自己 TLB 里过期的转换，每个可能持有它的核也都得冲掉（在 x86 上通常靠打断它们）：这就是 TLB 击落。',
      },
    },
    pagecache: {
      title: { en: 'The book’s own layer', zh: '书里自己的这一层' },
      caption: {
        en: 'The page cache keeps file data in memory, 4 KiB page by page, for every read(), write() and file-backed mmap(). Linux evicts with an active and an inactive list fed by reference bits, or since 6.1 with MGLRU, and on sequential reads it reads ahead from disk.',
        zh: '页缓存以 4 KiB 的页为单位把文件数据留在内存里，每一次 read()、write() 和基于文件的 mmap() 都经过它。Linux 用由引用位驱动的活跃、非活跃两个链表来淘汰，6.1 起也可以用 MGLRU；遇到顺序读，它会提前从磁盘预读。',
      },
    },
    writeback: {
      title: { en: 'Write-back on a timer', zh: '按时写回' },
      caption: {
        en: 'write() dirties pages and returns. Flusher threads wake every 5 seconds and write out data dirty for 30; at 10% of available memory dirty, background writeback starts, and at 20% the writer must help. fsync() forces it now. Invalidation is nearly free: there is only one copy.',
        zh: 'write() 把页弄脏就返回。刷写线程每 5 秒醒来一次，写出已经脏了 30 秒的数据；脏页达到可用内存的 10% 时后台写回启动，达到 20% 时写的进程得亲自写回。fsync() 让它立刻落盘。失效几乎免费：只有一份副本。',
      },
    },
    cdn: {
      title: { en: 'Private and shared caches', zh: '私有缓存与共享缓存' },
      caption: {
        en: 'Your browser’s cache serves one user, a CDN node serves many. The unit is a whole response, of any size, so reuse must be weighed against space. Many objects are one-hit wonders (dashed), asked for once and never again, yet LRU gives each a full trip down its list.',
        zh: '浏览器的缓存只服务你一个人，CDN 节点服务许多人。单位是整个响应，大小不一，所以复用的可能必须和占用的空间一起权衡。许多对象是一次性访问对象（虚线），只被请求一次，LRU 却让每一个都在链表里走完全程。',
      },
    },
    http: {
      title: { en: 'Freshness, not flushing', zh: '靠新鲜期，不靠冲刷' },
      caption: {
        en: 'Nobody can flush a cache across the internet, so the origin gives each response a freshness lifetime and the caches decide: here max-age=60 for browsers, s-maxage=600 for shared caches. Then a cache revalidates, getting a 304 if nothing changed, and a CDN can be told to purge.',
        zh: '谁也没法去冲刷互联网另一头的缓存，所以源站给每个响应规定一个新鲜期，由各级缓存自己判断：这里浏览器用 max-age=60，共享缓存用 s-maxage=600。过期后缓存去再验证，没变就收到 304；CDN 还可以接到清除指令。',
      },
    },
    bufferpool: {
      title: { en: 'A database’s own cache', zh: '数据库自己的缓存' },
      caption: {
        en: 'PostgreSQL runs a clock over its 8 KiB buffers: each use bumps a count, up to 5; the hand decrements counts and evicts the first unpinned buffer at zero; a big scan gets a private 256 KiB ring. InnoDB puts each new 16 KiB page at the head of its old sublist, three eighths from the tail.',
        zh: 'PostgreSQL 在 8 KiB 的缓冲区上跑时钟算法：每用一次计数加一，最多到 5；指针扫过时把计数减一，淘汰第一个计数为零、没被钉住的缓冲区；大规模扫描另用一个 256 KiB 的私有小环。InnoDB 把每个新的 16 KiB 页放在“老”子链表的开头，离尾部八分之三处。',
      },
    },
    twice: {
      title: { en: 'Log first, cached twice', zh: '先写日志，一块两份' },
      caption: {
        en: 'A dirty page may reach disk only after the log records describing it are flushed (write-ahead logging), so the pool can keep dirty pages long and write them in batches. And a block read through the kernel can sit in memory twice: in the buffer pool and in the page cache.',
        zh: '脏页只有在描述它的日志记录刷盘之后才能写盘（预写式日志），所以缓冲池可以把脏页留很久、再成批写出。而经由内核读进来的块，可能在内存里存两份：缓冲池一份，页缓存一份。',
      },
    },
    appcache: {
      title: { en: 'Caches the application runs', zh: '应用自己管的缓存' },
      caption: {
        en: 'Redis with allkeys-lru samples 5 keys and evicts the one idle longest. memcached puts new items in HOT, moves items hit again to WARM, and evicts from COLD. Keeping the cache in step with the database is the application’s job: in cache-aside, a write updates the database, then deletes the key.',
        zh: 'Redis 选用 allkeys-lru 时抽样 5 个键，淘汰其中空闲最久的那个。memcached 让新条目进 HOT，再次命中的移入 WARM，从 COLD 淘汰。让缓存与数据库保持一致是应用自己的事：在旁路缓存模式里，写操作先更新数据库，再删除这个键。',
      },
      demo: {
        label: { en: 'The stale fill, and the lease', zh: '迟到的陈旧回填与租约' },
        steps: [
          {
            en: 'Two app servers share one cache and one database. The database holds row 42; the cache may keep a copy of it under a key, but right now it has none. Reads try the cache first. A write updates the database, then deletes the key.',
            zh: '两台应用服务器共用一个缓存和一个数据库。数据库里存着第 42 行；缓存可以在某个键下存一份它的副本，但眼下没有。读先查缓存；写则先更新数据库，再删除这个键。',
          },
          {
            en: 'A read misses: the key is not in the cache. So the reader, on the left, fetches row 42 from the database and gets v1. It will now put v1 into the cache for the next reader.',
            zh: '一次读未命中：缓存里没有这个键。于是左边的读者去数据库取第 42 行，拿到 v1。接下来它要把 v1 填进缓存，留给后面的读者。',
          },
          {
            en: 'Before it does, the writer, on the right, updates row 42 to v2 and deletes the key. There is nothing to delete yet.',
            zh: '就在它填之前，右边的写者把第 42 行改成 v2，并删除这个键。可此时缓存里还没有它，删了个空。',
          },
          {
            en: 'Now the reader stores the value it fetched: v1. The cache says v1, the database says v2, and every read gets the stale value until the key’s TTL expires.',
            zh: '现在读者把它手里的值 v1 存进缓存。缓存说 v1，数据库说 v2；在这个键的 TTL 到期之前，每一次读拿到的都是陈旧的值。',
          },
          {
            en: 'Replay it with leases, the fix in Facebook’s memcache paper. On the miss, the cache hands the reader a lease: a token that lets it fill that key. The writer’s delete now also cancels any lease on the key.',
            zh: '用租约把这一幕重演一遍，这是 Facebook 那篇 memcache 论文里的解法。未命中时，缓存发给读者一个租约：凭它才能填这个键。写者的删除操作现在还会作废这个键上的所有租约。',
          },
          {
            en: 'The reader’s late fill carries a cancelled lease, so the cache rejects it. The key stays empty, and the next read misses and fetches v2.',
            zh: '读者那次迟到的回填带着一个已作废的租约，于是被缓存拒绝。这个键保持为空，下一次读未命中，取到的是 v2。',
          },
          {
            en: 'Leases also stop a stampede. When a hot key goes missing, many clients miss at once, but the cache hands out one lease: one client refills the key from the database while the others wait briefly and retry.',
            zh: '租约还能防止“踩踏”。热键一旦失效，许多客户端会同时未命中；但缓存只发出一个租约：一个客户端去数据库取值回填，其余的稍等片刻再重试。',
          },
        ],
      },
    },
    scans: {
      title: { en: 'Keeping scans out', zh: '把扫描挡在外面' },
      caption: {
        en: 'A big scan, the lab’s Looping pattern, would flush everyone else’s hot pages. InnoDB’s old sublist, Linux’s inactive list and memcached’s HOT queue hold newcomers apart until a later use promotes them; PostgreSQL gives a big scan a private ring. Either way, the hot pages stay.',
        zh: '一次大扫描（实验里的 Looping 模式）会冲掉别人的热页。InnoDB 的老子链表、Linux 的非活跃链表、memcached 的 HOT 队列，都把新来者单独放着，要之后再被用到才提升；PostgreSQL 则给大扫描一个私有小环。不管哪种办法，热页都留得住。',
      },
    },
    invalidation: {
      title: { en: 'Invalidation, harder going up', zh: '失效，越往上越难' },
      caption: {
        en: 'What the higher layers add is mostly invalidation. Hardware keeps CPU caches coherent exactly; the kernel flushes TLBs by hand; the page cache is the only copy; the database owns its data; the web bounds staleness with lifetimes; applications delete keys themselves, and pay in bugs.',
        zh: '更高的层次添上的，主要是失效问题。硬件精确地保持 CPU 缓存一致；内核手动冲刷 TLB；页缓存本身就是唯一的副本；数据库自己就是数据的主人；Web 用新鲜期限定陈旧的程度；应用自己删除键，代价是 bug。',
      },
    },
  },
  terms: {
    cdn: ['cdn'],
    redis: ['redis'],
    memcached: ['memcached'],
    postgresql: ['pg'],
    innodb: ['innodb'],
    'buffer-pool': ['pg', 'innodb'],
    'page-cache': ['pagecache'],
    'cpu-cache': ['l1', 'l3'],
    'last-level-cache': ['l3'],
    'ivy-bridge': ['l3'],
    thread: ['l1'],
    mmap: ['pt'],
    mglru: ['pagecache'],
    fsync: ['pagecache', 'disk'],
    'http-caching': ['browser', 'cdn'],
    'access-trace': ['cdn'],
    'buffer-pin': ['pg'],
    wal: ['pg'],
    'o-direct': ['innodb', 'pagecache'],
    lock: ['memcached'],
    ttl: ['redis', 'cdn'],
    ssd: ['disk'],
  },
}

export default scene
