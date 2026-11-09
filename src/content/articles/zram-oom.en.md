---
deck: Modern systems keep evicted pages in compressed RAM instead of on disk, watch how long tasks stall waiting for memory, and kill a process on purpose before the kernel has to.
title: Swapping today: compress first, measure the stall, kill last
---

::scene overview

In 2020, Fedora 33 stopped creating a swap partition on new installations. In its place, every boot sets up a swap device that lives in RAM: [[zram|`/dev/zram0`]], sized at half of physical memory and capped at 4 GiB. Pages swapped to it are compressed and kept in memory. The change proposal, written by Chris Murphy, put the reasoning in its first line: “Swap is useful, except when it’s slow.”

Your phone made the same choice years earlier. Android has no swap partition on its flash. It compresses idle [[anonymous-memory|anonymous memory]] into zram, and when memory runs short anyway, a user-space [[daemon|daemon]] called [[lmkd|`lmkd`]] kills a background app. That is not a failure mode. On a low-RAM phone it is how the system is designed to run, and an app you return to later is simply restarted.

Chapters 21 and 22 describe a different world: swap on a spinning disk, a page daemon woken by a low watermark, and, at the very end, a “draconian” [[oom-kill|out-of-memory killer]]. This piece is about what replaced those parts, and which of the book’s ideas survived.

::scene book

## The book’s machinery, and its price

::chapter vm-beyondphys

Chapter 21 gives the mechanism. When a PTE’s present bit is clear, the page lives in swap space and touching it raises a page fault. The OS finds a free frame, evicting a victim if it must, reads the page from disk, fixes the PTE and retries. To keep frames on hand, a swap daemon wakes when free pages drop below a low watermark and evicts until a high watermark is reached.

Linux still works this way. The daemon is `kswapd`, and its watermarks are derived from [[sysctl|`vm.min_free_kbytes`]]. A knob called `watermark_scale_factor` sets the distance between them, by default 0.1% of memory.

What changed is the cost of the slow path. Chapter 22 is blunt: when paging to disk is expensive enough, no replacement policy saves you; buy more memory. A random read from a disk takes milliseconds; with the lab below’s figures of 10 ms and 100 ns, that is 100,000 times a DRAM access. [[ssd|Flash]] is much faster but wears out under writes, and phones cannot afford either the latency or the wear. The response was not to give up on swap but to move it.

::scene two-kinds

## Why swap at all

It is tempting to conclude that you should simply turn swap off. Chris Down, a kernel memory-management developer, argued in 2018 that this misreads what swap is for. Linux keeps two kinds of pages:

- **File pages** cache file contents. A clean one can be dropped at any time and read back from the file.
- **Anonymous pages** hold heap and stack. They have no file behind them, so without swap they can never be evicted.

Without swap, idle anonymous memory is pinned and all [[reclaim|reclaim]] pressure falls on file pages, including the code of running programs. The system can still [[thrashing|thrash]]; it just thrashes on file pages instead of swap. In Down’s phrase, swap is “primarily a mechanism for equality of reclamation”, not emergency memory. Compressed swap keeps that equality while removing the disk.

::scene zram

## zram: a swap device made of RAM

zram is a [[block-device|block device]] driver. Pages written to `/dev/zramN` are compressed and stored in memory allocated on demand. Make it a swap device and the kernel’s swap code needs no changes at all: it writes a 4 KiB page to a “disk”, and the disk happens to be a compressor and a memory allocator. zram spent about four years in the kernel’s [[kernel-staging|staging area]] before becoming a regular driver in Linux 3.14 (2014).

```sh
modprobe zram
cat /sys/block/zram0/comp_algorithm     # list compressors; [brackets] mark the current one
echo zstd > /sys/block/zram0/comp_algorithm   # must be set before disksize
echo 4G   > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon --priority 100 /dev/zram0
cat /sys/block/zram0/mm_stat            # orig_data_size compr_data_size mem_used_total ...
```

