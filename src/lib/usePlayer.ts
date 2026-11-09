import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * A time cursor for step-by-step animations. `t` advances continuously while playing so that
 * labs can interpolate between discrete simulation steps (the "3b1b" feel), and snaps to integers
 * when stepping manually.
 */
export function usePlayer(duration: Ref<number>, opts: { speed?: number; autoplay?: boolean } = {}) {
  const t = ref(0)
  const playing = ref(false)
  const speed = ref(opts.speed ?? 2) // steps per second
  let raf = 0
  let last = 0

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  function frame(now: number) {
    if (!playing.value) return
    const dt = last ? (now - last) / 1000 : 0
    last = now
    t.value = Math.min(duration.value, t.value + dt * speed.value)
    if (t.value >= duration.value) {
      playing.value = false
      return
    }
    raf = requestAnimationFrame(frame)
  }
  function play() {
    if (t.value >= duration.value) t.value = 0
    if (reduced) {
      t.value = duration.value
      return
    }
    playing.value = true
    last = 0
    raf = requestAnimationFrame(frame)
  }
  function pause() {
    playing.value = false
    cancelAnimationFrame(raf)
  }
  function toggle() {
    playing.value ? pause() : play()
  }
  function step(d = 1) {
    pause()
    t.value = d > 0 ? Math.min(duration.value, Math.floor(t.value + 1e-9) + 1) : Math.max(0, Math.ceil(t.value - 1e-9) - 1)
  }
  function reset() {
    pause()
    t.value = 0
  }
  function seek(v: number) {
    pause()
    t.value = Math.max(0, Math.min(duration.value, v))
  }
  watch(duration, () => {
    if (t.value > duration.value) t.value = duration.value
  })
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  if (opts.autoplay) play()
  return { t, playing, speed, play, pause, toggle, step, reset, seek }
}

export type Player = ReturnType<typeof usePlayer>

/** Ease for interpolating between integer steps. */
export const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
