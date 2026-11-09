<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import SpectreDemo from './SpectreDemo.vue'
import CorbDemo from './CorbDemo.vue'

/**
 * The running figure of the browser-process article: the browser, two sites’ renderers, the GPU
 * process and the network service above one kernel. Each state shows the parts the passage is
 * about; `lit` parts (a term the reader clicked) are drawn in the accent colour. Calls, messages
 * and forks move along their paths; while a demo plays, its own drawing takes over.
 */
const props = defineProps<DrawingProps>()
const IPC = [
  { path: 'M64,150 L142,62', from: 'r1' },
  { path: 'M172,150 L172,62', from: 'r2' },
  { path: 'M262,150 L214,62', from: 'gpu' },
  { path: 'M322,150 L236,62', from: 'net' },
]

const SHOW: Record<string, string[]> = {
  overview: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel'],
  isolation: ['browser', 'r1', 'r2', 'gpu', 'net', 'kernel', 'stripes', 'syscalls'],
  privilege: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'priv'],
  crash: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'crash', 'shm'],
  sandbox: ['browser', 'r1', 'r2', 'gpu', 'net', 'kernel', 'sandbox', 'syscalls', 'gate', 'blocked'],
  zygote: ['browser', 'r1', 'r2', 'gpu', 'net', 'kernel', 'sandbox', 'zygote', 'stripes'],
  ipc: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'sandbox', 'checks'],
  shared: ['browser', 'r1', 'gpu', 'net', 'ipc', 'kernel', 'stripes', 'mixed'],
  spectre: ['browser', 'r1', 'gpu', 'net', 'kernel', 'stripes', 'mixed', 'spectre'],
  'site-isolation': ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'stripes', 'lock'],
  corb: ['browser', 'r1', 'r2', 'gpu', 'net', 'kernel', 'stripes', 'lock', 'corb'],
  cost: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'stripes', 'lock'],
  bends: ['browser', 'r1', 'r2', 'gpu', 'net', 'ipc', 'kernel', 'stripes', 'lock', 'prize'],
}
const { shown, part, L, viewBox, still } = useDrawing(props, SHOW, 420)
const mixed = computed(() => shown.value.has('mixed') && !shown.value.has('r2'))
</script>

