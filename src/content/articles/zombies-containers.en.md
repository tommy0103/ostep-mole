---
deck: Every process ends as a zombie until someone collects its exit status. In a container, that someone is often your program, and it does not know the job exists.
title: Zombies in your containers
---

::scene overview

In January 2015, Hongli Lai of Phusion wrote up a bug that many [[docker|Docker]] users had hit without understanding it. A web server ran as the only process in a [[container|container]]. For some requests it started a shell script, the script started [[grep|`grep`]], and when a request took too long the server killed the script. `grep` kept running, finished a moment later, and became a **zombie**: an entry in the [[process-table|process table]] with nothing behind it. Nobody ever collected it. Every slow request left one more behind, and enough of them can fill the process table.

A related oddity shows up at shutdown. `docker stop` sends the container’s main process a polite [[signal|`SIGTERM`]], and many programs behave as if they never received it, although the same signal would kill them outside a container. Docker waits 10 seconds by default, then sends [[sigkill|`SIGKILL`]].

Both problems have one cause, and it is a sentence you have already read in chapter 4: a process that has exited but has not been cleaned up sits in a *final* state, and in UNIX that state is called the zombie state. This article follows that sentence into the Linux kernel and out into containers.

::scene book

## The book’s final state

::chapter cpu-intro

Chapter 4 lists the process states, and the [[xv6|xv6]] code in Figure 4.5 has one more than the three in the state diagram: `ZOMBIE`. The book explains why it exists. When a process finishes, its parent usually wants to know how it went, through the exit code. So the OS cannot throw the process away the moment it exits. It keeps a small record until the parent makes a final call, `wait()`, which reads the result and tells the OS it may clean up. [Chapter 5](/virtualization/cpu-api) then shows the call in use: a parent that calls `wait()` gets its child’s status and blocks until there is one.

The book leaves two questions open. What if the parent never calls `wait()`? And what if the parent dies first? Every real system has to answer both, and the answers are where containers go wrong.

::scene death

## A death in three steps

On Linux a process’s death has three steps.

1. **Exit.** The process calls `exit()`, returns from `main`, or is killed by a signal. The kernel tears down almost everything: the [[address-space|address space]] and its pages, the open files, the timers. What is left is a small record that the `wait(2)` [[man-page|manual page]] lists as the [[pid|PID]], the termination status and resource-usage figures. The process is now in the zombie state, and [[ps|`ps`]] shows it with state `Z` and the word `<defunct>`.
2. **Notify.** The kernel sends the parent a `SIGCHLD` signal. By default the parent ignores it, but the zombie is kept all the same.
3. **Reap.** The parent calls `wait()`, `waitpid()` or `waitid()`. The kernel hands over the status and frees the record. The PID can now be reused.

The middle state costs almost no memory, a few kilobytes of kernel bookkeeping. But, as the manual page warns, a zombie that is not removed by a wait keeps its slot in the kernel’s process table, and if that table fills up, no new processes can be created. A zombie is a promise the kernel made to the parent: “I will keep this for you.” It keeps that promise until the parent collects, however long that takes.

There is an exception that confirms the rule. If the parent sets `SIGCHLD` to `SIG_IGN`, or installs a handler with the `SA_NOCLDWAIT` flag, it is saying in advance that it will never ask for the result. Since Linux 2.6 the kernel then skips the zombie state for its children and frees them at once.

:::fold What the kernel keeps, and when it lets go
The death of a task is in `kernel/exit.c`. `do_exit()` releases the memory map, file table and other resources one by one, then calls `exit_notify()`. That function does two things that matter here.

First, it finds a new parent for the dying task’s own children, in this order: another [[thread|thread]] of the same process, then the nearest ancestor that has marked itself a *child subreaper*, then the init process (PID 1) of the task’s [[namespace|PID namespace]].

Second, it tells the dying task’s parent. If the parent has declared that it does not care, the task goes straight to the state `EXIT_DEAD` and is freed. Otherwise it is left in `EXIT_ZOMBIE`.

When a parent waits, `wait_task_zombie()` claims the zombie with an [[atomic-cas|atomic compare-and-exchange]] from `EXIT_ZOMBIE` to a dead state, so that if two threads of the parent are waiting, exactly one of them gets the status. The final cleanup is `release_task()`. Among other things it decrements the per-user process count that `RLIMIT_NPROC` limits, and it calls the [[cgroup|cgroup]] release hook, where the pids controller uncharges the task. Then the PID is freed.

