---
deck: A browser runs untrusted code from thousands of strangers, so it borrows the strongest wall the OS has to offer, the process, and pays for it in memory.
title: Your browser is an operating system for tabs
---

::scene overview

Open a few tabs, then open your browser’s task manager (in Chrome it is under *More tools*). You will not see one program. You will see a list: a browser process, a GPU process, utility processes such as the network service, one renderer per site, a few for extensions. Each line has a [[pid|process ID]], a memory figure and a CPU column. It is chapter 4’s process list, run by an application instead of a kernel.

It was not always like this. When Chrome first shipped, in September 2008, its multi-process design was the headline feature. The Chromium team’s design document recalls the problem it answered: in the browsers of the time, a single bug in a web page or plug-in could take down the whole browser and every open tab with it. Ten years later the design changed again. In January 2018 the [[spectre|Spectre and Meltdown]] attacks showed that code running inside a process could read memory it was never meant to see. Chrome 67 responded by turning on **Site Isolation** for desktop users: every site got renderer processes of its own. The Chrome team accepted a measured 9–13% increase in total memory to do it.

That is an expensive decision for a product whose memory use is a running joke. This piece explains why it was right, and why the answer was a *process* rather than a [[thread|thread]] or a cleverer language runtime.

## The question in the book’s terms

::chapter cpu-intro

::scene isolation

Chapter 4 defines a process as a running program and lists what it consists of: the memory it can address (its **address space**), its registers, and its open files and other I/O state. The OS keeps one of these per program, and the book spends the next twenty chapters showing how the OS makes each one believe it has the machine to itself.

A browser needs exactly that belief, but for a different reason. The OS virtualizes the CPU and memory so that many programs can share one machine *conveniently*. A browser needs to run many pieces of untrusted code *safely*: a news site, a bank, an advertising script, a page you clicked by accident. Each is a program written by a stranger. Some are hostile. All of them run on an engine of millions of lines of C++, which will have bugs.

So the browser asks chapter 4’s question with suspicion: *what is the smallest unit of execution whose failure, or betrayal, cannot spread?* Threads cannot be that unit. They share one address space by design, so a bug in one can corrupt all of them and an exploit in one can read all of them. A process is the smallest thing the OS will actually defend. Its address space is enforced by the hardware, as chapters 13 to 15 show, and the only way out of it is a [[syscall|system call]] that the kernel checks, as chapter 6 shows.

## The split: who runs what

::scene privilege

A modern Chromium-based browser divides its work roughly like this. The details change between releases; the shape has not.

| Process | What runs there | Privilege | If it crashes |
|---|---|---|---|
| Browser | Window and tab UI, profile, navigation decisions, the policy for everything else | Full rights of your user account | The whole browser goes down |
| Renderer (one or more per site) | Blink layout, the V8 JavaScript engine, the page’s own code | Sandboxed: almost nothing | That tab or frame shows a “sad tab” page |
| GPU | Talks to the [[driver|graphics driver]] on behalf of all renderers | Much more than a renderer | The browser survives |
| Network service | HTTP, caches, cookies | Restricted utility process (out of process on most platforms) | Restarted in a new utility process |
| Other utilities | Audio, storage, media decoding | Varies, mostly sandboxed | Depends on the service |

The rows obey a rule the Chromium security team calls the **Rule of 2**. Any piece of code may have at most two of three dangerous properties: it handles *untrustworthy input* (anything with a complex format, from a source you cannot verify), it is written in an *unsafe language* such as C or C++, and it runs with *high privilege*. A renderer parses HTML, CSS, JavaScript and images from the open web, in C++. It has the first two properties, so it must not have the third. The browser process has the third, so it must not parse web content. When it has to make sense of something a renderer sent, it receives a simple structured message and checks it.

This is why the work is in processes at all. The browser process is the kernel of this little system. It owns the resources and the policy. The renderers are its user programs: plenty of CPU, a private address space, and no direct access to anything that matters.

## A crash boundary

::scene crash

