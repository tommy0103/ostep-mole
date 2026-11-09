import type { Term } from './index'

/** Terms of “What malloc really is today”. */
const terms: Record<string, Term> = {
  heroku: {
    title: { en: 'Heroku', zh: 'Heroku' },
    body: {
      en: 'A cloud platform on which developers deploy web applications without running their own servers. Applications run in Linux [[container|containers]] that it manages.',
      zh: '一个云平台，开发者把 Web 应用部署上去，不必自己管服务器。应用运行在它管理的 Linux [[container|容器]]里。',
    },
  },
  'env-var': {
    title: { en: 'Environment variable', zh: '环境变量' },
    body: {
      en: 'A named string that a process receives when it starts, normally inherited from its parent. Programs and libraries read such variables for settings; glibc’s allocator reads `MALLOC_ARENA_MAX` this way.',
      zh: '进程启动时收到的一个带名字的字符串，通常继承自父进程。程序和库从这里读取设置，glibc 的分配器就是这样读取 `MALLOC_ARENA_MAX` 的。',
    },
    chapter: 'cpu-api',
  },
  'freebsd-solaris': {
    title: { en: 'FreeBSD and Solaris', zh: 'FreeBSD 与 Solaris' },
    body: {
      en: 'Two operating systems descended from Unix, relatives of Linux in design. FreeBSD is open source; Solaris was Sun Microsystems’ commercial Unix, now Oracle’s.',
      zh: '两个源自 Unix 的操作系统，在设计上与 Linux 是亲戚。FreeBSD 是开源的；Solaris 是 Sun 公司的商业 Unix，如今归 Oracle 所有。',
    },
  },
  gil: {
    title: { en: 'Global interpreter lock (GIL)', zh: '全局解释器锁（GIL）' },
    body: {
      en: 'A [[lock|lock]] in the standard Python interpreter, CPython, that lets only one [[thread|thread]] run Python code at a time. Much of the interpreter relies on it for safety, so a build without it needs thread-safe parts, including its allocator.',
      zh: '标准 Python 解释器 CPython 里的一把[[lock|锁]]，同一时刻只让一个[[thread|线程]]运行 Python 代码。解释器的很多部分靠它保证安全，所以去掉它的构建需要线程安全的组件，分配器也不例外。',
    },
  },
  dentry: {
    title: { en: 'Dentry', zh: 'dentry（目录项）' },
    body: {
      en: 'Directory entry: the Linux kernel’s in-memory record linking one name in a path to its [[inode|inode]]. The kernel caches them so that looking up a path need not read the directories from disk each time.',
      zh: 'directory entry（目录项）：Linux 内核在内存里保存的一条记录，把路径中的一个名字和它的 [[inode|inode]] 联系起来。内核会缓存它们，这样查找路径时就不必每次都从磁盘读目录。',
    },
  },
}

export default terms
