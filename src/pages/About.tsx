import { Info, Rocket, BookOpen, Sparkles, Braces, Layers, ExternalLink, Scale } from 'lucide-react'
import { PageFooter } from '../components/PageFooter'

const REPO_URL = 'https://github.com/deveduar/SCRP-Music'

const sectionTitle =
  'text-sm font-semibold text-content flex items-center gap-2'

const card = 'bg-surface-card border border-border-main rounded-lg p-4 space-y-3'

const terms: { term: string; def: string }[] = [
  {
    term: 'Adapter',
    def: 'A pluggable definition that tells the app how to scrape a source: which URL(s) to fetch, how to read its genres and pagination, and how to map fields (title, artists, cover, downloads). The active adapter decides what the Scraper page can fetch.',
  },
  {
    term: 'Built-in vs Custom',
    def: 'Built-in adapters ship with the app (Incompetech, Jamendo, Internet Archive) and are read-only. Custom adapters are created with the builder or imported, stored in IndexedDB, and can be edited or deleted.',
  },
  {
    term: 'Genre & page detection',
    def: 'Each genre is paginated. The app detects the last valid page automatically (exponential doubling + binary search) so scraping stops at the right place, and caches the result per adapter.',
  },
  {
    term: 'Scrape job',
    def: 'One run of the scraper: genre, page range, delays and results. Jobs are kept, show how many releases were new/updated, and can be exported as JSON.',
  },
  {
    term: 'Transport',
    def: 'How the app fetches a source: direct (browser fetch), CORS proxy (a proxy that adds CORS headers), or relay (a small server-side fetch via /api/relay). Some sites block one path or another; the Scraper page shows which transport is in use.',
  },
  {
    term: 'API key',
    def: 'Some API-based sources require a key. Set it per adapter in Settings → API Keys. Keys are stored in IndexedDB, not in the adapter definition.',
  },
  {
    term: 'Listen status / Favorites / Notes',
    def: 'Per-release user state persisted in IndexedDB. Listening via YouTube auto-marks a release as listened.',
  },
  {
    term: 'History',
    def: 'A chronological log of your activity — opens, link clicks, favorites, listens, scrape completions and batch actions — shown in the History page.',
  },
  {
    term: 'Batch actions',
    def: 'Apply an action (open, download, mark listened/favorite…) to several releases at once, in count or selection mode, with a configurable delay between tabs and optional auto-marking.',
  },
]

const features: string[] = [
  'Fuzzy search across title, artists, label, catalog and album.',
  'Virtualized list that stays smooth with thousands of releases, in full and compact layouts.',
  'Smart merge: re-scraping adds new releases without duplicating existing ones.',
  'Quick search links on every release: Google, YouTube, Yandex, DuckDuckGo — plus 13 music platforms when the source provides them.',
  'Inline YouTube playback with automatic listened marking and lookup cache.',
  'Batch actions with 6 modes, count/selection targeting and projected open counts.',
  'Pausable scraper with progress bar, real-time log and error tracking.',
  'Dark/light theme that switches instantly without reloading.',
  'Full data export/import and granular reset options in Settings.',
  'No-code adapter builder with live validation, live tests and an AI prompt helper.',
]

const stack: { layer: string; lib: string }[] = [
  { layer: 'Framework', lib: 'React 19' },
  { layer: 'Language', lib: 'TypeScript 6' },
  { layer: 'Bundler', lib: 'Vite 8' },
  { layer: 'Styling', lib: 'TailwindCSS 4' },
  { layer: 'State', lib: 'Zustand 5' },
  { layer: 'Storage', lib: 'Dexie 4 (IndexedDB)' },
  { layer: 'Validation', lib: 'Zod 4' },
  { layer: 'Virtualization', lib: 'TanStack Virtual 3' },
  { layer: 'Search', lib: 'Fuse.js 7' },
  { layer: 'Routing', lib: 'React Router 7' },
]

