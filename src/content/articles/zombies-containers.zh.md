---
deck: 每个进程在有人取走它的退出状态之前，都会以僵尸的身份存在。在容器里，负责取走状态的往往是你的程序——而它根本不知道自己有这份差事。
title: 容器里的僵尸进程
---

::scene overview

2015 年 1 月，Phusion 的 Hongli Lai 写文章剖析了一个许多 [[docker|Docker]] 用户都遇到过、却说不清缘由的 bug。一个 Web 服务器作为唯一的进程跑在[[container|容器]]里。处理某些请求时，它会启动一个 shell 脚本，脚本又启动了 [[grep|`grep`]]；请求超时后，服务器杀掉了脚本。`grep` 却还在跑，片刻之后结束，变成了一个**僵尸**（zombie）：[[process-table|进程表]]里的一个条目，背后已经空无一物。从来没有人回收它。每个慢请求都会再留下一个，攒得够多，就能把进程表填满。

关停时还有一个相关的怪现象。`docker stop` 会礼貌地给容器的主进程发一个 [[signal|`SIGTERM`]]，而许多程序表现得就像根本没收到——同样的信号在容器外明明能让它们退出。Docker 默认等 10 秒，然后发出 [[sigkill|`SIGKILL`]]。

这两个问题出自同一个原因，而你已经在第 4 章读到过那句话：一个已经退出、但还没被清理的进程处于*最终*（final）状态，在 UNIX 里这个状态叫僵尸状态。这篇文章就沿着这句话走进 Linux 内核，再走进容器。

::scene book

## 书里的最终状态

::chapter cpu-intro

第 4 章列出了进程的各种状态，而图 4.5 里的 [[xv6|xv6]] 代码比状态图中的三个状态多了一个：`ZOMBIE`。书里解释了它存在的理由：进程结束时，父进程通常想知道它结果如何，也就是它的退出码。所以操作系统不能在进程退出的那一刻就把它扔掉，而要保留一小份记录，直到父进程做最后一次调用 `wait()`，读出结果，并告诉操作系统可以清理了。[第 5 章](/virtualization/cpu-api) 随后展示了这个调用的用法：调用 `wait()` 的父进程会拿到子进程的状态，在状态出来之前一直阻塞。

书里留下了两个没回答的问题：如果父进程从来不调用 `wait()` 呢？如果父进程先死了呢？每个真实的系统都必须回答这两个问题，而容器恰恰在这两个答案上出了岔子。

::scene death

## 死亡的三个步骤

在 Linux 上，一个进程的死亡分三步。

1. **退出。** 进程调用 `exit()`、从 `main` 返回，或者被信号杀死。内核几乎拆掉一切：[[address-space|地址空间]]和其中的页面、打开的文件、定时器。剩下的只是一小份记录，`wait(2)` [[man-page|手册页]]列出了它的内容：[[pid|PID]]、终止状态和资源使用统计。此时进程处于僵尸状态，[[ps|`ps`]] 会把它的状态显示为 `Z`，并标上 `<defunct>`。
2. **通知。** 内核给父进程发送一个 `SIGCHLD` 信号。父进程默认会忽略这个信号，但僵尸照样保留。
3. **回收。** 父进程调用 `wait()`、`waitpid()` 或 `waitid()`。内核交出状态，释放这份记录，PID 从此可以被重新分配。

中间这个状态几乎不占内存，只是几 KB 的内核簿记。但正如手册页警告的那样：只要僵尸没有被某次 wait 清除，它就一直占着内核进程表里的一个槽位；表一旦填满，就再也无法创建新进程。僵尸是内核对父进程的一句承诺：“这个我替你留着。”父进程什么时候来取，内核就留到什么时候，不论多久。

有一个例外恰好印证了这条规则。如果父进程把 `SIGCHLD` 设为 `SIG_IGN`，或者在安装处理函数时带上 `SA_NOCLDWAIT` 标志，就等于事先声明自己永远不会来要结果。从 Linux 2.6 起，内核这时会让它的子进程跳过僵尸状态，直接释放。

