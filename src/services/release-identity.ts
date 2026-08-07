import type { Release } from '../types/release'

export interface ReleaseIdentityCandidate {
  id?: string
  stableIdentity?: string
  source?: string
  title?: string
  album?: string
  year?: number
  catalog?: string
  urlRelease?: string
}

export function normalizeReleaseUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.hash = ''
    parsed.search = ''
    parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    return parsed.toString()
  } catch {
    return trimmed.replace(/[?#].*$/, '').replace(/\/+$/, '')
  }
}

function normalizeIdentityPart(value: string | number | undefined): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function getTextIdentityCandidate(release: ReleaseIdentityCandidate): string {
  return [
    normalizeIdentityPart(release.source),
    normalizeIdentityPart(release.title || release.album),
    normalizeIdentityPart(release.album),
    normalizeIdentityPart(release.year),
    normalizeIdentityPart(release.catalog),
  ].join('::')
}

export function getReleaseIdentityCandidates(release: ReleaseIdentityCandidate): string[] {
  const candidates = new Set<string>()
  if (release.stableIdentity) candidates.add(release.stableIdentity)
  if (release.id) candidates.add(release.id)

  const textIdentity = getTextIdentityCandidate(release)
  if (textIdentity.replace(/:/g, '')) candidates.add(textIdentity)

  return Array.from(candidates)
}

export function buildReleaseIdentityIndex(releases: Release[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const release of releases) {
    for (const candidate of getReleaseIdentityCandidates(release)) {
      if (!index.has(candidate)) {
        index.set(candidate, release.id)
      }
    }
  }
  return index
}

export function findExistingReleaseId(
  index: Map<string, string>,
  release: ReleaseIdentityCandidate,
): string | undefined {
  for (const candidate of getReleaseIdentityCandidates(release)) {
    const mapped = index.get(candidate)
    if (mapped) return mapped
  }
  return undefined
}
