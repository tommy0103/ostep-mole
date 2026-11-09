---
deck: One call to fork() gives Redis a frozen, consistent copy of a 24 GB dataset in a fraction of a second. The bill arrives later, one page at a time.
title: fork() as a snapshot machine
---

::scene overview

[[redis|Redis]] is a server that programs talk to over the network. They store values under keys and read them back, with commands like `SET user:42 alice` and `GET user:42`. [[sqlite|SQLite]] is a library that reads and writes a file on disk; Redis holds the whole dataset in the server’s memory, which makes it fast, and the data is gone when the process exits unless it was saved somewhere.

Picture a website running on three application servers behind a load balancer. A user logs in on server A, which stores the session in Redis with `SET session:abc alice`. The user’s next request lands on server B, which finds it with `GET session:abc`. Rate limiting works the same way: every server runs `INCR` on the same key and sees the same count.

Now Redis restarts, for an upgrade or after a crash, and its memory is empty. Every user is logged out and every count is back at zero. A deployment that uses Redis only as a cache can accept that and turn persistence off. The others need a copy on disk.

Many of them ask Redis to save the dataset to disk every few minutes. A typical line in its configuration file reads `save 60 1000`: write a snapshot every 60 seconds if at least 1,000 keys have changed. The server keeps answering requests while the snapshot is written, possibly hundreds of thousands of them per second, and the file on disk is still an exact picture of one instant. Redis’s FAQ adds a precise guarantee: every command that is atomic in memory is atomic in the snapshot too.

The mechanism behind this is one [[syscall|system call]], the one chapter 5 introduces first. Redis calls `fork()`. The child writes the dataset to a file and exits. The parent goes back to serving clients as if nothing happened.

::scene literal

Taken literally, chapter 5 makes this impossible: the child is an almost exact copy of the parent, and copying 24 GB takes seconds and another 24 GB of RAM. This article explains why Redis pays neither cost up front, what it pays instead, and why some OS researchers think the idea should be retired.

## The book’s copy, and the real one

::chapter cpu-api

Chapter 5 presents `fork()` as a strange call: one process goes in, two come out, and each continues from the same instruction with its own copy of memory, registers and open files. The book’s motivation is the shell, which needs to run code in the child *between* `fork()` and `exec()`. A snapshot is a second use the book does not mention. A forked child sees the parent’s memory exactly as it was at the instant of the call, and nothing the parent does afterwards can change what the child sees. That is the definition of a point-in-time snapshot.

::scene cow

What makes it cheap is a trick the book describes much later, in its chapter 23 case study of [[vax-vms|VAX/VMS]]: **[[copy-on-write|copy-on-write]]**, an idea that goes back at least to the [[tenex|TENEX]] system. Instead of copying a [[page|page]], the OS maps the same physical page into both [[address-space|address spaces]] and marks it read-only in both. As long as both sides only read, nobody copies anything. The first write from either side [[trap|traps]] into the OS, which copies that one page, gives the writer its private copy, and lets it continue.

::scene ptcopy

So `fork()` on Linux does not copy your memory. It copies your **[[page-table|page tables]]**, and in doing so it turns every writable private page into a read-only shared one. Chapters 18 to 20 show why that is still real work: a page table holds an entry for every mapped page.

::scene pause

## What one fork costs

Redis’s latency documentation works through the numbers. On [[x86-64|x86-64]] with 4 KB pages, each mapped page needs an 8-byte [[pte|page-table entry]]. A 24 GB Redis instance therefore needs 24 GB / 4 KB × 8 bytes = 48 MB of page tables, and every fork must allocate and fill another 48 MB for the child. The parent cannot serve requests while it does this, because Redis runs commands on a single main [[thread|thread]], and that thread is the one inside `fork()`.

Redis records the time of the last fork in the `latest_fork_usec` field of `INFO`. Its documentation has a table of measurements from several systems, most of them added in April 2012:

