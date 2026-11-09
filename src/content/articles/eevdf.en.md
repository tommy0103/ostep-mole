---
deck: Linux’s fair scheduler learned to tell “how much” apart from “how soon”, using an idea from 1995.
title: After CFS: how EEVDF separates share from latency
---

::scene overview

In October 2023, Linux 6.6 shipped with a different heart in its scheduler. The Completely Fair Scheduler, which had picked the next task on almost every Linux machine since 2.6.23 in 2007, handed that job to an algorithm called **EEVDF**: *Earliest Eligible Virtual Deadline First*. The algorithm was not new. It comes from a 1995 technical report by Ion Stoica and Hussein Abdel-Wahab, the same paper the book cites as [SA95] at the end of chapter 9.

Nobody replaces a scheduler for fun. CFS was fair, and fast enough to run everywhere from phones to supercomputers. What it could not do cleanly was answer a second question that every scheduler is asked. This piece is about that second question, and about how a 30-year-old idea answers it with one extra number per task.

::scene two-questions

## Two questions, one dial

A scheduler for time-shared CPUs has to answer two different questions:

- **How much?** Over a long stretch, what fraction of the CPU should each task get? This is the proportional-share question of chapter 9: tickets, strides, weights.
- **How soon?** When a task becomes runnable, how long may it wait before it runs? This is the response-time question of chapter 7.

Stride scheduling and CFS answer the first question beautifully and the second one only by accident. Both keep a per-task counter of virtual time (stride’s *pass*, CFS’s *vruntime*) that advances more slowly for heavier tasks, and both always run the task with the smallest counter. Over time every task’s counter marches forward at the same pace, which means every task gets CPU in proportion to its weight. But nothing in that rule says *when* within the next few milliseconds a task gets its turn.

CFS filled that gap with heuristics: a target latency, a minimum granularity, a wakeup granularity that decided whether a waking task could preempt the running one, and a credit for sleepers so that interactive programs would not be punished for having slept. They worked well enough for years. But users had only one dial, the *nice* value, and it moves share and latency together. Make an audio [[thread|thread]] more responsive by lowering its nice value, and you have also given it a bigger share of the CPU it does not need.

For several years developers proposed adding a second dial, a “latency nice” value, on top of CFS. Peter Zijlstra’s answer, posted in March 2023, was to change the algorithm underneath so that the second dial falls out of the math instead of being bolted on. That algorithm was EEVDF.

::scene vruntime

## Virtual time, again

::chapter cpu-sched-lottery

Start from what chapter 9 already gave you. Each task *i* has a weight *w*~i~ (derived from its nice value; nice 0 is weight 1024) and a virtual runtime *v*~i~. While the task runs for Δ*t* of real time, its virtual runtime grows by Δ*t* · 1024 / *w*~i~. Heavy tasks age slowly, light tasks age quickly. CFS runs the task with the smallest *v*~i~; stride scheduling runs the task with the smallest pass. These are the same rule with different names.

EEVDF adds one more quantity: the [[run-queue|queue]]’s **virtual time** *V*, the weighted average of the virtual runtimes of all runnable tasks.

> V = Σ w~i~ · v~i~ / Σ w~i~

You can read *V* as “where a perfectly fair processor would have every task by now”. On an ideal, infinitely divisible CPU each task would advance in lockstep, and every *v*~i~ would equal *V* at all times. On a real CPU only one task runs at a time, so some tasks are ahead of *V* and some are behind it.

::scene lag

## Lag: what you are owed

The distance from the ideal is called **lag**:

> lag~i~ = w~i~ · (V − v~i~)

A task with positive lag is *behind*: it has received less CPU than its fair share and is owed time. A task with negative lag is *ahead*: it has had more than its share. EEVDF calls a task **eligible** when its lag is zero or positive, that is, when *v*~i~ ≤ *V*.

This is the first half of the rule, and it does the “how much” job. Only tasks that are not ahead of their fair share may run. A task that has run ahead has to wait until the others catch up and *V* moves past it. However the next part of the rule chooses among eligible tasks, no task can get more than its share for long.

:::fold Why the lags always sum to zero
Multiply out the definition and sum over all runnable tasks:

Σ lag~i~ = Σ w~i~ · V − Σ w~i~ · v~i~ = V · Σ w~i~ − Σ w~i~ · v~i~.

By the definition of *V*, Σ *w*~i~ · *v*~i~ = *V* · Σ *w*~i~, so the sum is exactly zero.

Lag is a zero-sum quantity: every millisecond one task is ahead is a millisecond, weighted, that the others are behind. Two consequences matter in practice:

