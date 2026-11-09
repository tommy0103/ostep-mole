<script setup lang="ts">
import { computed } from 'vue'
import { useDrawing, type DrawingProps } from '../drawing'
import MiniInitDemo from './MiniInitDemo.vue'

/**
 * The running figure of the zombie article: one process tree (whoever is PID 1, your server, the
 * script it started, the script's grep) above the kernel's process table. On an ordinary machine
 * init is PID 1 and the tree hangs below it; in a container your server takes PID 1's place; with
 * a wrapper (sh -c, tini) the wrapper does. The tree slides one row when PID 1 changes hands,
 * since that is the point of the article; everything else fades in and out with the state.
 */
const props = defineProps<DrawingProps>()

const SHOW: Record<string, string[]> = {
  overview: ['container', 'docker', 'myserver', 'script', 'grep', 'script-dead', 'grep-z', 'adopt', 'sigterm', 'sigterm-drop', 'table', 'kernel'],
  book: ['init', 'myserver', 'script', 'grep', 'grep-z', 'wait', 'table', 'kernel'],
  death: ['init', 'myserver', 'script', 'grep', 'grep-z', 'wait', 'sigchld', 'table', 'record', 'slotlink', 'kernel'],
  orphans: ['init', 'myserver', 'script', 'grep', 'script-dead', 'adopt', 'reaploop'],
  subreaper: ['init', 'myserver', 'script', 'grep', 'script-dead', 'adopt', 'subreaper'],
  container: ['container', 'docker', 'myserver', 'script', 'grep'],
  pid1: ['container', 'docker', 'myserver', 'script', 'grep', 'script-dead', 'grep-z', 'adopt', 'sigterm', 'sigterm-drop', 'alldie', 'table', 'kernel'],
  signals: ['container', 'docker', 'myserver', 'script', 'grep', 'sigterm', 'sigterm-drop', 'sigkill'],
  'shell-form': ['container', 'docker', 'wrapper', 'myserver', 'script', 'grep', 'sigterm', 'forward', 'forward-no'],
  limits: ['container', 'myserver', 'script', 'grep', 'grep-z', 'fork', 'table', 'limits', 'kernel'],
  fixes: ['container', 'docker', 'wrapper', 'myserver', 'script', 'grep', 'script-dead', 'grep-reaped', 'adopt', 'sigterm', 'forward', 'table', 'kernel'],
  'mini-init': ['container', 'docker', 'wrapper', 'myserver', 'script', 'grep', 'script-dead', 'grep-reaped', 'adopt', 'sigterm', 'forward'],
  bends: ['container', 'myserver', 'script', 'grep', 'grep-z', 'kill9', 'table', 'kernel'],
}
const { shown, part, L, viewBox } = useDrawing(props, SHOW, 430)

// the layout follows the state alone, never a lit term: who is PID 1 decides where the tree hangs
const base = computed(() => new Set(SHOW[props.state] ?? SHOW.overview))
const layout = computed(() => (base.value.has('init') ? 'host' : base.value.has('wrapper') ? 'wrap' : 'up'))
const off = computed(() => (layout.value === 'up' ? 0 : 1))
const RX = [18, 40, 62, 84]
const RY = [34, 94, 154, 214]
const at = (row: number) => ({ transform: `translate(${RX[row]}px, ${RY[row]}px)` })

const WRAPPER: Record<string, string> = { 'shell-form': '/bin/sh -c', fixes: 'tini', 'mini-init': 'mini-init' }
const wrapper = computed(() => WRAPPER[props.state] ?? 'tini')

// who adopts grep: PID 1, or (in the subreaper state) your server
const adopt = computed(() => {
  if (base.value.has('subreaper')) return { d: 'M132,122 C214,122 222,231 180,231', x: 194, y: 180 }
  if (layout.value === 'up') return { d: 'M110,60 C196,60 204,171 158,171', x: 176, y: 120 }
  return { d: 'M110,60 C226,60 232,231 180,231', x: 200, y: 150 }
})