The order is the point. A zombie is still charged to every limit that counts processes, until the moment it is reaped.
:::

::scene orphans

## Who waits for orphans

The second open question is the parent that dies first. Its children become orphans, and an orphan that later exits would have nobody to reap it. UNIX solves this by giving every orphan a new parent: **[[init|init]]**, PID 1. Init is written to call `wait()` in a loop for children it never created. The `wait(2)` manual page states it plainly: init automatically performs a wait to remove the zombies.

::scene subreaper

Since Linux 3.4, a process can also volunteer for the job. A process that calls [[prctl|`prctl(PR_SET_CHILD_SUBREAPER)`]] becomes a **subreaper**: orphans among its descendants are reparented to it instead of to init. Service managers use this, [[systemd|systemd]] among them, so that a [[daemon|daemon]] that forks twice to detach itself is still under its supervisor.

So the full picture is a contract with three parties. Every process that creates children promises to wait for them. Every process that dies breaks that promise to its children, and init, or a subreaper, inherits it. And init promises to wait for anyone.

::scene orphans

::lab Fork

The lab runs the book’s `p1.c` and `p2.c`. Things to try:

- Choose “child first” without `wait()`. The child prints and exits while the parent still has work to do. From the child’s exit until the parent itself exits, the child is a zombie. Then the parent exits too, the child is reparented to init, and init reaps it. In a short program you never notice.
- Turn on `wait()`. Now the parent collects the child’s status as soon as it is available, and the zombie lasts only until the parent reaches the call. The lab’s narration says it: the child is reaped, no zombie.
- Imagine the parent is a server that never exits, starts a child for each request and never waits. Each request leaves one zombie behind. That is the Phusion bug.

::scene container

## PID 1 in a box

A container on Linux is an ordinary process placed in new **[[namespace|namespaces]]**: its own view of the filesystem, the network, and, the one that matters here, process IDs. The first process in a new PID namespace gets PID 1 inside it and, as the `pid_namespaces(7)` manual page says, it is the init process for that namespace. Run `docker run myimage myserver` and `myserver` is that process.

::scene pid1

Being PID 1 brings three duties that ordinary programs never think about:

- **Orphans come to you.** Any process in the container whose parent dies is reparented to PID 1, unless a subreaper is nearer. If PID 1 does not call `wait()` for children it never created, their zombies stay forever. This is the zombie half of the bug.
- **Default signal actions are switched off.** Other processes, even privileged ones, can only send PID 1 the signals for which it has installed a handler. A program that relies on the default action of `SIGTERM`, which is to die, never receives it. This is the `docker stop` half of the bug. Only `SIGKILL` and `SIGSTOP` sent from the parent namespace get through regardless.
- **When you die, everyone dies.** If PID 1 exits, the kernel sends `SIGKILL` to every other process in the namespace, and no new process can be created there afterwards. There is no chance for anyone else to clean up.

None of these are container bugs. They are the rules of being init, and the kernel enforces them inside a container exactly as it does on the host. The trouble is that most programs were written to be anything but init.

:::fold Why PID 1 ignores your SIGTERM, and what the timeouts are
::scene signals

Real init systems must not be killed by a stray signal, because the death of PID 1 on the host is a [[kernel-panic|kernel panic]]. So the kernel protects init: a signal whose action would be the default is simply dropped. The `pid_namespaces(7)` page extends the same protection to each namespace’s init, and also to signals sent from an ancestor namespace, which is where `docker stop` comes from. The only exceptions are `SIGKILL` and `SIGSTOP` from an ancestor namespace, which are always delivered.

Programs written in languages or frameworks that install their own `SIGTERM` handler behave normally as PID 1. Programs that rely on the default disposition do not, and they appear to hang. Docker’s `docker stop` waits 10 seconds by default for Linux containers before sending `SIGKILL`. [[kubernetes|Kubernetes]] gives a [[pod|pod]] a grace period of 30 seconds by default, after which the container runtime sends `SIGKILL` to any process still running. The container then reports exit code 137, which is 128 plus signal 9.