- There is always at least one eligible task, since not everyone can be ahead. The scheduler never gets stuck with nothing it may run.
- When a task leaves the queue (it sleeps or exits) and takes its lag with it, *V* has to move to keep the books balanced. This is why the kernel is careful about what lag a task carries when it leaves and comes back, as discussed below.

Real kernels do not compute *V* from scratch on every decision. Linux keeps a running sum of *w*~i~ · (*v*~i~ − *v*~0~) relative to a reference point, plus the total weight, and updates both whenever a task is added, removed or charged for running. The average then costs one division.
:::

::scene deadline

## Deadlines: when you are owed it

The second half of the rule does the “how soon” job. Every time a task asks for CPU, it asks for a specific amount: a **request** of *r*~i~ milliseconds, which the kernel calls the task’s *slice*. EEVDF turns that request into a **virtual deadline**:

> d~i~ = v~i~ + r~i~ · 1024 / w~i~

This is the virtual time by which the task should have received the CPU it asked for, if the processor were perfectly fair. The full rule then reads like the algorithm’s name: **among the eligible tasks, run the one with the earliest virtual deadline.**

Look at what the request size does. A task that asks for 3 ms slices gets a deadline 3 ms (scaled by its weight) into the virtual future. A task that asks for 0.5 ms slices gets a deadline only 0.5 ms out, so it sorts ahead in the deadline order and runs sooner. But it gets only 0.5 ms before its request is complete, at which point it receives a new deadline. Asking for short slices buys earlier service in smaller pieces. It does not buy more service, because eligibility still caps every task at its share.

That is the separation CFS lacked. The **weight** sets how much. The **slice** sets how soon.

Here is a snapshot with three equal-weight tasks, showing virtual times in milliseconds with the weight scaling dropped for readability:

| task | v | slice r | deadline d = v + r | lag (V − v) | eligible? |
|---|---|---|---|---|---|
| A | 10 | 3 | 13 | +2 | yes |
| B | 12 | 0.75 | 12.75 | 0 | yes |
| C | 14 | 0.5 | 14.5 | −2 | no |

*V* is the average, 12. CFS would run A, which has the smallest vruntime. EEVDF runs **B**: both A and B are eligible, and B’s deadline is earlier. C has the earliest *slice* of all, but it is ahead of its share, so its short slice does not help it now. A loses nothing in the long run: it is still eligible, still owed 2 ms, and will run as soon as B’s short request is served.

:::fold What the kernel code looks like
::scene tree

The decision lives in `pick_eevdf()` in `kernel/sched/fair.c`. Doing the obvious thing, scanning every task, would be O(n), so runnable tasks sit in a red-black tree with extra data cached in each node.

- In Linux 6.6, the tree was ordered by vruntime, the way CFS had always ordered it. Each node also cached the earliest deadline anywhere in its subtree.
- Since Linux 6.8 the tree is ordered by **deadline**. Each node caches the **smallest vruntime** in its subtree. Walking from the leftmost (earliest-deadline) side, the scheduler can skip any subtree whose minimum vruntime is beyond *V*, because nothing in it is eligible.

In both designs the pick is a single walk down a balanced tree, O(log n). The common case is even cheaper: the leftmost node is cached, and when it is eligible it is the answer.

Below is simplified pseudo-code for the 6.8+ search. The real function also handles the currently running task, which is not in the tree, and a few feature flags.

```c
/* pseudo-code, simplified from kernel/sched/fair.c (6.8+) */
entity *pick_eevdf(tree *t, u64 V)
{
    node *n = t->root;
    if (eligible(t->leftmost, V))           /* fast path */
        return t->leftmost;
    while (n) {
        if (n->left && n->left->min_vruntime <= V) {
            n = n->left;                     /* an eligible, earlier deadline exists to the left */
            continue;
        }
        if (eligible(n, V))
            return n;                        /* nothing eligible to the left: this is it */
        n = n->right;
    }
    return NULL;
}
```

The pattern matters more than the details. It is an augmented tree: a search structure that caches a summary of each subtree so a query can prune whole subtrees. The same trick shows up in interval trees, in the kernel’s [[vma|virtual-memory areas]], and in database indexes.
:::

::scene wakeup

## Watch it run

The lab below runs a simplified EEVDF with three tasks. A and B are CPU-bound and ask for the default 3 ms slices. C is interactive: it runs for 0.5 ms, sleeps for 3.75 ms, and wakes up again, like a thread that handles input events. The bottom panel is the number line from this article. The shaded region is “eligible”, the vertical line is *V*, each dot is a task’s vruntime and each bar runs to its deadline.