| System | Resident memory | Fork time | Per GB |
|---|---|---|---|
| Physical machine, Xeon at 2.27 GHz | 6.9 GB | 62 ms | 9 ms |
| Physical machine, unknown hardware | 6.1 GB | 80 ms | 13.1 ms |
| Large [[hypervisor|VM]] on VMware | 6.0 GB | 77 ms | 12.8 ms |
| [[ec2-xen|EC2, old instance types (Xen)]] | 6.1 GB | 1,460 ms | 239.3 ms |
| EC2, new instance types (Xen), added in 2014 | 1 GB | 10 ms | 10 ms |
| VM on Linode (Xen) | 0.9 GB | 382 ms | 424 ms |

At around 10 ms per gigabyte, as on the physical machines above, a 24 GB instance stops for roughly a quarter of a second each time it snapshots. That is the first cost, and it scales with the size of the address space, not with how much data changes. On the old Xen guests the same fork took more than ten times longer. The documentation’s advice for EC2 users is simply to use the newer [[hvm|HVM]] instance types, which behave almost like physical servers.

:::fold What the kernel does on fork, and on the first write
::scene cow

Here is simplified pseudo-code for what Linux does for one private, writable [[anonymous-memory|anonymous page]], roughly the work of `copy_present_pte()` and `do_wp_page()` in `mm/memory.c`. Real code also handles pages that are pinned for device I/O, [[huge-page|huge pages]], swap entries, and many other cases.

```c
/* pseudo-code: fork, for each present private page of the parent */
child_pte  = parent_pte;
if (writable(parent_pte)) {
    parent_pte = write_protect(parent_pte);   /* the parent loses write access too */
    child_pte  = write_protect(child_pte);
}
get_page(page);                               /* one more address space maps it */
/* after the loop: flush the parent's TLB, since its entries just changed */

/* pseudo-code: a later write fault on a write-protected private page */
if (only_this_process_maps(page)) {
    pte = make_writable(pte);                 /* nobody else to protect: reuse it */
} else {
    new = alloc_page();
    copy_page(new, page);                     /* the actual copy-on-write: 4 KB */
    pte = make_writable(mk_pte(new));
    put_page(page);
}
```

::scene afterexit

Two consequences matter for Redis. First, fork write-protects the *parent’s* entries as well, so the parent pays for the snapshot even though the child is the one doing the work. Second, when the child exits, the pages it shared become exclusive again, but the parent’s entries are still read-only. Each page’s next write still takes a [[page-fault|page fault]], now a cheap one that just flips the entry back to writable.
:::

::scene snapshot

## Two kinds of snapshot

Redis can save its data in two ways, separately or together. An RDB snapshot records the value of every key at one moment. The append-only file (AOF) is a log of every write command, in order. By default RDB is on and AOF is off. With both on, a restart reads the AOF, the more complete of the two, and the RDB files serve as backups. On the website above, a crash with RDB alone loses every session created since the last snapshot. An AOF with the default settings loses about the last second of them.

Redis forks for two jobs, writing an RDB snapshot and rewriting its AOF log. Both rest on copy-on-write, and one key shows how.

Say the key `x` holds 1 at the instant of the fork, on page 2. The child starts walking the dataset, and the parent receives `SET x 2`. Page 2 is read-only now, so the parent’s write faults. The kernel copies the page, points the parent’s entry at the copy and makes it writable, and `x` becomes 2 there. The child’s entry has not moved. When the child reaches `x`, it reads 1.

That is what “the child reads, the parent writes” means here: each write of the parent lands on its own copy, and the memory the child reads stays as it was at the fork, with no lock between them and no versions kept by Redis. It also means `SET x 2` never reaches the file the child is writing. The two jobs differ in what they do about that command.

### RDB snapshots

The child writes the whole dataset as it sees it, in a compact binary format, to a temporary file. An RDB file is one complete picture of the data, and the one named `dump.rdb` is what Redis loads when it restarts, so each new snapshot has to take over that name. The child cannot write into `dump.rdb` directly, because a crash halfway through would destroy the only good copy. It finishes the temporary file and then replaces the old `dump.rdb` with an atomic `rename()`, so the name always refers to a whole snapshot. Once produced, the file is never modified, and it is safe to copy while the server runs. In this file `x` is 1. `SET x 2` waits for the next snapshot, and a deployment that relies on RDB alone loses that write if the server crashes first. The same machinery produces the RDB data a [[replica|replica]] loads when it first synchronizes with its primary.

