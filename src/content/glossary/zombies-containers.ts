import type { Term } from './index'

/** Terms of “Zombies in your containers”. */
const terms: Record<string, Term> = {
  docker: {
    title: { en: 'Docker', zh: 'Docker' },
    body: {
      en: 'A set of tools, first released in 2013, for packaging a program with the files it needs into an *image* and running it as a [[container|container]]. `docker run` starts a container; `docker stop` asks it to shut down.',
      zh: '一套工具，2013 年首次发布，用来把程序连同它需要的文件打包成一个*镜像*（image），再把它作为[[container|容器]]运行。`docker run` 启动一个容器，`docker stop` 请它关停。',
    },
  },
  grep: {
    title: { en: 'grep', zh: 'grep' },
    body: {
      en: 'A standard Unix program that reads text and prints the lines matching a pattern. Shell scripts start it, and programs like it, as child processes all the time.',
      zh: 'Unix 的一个标准程序，读入文本，打印出与某个模式匹配的行。shell 脚本时时刻刻都在把它以及类似的程序作为子进程启动。',
    },
  },
  'process-table': {
    title: { en: 'Process table', zh: '进程表' },
    body: {
      en: 'The kernel’s list of every process, one entry each, holding what it needs to manage the process: its state, [[pid|PID]], parent, saved registers and so on. Chapter 4 shows xv6’s version, a fixed array of `proc` structures. A process’s entry is the last thing to go when it dies.',
      zh: '内核里登记所有进程的那张表，每个进程一项，记着管理它所需的一切：状态、[[pid|PID]]、父进程、保存的寄存器等等。第 4 章展示了 xv6 的版本：一个固定大小的 `proc` 结构数组。进程死去时，它在表里的那一项是最后才被清掉的。',
    },
    chapter: 'cpu-intro',
  },
  signal: {
    title: { en: 'Signal', zh: '信号（signal）' },
    body: {
      en: 'A short notification the kernel delivers to a process, named by a number such as `SIGTERM` (please terminate), `SIGINT` (Ctrl-C) or `SIGCHLD` (a child has exited or stopped). For each signal a process can install a handler function, ignore it, or block it, so that it waits as *pending* until the process takes it. Otherwise the default action applies, which for many signals is to end the process.',
      zh: '内核递送给进程的一条简短通知，用编号区分，各有名字，比如 `SIGTERM`（请终止）、`SIGINT`（Ctrl-C）、`SIGCHLD`（某个子进程退出或停止了）。对每种信号，进程可以安装一个处理函数、忽略它，或者阻塞它，让它作为*待处理*（pending）信号等着，直到进程来取。否则就执行默认动作，对许多信号来说，默认动作就是结束进程。',
    },
    chapter: 'cpu-api',
  },
  sigkill: {
    title: { en: 'SIGKILL', zh: 'SIGKILL' },
    body: {
      en: 'Signal 9, the one a process cannot catch, block or ignore: the kernel ends the process without running any more of its code, so it gets no chance to clean up. It is the last resort after a polite `SIGTERM`, which a program may handle to shut down cleanly.',
      zh: '9 号信号，进程无法捕获、阻塞或忽略它：内核直接结束进程，不再运行它的任何代码，因此它没有机会做清理。它是最后手段，排在礼貌的 `SIGTERM` 之后；`SIGTERM` 可以被程序处理，好让它体面地关停。',
    },
    chapter: 'cpu-api',
  },
  xv6: {
    title: { en: 'xv6', zh: 'xv6' },
    body: {
      en: 'A small teaching operating system written at MIT in 2006: a re-implementation of Sixth Edition Unix in modern C, first for x86 and now for RISC-V. The book quotes its code because the whole kernel is short enough to read.',
      zh: 'MIT 于 2006 年编写的一个教学用小型操作系统：用现代 C 语言重新实现的第六版 Unix，最初面向 x86，现在面向 RISC-V。本书引用它的代码，因为整个内核短到可以通读。',
    },
    chapter: 'cpu-intro',
  },
  'man-page': {
    title: { en: 'Manual page', zh: '手册页（man page）' },
    body: {
      en: 'The reference documentation that comes with Unix systems, read with the `man` command. The number in parentheses is the section: `wait(2)` is in section 2, system calls, and `pid_namespaces(7)` in section 7, overviews and conventions.',
      zh: 'Unix 系统自带的参考文档，用 `man` 命令阅读。括号里的数字是章节号：`wait(2)` 在第 2 节，即系统调用；`pid_namespaces(7)` 在第 7 节，即概述与约定。',
    },
  },
  ps: {
    title: { en: 'ps', zh: 'ps' },
    body: {
      en: 'The Unix command that lists processes. Its state column shows each process as a letter: `R` running or ready, `S` sleeping, `T` stopped, `Z` zombie; zombies are also marked `<defunct>`.',
      zh: '列出进程的 Unix 命令。它的状态列用一个字母表示每个进程：`R` 运行或就绪，`S` 睡眠，`T` 停止，`Z` 僵尸；僵尸还会被标上 `<defunct>`。',
    },
  },
  'atomic-cas': {
    title: { en: 'Compare-and-exchange', zh: '比较并交换（compare-and-exchange）' },
    body: {
      en: 'One CPU instruction that sets a memory location to a new value only if it still holds an expected one, and reports whether it did. Nothing can come between the comparison and the write, so if two threads try at once, exactly one succeeds. Part II of the book builds locks from it.',
      zh: '一条 CPU 指令：只有当某个内存位置仍是预期的值时，才把它改成新值，并报告是否改成了。比较和写入之间插不进任何别的操作，所以两个线程同时尝试时，恰好只有一个成功。本书第二部分用它来构造锁。',
    },
  },
  cgroup: {
    title: { en: 'cgroup (control group)', zh: 'cgroup（控制组）' },
    body: {
      en: 'A Linux feature that puts processes in a group and limits or accounts for what the group uses: CPU time, memory, I/O, or, with the *pids* controller, the number of processes. Each [[container|container]] gets one, and so does each service [[systemd|systemd]] starts.',
      zh: 'Linux 的一项功能：把进程编成一组，限制或统计这一组用掉的资源，比如 CPU 时间、内存、I/O，或者（借助 *pids* 控制器）进程的数量。每个[[container|容器]]都有一个，[[systemd|systemd]] 启动的每个服务也有一个。',
    },
  },
  init: {
    title: { en: 'init', zh: 'init' },
    body: {
      en: 'The first process the kernel starts at boot, with PID 1. It starts the rest of the system, and every orphaned process is handed to it, so it calls `wait()` in a loop for children it never created. On most Linux distributions today, init is [[systemd|systemd]].',
      zh: '内核开机后启动的第一个进程，PID 为 1。它负责启动系统的其余部分；每个成了孤儿的进程都会交给它，所以它要循环调用 `wait()`，回收那些并非它创建的子进程。如今在大多数 Linux 发行版上，init 就是 [[systemd|systemd]]。',
    },
  },
  systemd: {
    title: { en: 'systemd', zh: 'systemd' },
    body: {
      en: 'The init system and service manager that most major Linux distributions have used by default since the mid-2010s. It runs as PID 1, starts and supervises services, and puts each one in a cgroup of its own.',
      zh: '一套 init 系统兼服务管理器，2010 年代中期以来，大多数主流 Linux 发行版默认使用它。它以 PID 1 运行，启动并监管各个服务，并把每个服务放进各自的 cgroup。',
    },
  },
  prctl: {
    title: { en: 'prctl()', zh: 'prctl()' },
    body: {
      en: 'A Linux [[syscall|system call]] that reads or changes one of a grab bag of per-process settings, chosen by its first argument: `PR_SET_CHILD_SUBREAPER`, `PR_SET_THP_DISABLE` and dozens more.',
      zh: 'Linux 的一个[[syscall|系统调用]]，读取或修改五花八门的进程级设置中的一项，由第一个参数指定是哪一项：`PR_SET_CHILD_SUBREAPER`、`PR_SET_THP_DISABLE`，还有几十种。',
    },
  },
  daemon: {
    title: { en: 'Daemon', zh: '守护进程（daemon）' },
    body: {
      en: 'A program that runs in the background as a service, with no terminal. The classic recipe forks, lets the parent exit, starts a new session and forks again, so that the daemon is left as an orphan for init to adopt and can never regain a terminal.',
      zh: '在后台作为服务运行、不连接终端的程序。经典的做法是：fork，让父进程退出，开一个新会话，再 fork 一次。这样守护进程就成了由 init 收养的孤儿，而且再也不会重新获得终端。',
    },
  },
  'kernel-panic': {
    title: { en: 'Kernel panic', zh: '内核恐慌（kernel panic）' },
    body: {
      en: 'What a kernel does when it hits an error it cannot recover from: it reports what it knows and stops or reboots the machine, because carrying on could corrupt data. On Linux, the death of the host’s init is one such error.',
      zh: '内核遇到无法恢复的错误时的反应：报告它所知道的情况，然后让机器停下或重启，因为继续运行可能损坏数据。在 Linux 上，宿主机的 init 死掉就是这样一种错误。',
    },
  },
  kubernetes: {
    title: { en: 'Kubernetes', zh: 'Kubernetes' },
    body: {
      en: 'A system that runs containers across a cluster of machines, created at Google and open-sourced in 2014. It places [[pod|pods]] on machines, restarts them when they fail and stops them when asked.',
      zh: '在一组机器上运行容器的系统，诞生于 Google，2014 年开源。它把 [[pod|Pod]] 安排到各台机器上，在它们出故障时重启，在收到指令时停掉它们。',
    },
  },
  pod: {
    title: { en: 'Pod', zh: 'Pod' },
    body: {
      en: 'The unit Kubernetes runs: one or more containers placed together on one machine, sharing a network [[namespace|namespace]] and, if asked, a PID namespace. A tiny `pause` container holds the shared namespaces for the pod’s lifetime.',
      zh: 'Kubernetes 运行的基本单位：放在同一台机器上的一个或多个容器，共用一个网络[[namespace|命名空间]]，需要时也共用一个 PID 命名空间。一个极小的 `pause` 容器在 Pod 的整个生命期里持有这些共享的命名空间。',
    },
  },
  dockerfile: {
    title: { en: 'Dockerfile', zh: 'Dockerfile' },
    body: {
      en: 'The recipe a container image is built from: a base image, files to copy, commands to run. `ENTRYPOINT` and `CMD` say what the container runs when it starts, written either as a plain string (*shell form*) or as a JSON array (*exec form*).',
      zh: '构建容器镜像所依据的配方：基础镜像、要复制的文件、要执行的命令。`ENTRYPOINT` 和 `CMD` 指定容器启动时运行什么，写法有两种：普通字符串（*shell 形式*）或 JSON 数组（*exec 形式*）。',
    },
  },
  sysctl: {
    title: { en: 'sysctl', zh: 'sysctl' },
    body: {
      en: 'A kernel setting that can be read and changed while the system runs, such as `kernel.pid_max` or `vm.overcommit_memory`, through the `sysctl` command or the files under `/proc/sys`.',
      zh: '可以在系统运行时读取和修改的内核参数，比如 `kernel.pid_max` 或 `vm.overcommit_memory`，通过 `sysctl` 命令或 `/proc/sys` 下的文件来操作。',
    },
  },
  clone: {
    title: { en: 'clone()', zh: 'clone()' },
    body: {
      en: 'The Linux [[syscall|system call]] underneath both process and thread creation. Its flags say what the new task shares with its creator, such as memory, open files and signal handlers. Share nothing and it acts like `fork()`; share the memory and the new task is a [[thread|thread]].',
      zh: 'Linux 上创建进程和创建线程共同依靠的那个[[syscall|系统调用]]。它的标志位决定新任务与创建者共享什么：内存、打开的文件、信号处理函数等。什么都不共享，它就相当于 `fork()`；共享内存，新任务就是一个[[thread|线程]]。',
    },
  },
  'process-group': {
    title: { en: 'Process group', zh: '进程组' },
    body: {
      en: 'A set of related processes, such as the commands of one shell pipeline, that can be sent a [[signal|signal]] together. Pressing Ctrl-C in a terminal sends `SIGINT` to the whole foreground process group.',
      zh: '一组相关的进程，比如 shell 里一条管道上的各个命令，可以一起收到同一个[[signal|信号]]。在终端里按 Ctrl-C，会把 `SIGINT` 发给整个前台进程组。',
    },
  },
}

export default terms
