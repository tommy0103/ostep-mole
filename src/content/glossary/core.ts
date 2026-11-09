import type { Term } from './index'

/** Terms of the first field notes (the browser processes article and the book's own basics). */
const terms: Record<string, Term> = {
  'address-space': {
    title: { en: 'Address space', zh: '地址空间' },
    body: {
      en: 'The range of memory addresses a process can use. Every process gets its own, and the OS and hardware translate each of its addresses to physical memory, so one process has no address that reaches another’s memory.',
      zh: '一个进程能使用的内存地址范围。每个进程都有自己的一份，操作系统和硬件把它的每个地址翻译到物理内存上，所以一个进程根本没有能通向另一个进程内存的地址。',
    },
    chapter: 'vm-intro',
  },
  'access-token': {
    title: { en: 'Access token (Windows)', zh: '访问令牌（Windows）' },
    body: {
      en: 'The object Windows attaches to every process to say who it runs as: the user, the user’s groups and privileges, and an [[integrity-level|integrity level]]. Every access check compares the token with the object’s permissions. A *restricted* token has groups and privileges taken out, so the process can do less than its user could.',
      zh: 'Windows 附在每个进程上、说明它“以谁的身份运行”的对象：用户、用户所属的组和特权，以及一个[[integrity-level|完整性级别]]。每次访问检查都拿令牌和对象的权限做比对。*受限*令牌去掉了一部分组和特权，于是进程能做的事比它的用户本人少。',
    },
  },
  bpf: {
    title: { en: 'BPF (Berkeley Packet Filter)', zh: 'BPF（伯克利包过滤器）' },
    body: {
      en: 'A tiny instruction set the Linux kernel can run safely on behalf of user programs. It was created in 1992 so a packet sniffer could tell the kernel which network packets it wanted. It is deliberately limited: the original version has no backward jumps, so no loops, and the kernel checks every program before loading it, so it always finishes and cannot touch memory it should not. [[seccomp|seccomp]] reuses it to filter system calls; its extended successor, eBPF, now runs tracing and networking code inside the kernel.',
      zh: '一套极小的指令集，Linux 内核可以安全地替用户程序运行它。它诞生于 1992 年，用来让抓包程序告诉内核自己想要哪些网络包。它是刻意受限的：最初的版本不能向回跳转，所以没有循环；内核在加载每段程序前都会检查，保证它一定能结束、也碰不到不该碰的内存。[[seccomp|seccomp]] 借它来过滤系统调用；它的扩展版 eBPF 如今在内核里运行性能追踪和网络处理代码。',
    },
  },
  container: {
    title: { en: 'Container', zh: '容器' },
    body: {
      en: 'A group of processes to which the kernel shows a private view of the system, using [[namespace|namespaces]], with resource limits set by cgroups. To the processes inside it looks like a separate machine; underneath they share the host’s kernel.',
      zh: '一组进程，内核借助[[namespace|命名空间]]让它们看到一个私有的系统视图，并用 cgroups 限制它们的资源。对里面的进程来说，这像是一台独立的机器；但在底下，它们和宿主机共用同一个内核。',
    },
    note: 'zombies-containers',
  },
  'copy-on-write': {
    title: { en: 'Copy-on-write (COW)', zh: '写时复制（COW）' },
    body: {
      en: 'Sharing memory between processes that only looks like copying. After [[fork-exec|`fork()`]], parent and child map the same physical pages, marked read-only. When either writes to a page, the CPU traps to the OS, which copies just that page. Pages nobody writes are never copied.',
      zh: '一种看起来像复制、实际上是共享的内存技巧。[[fork-exec|`fork()`]] 之后，父子进程映射同一批物理页，并标记为只读；任何一方写某一页时，CPU 陷入操作系统，由它只复制这一页。没人写的页永远不会被复制。',
    },
    chapter: 'vm-complete',
    note: 'fork-redis',
  },
  corb: {
    title: { en: 'CORB and ORB', zh: 'CORB 与 ORB' },
    body: {
      en: 'Filters in the browser’s network service for cross-site responses requested by tags such as `<img>` and `<script>`, which may load from any site. Such a response used to be delivered into the requesting page’s renderer even though the page’s scripts could not read it, and [[spectre|Spectre]] can read anything in a process. CORB (Cross-Origin Read Blocking, 2018) blocks responses that are HTML, XML or JSON; its successor ORB (Opaque Response Blocking) lets through only what such tags can use, such as images, media, scripts and stylesheets.',
      zh: '浏览器网络服务里的过滤器，针对 `<img>`、`<script>` 这类标签发出的跨站请求——这些标签可以从任何站点加载内容。过去，这样的响应会被送进发起请求的页面所在的渲染进程，页面脚本虽然读不到它，[[spectre|Spectre]] 却能读到进程里的任何东西。CORB（跨源读取阻止，2018 年）拦下 HTML、XML、JSON 类型的响应；它的后继者 ORB（不透明响应阻止）只放行这类标签真正用得上的东西，比如图片、音视频、脚本和样式表。',
    },
  },
  'cpu-cache': {
    title: { en: 'CPU cache', zh: 'CPU 缓存' },
    body: {
      en: 'A small, very fast memory on the processor that keeps recently used data. Reading something already in the cache takes a few nanoseconds; fetching it from main memory takes around a hundred. Timing attacks measure exactly that difference.',
      zh: '处理器上一块很小、很快的存储，保存最近用过的数据。读取已在缓存里的数据只要几纳秒，从主存取则要一百纳秒左右。计时攻击测量的正是这个差别。',
    },
    chapter: 'cpu-sched-multi',
  },
  driver: {
    title: { en: 'Device driver', zh: '设备驱动' },
    body: {
      en: 'The code that operates one piece of hardware, such as a graphics card, on behalf of the OS. Drivers are large, written by hardware vendors and run with high privilege, which makes them a common source of crashes.',
      zh: '代表操作系统操控某个硬件（比如显卡）的代码。驱动通常很庞大，由硬件厂商编写，又以高权限运行，因此是崩溃的常见来源。',
    },
  },
  'fork-exec': {
    title: { en: 'fork() and exec()', zh: 'fork() 与 exec()' },
    body: {
      en: 'The two Unix [[syscall|system calls]] for starting programs. `fork()` makes a copy of the calling process; `exec()` replaces the program running in a process with a new one. A shell runs a command by forking, then exec’ing in the child.',
      zh: 'Unix 里启动程序的两个[[syscall|系统调用]]。`fork()` 复制出调用它的进程；`exec()` 把一个进程里正在运行的程序换成另一个。shell 运行一条命令时，先 fork，再在子进程里 exec。',
    },
    chapter: 'cpu-api',
  },
  handle: {
    title: { en: 'Handle', zh: '句柄' },
    body: {
      en: 'A small number the kernel gives a process to refer to something it opened: a file, a socket, another process. The process can reach the object only through the handle, and the kernel checks each use. On Unix these are called file descriptors.',
      zh: '内核发给进程的一个小编号，用来指代它打开的东西：文件、套接字、另一个进程。进程只能通过句柄接触那个对象，内核会检查每一次使用。在 Unix 上它叫文件描述符。',
    },
    chapter: 'cpu-api',
  },
  iframe: {
    title: { en: 'iframe', zh: 'iframe' },
    body: {
      en: 'An HTML element that embeds one web page inside another, often from a different site: an advertisement, a video player, a payment form. Each iframe holds its own document with its own [[origin|origin]].',
      zh: '把一个网页嵌进另一个网页的 HTML 元素，嵌进来的往往来自别的站点：广告、视频播放器、支付表单。每个 iframe 都装着自己的文档，有自己的[[origin|源]]。',
    },
  },
  'integrity-level': {
    title: { en: 'Integrity level (Windows)', zh: '完整性级别（Windows）' },
    body: {
      en: 'A rank Windows gives to processes and objects: Untrusted, Low, Medium, High, System. By default a process cannot write to anything ranked higher than itself, whatever its user may do. Ordinary programs run at Medium; a Chrome renderer runs at Untrusted, the lowest.',
      zh: 'Windows 给进程和对象定的等级：不受信任（Untrusted）、低、中、高、系统。默认情况下，进程不能写入任何等级比自己高的东西，不管它的用户有什么权限。普通程序运行在“中”；Chrome 的渲染进程运行在最低的“不受信任”。',
    },
  },
  ipc: {
    title: { en: 'IPC (inter-process communication)', zh: 'IPC（进程间通信）' },
    body: {
      en: 'Any way for processes to pass data to each other, since they cannot read each other’s memory: pipes, sockets, [[shared-memory|shared memory]], message channels. Chromium’s processes talk over a message system called Mojo.',
      zh: '进程之间互相传递数据的任何方式——因为它们读不到彼此的内存：管道、套接字、[[shared-memory|共享内存]]、消息通道。Chromium 的各个进程通过一套叫 Mojo 的消息系统通信。',
    },
  },
  'job-object': {
    title: { en: 'Job object (Windows)', zh: '作业对象（Windows）' },
    body: {
      en: 'A Windows kernel object that groups processes and limits them: how many processes, how much memory and CPU, whether they may use the clipboard or change system settings. Chromium puts each renderer in a job that allows only one process.',
      zh: 'Windows 的一种内核对象，把一组进程归在一起并加以限制：最多几个进程、用多少内存和 CPU、能否使用剪贴板或修改系统设置。Chromium 把每个渲染进程放进一个只允许一个进程的作业对象里。',
    },
  },
  microkernel: {
    title: { en: 'Microkernel', zh: '微内核' },
    body: {
      en: 'An OS design that keeps only the bare minimum in the kernel (address spaces, threads, message passing) and runs drivers, file systems and network stacks as ordinary user processes. A crashing driver then takes down one process, not the machine. MINIX 3, QNX and seL4 are microkernels.',
      zh: '一种操作系统设计：内核里只保留最基本的东西（地址空间、线程、消息传递），驱动、文件系统、网络协议栈都作为普通用户进程运行。这样一个驱动崩溃只会带走一个进程，而不是整台机器。MINIX 3、QNX、seL4 都是微内核。',
    },
  },
  namespace: {
    title: { en: 'Namespace (Linux)', zh: '命名空间（Linux）' },
    body: {
      en: 'A Linux feature that gives a process its own private view of one kind of system resource: process IDs, network interfaces, mounted file systems, the hostname and others. A process in a new PID namespace sees only the processes started inside it. Namespaces are the main building block of [[container|containers]].',
      zh: 'Linux 的一项功能，给进程一份某类系统资源的私有视图：进程 ID、网络接口、挂载的文件系统、主机名等。处在新 PID 命名空间里的进程，只看得到在这个命名空间里启动的进程。命名空间是[[container|容器]]最主要的积木。',
    },
    note: 'zombies-containers',
  },
  'oom-kill': {
    title: { en: 'Out-of-memory kill', zh: '内存不足被杀（OOM kill）' },
    body: {
      en: 'When memory runs out, the kernel picks a process and kills it to get memory back. On Linux this is the OOM killer, which prefers large processes. Android’s low-memory killer ends background apps for the same reason, before memory runs out entirely.',
      zh: '内存耗尽时，内核挑一个进程杀掉，把内存收回来。在 Linux 上这由 OOM killer 负责，它倾向于挑大进程下手。Android 的低内存杀手（lmkd）出于同样的原因，会在内存彻底耗尽之前结束后台应用。',
    },
    note: 'zram-oom',
  },
  origin: {
    title: { en: 'Origin', zh: '源（origin）' },
    body: {
      en: 'On the web, the scheme, host and port of a URL taken together, such as `https://example.com:443`. The same-origin policy lets a page read data only from its own origin unless the other side allows it. A *site* is coarser: the scheme plus the registrable domain, so `a.example.com` and `b.example.com` are different origins but the same site.',
      zh: '在 Web 上，指 URL 的协议、主机和端口三者合起来，例如 `https://example.com:443`。同源策略规定，除非对方允许，页面只能读取自己这个源的数据。*站点*（site）则更粗：协议加可注册域名，所以 `a.example.com` 和 `b.example.com` 是不同的源，却是同一个站点。',
    },
  },
  'page-table': {
    title: { en: 'Page table', zh: '页表' },
    body: {
      en: 'The structure the OS keeps for each process to map its virtual pages to physical memory. The CPU consults it, through the [[tlb|TLB]], on every memory access; an address with no entry leads nowhere.',
      zh: '操作系统为每个进程维护的数据结构，把它的虚拟页映射到物理内存。CPU 每次访问内存都要（经由 [[tlb|TLB]]）查它；没有表项的地址哪儿也去不了。',
    },
    chapter: 'vm-paging',
  },
  percentile: {
    title: { en: 'Percentile', zh: '百分位' },
    body: {
      en: 'The value below which a given share of measurements fall. The median is the 50th percentile; at the 99th percentile, only one user in a hundred had more. Systems papers report high percentiles because the worst cases are what people notice.',
      zh: '有给定比例的测量值落在它之下的那个值。中位数就是第 50 百分位；第 99 百分位意味着一百个用户里只有一个比它更高。系统论文爱报高百分位，因为人们感受到的正是最坏的情况。',
    },
  },
  pid: {
    title: { en: 'Process ID (PID)', zh: '进程 ID（PID）' },
    body: {
      en: 'The number the OS gives each process, used to name it in [[syscall|system calls]] such as `kill()` and `wait()`.',
      zh: '操作系统分配给每个进程的编号，在 `kill()`、`wait()` 这类[[syscall|系统调用]]里用来指明是哪个进程。',
    },
    chapter: 'cpu-api',
  },
  principal: {
    title: { en: 'Principal', zh: '主体（principal）' },
    body: {
      en: 'In security, the unit permissions are given to: a user, a program, or on the web a site or [[origin|origin]]. Code that belongs to one principal is trusted with all of that principal’s data.',
      zh: '安全领域里被授予权限的单位：一个用户、一个程序，在 Web 上则是一个站点或[[origin|源]]。属于同一主体的代码，被信任可以接触这个主体的全部数据。',
    },
  },
  seccomp: {
    title: { en: 'seccomp', zh: 'seccomp' },
    body: {
      en: 'A Linux feature (secure computing mode) that limits which [[syscall|system calls]] a process may make. In its filter mode, seccomp-bpf, the process installs a small [[bpf|BPF]] program; from then on the kernel runs it on every system call and allows the call, fails it or kills the process, based on the call’s number and arguments. A filter can be tightened later, never removed.',
      zh: 'Linux 的一项功能（secure computing mode，安全计算模式），限制进程能发起哪些[[syscall|系统调用]]。在它的过滤模式 seccomp-bpf 下，进程装上一段小小的 [[bpf|BPF]] 程序；此后内核对每一次系统调用都先运行它，根据调用号和参数决定放行、返回错误，还是直接杀掉进程。过滤规则以后只能收紧，不能撤掉。',
    },
  },
  'shared-memory': {
    title: { en: 'Shared memory', zh: '共享内存' },
    body: {
      en: 'Memory mapped into the [[address-space|address spaces]] of two or more processes at once, so what one writes the other can read without copying. Everything else in their address spaces stays private.',
      zh: '同时映射进两个或多个进程[[address-space|地址空间]]的一段内存，一方写下的内容另一方无需复制就能读到。地址空间里的其余部分仍然各自私有。',
    },
  },
  sharedarraybuffer: {
    title: { en: 'SharedArrayBuffer', zh: 'SharedArrayBuffer' },
    body: {
      en: 'A JavaScript object that lets a page’s worker threads share memory. One thread can count in a loop while another runs, which gives a timer far finer than the clocks browsers deliberately blurred after [[spectre|Spectre]]. Browsers now enable it only on pages that opt in to cross-origin isolation.',
      zh: '一种 JavaScript 对象，让同一页面的 worker 线程共享内存。一个线程不停计数、另一个线程干活，就得到了一个远比浏览器在 [[spectre|Spectre]] 之后刻意模糊过的时钟精细得多的计时器。如今浏览器只在声明了跨源隔离的页面上启用它。',
    },
  },
  spectre: {
    title: { en: 'Spectre and Meltdown', zh: 'Spectre 与 Meltdown' },
    body: {
      en: 'CPU attacks disclosed in January 2018. Processors execute instructions *speculatively*, before they know a branch will go that way, and undo the results when it does not, but not the traces left in the [[cpu-cache|cache]]. Timing later memory accesses reads those traces. Meltdown let user programs read kernel memory and was fixed in the OS and in newer CPUs; Spectre is harder to stop, and inside one [[address-space|address space]] it lets ordinary JavaScript read whatever the process holds.',
      zh: '2018 年 1 月公开的 CPU 攻击。处理器会在确定分支走向之前就*推测性地*执行指令，猜错了再撤销结果，但留在[[cpu-cache|缓存]]里的痕迹不会撤销。测量之后的内存访问时间，就能读出这些痕迹。Meltdown 让用户程序能读内核内存，已由操作系统和新一代 CPU 修复；Spectre 更难根除，在同一个[[address-space|地址空间]]里，它能让普通的 JavaScript 读到进程持有的任何数据。',
    },
    chapter: 'vm-complete',
  },
  syscall: {
    title: { en: 'System call', zh: '系统调用' },
    body: {
      en: 'How a program asks the kernel to do something it may not do itself: open a file, start a process, send a packet. The program executes a [[trap|trap]] instruction; the CPU switches to kernel mode and jumps to code the kernel chose in advance, which checks the request before doing it.',
      zh: '程序请内核替它做自己无权做的事的方式：打开文件、启动进程、发送网络包。程序执行一条[[trap|陷阱]]指令，CPU 切换到内核态，跳到内核事先指定好的代码，由内核检查请求后再去执行。',
    },
    chapter: 'cpu-mechanisms',
    note: 'syscall-cost',
  },
  thread: {
    title: { en: 'Thread', zh: '线程' },
    body: {
      en: 'An independent stream of execution inside a process, with its own registers and stack but the same [[address-space|address space]] as the other threads of that process. Threads share data cheaply, and for the same reason one bad thread can corrupt all the others. Part II of the book is about them.',
      zh: '进程内部一条独立的执行流，有自己的寄存器和栈，但和同一进程的其他线程共用一个[[address-space|地址空间]]。线程之间共享数据很便宜；也正因如此，一个出错的线程能把其他线程全都写坏。本书第二部分专门讲它。',
    },
  },
  tlb: {
    title: { en: 'TLB (translation lookaside buffer)', zh: 'TLB（地址转换旁路缓冲）' },
    body: {
      en: 'A small cache inside the CPU holding recent virtual-to-physical translations, so most memory accesses do not have to read the [[page-table|page table]].',
      zh: 'CPU 内部的一块小缓存，保存最近用过的虚拟地址到物理地址的转换结果，这样大多数内存访问就不必去读[[page-table|页表]]。',
    },
    chapter: 'vm-tlbs',
  },
  trap: {
    title: { en: 'Trap', zh: '陷阱（trap）' },
    body: {
      en: 'A switch from user mode into the kernel, to a handler the kernel registered at boot. [[syscall|System calls]] trap on purpose; errors such as dividing by zero or touching an unmapped address trap by accident. Either way, the kernel decides what happens next.',
      zh: '从用户态切进内核、跳到内核在启动时登记好的处理程序。[[syscall|系统调用]]是有意陷入；除以零、访问未映射的地址这类错误是意外陷入。无论哪种，接下来发生什么都由内核决定。',
    },
    chapter: 'cpu-mechanisms',
  },
  zygote: {
    title: { en: 'Zygote', zh: 'zygote（合子进程）' },
    body: {
      en: 'A process that does the expensive start-up work once (loading the program and its libraries, initializing common state) and then only waits. Each new process is a [[fork-exec|`fork()`]] of it, so it starts already initialized and shares those pages [[copy-on-write|copy-on-write]]. Chromium on Linux starts its renderers this way, saving up to about 8 MB each, and the zygote keeps the browser’s own version of the program loaded even if an update replaces it on disk. Android starts every app from its Zygote. The name is biology’s: the single cell all the others come from.',
      zh: '一个把昂贵的启动工作（加载程序和共享库、初始化公共状态）做一次、然后就只等着的进程。每个新进程都是它的一次 [[fork-exec|`fork()`]]，一出生就已初始化好，并以[[copy-on-write|写时复制]]的方式共享这些内存页。Linux 上的 Chromium 就这样启动渲染进程，每个最多能省约 8 MB；即使升级把磁盘上的程序换掉了，zygote 手里仍留着与浏览器同一版本的程序。Android 的每个应用也都从 Zygote 分出来。名字来自生物学的“受精卵”：其他所有细胞都由它而来。',
    },
    chapter: 'cpu-api',
  },
}

export default terms
