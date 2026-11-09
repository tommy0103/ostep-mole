---
deck: Windows, macOS and Linux each took chapter 8's five rules somewhere different. One kept them and added boosts, one asks the application instead of guessing, and one threw the heuristics out and then let you load your own.
title: What shipping kernels actually do with MLFQ
---

::scene overview

The chapter ends with a claim and a list. MLFQ is used, in some form, by BSD UNIX derivatives, Solaris, and Windows NT and its successors. If you opened the scheduler of the operating system on your laptop today, how much of chapter 8 would you recognise?

The answer differs a lot from system to system, and the differences are the interesting part. In 2007 Linux replaced a scheduler built on interactivity heuristics with one whose documentation says it "has no heuristics whatsoever". Windows, meanwhile, still boosts a [[thread|thread]]'s priority when its disk read completes, as Windows NT did. Apple's systems mostly stopped guessing and started asking applications what their threads are for.

This piece walks through each of them and checks them against MLFQ's rules one at a time.

::scene rules

## The five rules, as a checklist

::chapter cpu-sched-mlfq

Here are the chapter's final rules, in short form:

1. If A has higher priority than B, A runs.
2. Equal priorities run round robin.
3. A new job starts at the top.
4. Once a job uses up its allotment at a level, however many times it gave up the CPU, it moves down.
5. Every period S, move everyone back to the top.

Rules 1 and 2 are the mechanism. Rules 3 to 5 are a learning algorithm: start optimistic, watch, demote the CPU hogs, and periodically forget so that nobody starves and a job that changes its behaviour gets a second chance. Rule 4 in its final form is also an anti-gaming rule, since it charges a job for its CPU use however it slices that use up.

For each real system, then, ask four questions. How many levels are there? Who decides a thread's priority, the scheduler by watching or the program by declaring? How does the scheduler stop a program from gaming it? And what plays the role of the priority boost?

The lab below is the chapter's MLFQ. Two of its scenarios are worth having in your head before reading on. Pick *Starvation* and set the Rule 5 boost to 50 ms: the CPU-bound job A starts getting slices again. Pick *Gaming* and tick *better accounting*: job G, which yields just before its slice ends, can no longer stay at the top.

::lab Mlfq

::scene windows

## Windows: 32 queues and a stack of boosts

Windows is the closest to the book's MLFQ. Microsoft documents 32 priority levels, from 0 (lowest) to 31 (highest). The scheduler keeps a separate ready queue for each level, runs the threads at the highest non-empty level round robin, and preempts a running thread as soon as a higher-priority thread becomes ready. Those are Rules 1 and 2 word for word.

The levels split into two bands. Levels 16 to 31 are the [[real-time|real-time]] band, and threads there keep exactly the priority they were given. Levels 1 to 15 are the dynamic band, where the scheduler moves threads around. Level 0 is reserved for the zero-page thread, which zeroes free memory [[page|pages]] when nothing else wants to run.

A thread's starting point, its **base priority**, combines its process's priority class with the thread's relative level within that class. For a thread at the default relative level (`THREAD_PRIORITY_NORMAL`), the documented base priorities are:

| Priority class | Base priority of a normal thread |
|---|---|
| `IDLE_PRIORITY_CLASS` | 4 |
| `BELOW_NORMAL_PRIORITY_CLASS` | 6 |
| `NORMAL_PRIORITY_CLASS` | 8 |
| `ABOVE_NORMAL_PRIORITY_CLASS` | 10 |
| `HIGH_PRIORITY_CLASS` | 13 |
| `REALTIME_PRIORITY_CLASS` | 24 |

On top of the base priority, each thread in the dynamic band has a **dynamic priority**, and this is where MLFQ lives. The documentation lists the occasions on which the scheduler boosts it:

- when the process that owns the foreground window comes to the front, its priority class is raised so it is at least that of any background process;
- when a window receives input, such as mouse, keyboard or timer messages, the thread that owns the window is boosted;
- when a blocked thread's wait is satisfied, for example when a disk or keyboard I/O it was waiting for completes, the thread is boosted.

Then comes the demotion rule: after a boost, the dynamic priority drops by one level each time the thread completes a time slice, until it is back at its base. It never goes below the base.

Read that as MLFQ. A thread that just woke up from I/O is presumed interactive and jumps up, like a job entering at the top. If it keeps running, it sinks one level per time slice, like Rule 4. There is no Rule 3: a new thread starts at its base priority, not at the top. And demotion stops at the base, so each thread's MLFQ is confined to a band between its base priority and 15. The program chooses the floor, and the scheduler's learning works only above it.

:::fold Inside the boosts: device values, charged waits, and a starvation sweeper
::scene sweeper

