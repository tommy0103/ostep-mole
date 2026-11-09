---
deck: Chapter 10's choice between one queue and many is made again inside Go, Tokio and the JVM, and they all settle it the same way. An idle worker takes work from a busy one.
---

::scene overview

In May 2012 Dmitry Vyukov wrote a design document for the Go runtime titled *Scalable Go Scheduler Design Doc*. The first problem it listed with the existing scheduler was a single global [[lock|mutex]] protecting centralized state. Every [[goroutine|goroutine]] that became runnable, and every thread looking for something to run, went through that one lock. Chapter 10 has a name for this design: **single-queue multiprocessor scheduling**, SQMS. It also has a prediction for it: it is simple, it balances load perfectly, and it stops scaling as cores are added.

Vyukov's fix was the one chapter 10 offers next. Give each processor its own queue, and when a queue runs dry, let its owner **steal** from another. The new scheduler shipped in Go 1.1 in 2013. The same design, with small variations, now schedules tasks in Rust's [[tokio|Tokio]], Java's [[forkjoinpool|ForkJoinPool]] and the [[virtual-thread|virtual threads]] built on it, and it descends from the [[cilk|Cilk]] research language of the 1990s, which the book cites as [FLR98].

## Two schedulers, stacked

::scene layers

A goroutine, a Tokio task or a Java virtual thread is not an operating-system [[thread|thread]]. It is a much smaller object, a few kilobytes of stack or a state machine, that the runtime multiplexes onto a handful of real threads. Creating one is cheap and switching between them never enters the kernel, so a server can afford one per connection.

So two schedulers are at work, one above the other:

- The **kernel** schedules threads onto cores, using everything in chapters 7 to 10.
- The **runtime** schedules tasks onto those threads, using a scheduler written in Go, Rust or Java.

The runtime's scheduler faces chapter 10's problem in miniature: *P* threads, a stream of tasks of unknown length, and caches that reward keeping a task where it ran. Every runtime below lands on the same answer.

## The book's version

::chapter cpu-sched-multi

::scene sqms

Chapter 10 sets out the trade-off. SQMS is easy to build and balances load by construction, but every scheduling decision takes the global lock, and jobs bounce from CPU to CPU, losing **cache affinity**. **Multi-queue scheduling** (MQMS) gives each CPU its own queue. It scales, and jobs stay where their caches are warm. But queues drift out of balance, and in the worst case a CPU sits idle while another has a backlog.

::scene steal

The fix is **migration**, and the technique the chapter describes is **work stealing**: a queue that is low on work peeks at another queue and, if that one is notably fuller, takes some of its jobs. The chapter ends on the tension in that rule. Look too often and you pay the overhead you built multiple queues to avoid. Look too rarely and you suffer imbalance. Finding the threshold, it says, “remains... a black art.”

Runtimes resolve that tension with one decision: **only look when you are idle.** A busy worker never pays for balancing. Only a worker with nothing else to do goes looking, and its time was going to waste anyway.

## Go: G, M and P

::scene gmp

The Go runtime uses three letters.

- **G** is a goroutine: a stack, an instruction pointer and some bookkeeping.
- **M** is a machine, an OS thread.
- **P** is a processor, a scheduling context. There are exactly [[gomaxprocs|`GOMAXPROCS`]] of them. An M must hold a P to run Go code.

Each P owns a **local run queue**: a [[ring-buffer|ring buffer]] of 256 goroutine slots, plus a single `runnext` slot. The owner adds at the tail without a lock, other Ps take from the head with [[atomic-cas|atomic operations]]. There is also one **global run queue**, protected by a lock, which takes overflow and goroutines that have no obvious home.

::scene find

When an M needs work, it runs `findRunnable()`. Leaving out timers, [[garbage-collection|garbage-collection]] workers and tracing, the order is:

1. Every 61st scheduling tick, take one goroutine from the global queue first. Without this, two goroutines that keep waking each other could occupy a local queue forever while the global queue starved.
2. Take from the local queue, `runnext` first.
3. Take a batch from the global queue, up to half a local queue's worth.
4. Poll the network without blocking, and run any goroutine whose [[socket|socket]] is ready.
5. **Steal.** Visit the other Ps in a random order, up to four rounds, and take **half** of the first non-empty queue found. Only in the last round may a thief also take a victim's `runnext` goroutine.
6. Finding nothing, give up the P and park the thread.

::scene overflow

Local queues overflow too. When a goroutine is added to a full local queue, the runtime moves half of the queue, plus the new goroutine, to the global queue. Work spreads in both directions: pulled by idle Ps, pushed out by overloaded ones.

