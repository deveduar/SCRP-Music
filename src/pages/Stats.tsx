import { useMemo } from 'react'
import { useReleasesStore } from '../stores/releases'

export function Stats() {
  const releases = useReleasesStore((s) => s.releases)
  const loaded = useReleasesStore((s) => s.loaded)

  const topArtists = useMemo(() => {
    const map = new Map<string, number>()
    releases.forEach((r) => r.artists.forEach((a) => map.set(a, (map.get(a) ?? 0) + 1)))
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 30)
  }, [releases])

  const topLabels = useMemo(() => {
    const map = new Map<string, number>()
    releases.forEach((r) => {
      if (r.label) map.set(r.label, (map.get(r.label) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 30)
  }, [releases])

  const years = useMemo(() => {
    const map = new Map<number, number>()
    releases.forEach((r) => {
      if (r.year) map.set(r.year, (map.get(r.year) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [releases])

  const maxYearCount = years.length > 0 ? years[0][1] : 1

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-content-muted">Load releases to see statistics.</p>
      </div>
    )
  }

  return (
    <div className="p-6 overflow-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section>
        <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wider mb-3">Top Artists</h3>
        <div className="space-y-1">
          {topArtists.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="text-content-muted w-6 text-right">{i + 1}</span>
              <span className="flex-1 truncate text-content-secondary">{item.name}</span>
              <span className="text-content-muted text-xs">{item.count}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wider mb-3">Top Labels</h3>
        <div className="space-y-1">
          {topLabels.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="text-content-muted w-6 text-right">{i + 1}</span>
              <span className="flex-1 truncate text-content-secondary">{item.name}</span>
              <span className="text-content-muted text-xs">{item.count}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wider mb-3">By Year</h3>
        <div className="space-y-1">
          {years.map(([year, count]) => (
            <div key={year} className="flex items-center gap-2 text-sm">
              <span className="text-content-secondary w-12">{year}</span>
              <div className="flex-1 h-4 bg-surface-tertiary rounded overflow-hidden">
                <div
                  className="h-full bg-accent rounded"
                  style={{ width: `${(count / maxYearCount) * 100}%` }}
                />
              </div>
              <span className="text-content-muted text-xs w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
