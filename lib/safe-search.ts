/** Strips characters that would change a PostgREST or() filter, so search text stays search text. */
export function safeSearch(q: string) {
  return q.replace(/[,()*\\%]/g, ' ').trim().slice(0, 80)
}
