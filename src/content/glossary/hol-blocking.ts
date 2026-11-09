import type { Term } from './index'

/** Terms of “Head-of-line blocking is the convoy effect, everywhere”: web protocols, switches, block I/O. */
const terms: Record<string, Term> = {
  http: {
    title: { en: 'HTTP', zh: 'HTTP' },
    body: {
      en: 'Hypertext Transfer Protocol: how browsers and servers exchange requests and responses on the web. HTTP/1.1 (1997) sends text messages over a [[tcp|TCP]] connection; HTTP/2 (2015) and HTTP/3 (2022) change how the messages are carried, not what they mean.',
      zh: '超文本传输协议：浏览器和服务器在 Web 上交换请求与响应的方式。HTTP/1.1（1997 年）在 [[tcp|TCP]] 连接上发送文本消息；HTTP/2（2015 年）和 HTTP/3（2022 年）改变的是消息的运送方式，而不是消息的含义。',
    },
  },
  'round-trip': {
    title: { en: 'Round trip (RTT)', zh: '往返时间（RTT）' },
    body: {
      en: 'The time for a message to reach the other side and an answer to come back. Across a continent it is tens of milliseconds, far longer than a computer takes to produce most answers, so protocols try not to wait for one between requests.',
      zh: '一条消息到达对方、再等回复回来所花的时间。跨越一块大陆要几十毫秒，比计算机产生大多数答复的时间长得多，所以协议会尽量避免在请求之间等一个来回。',
    },
  },
  middlebox: {
    title: { en: 'Middlebox', zh: '中间设备（middlebox）' },
    body: {
      en: 'A device on the path between client and server that does more than forward packets: a proxy, a firewall, a load balancer, a cache. One that misreads a protocol feature can make that feature unusable in practice.',
      zh: '客户端和服务器之间路径上不只转发分组的设备：代理、防火墙、负载均衡器、缓存。只要它误解了协议的某个特性，这个特性在实践中就可能没法用。',
    },
  },
  curl: {
    title: { en: 'curl', zh: 'curl' },
    body: {
      en: 'A widely used command-line tool and library (libcurl) for transferring data over HTTP and many other protocols, led by Daniel Stenberg since the 1990s.',
      zh: '广泛使用的命令行工具和程序库（libcurl），用于通过 HTTP 及许多其他协议传输数据，由 Daniel Stenberg 从 1990 年代起主持开发。',
    },
  },
  handshake: {
    title: { en: 'Handshake', zh: '握手（handshake）' },
    body: {
      en: 'The exchange that opens a connection before any data flows: [[tcp|TCP]]’s three-way handshake and, for HTTPS, a TLS handshake on top. Each costs at least one [[round-trip|round trip]].',
      zh: '在任何数据传输之前建立连接的那番往来：[[tcp|TCP]] 的三次握手，对 HTTPS 来说上面还有一次 TLS 握手。每一次至少花一个[[round-trip|往返时间]]。',
    },
  },
  'congestion-window': {
    title: { en: 'Congestion window', zh: '拥塞窗口' },
    body: {
      en: 'How much unacknowledged data a [[tcp|TCP]] sender allows itself to have in the network. A new connection starts with a small window and grows it as acknowledgements arrive, so a fresh connection is slow at first.',
      zh: '[[tcp|TCP]] 发送方允许自己在网络里“在途”的、尚未被确认的数据量。新连接从一个小窗口开始，随着确认到来逐渐增大，所以刚建立的连接起初很慢。',
    },
  },
  udp: {
    title: { en: 'UDP', zh: 'UDP' },
    body: {
      en: 'User Datagram Protocol: the Internet’s minimal transport. Each datagram is delivered on its own or not at all, with no connection, no ordering and no retransmission. Protocols such as QUIC build what they need on top of it.',
      zh: '用户数据报协议：互联网上最简单的传输协议。每个数据报单独投递，到不了就算了，没有连接、没有顺序，也不重传。QUIC 这样的协议在它之上自己实现需要的功能。',
    },
  },
  cookie: {
    title: { en: 'Cookie', zh: 'Cookie' },
    body: {
      en: 'A small piece of data a website asks the browser to store and send back with later requests to that site, typically to keep you signed in. It is repeated on every such request, which is one reason header compression pays off.',
      zh: '网站让浏览器保存、并在此后对该站点的请求中发回的一小段数据，通常用来保持登录状态。它在每个这样的请求里都重复一遍，这也是头部压缩划算的原因之一。',
    },
  },
  'network-switch': {
    title: { en: 'Packet switch', zh: '分组交换机' },
    body: {
      en: 'A device that forwards packets, or fixed-size cells, arriving on its input ports to the right output ports. Packets have to wait in queues whenever two of them want the same output at once.',
      zh: '把从输入端口到达的分组（或定长信元）转发到正确输出端口的设备。两个分组同时要去同一个输出时，就得在队列里等。',
    },
  },
  matching: {
    title: { en: 'Matching (in a switch)', zh: '匹配（交换机里）' },
    body: {
      en: 'A choice of input–output pairs, made anew in every time slot, in which each input sends to at most one output and each output receives from at most one input. A *maximum-weight* matching picks the pairs whose weights, for example queue lengths, add up to the most.',
      zh: '在每个时隙重新挑选的一组“输入—输出”配对，其中每个输入最多发往一个输出，每个输出最多接收一个输入。*最大权*匹配挑选权重（比如队列长度）之和最大的配对。',
    },
  },
  admissible: {
    title: { en: 'Admissible traffic', zh: '可容许的流量' },
    body: {
      en: 'Traffic that asks no port for more than it can carry: on average, at most one cell per time slot arrives at each input, and at most one is headed for each output. Traffic beyond that overloads any switch, so a 100% throughput claim covers only admissible traffic.',
      zh: '不要求任何端口超出其能力的流量：平均而言，每个时隙到达每个输入的信元不超过一个，去往每个输出的信元也不超过一个。超过这个限度，任何交换机都会过载，所以“100% 吞吐率”只针对可容许的流量。',
    },
  },
  'block-layer': {
    title: { en: 'Block layer', zh: '块层（block layer）' },
    body: {
      en: 'The part of the Linux kernel between file systems and storage drivers. It queues read and write requests for each device and can pass them through an I/O scheduler that decides their order. Since Linux 5.0 only its multi-queue design (blk-mq) remains, with several queues per device.',
      zh: 'Linux 内核中位于文件系统和存储驱动之间的部分。它为每个设备的读写请求排队，并可以让请求经过一个决定其顺序的 I/O 调度器。从 Linux 5.0 起只剩下多队列设计（blk-mq），每个设备有多个队列。',
    },
  },
  sector: {
    title: { en: 'Sector', zh: '扇区' },
    body: {
      en: 'The smallest unit a disk reads or writes, traditionally 512 bytes and 4 KB on many newer drives. Requests in sector order mean less head movement on a spinning disk, which is why I/O schedulers sort them.',
      zh: '磁盘读写的最小单位，传统上是 512 字节，许多较新的盘是 4 KB。按扇区顺序处理请求，机械硬盘的磁头移动就少，所以 I/O 调度器会给它们排序。',
    },
  },
  hz: {
    title: { en: 'HZ', zh: 'HZ' },
    body: {
      en: 'The rate of the Linux kernel’s periodic timer tick, set when the kernel is built: commonly 100, 250 or 1000 per second. Kernel code counts time in ticks, so `HZ / 2` is half a second and `5 * HZ` five seconds, whatever HZ is.',
      zh: 'Linux 内核周期性时钟节拍的频率，在编译内核时设定，常见的是每秒 100、250 或 1000 次。内核代码用节拍数计时，所以不管 HZ 是多少，`HZ / 2` 都是半秒，`5 * HZ` 都是五秒。',
    },
  },
  ncq: {
    title: { en: 'NCQ (Native Command Queuing)', zh: 'NCQ（原生命令队列）' },
    body: {
      en: 'A SATA feature that lets a drive accept up to 32 commands at once and carry them out in the order it finds fastest. What has been handed to the drive, the kernel can no longer reorder.',
      zh: 'SATA 的一项功能，让磁盘同时接受最多 32 条命令，并按它认为最快的顺序执行。已经交给磁盘的命令，内核就无法再调整顺序了。',
    },
  },
  nvme: {
    title: { en: 'NVMe', zh: 'NVMe' },
    body: {
      en: 'NVM Express: the interface for solid-state drives attached over PCI Express. The specification allows tens of thousands of queues, each tens of thousands of commands deep, so the OS can give each CPU a queue of its own.',
      zh: 'NVM Express：通过 PCI Express 连接固态硬盘的接口。规范允许几万个队列，每个队列深达几万条命令，所以操作系统可以给每个 CPU 配一个自己的队列。',
    },
  },
  discard: {
    title: { en: 'Discard (TRIM)', zh: 'discard（TRIM）' },
    body: {
      en: 'A request telling a solid-state drive that a range of blocks no longer holds useful data, so that it can erase and reuse that space ahead of time. SATA calls it TRIM.',
      zh: '告诉固态硬盘某段块已经不再存放有用数据的请求，这样它可以提前擦除并重新利用这些空间。SATA 里叫 TRIM。',
    },
  },
  bufferbloat: {
    title: { en: 'Bufferbloat', zh: '缓冲区膨胀（bufferbloat）' },
    body: {
      en: 'Over-large buffers in routers, modems and network stacks. They rarely drop packets, but under load they fill up and every packet waits behind all the others, adding long delays. The cure is to keep queues short or manage them actively.',
      zh: '路由器、调制解调器和网络协议栈里过大的缓冲区。它们很少丢包，但一有负载就被填满，每个包都要排在其他所有包后面，带来很长的延迟。解法是让队列保持很短，或主动管理队列。',
    },
  },
  mlfq: {
    title: { en: 'MLFQ (multi-level feedback queue)', zh: '多级反馈队列（MLFQ）' },
    body: {
      en: 'The scheduler of chapter 8. It keeps several queues at different priorities, runs the highest one that has work, and moves a job down when it has used up its time at a level, so short and interactive jobs stay on top. Every so often a *priority boost* moves all jobs back to the top, so that long ones do not starve.',
      zh: '第 8 章的调度器。它维护几个优先级不同的队列，运行有工作的最高一级，一个任务用完它在某一级的时间就往下移，于是短任务和交互式任务留在上面。每隔一段时间，*优先级提升*把所有任务都移回顶层，长任务才不至于饿死。',
    },
    chapter: 'cpu-sched-mlfq',
  },
}

export default terms
