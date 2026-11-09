---
deck: A Kubernetes CPU request is a lottery ticket. A CPU limit is something chapter 9 never mentions, a budget that runs out, and most of the surprises come from mixing the two up.
title: "Tickets in your cloud bill: CPU requests, limits and throttling"
---

::scene overview

Every [[container|container]] in a [[kubernetes|Kubernetes]] [[pod|pod]] can carry two CPU numbers:

```text
resources:
  requests:
    cpu: "500m"     # half a CPU
  limits:
    cpu: "2"        # two CPUs
```

They look like a lower and an upper bound on the same quantity, and most people read them that way. They aren't. On a Linux node the two numbers become two unrelated kernel mechanisms. The request becomes a **weight**, which is chapter 9's proportional share under a different name. The limit becomes a **quota**, a fixed amount of CPU time per 100 ms window. When the window's budget is gone, every [[thread|thread]] in the container stops until the next window starts, however idle the machine is.

The first mechanism is work-conserving and forgiving. The second is neither, and it produces some of the strangest latency graphs in production: a service that averages 20% of its limit and still stalls for tens of milliseconds at a time. This piece follows both numbers from the YAML down to the scheduler, and looks at what people do once they understand them.

## Tickets, briefly

::chapter cpu-sched-lottery

::scene tickets

Chapter 9 gives each job some number of tickets and promises it a share of the CPU proportional to its tickets, whether by lottery draws or by stride scheduling's deterministic pass values. Two properties of that scheme matter here.

- **Shares are relative.** 100 tickets against 300 is the same split as 1 against 3. Only the ratio among the jobs that are competing at that moment counts.
- **Shares only bite under contention.** If the other jobs are asleep, a job with one ticket gets the whole CPU. Nothing is wasted. Schedulers with this property are called *work-conserving*.

The book also mentions *ticket currency*: a user can hand out tickets to their own jobs in a local currency, and the system converts that into global tickets. Hold on to that idea, because cgroups are exactly that, a hierarchy of currencies.

## Requests become weights

::scene weights

Linux groups processes into **[[cgroup|control groups]]** (cgroups), arranged as a tree. In cgroup v2 each group has a file `cpu.weight`, an integer from 1 to 10000 with a default of 100. The kernel documentation describes the rule in chapter 9's terms: a parent's CPU is split among its active children, “giving each the fraction matching the ratio of its weight against the sum”. Children with nothing to run drop out of the sum, so the scheme is work-conserving.

Kubernetes puts each pod in its own cgroup, and each container in a cgroup under it. The request reaches `cpu.weight` in two steps, and the second one changed recently.

1. **The [[kubelet|kubelet]] turns [[millicpu|millicores]] into cgroup v1 “shares”.** The formula is `shares = milliCPU × 1024 / 1000`, clamped to the range 2–262144. A pod with no CPU request at all (a *[[qos-class|BestEffort]]* pod) gets the minimum, 2. The number 1024 is simply the default weight of a cgroup in the old v1 interface.
2. **The container runtime turns shares into a v2 weight.** The [[oci-runtime|OCI runtimes]] (runc, crun) do this conversion. Until 2025 they used a straight line from shares [2, 262144] to weights [1, 10000]. The current versions use a curve fitted through three points instead: 2 → 1, 1024 → 100 and 262144 → 10000.

Here is what the two conversions give for some common requests, computed from the formulas in the runtime code:

| request | shares | old weight (linear) | new weight (curve) |
|---|---|---|---|
| 100m | 102 | 4 | 17 |
| 250m | 256 | 10 | 35 |
| 500m | 512 | 20 | 59 |
| 1 CPU | 1024 | 39 | 100 |
| 2 CPU | 2048 | 79 | 174 |
| 4 CPU | 4096 | 157 | 303 |

The old line kept the proportions of the requests almost exactly: two pods side by side on a saturated node, one requesting 500m and one 1500m, got weights of 20 and 59 and split their parent's CPU about 1 : 3. The curve compresses them. The same two pods now get 59 and 138, about 1 : 2.3: a larger request still buys a larger share, but no longer in strict proportion. Leave the node idle and either one can use every core.

:::fold Why the conversion formula changed
::scene formula

The linear formula was correct in a narrow sense: it mapped the full range of one interface onto the full range of the other. The trouble was the middle. A container requesting one whole CPU, which in cgroup v1 had exactly the default weight, came out in cgroup v2 with a weight of about 39, less than 40% of the default 100.

