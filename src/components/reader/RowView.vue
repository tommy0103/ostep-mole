<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlignedRow } from '@/lib/align'
import type { Block } from '@/lib/types'
import { mode, t, uiLang, UI } from '@/lib/i18n'
import BlockView from './BlockView.vue'

// quiet: part of a one-language run whose marker already explains the empty column
const props = defineProps<{ row: AlignedRow; en: Block[]; zh: Block[]; dialogue?: boolean; anchor?: string; quiet?: boolean }>()

const enBlocks = computed(() => props.row.en.map((i) => props.en[i]))
const zhBlocks = computed(() => props.row.zh.map((i) => props.zh[i]))
const paired = computed(() => enBlocks.value.length > 0 && zhBlocks.value.length > 0)
const isHeading = computed(() => [...enBlocks.value, ...zhBlocks.value].some((b) => b.t === 'h'))
const isWide = computed(() => [...enBlocks.value, ...zhBlocks.value].some((b) => b.t === 'fig' || b.t === 'code'))
const peekable = computed(() => paired.value && !isHeading.value && !enBlocks.value.every((b) => b.t === 'fig' || b.t === 'code'))
const open = ref(false)

const primary = computed(() => (mode.value === 'zh' ? zhBlocks.value : enBlocks.value))
const secondary = computed(() => (mode.value === 'zh' ? enBlocks.value : zhBlocks.value))
const primaryLang = computed(() => (mode.value === 'zh' ? 'zh' : 'en'))
const secondaryLang = computed(() => (mode.value === 'zh' ? 'en' : 'zh'))
const visible = computed(() => mode.value === 'both' || primary.value.length > 0)
</script>

<template>
  <div
    v-if="visible"
    :id="anchor"
    class="row"
    :class="[mode === 'both' ? 'both' : 'single', { heading: isHeading, wide: isWide, open, 'zh-first': uiLang === 'zh' }]"
  >
    <template v-if="mode === 'both'">
      <div class="cell en" :class="{ empty: !enBlocks.length }">
        <BlockView v-for="(b, i) in enBlocks" :key="i" :block="b" lang="en" :dialogue="dialogue" />
        <span v-if="!enBlocks.length && !isHeading && !quiet" class="gap" :title="t(UI.notInEnglish)">—</span>
      </div>
      <div class="cell zh" :class="{ empty: !zhBlocks.length }">
        <BlockView v-for="(b, i) in zhBlocks" :key="i" :block="b" lang="zh" :dialogue="dialogue" />
        <span v-if="!zhBlocks.length && !isHeading && !quiet" class="gap" :title="t(UI.untranslated)">—</span>
      </div>
    </template>
    <template v-else>
      <div class="cell">
        <BlockView v-for="(b, i) in primary" :key="i" :block="b" :lang="primaryLang" :dialogue="dialogue" />
        <button
          v-if="peekable"
          class="peek"
          :aria-expanded="open"
          :title="primaryLang === 'en' ? '显示中文译文' : 'Show the English original'"
          @click="open = !open"
        >
          {{ primaryLang === 'en' ? '译' : 'EN' }}
        </button>
        <div v-if="open && peekable" class="counterpart">
          <BlockView v-for="(b, i) in secondary" :key="i" :block="b" :lang="secondaryLang" :dialogue="dialogue" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.row {
  position: relative;
  min-width: 0;
}
.row.heading {
  margin-top: 2.6rem;
  padding-top: 0.4rem;
}
.row.single {
  max-width: var(--measure);
}
.row.single.wide {
  max-width: calc(var(--measure) + 6rem);
}
.cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  min-width: 0;
}
.row.both {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.4rem;
}
.row.both .cell.zh {
  position: relative;
}
.row.both .cell.zh::before {
  content: '';
  position: absolute;
  left: -1.2rem;
  top: 0.2rem;
  bottom: 0.2rem;
  border-left: 1px solid var(--rule);
}
.row.both.heading .cell.zh::before {
  display: none;
}
.row.both .cell.empty {
  align-content: center;
}
.gap {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: help;
}
.peek {
  position: absolute;
  left: -2.6rem;
  top: 0.15rem;
  width: 1.8rem;
  height: 1.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--faint);
  font-size: 11px;
  font-family: var(--font-mono);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}
.row:hover .peek,
.row.open .peek,
.peek:focus-visible {
  opacity: 1;
}
.peek:hover,
.row.open .peek {
  color: var(--accent-ink);
  border-color: var(--rule-strong);
}
.counterpart {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.8rem;
  padding: 10px 14px;
  border-left: 2px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 var(--radius) var(--radius) 0;
  --body-size: 0.96rem;
  --body-size-zh: 0.95rem;
  color: var(--ink-2);
  animation: drop 0.25s var(--ease);
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@media (max-width: 900px) {
  .row.both {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }
  .row.both .cell.zh::before {
    display: none;
  }
  /* one column: the interface language first, the other below it behind a rule */
  .row.both .cell.zh {
    padding-left: 12px;
    border-left: 2px solid var(--rule);
  }
  .row.both.zh-first .cell.zh {
    order: -1;
    padding-left: 0;
    border-left: 0;
  }
  .row.both.zh-first .cell.en {
    padding-left: 12px;
    border-left: 2px solid var(--rule);
  }
  .row.both .cell.empty {
    display: none;
  }
  .peek {
    position: static;
    opacity: 1;
    justify-self: start;
    width: auto;
    padding: 0 6px;
    border-color: var(--rule);
  }
}
</style>