Microsoft's public documentation stops at the rules above. The detail comes from the *Windows Internals* authors. The numbers here are from David Solomon and Mark Russinovich's teaching material for the Windows XP and Server 2003 kernels. Later versions changed several of them, so treat them as an illustration of how the design works rather than as today's constants.

**Boost sizes depend on the device.** A [[driver|driver]] completing an I/O request passes a priority increment along with the completion. The common values were 1 for disk, CD-ROM, parallel port and video, 2 for serial, network, named pipe and mailslot, 6 for keyboard or mouse, and 8 for sound. The more a human is likely to be waiting on the device, the bigger the jump.

**Waking up costs you quantum.** Internally, a quantum was counted in thirds of a [[tick|clock tick]], and a thread lost one third of a tick each time it came out of a wait. The stated reason was so that threads boosted after I/O completion would not keep running without ever reaching the end of a quantum, and so that I/O-bound threads would not get unfair preference over CPU-bound ones. That is the chapter's *Attempt #3: Better Accounting*, the defence against the job that yields just before its slice ends.

**A sweeper plays Rule 5.** A system thread called the *balance set manager* woke about once per second and scanned the ready queues for threads that had been ready but not run for 300 clock ticks, about 4 seconds on a 10 ms clock. Each one found was raised to priority 15, the top of the dynamic band, and given a longer quantum. When that quantum ended it dropped straight back. This is a targeted priority boost: only threads that are actually starving get lifted, rather than everyone at once. It also broke some [[priority-inversion|priority inversions]], with no guarantee, by eventually running a starved [[lock|lock]] holder. Current Windows handles that directly with *AutoBoost*, which raises a lock owner to the priority of its highest waiter.

**Quanta were short and stretchable.** The default quantum was 2 clock ticks on client versions and 12 on servers, and on clients the foreground process's threads could get up to three times that.
:::

::scene win-qos

Recent Windows adds a second axis. Since Windows 10 version 1709, every thread also has a **Quality of Service** level: High, Medium, Low, and later Utility, Eco, Media and Deadline. The system mostly infers it from what the user can see: the focused window is High, visible but unfocused windows Medium, minimized or hidden ones Low, and audible processes High. Priority remains the main metric for which thread runs next; QoS influences which kind of core a thread runs on, on chips with [[hybrid-cores|performance and efficiency cores]], and how fast the [[dvfs|processor is clocked]]. The scheduler now has two numbers per thread, one for *when* and one for *where and how fast*.

::scene apple-qos

## macOS and iOS: ask, don't guess

Apple went furthest away from MLFQ's central premise that the OS must learn what a job is from watching it. On macOS and iOS the main input to the scheduler is a **[[thread-qos|Quality of Service class]]** that the application declares for each piece of work. Apple's energy-efficiency guide defines four primary classes, each with an expected duration:

| QoS class | Intended for | Expected duration |
|---|---|---|
| User-interactive | Main thread, UI updates, animation | Virtually instantaneous |
| User-initiated | Work the user started and is waiting for | A few seconds or less |
| Utility | Long tasks with a progress bar: downloads, imports | Seconds to minutes |
| Background | Work the user does not see: indexing, sync, backup | Minutes to hours |

The system uses QoS to adjust scheduling priority, CPU and I/O throughput, and timer latency. QoS also propagates through the program. Work enqueued on a higher-QoS queue is promoted to that queue's level. And when a high-QoS thread blocks on a [[lock|`pthread_mutex`]] held by a lower-QoS thread, or waits on a [[dispatch-queue|serial queue]] with `dispatch_sync`, the system temporarily raises the lower-QoS work to resolve the [[priority-inversion|priority inversion]].

This is the book's "advice" aside promoted to the primary interface. Chapter 8 treats `nice` as a hint; Apple made the hint the main signal, and made it cheap to give by attaching it to the dispatch queues programs already use.

::scene clutch

Underneath, the [[xnu|XNU]] kernel still learns from history. Its Clutch scheduler, documented in the XNU source tree, is a three-level hierarchy:

1. **Root buckets**, one per QoS class, chosen by [[edf|earliest deadline first]]. When a bucket becomes runnable it gets a deadline of now plus a per-class *worst-case execution latency*: 0 for the foreground class, 37.5 ms for user-initiated, 75 ms for default, 150 ms for utility and 250 ms for background. Higher classes also get a small "warp" budget that lets them jump ahead of an earlier deadline briefly. A low bucket that keeps being passed over enters a *starvation avoidance* mode.
2. **Thread groups** inside each bucket: sets of related threads that XNU accounts for together. Each group gets an *interactivity score* from the ratio of time its threads spent blocked to time they spent running. Groups that block more than they run score in the higher range and are favoured. This is MLFQ's Rule 4, applied to a whole application rather than to one thread.
3. **Threads** inside each group, scheduled by Mach's classic timesharing rule: priority equals base priority minus the thread's recent CPU usage, shifted right by a scale factor, the priority shift. Usage decays over time. This is the *[[decay-usage|decay-usage]]* family that chapter 8 cites from 4.3BSD and Epema [E95].