That matters because Kubernetes pods are not alone on a node. System services run in other cgroups at the default weight of 100. Under the linear formula, a pod that had asked for a full CPU competed against a logging [[daemon|daemon]] at well under half the daemon's weight. Small requests suffered more: 100m became a weight of 4, which left almost no room for dividing it further among sub-cgroups.

The new formula is quadratic in the logarithm of the shares, *weight* = ⌈10^(L²/612 + 125L/612 − 7/34)^⌉ with *L* = log~2~(shares). It was picked so that the minimum, the default and the maximum line up: 2 → 1, 1024 → 100, 262144 → 10000. The runtime code computes exactly 100 for 1024 shares; the Kubernetes announcement quotes 102. The change lives in the OCI runtime, not in Kubernetes itself, so it arrived with runc 1.3.2 and crun 1.23, whenever a node's runtime was upgraded. The mapping is many-to-one: every request from 93m to 100m ends up as weight 17. Tools that read `cpu.weight` and try to recover the request, or that hard-coded the old line, had to change.
:::

::scene hierarchy

Two details make the cgroup picture richer than chapter 9's flat list of jobs.

- **It is hierarchical.** Pods sit inside a `kubepods` cgroup, usually under further groups by quality-of-service class, and the node's system services sit beside them. Weights are compared only among siblings, so a pod's real share is its fraction of its parent's share, all the way up. These are the book's ticket currencies.
- **It is per CPU.** Inside the kernel, a group is one schedulable entity with one weight on each CPU's run queue, and it has its own queue of tasks inside. The kernel spreads the group's weight across the CPUs where it has runnable tasks, roughly in proportion to its load on each. How the CPU then picks among entities is the subject of the [EEVDF note](/notes/eevdf).

## Limits become a budget

::scene quota

A limit uses a different mechanism, **CFS bandwidth control**. Each cgroup has a second file, `cpu.max`, holding two numbers: a quota and a period, both in microseconds. The group may consume at most *quota* of CPU time in every *period* of wall-clock time. The default is `max 100000`, meaning no quota and a 100 ms period. The kubelet sets the quota to `milliCPU × period / 1000`, with a floor of 1 ms. A limit of 2 CPUs therefore becomes:

```sh
$ cat /sys/fs/cgroup/cpu.max
200000 100000
```

That reads “200 ms of CPU time per 100 ms”. Note what it does not say. It does not say “two CPUs at a time”. The budget is CPU time summed over all the CPUs the group runs on. On a 64-core node, the same container could run 64 threads at once, for a bit over 3 ms each, and then it is out.

Mechanically, the kernel keeps a global pool of run-time for the group, refilled at the start of each period. CPUs running the group's threads draw from it in slices, 5 ms by default. When a CPU's slice is used up and the pool is empty, the group is **throttled** on that CPU: its scheduling entity is taken off the run queue, and none of its threads run there until the period timer refills the pool. Unused quota does not roll over by default.

### A worked example

::scene throttle

Take a service with a 2-CPU limit on a node with plenty of idle cores. Most of the time it handles small requests that need a few milliseconds of CPU each. Once a second, something parallel happens: a [[garbage-collection|garbage collection]], a cache rebuild, a batch of fan-out requests. Say 10 threads become busy at once.

- At *t* = 0 the period starts with 200 ms of budget.
- Ten threads run in parallel and burn 10 ms of CPU time per millisecond of wall time. By *t* = 20 ms the budget is gone.
- From *t* = 20 to *t* = 100 ms the container is throttled. Nothing in it runs: not the burst, not the small requests, not the [[health-check|health check]].
- A 3 ms request that arrived at *t* = 21 ms completes at about *t* = 103 ms. Its latency was 82 ms, of which 79 were spent waiting for a period boundary.

::scene dashboard

Now look at the same service on a dashboard. Say the baseline load is 0.2 CPU and the burst adds 200 ms of CPU time per second, another 0.2 CPU. Averaged over a minute, the container uses 0.4 CPU, 20% of its limit. It is throttled in 1 period out of 10. Utilization looks comfortable, and the [[percentile|p99 latency]] is 80 ms wide. This is the pattern on the chapter's card: quota burned in the first 20 ms, then an 80 ms wait.

