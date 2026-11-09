---
deck: Two very different codebases counted their worst bugs and found the same thing. Most of them are the mistakes chapter 14 lists.
title: Seventy percent: chapter 14’s bugs at industrial scale
---

::scene overview

In February 2019 Matt Miller of the Microsoft Security Response Center gave a talk at BlueHat IL with a chart that has been quoted ever since. It covered every [[rce|remote-code-execution]], [[privilege-escalation|privilege-escalation]] and information-disclosure vulnerability that Microsoft had fixed with a security update, year by year from 2006 to 2018. Each bar was split into [[memory-safety|memory-safety bugs]] and everything else. Every year, the memory-safety part came to about 70%.

In 2020 the Chromium project published its own count, for a codebase written by different people at a different company: around 70% of its serious security bugs were memory-safety problems, and half of those were [[use-after-free|use-after-free]].

Chapter 14 opens its list of common errors with the remark that a C program compiling is “necessary” but “far from sufficient”. This article is about what that gap costs at scale, and the three things the industry now does about it.

## What exactly was counted

The “70%” figure comes from three separate counts:

| source | population | period | memory-safety share |
|---|---|---|---|
| Microsoft (BlueHat IL 2019) | [[cve|CVEs]] for [[rce|RCE]], [[privilege-escalation|EoP]] and info-disclosure bugs fixed by a security update | 2006–2018, by patch year | ~70% every year |
| Chromium (2020) | 912 high or critical severity security bugs affecting the Stable channel | since 2015 | ~70%, half of them use-after-free |
| Android (Google) | Android’s reported vulnerabilities | 2019 | 76% |

A few caveats follow from the table:

- These are **shares, not counts**. They describe which bugs were found and fixed, not which ones attackers used. Miller’s talk did look at [[exploit|exploitation]] separately and found that use-after-free and heap corruption were the classes attackers preferred.
- “Memory safety” in these taxonomies is broader than chapter 14’s list. Microsoft’s root-cause categories were stack corruption, heap corruption, use-after-free, type confusion, uninitialized use and heap out-of-bounds read. Type confusion, using an object as if it had a different type, is not in the book, but it ends in the same place: code reading memory as something it is not.
- The categories moved over time even while the total stayed flat. In Microsoft’s data stack corruption was “essentially dead” by 2018. Use-after-free spiked in 2013–2015 from browser bugs and then fell after a mitigation in the browser’s memory management. Heap out-of-bounds access remained the largest category.

What makes the number persuasive is not its precision. It is that two large C++ codebases, with different engineering cultures and different tools, independently arrived at about the same answer.

## The book’s list, in a security taxonomy

::chapter vm-api

::scene families

Section 14.4 lists the mistakes. Sorted the way security people sort them, they fall into a few families:

- **Spatial errors**: touching memory outside the object. *Not allocating enough memory* is the book’s buffer overflow: `malloc(strlen(src))` followed by `strcpy`, one byte too far. Out-of-bounds *reads* belong here too, and they leak data rather than corrupt it.
- **Temporal errors**: touching an object outside its lifetime. *Freeing memory before you are done with it* gives a dangling pointer, and using it is a use-after-free. *Freeing memory repeatedly* is a double free. *Calling free() incorrectly* is an invalid free.
- **Uninitialized reads**: *forgetting to initialize allocated memory*. The value read is whatever the previous owner of that memory left there, which might be a password or a pointer.
- **Wild pointers**: *forgetting to allocate*, as in the book’s `strcpy(dst, src)` with `dst` never set.

One item on the book’s list is missing from the security counts: **memory leaks**. A leak is a reliability problem, since a long-running server slowly dies, but it rarely gives an attacker anything. The 70% is about the other errors.

::scene padding

The book’s warning that a buggy program “will often run seemingly correctly” is the heart of the problem. In testing, an off-by-one write lands in allocator padding and nothing happens. An attacker who controls the input and the heap layout can arrange for the same write to land on something that matters.

:::fold How a use-after-free becomes control of the program
::scene reuse

The pattern behind many real exploits is short. Here it is in C, with a function pointer standing in for the [[vtable|vtable pointer]] that C++ objects carry:

```c
struct session { void (*on_close)(struct session *); char name[24]; };

struct session *s = malloc(sizeof *s);
s->on_close = normal_close;
/* ... */
free(s);                       /* bug: s is still reachable elsewhere */

char *msg = malloc(32);        /* same size class as struct session */
read(fd, msg, 32);             /* contents chosen by the attacker */

s->on_close(s);                /* calls whatever address the attacker wrote */
```