:::fold 内核留下了什么，又在何时放手
任务的死亡发生在 `kernel/exit.c` 里。`do_exit()` 逐一释放内存映射、文件表和其他资源，然后调用 `exit_notify()`。这个函数做了两件与本文相关的事。

第一，为即将死去的任务自己的子进程找一个新父进程，顺序是：同一进程中的另一个[[thread|线程]]；然后是把自己标记为*子进程收割者*（child subreaper）的最近祖先；最后是该任务所在 [[namespace|PID 命名空间]]的 init 进程（PID 1）。

第二，通知即将死去的任务的父进程。如果父进程声明过不关心，任务直接进入 `EXIT_DEAD` 状态并被释放；否则就停留在 `EXIT_ZOMBIE`。

父进程等待时，`wait_task_zombie()` 用一次[[atomic-cas|原子的比较并交换]]，把僵尸从 `EXIT_ZOMBIE` 改成死亡状态，这样即使父进程有两个线程同时在等，也只有一个能拿到状态。最后的清理是 `release_task()`：它会把 `RLIMIT_NPROC` 所限制的“每用户进程数”减一，并调用 [[cgroup|cgroup]] 的释放钩子，pids 控制器在那里撤销对该任务的计数；然后 PID 才被释放。

顺序就是重点：在被回收的那一刻之前，僵尸始终计入每一个统计进程数的限额。
:::

::scene orphans

## 谁来等孤儿

第二个没回答的问题是先死的父进程。它的子进程成了孤儿（orphan），而一个孤儿将来退出时，就没人来回收它了。UNIX 的办法是给每个孤儿一个新父亲：**[[init|init]]**，也就是 PID 1。init 生来就是要循环调用 `wait()`，去回收那些并非它创建的子进程。`wait(2)` 手册页说得很直接：init 会自动执行 wait 来清除僵尸。

::scene subreaper

从 Linux 3.4 起，进程也可以主动揽下这份差事。调用了 [[prctl|`prctl(PR_SET_CHILD_SUBREAPER)`]] 的进程会成为**收割者**（subreaper）：它的后代中出现的孤儿，会被过继给它，而不是 init。[[systemd|systemd]] 等服务管理器就用了这个机制，这样一个通过两次 fork 来脱离控制的[[daemon|守护进程]]，仍然处在它的监管者之下。

于是完整的图景是一份三方契约：每个创建子进程的进程，都承诺会等待它们；每个死去的进程都违背了对自己子进程的这份承诺，由 init 或收割者继承下来；而 init 承诺等待任何人。

::scene orphans

::lab Fork

这个实验运行的是书中的 `p1.c` 和 `p2.c`。可以试试这些：

- 选择“先运行子进程”，不加 `wait()`。子进程打印后退出，而父进程手上还有活儿。从子进程退出到父进程自己退出的这段时间里，子进程就是一个僵尸。随后父进程也退出了，子进程被过继给 init，由 init 回收。在一个很短的程序里，你根本察觉不到。
- 打开 `wait()`。现在子进程的状态一出来，父进程就把它收走，僵尸只存在于父进程走到这次调用之前的那一小段时间。实验的旁白也写明了：子进程已被回收，不会成为僵尸。
- 设想父进程是一个永不退出的服务器，为每个请求启动一个子进程，却从不等待。每个请求都会留下一个僵尸——这就是 Phusion 遇到的那个 bug。

::scene container

## 盒子里的 PID 1

Linux 上的容器，就是一个被放进若干新**[[namespace|命名空间]]**（namespace）里的普通进程：它有自己的文件系统视图、自己的网络，以及在这里最要紧的——自己的进程 ID。新 PID 命名空间里的第一个进程在其中获得 PID 1，`pid_namespaces(7)` 手册页说，它就是这个命名空间的 init 进程。运行 `docker run myimage myserver`，`myserver` 就是这个进程。

::scene pid1

当上 PID 1，就多了三项普通程序从来不会考虑的职责：

