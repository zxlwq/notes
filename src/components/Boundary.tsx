import { Component, ErrorInfo, ReactNode } from 'react'
import Button from './ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-full max-w-md space-y-8">
            <div className="rounded-xl bg-white p-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="size-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">出现错误</h2>
              <p className="mb-6 text-gray-600">应用程序遇到了一个错误。请尝试重新加载页面。</p>
              {this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    错误详情
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-red-50 p-3 text-xs text-red-600">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <Button onClick={this.handleReload} variant="primary">
                重新加载
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
