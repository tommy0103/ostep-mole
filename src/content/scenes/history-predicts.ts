import type { SceneDef } from './index'

/** The running figure of “Approximating an oracle with history”. */
const scene: SceneDef = {
  height: 396,
  bands: {
    overview: [6, 392],
    oracle: [6, 294],
    parts: [80, 392],
    mlfq: [80, 392],
    ewma: [6, 392],
    rto: [6, 392],
    cwnd: [80, 392],
    bbr: [80, 392],
    branch: [80, 392],
    spectre: [6, 392],
    arc: [6, 392],
    readahead: [6, 392],
    fails: [80, 392],
    advice: [80, 392],
  },
  parts: {
    strip: [8, 68],
    sum: [84, 302],
    upd: [84, 186],
    fgt: [200, 302],
    pred: [326, 386],
    out: [326, 386],
    cards: [86, 206],
    ewma: [84, 302],
    bbr: [84, 302],
    branch: [84, 302],
    spectre: [84, 302],
  },
  states: {
    overview: {
      title: { en: 'A small prediction loop', zh: '一个小小的预测循环' },
      caption: {
        en: 'A TCP sender folds each round-trip sample into an estimate, sets a timer from it, and when the timer fires decides its model is wrong. Summarise the recent past, predict the near future, reset when the prediction fails: every system below is this loop.',
        zh: 'TCP 发送方把每个往返样本并入估计值，据此设定定时器；定时器一触发，就认定自己的模型错了。概括最近的过去，预测不久的将来，失败时重置：下面每个系统都是这个循环。',
      },
    },
    oracle: {
      title: { en: 'The oracle problem', zh: '先知问题' },
      caption: {
        en: 'SJF and STCF need to know how long each job will run; Belady’s optimal policy needs to know which page is used furthest ahead. Nothing can see right of “now”, so MLFQ and LRU use the past as a stand-in. That works when workloads have phases.',
        zh: 'SJF 和 STCF 需要知道每个任务要运行多久；Belady 的最优策略需要知道哪一页最晚才会被用到。谁也看不见“现在”的右边，所以 MLFQ 和 LRU 拿过去来顶替。当负载存在阶段时，这很管用。',
      },
    },
    parts: {
      title: { en: 'Three parts', zh: '三个部分' },
      caption: {
        en: 'Every predictor here has a summary of the past, small and cheap to update; an update rule; and a way to forget. The third part is where most of the engineering ends up.',
        zh: '这里每个预测器都有：一个小而更新便宜的、对过去的概括；一条更新规则；一种遗忘的办法。大部分工程功夫，最后都花在第三部分上。',
      },
    },
    mlfq: {
      title: { en: 'MLFQ as a predictor', zh: '作为预测器的 MLFQ' },
      caption: {
        en: 'The summary is a job’s queue level and the allotment it has used there. A job starts optimistic, at the top (Rule 3), and sinks as it uses its allotment (Rule 4). Rule 5, the boost, throws all the predictions away every period S.',
        zh: '概括就是任务所在的队列层级和它在这一层用掉的配额。任务乐观地从最高层起步（规则 3），用完配额就下沉（规则 4）。规则 5 的提升，每隔 S 把所有预测一笔勾销。',
      },
    },
    ewma: {
      title: { en: 'One number that remembers', zh: '一个会记忆的数' },
      caption: {
        en: 'The textbook example with α = 1/2: bars are the actual bursts, the line is the prediction. When the bursts jump to 13 the prediction is wrong by 8, then halves its error each step: 9, 11, 12. Nobody resets it.',
        zh: '教科书的例子，α = 1/2：柱子是实际的突发长度，折线是预测值。突发跳到 13 时，预测错了 8，然后每一步把误差减半：9、11、12。没有人去重置它。',
      },
    },
    rto: {
      title: { en: 'TCP’s timer learns', zh: 'TCP 的定时器会学习' },
      caption: {
        en: 'The article’s worked update: a connection settled at SRTT 100 ms and RTTVAR 10 ms sees one sample of 180 ms. The mean moves by 10 ms, the timeout by 80 ms, because the deviation counts four times.',
        zh: '文中手算的那次更新：一条稳定在 SRTT 100 ms、RTTVAR 10 ms 的连接遇到一个 180 ms 的样本。均值只动了 10 ms，超时却动了 80 ms，因为偏差要乘以四。',
      },
    },
    cwnd: {
      title: { en: 'A window that resets', zh: '会重置的窗口' },
      caption: {
        en: 'The congestion window is a slow-moving estimate of capacity: about one segment more per round trip, roughly halved on a loss. A timeout is taken as proof the model is badly wrong, and the window drops to one segment. The shape is simplified.',
        zh: '拥塞窗口是对容量的缓慢估计：每个往返约多一个报文段，丢包时大致减半。一次超时被当作模型错得离谱的证据，窗口降到一个报文段。曲线形状是简化的。',
      },
    },
    bbr: {
      title: { en: 'BBR forgets on purpose', zh: 'BBR 有意遗忘' },
      caption: {
        en: 'BBR keeps two filtered numbers: the recent maximum delivery rate and the minimum RTT of the last 10 seconds. A busy sender keeps a queue that hides the true delay, so when the minimum goes stale BBR cuts the data in flight for at least 200 ms and measures afresh. The curves are a sketch.',
        zh: 'BBR 只记两个滤波后的数：近期最大投递速率，和过去 10 秒的最小 RTT。忙碌的发送方总有队列，遮住了真实时延；所以最小值过时后，BBR 把在途数据压低至少 200 ms，重新测量。曲线只是示意。',
      },
    },
    branch: {
      title: { en: 'History in silicon', zh: '刻在硅片里的历史' },
      caption: {
        en: 'A two-bit counter goes up when the branch is taken and down when it is not, and predicts “taken” in states 2 and 3. One surprise only weakens it, which is the hysteresis the second bit buys.',
        zh: '两位计数器在分支跳转时加一，不跳转时减一，处于 2 和 3 时预测“跳转”。一次意外只是把它削弱一下，这就是第二位换来的迟滞。',
      },
      demo: {
        label: { en: 'A loop of ten, one bit against two', zh: '十次循环：一位对两位' },
        steps: [
          {
            en: 'One branch at the bottom of a loop. It is taken nine times to go round again, and not taken once to leave. Then the whole loop runs again, so the top row is the sequence the predictor has to guess.',
            zh: '循环底部的一个分支。跳转九次，绕回去继续；第十次不跳转，退出循环。然后整个循环再跑一轮。上面这一行，就是预测器要猜的序列。',
          },
          {
            en: 'A one-bit predictor remembers only the last outcome. Through the run the last outcome was “taken”, so it guesses “taken” and is right.',
            zh: '一位预测器只记最后一次的结果。这一轮里最后一次都是“跳转”，所以它猜“跳转”，都猜对了。',
          },
          {
            en: 'The exit. The guess “taken” is wrong: the first miss. The one bit now flips to “not taken”.',
            zh: '退出。猜“跳转”，猜错了：第一次未命中。这一位随之翻成“不跳转”。',
          },
          {
            en: 'The next run’s first iteration is taken, but the bit still says “not taken”: a second miss. Every run costs two.',
            zh: '下一轮的第一次是跳转，可这一位还写着“不跳转”：第二次未命中。每一轮都要错两次。',
          },
          {
            en: 'Now a two-bit counter, for the same branch. Through the run it sits at 3, and states 2 and 3 predict “taken”, so it is right.',
            zh: '换成两位计数器，还是这个分支。这一轮里它停在 3，而处于 2 和 3 时预测“跳转”，所以都猜对了。',
          },
          {
            en: 'The exit is a miss here too. But it only moves the counter from 3 to 2, which is still on the “taken” side.',
            zh: '退出时它一样猜错。但这只把计数器从 3 减到 2，仍在“跳转”这一边。',
          },
          {
            en: 'So the next run’s first iteration is predicted “taken”, and it is right. One miss per run instead of two, and the counter climbs back to 3.',
            zh: '于是下一轮的第一次仍预测“跳转”，猜对了。每轮只错一次，而不是两次，计数器也重新升回 3。',
          },
        ],
      },
    },
    spectre: {
      title: { en: 'Feeding it bad history', zh: '喂给它误导性的历史' },
      caption: {
        en: 'A branch predictor learns from whatever ran on the core. In Spectre variant 2 an attacker trains it on purpose, so a victim’s indirect branch speculatively jumps to code the attacker chose. IBPB is the reset: it clears the branch target buffer.',
        zh: '分支预测器从这个核心上跑过的任何代码中学习。在 Spectre 第 2 变种里，攻击者故意训练它，让受害者的间接分支在推测执行时跳到攻击者选定的代码上。IBPB 就是重置：它清空分支目标缓冲区。',
      },
    },
    arc: {
      title: { en: 'ARC watches its mistakes', zh: 'ARC 盯着自己的错误' },
      caption: {
        en: 'One list for pages seen once recently, one for pages seen more than once, and a memory of what was recently evicted from each. A miss on a page it just threw away says the split between the lists is wrong, so the space shifts.',
        zh: '一个链表记最近只见过一次的页，一个记见过不止一次的页，再记住最近从两边各淘汰了哪些页。在刚扔掉的页上未命中，说明两个链表的划分错了，空间就挪过去。',
      },
    },
    readahead: {
      title: { en: 'A window that bets ahead', zh: '往前押注的窗口' },
      caption: {
        en: 'Linux’s readahead watches each open file. A first read sets an initial window, capped at the maximum, commonly 128 KB. Each time the sequential pattern holds the next window is scaled up, usually doubled; when the stream misses and restarts, so does the window.',
        zh: 'Linux 的预读监视每个打开的文件。第一次读取设定一个初始窗口，以最大值为限，常见的最大值是 128 KB。顺序模式每保持一次，下一个窗口就放大，通常翻倍；顺序流未命中、重新开始时，窗口也重新开始。',
      },
    },
    fails: {
      title: { en: 'Three ways to lose', zh: '三种押错的方式' },
      caption: {
        en: 'The workload changes phase, someone games the rule, or the history goes stale. Each part of the loop has grown a defence against one of them.',
        zh: '负载换了阶段，有人钻规则空子，或者历史过时了。循环的每个部分，都长出了对付其中一种的办法。',
      },
    },
    advice: {
      title: { en: 'Or just ask', zh: '或者干脆去问' },
      caption: {
        en: 'The alternative to predicting is asking: nice, madvise, posix_fadvise, QoS classes, EEVDF’s slice requests. Real systems do both, asking when the program knows and guessing from history when it does not, with a reset ready for when the guess goes wrong.',
        zh: '预测之外的另一条路是去问：nice、madvise、posix_fadvise、QoS 类别、EEVDF 的时间片请求。真实系统两样都做：程序知道的时候就问，不知道的时候就从历史里猜，再备好一次重置，留给猜错的时候。',
      },
    },
  },
  terms: {
    rtt: ['strip'],
    ack: ['strip'],
    'congestion-window': ['fgt'],
    'cpu-burst': ['ewma'],
    bbr: ['bbr'],
    btb: ['spectre'],
    'indirect-branch': ['spectre'],
  },
}

export default scene