- **孤儿都归你。** 容器里任何一个父进程死掉的进程，都会被过继给 PID 1（除非附近有收割者）。如果 PID 1 不为这些并非它创建的子进程调用 `wait()`，它们的僵尸就会永远留着。这是那个 bug 的“僵尸”一半。
- **默认的信号动作被关掉了。** 其他进程——哪怕是有特权的进程——只能向 PID 1 发送它安装了处理函数的那些信号。一个依赖 `SIGTERM` 默认动作（也就是退出）的程序，永远收不到这个信号。这是那个 bug 的 `docker stop` 一半。只有从父命名空间发来的 `SIGKILL` 和 `SIGSTOP` 无论如何都能送达。
- **你一死，大家都得死。** 如果 PID 1 退出，内核会给命名空间里的其他所有进程发送 `SIGKILL`，此后那里再也无法创建新进程。没有谁有机会做清理。

这些都不是容器的 bug，而是当 init 的规矩；内核在容器里执行它们，和在宿主机上一模一样。麻烦在于，大多数程序写出来的时候，就没打算当 init。

:::fold 为什么 PID 1 不理你的 SIGTERM，以及超时是多少
::scene signals

真正的 init 系统绝不能被一个随手发来的信号杀死，因为宿主机上 PID 1 一死，内核就会[[kernel-panic|恐慌（panic）]]。所以内核保护 init：动作为默认动作的信号会被直接丢弃。`pid_namespaces(7)` 手册页把同样的保护推广到每个命名空间的 init，并且对来自祖先命名空间的信号同样适用——`docker stop` 恰恰来自那里。唯一的例外是祖先命名空间发来的 `SIGKILL` 和 `SIGSTOP`，它们总会被送达。

用那些会自行安装 `SIGTERM` 处理函数的语言或框架写成的程序，当 PID 1 时表现正常；依赖默认处置方式的程序则不然，看上去就像卡住了。对 Linux 容器，`docker stop` 默认等待 10 秒，然后发送 `SIGKILL`。[[kubernetes|Kubernetes]] 默认给 [[pod|Pod]] 30 秒的宽限期，期满后容器运行时向所有仍在运行的进程发送 `SIGKILL`。容器随后报告退出码 137，即 128 加上信号 9。

::scene shell-form

还有一种常见写法会让情况更糟。[[dockerfile|Dockerfile]] 里以*shell 形式*（一个普通字符串）写的 `ENTRYPOINT` 或 `CMD`，会作为 `/bin/sh -c` 的子命令运行。Docker 文档写明了后果：你的程序不是 PID 1，收不到 `docker stop` 发出的 `SIGTERM`。PID 1 是那个 shell，而它不转发信号。*exec 形式*（一个 JSON 数组）则直接运行你的程序。
:::

::scene limits

## 僵尸到底伤在哪里

僵尸几乎不占内存，所以伤害来自计数。在被回收之前，有三个不同的计数器都把僵尸当作活着的进程：

| 限额 | 在哪里设置 | 典型默认值 | 何时触顶 |
|---|---|---|---|
| `kernel.pid_max` | [[sysctl|sysctl]]，作用于整台机器 | 内核默认 32,768，并至少提高到每个 CPU 1,024 个；systemd 把它提高到 4,194,304 | 没有空闲的 PID 可分配 |
| `pids.max` | 容器或 Pod 所在的 [[cgroup|cgroup]] | 不设置则不限（`docker run --pids-limit`、kubelet 的 `PodPidsLimit`） | 容器达到自己的上限 |
| `RLIMIT_NPROC` | 按用户设置，即 `ulimit -u` | 因系统而异 | 某个用户名下的进程太多 |

在现代宿主机上，最先填满的很少是整机的那张表，通常是 cgroup 的限额——这是有意为之：它存在的意义，就是不让一个容器失控的 fork 拖垮整台宿主机。一旦触顶，该容器里的 [[fork-exec|`fork()`]] 和 [[clone|`clone()`]] 会以 `EAGAIN`（“Resource temporarily unavailable”）失败，cgroup 的 `pids.events` 文件会记下每一次拒绝。症状是：服务器启动不了辅助进程，shell 执行不了命令，或者健康检查失败——因为探针进程根本 fork 不出来。

