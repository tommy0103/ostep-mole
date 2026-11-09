<script setup lang="ts">
import type { Bi } from '@/lib/i18n'
import { t, UI } from '@/lib/i18n'
import type { Player } from '@/lib/usePlayer'

/** Shared chrome for every interactive lab: a terminal-like title bar, the stage, and controls. */
defineProps<{ title: Bi; name: string; player?: Player; duration?: number; hint?: Bi }>()
</script>

<template>
  <section class="lab" :aria-label="t(title)">
    <header class="bar">
      <span class="dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="name">lab://{{ name }}</span>
      <span class="title">{{ t(title) }}</span>
    </header>
    <div class="stage">
      <slot />
    </div>
    <div v-if="player || $slots.controls" class="controls">
      <template v-if="player">
        <button class="btn primary" @click="player.toggle()">
          <svg v-if="!player.playing.value" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0l9 5-9 5z" fill="currentColor" /></svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0h3v10H1zM6 0h3v10H6z" fill="currentColor" /></svg>
          {{ player.playing.value ? t(UI.pause) : t(UI.play) }}
        </button>
        <button class="btn" :aria-label="'-1'" @click="player.step(-1)">◀︎</button>
        <button class="btn" @click="player.step(1)">{{ t(UI.step) }} ▶︎</button>
        <button class="btn" @click="player.reset()">{{ t(UI.reset) }}</button>
        <input
          v-if="duration"
          class="scrub"
          type="range"
          min="0"
          :max="duration"
          step="0.01"
          :value="player.t.value"
          :aria-label="'time'"
          @input="player.seek(+($event.target as HTMLInputElement).value)"
        />
      </template>
      <slot name="controls" />
    </div>
    <p v-if="hint" class="hint">{{ t(hint) }}</p>
  </section>
</template>

<style scoped>
.lab {
  border: 1px solid var(--rule-strong);
  border-radius: 8px;
  background: var(--bg-elev);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--rule);
  background: var(--bg-sunk);
  font-family: var(--font-mono);
  font-size: 12px;
}
.dots {
  display: inline-flex;
  gap: 5px;
}
.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rule-strong);
}
.name {
  color: var(--accent-ink);
}
.title {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stage {
  padding: 16px 18px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 18px 14px;
  border-top: 1px dashed var(--rule);
}
.scrub {
  flex: 1 1 120px;
  min-width: 100px;
}
.hint {
  margin: 0;
  padding: 0 18px 14px;
  font-size: 13px;
  color: var(--muted);
}
</style>