The kernel counts this. In cgroup v2, `cpu.stat` reports `nr_periods`, `nr_throttled` and `throttled_usec`. [[cadvisor|cAdvisor]] exports them to [[prometheus|Prometheus]] as `container_cpu_cfs_periods_total`, `container_cpu_cfs_throttled_periods_total` and `container_cpu_cfs_throttled_seconds_total`. The ratio of throttled periods to all periods is a far better alarm than CPU utilization for any service with a limit.

:::fold The kernel bug that throttled idle services
::scene bug

In 2019 engineers at Indeed noticed something worse than the pattern above. One of their applications was allocated 4.1 CPUs, used no more than about half a CPU, and was heavily throttled anyway. [[tail-latency|Tail latencies]] had risen after an upgrade to Linux 4.18.

Dave Chiluk traced it into the slice mechanism. When a CPU's threads in a group go idle, the kernel returns that CPU's leftover slice to the global pool, but keeps 1 ms behind on the CPU. Before 4.18, a bug in the expiration check meant those leftovers effectively never expired. A 4.18 fix for clock drift (commit 512ac999d275) made the check work, so the 1 ms crumbs now expired at every period boundary. For a service with many threads spread over many CPUs, that is a lot of crumbs. Indeed's write-up counts up to 87 ms of quota stranded per period on an 88-core machine, nearly a whole CPU's worth of budget that the application had paid for but could not use.

The fix, commit de53fd7aedb1 by Chiluk (2019), removed slice expiration entirely. The cost is that a group can briefly overrun its quota by what is left on each CPU, typically at most 1 ms per CPU. The commit message reports an almost 30× improvement on an artificial test with a 10 ms / 100 ms quota on 80 CPUs. The change landed in Linux 5.4 and was [[backport|backported]] to the stable 4.14, 4.19 and 5.3 series and to the major distribution kernels. Indeed reported that worst-case response latency in one application dropped from over 2 seconds to 30 ms.

The story is worth remembering for its shape. Each change was correct on its own. The accounting got more precise, and a workload that had relied on the imprecision fell over.
:::

## Why multithreaded services suffer most

::scene threads

Throttling is a property of the budget, not of the CPU count, so anything that spends the budget faster makes it worse. Parallelism does exactly that, and language runtimes create parallelism on your behalf.

The classic case is a runtime that sizes its thread pools to the machine. Until Go 1.25, [[gomaxprocs|`GOMAXPROCS`]], the number of threads that run Go code at once, defaulted to the number of [[logical-cpu|logical CPUs]] the process could see. A Go service with a 2-CPU limit on a 64-core node would run up to 64 [[goroutine|goroutines]] in parallel, spend its 200 ms in a few milliseconds, and stall for the rest of the period. The garbage collector, which sizes its worker pool from `GOMAXPROCS`, made it worse. The Go team's own blog post puts the arithmetic plainly: an “8 CPU limit” is 800 ms of CPU time every 100 ms, which you can spend on 8 threads for the whole period or on 16 threads for half of it.

::scene runtimes

Runtimes have learned to look at the cgroup:

- **Go 1.25** (August 2025) sets the default `GOMAXPROCS` from the cgroup's CPU limit when that is below the core count, rounding a fractional limit up. It re-checks periodically, because limits can change on a live pod. It deliberately ignores the request, since a weight says nothing about how many threads can run.
- **The [[jvm|JVM]]** has been container-aware for years. Its processor count follows the CPU quota. JDK 19 stopped using CPU shares in that calculation, because it left Java under-using the CPU in Kubernetes pods that had a request but no limit; the change was backported to 17.0.5 and 11.0.17.

Each of these is a runtime discovering that it is not alone on the machine, and that the number of cores it can see is not the number it may use.

## What people do about it

::scene fixes

There is no single fix, because requests and limits express different intents. The common approaches:

- **Set requests, drop limits.** For latency-sensitive services, many teams set an accurate request and no CPU limit at all. The weight still guarantees the pod its share under contention, and when the node has idle cycles the pod can use them. The cost is predictability: a pod's performance now depends on its neighbours, and nothing stops a runaway process from soaking up spare CPU that other burstable pods wanted.
- **Make the threads match the budget.** If you keep a limit, size thread pools to it: `GOMAXPROCS` (automatic since Go 1.25), the JVM's processor count, worker counts in Node, Python and Rust services. Fewer threads cannot burn a period's budget in a fraction of the period.
- **Give critical pods whole cores.** With the kubelet's `static` CPU manager policy, containers in *Guaranteed* pods (requests equal to limits) that ask for an integer number of CPUs get exclusive cores. Nothing else is scheduled on those cores, which helps [[cache-affinity|cache affinity]] as much as it helps fairness.
- **Allow bursts.** Since Linux 5.14 a group can bank unused quota up to a cap and spend it later (`cpu.max.burst` in cgroup v2), at the price of more interference with other groups. Some platforms also lengthen the period, which the kubelet allows behind a [[feature-gate|feature gate]]; a longer period lets bursts finish but makes throttled stalls longer when they happen.
- **Watch the right metric.** Alert on the fraction of throttled periods, not on average utilization. A container can be throttled at any average.