::scene fixes

## 解决办法

有四条出路，按需要写的代码从少到多排列。

1. **在前面放一个真正的 init。** `docker run --init` 会把一个小小的 init 作为 PID 1 启动，再由它把你的程序作为子进程启动。Docker 为此默认使用的 `docker-init` 基于 **tini**，从 Docker 1.13 起就随附在内。tini 做三件事：把信号转发给你的程序；回收它继承来的每一个僵尸；你的程序退出时，它以相同的退出码退出。tini 还有 `-s` 选项，在无法成为 PID 1 时以收割者身份工作；以及 `-g` 选项，像终端里的 Ctrl-C 那样向子进程的整个[[process-group|进程组]]发信号。
2. **共用 Pod 的 init。** 在 [[kubernetes|Kubernetes]] 里，给 [[pod|Pod]] 设置 `shareProcessNamespace: true`，会让它的所有容器处在同一个 PID 命名空间里，其 PID 1 是 Pod 沙箱里那个小小的 `pause` 进程。它的源码只有几十行，两个信号处理函数中的一个，就是一个 `waitpid(-1, NULL, WNOHANG)` 循环。
3. **在你自己的程序里回收。** 如果你的程序必须当 PID 1，或者只是会启动子进程，那就处理 `SIGCHLD` 并循环回收。如果你从不需要子进程的退出状态，把 `SIGCHLD` 设为 `SIG_IGN`，内核就会替你回收。
4. **成为收割者。** 不是 PID 1 的监管进程，可以调用 `prctl(PR_SET_CHILD_SUBREAPER, 1)`，把后代遗留下的一切都收养过来。

:::fold 一个最小的 init，用 C 写成
::scene mini-init

下面是 tini 和 `docker-init` 所做之事的核心，精简到只剩要害。它在 Linux 上是正确的，但做了简化：生产用的 init 还要处理进程组、设置超时以便发现无视信号的子进程，并更仔细地报告错误。

```c
/* mini-init：把 argv[1..] 作为子进程运行，向它转发信号，回收所有僵尸 */
#include <signal.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv)
{
    if (argc < 2) { fprintf(stderr, "usage: %s cmd [args...]\n", argv[0]); return 2; }

    sigset_t all;
    sigfillset(&all);
    sigprocmask(SIG_BLOCK, &all, NULL);        /* 用 sigwait 同步地接收信号 */

    pid_t child = fork();
    if (child < 0) { perror("fork"); return 1; }
    if (child == 0) {
        sigprocmask(SIG_UNBLOCK, &all, NULL);  /* 让程序拥有正常的信号行为 */
        execvp(argv[1], argv + 1);
        perror("execvp");
        _exit(127);
    }

    for (;;) {
        int sig;
        sigwait(&all, &sig);
        if (sig != SIGCHLD) {
            kill(child, sig);                  /* 转发 SIGTERM、SIGINT 等 */
            continue;
        }
        int status;
        pid_t pid;
        while ((pid = waitpid(-1, &status, WNOHANG)) > 0) {    /* 全部回收，而不是只收一个 */
            if (pid == child)                  /* 程序结束了：以同样的方式退出 */
                return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
        }
    }
}
```

承重的是三个细节：

- **阻塞所有信号，再调用 `sigwait()`。** 信号在循环里作为一个值到来，而不是以处理函数的形式打断任意代码。由于这些信号是被阻塞而不是被忽略，PID 1“丢弃默认动作信号”的规则对它们不适用，于是 `docker stop` 发来的 `SIGTERM` 能够送达。
- **内层的 `while` 循环。** 标准信号不排队：如果在一个 `SIGCHLD` 尚未处理时有三个子进程退出，init 只会收到一个 `SIGCHLD`。每收到一个信号只调用一次 `waitpid()` 会漏掉僵尸，所以要一直调用，直到无可回收为止。
- **是 `waitpid(-1, ...)`，而不是 `waitpid(child, ...)`。** init 必须回收那些并非它创建、而是过继给它的孤儿。只等自己启动的那个子进程，恰恰就是 Phusion 那个 bug。