:::fold What the scheduler loop looks like
Here is the core of `findRunnable()` from `src/runtime/proc.go`, reduced to its shape. This is pseudo-code; the real function also handles timers, GC work, tracing, locked threads and races with threads that are going to sleep.

```go
// pseudo-code, simplified from src/runtime/proc.go
func findRunnable(pp *p) *g {
	if pp.schedtick%61 == 0 && !globalQueue.empty() {
		if gp := globalQueue.get(); gp != nil { // fairness for the global queue
			return gp
		}
	}
	if gp := pp.runqget(); gp != nil { // runnext, then the local ring
		return gp
	}
	if gp := globalQueue.getBatch(len(pp.runq) / 2); gp != nil {
		return gp // the rest of the batch goes to pp's local queue
	}
	if gp := netpoll(nonBlocking); gp != nil {
		return gp
	}
	if 2*spinningMs < busyPs { // at most half as many thieves as busy Ps
		for try := 0; try < 4; try++ {
			for _, victim := range allPsInRandomOrder() {
				if gp := steal(pp, victim, try == 3); gp != nil {
					return gp // took half of victim's queue
				}
			}
		}
	}
	return stopAndPark(pp)
}
```

The steal itself is `runqgrab`, which reads the victim's head and tail and takes `n - n/2` of the `n` goroutines it finds, that is half rounded up. Because the victim may be adding goroutines at the same moment, the thief copies them first and then claims them with a single compare-and-swap on the victim's head. If someone else got there first, it retries.

Idle threads are kept from stampeding. A thread looking for work is *spinning*, and at most half as many threads spin as there are busy Ps. New work wakes a thread only if a P is idle and nobody is spinning already, and the last spinning thread to find work wakes a replacement. Work fans out one thread at a time.
:::

### Why take half?

::scene half

Chapter 10's sketch moves one job at a time. Go and Tokio take half, for two reasons.

The first is balance in one step. If P~1~ has 40 goroutines and P~2~ has none, taking one leaves 39 and 1. P~2~ will be back almost at once, paying for another round of locking and cache misses. Taking 20 leaves the two even.

The second is that stolen work spreads further. A third idle P finds two non-empty queues to steal from instead of one. Starting from one busy queue, the number of queues holding work roughly doubles with each round of stealing.

### The parts the OS used to do

::scene os

A user-level scheduler inherits the problems chapter 6 solved for the kernel, and it has none of the kernel's privileges.

- **Blocking system calls.** A goroutine blocked in a system call blocks its M. If the call takes long, a monitor thread, `sysmon`, hands the P to another M so the other goroutines keep running.
- **Network I/O.** Goroutines waiting on sockets are parked without blocking a thread. The runtime's **netpoller**, [[epoll|epoll]] on Linux, wakes them when data arrives (step 4 above).
- **Preemption.** Before Go 1.14, goroutines were preempted only at function calls, so a tight loop could hold a P indefinitely. Since Go 1.14, `sysmon` [[signal|signals]] (`SIGURG`) the thread of any goroutine that has run for more than 10 ms, and the handler makes the goroutine look as if it had called the scheduler. This is the timer interrupt of [limited direct execution](/virtualization/cpu-mechanisms), rebuilt at user level from signals. The [LDE note](/notes/lde-everywhere) follows that pattern further up the stack.

## Tokio: the same design, tuned for async

::scene tokio

Carl Lerche's 2019 rewrite of Tokio's multi-threaded scheduler credits Go's scheduler as an influence, and the shape is familiar.

- Each worker thread has a fixed-size local queue of **256** tasks: a ring buffer, pushed only by its owner and stolen from by others.
- A shared **global queue** takes overflow (half the local queue moves there when it fills) and tasks woken from threads that are not workers.
- An idle worker **steals half** of a randomly chosen sibling's queue.
- At most **half the workers** may be searching for work at once, and a worker that finds work wakes one more, as in Go.

The differences come from async Rust's typical workload, which is mostly message passing between tasks. When task A sends to task B, B is likely to run next, and the message is still in the cache. Tokio puts the woken task in a **LIFO slot** that is checked before the queue, like Go's `runnext`, and that thieves cannot take. To stop two tasks ping-ponging through it forever, the slot is disabled after three consecutive uses. For fairness the global queue is checked regularly; current Tokio tunes the interval to aim at roughly 10 ms between checks.

Tokio cannot preempt a task at all, because a Rust [[rust-future|future]] only gives up the thread at an `.await` that returns “not ready”. A task whose socket always has data never reaches one. Since Tokio 0.2.14 (2020), each task gets a **budget** of 128 operations per scheduling turn. Once it is spent, Tokio's own resources pretend to be not ready, and the task yields. Work that really blocks belongs on a separate thread pool via `spawn_blocking`, Tokio's version of Go handing off a P.