One detail runs against the book's advice. In the textbook MLFQ, low-priority queues get *longer* time slices, because their jobs are CPU-bound batch work. In Clutch the quantum *shrinks* with the class: 10 ms for foreground, 8 ms for user-initiated, 6 ms for default, 4 ms for utility and 2 ms for background. Background work on a phone is not batch work whose throughput matters; it should get out of the way. On Apple silicon's asymmetric chips, an extension called the Edge scheduler adds the "where" question on top, steering threads between performance and efficiency clusters by class.

::scene o1

## Linux: heuristics, then none, then pluggable

Linux tried the most designs, and its history is chapter 8's trade-off acted out in public.

**O(1), 2002 to 2007.** Ingo Molnar's O(1) scheduler, written for the 2.5 development series and shipped in 2.6, had 140 priority levels (100 real-time and 40 for the nice range) and per-CPU arrays of [[run-queue|run queues]], one list per level. It was MLFQ-shaped, and it learned interactivity from sleep. Each task kept a `sleep_avg` that rose while it slept and fell while it ran. As Con Kolivas described it in 2003, a task's dynamic priority could move up to five levels either side of its static priority depending on that value. LWN's summary in 2007 was that the mainline scheduler had grown an "elaborate array of heuristics" for finding interactive processes, and that people still complained about interactive response.

::scene rsdl

**RSDL, 2007, the MLFQ that was not merged.** Kolivas's Rotating Staircase Deadline scheduler dropped the interactivity estimator entirely. Each priority level got a quota of time. When a level's quota ran out, every task at that level moved down one level, a *minor rotation*, and when the active array emptied, the active and expired arrays swapped and every task started again at its original priority, a *major rotation*. Put next to the book, that is Rule 4 with exact accounting and Rule 5 as a periodic reset. RSDL was very nearly the textbook's final MLFQ, and it lost.

::scene cfs

**CFS, Linux 2.6.23, October 2007.** What won was Molnar's Completely Fair Scheduler, a proportional-share design that the next chapter covers. In LWN's description at the time, it did away with the arrays of run queues altogether. There was no tracking of sleep time and no attempt to identify interactive processes. Interactivity was supposed to fall out of fairness: a task that sleeps a lot is behind in [[vruntime|virtual runtime]], so it runs promptly when it wakes. In practice CFS still grew a few heuristics, such as a credit for sleepers and a wakeup granularity. In Linux 2.6.38 it also gained **autogroup**, which puts each terminal session in its own group so that a [[make-j|`make -j10`]] in one window does not crush a video player in another. The `sched(7)` manual page gives the example: the player's share goes from about 9% to about 50%.

::scene eevdf

**EEVDF, Linux 6.6, 2023.** CFS's successor adds a virtual deadline derived from a requested slice length, so latency can be asked for separately from share; the [EEVDF note](/notes/eevdf) covers it. Note the direction: Linux got a "how soon" input in the end, but as a number a task requests, closer to Apple's approach than to guessing.

::scene sched-ext

