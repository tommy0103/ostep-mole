import type { Term } from './index'

/** Terms of the bounds article (“Base and bounds never really died”). */
const terms: Record<string, Term> = {
  'wasm-trap': {
    title: { en: 'Trap (WebAssembly)', zh: '陷入（WebAssembly）' },
    body: {
      en: 'In [[webassembly|WebAssembly]], an error that stops the module’s execution at once, such as an out-of-bounds memory access or an integer division by zero. Control goes back to the host, the browser or runtime, which reports the error.',
      zh: '在 [[webassembly|WebAssembly]] 里，一种让模块立即停止执行的错误，比如内存越界访问、整数除以零。控制权回到宿主（浏览器或运行时），由它报告错误。',
    },
  },
  sandbox: {
    title: { en: 'Sandbox', zh: '沙箱' },
    body: {
      en: 'A restricted environment for running code you do not trust, set up so that whatever the code does, it can reach only the memory and resources it was given.',
      zh: '运行不受信任代码的受限环境：无论代码做什么，它都只能碰到分配给它的内存和资源。',
    },
  },
  nacl: {
    title: { en: 'Native Client (NaCl)', zh: 'Native Client（NaCl）' },
    body: {
      en: 'Google’s system, announced at the end of 2008, for running compiled C and C++ code in the browser inside a software [[sandbox|sandbox]]. Its role later passed to [[webassembly|WebAssembly]].',
      zh: 'Google 2008 年底发布的系统，让编译好的 C 和 C++ 代码在浏览器里的软件[[sandbox|沙箱]]中运行。后来它的角色由 [[webassembly|WebAssembly]] 接替。',
    },
    note: 'bounds-revival',
  },
  segmentation: {
    title: { en: 'Segmentation', zh: '分段' },
    body: {
      en: 'Dividing an address space into several variable-sized pieces, such as code, heap and stack, each with its own base and bounds. The hardware picks the segment for each address, checks the address against that segment’s limit and adds its base.',
      zh: '把地址空间分成几块大小不一的部分，比如代码、堆和栈，每块有自己的基址和界限。硬件为每个地址选出它所属的段，拿地址和该段的界限比较，再加上段的基址。',
    },
    chapter: 'vm-segmentation',
    note: 'fs-gs',
  },
  v8: {
    title: { en: 'V8', zh: 'V8' },
    body: {
      en: 'Google’s JavaScript and [[webassembly|WebAssembly]] engine, used in Chrome and in [[nodejs|Node.js]].',
      zh: 'Google 的 JavaScript 和 [[webassembly|WebAssembly]] 引擎，Chrome 和 [[nodejs|Node.js]] 都用它。',
    },
  },
  nodejs: {
    title: { en: 'Node.js', zh: 'Node.js' },
    body: {
      en: 'A runtime for JavaScript outside the browser, for example on servers, built on the [[v8|V8]] engine.',
      zh: '在浏览器之外（比如在服务器上）运行 JavaScript 的运行时，建立在 [[v8|V8]] 引擎之上。',
    },
  },
  gcc: {
    title: { en: 'GCC', zh: 'GCC' },
    body: {
      en: 'The GNU Compiler Collection, the C and C++ compiler most Linux distributions are built with.',
      zh: 'GNU 编译器套件（GNU Compiler Collection），大多数 Linux 发行版都用这套 C 和 C++ 编译器构建。',
    },
  },
  instrumentation: {
    title: { en: 'Instrumentation', zh: '插桩（instrumentation）' },
    body: {
      en: 'Extra code a compiler or tool inserts into a program to check or record what it does, such as a bounds check before each memory access. Code built without it runs unchecked.',
      zh: '编译器或工具往程序里插入的额外代码，用来检查或记录程序的行为，比如在每次访存之前做一次界限检查。没有插桩的代码，运行时就不受检查。',
    },
  },
  multics: {
    title: { en: 'Multics', zh: 'Multics' },
    body: {
      en: 'An influential time-sharing operating system developed from the mid-1960s by MIT, General Electric and Bell Labs. It combined [[segmentation|segmentation]] with paging.',
      zh: '一个影响深远的分时操作系统，由 MIT、通用电气和贝尔实验室从 20 世纪 60 年代中期开始开发。它把[[segmentation|分段]]和分页结合在一起。',
    },
  },
}

export default terms