The arithmetic matters more than the commands. The kernel documentation advises against making a zram device more than twice the size of RAM, “since we expect a 2:1 compression ratio”. Fedora’s 2020 proposal works the example. On a 16 GiB machine with a 4 GiB zram device, filling it with 4 GiB of anonymous pages at 2:1 costs 2 GiB of RAM. The net gain is 2 GiB, not 4. The proposal is honest about this: swap-on-zram evicts at about half the efficiency of swap-on-disk, but “it is at least an order of magnitude faster.”

A few details make the trade better than the ratio suggests:

- **Same-filled pages are free.** A page full of one repeated value, typically zeros, is recorded as just that value. The `same_pages` counter in `mm_stat` counts them, and “no memory is allocated for such pages.”
- **Incompressible pages are tracked.** `huge_pages` counts pages that did not compress. With [[kconfig|`CONFIG_ZRAM_WRITEBACK`]], an administrator can send those, or pages idle for a given time, to a real backing device.
- **The kernel can be told swap is cheap.** `vm.swappiness` ranges from 0 to 200 and expresses the relative cost of swap I/O against file I/O, with 100 meaning equal. The documentation suggests values above 100 for in-memory swap such as zram or zswap.

Android takes this further. Android 17 adds `mmd`, a memory-management daemon that configures zram at boot and runs maintenance in the background: writing idle pages out to a file on flash, and recompressing idle pages with a second algorithm that has a higher compression ratio. The second step is a small replacement policy of its own: the pages least likely to be touched get the most expensive treatment.

::scene zswap

## zswap: a compressed cache in front of a real disk

[[zswap|zswap]], merged in Linux 3.11 (2013), solves the same problem in a different place. It is not a swap device. It is a cache in front of one. When a page is on its way to the swap device, zswap tries to compress it into a RAM pool. If that succeeds, the write never happens. When the pool hits its size limit, zswap evicts its own oldest entries “on an [[lru|LRU]] basis” to the real device. Internally it finds a compressed page by its swap offset, using “an [[xarray|xarray]] per swap type”, the radix tree from [A multi-level page table is a radix tree](/notes/radix-trees).

| | swap on disk | zram as swap | zswap + disk swap |
|---|---|---|---|
| where evicted pages go | disk or SSD | compressed RAM | compressed RAM, then disk |
| when RAM pool is full | n/a | device is full | oldest entries written to disk |
| needs a disk | yes | no | yes |
| typical home | the traditional default | phones, ChromeOS, Fedora | laptops and VMs with swap on SSD |

Fedora explained why it chose zram rather than zswap. zswap needs a disk-based swap device, and pages it writes back there can leak user data to persistent storage. zram “depends only on volatile storage”, which is simpler and more secure. The zswap documentation, for its part, points out that holding pages in RAM cuts “life-shortening writes” to an SSD swap device. Both are compress-first designs. They differ in what happens when compression is not enough.

::scene slowpath

## Watch the slow path get faster

The lab follows one memory access through the full path of chapter 21: TLB, page walk, page fault, free-frame search, eviction, and swap I/O.

::lab PageFault

Things to try:

- Run “page fault, memory full, dirty victim”. The lab charges a disk-era 10 ms for each of the two swap steps, and they dwarf everything else on the path.
- Now imagine the swap device is zram. Every other step stays as it is, since zram is just another block device to the kernel. Only those two boxes change, into a compression and a decompression on the CPU. That is where Fedora’s “order of magnitude” comes from.
- Run “TLB hit” and “TLB miss, page in memory” for scale. Even compressed swap is far slower than a page that never left memory. Compression lowers the price of a bad eviction; it does not make it free.
- Look at the “evict a page (policy!)” box. Which page goes is chapter 22’s question, and [Nobody implements real LRU](/notes/approx-lru) covers how Linux answers it.

::scene oom

## When compressing is not enough: the OOM killer

