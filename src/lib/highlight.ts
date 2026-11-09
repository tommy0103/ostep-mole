/** A deliberately small C / shell highlighter: comments, strings, keywords, numbers, prompts. */
export interface Tok {
  t: string
  c: '' | 'kw' | 'ty' | 'str' | 'com' | 'num' | 'pp' | 'fn' | 'prompt'
}

const KW = new Set('if else for while do return break continue switch case default goto sizeof struct union enum typedef static extern const volatile'.split(' '))
const TY = new Set('int char void long short unsigned signed float double uint size_t pid_t bool'.split(' '))

export function highlight(src: string): Tok[] {
  const out: Tok[] = []
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(^[ \t]*#\s*\w+[^\n]*)|(^prompt>|^\$ )|\b(0x[0-9a-fA-F]+|\d+)\b|\b([A-Za-z_]\w*)\b(?=\s*\()|\b([A-Za-z_]\w*)\b/gm
  let last = 0
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push({ t: src.slice(last, m.index), c: '' })
    const [s, com, str, pp, prompt, num, fn, word] = m
    if (com) out.push({ t: s, c: 'com' })
    else if (str) out.push({ t: s, c: 'str' })
    else if (pp) out.push({ t: s, c: 'pp' })
    else if (prompt) out.push({ t: s, c: 'prompt' })
    else if (num) out.push({ t: s, c: 'num' })
    else if (fn) out.push({ t: s, c: KW.has(fn) ? 'kw' : 'fn' })
    else if (word) out.push({ t: s, c: KW.has(word) ? 'kw' : TY.has(word) ? 'ty' : '' })
    last = m.index! + s.length
  }
  if (last < src.length) out.push({ t: src.slice(last), c: '' })
  return out
}
