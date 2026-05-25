export const VAR_PATTERN = /\{\{(\w+)}}/g

export type UrlSegment = { text: string; type: 'text' | 'resolved' | 'unresolved' }

/**
 * Resolves {{variable}} references iteratively, supporting variables that
 * reference other variables. Stops when the string stabilises or after
 * maxDepth passes to prevent infinite loops.
 */
export function resolveVars(template: string, vars: Record<string, string>, maxDepth = 10): string {
  let result = template
  for (let i = 0; i < maxDepth; i++) {
    const next = result.replace(/\{\{(\w+)}}/g, (match, key) => vars[key] ?? match)
    if (next === result) break
    result = next
  }
  return result
}

export function parseSegments(template: string, vars: Record<string, string>): UrlSegment[] {
  const segments: UrlSegment[] = []
  let last = 0
  const re = new RegExp(VAR_PATTERN.source, 'g')
  for (const match of template.matchAll(re)) {
    if (match.index! > last) segments.push({ text: template.slice(last, match.index), type: 'text' })
    const key = match[1]
    if (key in vars) {
      const fullyResolved = resolveVars(vars[key], vars)
      const type = /\{\{(\w+)}}/.test(fullyResolved) ? 'unresolved' : 'resolved'
      segments.push({ text: fullyResolved, type })
    } else {
      segments.push({ text: match[0], type: 'unresolved' })
    }
    last = match.index! + match[0].length
  }
  if (last < template.length) segments.push({ text: template.slice(last), type: 'text' })
  return segments
}

export function hasVariables(template: string): boolean {
  return /\{\{(\w+)}}/.test(template)
}