程序退出时，init 随之返回。作为 PID 1，它的退出会让内核杀掉命名空间里剩下的一切——而在这个时刻，这正是容器想要的清理。
:::

::scene bends

## 理想在哪里弯折

- **僵尸杀不死。** 它已经退出了。对僵尸执行 `kill -9` 毫无作用，因为已经没有谁来接收这个信号。唯一的办法是让它的父进程去 wait，或者杀掉父进程，让僵尸被过继给一个会回收它的 init。
- **PID 会被重用。** 僵尸一旦被回收，它的 PID 就空了出来，在繁忙的系统上很快可能属于别人。一个记下 PID、过后再去给它发信号的监管进程，可能会打错对象。Linux 5.3 加入了 `pidfd_open()`，它返回一个指向进程的[[handle|文件描述符]]；即使进程已经成了僵尸，这个描述符仍指向同一个进程。从 Linux 5.4 起，`waitid()` 还可以用 `P_PIDFD` 来等待它。
- **库不会替你回收。** Rust 标准库的文档写明，丢弃一个 `Child` 句柄既不会杀掉、也不会等待那个进程，并警告在长期运行的程序里留下僵尸可能耗尽进程 ID。
- **用 shell 当 PID 1 只解决一半。** Phusion 的文章指出，bash 确实会回收过继来的子进程，但它自己退出时不会把 `SIGTERM` 转发给它们。所以让 shell 当 init，只解决了问题的一半。

::scene overview

## 回到书里的那条线

僵尸状态不是 bug，而是第 5 章描述的一个接口决策的代价：父进程通过 `wait()` 得知子进程的命运，所以内核必须替它保管这个结果，直到父进程来问。凡是“由所有者负责释放”的资源，都是同一个形状：文件描述符、锁、必须 join 的[[thread|线程]]。忘了释放，它就会泄漏，而泄漏总是在别处以“触顶”的形式冒出来。

容器并没有改变规则，只是挪动了职责。在普通机器上，init 是一个精心编写、以监管进程为唯一使命的程序；在容器里，PID 1 是你的镜像碰巧运行的任何东西，却继承了一个写于 1970 年代 UNIX 的角色：收养孤儿，收取它们的状态，并且不能意外死掉。让容器变得廉价的那套命名空间和 cgroup 机制，同样让 [浏览器沙箱](/notes/chrome-processes) 成为可能；而创造出这些子进程的 `fork()`，还有一份出人意料的副业：[快照机](/notes/fork-redis)。

## 延伸阅读

- [`wait(2)`](https://man7.org/linux/man-pages/man2/wait.2.html)（Linux 手册页）：僵尸、过继给 init，以及 `SIGCHLD` 与 `SA_NOCLDWAIT` 的规则。
- [`pid_namespaces(7)`](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)（Linux 手册页）：命名空间的 init 进程、它的信号规则，以及它死去时会发生什么。
- [`PR_SET_CHILD_SUBREAPER`](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html)（Linux 手册页）。
- Hongli Lai：[Docker and the PID 1 zombie reaping problem](https://blog.phusion.nl/docker-and-the-pid-1-zombie-reaping-problem/)（Phusion，2015 年 1 月）。
- [tini](https://github.com/krallin/tini)：`docker run --init` 背后的 init，附有关于收割者和进程组的说明。
- [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/)（Docker 文档）：`--init` 与 `--pids-limit` 选项。
- [Share Process Namespace between Containers in a Pod](https://kubernetes.io/docs/tasks/configure-pod-container/share-process-namespace/)（Kubernetes 文档）。
- [Process Number Controller](https://docs.kernel.org/admin-guide/cgroup-v1/pids.html)（Linux 内核文档）：`pids.max`、`pids.current` 与 `EAGAIN` 行为。
