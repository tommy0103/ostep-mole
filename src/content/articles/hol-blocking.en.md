---
deck: From a 1979 database lock to HTTP/3 and switch fabrics, the same thing keeps happening. Whenever unrelated work shares one FIFO, the short jobs pay for the long ones, and the fixes are always the same few moves.
title: Head-of-line blocking is the convoy effect, everywhere
---

::scene overview

The book's name for this chapter's villain comes from a database. In 1979, Mike Blasgen, Jim Gray, Michael Mitoma and Thomas Price at IBM San Jose described what they called *the convoy phenomenon* in System R, IBM's research relational database. This is the paper chapter 7 cites as [B+79]. A process holding a busy [[lock|lock]], the one protecting the [[buffer-pool|buffer pool]] or the log, would occasionally stop: a [[page-fault|page fault]], an I/O, the end of its time slice. Every other process soon needed the same lock and queued behind it. When the holder came back and released the lock, it ran a little and asked for the lock again, and by then the whole convoy was ahead of it. The queue became stable. New processes were, in the paper's words, "sucked into the convoy".

The fix that worked was not a faster lock. It was to stop granting the lock in first-come, first-served order. The authors put it plainly: the key issue of convoys is the granting of locks in FIFO order.

That sentence explains a surprising amount of modern systems work. Web protocols, network switches and storage stacks have all rediscovered it, usually under the name **head-of-line blocking**. This piece follows the idea through four of them and shows that each fix is one of a small number of moves you already know from the scheduling chapters.

::scene shape

## The shape of the problem

::chapter cpu-sched

Chapter 7 gives the cleanest version. Three jobs arrive together: A needs 100 seconds and B and C need 10 each. FIFO runs A first, and the average turnaround time is (100 + 110 + 120) / 3 = 110 seconds. SJF runs the short ones first and the average drops to 50. Nobody ran any faster. The only thing that changed was who was allowed to wait behind whom.

Head-of-line blocking is the same picture with one twist: the job at the head may not be long, just *stuck*. A lock holder waiting for a disk, a packet waiting for a retransmission, a frame waiting for a busy output port. The work behind it is often ready to go, and often has nothing to do with the stuck item. It waits anyway, because the queue promised an order.

Two conditions are enough to produce it:

- **One queue, strict order.** Items leave in the order they arrived, or in some other order the queue has promised.
- **Unequal or unpredictable service.** Some items take much longer than others, or can stall for reasons that have nothing to do with the items behind them.

Remove either condition and the convoy dissolves. Every fix below removes one of the two.

The lab below is chapter 7's scheduler. Load the *Convoy* preset: one 100-unit job in front of two 10-unit jobs. Run FIFO, then SJF, then RR with a time slice of 1, and watch the average turnaround and response time change. Keep the three answers in mind; protocols have reached for each of them.

::lab Scheduler

::scene http1

## HTTP/1.1: one connection, one queue

An [[http|HTTP/1.1]] connection carries one request and one response at a time. To avoid waiting a full [[round-trip|round trip]] between requests, HTTP/1.1 allowed **pipelining**: the client sends several requests back to back without waiting. The catch is in the specification. [[rfc|RFC 9112]] says a server that receives pipelined requests "MUST send the corresponding responses in the same order that the requests were received".

So suppose a page asks, on one connection, for a 2 MB image that the server has to generate and then for three small stylesheets that are sitting in memory. The stylesheets are ready in microseconds. They cannot be sent until the image has been fully sent, because the protocol has no way to say "this response belongs to the third request". The response stream is a FIFO queue, the image is job A, and the stylesheets are B and C.

Pipelining never became the norm. Browsers shipped with it switched off. Chromium's design notes list two reasons for removing the option: crashing bugs and "front-of-queue blocking", together with many servers and [[middlebox|middleboxes]] that behaved badly when it was on. Firefox dropped pipelining in version 54. [[curl|curl]] disabled it in 7.62.0 and deleted the code in 7.65.0 in 2019. curl's author called the poor state of pipelining a primary driving factor behind HTTP/2.

::scene six

What browsers did instead was open several connections to each host and spread requests across them. Chrome settled on six per host. In the book's terms that is the multiprocessor answer from chapter 10: if one queue convoys, run several queues in parallel. It helps, but it does not remove the problem. Each connection is still a FIFO, each pays for its own [[handshake|handshake]] and starts its [[congestion-window|congestion window]] from scratch, and six connections compete with each other inside the network as six separate flows.

