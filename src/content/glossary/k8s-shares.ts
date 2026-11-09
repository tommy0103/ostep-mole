import type { Term } from './index'

/** Terms of “Tickets in your cloud bill” (Kubernetes CPU requests, limits and throttling). */
const terms: Record<string, Term> = {
  kubelet: {
    title: { en: 'kubelet', zh: 'kubelet' },
    body: {
      en: 'The [[kubernetes|Kubernetes]] agent that runs on every node. It has the container runtime start each [[pod|pod’s]] containers, and it works out their resource settings, which end up as files in their [[cgroup|cgroups]].',
      zh: '运行在每个节点上的 [[kubernetes|Kubernetes]] 代理程序。它让容器运行时启动每个 [[pod|pod]] 里的容器，并算出它们的资源设置，这些设置最终落在它们 [[cgroup|cgroup]] 的文件里。',
    },
  },
  millicpu: {
    title: { en: 'Millicore (m)', zh: '毫核（m）' },
    body: {
      en: 'Kubernetes’ unit of CPU, a thousandth of a CPU: `500m` is half a CPU, `2` is two. One CPU means one core, physical or virtual, depending on whether the node is a physical machine or a virtual one.',
      zh: 'Kubernetes 的 CPU 单位，千分之一个 CPU：`500m` 是半个 CPU，`2` 是两个。一个 CPU 指一个核，节点是物理机就是物理核，是虚拟机就是虚拟核。',
    },
  },
  'qos-class': {
    title: { en: 'QoS class (Kubernetes)', zh: 'QoS 等级（Kubernetes）' },
    body: {
      en: 'Kubernetes sorts each [[pod|pod]] into one of three quality-of-service classes by its requests and limits. *Guaranteed*: every container’s CPU and memory requests equal its limits. *BestEffort*: no requests or limits at all. *Burstable*: everything in between. The class decides which [[cgroup|cgroup]] the pod is placed under, and which pods go first when a node runs short of memory.',
      zh: 'Kubernetes 按 request 和 limit 把每个 [[pod|pod]] 归入三种服务质量（QoS）等级之一。*Guaranteed*：每个容器的 CPU 和内存 request 都等于 limit。*BestEffort*：一个 request 或 limit 都没设。*Burstable*：介于两者之间。等级决定 pod 放在哪个 [[cgroup|cgroup]] 之下，以及节点内存吃紧时先赶走哪些 pod。',
    },
  },
  'oci-runtime': {
    title: { en: 'OCI runtime (runc, crun)', zh: 'OCI 运行时（runc、crun）' },
    body: {
      en: 'The low-level program that actually creates a container: it sets up its [[namespace|namespaces]] and [[cgroup|cgroups]] and starts its first process. OCI (Open Container Initiative) is the standard it implements; runc and crun are the common ones, called by higher-level runtimes such as containerd and CRI-O.',
      zh: '真正创建容器的底层程序：它设置好容器的[[namespace|命名空间]]和 [[cgroup|cgroup]]，再启动容器里的第一个进程。OCI（开放容器倡议）是它所实现的标准；常见的实现是 runc 和 crun，由 containerd、CRI-O 这类上层运行时调用。',
    },
  },
  'garbage-collection': {
    title: { en: 'Garbage collection', zh: '垃圾回收' },
    body: {
      en: 'Automatic memory management in languages such as Go and Java: the language runtime finds objects the program can no longer reach and frees them, so the programmer never calls `free()`. The collector does its work on threads of its own, often several in parallel, and their CPU time counts against the program like any other.',
      zh: 'Go、Java 等语言里的自动内存管理：语言运行时找出程序再也够不着的对象并释放它们，程序员不用调用 `free()`。回收器在自己的线程上干活，往往好几个并行，它们用掉的 CPU 时间和程序其他部分一样算在程序头上。',
    },
  },
  'health-check': {
    title: { en: 'Health check', zh: '健康检查' },
    body: {
      en: 'A small request a platform sends a service at regular intervals to see whether it still responds. Kubernetes calls them probes; a container that keeps failing its liveness probe is restarted.',
      zh: '平台定期发给服务的一个小请求，看它是否还有响应。Kubernetes 管它叫探针（probe）；一个接连通不过存活探针（liveness probe）的容器会被重启。',
    },
  },
  'tail-latency': {
    title: { en: 'Tail latency', zh: '长尾延迟' },
    body: {
      en: 'The latency of the slowest requests, usually reported as a high [[percentile|percentile]] such as p99. A service can have a low average and a long tail at the same time, and users notice the tail.',
      zh: '最慢那部分请求的延迟，通常用高[[percentile|百分位]]（比如 p99）来报告。一个服务完全可以平均延迟很低、同时尾巴很长，而用户感受到的正是尾巴。',
    },
  },
  cadvisor: {
    title: { en: 'cAdvisor', zh: 'cAdvisor' },
    body: {
      en: 'Container Advisor, an open-source agent from Google that collects the resource use of each container on a machine (CPU, memory, network, disk), including the throttling counters of its [[cgroup|cgroup]]. It is built into the [[kubelet|kubelet]], and its figures are usually collected by [[prometheus|Prometheus]].',
      zh: 'Container Advisor，Google 开源的一个代理程序，收集机器上每个容器的资源用量（CPU、内存、网络、磁盘），其中包括它 [[cgroup|cgroup]] 里的限流计数器。它内置在 [[kubelet|kubelet]] 里，数据通常由 [[prometheus|Prometheus]] 采集。',
    },
  },
  prometheus: {
    title: { en: 'Prometheus', zh: 'Prometheus' },
    body: {
      en: 'An open-source monitoring system. It fetches numeric metrics from services at regular intervals, stores them as time series, and evaluates alert rules on them.',
      zh: '一个开源监控系统。它定期从各个服务抓取数值指标，存成时间序列，并在上面计算告警规则。',
    },
  },
  backport: {
    title: { en: 'Backport', zh: '回移植（backport）' },
    body: {
      en: 'Applying a fix made in a newer version of a program to older versions that are still maintained. Linux’s stable kernel series take fixes from the main line this way, so users of an older kernel get them without upgrading.',
      zh: '把在新版本里做的修复，移植到仍在维护的旧版本上。Linux 的各个稳定版内核系列就是这样从主线接收修复的，用旧内核的人不必升级也能得到它们。',
    },
  },
  goroutine: {
    title: { en: 'Goroutine', zh: 'goroutine' },
    body: {
      en: 'A function running concurrently in a Go program, started with the `go` keyword. Goroutines are not OS [[thread|threads]]: the Go runtime runs them on a few threads and switches between them itself, so a program can have hundreds of thousands. Each starts with a stack of a few kilobytes that grows as needed.',
      zh: 'Go 程序里并发运行的一个函数，用 `go` 关键字启动。goroutine 不是操作系统[[thread|线程]]：Go 运行时把它们放在少数几个线程上运行，自己在它们之间切换，所以一个程序可以有几十万个。每个 goroutine 起步只有几 KB 的栈，按需增长。',
    },
    note: 'work-stealing',
  },
  gomaxprocs: {
    title: { en: 'GOMAXPROCS', zh: 'GOMAXPROCS' },
    body: {
      en: 'The Go runtime setting that limits how many OS [[thread|threads]] may run Go code at the same time; threads blocked in [[syscall|system calls]] do not count. It used to default to the number of [[logical-cpu|logical CPUs]]. Since Go 1.25, on Linux, the default is lower when the [[cgroup|cgroup]]’s CPU limit is lower.',
      zh: 'Go 运行时的一项设置，限制同时运行 Go 代码的操作系统[[thread|线程]]数；阻塞在[[syscall|系统调用]]里的线程不算在内。它过去默认等于[[logical-cpu|逻辑 CPU]] 数；从 Go 1.25 起，在 Linux 上，如果 [[cgroup|cgroup]] 的 CPU limit 更低，默认值就取更低的那个。',
    },
    note: 'work-stealing',
  },
  'logical-cpu': {
    title: { en: 'Logical CPU', zh: '逻辑 CPU' },
    body: {
      en: 'What the OS counts as a CPU: each hardware thread it can schedule on. A core with simultaneous multithreading (Intel calls it Hyper-Threading) runs two hardware threads and shows up as two logical CPUs.',
      zh: '操作系统眼里的一个 CPU：它能在上面调度的每个硬件线程。支持同时多线程（Intel 称为超线程）的核心运行两个硬件线程，就显示为两个逻辑 CPU。',
    },
  },
  jvm: {
    title: { en: 'JVM (Java Virtual Machine)', zh: 'JVM（Java 虚拟机）' },
    body: {
      en: 'The program that runs Java, and other languages compiled to its bytecode. It manages memory with a [[garbage-collection|garbage collector]], and sizes things such as the collector’s threads and its default thread pools from the number of processors it believes it may use.',
      zh: '运行 Java（以及其他编译成其字节码的语言）的程序。它用[[garbage-collection|垃圾回收器]]管理内存，并根据它认为自己能用的处理器数，来决定回收器线程、默认线程池之类的规模。',
    },
  },
  'cache-affinity': {
    title: { en: 'Cache affinity', zh: '缓存亲和度' },
    body: {
      en: 'A thread runs faster on the CPU it ran on last, because that CPU’s [[cpu-cache|caches]] still hold its data; on another CPU the caches must be refilled first. Multiprocessor schedulers therefore try to keep a thread where it ran.',
      zh: '线程在上次运行过的 CPU 上跑得更快，因为那个 CPU 的[[cpu-cache|缓存]]里还留着它的数据；换到别的 CPU，缓存得先重新装满。所以多处理器调度器会尽量让线程留在原地。',
    },
    chapter: 'cpu-sched-multi',
  },
  'feature-gate': {
    title: { en: 'Feature gate (Kubernetes)', zh: '特性开关（feature gate）' },
    body: {
      en: 'A named switch that turns a new or experimental Kubernetes feature on or off. Features in their first, alpha stage are off unless an administrator turns them on by name.',
      zh: 'Kubernetes 里一个有名字的开关，用来打开或关闭某个新的或实验性的特性。处于最初 alpha 阶段的特性默认关闭，要管理员按名字打开。',
    },
  },
  vpa: {
    title: { en: 'Vertical Pod Autoscaler', zh: 'Vertical Pod Autoscaler（VPA）' },
    body: {
      en: 'A Kubernetes add-on that watches how much CPU and memory a workload’s [[pod|pods]] actually use and recommends new requests, or sets them itself.',
      zh: 'Kubernetes 的一个附加组件：观察某个负载的 [[pod|pod]] 实际用了多少 CPU 和内存，据此建议新的 request，或者直接替你设定。',
    },
  },
}

export default terms