::scene aoflog

### The AOF and its rewrite

With the AOF on, a write command runs against memory first. Redis then adds it to a buffer, and at the end of each pass through its event loop it normally writes that buffer to the file before sending any replies. This needs no fork. When the data reaches the disk depends on `appendfsync`: `always` calls `fsync()` before the replies go out, `everysec`, the default, calls it about once a second from a background thread and can lose about a second of writes in a disaster, and `no` leaves the timing to the operating system.

::scene aof

Because the file logs every write command, it grows forever: increment `x` a million times and the log has a million lines, when recovery only needs the result. Redis rewrites it once it has grown enough: by default, when it has doubled since the last rewrite and is over 64 MB. The rewrite never reads the old log. A forked child walks its frozen memory and writes the current data to a new base file (in RDB format by default), where `x` is 1. A key incremented a million times takes one entry there, because the child sees only the result.

A log cannot skip commands, so `SET x 2` has to be kept somewhere else. Since Redis 7.0 the parent opens a fresh incremental file just before the fork and appends every later write command to it. When the child finishes, the parent atomically switches a manifest file to name the new base and that incremental file. On restart Redis loads the base, which gives `x = 1`, then replays `SET x 2` from the increments and ends with 2. Before 7.0 the parent kept appending those commands to the old file, in case the rewrite failed, and also buffered them in memory to append to the new file at the end. The 7.0 change named the costs: the RAM for the buffer, every such command written to disk twice, and a freeze of the main thread at the end while it drained the buffer and called `fsync()`.

The two formats meet in that base file: with the default settings, a rewritten AOF is an RDB snapshot followed by a log of the commands since. Redis also runs only one of these children at a time, so that two processes are not doing heavy disk I/O at once. A `BGREWRITEAOF` issued while another child is active is scheduled and starts when that child has finished. A `BGSAVE` issued during a rewrite is refused unless it carries the `SCHEDULE` option.

In both jobs the child exits when it is done. The parent then collects the child’s exit status with a non-blocking `waitpid(-1, &statloc, WNOHANG)` in its periodic housekeeping, the `checkChildrenDone()` function. A forgotten child would become a [[zombie|zombie]], the subject of [the previous note](/notes/zombies-containers).

The FAQ’s atomicity guarantee comes from timing. Redis only forks between commands, never during one. Whatever state the child sees is a state some sequence of complete commands produced.

::lab Fork

The lab steps through `fork()` and `wait()` from chapter 5. Things to try:

- Step to the moment after `fork()`: “same code, same memory, same PC”. That is the snapshot. In Redis, the child would now start writing that memory to disk.
- Choose “scheduler runs parent first”. The parent carries on immediately. In Redis it goes back to serving clients, and every page it writes from now on is copied, because the child still holds the old version.
- Add `wait()` and watch the parent block. Redis never does that, because a blocked parent would stop serving. It polls with `WNOHANG` instead, and the lab’s blocking `wait()` stands in for that check.

## Where it bends

::scene copies

### The copy you pay for later

Copy-on-write defers the copy. It does not cancel it. Every page the parent writes while the child is alive is duplicated. If the parent rewrites everything during a long snapshot, memory use approaches double the dataset. A write-heavy workload can nearly double memory use.

How close you get depends on how writes spread across pages, not on how many keys change. A single small update copies a whole page. And in a hash table, keys that are modified together are rarely stored together.

:::fold How much will a snapshot copy? A back-of-envelope model
::scene model