The 2008 design was mostly about crashes. Each renderer is a separate OS process, and the browser process holds a [[handle|handle]] to it. When a renderer dies from a null pointer, a stack overflow or an [[oom-kill|out-of-memory kill]], the OS reclaims its address space and closes its handles, the same way it would for any process, as chapter 4 describes. The browser notices the handle signal, shows a sad-face page in the affected tabs, and starts a fresh renderer on the next reload or navigation. Every other tab keeps running, because nothing they depend on lived in the dead process’s memory.

The same logic sets up the other rows of the table. Graphics drivers are notoriously fragile, and the Chromium design notes call preventing driver problems the GPU process’s first goal. Renderers never call the driver. They write drawing commands into [[shared-memory|shared memory]], and the GPU process reads each command, validates it and its arguments, and only then calls the real graphics API. If the driver crashes, it takes down the GPU process, not the browser. The network service works the same way. When it runs in its own process and crashes, it is restarted in a new utility process. In the configurations that keep it inside the browser process, the documentation notes plainly, the whole browser crashes with it.

This is chapter 4’s process lifecycle used as a reliability tool. Creating a process is cheap enough to do on demand, and destroying one cleans up everything it held. A component that may fail is safest in a box the OS knows how to tear down.

:::fold What a renderer sandbox looks like
::scene sandbox

Putting a renderer in its own process is the first step. The second is taking away what an ordinary process may do. Chromium calls the browser process the *broker* and the sandboxed processes *targets*: the broker spawns each target, gives it a policy, and performs on its behalf the few privileged operations the policy allows. The sandbox design notes put the result this way: almost all resources that a renderer uses were acquired by the browser and their handles duplicated into the renderer.

On **Windows** the renderer runs with a [[access-token|restricted token]] that has almost no groups or privileges and the lowest, “Untrusted”, [[integrity-level|integrity level]]. It sits in a [[job-object|job object]] that limits it to a single process and keeps it away from the clipboard and system-wide settings, and on a separate, invisible desktop so it cannot send messages to your windows.

On **Linux** there are two layers. A [[namespace|namespace]] layer puts the renderer in new PID and network namespaces, so it cannot see other processes or reach the network, and in an empty, read-only filesystem root. A **[[seccomp|seccomp-bpf]]** filter then runs a small [[bpf|BPF program]] on every system call the renderer makes and refuses anything not on the list. Since the only way out of a process is a [[trap|trap]] into the kernel, as chapter 6 shows, filtering the traps is the narrowest possible door.

::scene zygote

Linux adds one more process trick. Renderers are not started with [[fork-exec|`exec()`]]. At startup the browser launches a **[[zygote|zygote]]** process, which loads and initializes the common libraries once and then waits. Each new renderer is a `fork()` of the zygote and shares its initialized pages [[copy-on-write|copy-on-write]], which the Chromium docs estimate saves up to about 8 MB per process. It is the same fork trick that [Redis uses for snapshots](/notes/fork-redis), here used to make processes cheaper.

::scene ipc

The sandbox works only because the browser does not trust its renderers. Every [[ipc|IPC]] request (“give me the cookies for this [[origin|origin]]”) is checked against what that process may touch. A renderer that asks for something it never should is treated as compromised and terminated.
:::

## Why 2008 was not enough

::scene shared

The first multi-process Chrome put each *tab* in a renderer process, more or less. That stopped crashes from spreading, and the sandbox stopped a hijacked renderer from installing malware on your machine. But inside a tab, pages from many sites still shared one renderer. A news page with an advertising [[iframe|iframe]] from another site ran both in one process. A same-site page opened by script with `window.open` joined its opener’s process. Once the browser hit its process limit, unrelated tabs started sharing too.

::scene spectre

For crashes this was fine. For secrets it was not. The paper describing Site Isolation lists the threat directly: a compromised renderer can read whatever is in its address space, and that included documents from other sites. Then Spectre removed the need to compromise anything. A transient execution attack lets ordinary JavaScript read memory in its own process that the language should never let it reach. Inside one address space, every wall the browser had built in software was suddenly a suggestion.

:::fold Why Spectre made the address space the only wall that counts
A JavaScript engine enforces many rules in software: array bounds, type checks, the rule that a script from one site may not read another site’s document. Spectre-style attacks exploit the processor’s habit of executing instructions *speculatively* before it knows whether a branch will go that way. A bounds check that will fail can still let a few instructions run with the out-of-bounds value. Those instructions are rolled back, but their effect on the [[cpu-cache|cache]] is not. By timing later memory accesses, the attacker recovers the value piece by piece.

