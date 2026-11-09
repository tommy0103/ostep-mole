// Hand corrections for what layout extraction cannot recover: built-up fractions and display
// equations. Their numerator and denominator are set above and below the line, so they come out
// scattered through the sentence ("reduces 10+20+120 average turnaround from 110 seconds to 50 ( = 50),
// more than 3 a factor of two"). The Chinese edition writes most of these inline, "(10 + 20 + 30) / 3",
// and so do the corrections.
//
// A fix finds its block by a piece of the extracted text (it must be unique in the chapter):
//   join  append that many following blocks first (the PDFs break the paragraph after each formula)
//   text  the whole block, rewritten in the articles' inline markup: `code`, T~sub~, 2^sup^, *i*, **b**
// A fix that no longer matches is reported, so a re-extraction cannot silently drop it.

export const FIXES = {
  en: {
    7: [
      { find: 'Tresponse = Tf irstrun', text: 'T~response~ = T~firstrun~ − T~arrival~ (7.2)' },
      {
        find: '10+20+30 Thus, the average turnaround',
        text: 'From Figure 7.1, you can see that A finished at 10, B at 20, and C at 30. Thus, the average turnaround time for the three jobs is simply (10 + 20 + 30) / 3 = 20. Computing turnaround time is as easy as that.',
      },
      {
        find: 'a painful 110 seconds ( = 110)',
        text: 'As you can see in Figure 7.2, Job A runs first for the full 100 seconds before B or C even get a chance to run. Thus, the average turnaround time for the system is high: a painful 110 seconds ((100 + 110 + 120) / 3 = 110).',
      },
      {
        find: 'SJF reduces 10+20+120 average turnaround',
        text: 'Let’s take our example above but with SJF as our scheduling policy. Figure 7.3 shows the results of running A, B, and C. Hopefully the diagram makes it clear why SJF performs much better with regards to average turnaround time. Simply by running B and C before A, SJF reduces average turnaround from 110 seconds to 50 ((10 + 20 + 120) / 3 = 50), more than a factor of two improvement.',
      },
      {
        find: 'The result is a much-improved average turnaround time: 50 seconds',
        join: 1,
        text: 'The result is a much-improved average turnaround time: 50 seconds (((120 − 0) + (20 − 10) + (30 − 10)) / 3). And as before, given our new assumptions, STCF is provably optimal; given that SJF is optimal if all jobs arrive at the same time, you should probably be able to see the intuition behind the optimality of STCF.',
      },
      { find: 'RR with a time-slice of 1 second would cycle through the jobs quickly (Figure 7.7). 0+1+2', text: 'To understand RR in more detail, let’s look at an example. Assume three jobs A, B, and C arrive at the same time in the system, and that they each wish to run for 5 seconds. An SJF scheduler runs each job to completion before running another (Figure 7.6). In contrast, RR with a time-slice of 1 second would cycle through the jobs quickly (Figure 7.7).' },
      { find: 'The average response time of RR is: = 1', text: 'The average response time of RR is: (0 + 1 + 2) / 3 = 1; for SJF, average response time is: (0 + 5 + 10) / 3 = 5.' },
    ],
    9: [
      // eq. 9.1 comes out as "weight_k" over "time_slice_k = ∑_n · sched_latency (9.1) −1 weight_i i=0"
      { find: 'weightk', text: '`time_slice`~k~ = `weight`~k~ / (∑~i=0~^n−1^ `weight`~i~) · `sched_latency`    (9.1)', join: 1 },
      {
        find: 'This means weightA',
        join: 3,
        text: 'Let’s do an example to see how this works. Assume there are two jobs, A and B. A, because it’s our most precious job, is given a higher priority by assigning it a nice value of -5; B, because we hates it^3^, just has the default priority (nice value equal to 0). This means `weight`~A~ (from the table) is 3121, whereas `weight`~B~ is 1024. If you then compute the time slice of each job, you’ll find that A’s time slice is about 3/4 of `sched_latency` (hence, 36 ms), and B’s about 1/4 (hence, 12 ms).',
      },
      {
        find: 'Here is the new formula, which takes the actual run time',
        join: 2,
        text: 'In addition to generalizing the time slice calculation, the way CFS calculates `vruntime` must also be adapted. Here is the new formula, which takes the actual run time that process *i* has accrued (`runtime`~i~) and scales it inversely by the weight of the process, by dividing the default weight of 1024 (`weight`~0~) by its weight, `weight`~i~.',
      },
      // eq. 9.2: the fraction's numerator "weight_0" was read as a line of code
      { find: 'weight0', code: true, drop: true },
      { find: 'vruntimei = vruntimei', text: '`vruntime`~i~ = `vruntime`~i~ + (`weight`~0~ / `weight`~i~) · `runtime`~i~    (9.2)' },
    ],
  },
  zh: {
    22: [
      {
        find: '那么缓存命中率是 Hits + Misses',
        join: 2,
        text: '我们同时计算缓存命中率：有 6 次命中和 5 次未命中，那么缓存命中率 *Hits* / (*Hits* + *Misses*) 是 6 / (6 + 5)，或 54.5%。也可以计算命中率中除去强制未命中（即忽略页的第一次未命中），那么命中率为 81.8%。',
      },
    ],
  },
};

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|\^([^^\s][^^]*?)\^|~([^~\s][^~]*?)~/g;
const STYLE = ['c', 'b', 'i', 'sup', 'sub'];

/** The inline markup above to runs (the same dialect as src/lib/article.ts, without links). */
export function runsOf(s) {
  const out = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), s: '' });
    const k = m.slice(1).findIndex((g) => g !== undefined);
    out.push({ t: m[k + 1], s: STYLE[k] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), s: '' });
  return out;
}

const plain = (b) => (b.runs ?? []).map((r) => r.t).join('') || b.text || '';

/** Apply the fixes for one chapter in place; returns the finds that matched nothing. */
export function applyFixes(blocks, lang, chap) {
  const missed = [];
  for (const f of FIXES[lang]?.[chap] ?? []) {
    const hits = blocks.flatMap((b, i) => ((f.code ? b.t === 'code' : b.runs) && plain(b).includes(f.find) ? [i] : []));
    if (hits.length !== 1) { missed.push(`${f.find} (${hits.length} matches)`); continue; }
    const i = hits[0];
    if (f.drop) { blocks.splice(i, 1); continue; }
    blocks.splice(i + 1, f.join ?? 0);
    blocks[i].runs = runsOf(f.text);
  }
  return missed;
}
