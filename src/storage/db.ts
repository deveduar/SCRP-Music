import Dexie, { type EntityTable } from 'dexie'
import type { UserReleaseState, HistoryEntry, UserSettings } from '../types/user-state'
import type { Release } from '../types/release'
import type { ScrapeJob } from '../types/scraper'
import type { ExportPayload } from '../types/export'

const db = new Dexie('ScrpMusic') as Dexie & {
  states: EntityTable<UserReleaseState, 'id'>
  history: EntityTable<HistoryEntry, 'id'>
  settings: EntityTable<UserSettings, 'id'>
  releases: EntityTable<Release, 'id'>
  jobs: EntityTable<ScrapeJob, 'id'>
}

db.version(3).stores({
  states: 'id, favorite, listenStatus, buyStatus, *tags',
  history: '++id, releaseId, timestamp, action',
  settings: 'id',
  releases: 'id, year, genre',
  jobs: 'id, date',
})

export async function getReleaseState(id: string): Promise<UserReleaseState | undefined> {
  return db.states.get(id)
}

export async function setReleaseState(id: string, state: Partial<UserReleaseState>): Promise<void> {
  const existing = await db.states.get(id)
  const base: UserReleaseState = {
    id,
    favorite: false,
    listenStatus: 'unlistened',
    buyStatus: 'none',
    notes: '',
    tags: [],
    lastOpened: null,
    openCount: 0,
  }
  await db.states.put({ ...base, ...existing, ...state })
}

export async function getAllStates(): Promise<UserReleaseState[]> {
  return db.states.toArray()
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  await db.history.add(entry)
}

export async function getHistory(limit = 100): Promise<HistoryEntry[]> {
  return db.history.orderBy('timestamp').reverse().limit(limit).toArray()
}

export async function getSettings(): Promise<UserSettings | undefined> {
  return db.settings.get('default')
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await db.settings.put({ ...settings, id: 'default' })
}

export async function getAllReleases(): Promise<Release[]> {
  const releases = await db.releases.toArray()
  return releases.map((r) => ({ ...r, scrapeJobIds: (r as any).scrapeJobIds ?? [] }))
}

export async function saveAllReleases(releases: Release[]): Promise<void> {
  await db.releases.clear()
  await db.releases.bulkPut(releases)
}

export async function clearReleases(): Promise<void> {
  await db.releases.clear()
}

export async function clear(): Promise<void> {
  await db.states.clear()
  await db.history.clear()
  await db.releases.clear()
  await db.jobs.clear()
}

export async function saveJob(job: ScrapeJob): Promise<void> {
  await db.jobs.put(job)
}

export async function getJobs(): Promise<ScrapeJob[]> {
  return db.jobs.orderBy('date').reverse().toArray()
}

export async function clearJobs(): Promise<void> {
  await db.jobs.clear()
}

export async function getAllHistory(): Promise<HistoryEntry[]> {
  return db.history.orderBy('timestamp').toArray()
}

export async function exportAll(): Promise<ExportPayload> {
  const [releases, states, history, jobs] = await Promise.all([
    getAllReleases(),
    getAllStates(),
    getAllHistory(),
    getJobs(),
  ])
  const settings = await getSettings().catch(() => undefined)
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    releases,
    states,
    history,
    jobs,
    settings: settings ?? null,
  }
}

export async function importAll(payload: ExportPayload): Promise<void> {
  await Promise.all([
    db.releases.clear(),
    db.states.clear(),
    db.history.clear(),
    db.jobs.clear(),
  ])
  await Promise.all([
    db.releases.bulkPut(payload.releases),
    db.states.bulkPut(payload.states),
    db.history.bulkPut(payload.history),
    db.jobs.bulkPut(payload.jobs),
  ])
  if (payload.settings) {
    await saveSettings(payload.settings)
  }
}

export default db
