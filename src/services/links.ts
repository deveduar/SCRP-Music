import type { QuickLink } from '../types/links'

export const GLOBAL_LINKS: QuickLink[] = [
  {
    id: 'google',
    label: 'Google',
    url: (q) => `https://google.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Search',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    icon: 'Youtube',
  },
  {
    id: 'yandex',
    label: 'Yandex',
    url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    icon: 'Search',
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    icon: 'Search',
  },
]

const ADAPTER_LINKS: Record<string, QuickLink[]> = {}

export function registerAdapterLinks(adapterId: string, links: QuickLink[]): void {
  ADAPTER_LINKS[adapterId] = links
}

export function getAdapterLinks(adapterId: string): QuickLink[] {
  return ADAPTER_LINKS[adapterId] ?? []
}

export function getAllQuickLinks(adapterId?: string): QuickLink[] {
  const global = GLOBAL_LINKS
  if (!adapterId) return global
  const adapter = ADAPTER_LINKS[adapterId]
  if (!adapter) return global
  return [...global, ...adapter]
}

export function findAllLinks(): QuickLink[] {
  const resultMap = new Map<string, QuickLink>()
  
  for (const link of GLOBAL_LINKS) {
    resultMap.set(link.id, link)
  }
  
  for (const links of Object.values(ADAPTER_LINKS)) {
    for (const link of links) {
      if (!resultMap.has(link.id)) {
        resultMap.set(link.id, link)
      }
    }
  }
  
  return Array.from(resultMap.values())
}

export function findQuickLink(id: string): QuickLink | undefined {
  for (const link of GLOBAL_LINKS) {
    if (link.id === id) return link
  }
  for (const links of Object.values(ADAPTER_LINKS)) {
    const found = links.find((l) => l.id === id)
    if (found) return found
  }
  return undefined
}

export function buildSearchQuery(release: { artists: string[]; title: string; catalog: string }) {
  return `${release.artists.join(' ')} ${release.title} ${release.catalog}`.trim()
}
