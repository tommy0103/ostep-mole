<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * One anonymous page's round trip through zram: chosen as a victim, written to /dev/zram0 like any
 * swap write (PTE now not present), compressed into zram's pool, its frame freed; later touched,
 * faulted, decompressed into a free frame, PTE fixed. Twelve frames of physical memory are drawn.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)

const FX = 16
const FW = 27
const fx = (i: number) => FX + i * FW
// frames: A in use by others, P the page, Z zram's pool, . free
const frames = computed(() => {
  const f = 'AAAA.P.AAZZ.'.split('')
  if (s.value >= 3) f[5] = '.'
  if (s.value >= 4) f[6] = 'P'
  return f
})
</script>

<template>
  <svg class="scene-drawing demo" viewBox="0 0 360 440" role="img" :aria-label="L('A page swapped out to zram and back', '一页换出到 zram 再换回')">
    <defs>
      <marker id="zod-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
    </defs>

    <!-- the page's PTE -->
    <text x="16" y="14" class="tag">{{ L('the process’s page-table entry for this page', '进程页表里这一页的表项') }}</text>
    <rect x="16" y="20" width="328" height="34" rx="5" class="box" :class="{ hot: s === 1 || s === 4 || s === 5 }" />
    <text x="28" y="42" class="code">
      {{
        s < 1
          ? L('present = 1 · frame 5', 'present = 1 · 帧 5')
          : s < 5
            ? L('present = 0 · swap location: zram0, slot 12', 'present = 0 · 交换位置：zram0 第 12 槽')
            : L('present = 1 · frame 6', 'present = 1 · 帧 6')
      }}
    </text>

    <!-- kswapd -->
    <g class="fade" :class="{ show: s === 0 }">
      <rect x="16" y="78" width="80" height="34" rx="5" class="box" />
      <text x="56" y="99" class="code c">kswapd</text>
      <path d="M96,100 C130,104 150,118 154,144" class="link solid" marker-end="url(#zod-arrow)" />
      <text x="132" y="96" class="tag">{{ L('picks a victim', '挑一个牺牲页') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 4 }">
      <text x="16" y="96" class="tag hi">{{ L('the program touches the page: page fault', '程序访问这一页：缺页') }}</text>
    </g>

    <!-- physical memory -->
    <text x="16" y="146" class="tag">{{ L('physical memory (12 frames drawn)', '物理内存（画出 12 帧）') }}</text>
    <rect x="13" y="151" width="334" height="38" rx="4" class="box" />
    <g v-for="(k, i) in frames" :key="i">
      <rect :x="fx(i) + 1" y="154" :width="FW - 2" height="32" rx="2" class="frame" :class="'k' + (k === '.' ? 'free' : k)" />
      <text :x="fx(i) + FW / 2" y="200" class="tiny c">{{ i }}</text>
    </g>
    <text :x="fx(5) + FW / 2" y="174" class="tiny c on-fill fade" :class="{ show: s < 3 }">4 KiB</text>
    <text :x="fx(6) + FW / 2" y="174" class="tiny c on-fill fade" :class="{ show: s >= 4 }">4 KiB</text>
    <!-- the compressed copy, in zram's pool -->
    <rect :x="fx(9) + 3" y="160" width="12" height="20" rx="1.5" class="chunk fade" :class="{ show: s >= 2 }" />
    <text :x="fx(10) + 14" y="214" class="tiny c">{{ L('zram’s pool', 'zram 的池') }}</text>
    <text :x="fx(5) + FW / 2" y="214" class="tiny c fade" :class="{ show: s === 3 }">{{ L('free', '空闲') }}</text>

    <!-- /dev/zram0 -->
    <rect x="16" y="262" width="328" height="56" rx="6" class="box gate" />
    <text x="28" y="282" class="lbl">/dev/zram0</text>
    <text x="28" y="300" class="tag">{{ L('a block device: a compressor and a memory allocator', '一个块设备：一个压缩器加一个内存分配器') }}</text>
    <text x="336" y="282" class="tag hi end fade" :class="{ show: s === 2 }">{{ L('compress (CPU)', '压缩（CPU）') }}</text>
    <text x="336" y="282" class="tag hi end fade" :class="{ show: s === 4 }">{{ L('decompress (CPU)', '解压（CPU）') }}</text>

    <!-- the moves -->
    <path :d="`M${fx(5) + FW / 2},190 L${fx(5) + FW / 2},258`" class="call fade" :class="{ show: s === 1 }" marker-end="url(#zod-arrow)" />
    <text :x="fx(5) + FW / 2 + 6" y="240" class="tag fade" :class="{ show: s === 1 }">{{ L('swap write: 4 KiB', '交换写出：4 KiB') }}</text>
    <path :d="`M${fx(9) + 5},258 L${fx(9) + 5},190`" class="call fade" :class="{ show: s === 2 }" marker-end="url(#zod-arrow)" />
    <text :x="fx(9) - 4" y="240" class="tag end fade" :class="{ show: s === 2 }">{{ L('≈ 2 KiB at 2:1', '按 2:1 约 2 KiB') }}</text>
    <path :d="`M${fx(9) + 5},190 C${fx(9) + 5},240 ${fx(6) + 6},240 ${fx(6) + 6},190`" class="call fade" :class="{ show: s === 4 }" marker-end="url(#zod-arrow)" />

    <!-- notes -->
    <g class="fade" :class="{ show: s === 2 }">
      <text x="16" y="346" class="tag hi">{{ L('a page of zeros (or any one repeated value):', '整页都是 0（或同一个重复值）：') }}</text>
      <text x="16" y="362" class="tag">{{ L('recorded as just that value, no memory allocated', '只记下这个值，不分配内存') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 3 }">
      <text x="16" y="346" class="tag hi">{{ L('4 KiB frame freed for ≈ 2 KiB of pool', '腾出 4 KiB 的帧，换来约 2 KiB 的池空间') }}</text>
    </g>
    <g class="fade" :class="{ show: s === 5 }">
      <text x="16" y="346" class="tag hi">{{ L('round trip: a compression and a decompression', '一个来回：一次压缩，一次解压') }}</text>
      <text x="16" y="362" class="tag">{{ L('on disk it would be two I/Os of milliseconds', '若在磁盘上，就是两次以毫秒计的 I/O') }}</text>
    </g>
    <text x="16" y="420" class="tag">{{ L('disk I/O on this path: none', '这条路径上的磁盘 I/O：没有') }}</text>
  </svg>
</template>

<style scoped>
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.tiny.on-fill {
  fill: #fff;
}
.frame {
  stroke: none;
  transition: fill 0.35s;
}
.frame.kA {
  fill: var(--rule-strong);
}
.frame.kP {
  fill: var(--p0);
}
.frame.kZ {
  fill: var(--bg-sunk);
  stroke: var(--p4);
  stroke-width: 1.4;
}
.frame.kfree {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1;
}
.chunk {
  fill: var(--p4);
}
.box.hot {
  stroke: var(--accent);
  stroke-width: 2;
}
.fade {
  opacity: 0;
  transition: opacity 0.35s;
}
.fade.show {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .frame {
    transition: none;
  }
}
</style>