The 2019 rewrite reports what this buys: a [[hyper|Hyper]] “hello world” server went from about 113,900 to about 152,300 requests per second, roughly 34% more, and a micro-benchmark that spawns chains of tasks ran about 12 times faster.

## Java: the deque

::scene deque

Java's version came from Doug Lea, whose 2000 paper *A Java Fork/Join Framework* describes its design as “a variant of the work-stealing framework devised for Cilk.” It became `ForkJoinPool` in Java 7.

Each worker owns a **deque**, a double-ended queue. The owner pushes and pops tasks at one end, the top. Thieves take from the other end, the base. In the default mode the owner therefore works **LIFO**: it always runs the task it forked most recently. Thieves work **FIFO**: they take the oldest task.

That asymmetry is the most important idea in work stealing, and it follows from the shape of [[fork-join|fork/join programs]]. A recursive divide-and-conquer task forks two halves, then forks halves of those, and so on. The newest task in a deque is the smallest piece, and its data is still in the owner's cache. The oldest task is the biggest piece, near the root of the recursion, and stealing it hands the thief a large amount of work in a single steal. The owner keeps locality, and the thief takes the task that will keep it busy longest. The design notes in the source cite the [[chase-lev|Chase–Lev deque]] (SPAA 2005).

The same pool now runs most parallel Java. `ForkJoinPool.commonPool()` (Java 8) executes [[parallel-stream|parallel streams]]. With `asyncMode` set, workers process their own queues FIFO, for event-style tasks that are never joined. [[jep|JEP 444]], which finalized virtual threads in JDK 21, describes their scheduler as “a work-stealing ForkJoinPool that operates in FIFO mode.” Note one difference from Go and Tokio: a `ForkJoinPool` thief takes one task per steal, not half the queue. With divide-and-conquer tasks that one task is often half the remaining work anyway.

## Why stealing works: Cilk

::scene cilk

The theory behind all this comes from MIT's Cilk project. Robert Blumofe and Charles Leiserson analysed a scheduler in which each processor works on its own queue, and a processor that runs out of work picks a victim **uniformly at random** and steals from it (FOCS 1994; *Journal of the ACM*, 1999). The 1995 paper on the Cilk runtime spells out the rule: a thief “steals the shallowest ready thread in the victim's spawn tree”, the oldest one, for the same reason as Java's base.