<template>
  <SpectreDemo v-if="demo && state === 'spectre'" :step="step ?? 0" :lang="lang" />
  <CorbDemo v-else-if="demo && state === 'corb'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('Browser processes above the kernel', '内核之上的浏览器各进程')">
    <defs>
      <marker id="cp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <!-- a renderer locked to its site -->
      <g id="cp-lock">
        <path d="M2.5,5 V3.5 a2.5,2.5 0 0 1 5,0 V5" class="shackle" />
        <rect x="1" y="5" width="8" height="6" rx="1.2" class="lockbody" />
      </g>
    </defs>

    <!-- the kernel under everything -->
    <g :class="part('kernel')">
      <rect x="8" y="376" width="344" height="34" rx="6" class="box floor" />
      <text x="180" y="397" class="lbl c">{{ L('Kernel', '内核') }}</text>
    </g>

    <!-- the sandbox around the renderers -->
    <g :class="part('sandbox')">
      <rect x="8" y="138" width="222" height="108" rx="9" class="outline" />
      <text x="14" y="132" class="tag">{{ L('sandbox · namespaces', '沙箱 · 命名空间') }}</text>
    </g>

    <!-- IPC: everything a renderer wants goes through the browser -->
    <g :class="part('ipc')">
      <!-- a line only for a process that is drawn -->
      <path v-for="l in IPC" :key="l.path" :d="l.path" class="link" :class="{ gone: !shown.has(l.from) }" />
      <text x="96" y="104" class="tag">IPC</text>
      <!-- messages travelling to the browser (started in the past, so none waits at the origin) -->
      <template v-if="!still">
        <circle v-for="(l, i) in IPC" :key="'m' + l.path" r="2.6" class="dot msg" :class="{ gone: !shown.has(l.from) }">
          <animateMotion :path="l.path" dur="2.4s" :begin="-i * 0.6 + 's'" repeatCount="indefinite" />
        </circle>
      </template>
      <g :class="part('checks')">
        <circle cx="146" cy="74" r="6" class="check" />
        <path d="M143,74 l2,2 l4,-4" class="tick" />
        <circle cx="176" cy="74" r="6" class="check" />
        <path d="M173,74 l2,2 l4,-4" class="tick" />
      </g>
    </g>

    <!-- the browser process -->
    <g :class="part('browser')">
      <rect x="110" y="16" width="140" height="46" rx="6" class="box strong" />
      <text x="180" y="36" class="lbl c">{{ L('Browser process', '浏览器进程') }}</text>
      <text x="180" y="52" class="sub c">{{ L('UI · policy', '界面 · 策略') }}</text>
    </g>
    <g :class="part('priv')">
      <text x="258" y="34" class="tag hi">{{ L('full rights', '全部权限') }}</text>
      <text x="118" y="262" class="tag c">{{ L('almost no rights', '几乎没有权限') }}</text>
    </g>

    <!-- renderer for site A (in 2008, with site B's ad inside) -->
    <g :class="part('r1')">
      <rect x="16" y="150" width="96" height="84" rx="6" class="box" />
      <text x="64" y="168" class="lbl c">{{ L('Renderer', '渲染进程') }}</text>
      <text x="64" y="184" class="sub c">{{ mixed ? L('a.com + ad', 'a.com + 广告') : 'a.com' }}</text>
      <g :class="part('stripes')">
        <rect v-if="!mixed" x="24" y="198" width="80" height="16" rx="2" class="site a" />
        <template v-else>
          <rect x="24" y="198" width="40" height="16" rx="2" class="site a" />
          <rect x="64" y="198" width="40" height="16" rx="2" class="site b" />
        </template>
        <text x="64" y="228" class="sub c">{{ L('address space', '地址空间') }}</text>
      </g>
      <g :class="part('lock')"><use href="#cp-lock" x="96" y="155" /></g>
      <g :class="part('spectre')">
        <path d="M44,198 C50,186 78,186 84,196" class="danger" marker-end="url(#cp-arrow)" />
        <text x="64" y="246" class="tag bad-text c">{{ L('reads site B', '读到 b.com 的数据') }}</text>
      </g>
    </g>

    <!-- renderer for site B -->
    <g :class="[...part('r2'), { shake: shown.has('crash') && !still }]">
      <rect x="124" y="150" width="96" height="84" rx="6" class="box" :class="{ dead: shown.has('crash') }" />
      <text x="172" y="168" class="lbl c" :class="{ dead: shown.has('crash') }">{{ L('Renderer', '渲染进程') }}</text>
      <text x="172" y="184" class="sub c">b.com</text>
      <g :class="part('stripes')"><rect x="132" y="198" width="80" height="16" rx="2" class="site b" :class="{ dead: shown.has('crash') }" /></g>
      <g :class="part('lock')"><use href="#cp-lock" x="204" y="155" /></g>
      <g :class="part('crash')">
        <path d="M134,158 L210,226 M210,158 L134,226" class="danger" />
        <text x="172" y="246" class="tag bad-text c">{{ L('crashed: sad tab', '崩溃：显示哭脸页') }}</text>
      </g>
    </g>

    <!-- GPU process and network service -->
    <g :class="part('gpu')">
      <rect x="236" y="150" width="52" height="84" rx="6" class="box" />
      <text x="262" y="168" class="lbl c">GPU</text>
      <text x="262" y="184" class="sub c">{{ L('driver', '驱动') }}</text>
    </g>
    <g :class="part('net')">
      <rect x="296" y="150" width="56" height="84" rx="6" class="box" />
      <text x="324" y="168" class="lbl c">{{ L('Network', '网络') }}</text>
      <text x="324" y="184" class="sub c">{{ L('service', '服务') }}</text>
    </g>
    <g :class="part('shm')">
      <path d="M220,206 L236,206" class="link solid" />
      <text x="262" y="250" class="tag c">{{ L('shared memory', '共享内存') }}</text>
    </g>

    <!-- system calls, the seccomp gate, and one refused call -->
    <g :class="part('syscalls')">
      <path d="M64,234 L64,374" class="call" marker-end="url(#cp-arrow)" />
      <path d="M172,234 L172,374" class="call" marker-end="url(#cp-arrow)" />
      <text x="70" y="364" class="tag">{{ L('system calls', '系统调用') }}</text>
      <template v-if="!still">
        <circle r="3" class="dot"><animateMotion path="M64,236 L64,372" dur="2s" repeatCount="indefinite" /></circle>
        <circle r="3" class="dot"><animateMotion path="M172,236 L172,372" dur="2s" begin="-1s" repeatCount="indefinite" /></circle>
      </template>
    </g>
    <g :class="part('gate')">
      <rect x="16" y="300" width="206" height="28" rx="4" class="box gate" />
      <text x="119" y="318" class="lbl c">{{ L('seccomp filter · allow list', 'seccomp 过滤器 · 白名单') }}</text>
    </g>
    <g :class="part('blocked')">
      <path d="M36,234 L36,294" class="danger" />
      <text x="36" y="293" class="bad-text c big">✕</text>
      <!-- a call off the list reaches the filter and goes no further -->
      <circle v-if="!still" r="3" class="dot bad">
        <animateMotion path="M36,236 L36,288" dur="2s" begin="-0.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.7;0.85;1" dur="2s" begin="-0.5s" repeatCount="indefinite" />
      </circle>
    </g>

    <!-- the zygote, forking renderers -->
    <g :class="part('zygote')">
      <rect x="70" y="270" width="96" height="24" rx="4" class="box gate" />
      <text x="118" y="286" class="lbl c">zygote</text>
      <path d="M96,270 L72,238" class="link solid march" marker-end="url(#cp-arrow)" />
      <path d="M140,270 L164,238" class="link solid march" marker-end="url(#cp-arrow)" />
      <text x="118" y="310" class="tag c">fork() · {{ L('copy-on-write', '写时复制') }}</text>
    </g>

    <!-- the network service refusing another site's data -->
    <g :class="part('corb')">
      <path d="M300,234 C276,282 140,282 112,236" class="danger" marker-end="url(#cp-arrow)" />
      <text x="206" y="284" class="bad-text c big">✕</text>
      <text x="206" y="302" class="tag c">{{ L('b.com’s JSON, not for a.com', 'b.com 的 JSON 不给 a.com') }}</text>
    </g>

    <!-- what an attacker wants -->
    <g :class="part('prize')">
      <rect x="104" y="10" width="152" height="58" rx="9" class="outline warn" />
      <rect x="230" y="144" width="64" height="96" rx="9" class="outline warn" />
      <rect x="4" y="372" width="352" height="42" rx="9" class="outline warn" />
    </g>
  </svg>
</template>

<style scoped>
/* the two sites' memory */
.site.a {
  fill: var(--p0);
}
.site.b {
  fill: var(--p1);
}
.lit .site {
  stroke: var(--accent);
  stroke-width: 2;
}
.check {
  fill: var(--ok);
}
.tick {
  fill: none;
  stroke: #fff;
  stroke-width: 1.4;
}
.shackle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.3;
}
.lockbody {
  fill: var(--ink-2);
}
</style>
