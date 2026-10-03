import { useEffect, useRef } from 'react'

interface PerformanceMetrics {
  componentLoadTime: number
  renderTime: number
  totalTime: number
}

export const usePerfMonitor = (componentName: string) => {
  const startTime = useRef(performance.now())
  const renderStartTime = useRef<number | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Performance monitoring in development
    }
  }, [componentName])

  const startRender = () => {
    renderStartTime.current = performance.now()
  }

  const endRender = () => {
    if (renderStartTime.current) {
      if (process.env.NODE_ENV === 'development') {
        // Performance monitoring in development
      }
    }
  }

  return {
    startRender,
    endRender,
    getMetrics: (): PerformanceMetrics => {
      const endTime = performance.now()
      const componentLoadTime = endTime - startTime.current
      const renderTime = renderStartTime.current ? endTime - renderStartTime.current : 0

      return {
        componentLoadTime,
        renderTime,
        totalTime: componentLoadTime + renderTime,
      }
    },
  }
}