Why does `msg` land on top of `s`? Because allocators are built to reuse memory quickly. [[glibc|glibc]]’s [[thread|per-thread]] cache ([[tcache|tcache]]) keeps freed chunks on a last-in, first-out list per size class, so the next `malloc` of the same size usually returns the chunk that was just freed. That is good for [[cpu-cache|cache locality]], and it is exactly what the attacker needs. The [allocators note](/notes/allocators) shows how these free lists work.

Two more steps turn this into a working exploit, and both connect to other chapters. The attacker has to know *which* address to write, and [ASLR](/notes/aslr) exists to hide that, so real exploits usually pair the use-after-free with an out-of-bounds read that leaks a pointer. Then the target has to be callable, which mitigations such as [[cfg|Control Flow Guard]] try to restrict. Each defence adds a step. None of them removes the bug.
:::

## Response one: find them before shipping

::scene memcheck

The book recommends Purify and Valgrind. Both work on a program that has already been built: Purify (1992) rewrote object code, and Valgrind’s Memcheck runs the program on a synthetic CPU and tracks every byte. That makes them easy to adopt and slow. The Valgrind manual has warned of slowdowns of “20 to 30 times” since 2005.

::scene asan

**AddressSanitizer** (ASan), published by Konstantin Serebryany and colleagues at Google in 2012, made the same checks cheap enough to leave on in everyday testing. It moves the work into the compiler. Every load and store gets a few extra instructions that consult **shadow memory**: one shadow byte for every 8 bytes of application memory, saying how many of those 8 are addressable. The allocator surrounds each block with poisoned **redzones**, and `free` poisons the whole block and holds it in a **quarantine** for a while instead of reusing it at once. An overflow runs into a redzone. A use-after-free touches quarantined memory. Either way the next instrumented access fails its check.

The paper reported an average slowdown of 73% and over 300 previously unknown bugs found in Chromium. [[clang|Clang]]’s documentation has described the typical slowdown as 2x since 2011. Compile with `-fsanitize=address` and the book’s too-small `strcpy` stops at the faulting call with a `heap-buffer-overflow` report, showing the stack of the bad write and the stack where the 5-byte block was allocated.

```sh
clang -fsanitize=address -g -O1 bug.c -o bug && ./bug
```

::scene msan

ASan does not catch uninitialized reads. That is the job of **MemorySanitizer** (MSan), which keeps one shadow *bit* per bit of memory and propagates “uninitializedness” through copies and arithmetic, reporting only when a garbage value affects a branch, an address or a system call. Its 2015 paper reports a cost of about 2.5x in time and 2x in memory. The catch is that MSan needs every piece of code in the process to be instrumented, libraries included, or it reports false positives.

:::fold What ASan’s check compiles to
::scene asan

On [[x86-64|x86-64]] Linux, the shadow byte for address *a* is at:

> shadow(a) = (a >> 3) + 0x7fff8000

A shadow value of 0 means all 8 bytes are addressable. A negative value means none is: a redzone, or freed memory. A value *k* between 1 and 7 means only the first *k* bytes are, which happens at the tail of an allocation. `malloc(13)` gives one fully addressable 8-byte group (shadow 0) followed by one with shadow 5.

Before each access of `size` bytes, the compiler inserts the equivalent of this (simplified from the ASan algorithm description):

```c
/* pseudo-code: inserted before an access of `size` bytes (1, 2 or 4) at addr */
int8_t k = *(int8_t *)((addr >> 3) + 0x7fff8000);
if (k != 0) {
    if ((int8_t)((addr & 7) + size - 1) >= k)   /* also true for negative k */
        report_error(addr, size);
}
```

Look at the 13-byte block again. A 1-byte read at offset 12 has `addr & 7` = 4, and 4 + 1 − 1 = 4 < 5, so it passes. A read at offset 13 gives 5 ≥ 5: reported. Most accesses touch memory whose shadow is 0 and cost one load, one compare and one branch that is [[branch-predictor|predicted correctly]] almost every time. That is how ASan ends up roughly an order of magnitude faster than Memcheck, which has to translate every instruction at run time to do the same bookkeeping.

The price is memory. On 64-bit systems ASan maps 16 TB or more of virtual address space for the shadow up front, and redzones and quarantine inflate the heap. That makes ASan a testing and [[fuzzing|fuzzing]] tool, not something you ship.
:::

Sanitizers have one structural limit: they find bugs only on paths that run. That is why they are almost always paired with fuzzers, which generate inputs to drive the program down new paths.

## Response two: make them less exploitable

::scene harden

Some bugs will ship anyway. The second response accepts that and makes the bugs harder to use, mostly by hardening the allocator, the component that decides what ends up next to what.