Chapter 22 ends with thrashing, and with two responses to it. One is [[admission-control|admission control]]: run fewer processes so that the rest fit. The other is the out-of-memory killer, which picks a memory-hungry process and kills it.

Linux’s OOM killer runs when an allocation cannot be satisfied even after reclaim has tried hard. It scores every candidate with a *badness* heuristic. The score is roughly the fraction of the allowed memory the task is using, adjusted by a per-process knob, [[procfs|`/proc/<pid>/oom_score_adj`]], which ranges from −1000 to +1000. A value of −1000 exempts the task entirely. The current score is visible in `/proc/<pid>/oom_score`, on a 0–2000 scale that includes the adjustment.

:::fold The badness score, line by line
This is `oom_badness()` from `mm/oom_kill.c` in mainline Linux (2026), lightly abridged:

```c
long oom_badness(struct task_struct *p, unsigned long totalpages)
{
	long points;
	long adj;

	if (oom_unkillable_task(p))
		return LONG_MIN;
	p = find_lock_task_mm(p);
	if (!p)
		return LONG_MIN;

	adj = (long)p->signal->oom_score_adj;
	if (adj == OOM_SCORE_ADJ_MIN ||
			mm_flags_test(MMF_OOM_SKIP, p->mm) ||
			in_vfork(p)) {
		task_unlock(p);
		return LONG_MIN;
	}

	/*
	 * The baseline for the badness score is the proportion of RAM that each
	 * task's rss, pagetable and swap space use.
	 */
	points = get_mm_rss_sum(p->mm) + get_mm_counter_sum(p->mm, MM_SWAPENTS) +
		mm_pgtables_bytes(p->mm) / PAGE_SIZE;
	task_unlock(p);

	/* Normalize to oom_score_adj units */
	adj *= totalpages / OOM_SCORE_ADJ_MAX;
	points += adj;
	return points;
}
```

The baseline is the pages the process would give back if killed: [[rss|resident pages]], pages already out in swap, and its page tables. There is no notion of importance, age or CPU use in it. Importance enters only through `oom_score_adj`, scaled so that each unit is worth a thousandth of all allowed memory.

A worked example. On a machine with 16 GiB of RAM and no swap, `totalpages` is 4,194,304 pages of 4 KiB, so one unit of adjustment is worth 4,194 pages. A process with 2 GiB resident starts at 524,288 points. Give it `oom_score_adj` = 500 and it gains 500 × 4,194 = 2,097,000 points, the equivalent of another 8 GiB, half of memory. The proc documentation describes +500 the same way: roughly equivalent to letting the other tasks use at least 50% more memory.

The function also shows what the killer does not know: whether the process holds the user’s unsaved work, or whether killing it will free the memory quickly. The book’s example, killing the [[x-server|X server]] and losing every window, is still possible if nothing marks the display server as important.
:::

::scene livelock

The kernel’s killer has a reputation problem, and it is mostly about timing. It acts only when reclaim has failed, and reclaim can keep almost succeeding for a long time: each pass frees a few pages that are immediately faulted back. The machine is not out of memory, so the killer stays out of it, but it is not doing useful work either. Facebook’s engineers described the result in 2018: the kernel OOM killer “kicks in too late, resulting in the system entering a [[livelock|livelock]] for an indeterminate period.” Chapter 22 calls this state thrashing. To act earlier, you need a way to measure it.

::scene psi

## Measuring thrashing: pressure stall information

Free-memory counts are a poor signal. A healthy machine uses nearly all of its RAM as [[page-cache|page cache]], and a struggling one can look the same. Johannes Weiner’s **pressure stall information** (PSI), merged in Linux 4.20, measures the thing that matters: time lost waiting.

```text
$ cat /proc/pressure/memory
some avg10=0.00 avg60=0.00 avg300=0.00 total=0
full avg10=0.00 avg60=0.00 avg300=0.00 total=0
```

