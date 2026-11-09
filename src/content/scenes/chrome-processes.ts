import type { SceneDef } from './index'

/** The running figure of “Your browser is an operating system for tabs”. */
const scene: SceneDef = {
  height: 420,
  bands: {
    overview: [10, 240],
    isolation: [140, 412],
    privilege: [10, 268],
    crash: [10, 256],
    sandbox: [126, 412],
    zygote: [126, 316],
    ipc: [10, 250],
    shared: [10, 252],
    spectre: [140, 254],
    'site-isolation': [10, 240],
    corb: [140, 310],
    cost: [10, 240],
    bends: [6, 416],
  },
  parts: {
    browser: [16, 62],
    r1: [150, 250],
    r2: [150, 250],
    gpu: [150, 234],
    net: [150, 234],
    ipc: [62, 150],
    kernel: [376, 410],
    sandbox: [124, 246],
    stripes: [198, 232],
    mixed: [198, 214],
    syscalls: [234, 376],
    gate: [300, 328],
    zygote: [238, 312],
    shm: [200, 252],
    spectre: [186, 250],
    corb: [228, 306],
    crash: [158, 250],
  },
  states: {
    overview: {
      title: { en: 'One browser, many processes', zh: '一个浏览器，许多进程' },
      caption: {
        en: 'The browser process owns the windows and the policy. Each site’s pages run in renderer processes of their own; the GPU process and the network service are separate too. To the kernel, every box is an ordinary process.',
        zh: '浏览器进程管窗口和策略；各站点的页面在各自的渲染进程里运行；GPU 进程和网络服务也各自独立。在内核眼里，每个框都只是一个普通进程。',
      },
    },
    isolation: {
      title: { en: 'Walls the hardware enforces', zh: '由硬件把守的墙' },
      caption: {
        en: 'Each process has its own address space: every address it can form leads only to its own memory. The one way out is a system call, and the kernel checks each one.',
        zh: '每个进程都有自己的地址空间：它能构造出的每个地址，都只通向它自己的内存。唯一的出口是系统调用，而内核会检查每一次。',
      },
    },
    privilege: {
      title: { en: 'Who may do what', zh: '谁能做什么' },
      caption: {
        en: 'The browser process runs with your account’s rights but never parses web content. Renderers parse everything from the web but may do almost nothing. The Rule of 2: untrusted input, an unsafe language, high privilege, at most two of the three.',
        zh: '浏览器进程拥有你账户的全部权限，却从不解析网页；渲染进程解析来自网络的一切，却几乎什么都不能做。二选规则：不可信输入、不安全的语言、高权限，三者最多占两个。',
      },
    },
    crash: {
      title: { en: 'A crash stays in its box', zh: '崩溃留在盒子里' },
      caption: {
        en: 'When a renderer dies, the kernel takes back its memory and handles. The browser sees it go, shows a sad tab, and every other process carries on.',
        zh: '一个渲染进程死掉，内核收回它的内存和句柄。浏览器察觉后显示“崩溃”页面，其他进程照常运行。',
      },
    },
    sandbox: {
      title: { en: 'The sandbox', zh: '沙箱' },
      caption: {
        en: 'On Linux, namespaces keep renderers from seeing other processes or the network, and every system call they make passes a seccomp filter first. Anything off its list is refused.',
        zh: '在 Linux 上，命名空间让渲染进程看不到其他进程，也连不上网络；它们发出的每一次系统调用都要先经过 seccomp 过滤器，名单之外的一律拒绝。',
      },
    },
    zygote: {
      title: { en: 'Processes from a template', zh: '从模板复制出来的进程' },
      caption: {
        en: 'The zygote does the start-up work once. Each new renderer is a fork() of it and shares its initialized pages copy-on-write.',
        zh: 'zygote 把启动工作做一次；每个新的渲染进程都是它的一次 fork()，以写时复制的方式共享它已初始化好的页面。',
      },
    },
    ipc: {
      title: { en: 'Every request is checked', zh: '每个请求都要核对' },
      caption: {
        en: 'Whatever a renderer needs, cookies, files or the network, it asks the browser process for over IPC, and the browser checks that this process may have it.',
        zh: '渲染进程需要的一切，Cookie、文件、网络，都要通过 IPC 向浏览器进程申请；浏览器核对这个进程是否有权拿到。',
      },
    },
    shared: {
      title: { en: '2008: sites shared a process', zh: '2008 年：站点共用一个进程' },
      caption: {
        en: 'One renderer per tab, more or less: a news page and the advertising iframe from another site inside it ran in one address space.',
        zh: '大致是一个标签页一个渲染进程：新闻页面和嵌在里面的别家广告 iframe，跑在同一个地址空间里。',
      },
    },
    spectre: {
      title: { en: 'Spectre reads across', zh: 'Spectre 越界读取' },
      caption: {
        en: 'Inside one address space, speculative execution lets one site’s script read another site’s data. Checks made in software cannot stop it.',
        zh: '在同一个地址空间里，推测执行能让一个站点的脚本读到另一个站点的数据，软件里做的检查拦不住。',
      },
      demo: {
        label: { en: 'How timing reveals a value', zh: '计时怎么读出一个值' },
        steps: [
          {
            en: 'Training. The attacker runs the code many times with a valid x. The branch predictor learns that the bounds check always passes.',
            zh: '训练。攻击者先用合法的 x 把这段代码跑很多遍，分支预测器学会了：这个越界检查总是通过。',
          },
          {
            en: 'The plan. Whatever the CPU computes speculatively is thrown away, so the secret can never be read directly. The one trace that survives is which addresses were read, because they stay in the cache. So the value has to be turned into an address.',
            zh: '思路。推测执行算出的东西都会被丢掉，秘密没法直接读出来；唯一能留下的痕迹是“读过哪些地址”，因为读过的地址会留在缓存里。所以要想办法把值变成地址。',
          },
          {
            en: 'Preparation. The attacker does not know the secret, so every possible value gets a slot: 256 for a byte, 4096 bytes apart so each has a cache line of its own. Only one will be touched; the rest are there because nobody knows which. Then every slot is flushed out of the cache.',
            zh: '准备。攻击者不知道秘密是几，只能给每个可能的值都留一个位置：一个字节有 256 种可能，就留 256 个，彼此隔 4096 字节，各占一个缓存行。到时候只会碰其中一个；其余的留着，是因为没人知道会是哪一个。然后把它们全部赶出缓存。',
          },
          {
            en: 'Attack. Now x points past the array, at b.com’s secret. The check is still being computed, but the CPU guesses it passes and speculatively reads a[x]: the secret, 11.',
            zh: '攻击。这次 x 越过了数组，指向 b.com 的秘密。检查还没算完，CPU 就猜它会通过，推测地读出 a[x]，也就是秘密的值 11。',
          },
          {
            en: 'Still speculating, it reads probe[11 × 4096]: the value picks the slot. Slot 11 is brought into the cache. The value 11 has now been written down as a place in the cache.',
            zh: '仍在推测中，它接着读 probe[11 × 4096]：值是几，就碰第几个位置。第 11 个位置被搬进了缓存，值 11 就这样被“记”成了缓存里的一个位置。',
          },
          {
            en: 'The check completes: out of bounds. The CPU throws s and t away, and the program never sees the value. But undoing the work does not empty the cache: slot 11 is still there.',
            zh: '检查结果出来：越界。CPU 丢弃 s 和 t，程序始终看不到这个值。但撤销计算并不会清理缓存：第 11 个位置还在里面。',
          },
          {
            en: 'Measure. The attacker reads every probe slot and times each read. Slot 11 answers in a few nanoseconds, the others in about a hundred. The fast slot’s number is the secret: 11. Then on to the next byte.',
            zh: '测量。攻击者把 probe 的每个位置挨个读一遍并计时：第 11 个只要几纳秒，其他的要一百纳秒左右。快的那一个的编号就是秘密：11。接着对下一个字节再来一遍。',
          },
        ],
      },
    },
    'site-isolation': {
      title: { en: 'One site per process', zh: '一个站点一个进程' },
      caption: {
        en: 'Site Isolation locks each renderer to one site. Another site’s data is not in its address space, so no address leads there.',
        zh: '站点隔离把每个渲染进程锁定在一个站点上。另一个站点的数据不在它的地址空间里，也就没有任何地址通向那里。',
      },
    },
    corb: {
      title: { en: 'Responses are filtered too', zh: '响应也要过滤' },
      caption: {
        en: 'A page can still request another site’s data. The network service filters responses first: another site’s HTML, XML or JSON never reaches a process locked to a different site.',
        zh: '页面仍然可以请求别的站点的数据。网络服务先过滤响应：别的站点的 HTML、XML、JSON 不会送进锁定在另一个站点上的进程。',
      },
      demo: {
        label: { en: 'How CORB and ORB filter', zh: 'CORB 和 ORB 怎么过滤' },
        steps: [
          {
            en: 'A hostile page on a.com adds an <img> whose address is the bank’s account JSON. Tags like <img> may load from any site, and if the bank’s cookies allow cross-site use, they go along.',
            zh: 'a.com 上的恶意页面放了一个 <img>，地址指向银行的账户 JSON。<img> 这类标签可以从任何站点加载；如果银行的 Cookie 允许跨站发送，请求就会带上它。',
          },
          {
            en: 'The bank sees a signed-in user and returns the account data, with Content-Type: application/json.',
            zh: '银行看到的是已登录的你，于是返回账户数据，Content-Type: application/json。',
          },
          {
            en: 'Before 2018 the response went straight into a.com’s renderer. The page could not read it as an image, but it now sat in the process’s memory, where Spectre could reach it.',
            zh: '2018 年以前，这个响应会原样送进 a.com 的渲染进程。页面没法把它当图片读出来，但它已经躺在这个进程的内存里，Spectre 够得着。',
          },
          {
            en: 'CORB: the network service checks first. HTML, XML and JSON are never valid images, scripts or stylesheets, so once the body confirms its type, it is replaced with nothing before the renderer sees it.',
            zh: 'CORB：网络服务先做检查。HTML、XML、JSON 不可能是合法的图片、脚本或样式表，确认响应体确实是这些类型后，就把它换成空的，再交给渲染进程。',
          },
          {
            en: 'ORB turns the rule around. Instead of naming what to block, it lets through only what such tags can use, images, audio, video, scripts and stylesheets, and blocks whatever it cannot recognise as one of them.',
            zh: 'ORB 把规则倒了过来：不再列出要拦什么，而是只放行这类标签用得上的东西——图片、音视频、脚本、样式表——认不出是其中之一的，一律拦下。',
          },
        ],
      },
    },
    cost: {
      title: { en: 'The price', zh: '代价' },
      caption: {
        en: 'Users had about 43% more renderer processes, each about half as large; total memory grew by 9–13%.',
        zh: '用户的渲染进程多了约 43%，每个却小了约一半；总内存增加了 9%～13%。',
      },
    },
    bends: {
      title: { en: 'Where the wall is thin', zh: '墙薄的地方' },
      caption: {
        en: 'Every process shares one kernel, and a kernel bug crosses every boundary at once. The browser and GPU processes see every site’s data, so they are what an attacker wants.',
        zh: '所有进程共用一个内核，一个内核漏洞能一次越过所有边界。浏览器进程和 GPU 进程能看到所有站点的数据，正是攻击者想拿下的目标。',
      },
    },
  },
  terms: {
    pid: ['browser', 'r1', 'r2', 'gpu', 'net'],
    'address-space': ['stripes'],
    'page-table': ['stripes'],
    syscall: ['syscalls', 'kernel'],
    trap: ['syscalls', 'kernel'],
    seccomp: ['gate', 'syscalls'],
    bpf: ['gate'],
    namespace: ['sandbox'],
    'access-token': ['sandbox'],
    'integrity-level': ['sandbox'],
    'job-object': ['sandbox'],
    ipc: ['ipc'],
    handle: ['ipc', 'browser'],
    'oom-kill': ['crash', 'kernel'],
    'shared-memory': ['shm'],
    driver: ['gpu'],
    zygote: ['zygote'],
    'fork-exec': ['zygote'],
    'copy-on-write': ['zygote', 'stripes'],
    iframe: ['stripes', 'mixed'],
    origin: ['stripes'],
    principal: ['stripes'],
    spectre: ['spectre', 'mixed', 'stripes'],
    corb: ['corb', 'net'],
    'cpu-cache': ['spectre'],
    sharedarraybuffer: ['spectre'],
    thread: ['r1'],
  },
}

export default scene