Describe a parallel computation by two numbers: its **work** *T*~1~, the total time it would take on one processor, and its **span** *T*~∞~, the length of its longest chain of dependent steps. No schedule on *P* processors can beat *T*~1~/*P*, and none can beat *T*~∞~. For well-structured (“fully strict”) programs, the randomized work stealer runs in expected time

> T~P~ = T~1~ / P + O(T~∞~)

which is within a constant factor of optimal, and uses at most *P* times the memory of a serial run. Communication is bounded too, in terms of the span rather than the work.

:::fold Work and span, with numbers
Take a parallel merge sort with *T*~1~ = 1 s of total work and a span of *T*~∞~ = 1 ms. The span is the longest chain of steps that must run one after another.

On *P* = 8 processors the bound says the run takes about 1 s / 8 = 125 ms, plus a term proportional to 1 ms. Since no schedule can do better than 125 ms, work stealing is close to perfect here. With 1,000 processors, *T*~1~/*P* falls to 1 ms, the same as the span, and adding processors stops helping. The ratio *T*~1~/*T*~∞~, the program's *parallelism*, tells you how many processors it can use.

The argument for the span term goes roughly like this. At any moment each processor is either working, which pays down *T*~1~, or trying to steal. Because victims are chosen at random and thieves take the oldest task, each round of about *P* steal attempts has a constant probability of making progress on the critical path. So the expected number of steal attempts is O(*P* · *T*~∞~), and since each costs constant time, failed steals add O(*T*~∞~) to the running time once you divide by *P*. Steals scale with the span, not with the total work. A program with plenty of parallel slack therefore rarely steals at all, which is exactly what you want from a multi-queue scheduler: queues that almost always stay private.

Go and Tokio tasks are not fork/join trees and they block on I/O, so the theorem does not cover them. Its intuition, that random victims and idle-only stealing keep overhead proportional to the imbalance, has held up well in practice.
:::

## Try it

The lab below is chapter 10's comparison: one shared queue, one queue per CPU, and per-CPU queues with stealing.

::lab Multicore

Things to try:

- Set 2 CPUs, pick **equal jobs** and **SQMS**. Five jobs share one queue, so load is balanced, but there are 40 migrations, each one a hatched cold-cache start, and the cache refills cost so much that everything finishes last, at 224.
- Switch to **MQMS**. Migrations drop to zero. But five jobs do not divide evenly between two queues: CPU 1 finishes its two jobs and then sits idle for 60 time units while CPU 0 works through its three. Everything is done at 180.
- Switch to **MQMS+steal**. When CPU 1 runs dry, it takes one waiting job from CPU 0. One migration cuts idle time from 60 to 17 and the finish time to 160, better than either of the pure designs.
- Try **some finish early** too. The short jobs leave holes, and stealing fills them the same way.

The lab is simplified. Its thief takes one job from the busiest queue, and only if that queue has more than one job waiting. Finding the busiest queue needs global knowledge of all the queue lengths. Go and Tokio pick a random victim and take half, which needs no global knowledge at all.

## Where it bends

::scene bends

Work stealing is simple to state. The engineering lives in the places where it meets the rest of the system.

- **Locality versus fairness.** The `runnext` and LIFO slots give the most recent task priority because its data is hot. That can starve older tasks, so both runtimes add fairness checks: the global queue every 61 ticks in Go, a cap of three LIFO-slot runs in a row and a cooperative budget in Tokio. It is the same tension as MLFQ's priority boost in chapter 8.
- **Spinning costs CPU.** A thread hunting for work is burning cycles. Runtimes limit the number of thieves to half the busy workers. Inside a [[container|container]] with a CPU limit, those spinning cycles also come out of the quota (see [the Kubernetes note](/notes/k8s-shares)).
- **Two layers that cannot see each other.** The kernel moves threads between cores and the runtime moves tasks between threads, each without knowing what the other does. When the runtime thinks it has `GOMAXPROCS` = 64 Ps but the container may only use two CPUs' worth of time, the result is the throttling pattern that the Kubernetes note describes. That is why Go 1.25 sets `GOMAXPROCS` from the [[cgroup|cgroup]] limit.
- **The kernel steals too.** Linux keeps a run queue per CPU, as chapter 10 describes for CFS. When a CPU is about to go idle, the scheduler tries a “new idle” balance first: it looks for a busier CPU nearby and pulls tasks over. That is work stealing in the kernel. Its periodic [[load-balancing|balancing]] pushes as well as pulls.

## The thread back to the book

::scene overview

Chapter 10 asks how a multi-queue scheduler should handle load imbalance, and leaves the threshold to a black art. The runtimes in this piece are four answers to that question, and they agree on almost everything:

1. Keep queues private, so the common case takes no shared lock and keeps caches warm.
2. Balance only when idle, so busy workers never pay for it.
3. Choose victims at random, so no global state is needed.
4. Take the oldest work, or half the queue, so each steal is worth its cost.

Wherever there are several workers, many independent tasks and a cache that rewards staying put, the same decision comes up, and work stealing is how the multiple-queue side handles imbalance. Your Go program is running two copies of chapter 10, one inside the other.

## Further reading

- Dmitry Vyukov, [Scalable Go Scheduler Design Doc](https://docs.google.com/document/d/1TTj4T2JO42uD5ID9e89oa0sLKhJYD0Y_kqxDv3I3XMw/mobilebasic) (2012): the problems with the old scheduler and the design of Ps.
- [`src/runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go): Go's scheduler, with a long design comment at the top. `findRunnable`, `stealWork` and `runqgrab` are the functions discussed here.
- [Go 1.14 Release Notes](https://go.dev/doc/go1.14): asynchronous preemption.
- Carl Lerche, [Making the Tokio scheduler 10x faster](https://tokio.rs/blog/2019-10-scheduler) (2019), and [Reducing tail latencies with automatic cooperative task yielding](https://tokio.rs/blog/2020-04-preemption) (2020).
- [tokio::runtime](https://docs.rs/tokio/latest/tokio/runtime/index.html): the current documentation of the multi-threaded scheduler's queues, LIFO slot and stealing.
- Doug Lea, [A Java Fork/Join Framework](https://gee.cs.oswego.edu/dl/papers/fj.pdf) (2000), and the [`ForkJoinPool` API documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ForkJoinPool.html).
- [JEP 444: Virtual Threads](https://openjdk.org/jeps/444): the virtual thread scheduler is a FIFO-mode ForkJoinPool.
- Robert D. Blumofe et al., [Cilk: An Efficient Multithreaded Runtime System](https://people.cs.umass.edu/~emery/classes/cmpsci691s-fall2004/papers/blumofe95cilk.pdf) (PPoPP 1995): random victims, shallowest steals, and the space, time and communication bounds.
- Robert D. Blumofe, Charles E. Leiserson: *Scheduling Multithreaded Computations by Work Stealing*, Journal of the ACM 46(5), 1999: the T~1~/P + O(T~∞~) result.
