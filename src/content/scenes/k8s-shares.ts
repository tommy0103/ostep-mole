import type { SceneDef } from './index'

/** The running figure of “Tickets in your cloud bill: CPU requests, limits and throttling”. */
const scene: SceneDef = {
  height: 460,
  bands: {
    overview: [0, 460],
    tickets: [164, 222],
    weights: [6, 222],
    formula: [6, 218],
    hierarchy: [84, 332],
    quota: [6, 332],
    throttle: [223, 426],
    dashboard: [334, 460],
    bug: [223, 332],
    threads: [223, 426],
    runtimes: [223, 426],
    fixes: [0, 460],
    assign: [6, 218],
  },
  parts: {
    yaml: [10, 70],
    reqpath: [12, 44],
    limpath: [48, 80],
    tree: [88, 214],
    system: [128, 158],
    pods: [170, 214],
    split: [164, 222],
    pool: [224, 244],
    cores: [258, 330],
    timeline: [336, 424],
    request: [388, 404],
    strip: [434, 456],
  },
  states: {
    overview: {
      title: { en: 'Two numbers, two mechanisms', zh: '两个数字，两套机制' },
      caption: {
        en: 'The request becomes a weight in the cgroup tree, a share that matters only when CPUs are contended. The limit becomes a quota of CPU time per 100 ms period; once it is spent, the container stops until the next period, however idle the node.',
        zh: 'request 变成 cgroup 树里的权重，只在 CPU 有争用时才起作用；limit 变成每 100 ms 周期的 CPU 时间配额，一旦花完，容器就停下来等下一个周期，不管节点多闲。',
      },
    },
    tickets: {
      title: { en: 'Tickets, briefly', zh: '先回顾彩票' },
      caption: {
        en: 'Chapter 9’s rule: when both are busy, the CPU is split by the ratio of their tickets, so 100 against 300 is 1 : 3. When one has nothing to run, the other may use all of it, and nothing is wasted.',
        zh: '第 9 章的规则：两边都忙时，CPU 按彩票之比分配，100 对 300 就是 1 : 3；一方无事可做时，另一方可以全部用掉，什么都不浪费。',
      },
    },
    weights: {
      title: { en: 'Requests become weights', zh: 'request 变成权重' },
      caption: {
        en: 'The kubelet turns 500m into 512 shares, and the container runtime turns those into cpu.weight 59. Weights are compared among siblings: beside pod B at 100, pod A gets 59 parts to B’s 100 when both are busy, and all of it when B is idle.',
        zh: 'kubelet 把 500m 换算成 512 shares，容器运行时再把它换算成 cpu.weight 59。权重只在兄弟之间比较：旁边的 pod B 权重 100，两边都忙时 A 和 B 按 59 : 100 分；B 空闲时，A 可以全用。',
      },
    },
    formula: {
      title: { en: 'A line, then a curve', zh: '先是直线，后是曲线' },
      caption: {
        en: 'The old straight line gave 500m a weight of 20 and a whole CPU only 39, while system services run at the default 100. The curve maps 512 shares to 59 and 1024 to exactly 100.',
        zh: '旧的直线把 500m 映射成权重 20，整整一个 CPU 也只有 39，而系统服务跑在默认的 100。新曲线把 512 shares 映射成 59，1024 恰好是 100。',
      },
    },
    hierarchy: {
      title: { en: 'A tree, on every CPU', zh: '一棵树，铺在每个 CPU 上' },
      caption: {
        en: 'A pod’s share is its fraction of its parent’s share, all the way up: chapter 9’s ticket currencies. On each CPU where it has runnable tasks, a group is one entity in the run queue, with its own queue inside. Drawn without the QoS-class groups and the containers’ own cgroups.',
        zh: '一个 pod 的份额，是它在父节点份额里所占的比例，一层层乘上去——第 9 章的彩票货币。在它有可运行任务的每个 CPU 上，一个组都是运行队列里的一个实体，内部还有自己的队列。图中省略了 QoS 等级那一层和各容器自己的 cgroup。',
      },
    },
    quota: {
      title: { en: 'Limits become a budget', zh: 'limit 变成预算' },
      caption: {
        en: 'The limit becomes cpu.max: 200 ms of CPU time per 100 ms period, summed over every CPU the pod runs on. The pool is refilled at the start of each period, and CPUs running pod A’s threads draw from it in 5 ms slices.',
        zh: 'limit 变成 cpu.max：每 100 ms 周期 200 ms CPU 时间，按 pod 所用的全部 CPU 合计。配额池在每个周期开始时补满，运行 pod A 线程的 CPU 按 5 ms 一片从中领取。',
      },
    },
    throttle: {
      title: { en: 'Quota gone at 20 ms', zh: '20 ms 就花光了配额' },
      caption: {
        en: 'Ten threads spend 10 ms of budget every millisecond, so the pool is empty at 20 ms. Pod A is throttled until the period ends at 100 ms, and a 3 ms request that arrived at 21 ms finishes at about 103 ms.',
        zh: '十个线程每毫秒花掉 10 ms 预算，到 20 ms 池就空了。pod A 被限流到 100 ms 周期结束；一个 21 ms 到达、只需 3 ms 的请求，大约在 103 ms 才完成。',
      },
      demo: {
        label: { en: 'One period, step by step', zh: '一个周期，分步看' },
        steps: [
          {
            en: 't = 0. A period starts, and the timer refills pod A’s pool: 200 ms of CPU time for the next 100 ms. A burst begins: ten of pod A’s threads become ready, one on each of ten idle CPUs.',
            zh: 't = 0。一个周期开始，定时器把 pod A 的配额池补满：接下来 100 ms 里共 200 ms CPU 时间。突发开始了：pod A 的十个线程变为就绪，分别落在十个空闲 CPU 上。',
          },
          {
            en: 'Each CPU takes a 5 ms slice from the pool to run its thread, and another when that one is used up. Ten CPUs together spend 10 ms of the budget every millisecond, so by t = 10 ms half of it is gone.',
            zh: '每个 CPU 从池里领一片 5 ms 来运行它的线程，用完再领。十个 CPU 加起来每毫秒花掉 10 ms 预算，到 t = 10 ms 已经花掉一半。',
          },
          {
            en: 't = 20 ms. The pool is empty and each CPU’s slice runs out. Pod A is throttled: it is taken off every run queue, and none of its threads may run, although the CPUs are idle.',
            zh: 't = 20 ms。池空了，每个 CPU 手里的片也用完了。pod A 被限流：它被移出所有运行队列，它的线程一个都不能运行，尽管这些 CPU 都闲着。',
          },
          {
            en: 't = 21 ms. A small request arrives that needs 3 ms of CPU. Its thread is ready, but pod A is throttled, so it waits, and so does everything else in the container.',
            zh: 't = 21 ms。一个只需 3 ms CPU 的小请求到达。处理它的线程已就绪，但 pod A 正在被限流，只能等；容器里的其他一切也都在等。',
          },
          {
            en: 't = 100 ms. The next period begins and the timer refills the pool. Pod A goes back on the run queues, and the request’s thread runs.',
            zh: 't = 100 ms。下一个周期开始，定时器补满配额池。pod A 回到运行队列，处理请求的线程开始运行。',
          },
          {
            en: 't = 103 ms. The request is done, 82 ms after it arrived: 3 ms of work and 79 ms of waiting for the period boundary. The node had idle CPUs the whole time.',
            zh: 't = 103 ms。请求完成，距到达已过去 82 ms：3 ms 在干活，79 ms 在等周期边界。而节点上始终有空闲的 CPU。',
          },
        ],
      },
    },
    dashboard: {
      title: { en: 'What the dashboard shows', zh: '监控面板上看到的' },
      caption: {
        en: 'Averaged over time the pod uses 0.4 CPU, 20% of its limit, yet it is throttled in 1 period out of 10. cpu.stat counts the periods and the throttled ones; their ratio is the alarm to watch, not utilization.',
        zh: '平均下来，这个 pod 只用了 0.4 个 CPU，即 limit 的 20%，却每 10 个周期就有 1 个被限流。cpu.stat 记录周期数和被限流的周期数；该盯的是两者之比，而不是利用率。',
      },
    },
    bug: {
      title: { en: 'Crumbs that expired', zh: '会过期的零头' },
      caption: {
        en: 'When a CPU’s threads in the group go idle, it returns its slice to the pool but keeps 1 ms. From Linux 4.18 those crumbs expired at every period boundary, up to 87 ms per period on an 88-core machine, until 5.4 removed the expiry.',
        zh: '某个 CPU 上属于该组的线程空闲下来时，它把片还给池，但自己留 1 ms。从 Linux 4.18 起，这些零头在每个周期边界都会过期——在 88 核机器上每个周期最多 87 ms——直到 5.4 取消了过期。',
      },
    },
    threads: {
      title: { en: 'Many threads, short budget', zh: '线程多，预算短' },
      caption: {
        en: 'Before Go 1.25, a Go service with a 2-CPU limit on a 64-core node ran up to 64 threads of Go code at once. Sixty-four threads spend 200 ms in a bit over 3 ms, and then the pod waits out the rest of the period.',
        zh: 'Go 1.25 之前，一个 limit 为 2 个 CPU、跑在 64 核节点上的 Go 服务，最多会同时用 64 个线程运行 Go 代码。64 个线程三毫秒多一点就花光 200 ms，之后 pod 只能干等到周期结束。',
      },
    },
    runtimes: {
      title: { en: 'Threads sized to the limit', zh: '按 limit 定线程数' },
      caption: {
        en: 'Go 1.25 sets GOMAXPROCS from the CPU limit: at most two threads run Go code at once, and two threads cannot spend 200 ms before the 100 ms period is over. The JVM’s processor count likewise follows the quota.',
        zh: 'Go 1.25 按 CPU limit 设定 GOMAXPROCS：同时最多两个线程运行 Go 代码，而两个线程不可能在 100 ms 周期结束前花完 200 ms。JVM 的处理器数同样跟着配额走。',
      },
    },
    fixes: {
      title: { en: 'What people do', zh: '人们的做法' },
      caption: {
        en: 'Drop the limit and rely on the weight, or keep it and size the threads to it. Guaranteed pods can get whole cores, and cpu.max.burst lets a group bank unused quota. Either way, alert on the share of throttled periods.',
        zh: '去掉 limit、只靠权重；或者保留 limit，让线程数与之匹配。Guaranteed pod 可以独占整核，cpu.max.burst 让一个组存下没用完的配额。无论哪种，都按被限流周期的比例来告警。',
      },
    },
    assign: {
      title: { en: 'Who picks the tickets?', zh: '彩票谁来定？' },
      caption: {
        en: 'The Kubernetes scheduler uses requests to decide which pods fit on which node, so a request is both a ticket and a reservation. A person still writes the number into the YAML, often by copying a neighbour’s.',
        zh: 'Kubernetes 调度器按 request 决定哪些 pod 能放到哪个节点上，所以 request 既是彩票，也是预订。而这个数字仍然由人写进 YAML，往往是照抄隔壁的。',
      },
    },
  },
  terms: {
    kubernetes: ['yaml', 'pods'],
    pod: ['pods'],
    container: ['yaml'],
    cgroup: ['tree', 'system', 'pods'],
    kubelet: ['reqpath', 'limpath'],
    millicpu: ['yaml'],
    'qos-class': ['tree'],
    'oci-runtime': ['reqpath'],
    thread: ['cores'],
    percentile: ['request'],
    'tail-latency': ['request'],
    cadvisor: ['strip'],
    prometheus: ['strip'],
    goroutine: ['cores'],
    gomaxprocs: ['cores'],
    'logical-cpu': ['cores'],
    'cache-affinity': ['cores'],
    vpa: ['yaml'],
    daemon: ['system'],
  },
}

export default scene