Model the dataset as *N* pages and assume each write lands on a page chosen uniformly at random. The probability that a given page has *not* been written after *n* writes is (1 − 1/*N*)^n^, which for large *N* is about e^−n/N^. So the expected fraction of the dataset copied is

> copied fraction ≈ 1 − e^−n/N^

Take a 24 GB instance with 4 KB pages, so *N* is about 6.3 million. Suppose, purely as an illustration, that it handles 50,000 writes per second and the snapshot takes 60 seconds, so *n* = 3 million. Then *n*/*N* ≈ 0.48 and the copied fraction is about 1 − e^−0.48^ ≈ 38%. That is roughly 9 GB of extra memory, spent page by page while the child writes.

Now give the same instance 2 MB pages, so *N* is only 12,288. After just one second, *n* = 50,000 and *n*/*N* ≈ 4.1, so the copied fraction is about 98%. Under this model, huge pages turn a gradual 38% into nearly the whole dataset within the first second. That is the situation the Redis documentation describes for [[thp|transparent huge pages]]: a few thousand writes are enough to copy almost all of memory.

The model is crude. Real writes are skewed towards hot keys, which helps, and they also touch allocator metadata and other bookkeeping, which hurts. Redis measures the real number instead. The child reads its own `Private_Dirty` total from `/proc/self/smaps` and reports it to the parent, which shows it in `INFO` as `current_cow_size` during the fork and as `rdb_last_cow_size` or `aof_last_cow_size` afterwards. Reading `smaps` for a large process is itself slow (a 2021 comment in the source warns it can exceed 1,000 ms), so the child throttles how often it measures.
:::

::scene promise

### Overcommit and the OOM killer

When the kernel creates a copy-on-write mapping, each shared page is a promise: if either side writes, a new physical page will be needed. A cautious kernel would refuse the fork unless it could back the worst case, a second full copy. Linux’s default, [[sysctl|`vm.overcommit_memory = 0`]], applies a heuristic that refuses only obvious overcommits. Redis’s FAQ still reports background saves failing with a `fork()` error on low-memory machines, and its standing advice is to set the value to 1, “always overcommit”.

::scene oom

That moves the risk rather than removing it. If the copies outrun physical memory later, the kernel cannot fail the `fork()` that caused them, because it returned long ago. It resolves the [[page-fault|page fault]] by finding memory elsewhere, and in the end the [[oom-kill|OOM killer]] picks a process to terminate. Redis’s `oom-score-adj` setting, when enabled, makes the background child the preferred victim, with default scores of 0 for a primary, 200 for a replica and 800 for a fork child. Losing a snapshot is better than losing the server. What happens before the OOM killer is reached, in compressed [[swap|swap]] and reclaim, is the subject of [the swapping note](/notes/zram-oom).

::scene huge

### Huge pages

[TLB reach and huge pages](/notes/huge-pages) explains why a [[huge-page|2 MB page]] helps the [[tlb|TLB]]. For copy-on-write it used to be a disaster. Until 2020, the first write to an [[anonymous-memory|anonymous]] [[thp|transparent huge page]] shared after `fork()` made Linux allocate and copy the whole 2 MB, 512 times the data of a 4 KB copy, so a few thousand writes could copy nearly all of memory. Redis’s documentation still says it plainly: disable transparent huge pages.

The reason was bookkeeping. The kernel’s early reference counting required a huge page to be mapped whole, so a copy-on-write fault on anonymous memory, the kind with no file behind it and the kind Redis’s heap is made of, had to produce another 2 MB page. The kernel can also hold file contents in its [[page-cache|page cache]] as 2 MB pieces and map them into a process as huge pages, and those were handled differently: on a write fault to a private mapping the kernel broke the single 2 MB entry into 512 ordinary 4 KB entries and let the normal small-page path copy one page.

In mid-2020 a commit merged for Linux 5.8 gave anonymous memory the same treatment, and its message names Redis as a workload for which THP had been unusable. Say a parent and child share a 2 MB page after `fork()`, and the parent writes to it. The kernel replaces the parent’s single entry with 512 small entries pointing at the 512 consecutive 4 KB pieces of the same physical page. No data moves, and the child’s entry stays huge. The write then faults on one small entry like any other, and the kernel copies those 4 KB. The other 511 pieces stay shared until each is written in turn.

The change lives in the kernel’s page-fault path, so it applies to every process that forks while holding anonymous transparent huge pages, with no change to the program. Explicitly reserved pages from [[hugetlbfs|hugetlbfs]] take a separate path and are still copied whole. The split also has costs: it takes work, and the parent maps those 2 MB with small pages until the kernel’s background thread can rebuild the huge page.

Redis’s default configuration does not rely on any of this. It ships with `disable-thp yes`: when the system-wide setting is `always`, Redis asks the kernel through [[prctl|`prctl(PR_SET_THP_DISABLE)`]] to turn transparent huge pages off for its process alone.

:::fold How Redis fights its own copy-on-write
::scene rules

Redis’s source has accumulated a set of small rules whose only purpose is to keep the parent from touching pages while a child is alive.

- **No access-time updates.** Every key lookup normally writes an [[lru|LRU]] or LFU field in the object header, so even a `GET`, a read command, stores to memory and makes the kernel copy that page. In the parent, `lookupKey()` skips the update while a child is running. The source comment says it would otherwise “trigger a copy on write madness”.
- **No hash-table resizing.** Growing or rehashing a dictionary rewrites large arrays of pointers. `updateDictResizePolicy()` avoids resizes while a child exists, to play well with copy-on-write.
- **Dismissing memory in the child.** The child does not need client buffers or the replication buffer, and those are exactly what the parent rewrites under heavy traffic. On Linux with [[jemalloc|jemalloc]], the child releases them early with [[madvise|`madvise(MADV_DONTNEED)`]], only for allocations larger than half a page. Once the child has dropped its mapping, the parent’s next write finds the page exclusive and can reuse it without copying. This is skipped when transparent huge pages are on, because `MADV_DONTNEED` may then fail to release memory.
- **Reporting.** `INFO` shows `current_cow_size`, `current_cow_peak` and `current_fork_perc`, so operators can watch a snapshot’s memory cost while it happens.

Every one of these is the application working around an OS abstraction that gives it a snapshot for free but cannot tell it which writes are about to become expensive.
:::

::scene road

## “A fork() in the road”

In 2019 Andrew Baumann, Jonathan Appavoo, Orran Krieger and Timothy Roscoe presented a paper at HotOS called *A fork() in the road*. Their abstract calls fork a clever hack for the machines and programs of the 1970s that has long outlived its usefulness and is now a liability. The paper names Redis among the major users.

Its case has several parts, and most apply to snapshots:

- **Fork is not thread-safe.** The child gets a copy of the whole address space but only the thread that called `fork()`. If another thread held a [[lock|lock]], say the allocator’s, the child inherits the locked lock and nobody to unlock it. Until it calls `exec()`, the child may only use [[async-signal-safe|async-signal-safe]] functions, which excludes [[malloc|`malloc()`]].
- **Fork is insecure by default.** The child inherits every [[handle|file descriptor]], every secret in memory and the parent’s exact memory layout. A child that does not `exec()` keeps the same [[aslr|address-space randomization]] as its parent, which weakens it. (See [the ASLR note](/notes/aslr).)
- **Fork is slow.** The paper cites fork delays of up to 100 ms in Chrome, and measures fork-plus-exec growing with the parent’s size, while `posix_spawn()` takes about 0.5 ms regardless of size.
- **Fork encourages overcommit.** This is the trade-off described above, which the authors argue fork forces on the whole system.

Their recommendation is to stop using fork to start programs. `posix_spawn()` creates a process running a new program directly, and [[glibc|glibc]] has implemented it since version 2.24 with [[clone|`clone()`]] and the `CLONE_VM | CLONE_VFORK` flags: the child borrows the parent’s memory instead of copying page tables, and the parent waits until it has called `exec()`.

The paper is more sympathetic to snapshots. It lists taking a consistent snapshot of a running process, with persistence as an example, as a real use of copy-on-write. Its complaint is that applications must create a whole process to get one, and it suggests that [[posix|POSIX]] would benefit from an API for copy-on-write memory that is separate from process creation.

Others have attacked the problem from both ends. On the kernel side, *On-demand-fork* (Zhao, Gong and Fonseca, EuroSys 2021) shares page tables copy-on-write too, deferring the page-table copy from `fork()` to the page-fault handler. On the application side, Dragonfly, a Redis-compatible store, snapshots without forking at all. Each shard serializes its own data, and a hook writes an entry’s old value to the snapshot before a write may change it. That is copy-on-write again, done per key in the application instead of per page in the kernel. Redis 8.10 added a `BACKUP` command family whose design lets a cluster’s control plane stagger snapshots, so that the nodes do not all fork at once.

::scene overview

## The thread back to the book

Chapter 5 asks why anyone would design process creation as an odd pair of calls, and answers with the shell. Redis gives a second answer: `fork()` is the standard, portable way for a UNIX program to get a consistent, private, copy-on-write view of its own memory. That view is built from three mechanisms in this book: the per-process address space of chapter 13, the page tables of chapters 18 to 20, and the page fault of chapter 21, used here to copy a page instead of to read one from disk.

The trade-off is the one virtual memory always makes: an expensive eager operation, copying 24 GB, replaced by a cheap promise and many small lazy ones. The promise is nearly free until the workload calls it in, and then the bill depends on details the abstraction was meant to hide: page size, write locality, memory headroom. Chrome uses the same promise to start renderers cheaply from a pre-initialized [zygote](/notes/chrome-processes), and Redis uses it to save its data. The 50-year-old call is still debated because it does so many jobs at once, each with this same trade-off.

## Further reading

- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) (Redis docs): how RDB snapshots and AOF rewrites use fork, including the Redis 7.0 multi-part AOF.
- [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/) (Redis docs): the page-table arithmetic, the fork-time measurements and the transparent huge page warning.
- The commits behind the dates above: [the fork-time table](https://github.com/redis/redis-doc/commit/18caa09945d079be04de8fec5b15d8b5b553c25e) (April 2012) and [the split of EC2 into old and new instance types](https://github.com/redis/redis-doc/commit/85588b658a4383afc116f9fdfab8e61ecbed61bb) (November 2014).
- Brendan Gregg: [AWS EC2 Virtualization 2017: Introducing Nitro](https://www.brendangregg.com/blog/2017-11-29/aws-ec2-virtualization-2017.html): how EC2 went from Xen paravirtualization to Nitro.
- [Implement Multi Part AOF mechanism](https://github.com/redis/redis/pull/9788) (Redis pull request, merged January 2022): the costs of the old rewrite, and the design that replaced it.
- [Redis FAQ](https://redis.io/docs/latest/develop/get-started/faq/): why background saves fail with `fork()` errors, and why snapshots are atomic.
- Andrew Baumann, Jonathan Appavoo, Orran Krieger, Timothy Roscoe: [*A fork() in the road*](https://www.microsoft.com/en-us/research/uploads/prod/2019/04/fork-hotos19.pdf), HotOS 2019.
- [Overcommit accounting](https://docs.kernel.org/mm/overcommit-accounting.html) (Linux kernel docs): the three `vm.overcommit_memory` modes.
- [`fork(2)`](https://man7.org/linux/man-pages/man2/fork.2.html) and [`posix_spawn(3)`](https://man7.org/linux/man-pages/man3/posix_spawn.3.html) (Linux manual pages): copy-on-write, fork in multithreaded programs, and glibc’s `CLONE_VFORK` implementation of spawn.
- [thp: change CoW semantics for anon-THP](https://github.com/torvalds/linux/commit/3917c80280c93a7123f1a3a6dcdb10a3ea19737d) (Linux commit, 2020): why copy-on-write of a huge page now copies 4 KB.
- [On-demand-fork](https://github.com/rssys/on-demand-fork) (Zhao, Gong, Fonseca, EuroSys 2021): copy-on-write page tables for a faster fork.
- [Dragonfly snapshotting](https://www.dragonflydb.io/docs/managing-dragonfly/snapshotting) (Dragonfly docs): a point-in-time snapshot without fork.