::lab Eevdf

Things to try:

- Leave C at 3 ms and step through a wakeup. C wakes up eligible, but its deadline is no earlier than the running task’s, so it waits for that task’s request to end. Its mean wait sits near 2.5 ms.
- Switch C to 0.5 ms. Now a freshly woken C has the earliest deadline and runs almost at once. Its mean wait drops to about 1 ms. What remains is the time C spends ahead of its share after a burst, waiting for *V* to catch up.
- Watch the CPU shares while you do this. A and B stay at roughly equal halves of what C leaves. C’s share rises a little only because it now waits less and so wakes more often. Its *entitlement* has not changed.
- Give A double weight. A’s bar on the number line shrinks, since its deadline is closer in virtual time, and A’s share rises towards two thirds of the CPU-bound time. The slice controls nothing of that.

The lab is a simplification. It uses a fixed 0.25 ms time step, has a single CPU, and lets a woken task preempt whenever it would be picked. That last behaviour is roughly what Linux does for tasks with shorter slices since 6.12, as the next sections explain.

::scene sleep

## Sleeping: keep your lag

The hardest part of any fair scheduler is the task that goes away and comes back.

CFS handled sleepers with a heuristic. A waking task’s vruntime was raised to at least the queue’s minimum vruntime minus a bonus of half the target latency. The bonus made interactive tasks snappy, but it was a flat bonus. It did not depend on what the task was actually owed when it went to sleep.

EEVDF’s answer follows from lag. A task leaves the queue with whatever lag it has, and when it returns it is placed so that its lag is preserved: its vruntime becomes *V* − lag / *w*. A task that left while owed time comes back owed the same time and runs soon. A task that left *ahead*, with negative lag, comes back still ahead and must wait until *V* catches up. Sleeping can no longer launder an overdraft. This is the same anti-gaming instinct as MLFQ’s allotment accounting in [chapter 8](/virtualization/cpu-sched-mlfq), made exact.

::scene delayed

Preserving lag forever would be wrong too. A task that slept for an hour should not come back owed, or owing, a millisecond from an hour ago. Linux 6.6 placed waking tasks using their saved lag, scaled so that the task’s own arrival, which shifts *V*, does not eat into it. Linux 6.12 completed the design with **delayed dequeue**: a task that goes to sleep while ineligible is not removed from the queue at once. It stays, marked for deferred dequeue, until its negative lag has decayed, and only then leaves. The debt is paid off in virtual time instead of being carried around or forgiven.

:::fold Why delayed dequeue was needed
The problem with simply saving lag at sleep time is that *V* keeps moving while a task sleeps, and it moves differently depending on who else is runnable. A negative lag recorded at one moment can be a much harsher or much milder penalty when applied later.

Keeping an ineligible sleeper on the queue lets the normal machinery handle it. Its vruntime stays fixed while *V* advances past it. Once its lag reaches zero it is dequeued for real, with nothing owed in either direction. The cost is complexity: a “sleeping” task now lingers in the run queue, and every piece of code that counts runnable tasks or computes load had to learn to tell the difference. Some [[regression|regression]] reports against 6.12 were narrowed down by switching it off. The behaviour is controlled by a scheduler feature flag, `DELAY_DEQUEUE`, which you can switch off under [[debugfs|`/sys/kernel/debug/sched/features`]] when chasing a problem.
:::

::scene slice

## The new dial: asking for a slice

For the first year the second dial existed only inside the kernel. Every normal task got the same base slice. In 6.6 that was 0.75 ms scaled by 1 + log~2~ of the CPU count, up to 8 CPUs, so 3 ms on most machines. A 2025 change trimmed the base to 0.7 ms, which gives 2.8 ms.

Linux 6.12 opened the dial to user space. A normal, fair task can request a slice by passing `sched_runtime` to the `sched_setattr()` [[syscall|system call]]. The same field already existed for [[sched-deadline|`SCHED_DEADLINE`]] tasks, where it means something stricter. The kernel clamps the value to a sane range. Since the same release, a waking task whose slice is shorter than the running task’s may preempt it, so a short slice translates directly into shorter wakeup latency.

```c
#include <linux/sched/types.h>   /* struct sched_attr */
#include <sys/syscall.h>
#include <unistd.h>

/* Ask for 1 ms slices for the calling thread. It stays an ordinary fair task. */
int request_short_slices(void)
{
    struct sched_attr attr = {
        .size          = sizeof(attr),
        .sched_policy  = 0,             /* SCHED_OTHER */
        .sched_nice    = 0,             /* sched_setattr also sets nice: keep it explicit */
        .sched_runtime = 1000 * 1000,   /* nanoseconds */
    };
    return syscall(SYS_sched_setattr, 0, &attr, 0);   /* pid 0 = this thread */
}
```

