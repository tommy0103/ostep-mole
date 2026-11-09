import type { Term } from './index'

/** Terms of “One idea, six layers”: the caches above and below the book’s page cache. */
const terms: Record<string, Term> = {
  'access-trace': {
    title: { en: 'Trace', zh: '访问轨迹（trace）' },
    body: {
      en: 'A recording, in order, of the requests a real system received: which object, when, and often how big. Replaying traces is how cache researchers compare policies on real workloads instead of invented ones.',
      zh: '把一个真实系统收到的请求按顺序记录下来：请求的是哪个对象、什么时候、往往还有多大。缓存研究者靠回放这些轨迹，在真实负载而不是编造的负载上比较各种策略。',
    },
  },
  arc: {
    title: { en: 'ARC (Adaptive Replacement Cache)', zh: 'ARC（自适应替换缓存）' },
    body: {
      en: 'A replacement policy by Nimrod Megiddo and Dharmendra Modha of IBM, published in 2003. It keeps one LRU list for pages used once recently and one for pages used at least twice, plus “ghost” lists of recently evicted keys, and lets hits in the ghost lists shift space between the two.',
      zh: 'IBM 的 Nimrod Megiddo 和 Dharmendra Modha 于 2003 年发表的替换策略。它维护两个 LRU 链表，一个放最近只用过一次的页，一个放至少用过两次的页，外加记录最近被淘汰的键的“幽灵”链表；幽灵链表里的命中，决定空间在两个链表之间怎么分。',
    },
  },
  'buffer-pin': {
    title: { en: 'Pinned buffer', zh: '被钉住（pin）的缓冲区' },
    body: {
      en: 'A buffer some database process is using right now. PostgreSQL counts the pins on each buffer and never evicts one whose count is above zero, because someone is still reading or changing it.',
      zh: '某个数据库进程此刻正在使用的缓冲区。PostgreSQL 为每个缓冲区记录被钉住的次数，计数大于零的绝不淘汰，因为还有人正在读或改它。',
    },
  },
  cdn: {
    title: { en: 'CDN (content delivery network)', zh: 'CDN（内容分发网络）' },
    body: {
      en: 'A fleet of servers spread around the world that keep copies of websites’ files close to their users. A request goes to a nearby node, which answers from its cache and asks the website’s own server only when it has no copy it may use.',
      zh: '分布在世界各地的一大批服务器，把网站的文件就近存在用户附近。请求先到附近的节点，节点用自己的缓存作答；只有手里没有可用的副本时，才去问网站自己的服务器。',
    },
  },
  dns: {
    title: { en: 'DNS', zh: 'DNS（域名系统）' },
    body: {
      en: 'The Domain Name System, which turns names such as example.com into the numeric addresses computers connect to. Resolvers cache each answer for the [[ttl|TTL]] its owner set, so a popular name is looked up again only when the copy expires.',
      zh: '域名系统，把 example.com 这样的名字翻译成计算机用来连接的数字地址。解析器把每个答案缓存一段由域名所有者设定的 [[ttl|TTL]]，所以热门域名只有在副本过期后才会再查一次。',
    },
  },
  fsync: {
    title: { en: 'fsync()', zh: 'fsync()' },
    body: {
      en: 'A [[syscall|system call]] that returns only once a file’s modified data and metadata have been written to the storage device, so they survive a crash or power loss. Until then, what a `write()` wrote may exist only in the [[page-cache|page cache]].',
      zh: '一个[[syscall|系统调用]]，要等文件里被修改的数据和元数据都写到存储设备上才返回，这样它们在崩溃或断电后依然在。在此之前，`write()` 写下的内容可能只存在于[[page-cache|页缓存]]里。',
    },
  },
  'http-caching': {
    title: { en: 'HTTP caching', zh: 'HTTP 缓存' },
    body: {
      en: 'The rules in the web’s protocol for when a browser or a shared cache may store a response and reuse it, written down in RFC 9111. The server states them in response headers such as `Cache-Control` and `ETag`. RFCs are the Internet’s numbered standards documents.',
      zh: 'Web 协议里规定浏览器或共享缓存何时可以保存并复用一个响应的规则，写在 RFC 9111 里。服务器通过 `Cache-Control`、`ETag` 这类响应头来声明它们。RFC 是互联网带编号的标准文档。',
    },
  },
  innodb: {
    title: { en: 'InnoDB', zh: 'InnoDB' },
    body: {
      en: 'The default storage engine of the MySQL database: the part that stores tables on disk, in 16 KiB pages by default, and keeps them in memory in its own [[buffer-pool|buffer pool]].',
      zh: 'MySQL 数据库的默认存储引擎，也就是负责把表存到磁盘上（默认以 16 KiB 为一页）、并在自己的[[buffer-pool|缓冲池]]里缓存它们的那一部分。',
    },
  },
  'ivy-bridge': {
    title: { en: 'Ivy Bridge', zh: 'Ivy Bridge' },
    body: {
      en: 'Intel’s code name for its third generation of Core processors, released in 2012.',
      zh: 'Intel 第三代酷睿（Core）处理器的代号，2012 年发布。',
    },
  },
  lock: {
    title: { en: 'Lock', zh: '锁' },
    body: {
      en: 'A variable that lets only one [[thread|thread]] at a time run a piece of code that touches shared data; the others wait until it is released. A lock that every request must take limits how many requests can run in parallel. Part II of the book is about them.',
      zh: '一个变量，保证同一时刻只有一个[[thread|线程]]能执行某段访问共享数据的代码，其他线程要等它被释放。一把每个请求都要拿的锁，会限制能有多少请求并行执行。本书第二部分专门讲它。',
    },
  },
  memcached: {
    title: { en: 'memcached', zh: 'memcached' },
    body: {
      en: 'A simple in-memory key-value cache server, first written in 2003 for the LiveJournal site and later run at very large scale by Facebook and others. An application stores a value under a key and fetches it back over the network; to memcached the values are just bytes.',
      zh: '一个简单的内存键值缓存服务器，2003 年为 LiveJournal 网站写成，后来被 Facebook 等公司大规模使用。应用把值存在某个键下，再通过网络取回；在 memcached 眼里，值只是一串字节。',
    },
  },
  'o-direct': {
    title: { en: 'O_DIRECT', zh: 'O_DIRECT' },
    body: {
      en: 'A flag to `open()` asking the kernel to move a file’s data straight between the program’s memory and the device, bypassing the [[page-cache|page cache]]. Programs with a cache of their own, such as databases, use it so that each block is not held twice; the transfers must then be suitably aligned.',
      zh: '`open()` 的一个标志，请内核在程序内存和设备之间直接搬运文件数据，绕过[[page-cache|页缓存]]。自己有缓存的程序（比如数据库）用它来避免一个块存两份；代价是传输必须满足对齐要求。',
    },
  },
  postgresql: {
    title: { en: 'PostgreSQL', zh: 'PostgreSQL' },
    body: {
      en: 'A widely used open-source relational database. It stores tables and indexes in files made of 8 KiB pages, reads those files through the operating system, and keeps its own cache of pages, the [[buffer-pool|buffer pool]], in [[shared-memory|shared memory]].',
      zh: '一个广泛使用的开源关系数据库。它把表和索引存在由 8 KiB 页组成的文件里，通过操作系统读这些文件，并在[[shared-memory|共享内存]]里维护自己的页缓存，也就是[[buffer-pool|缓冲池]]。',
    },
  },
  'race-condition': {
    title: { en: 'Race condition', zh: '竞态条件（race）' },
    body: {
      en: 'A bug whose outcome depends on the timing of two or more activities running at once: each step is correct on its own, but an unlucky interleaving leaves the data wrong. Part II of the book is about preventing them.',
      zh: '一种结果取决于两个或多个同时进行的活动谁先谁后的 bug：每一步单独看都没错，但某种不走运的交错顺序会让数据出错。本书第二部分讲的就是如何防止它。',
    },
  },
  redis: {
    title: { en: 'Redis', zh: 'Redis' },
    body: {
      en: 'An in-memory key-value store, often run as a cache in front of a database: the application stores values (strings, lists, hashes) under keys and reads them back over the network. It keeps everything in memory and can also save it to disk.',
      zh: '一个内存键值存储，常被放在数据库前面当缓存：应用把值（字符串、列表、哈希表）存在键下，再通过网络读回。它把所有数据放在内存里，也可以另存到磁盘。',
    },
    note: 'fork-redis',
  },
  sosp: {
    title: { en: 'SOSP and NSDI', zh: 'SOSP 与 NSDI' },
    body: {
      en: 'Two of the main research conferences in computer systems: SOSP, the ACM Symposium on Operating Systems Principles, and NSDI, the USENIX Symposium on Networked Systems Design and Implementation. “SOSP 2023” names the meeting where a paper was published.',
      zh: '计算机系统领域最主要的两个学术会议：SOSP（ACM 操作系统原理研讨会）和 NSDI（USENIX 网络系统设计与实现研讨会）。“SOSP 2023”指论文发表在哪一届会议上。',
    },
  },
  ssd: {
    title: { en: 'SSD and flash', zh: 'SSD 与闪存' },
    body: {
      en: 'A solid-state drive stores data in flash memory chips, with no moving parts, so it reads far faster than a spinning disk. Flash wears out: each block survives only a limited number of erase-and-write cycles, which is why a cache on flash avoids writing data nobody will read.',
      zh: '固态硬盘把数据存在闪存芯片里，没有活动部件，读起来比转动的磁盘快得多。闪存会磨损：每个块只能承受有限次数的擦除和写入，所以建在闪存上的缓存不愿写入没人会读的数据。',
    },
  },
  ttl: {
    title: { en: 'TTL (time to live)', zh: 'TTL（存活时间）' },
    body: {
      en: 'How long a cached copy may be used before it expires and must be fetched again. A TTL bounds how stale a copy can get; it does not stop the copy from being stale until then.',
      zh: '一份缓存副本在过期、必须重新获取之前可以使用多久。TTL 给陈旧程度设了上限，却不能阻止副本在到期之前就已经陈旧。',
    },
  },
  wal: {
    title: { en: 'Write-ahead logging (WAL)', zh: '预写式日志（WAL）' },
    body: {
      en: 'Before a changed data page may be written to disk, the database appends a description of the change to a sequential log and flushes the log. After a crash it replays the log, so changes whose pages were never written are not lost.',
      zh: '改过的数据页写盘之前，数据库先把这次修改的描述追加到一份顺序写的日志里，并把日志刷盘。崩溃之后重放日志，那些页还没来得及写盘的修改也不会丢。',
    },
  },
}

export default terms