export function About() {
  return (
    <div className="p-6 overflow-auto h-full space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-content">About</h2>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-tertiary text-content-muted border border-border-main">
          Help &amp; Reference
        </span>
      </div>

      <section className={card}>
        <h3 className={sectionTitle}>
          <Info size={14} className="text-accent" />
          What is SCRP Music
        </h3>
        <p className="text-sm text-content-secondary leading-relaxed">
          SCRP Music is a browser-based <strong className="text-content">music release browser and
          scraper</strong>. It scrapes release lists (genres, pagination, covers, downloads) from
          music sources through a pluggable <strong className="text-content">adapter system</strong>,
          then lets you search, sort, favorite, listen and take notes on thousands of releases. It
          runs entirely in the browser — no backend or account needed — and all data is stored in
          IndexedDB, so it survives reloads and browser restarts.
        </p>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <Rocket size={14} className="text-accent" />
          Quick start
        </h3>
        <ol className="text-sm text-content-secondary space-y-1.5 list-decimal pl-5">
          <li>Open <strong className="text-content">Scraper</strong>, pick a genre from the active adapter and optionally detect its max page.</li>
          <li>Set the page range and delay, then press <strong className="text-content">Scrape</strong> — results load as they arrive.</li>
          <li>Browse them in <strong className="text-content">Browse</strong> (full or compact cards), search, sort, favorite, mark listened and add notes.</li>
          <li>Already have data? Import it from <strong className="text-content">Settings → Import All Data</strong>.</li>
        </ol>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <BookOpen size={14} className="text-accent" />
          Key concepts
        </h3>
        <div className="space-y-2">
          {terms.map((t) => (
            <details key={t.term} className="rounded-lg border border-border-main bg-surface-input/40 px-3 py-2">
              <summary className="text-xs text-content-secondary font-medium cursor-pointer select-none">
                {t.term}
              </summary>
              <p className="mt-1.5 text-xs text-content-muted leading-relaxed">{t.def}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <Sparkles size={14} className="text-accent" />
          Feature highlights
        </h3>
        <ul className="text-sm text-content-secondary space-y-1.5 list-disc pl-5">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <Braces size={14} className="text-accent" />
          Building adapters
        </h3>
        <p className="text-sm text-content-secondary leading-relaxed">
          The <strong className="text-content">Adapters</strong> page is a no-code wizard for adding
          new sources: a guided form (Basics, Transport, Genres, Pagination, Structure, URLs, Field
          Mapping), a <strong className="text-content">JSON editor</strong> with live validation,
          <strong className="text-content"> Test live</strong> (scrapes the first genre/page, capped
          at 5 releases), <strong className="text-content">Test genres</strong> (checks every
          genre&apos;s page-1 URL to catch broken slugs), and an <strong className="text-content">AI
          generator</strong> that downloads a real sample of the source and builds a ready-to-paste
          prompt. A draft is auto-saved as you work, so closing or reloading the page never loses
          your progress.
        </p>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <Layers size={14} className="text-accent" />
          Tech stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {stack.map((s) => (
            <div key={s.layer} className="flex items-center justify-between gap-2 rounded-lg bg-surface-secondary border border-border-main px-3 py-1.5 text-xs">
              <span className="text-content-muted">{s.layer}</span>
              <span className="text-content-secondary font-medium text-right">{s.lib}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h3 className={sectionTitle}>
          <ExternalLink size={14} className="text-accent" />
          Links &amp; legal
        </h3>
        <div className="text-sm text-content-secondary space-y-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover transition-colors"
          >
            <ExternalLink size={13} />
            github.com/deveduar/SCRP-Music
          </a>
          <p className="text-xs text-content-muted">
            The full technical and user documentation lives in the{' '}
            <code className="font-mono text-content-secondary">documentation/</code> folder of the
            repository: architecture, network setup, adapter builder guide, API keys and deployment.
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-border-main bg-surface-secondary px-3 py-2">
            <Scale size={14} className="text-content-muted shrink-0 mt-0.5" />
            <p className="text-xs text-content-muted">
              SCRP Music is open source and provided as-is for educational and personal use. Built-in
              adapters scrape only legal, publicly accessible sources (royalty-free music, Creative
              Commons APIs, public domain archives). If you create custom adapters, you are solely
              responsible for complying with the laws and terms of service of the sites you access.
            </p>
          </div>
        </div>
      </section>

      <PageFooter />
    </div>
  )
}