**sched_ext, Linux 6.12, November 2024.** The last turn is the strangest. sched_ext is a [[sched-class|scheduler class]] whose policy is supplied at run time as a set of [[bpf|BPF programs]]. The kernel keeps a safety net: if the BPF scheduler hits an error, if a runnable task goes unscheduled for too long (the watchdog's timeout defaults to, and is capped at, 30 seconds), or if the operator presses [[sysrq|SysRq-S]], the BPF scheduler is unloaded and every task reverts to the fair class. [[out-of-tree|Out of tree]], the sched-ext project's `scx_lavd`, initially motivated by gaming, measures how latency-critical each task is from its behaviour and turns that into virtual deadlines and time slices. The heuristics came back, but as programs you load rather than code everyone runs.

The merge itself shows how much of scheduling is still being argued. LWN reported in June 2024 that Linus Torvalds had decided to merge sched_ext over the scheduler maintainer's objections, after it had been blocked for some time despite clear interest from users. It missed 6.11 and landed in 6.12.

:::fold FreeBSD's ULE: MLFQ by formula
::scene ule

FreeBSD's ULE scheduler is a useful fourth data point, because it keeps chapter 8's idea but replaces the queue-by-queue rules with one number. Each thread accumulates its recent voluntary sleep time and run time. An **interactivity score** in the range 0 to 100 compares them, and smaller means more interactive. Threads whose score is under a threshold, 30 by default, are treated as interactive and get a priority in the interactive range, which is served ahead of the batch range.

The scoring function is short. This excerpt is lightly trimmed from `sys/kern/sched_ule.c`:

```c
/* SCHED_INTERACT_HALF is 50 */
if (ts->ts_runtime > ts->ts_slptime) {          /* runs more than it sleeps */
    div = max(1, ts->ts_runtime / SCHED_INTERACT_HALF);
    return (SCHED_INTERACT_HALF +
        (SCHED_INTERACT_HALF - (ts->ts_slptime / div)));
}
if (ts->ts_slptime > ts->ts_runtime) {          /* sleeps more than it runs */
    div = max(1, ts->ts_slptime / SCHED_INTERACT_HALF);
    return (ts->ts_runtime / div);
}
```

Two details map onto the book. First, the score counts only *voluntary* sleep. The source comment explains that time spent waiting on a run queue is excluded, because it says nothing about the thread's intent. Second, history is capped. Once sleep plus run time exceeds `SCHED_SLP_RUN_MAX`, five seconds' worth, both are scaled down. A thread cannot bank an hour of sleep and spend it at interactive priority, and a thread that changes phase is reclassified within seconds. Capping history plays the role of Rule 5: it makes the scheduler forget, so that the past cannot outvote the present.
:::

::scene overview

## The scorecard

Here is the checklist filled in, much simplified:

| Rule | Windows | macOS (XNU Clutch) | Linux (CFS, EEVDF) | FreeBSD ULE |
|---|---|---|---|---|
| 1–2: priority, then round robin | Yes: 32 levels | Yes, under EDF between QoS buckets | No priority levels for normal tasks; weights and virtual time | Yes: run queues by priority |
| 3: start at the top | No: start at base priority | Declared by QoS class | No bonus for being new | Inherits a short history at fork |
| 4: demote by usage | Drop a level per quantum; waits charged | Decay usage; group interactivity score | Exact accounting in vruntime | Sleep/run score |
| 5: periodic boost | Sweeper for threads starved about 4 s | Starvation avoidance between buckets | Unneeded: share is guaranteed | History capped at 5 s |
| Advice | Priority class, thread level, EcoQoS | QoS classes (primary input) | nice, slice requests, [[cgroup|cgroups]] | nice |

## Where the book's trade-off went

Chapter 8 warns about *voodoo constants*, parameters that need black magic to set, and every system above has them. Microsoft's 300 ticks, ULE's threshold of 30 and Clutch's 37.5 ms were each chosen by someone and tuned against workloads. The constants never went away; they moved to where they are harder to see.

What has changed is the answer to "who knows what a job is?". In 1962, and in the book, the answer is that the OS must infer it. Windows infers it from I/O completions and window focus. Apple asks the developer. From 2007 to 2024 Linux chose not to infer at all and offered fairness instead; with sched_ext, people who want inference can load their own. None of these is the final answer, which is why the argument has not ended.

The lesson that holds across all of them is the chapter's own. Learning from history works when jobs have stable phases, and it fails when they change or game the rules. Every real system pairs its learning rule with two things: accounting that cannot be dodged, and a way to forget. The thread note [Approximating an oracle with history](/notes/history-predicts) follows that pairing outside the scheduler.

## Further reading

- [Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities), [Priority Boosts](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts) and [Quality of Service](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service), Microsoft Learn.
- [Advanced Windows Thread Scheduling](https://osm.hpi.de/bs/2007/Slides/Unit04/4.5_AdvancedScheduling.pdf), David A. Solomon and Mark E. Russinovich with Andreas Polze, Windows Operating System Internals curriculum (XP and Server 2003 era).
- [Prioritize Work with Quality of Service Classes](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/PrioritizeWorkWithQoS.html), Apple Energy Efficiency Guide.
- [Clutch scheduler](https://github.com/apple-oss-distributions/xnu/blob/main/doc/scheduler/sched_clutch_edge.md), XNU source documentation.
- [The Rotating Staircase Deadline Scheduler](https://lwn.net/Articles/224865/) (LWN, March 2007) and [Schedulers: the plot thickens](https://lwn.net/Articles/230574/) (LWN, April 2007).
- [CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html), Linux kernel documentation.
- [Extensible Scheduler Class](https://docs.kernel.org/scheduler/sched-ext.html), Linux kernel documentation, and [Extensible scheduler class to be merged for 6.11](https://lwn.net/Articles/978007/) (LWN, June 2024).
- [sched_ule.c](https://github.com/freebsd/freebsd-src/blob/main/sys/kern/sched_ule.c), FreeBSD source.
