import type { SceneDef } from './index'

/** The running figure of “Four levels, then five”. */
const scene: SceneDef = {
  height: 430,
  bands: {
    overview: [0, 350],
    four: [0, 148],
    canonical: [290, 350],
    sparse: [84, 292],
    fifth: [0, 208],
    linux: [84, 190],
    optin: [290, 380],
    direct: [290, 428],
    cached: [84, 226],
    nested: [84, 270],
    grid: [84, 296],
    grid35: [84, 296],
    hostpages: [84, 296],
  },
  parts: {
    addr: [6, 40],
    tlb: [42, 86],
    cr3: [90, 142],
    pml5: [90, 142],
    pml4: [90, 142],
    pdpt: [90, 142],
    pd: [90, 142],
    pt: [90, 142],
    data: [90, 142],
    space: [290, 346],
    walkcache: [150, 204],
    hostbox: [176, 246],
    grid: [150, 296],
    names: [144, 176],
  },
  states: {
    overview: {
      title: { en: 'A tree of page tables', zh: '一棵页表树' },
      caption: {
        en: 'A TLB miss walks a four-level tree from CR3 down to the data page, one memory reference per level. Of a 64-bit address, 48 bits count. The kernel’s half of the address space holds a map of all physical memory, with room for 64 TiB.',
        zh: 'TLB 未命中时，从 CR3 出发沿四级的树走到数据页，每级一次内存访问。64 位地址里只有 48 位有效。地址空间的内核那一半放着全部物理内存的映射，容量是 64 TiB。',
      },
    },
    four: {
      title: { en: 'Four levels, 9 bits each', zh: '四级，每级 9 位' },
      caption: {
        en: 'A table is one 4 KiB page of 8-byte entries, so it holds 512 and each level uses 9 bits of the address; with the 12-bit offset that makes 48. CR3 is the one register needed. A miss reads one entry per level, four references before the access itself. Under each name is what one entry maps.',
        zh: '一张表就是一个 4 KiB 的页，表项 8 字节，所以有 512 项，每级用掉地址的 9 位；加上 12 位偏移，正好 48 位。只需要 CR3 这一个寄存器。未命中时每级读一项，在真正的访问之前共四次。名字下面是一个表项映射的大小。',
      },
    },
    canonical: {
      title: { en: 'Canonical addresses', zh: '规范地址' },
      caption: {
        en: 'Bits 63 to 48 must all be copies of bit 47. That leaves two 128 TiB halves with an enormous hole between them. Linux gives the lower half to user space and keeps the upper half for the kernel. The bar is not to scale.',
        zh: '第 63 到 48 位必须全是第 47 位的复制。于是只剩两个 128 TiB 的半区，中间隔着一个巨大的空洞。Linux 把下半区给用户空间，上半区留给内核。这根条没有按比例画。',
      },
    },
    sparse: {
      title: { en: 'A sparse tree', zh: '稀疏的树' },
      caption: {
        en: 'Only the tables on paths actually used exist. A missing table costs no memory: an unused region, however large, costs one empty entry higher up. This is why the tree keeps scaling.',
        zh: '只有真正用到的路径上才有表。缺失的表不占内存：一块用不到的区域，再大也只花上一级的一个空表项。这棵树能一直扩展，靠的就是这一点。',
      },
    },
    fifth: {
      title: { en: 'A fifth table on top', zh: '顶上再加一张表' },
      caption: {
        en: 'LA57 adds the PML5 above the PML4, one more 9-bit index: 57 bits, 128 PiB of virtual space, each PML5 entry mapping 256 TiB, the whole old address space. CR3 now points at the PML5. Physical addresses grow to 52 bits, 4 PiB.',
        zh: 'LA57 在 PML4 之上加了 PML5，多一个 9 位索引：57 位，128 PiB 虚拟空间，每个 PML5 表项映射 256 TiB，也就是整个旧的地址空间。CR3 现在指向 PML5。物理地址增长到 52 位，即 4 PiB。',
      },
    },
    linux: {
      title: { en: 'One kernel, either depth', zh: '同一个内核，两种层数' },
      caption: {
        en: 'Linux’s page-table code always walks pgd → p4d → pud → pmd → pte. On a machine with four levels the p4d is folded: a p4d “table” is just the pgd entry seen through another type, and the step costs nothing.',
        zh: 'Linux 的页表代码总是按 pgd → p4d → pud → pmd → pte 遍历。在四级的机器上，p4d 被折叠：所谓 p4d“表”，只是换了个类型来看的 pgd 表项，这一步不花任何代价。',
      },
    },
    optin: {
      title: { en: 'User space opts in', zh: '用户空间主动申请' },
      caption: {
        en: 'Some programs keep their own data in a pointer’s high bits, so even on a five-level machine Linux hands out user addresses below 2^47 by default. A program passes mmap() a hint above that line to opt in, one mapping at a time.',
        zh: '有些程序把自己的数据放在指针的高位，所以即便在五级页表的机器上，Linux 默认也只分配 2^47 以下的用户地址。程序给 mmap() 传一个高于这条线的提示地址，就能一个映射一个映射地主动申请。',
      },
    },
    direct: {
      title: { en: 'What the fifth level buys', zh: '第五级换来了什么' },
      caption: {
        en: 'Few programs ask for the 64 PiB user half. The main beneficiary is the kernel’s direct map of physical memory, which grows from 64 TiB to 32 PiB.',
        zh: '很少有程序去申请 64 PiB 的用户半区。真正受益的是内核对物理内存的直接映射区：从 64 TiB 增长到 32 PiB。',
      },
    },
    cached: {
      title: { en: 'Walks start near the bottom', zh: '遍历从底部附近开始' },
      caption: {
        en: 'A fifth level ought to add a reference to every miss. But processors keep the upper levels in page-walk caches, and a process uses very few upper entries: one PML5 entry, one or two PML4 entries for a few hundred gigabytes. Most walks skip to a low table.',
        zh: '第五级本该给每次未命中都添一次访问。但处理器把上面几级放在页表遍历缓存里，而一个进程用到的上层表项极少：一个 PML5 表项，映射几百 GB 时也只有一两个 PML4 表项。大多数遍历都能直接跳到较低的某张表。',
      },
    },
    nested: {
      title: { en: 'A tree under a tree', zh: '树下还有一棵树' },
      caption: {
        en: 'A guest OS maps guest virtual addresses to what it believes are physical ones, guest physical addresses. The hypervisor’s table (EPT on Intel, nested page tables on AMD) maps those to host physical addresses. Every pointer in the guest’s table, CR3 included, is guest physical.',
        zh: '客户机操作系统把客户机虚拟地址映射到它以为的物理地址，即客户机物理地址；虚拟机监控程序的表（Intel 叫 EPT，AMD 叫嵌套页表）再把它们映射到宿主机物理地址。客户机页表里的每个指针，包括 CR3，都是客户机物理地址。',
      },
    },
    grid: {
      title: { en: 'The grid: 24 references', zh: '网格：24 次访问' },
      caption: {
        en: 'Each column is one guest step: a full host walk to find where the table really is, then a read of the guest’s entry. Five host walks of four references, plus four guest entries, make 24: six times a native walk. The data access itself is not counted.',
        zh: '每一列是客户机的一步：先做一整趟宿主机遍历，查出这张表真正在哪里，再读客户机的表项。5 趟宿主机遍历各 4 次，加上 4 个客户机表项，共 24 次，是原生遍历的六倍。对数据本身的访问不计入。',
      },
      demo: {
        label: { en: 'Counting the 24', zh: '数出这 24 次' },
        steps: [
          {
            en: 'The guest’s CR3 holds the guest physical address of its PML4. Before the hardware can use it, it translates that address through the host’s four-level table. Four references.',
            zh: '客户机的 CR3 存着它的 PML4 的客户机物理地址。硬件要用它，得先经过宿主机的四级页表把它转换一遍。四次访问。',
          },
          {
            en: 'Now it knows where the guest’s PML4 really is, and reads the guest’s entry from it. One more: 5 so far.',
            zh: '现在知道了客户机的 PML4 实际在哪里，于是读出客户机的表项。再加一次：目前 5 次。',
          },
          {
            en: 'That entry holds the guest physical address of the PDPT. Another full host walk, then the PDPT entry: 10 so far.',
            zh: '这个表项存着 PDPT 的客户机物理地址。又是一整趟宿主机遍历，然后读 PDPT 的表项：目前 10 次。',
          },
          {
            en: 'The same again for the PD: 15 so far.',
            zh: '对 PD 再来一遍：目前 15 次。',
          },
          {
            en: 'And for the PT: 20 so far. The PT entry gives the guest physical address of the data.',
            zh: '对 PT 也一样：目前 20 次。PT 的表项给出数据的客户机物理地址。',
          },
          {
            en: 'One last host walk turns that into a host physical address: 24. The access to the data is what the program asked for, so it is the one corner of the grid not counted.',
            zh: '最后一趟宿主机遍历把它变成宿主机物理地址：24 次。对数据的访问是程序本来就要做的，所以网格里只有这个角不计入。',
          },
        ],
      },
    },
    grid35: {
      title: { en: 'Five by five: 35', zh: '五乘五：35' },
      caption: {
        en: 'With five levels in both dimensions the grid has six columns of five host references, plus five guest entries: 35, eleven more than 24. Caches keep this worst case rare, and a TLB hit skips the whole grid.',
        zh: '两个维度都是五级时，网格有 6 列、每列 5 次宿主机访问，再加 5 个客户机表项：35 次，比 24 多 11 次。缓存让这种最坏情况很少出现；TLB 一旦命中，整张网格都可以跳过。',
      },
    },
    hostpages: {
      title: { en: 'Shorter host walks', zh: '更短的宿主机遍历' },
      caption: {
        en: 'If the host backs guest memory with 2 MiB pages, every host walk stops a level early and the grid loses a row: 19 references. With 1 GiB pages it loses two: 14. Hence the advice to use huge pages on the host.',
        zh: '宿主机用 2 MiB 的页来承载客户机内存时，每趟宿主机遍历都提前一级结束，网格少了一行：19 次。用 1 GiB 的页就少两行：14 次。所以建议在宿主机上使用大页。',
      },
    },
  },
  terms: {
    cr3: ['cr3'],
    'page-walk': ['pml4', 'pdpt', 'pd', 'pt'],
    'direct-map': ['space'],
    'linux-pt-levels': ['names'],
    'page-walk-cache': ['walkcache'],
    hypervisor: ['hostbox'],
    tlb: ['tlb'],
  },
}

export default scene