The key word is *in-process*. The speculative load still goes through the same [[page-table|page tables]] as every other load. If another site’s data is mapped into the renderer’s address space, speculation can reach it. If it is not mapped, there is no virtual address that leads to it, and no amount of speculation produces one. Chapter 13’s address space, the illusion that each process has its own memory, turns out to be the one boundary that holds under these attacks. Browsers also reduced the precision of timers and limited [[sharedarraybuffer|`SharedArrayBuffer`]] for the same reason. Those measures make attacks slower. Moving secrets to another process takes them out of reach.
:::

::scene site-isolation

So Chrome changed the unit. With Site Isolation, each renderer process is *locked* to documents from a single **site**, defined as the scheme plus the registrable domain: `https://example.com`, with all of its subdomains. A site, not an [[origin|origin]], because pages on one site can still make themselves same-origin by setting `document.domain`, so they must be able to share a process. Cross-site iframes now render in their own processes, called out-of-process iframes. The browser assembles the frames of one page from several renderers, routing input and compositing their output.

::scene corb

Isolating documents was not enough on its own, because a page can also *fetch* another site’s data. A hostile page can ask for `https://bank.example/account.json` as if it were an image or a script. The browser filters network responses before they reach a renderer. [[corb|Cross-Origin Read Blocking]], and its successor ORB, keep sensitive types such as HTML, XML and JSON from being delivered to a process locked to a different site.

## Watch the wall

::scene isolation

The lab below is the book’s Figure 13.2 animated: three processes, each believing its memory starts at address 0, sharing one physical memory. Read it as three renderers locked to three sites.

::lab AddressSpace

Things to try:

- Pick process A and slide its virtual address from one end to the other. Every address it can form lands inside A’s own region of physical memory. That is the whole of Site Isolation’s promise: a renderer locked to site A has no virtual address that leads to site B’s data.
- Turn on automatic context switching. The CPU moves between the processes, but each one’s translation changes with it. A crash in one is a crash in a box.
- Notice what the lab does not show: the shared pieces. The GPU and browser processes serve every renderer and hold data from many sites, which is why everything sent to them is validated.

The lab uses the base-and-bounds translation of chapter 15, which is simpler than the paging a real browser runs on. The isolation property is the same.

## What it costs

::scene cost

Processes are not free. Each has its own [[page-table|page tables]] and kernel structures, its own copy of any memory it writes, and in a browser its own JavaScript heap and caches. Site Isolation multiplies processes, so the Chrome team measured the cost on real users before shipping it.

:::fold The numbers from the Site Isolation paper
Reis, Moshchuk and Oskov reported these figures from Chrome’s desktop users in their USENIX Security 2019 paper.

- **Process count.** At the median, users had 4.4 renderer processes without Site Isolation and 6.2 with it, an increase of 43.5%. At the [[percentile|99th percentile]] the count went from 35.0 to 52.7, up 50.6%. Users had 6.0 unique sites open at the median and 41.9 at the 99th percentile. If every instance of every site had its own process, the paper estimates 79.7 processes at the 99th percentile. Process sharing between instances of the same site kept the real number well below that.
- **Memory per process.** Each renderer did less work, so it got smaller. Private memory per renderer fell 51.5% at the median, from 87.2 MB to 42.3 MB.
- **Total memory.** Across all processes, total private memory rose 12.6% at the 25th percentile and 8.6% at the 99th percentile. This is the source of the “9–13%” figure. The team judged the cost acceptable given the severity of transient execution attacks.
- **Latency.** Page loads slowed by at most 2.25%, at the 25th percentile. The browser hides some process start-up time by keeping a **spare** renderer already running, unlocked, ready to be assigned to whatever site is visited next.
- **Microbenchmarks are worse.** Loading single sites in a clean browser, one page that needed 10 processes used 89% more memory. Real users keep several tabs open, which gives process sharing more to work with.

On Android, where memory is tighter, Chrome 77 turned on a partial form of Site Isolation for devices with at least about 2 GB of RAM. It isolates only sites the user logs into. The Chromium project reports a memory cost of about 3–5% for that configuration.
:::

