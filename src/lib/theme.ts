import { ref } from 'vue'

export type Theme = 'light' | 'dark'

function current(): Theme {
  const set = document.documentElement.dataset.theme
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const theme = ref<Theme>(typeof document === 'undefined' ? 'light' : current())

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem('ostep.theme', theme.value)
  } catch {
    /* ignore */
  }
}
