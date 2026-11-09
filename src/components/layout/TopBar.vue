<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mode, t, UI, type ReadMode } from '@/lib/i18n'
import { theme, toggleTheme } from '@/lib/theme'
import { findChapter, PARTS, pad2 } from '@/content/book'

const route = useRoute()
const crumb = computed(() => {
  const slug = route.params.slug as string | undefined
  if (slug) {
    const f = findChapter(slug)
    if (f) return { part: f.part, chapter: f.chapter }
  }
  const p = PARTS.find((p) => p.id === route.params.part)
  return p ? { part: p, chapter: null } : null
})

const progress = ref(0)
function onScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  progress.value = max > 0 ? h.scrollTop / max : 0
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const modes: { id: ReadMode; label: { en: string; zh: string } }[] = [
  { id: 'en', label: UI.modeEn },
  { id: 'both', label: UI.modeBoth },
  { id: 'zh', label: UI.modeZh },
]
</script>

<template>
  <header class="topbar" :data-part="crumb?.part.id">
    <RouterLink to="/" class="brand" aria-label="OSTEP home">
      <span class="logo">OSTEP</span><span class="cursor" aria-hidden="true">▍</span>
    </RouterLink>
    <nav v-if="crumb" class="crumb" aria-label="breadcrumb">
      <RouterLink :to="`/${crumb.part.id}`" class="part">
        <span class="numeral">{{ crumb.part.numeral }}</span>
        <span class="part-title">{{ t(crumb.part.title) }}</span>
      </RouterLink>
      <template v-if="crumb.chapter">
        <span class="sep">/</span>
        <span class="chap"><span class="mono">{{ pad2(crumb.chapter.num) }}</span> {{ t(crumb.chapter.title) }}</span>
      </template>
    </nav>
    <span class="spacer" />
    <div class="seg mode" role="group" :aria-label="t(UI.readingMode)">
      <button v-for="m in modes" :key="m.id" :aria-pressed="mode === m.id" @click="mode = m.id">{{ m.label[mode === 'en' ? 'en' : 'zh'] }}</button>
    </div>
    <button class="icon" :title="t(UI.theme)" :aria-label="t(UI.theme)" @click="toggleTheme">
      <svg v-if="theme === 'dark'" viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="4" fill="currentColor" /><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M4 16l1.4-1.4M14.6 5.4L16 4" /></g></svg>
      <svg v-else viewBox="0 0 20 20" width="16" height="16"><path d="M15.5 12.8A6.5 6.5 0 017.2 4.5a6.5 6.5 0 108.3 8.3z" fill="currentColor" /></svg>
    </button>
    <div class="progress" :style="{ transform: `scaleX(${progress})` }" />
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid var(--rule);
}
.brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: var(--ink);
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
}
.cursor {
  color: var(--accent);
  margin-left: 1px;
  animation: blink 1.1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.crumb {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 13.5px;
  color: var(--muted);
}
.crumb a {
  color: inherit;
  text-decoration: none;
}
.part {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  white-space: nowrap;
}
.part:hover {
  color: var(--accent-ink);
}
.numeral {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--accent-ink);
}
.sep {
  color: var(--faint);
}
.chap {
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chap .mono {
  color: var(--accent-ink);
  font-size: 12px;
}
.spacer {
  flex: 1;
}
.icon {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 30px;
  border: 1px solid var(--rule-strong);
  border-radius: 6px;
  background: var(--bg-elev);
  color: var(--ink-2);
  cursor: pointer;
}
.icon:hover {
  color: var(--accent-ink);
  border-color: var(--accent);
}
.progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
  transform-origin: 0 50%;
  transition: transform 0.08s linear;
}
@media (max-width: 760px) {
  .crumb .part-title,
  .crumb .sep,
  .crumb .chap {
    display: none;
  }
  .topbar {
    gap: 8px;
    padding: 0 10px;
  }
}
</style>