- **Cheap integrity checks.** Since [[glibc|glibc]] 2.29 the [[tcache|tcache]] marks each freed chunk with a key, so freeing the same chunk twice usually aborts with `free(): double free detected in tcache 2` instead of corrupting the free list.
- **Hardened allocators.** Android has used **Scudo** for all [[native-code|native code]] since Android 11 (low-memory devices kept [[jemalloc|jemalloc]]). Scudo puts a checksum in every chunk header, tracks each chunk’s state so a double free is caught, and can quarantine freed chunks before reuse.
- **Delaying reuse where it matters.** Chrome’s **MiraclePtr** (BackupRefPtr) replaces raw pointer fields in C++ classes with a `raw_ptr<T>` that keeps a hidden [[reference-count|reference count]] in the allocation. If memory is freed while such pointers still refer to it, the allocator poisons it and keeps it in quarantine until the count reaches zero. The use-after-free still happens, but it now reads poison instead of the attacker’s data. It shipped in Chrome 102 for the browser process on Windows and Android. In 2022 Google estimated it would protect about half of the use-after-free bugs in that process, at a cost of 3.5–6.5% more memory there.
- **Hardware tags.** Arm’s Memory Tagging Extension (MTE) gives each 16-byte granule of memory a small tag and puts a matching tag in the pointer’s top bits. The CPU compares the two on every load and store. Re-tag a block when it is freed, and old pointers stop matching. Android 12 added kernel and allocator support.

All of these are probabilistic or partial. MiraclePtr covers class fields, not every pointer. A tag can collide by chance. A quarantine eventually hands the memory out again. They raise the cost of exploitation without changing the language.

## Response three: stop writing them

::scene rust

Chapter 14 points to the oldest answer, automatic memory management. With a [[garbage-collection|garbage collector]] you never call `free`, so temporal errors mostly disappear, at the cost of a runtime that decides when memory is reclaimed. **Rust** gets most of the same guarantees without a collector, by making the compiler track who owns each value and how long each reference to it may live.

```rust
fn main() {
    let s = String::from("hello");
    let r = &s;
    drop(s);              // error[E0505]: cannot move out of `s` because it is borrowed
    println!("{}", r);
}
```

The book’s dangling pointer is now a compile error. A double free cannot be written, because ownership of a heap value has exactly one holder. Reading a variable before it has been initialized is rejected too. Spatial errors are handled by a check at run time: indexing a `Vec` out of range does not touch the neighbouring memory but stops the [[thread|thread]] with `index out of bounds: the len is 3 but the index is 10`. That is a bounds check on every access, a software version of the hardware check in chapter 15; see [Base and bounds never really died](/notes/bounds-revival).

### What happened in Android

::scene android

Android gives the best public evidence of what changes when an organisation switches languages. Around 2019 the Android team began steering *new* development towards memory-safe languages, adding Rust for native code, and chose not to rewrite the existing C and C++. By Android 13, in 2022, about 21% of new native code was Rust. The share of memory-safety vulnerabilities went:

| year | memory-safety share of Android vulnerabilities |
|---|---|
| 2019 | 76% |
| 2022 | 35% |
| 2024 | 24% |
| 2025 | below 20% |

The 2024 figure is for part of the year, and the 2025 one comes from Google’s November 2025 report. By then Android had about 5 million lines of Rust with one potential memory-safety bug found in them, CVE-2025-48530 in the CrabbyAVIF image parser, fixed before it reached a release. That is a density of about 0.2 per million lines, against Google’s historical estimate of close to 1,000 per million lines for Android’s C and C++. The same report found that medium and large Rust changes were rolled back about four times less often than comparable C++ changes, so the safety did not come at the expense of speed.

The near-miss matters too. It was in Rust code that used `unsafe`, the escape hatch for talking to hardware and to C. Memory-safe languages shrink the code that has to be trusted. They do not empty it.

:::fold Why Android did not have to rewrite everything
The Android team’s 2024 explanation rests on one observation from vulnerability data: bugs are concentrated in new and recently changed code, and the density of vulnerabilities in a piece of code falls roughly exponentially with its age. Code that has survived years of use, fuzzing and fixes has had most of its bugs shaken out.

Under that model, Google estimated that five-year-old code has 3.4 to 7.4 times fewer vulnerabilities than new code, depending on whether you plug in lifetimes from an academic study or those observed in Android and Chromium. If almost all new code is memory-safe, the pool of young, bug-dense C++ shrinks every year, and the overall share of memory-safety bugs falls even though millions of lines of old C++ are still there.