::scene shell-form

There is a common way to make this worse. A [[dockerfile|Dockerfile]] `ENTRYPOINT` or `CMD` written in *shell form*, as a plain string, runs as a subcommand of `/bin/sh -c`. Docker’s documentation spells out the result: your program is not PID 1 and will not receive the `SIGTERM` from `docker stop`. The shell is PID 1, and it does not forward signals. The *exec form*, a JSON array, runs your program directly.
:::

::scene limits

## How zombies actually hurt

A zombie uses almost no memory, so the damage comes from counting. Three different counters see a zombie as a live process until it is reaped:

| Limit | Where it is set | Typical default | Hit when |
|---|---|---|---|
| `kernel.pid_max` | [[sysctl|sysctl]], for the whole machine | 32,768 in the kernel, raised to at least 1,024 per CPU; systemd raises it to 4,194,304 | No free PID is left |
| `pids.max` | the [[cgroup|cgroup]] of a container or pod | Unlimited unless set (`docker run --pids-limit`, the kubelet’s `PodPidsLimit`) | The container reaches its own limit |
| `RLIMIT_NPROC` | per user, via `ulimit -u` | Varies by system | One user owns too many processes |

On a modern host the machine-wide table is rarely the one that fills. A cgroup limit usually fills first, by design: it exists so that one container’s runaway forking cannot starve the host. When it is reached, [[fork-exec|`fork()`]] and [[clone|`clone()`]] in that container fail with `EAGAIN`, “Resource temporarily unavailable”, and the cgroup’s `pids.events` file counts each refusal. The symptom is a server that cannot start a helper process, a shell that cannot run a command, or a health check that fails because the probe could not be forked.

::scene fixes

## The fixes

There are four ways out, from least to most code.

1. **Put a real init in front.** `docker run --init` starts a small init as PID 1, which then starts your program as its child. Docker’s default for it, `docker-init`, is built on **tini**, and has been included since Docker 1.13. Tini does three jobs: it forwards signals to your program, it reaps every zombie it inherits, and when your program exits, it exits with the same code. Tini also has `-s`, to work as a subreaper when it cannot be PID 1, and `-g`, to signal the child’s whole [[process-group|process group]] the way Ctrl-C does in a terminal.
2. **Share the pod’s init.** In [[kubernetes|Kubernetes]], setting `shareProcessNamespace: true` on a [[pod|pod]] puts all its containers in one PID namespace, whose PID 1 is the tiny `pause` process of the pod sandbox. Its source is a few dozen lines, and one of its two signal handlers is a loop of `waitpid(-1, NULL, WNOHANG)`.
3. **Reap in your own program.** If your program must be PID 1, or simply starts children, handle `SIGCHLD` and reap in a loop. If you never need the children’s exit statuses, setting `SIGCHLD` to `SIG_IGN` makes the kernel do it for you.
4. **Become a subreaper.** A supervisor that is not PID 1 can call `prctl(PR_SET_CHILD_SUBREAPER, 1)` to adopt everything its descendants leave behind.

:::fold A minimal init, in C
::scene mini-init

Here is the core of what tini and `docker-init` do, reduced to its essentials. It is correct for Linux, but simplified: a production init also handles process groups, sets a timeout so it can notice a child that ignores signals, and reports errors more carefully.

```c
/* mini-init: run argv[1..] as a child, forward signals to it, reap every zombie. */
#include <signal.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv)
{
    if (argc < 2) { fprintf(stderr, "usage: %s cmd [args...]\n", argv[0]); return 2; }

    sigset_t all;
    sigfillset(&all);
    sigprocmask(SIG_BLOCK, &all, NULL);        /* take signals synchronously with sigwait */

    pid_t child = fork();
    if (child < 0) { perror("fork"); return 1; }
    if (child == 0) {
        sigprocmask(SIG_UNBLOCK, &all, NULL);  /* the program gets normal signal behaviour */
        execvp(argv[1], argv + 1);
        perror("execvp");
        _exit(127);
    }

    for (;;) {
        int sig;
        sigwait(&all, &sig);
        if (sig != SIGCHLD) {
            kill(child, sig);                  /* forward SIGTERM, SIGINT, ... */
            continue;
        }
        int status;
        pid_t pid;
        while ((pid = waitpid(-1, &status, WNOHANG)) > 0) {    /* reap all, not one */
            if (pid == child)                  /* our program is done: exit like it did */
                return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
        }
    }
}
```

