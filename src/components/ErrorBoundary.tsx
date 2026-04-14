import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary — catches render errors and shows a recovery UI
 * instead of a white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#08080a', color: '#ef4444', fontFamily: 'monospace', padding: 32, textAlign: 'center',
        }}>
          <h2 style={{ marginBottom: 16, color: '#f59e0b' }}>Something went wrong</h2>
          <pre style={{ fontSize: 12, color: '#888', maxWidth: '80%', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 24, padding: '8px 24px', borderRadius: 6,
              border: '1px solid #f59e0b', background: '#1a1500', color: '#f59e0b',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