::scene http2

## HTTP/2: time slicing on one connection

HTTP/2 (RFC 7540 in 2015, revised as RFC 9113 in 2022) took the round-robin route. Every request and response becomes a **stream** with a number, and streams are chopped into frames that are interleaved on a single connection. The 2 MB image is sent a frame at a time, and the stylesheets' frames can slip in between. This is chapter 7's RR with a small time slice: short jobs finish quickly because nobody gets to hold the line for long.

This fixed the head-of-line blocking at the HTTP layer. RFC 9113 is honest about what it did not fix: "TCP head-of-line blocking is not addressed by this protocol."

::scene tcp

The reason is one layer down. [[tcp|TCP]] delivers a single ordered byte stream. The kernel will not hand byte 10,001 to the application until it has bytes 1 to 10,000. HTTP/2's streams are invisible to TCP. If one packet carrying part of the image is lost, the packets after it that carry complete stylesheet frames arrive, sit in the receive buffer, and wait for the retransmission. RFC 9114 describes the effect directly: a lost or reordered packet causes all active transactions to experience a stall, because the parallel nature of HTTP/2's multiplexing is not visible to TCP's loss recovery.

So HTTP/2 moved the convoy rather than ending it. On a clean network it is much better than HTTP/1.1. On a lossy one it has put every request into a single in-order queue again, the very thing the six parallel connections were avoiding. With six connections a lost packet stalls one of them. With one HTTP/2 connection it stalls everything.

::scene quic

## QUIC and HTTP/3: a queue per stream

QUIC (RFC 9000, May 2021) is the move that removes the strict-order condition itself. It runs over [[udp|UDP]] and implements reliability, congestion control and streams in one protocol, usually in user space. The crucial line is a negative one. QUIC delivers each stream's data as an ordered byte stream, but it "does not provide any means of ensuring ordering between bytes on different streams". A lost packet holding part of the image delays the image stream only. The stylesheet streams, whose packets arrived, are delivered at once.

HTTP/3 (RFC 9114, June 2022) is HTTP mapped onto QUIC streams. In scheduling terms, it is the step from one FIFO with time slicing to *one queue per job*. A stall in one queue no longer reaches the others.

Order has not disappeared; it has been scoped. Within a single stream, bytes are still delivered in order, so a loss still delays the rest of that one response, which is what you want for a file. The ordering promise now covers only work that actually depends on itself.

:::fold The convoy hiding in header compression
HTTP/2 compresses headers with HPACK, which keeps a dynamic table of recently seen header fields on both sides. An encoded header can say "use entry 62" instead of repeating a long [[cookie|cookie]]. That only works if the decoder has processed every earlier table update, so HPACK assumes that header blocks are decoded in exactly the order they were encoded, across all streams.

Over TCP that assumption is free. Over QUIC it is the convoy again: if the stream carrying a table update loses a packet, every other stream whose headers refer to that entry must wait. RFC 9204 says that using HPACK on QUIC would "induce head-of-line blocking for field sections due to built-in assumptions of a total ordering".

HTTP/3 therefore uses **QPACK**. Table updates travel on their own unidirectional streams, and each encoded header block states how many table insertions it needs (its *Required Insert Count*). A stream whose headers refer to an entry the decoder has not yet received becomes **blocked** until that insertion arrives.

The decoder decides how much of that it will tolerate. It advertises `SETTINGS_QPACK_BLOCKED_STREAMS`, the number of streams that may be blocked at once, and the default is zero. With zero, an encoder may only refer to entries the decoder has acknowledged, so no stream can ever block, at some cost in compression. Raising the limit buys better compression with some risk of a convoy. It is a dial between efficiency and head-of-line blocking, the same trade-off as choosing a time slice length in chapter 7.
:::

::scene switch

## Inside a switch: the 58.6% ceiling

The convoy effect has a famous number, and it comes from hardware. Picture an N × N [[network-switch|packet switch]]: N input ports, N output ports, and a fabric that can connect each input to one output per time slot. Fixed-size cells arrive at the inputs and wait in a FIFO at each input. In each slot, every output can accept one cell.

Now put a cell for output 3 at the head of input 1's queue, and suppose output 3 is busy with a cell from input 2. Behind it in input 1's queue sits a cell for output 5, which is idle. That cell cannot move. The head blocks it, the output sits idle, and capacity is wasted.