The policy implication is gentler than “rewrite it in Rust”. Freeze the unsafe code you have, keep fuzzing and hardening it, and write new code in a safe language. The [allocator hardening](/notes/allocators) and sanitizers above are how the remaining C++ is kept honest in the meantime.
:::

## Where it bends

::scene bends

None of the three responses is complete on its own.

- **Sanitizers** only see the paths that tests and fuzzers run, cost 2–3x, and cannot ship.
- **Hardening** is probabilistic. It raises the price of an exploit, and well-funded attackers keep paying it.
- **Safe languages** still sit on C: the kernel, the C library, drivers, and every `unsafe` block or [[ffi|foreign-function call]]. Interop boundaries are where the remaining Rust bugs tend to be.
- **The other 30%** is logic bugs, injection, authentication mistakes and misconfiguration. Memory safety removes one large class of bug. It does not make software correct.

There is also a measurement caveat. As the share of memory-safety bugs falls, the denominator changes too. A falling percentage can mean fewer memory bugs or more of the other kinds being found. Google’s 2024 post shows the absolute number of memory-safety vulnerabilities falling as well, though not every year: it rose slightly in 2023.

## The thread back to the book

::scene levels

Chapter 14 describes two levels of memory management. The OS hands pages to processes and takes them back at exit. The library, `malloc` and `free`, manages bytes inside those pages. The OS level is safe because the hardware checks every access against the process’s [[page-table|page table]]. The library level is not, because nothing checks an access against the boundaries of an individual object.

All three responses are attempts to push a check down to that finer grain. ASan adds a software check per access, using a shadow map that looks a lot like a page table with 8-byte pages. Hardened allocators make the library itself verify its invariants. Rust does the check at compile time where it can and at run time where it cannot. Hardware is starting to help too: MTE does it with tags, and [[cheri|CHERI]] puts the bounds into every pointer, as the [bounds note](/notes/bounds-revival) describes.

The book’s advice was to learn Purify and Valgrind and “wonder how you survived without them”. The industry has spent the years since learning how much it was not surviving, and the 70% figure was what it found.

## Further reading

- Matt Miller, [*Trends, challenges, and strategic shifts in the software vulnerability mitigation landscape*](https://github.com/microsoft/MSRC-Security-Research/blob/master/presentations/2019_02_BlueHatIL/2019_01%20-%20BlueHatIL%20-%20Trends%2C%20challenge%2C%20and%20shifts%20in%20software%20vulnerability%20mitigation.pdf), BlueHat IL 2019: the slides with the 2006–2018 chart and root-cause breakdown.
- MSRC, [*A proactive approach to more secure code*](https://www.microsoft.com/en-us/msrc/blog/2019/07/a-proactive-approach-to-more-secure-code), July 2019: Microsoft’s own summary of the 70% figure.
- The Chromium Projects, [*Memory safety*](https://www.chromium.org/Home/chromium-security/memory-safety/): the 912-bug analysis and Chromium’s strategy, [reported by ZDNet](https://www.zdnet.com/article/chrome-70-of-all-security-bugs-are-memory-safety-issues/) in May 2020.
- Jeff Vander Stoep, [*Memory Safe Languages in Android 13*](https://security.googleblog.com/2022/12/memory-safe-languages-in-android-13.html), Google Security Blog, December 2022: the 21% and 35% figures.
- Jeff Vander Stoep, Alex Rebert, [*Eliminating memory safety vulnerabilities at the source*](https://security.googleblog.com/2024/09/eliminating-memory-safety-vulnerabilities-Android.html), Google Security Blog, September 2024: the code-age argument.
- Jeff Vander Stoep, [*Rust in Android: move fast and fix things*](https://blog.google/security/rust-in-android-move-fast-fix-things/), November 2025: the sub-20% figure, vulnerability density and rollback rates.
- Konstantin Serebryany et al., [*AddressSanitizer: A Fast Address Sanity Checker*](https://www.usenix.org/conference/atc12/technical-sessions/presentation/serebryany), USENIX ATC 2012, and the [AddressSanitizer algorithm](https://github.com/google/sanitizers/wiki/AddressSanitizerAlgorithm) page.
- Evgeniy Stepanov, Konstantin Serebryany, [*MemorySanitizer: fast detector of uninitialized memory use in C++*](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43308.pdf), CGO 2015.
- Adrian Taylor, Bartek Nowierski, Kentaro Hara, [*Use-after-freedom: MiraclePtr*](https://security.googleblog.com/2022/09/use-after-freedom-miracleptr.html), Google Security Blog, September 2022.
- Android Open Source Project, [*Scudo*](https://source.android.com/docs/security/test/scudo): Android’s hardened allocator.
