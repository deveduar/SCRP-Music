import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled render error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const error = this.state.error
    return (
      <div className="flex items-start justify-center h-screen bg-surface text-content p-6">
        <div className="max-w-2xl w-full bg-surface-card border border-red-500/30 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-red-400">Something went wrong</h2>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="ml-auto text-xs px-2.5 py-1 rounded bg-surface-secondary border border-border-main text-content-secondary hover:text-content cursor-pointer transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs px-2.5 py-1 rounded bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover cursor-pointer transition-colors"
            >
              Reload app
            </button>
          </div>
          <p className="text-xs text-content-muted">
            The error below crashed the UI. If it keeps happening, reload the app.
          </p>
          <pre className="w-full overflow-auto bg-surface-input border border-border-main rounded-lg p-3 font-mono text-xs text-red-300/90 whitespace-pre-wrap break-words">
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </div>
      </div>
    )
  }
}