Mark Karol, Michael Hluchyj and Samuel Morgan quantified the loss in 1987. With every input always busy and each cell headed for a uniformly random output, the throughput of a FIFO input-queued switch approaches 2 − √2 ≈ 58.6% as N grows. Four tenths of the fabric is lost to cells waiting behind other cells, with no failure anywhere.

:::fold Where the ceiling comes from, for two ports
The large-N result needs a queueing analysis, but the two-port case can be done by hand.

Take a 2 × 2 switch with both inputs saturated. Each head-of-line cell is for output 1 or output 2 with probability 1/2 each, independently. In each slot:

- If the two heads want different outputs (probability 1/2), both are sent. Two fresh cells move to the heads, each with a random destination.
- If they want the same output (probability 1/2), one is sent and the other waits. The winner's input gets a fresh random head. The loser's head keeps its destination, so the two heads collide again with probability 1/2.

Either way, the next slot is a collision with probability 1/2, independently of the past. The average number of cells sent per slot is (1/2) · 2 + (1/2) · 1 = 1.5, out of a possible 2, so the throughput is 75%.

With more ports, collisions involve more inputs and more blocked cells pile up behind heads, so the fraction falls further. Karol, Hluchyj and Morgan showed that it converges to 2 − √2. The same paper showed that if cells instead queue at the *outputs*, throughput can approach 100%. But an output-queued switch needs a fabric and memories that run N times faster than the line rate, which is why input queueing was attractive in the first place.
:::

::scene voq

The fix is now standard in switch and router design: **virtual output queues** (VOQs). Each input keeps not one FIFO but N of them, one per output. The cell for busy output 3 waits in input 1's queue for output 3, and the cell for idle output 5 is in a different queue, free to go. A scheduler picks, in each slot, a matching between inputs and outputs. McKeown, Mekkittikul, Anantharam and Walrand showed in 1999 that with VOQs and a [[matching|maximum-weight matching]], an input-queued switch can sustain 100% throughput for any [[admissible|admissible traffic]]. Practical switches use cheaper iterative matching schemes, such as McKeown's iSLIP, that come close.

Look at what a VOQ is. It is QUIC's per-stream queue, built in silicon. The ordering promise is narrowed from "everything that arrived at this port" to "everything going to the same place", and a scheduler on top decides which of the queues gets served.

::scene disk

## Disks and I/O queues: reads stuck behind writes

Storage has the same problem with a different cost model. When an application writes, the data usually goes into the [[page-cache|page cache]] and is [[writeback|written back]] later in large batches. Nobody is waiting on those writes. When an application reads something that is not cached, a process is blocked until it arrives. Put both into one FIFO and a few hundred megabytes of background write-back sit in front of a 4 KB read that a user is waiting for. The read is job B, and write-back is job A.

::scene deadline

Linux's **deadline** I/O scheduler, now `mq-deadline` in the multi-queue [[block-layer|block layer]], removes the single queue. Reads and writes go into separate FIFOs, and each request gets an expiry time. In the kernel source, the defaults are 500 ms for reads ([[hz|`read_expire = HZ / 2`]]) and 5 seconds for writes (`write_expire = 5 * HZ`). The scheduler normally serves requests in [[sector|sector]] order, in batches of up to `fifo_batch = 16`, for throughput. When the oldest request in a FIFO has passed its deadline, the scheduler turns to it at the next batch boundary. Reads are preferred, but `writes_starved = 2` limits how many times in a row reads may be chosen while writes are waiting.

Every piece of that is from the scheduling chapters. There are separate queues per class of work. Requests are batched for throughput, which is a time slice measured in requests. Deadlines are an aging rule that guarantees the long-waiting request eventually runs, which is chapter 8's [[mlfq|priority boost]] in another form.

::scene device

The second place the convoy hides is the device itself. A SATA disk with [[ncq|Native Command Queuing]] accepts up to 32 outstanding commands and reorders them internally. An [[nvme|NVMe]] drive accepts far more, across many hardware queues. Once a request is inside the device, the kernel's scheduler can no longer reorder it. If hundreds of writes are already queued in the drive, a new read waits behind them however clever the scheduler above is.

::scene kyber