The `some` line is the share of time in which at least one task was stalled waiting for memory, for example in reclaim or while a recently evicted page is read back. The `full` line is the share of time in which *all* non-idle tasks were stalled at once. The kernel documentation’s description of that state is the textbook definition: actual CPU cycles go to waste, and a workload that spends extended time there “is considered to be thrashing.” The averages cover 10, 60 and 300 seconds. The same files exist per [[cgroup|cgroup]] as `memory.pressure`.

That turns chapter 22’s qualitative idea into a number you can put a threshold on, which is what user-space killers do.

:::fold Getting woken up by the kernel when pressure rises
::scene trigger

Polling the averages works, but PSI also supports triggers. You write a threshold and a window to the pressure file, then [[poll|`poll()`]] it. The kernel accepts windows from 500 ms to 10 s, and unprivileged users may create triggers whose window is a multiple of 2 s. This is condensed from the example in the kernel’s PSI documentation:

```c
/* condensed from the example in Documentation/accounting/psi.rst */
#include <fcntl.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void)
{
	const char trig[] = "some 150000 1000000";	/* 150 ms of stall in any 1 s window */
	struct pollfd fds = { .events = POLLPRI };

	fds.fd = open("/proc/pressure/memory", O_RDWR | O_NONBLOCK);
	if (fds.fd < 0 || write(fds.fd, trig, strlen(trig) + 1) < 0)
		return 1;
	for (;;) {
		if (poll(&fds, 1, -1) < 0 || (fds.revents & POLLERR))
			return 1;
		if (fds.revents & POLLPRI)
			printf("memory pressure: time to shed load\n");
	}
}
```

The units are microseconds: 150,000 µs of stall within any 1,000,000 µs window. Android’s `lmkd` registers triggers of exactly this form. Its defaults, from the Android documentation, are a partial (`some`) stall of 70 ms on high-performance devices or 200 ms on low-RAM devices, and a complete (`full`) stall of 700 ms, to decide when to act and how hard.
:::

::scene oomd

## Killing on purpose: systemd-oomd and lmkd

Once you can measure pressure, killing becomes a policy decision made in user space, early, with knowledge the kernel lacks.

**systemd-oomd**, added in [[systemd|systemd]] 247 (2020), applies the same idea to cgroups rather than processes, for units that opt in. Its defaults: act when a monitored cgroup’s memory pressure stays above 60% for 30 seconds, or when both memory and swap are more than 90% used. The pressure figure is the `full` measure: the share of a 10-second window in which every task in the group was delayed. When it acts, it sends [[sigkill|`SIGKILL`]] to every process in the chosen cgroup, so an application goes down together with all its helpers. Its manual page adds a point Chris Down would make: run it with swap. With swap, the system degrades slowly enough for the daemon to react. Without it, the machine reaches livelock too fast.

::scene lmkd

**Android’s lmkd** is the older and more radical design, because killing is part of its normal operation. Android used to ship an in-kernel “low memory killer” driver with fixed free-memory thresholds. It was removed from the upstream kernel in 4.12, and `lmkd` took over in user space. Since Android 10 it uses PSI triggers by default. Android 11 added a strategy that also watches how much of the page cache is being [[refault|refaulted]], a direct measure of thrashing.

Whom it kills comes from the activity manager, which keeps every app’s `oom_score_adj` current according to what the user can see. These are some of the levels defined in the framework’s `ProcessList.java`:

| state | oom_score_adj |
|---|---|
| native daemons | −1000 |
| system server | −900 |
| foreground app | 0 |
| visible app | 100 |
| perceptible (e.g. music playing) | 200 |
| home screen | 600 |
| previous app | 700 |
| cached apps | 900–999 |

`lmkd` kills from the bottom of this table up. In its [[vmpressure|vmpressure]]-based configuration, the documented defaults let medium pressure kill only processes at 800 or above (cached apps and nonessential services), and only critical pressure reach 0. This is chapter 22’s admission control, done after the fact. A phone cannot refuse to start an app, so it stops apps the user is not looking at, in an order that reflects what the user would miss least.

