---
deck: SJF and OPT need the future, so real systems use the past. MLFQ, a TCP retransmission timer, a branch predictor and a readahead window all make the same bet, and all of them need a way to forget.
title: Approximating an oracle with history
---

::scene overview

Every [[tcp|TCP connection]] on your machine runs a small prediction loop. Each time an [[ack|acknowledgement]] comes back, the sender measures how long the [[rtt|round trip]] took and folds that sample into a running estimate, giving it one eighth of the weight. From the estimate it sets a timer. If the timer fires before the next acknowledgement arrives, TCP decides that its model of the network is wrong. It doubles the timer, and it cuts its [[congestion-window|sending window]] to a single [[tcp-segment|segment]], throwing away most of what it had learned about how much the path can carry.

That loop is the whole idea of this note: summarise the recent past, use it to predict the near future, and reset when the prediction fails. Chapter 8 introduces it with MLFQ, and the book's aside names two more homes for it, [[branch-predictor|branch predictors]] and caching algorithms, with a warning that such techniques "can easily be wrong". This piece follows the idea through those systems and a few others.

::scene oracle

## The oracle problem

::chapter cpu-sched-mlfq

Chapter 7 ends with a section called *No More Oracle*. SJF and STCF give the best average turnaround time, but only if the scheduler knows how long each job will run, and a general-purpose OS does not. Chapter 22 meets the same wall in memory. [[opt-policy|Belady's optimal policy]] evicts the [[page|page]] used furthest in the future, which again requires knowing the future.

The answer in both chapters is to use the past as a stand-in: MLFQ watches how a job has behaved, [[lru|LRU]] which pages were used recently. Both work when workloads have *phases*, stretches in which the last few milliseconds say something about the next few.

::scene parts

Every history-based predictor in this piece has three parts:

- **A summary of the past.** Small and cheap to update: a queue level, one averaged number, a two-bit counter, a window size.
- **An update rule.** How each observation changes the summary, and how much weight old ones keep.
- **A way to forget.** A reset, a decay or a cap, for when the summary is stale, the workload has changed phase, or someone is gaming the rule.

The third part is where most of the engineering ends up.

::scene mlfq

## MLFQ as a predictor

In MLFQ the summary is a job's queue level and the allotment it has used there. The update rule is Rule 4: use up the allotment and you move down. A job's level is a running prediction of how CPU-hungry it will be, starting optimistic (Rule 3).

Rule 5, the priority boost, is the way to forget. Every period S, all predictions are thrown away. Without it, a job that has turned interactive stays at the bottom because its history no longer describes it, and a crowd of interactive jobs can starve a long one forever.

The final form of Rule 4 guards the predictor against an adversary: charging the allotment however a job slices its CPU use stops a CPU hog from looking interactive by yielding just before its slice ends.

In the lab, try these:

- Choose *+ short job*. B is predicted short and finishes before sinking far: when the prediction is right, MLFQ behaves like SJF.
- Choose *Starvation* with the boost at *never*, then 50 ms. Without forgetting, A's old label keeps it at the bottom.
- Choose *Gaming* and tick *better accounting*, which turns a summary that can be gamed into one that cannot.

::lab Mlfq

::scene ewma

## One number that remembers: exponential averaging

MLFQ's summary is a handful of levels. The other classical way to approximate SJF keeps one number per process and predicts its next [[cpu-burst|CPU burst]] directly, as an **exponential average**:

> τ~n+1~ = α · t~n~ + (1 − α) · τ~n~

Here t~n~ is the length of the burst that just ended, τ~n~ was the prediction for it, and α between 0 and 1 sets how much the newest sample counts. With α = 1/2, the classic textbook example starts from a guess of 10 and sees bursts of 6, 4, 6, 4 and then 13 for a while:

| Burst n | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Actual burst t~n~ | 6 | 4 | 6 | 4 | 13 | 13 | 13 |
| Prediction τ~n~ | 10 | 8 | 6 | 6 | 5 | 9 | 11 |

When the process changes phase to 13-unit bursts, the prediction is wrong by 8 and then chases the new value, halving its error each step: 9, 11, 12. That chase is the predictor forgetting. Nobody resets it; old samples simply lose weight geometrically.

It costs one stored number and one multiply-add per update, which is why it turns up throughout real kernels:

- **The traditional BSD scheduler**, the [[decay-usage|decay-usage]] design the book cites and still in FreeBSD as `sched_4bsd`, keeps an estimate of recent CPU use per process and multiplies it once per second by (2 · [[load-average|load]]) / (2 · load + 1). The goal, per the source comment, is to forget 90% of it in 5 × loadavg seconds, so it remembers longer under load.
- **Linux's [[pelt|per-entity load tracking]]** (PELT, merged in 3.8) treats time as periods of 1,024 µs. Each period it multiplies the accumulated load by y, where y^32^ = 0.5, so load from 32 ms ago weighs half as much as load now.
- **Linux's `util_est`** keeps, per task, an exponential average of its utilization at the end of each activation, with weight 1/4 for the new sample. It feeds [[dvfs|CPU frequency selection]] and task placement, and has one twist, described below.

:::fold The arithmetic of forgetting
Expand the recurrence and the weights appear. The prediction is a weighted sum of all past bursts:

τ~n+1~ = α t~n~ + α(1 − α) t~n−1~ + α(1 − α)^2^ t~n−2~ + … + (1 − α)^n+1^ τ~0~

A sample k steps old carries weight α(1 − α)^k^. It never vanishes, so the useful measure is a **half-life**, the number of updates after which a sample counts half as much as a new one: ln 2 / ln(1 / (1 − α)). For α = 1/2 that is one update; for `util_est`'s 1/4, about 2.4; for TCP's 1/8, about 5.2.

The BSD numbers check out the same way. At load 1 the factor is 2/3 per second, and keeping only 10% needs n = ln 10 / ln 1.5 ≈ 5.68 seconds, the value tabulated in the FreeBSD source comment. At load 2 it is about 10.3 seconds. PELT's factor is y = 0.5^1/32^ ≈ 0.9786.

`util_est` makes the update asymmetric. The kernel comment says the EWMA is reset on utilization increases, and the moving average is used only to smooth decreases. In simplified pseudo-code:

```c
/* pseudo-code, simplified from util_est_update() in kernel/sched/fair.c (6.12) */
void util_est_update(struct task *p, unsigned long dequeued /* util of the activation just ended */)
{
    unsigned long ewma = p->util_est;

    if (dequeued >= ewma) {              /* task got bigger: believe it at once */
        p->util_est = dequeued;
        return;
    }
    if (ewma - dequeued < UTIL_EST_MARGIN)
        return;                          /* within about 1%: not worth a write */
    p->util_est = ewma - (ewma - dequeued) / 4;   /* = 3/4 * ewma + 1/4 * dequeued */
}
```

The reason is the cost of being wrong. If a task grows and the estimate lags, the CPU is clocked too low and the task stutters. If it shrinks and the estimate lags, the CPU runs a little fast for a few activations and wastes some energy. So the predictor forgets instantly in one direction and slowly in the other.
:::

::scene rto

## TCP: a timer that learns, and a window that resets

TCP has to guess two things about a path it cannot see: how long a round trip takes, and how much data the path can hold in flight.

The round-trip guess drives the **retransmission timeout** (RTO). [[rfc|RFC 6298]] specifies the predictor exactly. The sender keeps a smoothed round-trip time, SRTT, and a smoothed mean deviation, RTTVAR. For each sample it updates RTTVAR with weight β = 1/4 and SRTT with weight α = 1/8, and sets RTO = SRTT + max(G, 4 · RTTVAR), where G is the clock granularity. The RFC says the result should be rounded up to at least 1 second; Linux uses a 200 ms floor by default (`tcp_rto_min_us`). The variance term is what makes this a predictor rather than an average: a jittery path gets a timer well above its mean, so a slow but not lost packet does not trigger a needless retransmission.

Two rules deal with being wrong. **Karn's algorithm**, mandatory in RFC 6298, says not to take RTT samples from retransmitted segments: when a segment was sent twice, there is no telling which copy an acknowledgement answers, so the sample would be poison. And when the timer fires, the sender must **back off**, doubling the RTO on each expiry. A prediction that has just failed is not trusted to set the next timer.

:::fold One RTO update, by hand
Suppose a connection has settled at SRTT = 100 ms and RTTVAR = 10 ms, so its RTO is 100 + 4 × 10 = 140 ms (Linux would raise that to its 200 ms floor). A sample of R = 180 ms arrives, perhaps because a queue is building on the path. RFC 6298 updates RTTVAR first, using the old SRTT:

RTTVAR = (3/4) × 10 + (1/4) × |100 − 180| = 7.5 + 20 = 27.5 ms

SRTT = (7/8) × 100 + (1/8) × 180 = 87.5 + 22.5 = 110 ms

RTO = 110 + 4 × 27.5 = 220 ms

The mean moved by 10 ms; the timeout moved by 80 ms, because one surprising sample nearly tripled the deviation and the deviation counts four times. Like `util_est`, the timer reacts to bad news much faster than to drift, because a timer that fires too early resends data that was not lost onto a path that may already be congested.
:::

::scene cwnd

The capacity guess is the **congestion window**. Under RFC 5681 it grows by about one segment per round trip while all goes well and is roughly halved on a loss detected by duplicate acknowledgements: a slow-moving estimate of capacity, learned from the absence of loss. A retransmission timeout is taken as evidence that the model is badly wrong. The window drops to the *loss window* of one full-sized segment and [[slow-start|slow start]] begins again.

TCP also forgets on a schedule. Section 4.1 of RFC 5681 says that a connection idle for longer than the RTO should cut its window to no more than the initial window before sending again, because the [[ack-clock|ACK clock]] has stopped and the network may have changed. Linux does this by default (`tcp_slow_start_after_idle`). A persistent HTTP connection that pauses between page loads restarts cautiously because its history is considered stale.

::scene bbr

[[bbr|BBR]] makes the forgetting explicit. Its model is two filtered measurements: a windowed maximum of recent delivery rates, and a windowed minimum of RTT samples over the last 10 seconds. An RTT sample shows the true propagation delay only when no queue has built up, and a busy sender keeps a queue. So when the minimum has not been refreshed for a while, BBR enters *ProbeRTT*, cuts the data in flight for at least 200 ms so the queue drains, and measures afresh. That is Rule 5 on a timer.

::scene branch

## Branch predictors: history in silicon

A [[pipeline|pipelined]] CPU fetches instructions long before it knows which way a conditional branch goes, so it guesses, and a wrong guess throws away the work fetched down the wrong path. This is history-based prediction under the tightest constraints in the piece: a decision every few instructions and a few bits of state per branch.

The classic building block, studied by James E. Smith in 1981, is the **two-bit saturating counter**. It counts from 0 to 3, up when the branch is taken and down when it is not, and predicts "taken" in states 2 and 3. The second bit buys **hysteresis**. Take a loop of ten iterations that runs again and again. A one-bit predictor mispredicts twice per run, at the exit and again at the next entry, because the exit flipped it. A two-bit counter is only weakened by the exit and still predicts the next entry, so it mispredicts once.

Later predictors enlarge the summary. Scott McFarling's gshare indexes its counters with the branch address XORed with the outcomes of the last several branches, so one branch can learn different behaviour in different contexts. TAGE, from André Seznec and Pierre Michaud in 2006, keeps several tables indexed by histories of geometrically increasing length and trusts the longest one that matches. Each entry has a *useful* counter that guards it against replacement, and those counters are periodically reset so that, in one survey's words, entries are not marked useful forever. Even a predictor built from gates needs Rule 5.

:::fold Gaming the predictor: Spectre variant 2
::scene spectre

MLFQ's gaming problem has a hardware twin. A branch predictor is shared state: it learns from whatever code ran on the core recently, mostly without recording whose code it was.

In [[spectre|Spectre variant 2]], *branch target injection*, an attacker trains the predictor for [[indirect-branch|indirect branches]] on purpose. The Linux kernel documentation describes it as poisoning the [[btb|branch target buffer]], so that the victim's indirect branch speculatively jumps to code the attacker chose. The speculative work is discarded, but its traces in the [[cpu-cache|caches]] can leak data. It is chapter 8's gaming threat, feeding a history-based predictor misleading history, aimed at secrets instead of CPU share.

One mitigation is a reset. On x86, the **Indirect Branch Prediction Barrier** (IBPB) clears the branch target buffer so that predictions learned in one context cannot steer another, and Linux issues it on context switches according to the policy chosen at boot. Like better accounting in MLFQ, the aim is to stop one party's history from deciding another party's treatment.
:::

::scene arc

## Caches and prefetchers

Chapter 22 is the memory version of the story. LRU predicts that a page used recently will be used again soon, and the [note on approximate LRU](/notes/approx-lru) covers how real systems approximate even that cheaply. Two more examples finish the picture.

**Frequency needs forgetting even more than recency does.** Without aging, an [[lfu|LFU]] cache keeps a page that was popular an hour ago forever, which is starvation in reverse, so practical LFU variants decay their counts. ARC, from Nimrod Megiddo and Dharmendra Modha at FAST 2003, goes further. It keeps one list for pages seen once recently and one for pages seen more than once, and also remembers which pages it recently evicted from each. A miss on a page it just threw away is evidence that its split between the lists is wrong, and it shifts space accordingly. The paper calls this a learning rule that continually revises its assumptions about the workload. A one-time sequential scan passes through without flushing the cache.

::scene readahead

**Prefetching is prediction with a budget.** Linux's readahead watches each open file for sequential access. A first read sets an initial window of two or four times the request size, rounded to a power of two and capped at the maximum, commonly 128 KB. Each time the pattern holds, the next window is scaled up, usually doubled. A small, standalone random read is served as is and, in the source's words, does not pollute the readahead state. When a sequential stream misses and restarts, the window starts again from its initial size. The window is the prediction, and the restart is the reset.

::scene arc

The lab below is chapter 22's replacement simulator. Choose *80-20*, where most references go to a few pages: history pays off and LRU comes close to OPT. Then choose *Looping*, six pages cycled through five frames. LRU misses every time and RANDOM does better, because the recent past is a perfect predictor of the wrong thing. That is the case ARC's extra lists exist to detect.

::lab Replacement

::scene fails

## When the bet fails

History-based prediction fails in three recurring ways, and the systems above have grown a defence against each:

1. **The workload changes phase.** Defences: decay (exponential averages, PELT), periodic resets (MLFQ's boost, TAGE, ProbeRTT), and fast reaction in the costly direction (`util_est`, TCP's variance term).
2. **Someone games the rule.** Defences: accounting that cannot be dodged (MLFQ's Rule 4), refusing ambiguous samples (Karn's algorithm), and flushing shared history (IBPB).
3. **The history is stale.** Defences: explicit expiry, such as TCP's restart after idle, or ULE's five-second cap on remembered sleep and run time in the [real schedulers note](/notes/real-schedulers).

The whole pattern fits in one table:

| System | Summary of the past | Update rule | How it forgets |
|---|---|---|---|
| MLFQ | Queue level, allotment used | Demote when allotment is used up | Priority boost every S |
| BSD scheduler (`sched_4bsd`) | Decayed CPU usage | Multiply by (2 · load) / (2 · load + 1) each second | Decay itself |
| Linux `util_est` | EWMA of utilization | Weight 1/4 on decreases | Instant reset on increases |
| TCP RTO | SRTT and RTTVAR | Weights 1/8 and 1/4 | Backoff on timeout; Karn's rule |
| TCP congestion window | cwnd | Grow per RTT, roughly halve on loss | One segment after timeout; restart after idle |
| BBR | Max bandwidth, min RTT | Windowed filters | ProbeRTT refresh |
| Two-bit counter | State 0 to 3 | Up if taken, down if not | Saturation bounds memory |
| TAGE | Tagged tables, useful counters | Longest matching history wins | Periodic useful-counter reset |
| ARC | Two lists plus evicted-page history | Shift space towards the list whose evictions were wrong | Lists are bounded |
| Linux readahead | Window size per file | Scale up while sequential | Restart from initial window |

## The thread back to the book

Chapter 7 states the problem: the best policies need an oracle. Chapter 8 answers it for the CPU with MLFQ and adds the boost because the answer goes stale. The [EEVDF note](/notes/eevdf) from chapter 9 shows a scheduler that partly *refuses* to predict, asking each task for a slice length instead. Chapter 22 repeats the oracle problem for memory, where LRU's prediction fails on loops.

::scene advice

The alternative to predicting is asking, which is the book's aside on *advice*: `nice`, [[madvise|`madvise`]], informed prefetching. Apple's [[thread-qos|QoS classes]], EEVDF's slice requests and [[fadvise|`posix_fadvise`]] all take that route. Real systems end up doing both. They ask when the program knows, guess from history when it does not, and keep a reset ready for when the guess goes wrong. For LLM serving, where predicting how many [[llm-token|tokens]] a request will produce is the new burst-length problem, see [the convoy effect in LLM serving](/notes/llm-convoy).

## Further reading

- [RFC 6298: Computing TCP's Retransmission Timer](https://datatracker.ietf.org/doc/html/rfc6298), Paxson, Allman, Chu and Sargent, 2011.
- [RFC 5681: TCP Congestion Control](https://datatracker.ietf.org/doc/html/rfc5681), 2009: the loss window and restarting idle connections.
- [BBR Congestion Control](https://datatracker.ietf.org/doc/html/draft-ietf-ccwg-bbr), IETF draft.
- [Per-entity load tracking](https://lwn.net/Articles/531853/), LWN, January 2013.
- [sched_4bsd.c](https://github.com/freebsd/freebsd-src/blob/main/sys/kern/sched_4bsd.c), FreeBSD source: the decay comment and its table.
- [ARC: A Self-Tuning, Low Overhead Replacement Cache](https://www.usenix.org/conference/fast-03/arc-self-tuning-low-overhead-replacement-cache), Megiddo and Modha, FAST 2003.
- [A Survey of Techniques for Dynamic Branch Prediction](https://arxiv.org/abs/1804.00261), Sparsh Mittal, 2018.
- [Spectre side channels](https://docs.kernel.org/admin-guide/hw-vuln/spectre.html), Linux kernel documentation.
- [mm/readahead.c](https://github.com/torvalds/linux/blob/master/mm/readahead.c), Linux source.