The weight still comes from the nice value, and the slice comes from here. An audio callback thread can ask for short slices without asking for more CPU, and a batch job can ask for long ones to keep its [[cpu-cache|caches]] warm. That is the separation latency-nice was after, reached without inventing a new kind of priority.

:::aside What EEVDF is not
The “deadline” in EEVDF is a virtual sorting key, not a promise. EEVDF is not a real-time scheduler, and it is unrelated to Linux’s `SCHED_DEADLINE` policy, which does make guarantees, using [[admission-control|admission control]] and the [[edf|Earliest Deadline First]] algorithm. Under heavy load an EEVDF task still waits behind its fair share of others. What it guarantees is the proportional share, and a bound on how far any task’s lag can drift.
:::

::scene bends

## Where it bends

The clean rule meets real hardware and real workloads in a few places, and each has grown a knob or a heuristic:

- **Run to parity.** Strict EEVDF would re-decide at every [[tick|tick]]. Linux lets the current task keep running until it has used up its slice or caught up with *V*, its zero-lag point, which avoids switching back and forth between near-equal tasks. This is the `RUN_TO_PARITY` feature.
- **Wakeup preemption.** A waking task preempts if it would be picked, but run-to-parity normally protects the current task. Since 6.12, a waking task with a shorter slice may cut through that protection (`PREEMPT_SHORT`).
- **Groups.** With [[cgroup|cgroups]], EEVDF runs at every level of the hierarchy. A [[container|container]] is one entity with one weight in its parent’s queue, and its own queue of tasks inside, as in the [Kubernetes note](/notes/k8s-shares).
- **Many CPUs.** Everything above happens per CPU run queue. Moving tasks between queues is still the [[load-balancing|load balancer]]’s job, and the multiprocessor trade-offs of [chapter 10](/virtualization/cpu-sched-multi) are unchanged.

The transition also had a cost that the clean math hides. Some workloads [[regression|regressed]] after 6.6 and again after 6.12. The responses were fixes and tuning around wakeup and placement, the parts of a scheduler where heuristics live, rather than changes to the core rule.

::scene lineage

## The thread back to the book

Put chapter 9 and this article side by side and the lineage is short:

1. **Lottery scheduling** gives shares by probability.
2. **Stride scheduling** gives the same shares deterministically by keeping a pass value per task.
3. **CFS** is stride with weights and a red-black tree, and calls the pass value vruntime.
4. **EEVDF** keeps all of that, makes the fair share explicit as *V* and lag, and adds a second key, the virtual deadline, to decide order without touching share.

The same split between “how much” and “how soon” appears wherever a resource is shared by flows of different shapes. In networking, [[fair-queueing|fair-queueing]] schedulers give every flow a virtual finish time. A refinement called WF²Q (Bennett and Zhang, 1996) added exactly EEVDF’s eligibility rule: only packets whose virtual start time has arrived may be sent. Without it, a flow could burst ahead of its share. More recently, LLM serving systems have used virtual [[llm-token|token]] counters to share a GPU fairly among users who send very different request sizes. It is the same bookkeeping, counted in tokens instead of milliseconds.

The book’s chapter ends by mentioning that Linux moved on to EEVDF. Now you know why. Share was never the problem. The problem was that one number had to stand for two things.

## Further reading

- [EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html): the kernel’s own documentation of the algorithm, lag and deferred dequeue.
- [An EEVDF CPU scheduler for Linux](https://lwn.net/Articles/925371/) (LWN, March 2023): the original patch set and the latency-nice background.
- [Completing the EEVDF scheduler](https://lwn.net/Articles/969062/) (LWN, April 2024): delayed dequeue and custom slices, merged for 6.12.
- Ion Stoica, Hussein Abdel-Wahab: *Earliest Eligible Virtual Deadline First: A Flexible and Accurate Mechanism for Proportional Share Resource Allocation*, Old Dominion University TR-95-22, 1995. This is the book’s [SA95].
- Jon C. R. Bennett, Hui Zhang: *WF²Q: Worst-case Fair Weighted Fair Queueing*, IEEE INFOCOM 1996: the same eligibility idea applied to network packets.
- Ying Sheng et al.: *Fairness in Serving Large Language Models*, OSDI 2024: virtual token counters for fair LLM serving.