Linux's **Kyber** scheduler attacks exactly this. It does not reorder much. It limits how many requests of each kind may be in flight in the device at once, using a pool of tokens per domain (reads, writes, [[discard|discards]]). A timer measures the latency each domain is getting and shrinks or grows the pools to hit targets, which default to 2 ms for reads and 10 ms for writes. Keeping the device queue short keeps the kernel in control of the order. This is the same instinct behind [[bufferbloat|keeping network buffers short]]: a deep queue you cannot see into behaves like a FIFO, whatever you put in front of it.

::scene moves

## Four moves

Put the four systems side by side and each fix turns out to be a scheduling move from chapters 7 to 10:

| Move | What it changes | Book analogue | Seen in |
|---|---|---|---|
| More queues in parallel | Fewer items per FIFO | Multiprocessor scheduling (ch. 10) | Six connections per host; multiple NVMe queues |
| Slice the work | No item holds the line for long | Round robin, time slices (ch. 7) | HTTP/2 frames; `fifo_batch` |
| A queue per independent flow | A stall cannot cross to unrelated work | MLFQ's separate queues (ch. 8) | QUIC streams; virtual output queues; read and write FIFOs |
| Let the waiting overtake | Short or old items jump ahead | SJF, STCF, priority boost (ch. 7–8) | `read_expire`; Kyber's latency targets; random lock grants in System R |

Two lessons come with the table.

First, the ordering promise is usually the real problem. TCP promises order for a whole connection, HTTP/1.1 for a whole pipeline, a FIFO input port for every cell that arrived there, and a FIFO lock for every waiter. Each fix narrows that promise to the work that actually needs it: one stream, one destination, one class of request.

Second, a queue you cannot see into cannot be scheduled. Hidden FIFOs, such as a TCP receive buffer, a drive's internal command queue or a deep network buffer, quietly bring the convoy back underneath a well-designed scheduler. Systems that fix head-of-line blocking for good either remove the hidden queue or keep it short.

::scene overview

## The thread back to the book

Chapter 7 introduces the convoy with a supermarket line and three jobs. In chapter 8 MLFQ answers it with several queues and a boost, chapter 9 answers it with shares, and chapter 10 adds more CPUs and a queue per CPU. The protocols and devices in this piece reached the same answers, often decades later and usually without citing the scheduling literature. The [LLM serving note](/notes/llm-convoy) shows the newest instance: batching whole requests for a GPU is FIFO again, and iteration-level scheduling is the time slice that fixes it.

When you meet a new system, the questions are the ones from chapter 7. What is the queue? What order does it promise? Can a long or stuck item make unrelated short ones wait? If the answers are "one", "strict" and "yes", you already know how the trouble will look, and which few moves will fix it.

## Further reading

- [RFC 9113: HTTP/2](https://datatracker.ietf.org/doc/html/rfc9113) (2022): section 1 states plainly that TCP head-of-line blocking remains.
- [RFC 9114: HTTP/3](https://datatracker.ietf.org/doc/html/rfc9114) (2022): the introduction explains why HTTP/2 over TCP stalls on loss.
- [RFC 9000: QUIC](https://datatracker.ietf.org/doc/html/rfc9000) (2021): per-stream ordering, and no ordering across streams.
- [RFC 9204: QPACK](https://datatracker.ietf.org/doc/html/rfc9204) (2022): blocked streams and the compression versus blocking trade-off.
- [HTTP Pipelining](https://www.chromium.org/developers/design-documents/network-stack/http-pipelining), Chromium design documents: why Chrome removed the option.
- [curl says bye bye to pipelining](https://daniel.haxx.se/blog/tag/pipelining/), Daniel Stenberg, 2019.
- [Input Versus Output Queueing on a Space-Division Packet Switch](https://web.stanford.edu/class/cs244/papers/InputvsOutput.pdf), M. J. Karol, M. G. Hluchyj, S. P. Morgan, IEEE Transactions on Communications, 1987: the 58.6% result.
- [Achieving 100% Throughput in an Input-Queued Switch](https://web.stanford.edu/class/cs244/papers/mckeown02.pdf), N. McKeown, A. Mekkittikul, V. Anantharam, J. Walrand, IEEE Transactions on Communications, 1999.
- [Deadline IO scheduler tunables](https://docs.kernel.org/block/deadline-iosched.html), Linux kernel documentation.
- [The convoy phenomenon](https://blog.acolyer.org/2019/07/01/the-convoy-phenomenon/), Adrian Colyer's summary of Blasgen, Gray, Mitoma and Price, ACM SIGOPS Operating Systems Review 13(2), 1979: the book's [B+79].
