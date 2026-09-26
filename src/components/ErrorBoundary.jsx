import { Component } from 'react'
import { Button } from '@/components/ui/button'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unexpected application error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <section className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-6">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Something went wrong.</h1>
          <p className="mt-2 text-sm text-muted-foreground">The app hit an unexpected error. Reloading usually fixes this.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </section>
    )
  }
}