// the kernel's process table: L a live process, Z a zombie, . a free entry
const SLOTS: Record<string, string> = {
  overview: 'LLLLZZZZZ...',
  book: 'LLLLZLL.....',
  death: 'LLLLZLL.....',
  pid1: 'LLLLZLL.....',
  limits: 'LLLLZZZZZZZ.',
  fixes: 'LLLLLL......',
  bends: 'LLLLZLL.....',
}
const slots = computed(() => [...(SLOTS[props.state] ?? 'LLLLLL......')])
const slotX = (i: number) => 24 + i * 26
</script>

<template>
  <MiniInitDemo v-if="demo && state === 'mini-init'" :step="step ?? 0" :lang="lang" />
  <svg v-else class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('A process tree above the kernel’s process table', '内核进程表之上的一棵进程树')">
    <defs>
      <marker id="zc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="arrowhead" />
      </marker>
      <marker id="zc-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="bad-head" />
      </marker>
    </defs>

    <!-- the kernel, holding the process table -->
    <g :class="part('kernel')">
      <rect x="8" y="294" width="344" rx="6" class="box floor sized" :style="{ height: (base.has('record') || base.has('limits') ? 130 : 60) + 'px' }" />
      <text x="18" y="312" class="lbl">{{ L('Kernel', '内核') }}</text>
    </g>
    <g :class="part('table')">
      <text x="68" y="312" class="tag">{{ L('process table', '进程表') }}</text>
      <g v-for="(k, i) in slots" :key="i">
        <rect :x="slotX(i)" y="320" width="22" height="22" rx="3" class="slot" :class="{ live: k === 'L', zomb: k === 'Z' }" />
        <text v-if="k === 'Z'" :x="slotX(i) + 11" y="335" class="tag c ztext">Z</text>
      </g>
    </g>
    <!-- a zombie's entry: what is kept, what is gone -->
    <g :class="part('slotlink')">
      <path d="M139,248 V318" class="link" />
    </g>
    <g :class="part('record')">
      <path d="M139,342 V356" class="link" />
      <rect x="60" y="356" width="240" height="62" rx="5" class="box" />
      <text x="180" y="372" class="tag hi c">{{ L('a zombie’s entry keeps', '僵尸的这一项保留着') }}</text>
      <text x="180" y="389" class="sub c">{{ L('PID · exit status · resource usage', 'PID · 终止状态 · 资源使用统计') }}</text>
      <text x="180" y="408" class="tag c">{{ L('freed at exit: memory · files · timers', '退出时已释放：内存 · 文件 · 定时器') }}</text>
    </g>
    <!-- three counters that see a zombie as a live process -->
    <g :class="part('limits')">
      <path d="M102,346 V350 H306 V346" class="link solid" />
      <path d="M204,350 V358" class="link solid" />
      <g v-for="(c, i) in [
        { name: 'kernel.pid_max', sub: L('whole machine', '整台机器'), live: 0.12, z: 0.1 },
        { name: 'pids.max', sub: L('this container', '这个容器'), live: 0.14, z: 0.86 },
        { name: 'RLIMIT_NPROC', sub: L('per user', '每个用户'), live: 0.2, z: 0.24 },
      ]" :key="c.name">
        <rect :x="16 + i * 111" y="358" width="106" height="62" rx="5" class="box" />
        <text :x="69 + i * 111" y="374" class="code c">{{ c.name }}</text>
        <text :x="69 + i * 111" y="388" class="sub c">{{ c.sub }}</text>
        <rect :x="26 + i * 111" y="396" width="86" height="8" rx="2" class="sunk" />
        <rect :x="26 + i * 111" y="396" :width="86 * c.live" height="8" rx="2" class="muted-fill" />
        <rect :x="26 + i * 111 + 86 * c.live" y="396" :width="86 * c.z" height="8" rx="2" class="zbar" />
      </g>
      <text x="180" y="415" class="tag bad-text c">{{ L('full: fork() fails', '已满：fork() 失败') }}</text>
    </g>

    <!-- the container: its own PID namespace -->
    <g :class="part('container')">
      <rect x="8" y="22" width="238" rx="9" class="outline sized" :style="{ height: (layout === 'up' ? 202 : 248) + 'px' }" />
      <text x="14" y="15" class="tag">{{ L('container · its own PID namespace', '容器 · 独立的 PID 命名空间') }}</text>
    </g>
    <g :class="part('docker')">
      <rect x="258" y="34" width="92" height="34" rx="6" class="box" />
      <text x="304" y="49" class="lbl c">Docker</text>
      <text x="304" y="62" class="sub c">{{ L('on the host', '在宿主机上') }}</text>
    </g>

    <!-- PID 1 on an ordinary machine: init -->
    <g :class="part('init')">
      <rect x="18" y="34" width="92" height="34" rx="6" class="box strong" />
      <text x="64" y="49" class="lbl c">init</text>
      <text x="64" y="62" class="sub c">PID 1</text>
    </g>
    <g :class="part('reaploop')">
      <text x="116" y="47" class="tag hi">{{ L('wait() in a loop', '循环调用 wait()') }}</text>
    </g>
    <!-- PID 1 in front of your program: sh -c, tini, a minimal init -->
    <g :class="part('wrapper')">
      <rect x="18" y="34" width="92" height="34" rx="6" class="box strong" />
      <text x="64" y="49" class="code c">{{ wrapper }}</text>
      <text x="64" y="62" class="sub c">PID 1</text>
    </g>
    <!-- whoever is PID 1, ringed when a term about it is lit -->
    <g :class="part('pid1')">
      <rect x="13" y="29" width="102" height="44" rx="9" class="outline" />
    </g>

    <!-- your server: PID 1 in a bare container, otherwise a child -->
    <g :class="part('myserver')">
      <g class="mv" :style="at(off)">
        <path v-if="layout !== 'up'" d="M-10,-26 V17 H0" class="link solid" />
        <rect width="92" height="34" rx="6" class="box" :class="{ strong: layout === 'up' }" />
        <text x="46" y="15" class="lbl c">myserver</text>
        <text x="46" y="28" class="sub c">{{ layout === 'up' ? 'PID 1' : L('your server', '你的服务器') }}</text>
        <g :class="part('subreaper')">
          <text x="98" y="14" class="tag hi">{{ L('subreaper (prctl)', '收割者（prctl）') }}</text>
        </g>
        <g :class="part('fork')">
          <path d="M92,17 C122,17 150,30 168,58" class="call" marker-end="url(#zc-arrow)" />
          <rect x="130" y="60" width="92" height="34" rx="6" class="box ghost" />
          <text x="176" y="75" class="code c">fork()</text>
          <text x="176" y="88" class="sub bad-text c">EAGAIN</text>
        </g>
      </g>
    </g>

    <!-- the script your server started -->
    <g :class="part('script')">
      <g class="mv" :style="at(off + 1)">
        <path d="M-10,-26 V17 H0" class="link solid" />
        <rect width="92" height="34" rx="6" class="box" :class="{ dead: shown.has('script-dead') }" />
        <text x="46" y="15" class="lbl c" :class="{ dead: shown.has('script-dead') }">{{ L('script', '脚本') }}</text>
        <text x="46" y="28" class="sub c">{{ shown.has('script-dead') ? L('died', '已死') : 'sh' }}</text>
        <text v-if="shown.has('script-dead')" x="84" y="14" class="bad-text c big">✕</text>
      </g>
    </g>

    <!-- grep: running, a zombie, or reaped -->
    <g :class="part('grep')">
      <g class="mv" :style="at(off + 2)">
        <path d="M-10,-26 V17 H0" class="link solid" :class="{ gone: shown.has('script-dead') }" />
        <rect width="92" height="34" rx="6" class="box" :class="{ ghost: shown.has('grep-z'), dead: shown.has('grep-reaped') }" />
        <text x="46" y="15" class="lbl c" :class="{ zlbl: shown.has('grep-z'), dead: shown.has('grep-reaped') }">grep</text>
        <text x="46" y="28" class="sub c">{{ shown.has('grep-z') ? 'Z · <defunct>' : shown.has('grep-reaped') ? L('reaped', '已回收') : L('running', '运行中') }}</text>
      </g>
    </g>

    <!-- grep's new parent once the script is gone -->
    <g :class="part('adopt')">
      <path :d="adopt.d" class="call" marker-end="url(#zc-arrow)" />
      <text :x="adopt.x" :y="adopt.y" class="tag end">{{ L('adopted', '过继') }}</text>
    </g>

    <!-- the parent's side of a death: SIGCHLD in, wait() out -->
    <g :class="part('wait')">
      <path d="M156,166 H226 V292" class="call" marker-end="url(#zc-arrow)" />
      <text x="230" y="272" class="code">wait()</text>
    </g>
    <g :class="part('sigchld')">
      <path d="M198,292 V178 H158" class="link solid" marker-end="url(#zc-arrow)" />
      <text x="194" y="272" class="code end">SIGCHLD</text>
    </g>

    <!-- signals from the host: SIGTERM, then SIGKILL -->
    <g :class="part('sigterm')">
      <path :d="shown.has('sigterm-drop') ? 'M258,42 H132' : 'M258,42 H112'" class="call" marker-end="url(#zc-arrow)" />
      <text x="186" y="37" class="code c">SIGTERM</text>
      <text v-if="shown.has('sigterm-drop')" x="122" y="47" class="bad-text c big">✕</text>
    </g>
    <g :class="part('sigkill')">
      <path d="M258,60 H112" class="danger" marker-end="url(#zc-arrow-bad)" />
      <text x="186" y="76" class="tag hi c">SIGKILL · {{ L('after 10 s', '10 秒后') }}</text>
      <text x="186" y="88" class="tag c">{{ L('exit code 137 = 128 + 9', '退出码 137 = 128 + 9') }}</text>
    </g>
    <!-- PID 1 passing a signal on to your program, or not -->
    <g :class="part('forward')">
      <path d="M100,68 V92" :class="shown.has('forward-no') ? 'danger' : 'call'" :marker-end="shown.has('forward-no') ? undefined : 'url(#zc-arrow)'" />
      <text v-if="shown.has('forward-no')" x="100" y="86" class="bad-text c big">✕</text>
      <text x="110" y="84" class="tag" :class="{ 'bad-text': shown.has('forward-no') }">{{ shown.has('forward-no') ? L('not forwarded', '不转发') : L('forwards signals', '转发信号') }}</text>
    </g>
    <g :class="part('alldie')">
      <text x="16" y="212" class="tag">{{ L('if PID 1 exits: SIGKILL to all the rest', 'PID 1 一退出，其余进程全收到 SIGKILL') }}</text>
    </g>
    <g :class="part('kill9')">
      <path d="M300,171 H172" class="call" marker-end="url(#zc-arrow)" />
      <text x="164" y="176" class="bad-text c big">✕</text>
      <text x="286" y="164" class="code c">kill -9</text>
      <text x="286" y="186" class="tag c">{{ L('no effect', '毫无作用') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.mv {
  transition: transform 0.6s ease;
}
.sized {
  transition: height 0.6s ease;
}
.slot {
  fill: var(--bg-elev);
  stroke: var(--rule);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.slot.live {
  fill: var(--rule-strong);
  stroke: none;
}
.slot.zomb {
  fill: var(--bg-elev);
  stroke: var(--warn);
  stroke-width: 1.3;
  stroke-dasharray: 3 2;
}
.ztext {
  fill: var(--warn);
  font-weight: 700;
}
.ghost {
  fill: var(--bg-sunk);
  stroke-dasharray: 4 3;
}
.zlbl {
  fill: var(--muted);
}
.zbar {
  fill: var(--warn);
}
.bad-head {
  fill: var(--p3);
}
.lit .slot.live {
  fill: var(--accent);
}
.lit .slot {
  stroke: var(--accent);
}
@media (prefers-reduced-motion: reduce) {
  .mv,
  .sized {
    transition: none;
  }
}
</style>
