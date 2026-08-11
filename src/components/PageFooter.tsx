const REPO_URL = 'https://github.com/deveduar/SCRP-Music'

export function PageFooter({ className = '' }: { className?: string }) {
  return (
    <footer
      className={`shrink-0 px-4 py-2 border-t border-border-main flex items-center justify-center ${className}`}
    >
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-content-muted hover:text-content-secondary transition-colors"
        title={REPO_URL}
      >
        Developed by <span className="text-content-secondary">deveduar</span> · SCRP Music Release
        Browser
      </a>
    </footer>
  )
}
