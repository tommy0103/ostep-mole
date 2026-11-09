<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'

/**
 * A no-cors cross-site request in five steps: an <img> asks for the bank's JSON, the bank answers,
 * the old path delivers it into the attacker's process, CORB blanks it, ORB allows only what an
 * <img>, <script> or <link> could use.
 */
const props = defineProps<{ step: number; lang: Lang }>()
const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
const s = computed(() => props.step)
</script>

<template>
  <svg class="demo" viewBox="0 0 360 420" role="img" :aria-label="L('CORB and ORB, step by step', 'CORB 与 ORB 分步演示')">
    <defs>
      <marker id="co-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="head" />
      </marker>
    </defs>

    <!-- the attacker's renderer, with the bank's data in its memory on the old path -->
    <rect x="8" y="10" width="150" height="130" rx="6" class="box" :class="{ bad: s === 2 }" />
    <text x="16" y="28" class="lbl">{{ L('Renderer · a.com', '渲染进程 · a.com') }}</text>
    <text x="16" y="44" class="tiny">{{ L('hostile page', '恶意页面') }}</text>
    <rect x="16" y="52" width="134" height="22" rx="3" class="code-box" />
    <text x="21" y="67" class="code">&lt;img src=…/account.json&gt;</text>
    <text x="16" y="92" class="tiny">{{ L('process memory', '进程内存') }}</text>
    <rect x="16" y="98" width="134" height="18" rx="2" class="mem" />
    <g class="fade" :class="{ show: s === 2 }">
      <rect x="84" y="98" width="66" height="18" rx="2" class="mem leaked" />
      <text x="117" y="111" class="tiny c on-fill">{{ L('bank data', '银行数据') }}</text>
      <text x="83" y="132" class="note bad c">{{ L('Spectre can read it', 'Spectre 读得到') }}</text>
    </g>
    <g class="fade" :class="{ show: s >= 3 }">
      <rect x="84" y="98" width="66" height="18" rx="2" class="mem empty" />
      <text x="117" y="111" class="tiny c">{{ L('(empty)', '（空）') }}</text>
    </g>

    <!-- the bank -->
    <rect x="212" y="10" width="140" height="130" rx="6" class="box" />
    <text x="220" y="28" class="lbl">bank.example</text>
    <text x="220" y="44" class="tiny">{{ L('server', '服务器') }}</text>
    <g class="fade" :class="{ show: s >= 1 }">
      <rect x="220" y="56" width="124" height="54" rx="3" class="doc" />
      <text x="226" y="70" class="code small">Content-Type:</text>
      <text x="226" y="82" class="code small">application/json</text>
      <text x="226" y="100" class="code small">{"balance": …}</text>
    </g>

    <!-- the network service and its filter -->
    <rect x="104" y="214" width="152" height="70" rx="6" class="box strong" :class="{ lit: s >= 3 }" />
    <text x="180" y="232" class="lbl c">{{ L('Network service', '网络服务') }}</text>
    <text x="180" y="250" class="tiny c">{{ s >= 4 ? 'ORB' : s === 3 ? 'CORB' : L('(no filter)', '（不过滤）') }}</text>
    <text x="180" y="272" class="note c" :class="{ show: s === 3 }">{{ L('JSON → blank it', 'JSON → 换成空') }}</text>

    <!-- request: the img tag, through the network service, with cookies -->
    <path d="M84,140 C84,190 100,236 104,246" class="flow" :class="{ show: s === 0 }" marker-end="url(#co-arrow)" />
    <path d="M256,236 C290,220 300,180 290,142" class="flow" :class="{ show: s === 0 }" marker-end="url(#co-arrow)" />
    <g class="fade" :class="{ show: s === 0 }">
      <rect x="276" y="176" width="54" height="16" rx="8" class="cookie" />
      <text x="303" y="188" class="tiny c">Cookie</text>
    </g>
    <!-- response: bank to network service, then on to the renderer, or not -->
    <path d="M270,142 C276,180 268,210 256,226" class="flow" :class="{ show: s >= 1 }" marker-end="url(#co-arrow)" />
    <path d="M110,262 C60,262 40,200 50,142" class="flow" :class="{ show: s === 2, bad: s === 2 }" marker-end="url(#co-arrow)" />
    <path d="M110,268 C56,272 30,200 34,142" class="flow" :class="{ show: s >= 3 }" marker-end="url(#co-arrow)" />
    <text x="20" y="300" class="tiny" :class="{ show: s >= 3 }" opacity="0">{{ L('an empty body', '空的响应体') }}</text>

    <!-- ORB: what no-cors tags may receive -->
    <g class="fade" :class="{ show: s >= 4 }">
      <text x="12" y="326" class="cap">{{ L('ORB lets through only what such tags can use', 'ORB 只放行这类标签用得上的东西') }}</text>
      <g v-for="(t, i) in [L('images', '图片'), L('audio · video', '音视频'), L('scripts', '脚本'), L('stylesheets', '样式表')]" :key="i">
        <rect :x="12 + i * 86" y="334" width="80" height="22" rx="11" class="pill ok" />
        <text :x="52 + i * 86" y="349" class="tiny c">✓ {{ t }}</text>
      </g>
      <rect x="12" y="364" width="250" height="22" rx="11" class="pill no" />
      <text x="137" y="379" class="tiny c">✕ {{ L('anything else: HTML, JSON, unknown…', '其他一切：HTML、JSON、认不出的……') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.demo {
  width: 100%;
  height: auto;
  display: block;
  font-family: var(--font-sans);
}
.demo:lang(zh) {
  font-family: var(--font-zh);
}
.box {
  fill: var(--bg-elev);
  stroke: var(--rule-strong);
  stroke-width: 1.2;
  transition: stroke 0.3s;
}
.box.strong {
  stroke: var(--ink-2);
}
.box.bad {
  stroke: var(--p3);
  stroke-width: 2;
}
.box.lit {
  stroke: var(--accent);
  stroke-width: 2.2;
  fill: var(--accent-soft);
}
.lbl {
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink);
}
.cap {
  font-size: 9.5px;
  fill: var(--muted);
}
.tiny {
  font-size: 8.5px;
  fill: var(--muted);
}
.on-fill {
  fill: #fff;
}
.c {
  text-anchor: middle;
}
.code-box,
.doc {
  fill: var(--code-bg);
  stroke: var(--rule);
}
.code {
  font-family: var(--font-mono);
  font-size: 8.5px;
  fill: var(--ink-2);
}
.code.small {
  font-size: 8.5px;
}
.mem {
  fill: var(--p0);
  opacity: 0.85;
}
.mem.leaked {
  fill: var(--p1);
  opacity: 1;
}
.mem.empty {
  fill: var(--bg-sunk);
  stroke: var(--rule-strong);
  stroke-dasharray: 3 2;
  opacity: 1;
}
.cookie {
  fill: var(--bg-sunk);
  stroke: var(--warn);
}
.note {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--accent-ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.note.bad {
  fill: var(--p3);
  opacity: 1;
}
.fade {
  opacity: 0;
  transition: opacity 0.4s;
}
.show {
  opacity: 1 !important;
}
.flow {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.4;
  opacity: 0;
  transition: opacity 0.35s;
}
.flow.bad {
  stroke: var(--p3);
  stroke-width: 1.8;
}
.head {
  fill: var(--ink-2);
}
.pill.ok {
  fill: var(--bg-sunk);
  stroke: var(--ok);
}
.pill.no {
  fill: var(--bg-sunk);
  stroke: var(--p3);
}
@media (prefers-reduced-motion: reduce) {
  .fade,
  .note,
  .flow,
  .box {
    transition: none;
  }
}
</style>
