<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabFrame from './LabFrame.vue'
import CodeBlock from '../reader/CodeBlock.vue'
import { usePlayer } from '@/lib/usePlayer'
import { t, type Bi } from '@/lib/i18n'

defineProps<{ title: Bi }>()

/** p1.c / p2.c from the chapter, condensed; line numbers below refer to this listing. */
const CODE = [
  'int main(int argc, char *argv[]) {',
  '  printf("hello (pid:%d)\\n", getpid());',
  '  int rc = fork();',
  '  if (rc < 0) { exit(1); }',
  '  else if (rc == 0) {',
  '    printf("child (pid:%d)\\n", getpid());',
  '  } else {',
  '    int w = wait(NULL);          // p2.c only',
  '    printf("parent of %d (pid:%d)\\n", rc, getpid());',
  '  }',
  '  return 0;',
  '}',
]

interface Proc {
  pid: number
  rc: string
  state: 'running' | 'ready' | 'blocked' | 'done'
  line: number
}
interface Frame {
  procs: Proc[]
  out: { who: 'parent' | 'child'; text: string }[]
  say: Bi
}

const order = ref<'parent' | 'child'>('parent')
const useWait = ref(false)

const frames = computed<Frame[]>(() => {
  const P = 29146
  const C = 29147
  const f: Frame[] = []
  const out: Frame['out'] = []
  const parent: Proc = { pid: P, rc: '?', state: 'running', line: 1 }
  const push = (say: Bi, procs: Proc[]) => f.push({ procs: procs.map((p) => ({ ...p })), out: [...out], say })
  push({ en: 'One process (PID 29146) starts running main().', zh: '一个进程（PID 29146）开始执行 main()。' }, [parent])
  out.push({ who: 'parent', text: `hello (pid:${P})` })
  push({ en: 'It prints hello — once.', zh: '它打印 hello——只打印一次。' }, [parent])
  parent.line = 2
  push({ en: 'fork(): the OS creates an almost exact copy — same code, same memory, same PC.', zh: 'fork()：操作系统创建一个几乎完全相同的副本——相同的代码、内存和程序计数器。' }, [parent])
  const child: Proc = { pid: C, rc: '?', state: 'ready', line: 2 }
  parent.rc = String(C)
  child.rc = '0'
  push({ en: 'Two processes now return from the same fork() call: the parent gets the child’s PID, the child gets 0.', zh: '现在有两个进程从同一次 fork() 调用中返回：父进程得到子进程的 PID，子进程得到 0。' }, [parent, child])

  const runChild = () => {
    child.state = 'running'
    child.line = 5
    out.push({ who: 'child', text: `child (pid:${C})` })
    push({ en: 'The child takes the rc == 0 branch.', zh: '子进程走 rc == 0 的分支。' }, [parent, child])
    child.line = 10
    child.state = 'done'
    push({ en: 'The child returns from main() and exits.', zh: '子进程从 main() 返回并退出。' }, [parent, child])
  }
  const runParent = () => {
    parent.state = 'running'
    parent.line = 8
    out.push({ who: 'parent', text: `parent of ${C} (pid:${P})` })
    push({ en: 'The parent takes the else branch and prints the child’s PID.', zh: '父进程走 else 分支，打印子进程的 PID。' }, [parent, child])
    parent.line = 10
    parent.state = 'done'
    push({ en: 'The parent exits.', zh: '父进程退出。' }, [parent, child])
  }

  if (useWait.value) {
    if (order.value === 'parent') {
      parent.line = 7
      parent.state = 'blocked'
      push({ en: 'The parent runs first — but wait() blocks it until the child finishes.', zh: '父进程先运行——但 wait() 让它阻塞，直到子进程结束。' }, [parent, child])
    } else {
      parent.state = 'ready'
    }
    runChild()
    parent.state = 'running'
    parent.line = 7
    push({ en: 'wait() returns: the child has exited (and is reaped, no zombie).', zh: 'wait() 返回：子进程已经退出（并被回收，不会成为僵尸）。' }, [parent, child])
    runParent()
  } else if (order.value === 'parent') {
    child.state = 'ready'
    runParent()
    runChild()
  } else {
    parent.state = 'ready'
    runChild()
    runParent()
  }
  return f
})