:::aside Not every desktop runs an OOM daemon
Linux’s [[mglru|multi-generational LRU]] has its own pressure valve for machines without one. Writing N to `/sys/kernel/mm/lru_gen/min_ttl_ms` protects the [[working-set|working set]] of the last N milliseconds from eviction. If that working set cannot be kept in memory, the kernel’s OOM killer runs instead of letting the system thrash. The documentation suggests N = 1000 to remove intolerable jank, based on a human-detectable lag of about 100 ms.
:::

::scene bends

## Where it bends

The modern stack is not free of the book’s problems. It moves them.

- **Compression costs CPU.** Every swap-out compresses and every swap-in decompresses. On a phone that costs battery; on a busy server, cycles. Android’s `mmd` schedules its expensive maintenance only when the device is idle and the battery is not low.
- **Compressed swap competes with what it saves.** zram’s pool is RAM too. If the working set does not fit even at 2:1, the system thrashes on decompression instead of disk I/O.
- **Ratios are workload facts, not constants.** 2:1 is the documentation’s expectation, not a guarantee. Encrypted, already compressed, or random data does not shrink, which is why zram counts incompressible pages and lets you write them to a backing device.
- **Kill policy is policy.** The kernel’s badness score measures size only. Importance has to come from user space, through `oom_score_adj` and cgroup layout. Get that wrong and you have the book’s [[x-server|X-server]] story again.

::scene overview

## The thread back to the book

Line the pieces up against chapters 21 and 22 and the mapping is close:

1. The **swap daemon** with low and high watermarks is `kswapd`, still waking on the same kind of thresholds.
2. **Swap space** has moved from a disk partition to compressed RAM: zram as the device, or zswap as a cache in front of one.
3. **“When replacements really occur”** now has a measurement behind it: PSI reports how much time tasks lose while it happens.
4. **Thrashing** has an operational definition: the share of time in which every task is stalled on memory.
5. **Admission control and the OOM killer** have merged into user-space daemons that kill early, by importance, one cgroup or one cached app at a time.

The ordering in the title is the whole design. Compress first, because a compressed page in RAM is cheaper to get back than a page on any disk. Measure stalls, not free memory, because time lost is what users feel. Kill last, but deliberately, before the kernel is forced to choose by size alone.

## Further reading

- [zram: Compressed RAM-based block devices](https://docs.kernel.org/admin-guide/blockdev/zram.html): setup, the 2:1 sizing note, `mm_stat`, idle tracking and writeback.
- [zswap](https://docs.kernel.org/admin-guide/mm/zswap.html): the compressed swap cache, its LRU writeback and pool limits.
- [PSI: Pressure Stall Information](https://docs.kernel.org/accounting/psi.html): the `some` and `full` metrics, triggers, and the per-cgroup interface.
- [Tracking pressure-stall information](https://lwn.net/Articles/759781/) (LWN, July 2018): the patch set as it was proposed.
- [Changes/SwapOnZRAM](https://fedoraproject.org/wiki/Changes/SwapOnZRAM): Fedora 33’s change proposal, with its sizing arithmetic and the case against zswap.
- [In defence of swap: common misconceptions](https://chrisdown.name/2018/01/02/in-defence-of-swap.html) (Chris Down, 2018): why swap is about equality of reclamation.
- [Low memory killer daemon](https://source.android.com/docs/core/perf/lmkd): Android’s `lmkd`, PSI monitors and tuning properties.
- [oomd.conf](https://www.freedesktop.org/software/systemd/man/latest/oomd.conf.html) and [systemd-oomd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd-oomd.service.html): defaults and requirements of systemd’s OOM daemon.
- [Open-sourcing oomd](https://engineering.fb.com/2018/07/19/production-engineering/oomd/) (Facebook Engineering, 2018): why a user-space OOM killer.
- [/proc/<pid>/oom_score_adj](https://docs.kernel.org/filesystems/proc.html): the kernel’s description of the badness score and its adjustment (section 3.1).
