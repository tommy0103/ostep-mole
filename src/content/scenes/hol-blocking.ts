import type { SceneDef } from './index'

/** The running figure of “Head-of-line blocking is the convoy effect, everywhere”. */
const scene: SceneDef = {
  height: 460,
  bands: {
    overview: [4, 458],
    shape: [4, 112],
    http1: [118, 232],
    six: [118, 232],
    http2: [118, 232],
    tcp: [118, 232],
    quic: [118, 232],
    switch: [238, 346],
    voq: [238, 346],
    disk: [350, 456],
    deadline: [350, 456],
    device: [350, 456],
    kyber: [350, 456],
    moves: [4, 458],
  },
  parts: {
    res: [26, 76],
    convoy: [24, 66],
    jobs: [24, 104],
    server: [138, 226],
    browser: [138, 226],
    http1: [156, 216],
    six: [134, 232],
    tcp: [152, 218],
    quic: [138, 229],
    fabric: [256, 340],
    switch: [262, 346],
    voq: [256, 346],
    drive: [372, 448],
    device: [384, 442],
    deadline: [374, 454],
  },
  states: {
    overview: {
      title: { en: 'One queue, four places', zh: '一条队列，四个地方' },
      caption: {
        en: 'In every row, work waits in one FIFO and the head of the line sits next to what serves it. A, at the head, is long or stuck; B, C and D wait behind it, whether or not they have anything to do with it. Top: the lock where the convoy got its name.',
        zh: '每一行都是：工作在同一个 FIFO 里等，队头紧挨着为它服务的东西。队头的 A 很长或卡住了；B、C、D 排在它后面，不管和它有没有关系，都得等。最上面一行，就是“护航”这个名字的来处：一把锁。',
      },
    },
    shape: {
      title: { en: 'The shape of the problem', zh: '问题的形状' },
      caption: {
        en: 'Nobody ran any faster: only who waits behind whom changed. Two conditions make the convoy: one queue with a strict order, and service times that are unequal or can stall.',
        zh: '没有谁跑得更快，变的只是谁排在谁后面。造成车队的条件有两个：一个严格有序的队列，以及长短不均、可能卡住的服务时间。',
      },
    },
    http1: {
      title: { en: 'HTTP/1.1: pipelining', zh: 'HTTP/1.1：管线化' },
      caption: {
        en: 'On one connection, responses must leave in the order of the requests. The image is job A; the stylesheets, ready in microseconds, are B, C and D, and they wait until it has been sent in full.',
        zh: '在一条连接上，响应必须按请求的顺序发出。图片是任务 A；几微秒就能备好的样式表是 B、C、D，它们要等图片完整发完。',
      },
    },
    six: {
      title: { en: 'Six connections', zh: '六条连接' },
      caption: {
        en: 'Browsers spread requests over several connections per host; Chrome settled on six. The short responses no longer wait behind the image, but each connection is still a FIFO with its own handshake and congestion window.',
        zh: '浏览器把请求分摊到每个主机的好几条连接上，Chrome 定在六条。短响应不用再排在图片后面，但每条连接依然是 FIFO，各有各的握手和拥塞窗口。',
      },
    },
    http2: {
      title: { en: 'HTTP/2: frames take turns', zh: 'HTTP/2：帧轮流走' },
      caption: {
        en: 'Each response is a numbered stream cut into frames, and frames from different streams interleave on a single connection. This is round robin with a small time slice: the image can no longer hold the line.',
        zh: '每个响应都是一个带编号的流，切成帧，不同流的帧交错走在同一条连接上。这就是小时间片的轮转：图片再也占不住队头。',
      },
    },
    tcp: {
      title: { en: 'One layer down: TCP', zh: '再往下一层：TCP' },
      caption: {
        en: 'TCP delivers one ordered byte stream and cannot see HTTP/2’s streams. When a packet carrying part of the image is lost, the stylesheet frames behind it arrive and sit in the receive buffer until it is resent.',
        zh: 'TCP 交付的是一条有序的字节流，看不见 HTTP/2 的流。装着图片一部分的包丢了，排在它后面的样式表帧虽然到了，也只能躺在接收缓冲区里等重传。',
      },
    },
    quic: {
      title: { en: 'QUIC: a queue per stream', zh: 'QUIC：每个流一个队列' },
      caption: {
        en: 'QUIC orders bytes within a stream and promises nothing across streams. A lost packet of the image delays the image; the stylesheet streams, whose packets arrived, are delivered at once.',
        zh: 'QUIC 只保证流内字节有序，不保证流与流之间的顺序。图片丢了一个包，耽误的只是图片；样式表那几个流的包已经到了，立刻交付。',
      },
    },
    switch: {
      title: { en: 'Blocked behind a head', zh: '堵在队头后面' },
      caption: {
        en: 'The cell for busy output 3 is at the head of input 1. Behind it, a cell for idle output 5 cannot move, and the output sits unused. With FIFO inputs, throughput approaches 58.6% as the switch grows.',
        zh: '去往繁忙输出 3 的信元站在输入 1 的队头。它身后去往空闲输出 5 的信元动不了，那个输出只好闲着。输入端采用 FIFO 时，吞吐率随端口增多趋于 58.6%。',
      },
      demo: {
        label: { en: 'Where the lost capacity goes', zh: '损失的容量去了哪里' },
        steps: [
          {
            en: 'A switch with two inputs and two outputs. Each input always has cells waiting, each going to output 1 or 2 at random (here coloured by output). In each time slot, an output takes one cell, and only the cell at the head of a queue can go.',
            zh: '一台两个输入、两个输出的交换机。每个输入端始终有信元在等，每个信元随机去往输出 1 或输出 2（图中按输出着色）。每个时隙，一个输出只接收一个信元，而且只有队头的信元能走。',
          },
          {
            en: 'Slot 1: the two heads want different outputs, so both go. Two cells in this slot, the most a two-port switch can do.',
            zh: '时隙 1：两个队头要去不同的输出，两个都发出去。这个时隙发了 2 个信元，两端口交换机的上限。',
          },
          {
            en: 'Slot 2: both heads want output 1. One goes and the other waits. Output 2 is idle, although input 2 holds a cell for it, right behind the blocked head. Only one cell in this slot.',
            zh: '时隙 2：两个队头都要去输出 1。一个发出，另一个等待。输出 2 闲着，尽管输入 2 里就有一个要去它的信元，就排在被挡住的队头后面。这个时隙只发了 1 个。',
          },
          {
            en: 'Slot 3: the loser keeps its destination; the winner’s input shows a new head, with a random destination. So a collision comes again with probability 1/2. Here there is none, and both go.',
            zh: '时隙 3：败者保持原来的目的端口；胜者的输入换上一个目的随机的新队头。所以再次冲突的概率还是 1/2。这次没有冲突，两个都发出去。',
          },
          {
            en: 'Whatever happened before, the next slot is a collision with probability 1/2. Half the slots send two cells and half send one: 1.5 out of 2, or 75%. With more ports the ceiling falls towards 58.6%.',
            zh: '无论之前发生了什么，下一个时隙冲突的概率都是 1/2。一半时隙发 2 个，一半发 1 个：2 个里发出 1.5 个，也就是 75%。端口越多，天花板越低，趋于 58.6%。',
          },
          {
            en: 'Slot 2 again, with one queue per output at each input (only input 2’s are drawn). The cell for output 2 no longer stands behind the cell for output 1, so it goes, and both outputs are busy.',
            zh: '再看时隙 2，这次每个输入端都为每个输出设一个队列（图中只画了输入 2 的）。去输出 2 的信元不再排在去输出 1 的信元后面，于是它发了出去，两个输出都不闲着。',
          },
        ],
      },
    },
    voq: {
      title: { en: 'Virtual output queues', zh: '虚拟输出队列' },
      caption: {
        en: 'Each input keeps one queue per output. The cell for output 5 no longer stands behind the one for output 3, and a scheduler picks which queues are served in each slot. It is QUIC’s per-stream queue, in silicon.',
        zh: '每个输入端为每个输出各设一个队列。去输出 5 的信元不再排在去输出 3 的信元后面，由调度器决定每个时隙服务哪些队列。这就是 QUIC 的“每流一个队列”，只不过做在硅片里。',
      },
    },
    disk: {
      title: { en: 'A read behind write-back', zh: '读请求堵在写回后面' },
      caption: {
        en: 'Nobody is waiting on background write-back, A. A process is blocked on the 4 KB read, B. In one FIFO, a few hundred megabytes of A go first.',
        zh: '后台写回 A 没有人在等；4 KB 的读请求 B 却有一个进程被阻塞着。放进同一个 FIFO，几百 MB 的 A 就排在了前面。',
      },
    },
    deadline: {
      title: { en: 'mq-deadline', zh: 'mq-deadline' },
      caption: {
        en: 'Reads and writes get separate FIFOs, and each request an expiry: 500 ms for reads, 5 seconds for writes by default. Requests go in sector order in batches of 16; once the oldest in a FIFO has expired, it is served at the next batch.',
        zh: '读和写各走各的 FIFO，每个请求都有到期时间：默认读 500 ms、写 5 秒。请求平时按扇区顺序成批服务，每批 16 个；某个 FIFO 里最老的请求一过期，就在下一批转去服务它。',
      },
    },
    device: {
      title: { en: 'The queue inside the drive', zh: '磁盘里的队列' },
      caption: {
        en: 'A SATA drive with NCQ accepts up to 32 commands and reorders them itself; an NVMe drive accepts far more. Once a request is inside, the kernel’s scheduler cannot reorder it, so a new read waits behind the writes already there.',
        zh: '支持 NCQ 的 SATA 磁盘最多接受 32 条命令，并自行重排；NVMe 盘接受的多得多。请求一旦进了设备，内核的调度器就无法再重排，新的读请求只能排在已在里面的写请求后面。',
      },
    },
    kyber: {
      title: { en: 'Kyber: keep it short', zh: 'Kyber：把队列留短' },
      caption: {
        en: 'Kyber limits how many requests of each kind may be in the drive at once, and adjusts the limit to meet latency targets (by default 2 ms for reads, 10 ms for writes). With a short queue in the drive, the order stays in the kernel’s hands.',
        zh: 'Kyber 限制每类请求能同时在设备里的数量，并调整这个上限以达到延迟目标（默认读 2 ms、写 10 ms）。设备里的队列短了，顺序就还掌握在内核手里。',
      },
    },
    moves: {
      title: { en: 'A few moves', zh: '翻来覆去那几招' },
      caption: {
        en: 'Each row with its fix: the order promised is narrowed to the work that needs it, one stream, one output, one kind of request. The article’s table has four moves in all; more parallel queues and slicing the work are the other two.',
        zh: '每一行都换上了各自的解法：把顺序的承诺收窄到确实需要它的工作上，一个流、一个输出、一类请求。文中的表格一共四招，另外两招是开更多并行队列和把工作切片。',
      },
    },
  },
  terms: {
    lock: ['convoy'],
    'page-fault': ['convoy'],
    http: ['server', 'browser'],
    handshake: ['six'],
    'congestion-window': ['six'],
    tcp: ['tcp'],
    udp: ['quic'],
    'network-switch': ['fabric'],
    matching: ['voq'],
    ncq: ['drive'],
    nvme: ['drive'],
  },
}

export default scene