:::fold Reading the counters yourself
::scene dashboard

Inside a container on a cgroup v2 node, the container's own cgroup is normally mounted at `/sys/fs/cgroup`. Two files tell you almost everything:

```sh
$ cat /sys/fs/cgroup/cpu.max
200000 100000
$ cat /sys/fs/cgroup/cpu.weight
59
$ grep -E 'nr_periods|nr_throttled|throttled_usec' /sys/fs/cgroup/cpu.stat
nr_periods 36000
nr_throttled 3600
throttled_usec 288000000
```

The numbers above are illustrative, chosen to match the worked example: a 2-CPU limit, a 500m request under the new conversion, one hour of 100 ms periods (36,000), one in ten throttled, and about 80 ms lost each time (3,600 × 80 ms = 288 s). A throttled ratio of 10% would deserve attention even if the CPU dashboard showed the container at 20% of its limit.

Two cautions. These counters only cover throttling caused by this cgroup's own limit, not by a parent's. And on cgroup v1 nodes the same information lives in `cpu.cfs_quota_us`, `cpu.cfs_period_us`, `cpu.shares` and a `cpu.stat` whose time field is in nanoseconds (`throttled_time`).
:::

## The ticket-assignment problem, in production

::scene assign

Section 9.5 of the book admits that lottery scheduling never says how many tickets each job should get. “Assume that the users know best” is, the book says, a non-solution. Kubernetes adopted that non-solution wholesale. A person writes a request into a YAML file, often once, often by copying a neighbour's.

The number carries more weight than chapter 9's tickets ever did. The Kubernetes scheduler uses requests to decide which pods fit on which node, so a request is both a ticket and a reservation. Ask for too much and you pay for idle machines. Ask for too little and you are packed onto a busy node with a small weight. Tools such as the [[vpa|Vertical Pod Autoscaler]] try to set requests from observed usage, which is the same move the book makes elsewhere when it predicts the future from the past (see [Approximating an oracle with history](/notes/history-predicts)).

::scene overview

Limits add a second dial that chapter 9 never had. A share says how to divide what is there. A limit says how much you may have even when nobody else wants it. Proportional share is work-conserving by design; a quota is deliberately not. That is useful when you are billing someone for exactly two CPUs, or protecting a node from a runaway process. It is harmful when the thing being limited is bursty and parallel, which describes most modern services.

The book's chapter ends with a ticket. Your cloud bill has two numbers on it, and only one of them is a ticket.

## Further reading

- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html): the kernel documentation for `cpu.weight`, `cpu.max`, `cpu.max.burst` and `cpu.stat`.
- [CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html): quota, period, slices and burst, from the kernel's scheduler documentation.
- [New Conversion from cgroup v1 CPU Shares to v2 CPU Weight](https://kubernetes.io/blog/2026/01/30/new-cgroup-v1-to-v2-cpu-conversion-formula/) (Kubernetes blog, January 2026): both formulas and the reasons for the change.
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) and [Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/): the Kubernetes documentation for requests, limits and the static CPU manager.
- [Unthrottled: Fixing CPU Limits in the Cloud](https://engineering.indeedblog.com/blog/2019/12/unthrottled-fixing-cpu-limits-in-the-cloud/) and [part two](https://engineering.indeedblog.com/blog/2019/12/cpu-throttling-regression-fix/) (Indeed Engineering, December 2019): the throttling regression, start to finish.
- [sched/fair: Fix low cpu usage with high throttling by removing expiration of cpu-local slices](https://android-kvm.googlesource.com/linux/+/de53fd7aedb100f03e5d2231cfce0e4993282425): the kernel commit.
- [Container-aware GOMAXPROCS](https://go.dev/blog/container-aware-gomaxprocs) (Go blog, August 2025): how Go 1.25 reads the CPU limit, and why it ignores the request.
