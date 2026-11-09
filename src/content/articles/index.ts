import { parseArticle, type Article } from '@/lib/article'
import type { Lang } from '@/lib/types'

/** The long-form piece behind a field note: `<id>.en.md` and `<id>.zh.md` next to this file. */
const SOURCES = import.meta.glob('./*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

const key = (id: string, lang: Lang) => `./${id}.${lang}.md`

export const hasArticle = (id: string): boolean => key(id, 'en') in SOURCES && key(id, 'zh') in SOURCES

export const articleIds = (): string[] =>
  [...new Set(Object.keys(SOURCES).map((k) => k.replace(/^\.\/(.+)\.(en|zh)\.md$/, '$1')))].filter(hasArticle)

const cache = new Map<string, Promise<Article>>()

export function loadArticle(id: string, lang: Lang): Promise<Article> {
  const k = key(id, lang)
  if (!cache.has(k)) {
    const load = SOURCES[k]
    if (!load) return Promise.reject(new Error(`no article ${k}`))
    cache.set(k, load().then(parseArticle))
  }
  return cache.get(k)!
}
