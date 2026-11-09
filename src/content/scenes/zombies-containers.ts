import type { SceneDef } from './index'

/** The running figure of “Zombies in your containers”. */
const scene: SceneDef = {
  height: 430,
  bands: {
    overview: [6, 358],
    book: [26, 358],
    death: [26, 424],
    orphans: [26, 256],
    subreaper: [26, 256],
    container: [6, 230],
    pid1: [6, 230],
    signals: [6, 134],
    'shell-form': [6, 134],
    limits: [6, 424],
    fixes: [6, 268],
    'mini-init': [6, 268],
    bends: [6, 230],
  },
  parts: {
    container: [10, 268],
    docker: [30, 72],
    pid1: [28, 74],
    myserver: [30, 132],
    grep: [150, 252],
    table: [296, 346],
    limits: [316, 422],
    record: [316, 422],
    sigterm: [28, 70],
    sigkill: [28, 92],
    subreaper: [96, 132],
    adopt: [40, 250],
    fork: [44, 132],
    forward: [66, 96],
  },
  states: {
    overview: {
      title: { en: 'A zombie in a container', zh: '容器里的一个僵尸' },
      caption: {
        en: 'Your server is PID 1 of its container. It killed a script, and the script’s grep, orphaned, was handed to the server. grep then exited, and since the server never waits, it stays a zombie in the kernel’s process table. Every slow request adds one. The SIGTERM from docker stop has no effect either.',
        zh: '你的服务器是容器里的 PID 1。它杀掉了一个脚本，脚本启动的 grep 成了孤儿，被交给服务器；随后 grep 退出，而服务器从不 wait，于是它作为僵尸一直占着内核进程表里的一格。每个慢请求再添一个。docker stop 发来的 SIGTERM 也毫无作用。',
      },
    },
    book: {
      title: { en: 'The book’s final state', zh: '书里的最终状态' },
      caption: {
        en: 'On an ordinary machine (simplified here) init is PID 1 and your server is just a process. When grep exits, the kernel keeps a small record of it, the zombie, until its parent, the script, calls wait() to read the exit status.',
        zh: '在普通机器上（这里做了简化），PID 1 是 init，你的服务器只是个普通进程。grep 退出后，内核为它保留一小份记录，也就是僵尸，直到它的父进程（那个脚本）调用 wait() 读走退出状态。',
      },
    },
    death: {
      title: { en: 'A death in three steps', zh: '死亡的三个步骤' },
      caption: {
        en: 'Exit: the kernel frees the memory, open files and timers, and keeps only the entry: PID, termination status, resource usage. Notify: it sends the parent SIGCHLD, which is ignored by default. Reap: the parent’s wait() takes the status, and only then are the entry and the PID freed.',
        zh: '退出：内核释放内存、打开的文件和定时器，只留下表里那一项：PID、终止状态、资源使用统计。通知：内核给父进程发 SIGCHLD，默认被忽略。回收：父进程的 wait() 取走状态，这一项和 PID 这才被释放。',
      },
    },
    orphans: {
      title: { en: 'Orphans go to init', zh: '孤儿归 init' },
      caption: {
        en: 'If the script dies first, grep is an orphan. The kernel gives it a new parent, init, which calls wait() in a loop for children it never created. When grep exits, init reaps it.',
        zh: '如果脚本先死，grep 就成了孤儿。内核给它换一个新父亲：init。init 循环调用 wait()，回收那些并非它创建的子进程；grep 退出时，由 init 回收。',
      },
    },
    subreaper: {
      title: { en: 'A volunteer: the subreaper', zh: '主动揽活：收割者' },
      caption: {
        en: 'Since Linux 3.4 a process can call prctl(PR_SET_CHILD_SUBREAPER). Orphans among its descendants are then reparented to it instead of to init. Service managers such as systemd use this to keep daemons under their supervisor.',
        zh: '从 Linux 3.4 起，进程可以调用 prctl(PR_SET_CHILD_SUBREAPER)。此后，它后代中的孤儿会过继给它，而不是 init。systemd 等服务管理器借此把守护进程留在监管者手下。',
      },
    },
    container: {
      title: { en: 'PID 1 in a box', zh: '盒子里的 PID 1' },
      caption: {
        en: 'A container is ordinary processes in new namespaces. The first process in a new PID namespace gets PID 1 there and is that namespace’s init. Run docker run myimage myserver, and that is your server.',
        zh: '容器就是放进若干新命名空间里的普通进程。新 PID 命名空间里的第一个进程在其中拿到 PID 1，成为这个命名空间的 init。执行 docker run myimage myserver，这个进程就是你的服务器。',
      },
    },
    pid1: {
      title: { en: 'Three duties of PID 1', zh: 'PID 1 的三项职责' },
      caption: {
        en: 'Orphans in the container come to your server, and their zombies stay if it never waits. Signals it has no handler for are dropped, so SIGTERM does nothing. And if PID 1 exits, the kernel sends SIGKILL to every other process in the namespace.',
        zh: '容器里的孤儿都归你的服务器，它若从不 wait，僵尸就一直留着。它没装处理函数的信号会被丢弃，所以 SIGTERM 毫无作用。而 PID 1 一旦退出，内核会向命名空间里的其他所有进程发送 SIGKILL。',
      },
    },
    signals: {
      title: { en: 'Ten seconds, then SIGKILL', zh: '十秒之后，SIGKILL' },
      caption: {
        en: 'docker stop sends SIGTERM from the parent namespace. A PID 1 that relies on the default action never gets it. After 10 seconds Docker sends SIGKILL, which always gets through: exit code 137, 128 plus signal 9. Kubernetes waits 30 seconds by default.',
        zh: 'docker stop 从父命名空间发出 SIGTERM。依赖默认动作的 PID 1 根本收不到它。10 秒后 Docker 发出 SIGKILL，它总能送达：退出码 137，即 128 加上信号 9。Kubernetes 默认等 30 秒。',
      },
    },
    'shell-form': {
      title: { en: 'Shell form: sh is PID 1', zh: 'shell 形式：sh 当 PID 1' },
      caption: {
        en: 'An ENTRYPOINT written as a plain string runs under /bin/sh -c. The shell is PID 1 and your program is its child. The shell does not forward signals, so the SIGTERM from docker stop never reaches your program.',
        zh: '写成普通字符串的 ENTRYPOINT 会在 /bin/sh -c 之下运行。shell 是 PID 1，你的程序是它的子进程。shell 不转发信号，所以 docker stop 的 SIGTERM 永远到不了你的程序。',
      },
    },
    limits: {
      title: { en: 'Counted until reaped', zh: '回收之前一直计数' },
      caption: {
        en: 'A zombie uses almost no memory, but kernel.pid_max, the cgroup’s pids.max and RLIMIT_NPROC all count it until it is reaped. The container’s pids.max usually fills first, by design; then fork() and clone() in the container fail with EAGAIN. The bars are illustrative.',
        zh: '僵尸几乎不占内存，但在被回收之前，kernel.pid_max、cgroup 的 pids.max 和 RLIMIT_NPROC 都把它算作一个进程。通常先满的是容器的 pids.max，这是有意为之；此后容器里的 fork() 和 clone() 都以 EAGAIN 失败。图中的长条只是示意。',
      },
    },
    fixes: {
      title: { en: 'An init in front', zh: '在前面放一个 init' },
      caption: {
        en: 'docker run --init makes tini PID 1 and your server its child. Tini forwards signals to it, reaps every zombie it inherits, and exits with your program’s exit code. The other ways out: a pod’s shared pause process, reaping in your own program, or a subreaper.',
        zh: 'docker run --init 让 tini 当 PID 1，你的服务器成为它的子进程。tini 把信号转发给它，回收继承来的每一个僵尸，并以你的程序的退出码退出。其他出路：Pod 共享的 pause 进程、在自己的程序里回收，或者当收割者。',
      },
    },
    'mini-init': {
      title: { en: 'A minimal init', zh: '一个最小的 init' },
      caption: {
        en: 'The core of tini is one loop: block every signal and take them one at a time with sigwait(); forward everything except SIGCHLD to the program; on SIGCHLD, call waitpid(-1, …) until nothing is left to reap.',
        zh: 'tini 的核心就是一个循环：阻塞所有信号，用 sigwait() 一个个取出来；除 SIGCHLD 外一律转发给程序；收到 SIGCHLD，就反复调用 waitpid(-1, …)，直到无可回收。',
      },
      demo: {
        label: { en: 'How the loop reaps', zh: '这个循环怎样回收' },
        steps: [
          {
            en: 'mini-init is PID 1. Before forking it blocked every signal, so the kernel holds each signal sent to it as pending, one bit per signal, until sigwait() takes it. Its child unblocked them and exec’d your program. Three other processes lost their parents and were reparented to mini-init.',
            zh: 'mini-init 是 PID 1。它在 fork 之前阻塞了所有信号，所以发给它的每个信号都被内核记为“待处理”，每种信号一位，直到 sigwait() 把它取走。它的子进程解除了阻塞，再 exec 成你的程序。另外三个进程失去了父进程，被过继给了 mini-init。',
          },
          {
            en: 'The three orphans exit at almost the same moment and become zombies. Each exit sends mini-init SIGCHLD, but standard signals do not queue: while one is pending, more of the same set the same bit again. Three exits, one bit.',
            zh: '三个孤儿几乎同时退出，变成僵尸。每次退出都给 mini-init 发一个 SIGCHLD，但标准信号不排队：一个还在待处理时，再来同样的信号只是把同一位再置一次。三次退出，一个位。',
          },
          {
            en: 'sigwait() returns SIGCHLD and clears the bit. mini-init now knows that some child changed state, but not how many.',
            zh: 'sigwait() 返回 SIGCHLD，并清掉这一位。mini-init 现在知道有子进程状态变了，却不知道有几个。',
          },
          {
            en: 'So it loops. Each waitpid(-1, …, WNOHANG) reaps one zombie, whichever child it is, and returns 0 once none is left. Calling it once per signal would have reaped one and left two.',
            zh: '所以它要循环。每次 waitpid(-1, …, WNOHANG) 回收一个僵尸，不管是哪个子进程；没有可回收的了就返回 0。如果每个信号只调用一次，就只收走一个，留下两个。',
          },
          {
            en: 'docker stop sends SIGTERM. It is blocked, not ignored, so the PID 1 rule that drops default-action signals does not apply: it waits as pending, sigwait() returns it, and kill(child, SIGTERM) passes it to your program.',
            zh: 'docker stop 发来 SIGTERM。它是被阻塞而不是被忽略，所以 PID 1“丢弃默认动作信号”的规则不适用：它作为待处理信号等着，sigwait() 把它取出，kill(child, SIGTERM) 再把它交给你的程序。',
          },
          {
            en: 'Your program is not PID 1, so SIGTERM’s default action ends it. On the next SIGCHLD, waitpid() returns its PID, and mini-init returns what the program’s end calls for: killed by signal 15, so 128 + 15 = 143. As PID 1, its exit makes the kernel kill whatever is left in the namespace.',
            zh: '你的程序不是 PID 1，所以 SIGTERM 的默认动作结束了它。下一个 SIGCHLD 到来时，waitpid() 返回它的 PID，mini-init 照程序的结局返回：被 15 号信号杀死，即 128 + 15 = 143。作为 PID 1，它的退出让内核杀掉命名空间里剩下的一切。',
          },
        ],
      },
    },
    bends: {
      title: { en: 'You cannot kill a zombie', zh: '僵尸杀不死' },
      caption: {
        en: 'kill -9 does nothing to a zombie: it has already exited, and nothing is left to receive the signal. Only its parent’s wait() removes it, or the parent’s death, which hands it to an init that waits. Once reaped, its PID may soon belong to another process.',
        zh: '对僵尸执行 kill -9 毫无作用：它已经退出了，没有谁来接收信号。只有父进程的 wait() 能清除它；或者父进程死掉，把它交给一个会 wait 的 init。一旦被回收，它的 PID 很快可能属于另一个进程。',
      },
    },
  },
  terms: {
    docker: ['docker'],
    container: ['container'],
    namespace: ['container'],
    'process-table': ['table'],
    pid: ['table'],
    ps: ['grep'],
    signal: ['sigterm', 'docker'],
    sigkill: ['sigkill', 'docker'],
    init: ['pid1'],
    systemd: ['pid1'],
    prctl: ['subreaper'],
    cgroup: ['limits'],
    sysctl: ['limits'],
    'fork-exec': ['fork'],
    clone: ['fork'],
    'address-space': ['record'],
  },
}

export default scene
