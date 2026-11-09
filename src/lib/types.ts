// Content model produced by tools/content/extract.mjs

export type RunStyle = '' | 'b' | 'i' | 'c' | 'sup' | 'sub'
export interface Run {
  t: string
  s: RunStyle
  /** a link (only in our own writing; the book text carries none) */
  href?: string
  /** a glossary term (src/content/glossary.ts) the reader can unfold */
  term?: string
}

export type Lang = 'en' | 'zh'

export interface HeadingBlock {
  t: 'h'
  level: 2 | 3
  num: string | null
  text: string
  runs?: Run[]
  special?: boolean
}
export interface TextBlock {
  t: 'p' | 'ref' | 'note'
  runs: Run[]
}
export interface ListItemBlock {
  t: 'li'
  marker: string
  runs: Run[]
}
export interface CodeBlock {
  t: 'code'
  text: string
}
export interface FigureBlock {
  t: 'fig'
  num: string | null
  kind?: 'table'
  /** caption label when it is not the default (the Chinese edition numbers tables separately as 表) */
  label?: '表'
  /** the rest of a table that runs over a page break ("续表") */
  cont?: true
  caption: Run[]
  img?: string
  code?: string
  table?: Run[][][]
}
export interface AsideBlock {
  t: 'aside'
  kind: 'tip' | 'crux' | 'aside' | 'ds'
  title: string
  blocks: Block[]
}
export type Block = HeadingBlock | TextBlock | ListItemBlock | CodeBlock | FigureBlock | AsideBlock

export interface ChapterData {
  lang: Lang
  chapter: number
  title: string
  blocks: Block[]
}
