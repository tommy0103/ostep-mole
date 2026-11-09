# Writing field-note articles

Every field note (现实连线) and thread card in a chapter is the fold of a longer piece. The card is the
summary. "Read the full story" unrolls the article in place, and `/notes/<id>` gives it its own page.
This guide is for anyone writing or editing those articles.

Files: `src/content/articles/<id>.en.md` and `<id>.zh.md`. `<id>` is the note's `id` in
`src/content/extras/virtualization.ts`.

Check your work with:

```bash
node --experimental-strip-types tools/content/check-articles.mjs <id>
```

The same checks also run in `tests/articles.test.ts`.

## What a piece is

A long technical blog post for a reader who has just read the chapter. The book gives them the
mechanism in its simplest form. The article shows the same mechanism in a system they use, and how far
the book's idea carries before the real system has to add something.

- **Length.** English: 1,800–3,200 words. Chinese: the same content, typically 4,000–6,500 characters.
  The checker rejects pieces under 1,200 words or 2,000 characters.
- **Shape.** No template, but most good pieces do roughly this:
  1. A concrete hook: an incident, a number, a change in a real system.
  2. The question it raises, stated in the book's terms.
  3. A recap of the book's mechanism, brief, linking the chapter with `::chapter <slug>`.
  4. The real system from first principles: data structures, the decision rule, a worked example with
     real numbers.
  5. Where it bends: the heuristics, trade-offs and failure modes the book's version does not have.
  6. The connection back: which idea in the book this really is, and where else it appears.
  7. `## Further reading` (`## 延伸阅读`): a list of real links.
- **Folds.** Put deeper material in 2–4 `:::fold` blocks: a derivation, the kernel source, a war story,
  a benchmark. The main text must read well with every fold closed. A fold title says what is inside
  ("Why the lags always sum to zero", "What the kernel code looks like").
- **Interactive.** If one of the existing labs shows the mechanism, embed it with `::lab Name` and tell
  the reader what to try. Labs are listed in `src/components/labs/registry.ts`.
- **Voice.** Plain, precise and warm. Explain, don't sell. No marketing adjectives, no "In today's
  fast-paced world". Short paragraphs. Use concrete numbers wherever you can. Second person ("you") is
  fine. Admit what a simplification leaves out.

## Terms the reader may not know

Write for someone reading the book in order. At chapter 4 they have not met system calls, page tables
or threads, and they may never have heard of seccomp or an iframe. Do not stop the prose to define
everything. Mark the term instead, and the reader can unfold a short card under the paragraph:

- Mark `[[id|the words as they appear]]` the **first time** a term appears in the main text. If it
  appears first inside a fold, mark it there and again at its first use in the main text, because
  readers skip folds.
- Mark what the book has not taught *by that chapter* and everything from outside the book. A term
  the surrounding paragraph fully explains needs no card. An opaque name still does, even when the
  sentence says what the thing does: a reader who meets "zygote" still wonders what it is.
- The entry lives in `src/content/glossary.ts`: a title and one to three sentences in each language,
  plus `chapter` (where the book explains it) and `note` (a field note that goes deeper) when they
  exist. Reuse an entry if it exists; read it first, since its wording must fit your use.
- An entry may mark further terms. They open in the same card, so a reader can follow BPF → system
  call → trap. Keep that chain short and never circular to no purpose.
- Both languages mark the same terms (`tests/articles.test.ts` checks this).

## Accuracy rules (non-negotiable)

- Every factual claim (version numbers, dates, defaults, benchmark figures, who did what) must come
  from a source you checked: kernel docs or source, the original paper, official project docs, LWN,
  or the authors' own write-ups. If you cannot verify something, leave it out or state it less
  precisely. Do not invent numbers, quotes or citations.
- Every link in Further reading must be one you actually opened. Prefer stable URLs: docs.kernel.org,
  lwn.net/Articles/N, USENIX/ACM paper pages, project docs, git commits.
- Code samples must be correct for the version you name. Mark pseudo-code as such.
- Call simplifications what they are ("simplified", "roughly"). Simulations in labs are simplified, so
  say so where it matters.
- Quote sparingly: a sentence at most, with attribution.

## Bilingual rules

- Write the Chinese as Chinese: natural, idiomatic technical prose, not sentence-by-sentence
  translationese. Both versions must still carry the same content and the **same block skeleton**:
  - the same sequence of headings, paragraphs, lists (same item count), code, tables (same rows and
    columns), quotes, folds and labs;
  - parallel view pairs them block by block, and the checker enforces this.
- Code blocks may differ only in comments. Identical code is shown once, across both columns.
- On first use, give the English term in parentheses: 滞后量（lag）, 合格（eligible）.
- Use the official translation's terms for anything the book names:

| English | 中文（随译本） |
|---|---|
| process / thread | 进程 / 线程 |
| context switch | 上下文切换 |
| limited direct execution | 受限直接执行 |
| trap / system call | 陷阱 / 系统调用 |
| turnaround / response time | 周转时间 / 响应时间 |
| convoy effect | 护航效应 |
| time slice | 时间片 |
| lottery / stride scheduling | 彩票调度 / 步长调度 |
| multi-level feedback queue | 多级反馈队列（MLFQ） |
| address space / virtual memory | 地址空间 / 虚拟内存 |
| base and bounds | 基址/界限 |
| segmentation / paging | 分段 / 分页 |
| page table / page directory | 页表 / 页目录 |
| TLB | 地址转换旁路缓冲存储器（TLB），之后直接写 TLB |
| free list / external fragmentation | 空闲列表 / 外部碎片 |
| page fault | 页错误 |
| swap space | 交换空间 |
| thrashing | 抖动 |
| locality | 局部性 |
| replacement policy / clock algorithm | 替换策略 / 时钟算法 |

## Syntax

~~~
---
deck: One sentence under the title (the standfirst).
title: Optional longer title (defaults to the card's title)
---

Paragraphs are separated by blank lines. Inline: `code`, **bold**, *italic*,
[a link](https://lwn.net/Articles/925371/), [a chapter](/virtualization/cpu-sched-lottery),
[another note](/notes/k8s-shares), 2^64^, x~i~, a [[seccomp|glossary term]].

## Section            ### Subsection
- bullet              1. numbered
> a quotation

```c
code (language tag optional: c, sh, py, rust, go, text)
```

| table | header |
|---|---|
| cell | cell |

::lab Lottery                    embed a lab (name from the registry)
::lab Mlfq {"some": "prop"}      with props, if the lab takes any
::chapter cpu-sched-lottery      a link card to a chapter
::scene sandbox                  the article's scene shows this state from here on (docs/scenes.md)

:::fold Title of the fold
Deeper material. Folds may contain anything, including other folds.
:::

:::aside Title
A boxed remark that is always visible.
:::

---                              a rule
~~~

Lists are single-level. A list item may continue on lines indented by two spaces.