const duration = computed(() => frames.value.length - 1)
const player = usePlayer(duration, { speed: 0.9 })
watch([order, useWait], () => player.reset())
const fr = computed(() => frames.value[Math.round(player.t.value)])
/** without wait() the listing loses line 7, so later lines move up by one */
const displayLine = (line: number) => (!useWait.value && line > 7 ? line - 1 : line)
const outputText = computed(() => ['prompt> ./p' + (useWait.value ? '2' : '1'), ...fr.value.out.map((o) => o.text)].join('\n'))
const STATE: Record<Proc['state'], Bi> = {
  running: { en: 'running', zh: '运行' },
  ready: { en: 'ready', zh: '就绪' },
  blocked: { en: 'blocked in wait()', zh: '阻塞于 wait()' },
  done: { en: 'exited', zh: '已退出' },
}
</script>

<template>
  <LabFrame :title="title" name="fork" :player="player" :duration="duration">
    <div class="lab-grid side">
      <div class="code-col">
        <div class="code-wrap">
          <div v-for="p in fr.procs" :key="p.pid" class="pc" :class="p.pid === 29146 ? 'p0' : 'p1'" :style="{ top: `${15 + displayLine(p.line) * 20}px` }">{{ p.pid === 29146 ? 'P' : 'C' }}</div>
          <CodeBlock :code="CODE.filter((l, i) => useWait || i !== 7).join('\n')" />
        </div>
      </div>
      <div class="right">
        <TransitionGroup name="split" tag="div" class="procs">
          <div v-for="p in fr.procs" :key="p.pid" class="proc" :class="[p.pid === 29146 ? 'p0' : 'p1', 'st-' + p.state]">
            <div class="ph mono">
              <span>{{ p.pid === 29146 ? t({ en: 'parent', zh: '父进程' }) : t({ en: 'child', zh: '子进程' }) }}</span>
              <span>PID {{ p.pid }}</span>
            </div>
            <div class="mem mono">
              <div><span class="k">rc</span> = <b>{{ p.rc }}</b></div>
              <div><span class="k">state</span> {{ t(STATE[p.state]) }}</div>
            </div>
          </div>
        </TransitionGroup>
        <pre class="term mono">{{ outputText }}<span class="cur">▍</span></pre>
      </div>
    </div>
    <p class="caption-line say">{{ t(fr.say) }}</p>
    <template #controls>
      <div class="seg">
        <button :aria-pressed="order === 'parent'" @click="order = 'parent'">{{ t({ en: 'scheduler runs parent first', zh: '调度器先运行父进程' }) }}</button>
        <button :aria-pressed="order === 'child'" @click="order = 'child'">{{ t({ en: 'child first', zh: '先运行子进程' }) }}</button>
      </div>
      <label class="field"><input v-model="useWait" type="checkbox" /> {{ t({ en: 'add wait() (p2.c)', zh: '加入 wait()（p2.c）' }) }}</label>
    </template>
  </LabFrame>
</template>

<style scoped>
.code-wrap {
  position: relative;
  font-size: 13px;
}
.code-wrap :deep(.code) {
  padding-left: 58px;
  font-size: 12.5px;
  line-height: 20px;
}
.pc {
  position: absolute;
  left: 6px;
  width: 22px;
  height: 18px;
  margin-top: -1px;
  border-radius: 3px;
  background: var(--pc);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  text-align: center;
  line-height: 18px;
  transition: top 0.4s var(--ease);
  z-index: 1;
}
.pc.p1 {
  left: 30px;
}
.right {
  display: grid;
  gap: 12px;
  align-content: start;
}
.procs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.proc {
  border: 1.5px solid var(--pc);
  border-radius: 6px;
  overflow: hidden;
  transition: opacity 0.3s;
}
.proc.st-done {
  opacity: 0.45;
}
.proc.st-blocked {
  border-style: dashed;
}
.ph {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--pc);
  color: #fff;
  font-size: 11px;
}
.mem {
  padding: 6px 8px;
  font-size: 12px;
  display: grid;
  gap: 2px;
}
.mem .k {
  color: var(--muted);
}
.term {
  margin: 0;
  padding: 10px 12px;
  min-height: 110px;
  background: #15171a;
  color: #d8dee6;
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.cur {
  color: #7aa2ff;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.say {
  margin: 12px 0 0;
}
.split-enter-active {
  transition: all 0.5s var(--ease);
}
.split-enter-from {
  opacity: 0;
  transform: translateX(-40%) scale(0.9);
}
</style>