Three details carry the weight.

- **Blocking every signal and calling `sigwait()`.** Signals arrive as values in a loop, not as handlers that interrupt arbitrary code. Because the signals are blocked rather than ignored, the PID 1 rule that drops default-action signals does not apply to them, so `SIGTERM` from `docker stop` arrives.
- **The inner `while` loop.** Standard signals do not queue. If three children exit while one `SIGCHLD` is pending, the init receives a single `SIGCHLD`. Calling `waitpid()` once per signal would leak zombies, so it calls it until there is nothing left to reap.
- **`waitpid(-1, ...)`, not `waitpid(child, ...)`.** The init must reap children it never created, the orphans reparented to it. Waiting only for the child it started is exactly the Phusion bug.

When the program exits, the init returns. As PID 1, its exit makes the kernel kill whatever is left in the namespace, which is the cleanup a container wants at that point.
:::

::scene bends

## Where it bends

- **You cannot kill a zombie.** It has already exited. `kill -9` on a zombie does nothing, because there is nothing to receive the signal. The only cure is to make its parent wait, or to kill the parent so the zombie is reparented to an init that will.
- **PIDs get reused.** Once a zombie is reaped its PID is free, and on a busy system it may soon belong to someone else. A supervisor that remembers a PID and signals it later can hit the wrong process. Linux 5.3 added `pidfd_open()`, which returns a [[handle|file descriptor]] for a process. The descriptor keeps referring to the same process even after it has become a zombie, and since Linux 5.4 `waitid()` can wait on it with `P_PIDFD`.
- **Libraries do not reap for you.** Rust’s standard library documents that dropping a `Child` handle neither kills nor waits for the process, and warns that leaving zombies around can exhaust process IDs in a long-running program. Other runtimes differ, so check yours.
- **Shells as PID 1 are half a fix.** The Phusion post noted that bash does reap adopted children, but it does not forward `SIGTERM` to them when it exits, so a shell as init solves one half of the problem and not the other.

::scene overview

## The thread back to the book

The zombie state is not a bug. It is the price of an API decision the book describes in chapter 5: the parent learns its child’s fate through `wait()`, so the kernel must hold that fate until the parent asks. Every resource with an owner who must release it has the same shape, whether it is a file descriptor, a lock or a [[thread|thread]] that must be joined. Forget to release it and it leaks, and the leak shows up as a limit reached somewhere else.

Containers did not change the rules. They moved the job. On a normal machine, init is a carefully written program whose whole purpose is supervising processes. In a container, PID 1 is whatever your image runs, and it inherits a role written in 1970s UNIX: adopt the orphans, collect their statuses, and do not die by accident. The same namespace and cgroup machinery that makes containers cheap is what makes [browser sandboxes](/notes/chrome-processes) possible, and the `fork()` that creates all these children has a surprising second career as [a snapshot mechanism](/notes/fork-redis).

## Further reading

- [`wait(2)`](https://man7.org/linux/man-pages/man2/wait.2.html) (Linux manual page): zombies, reparenting to init, and the `SIGCHLD` and `SA_NOCLDWAIT` rules.
- [`pid_namespaces(7)`](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) (Linux manual page): the init process of a namespace, its signal rules, and what happens when it dies.
- [`PR_SET_CHILD_SUBREAPER`](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html) (Linux manual page).
- Hongli Lai: [Docker and the PID 1 zombie reaping problem](https://blog.phusion.nl/docker-and-the-pid-1-zombie-reaping-problem/) (Phusion, January 2015).
- [tini](https://github.com/krallin/tini): the init behind `docker run --init`, with notes on subreaping and process groups.
- [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/) (Docker docs): the `--init` and `--pids-limit` flags.
- [Share Process Namespace between Containers in a Pod](https://kubernetes.io/docs/tasks/configure-pod-container/share-process-namespace/) (Kubernetes docs).
- [Process Number Controller](https://docs.kernel.org/admin-guide/cgroup-v1/pids.html) (Linux kernel docs): `pids.max`, `pids.current` and the `EAGAIN` behaviour.