The most useful observation is that more processes did not mean proportionally more memory. Site Isolation divided the same work among more, smaller processes. The fixed cost of a process, its page tables, kernel state and runtime start-up, is real but far smaller than the pages it renders.

Chrome also limits how far the multiplication goes. On desktop it sets a soft process limit based on the machine’s memory. Once the limit is reached, it starts placing new documents in existing processes, but only in processes already locked to the *same* site. On desktop, Site Isolation never puts two sites in one renderer to save memory. On Android there is no soft limit. Chrome relies on the OS to discard background processes, as phones do for apps, and the browser rebuilds a discarded tab when you return to it.

## Where it bends

::scene bends

The process boundary is strong, but it is not the whole story.

- **Same-site is one [[principal|principal]].** Everything under `example.com`, including user-hosted subdomains, can share a process. Sites that need finer isolation can ask for **origin-keyed** processes, and the browser treats that request as a hint, not a guarantee.
- **Not every platform has it.** Low-memory Android devices, Android WebView and Chrome for iOS have no Site Isolation. On Android, sites that are not isolated share unlocked processes, and the browser process applies extra checks so those processes cannot request data belonging to isolated sites.
- **The kernel is still shared.** A renderer that finds a bug in the OS kernel escapes every process boundary at once. That is why the sandbox narrows the system calls a renderer can make: fewer calls, less kernel exposed.
- **The privileged processes are the prize.** The browser and GPU processes see data from every site. An attacker who controls a renderer will try to send them malformed messages. The defence is the same one an OS uses at its system call boundary: validate everything that crosses it, as [this note on limited direct execution](/notes/lde-everywhere) explores.

## The thread back to the book

::scene isolation

Chapter 4 introduced the process as the OS’s way to make one CPU look like many. The browser uses it for a different property that came free with that design: **isolation**. A private address space, enforced by the hardware, means one program cannot read or corrupt another’s memory. Limited direct execution means the only way out is through a door the kernel watches. The browser stacks its own policy on top. It decides which site goes in which box, and it watches the doors.

Other browsers reached the same conclusion. Firefox’s Project Fission shipped site isolation to desktop users in Firefox 95, at the end of 2021. The pattern recurs wherever untrusted code runs: [[microkernel|microkernels]] that move drivers into user processes, and the [[container|containers]] of the [next note](/notes/zombies-containers), which use the same kernel mechanisms to box whole applications. And because a memory-unsafe language is one of the two properties the Rule of 2 forbids alongside privilege, the long-term fix is to remove the bugs themselves, the subject of [the memory-safety note](/notes/memory-safety).

The joke about browser memory has a serious answer. Some of that memory buys you a wall between the bank and the advertisement, and the wall is chapter 4’s process.

## Further reading

- Charles Reis, Alexander Moshchuk, Nasko Oskov: [*Site Isolation: Process Separation for Web Sites within the Browser*](https://usenix.org/system/files/sec19-reis.pdf), USENIX Security 2019: the design, the threat model and the measurements quoted above.
- [Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation/) (Chromium project page): the timeline from Chrome 67 on desktop to partial isolation on Android, with memory figures.
- [Process Model and Site Isolation](https://github.com/chromium/chromium/blob/main/docs/process_model_and_site_isolation.md) (Chromium docs): sites, browsing instances, process limits, Android heuristics and enforcement checks.
- [Multi-process Architecture](https://www.chromium.org/developers/design-documents/multi-process-architecture/) (Chromium design document): the original problem statement.
- [Sandbox](https://github.com/chromium/chromium/blob/main/docs/design/sandbox.md) and [Linux sandboxing](https://github.com/chromium/chromium/blob/main/sandbox/linux/README.md) (Chromium docs): the broker/target model, Windows tokens and jobs, namespaces and seccomp-bpf.
- [The Rule of 2](https://github.com/chromium/chromium/blob/main/docs/security/rule-of-2.md) (Chromium security docs).
- [The Linux zygote](https://github.com/chromium/chromium/blob/main/docs/linux/zygote.md) (Chromium docs): why renderers are forked, not exec’ed.
- [Project Fission](https://wiki.mozilla.org/Project_Fission) (Mozilla wiki): Firefox’s site isolation project.
