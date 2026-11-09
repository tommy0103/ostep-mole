import { computed, ref, watch } from 'vue'
import type { Lang } from './types'

/** Reading mode: English only, Chinese only, or both side by side. */
export type ReadMode = 'en' | 'zh' | 'both'

export interface Bi {
  en: string
  zh: string
}

const KEY = 'ostep.mode'
function initial(): ReadMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'zh' || v === 'both') return v
  } catch {
    /* storage may be unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'both'
}

export const mode = ref<ReadMode>(initial())
watch(mode, (v) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* ignore */
  }
})

/** Language for interface chrome and for our own (non-book) writing in single-language spots. */
export const uiLang = computed<Lang>(() => (mode.value === 'en' ? 'en' : 'zh'))

/** Pick a string for the current UI language. */
export function t(s: Bi | string): string {
  if (typeof s === 'string') return s
  return s[uiLang.value]
}

export const showsLang = (l: Lang) => mode.value === 'both' || mode.value === l

/** Interface strings. */
export const UI = {
  modeEn: { en: 'EN', zh: 'EN' },
  modeZh: { en: '中文', zh: '中文' },
  modeBoth: { en: 'EN · 中', zh: '对照' },
  contents: { en: 'Contents', zh: '目录' },
  onThisPage: { en: 'On this page', zh: '本章目录' },
  min: { en: 'min', zh: '分钟' },
  labs: { en: 'labs', zh: '个实验' },
  sections: { en: 'sections', zh: '节' },
  prev: { en: 'Previous', zh: '上一章' },
  next: { en: 'Next', zh: '下一章' },
  showTranslation: { en: 'Show the Chinese translation', zh: '显示英文原文' },
  figure: { en: 'Figure', zh: '图' },
  table: { en: 'Table', zh: '表' },
  loading: { en: 'Loading…', zh: '加载中…' },
  untranslated: { en: 'Not in the Chinese edition', zh: '中文版无对应内容' },
  notInEnglish: { en: 'Only in the Chinese edition', zh: '仅见于中文版' },
  fieldNote: { en: 'Field note', zh: '现实连线' },
  thread: { en: 'Connection', zh: '知识串联' },
  play: { en: 'Play', zh: '播放' },
  pause: { en: 'Pause', zh: '暂停' },
  step: { en: 'Step', zh: '单步' },
  reset: { en: 'Reset', zh: '重置' },
  theme: { en: 'Toggle theme', zh: '切换明暗' },
  readingMode: { en: 'Reading mode', zh: '阅读模式' },
  sourcePdf: { en: 'Source PDF', zh: '原书 PDF' },
} satisfies Record<string, Bi>
