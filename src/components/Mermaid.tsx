import React, { useEffect, useRef } from 'react'

interface MermaidProps {
  chart: string
}

let mermaidReady = false

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    let cancelled = false

    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return
        if (!mermaidReady) {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
          mermaidReady = true
        }
        return mermaid.render(id, chart)
      })
      .then((result) => {
        if (cancelled || !result) return
        el.innerHTML = result.svg
      })
      .catch(() => {
        if (!cancelled) el.textContent = chart
      })

    return () => {
      cancelled = true
    }
  }, [chart])

  return <div ref={ref} className="my-4 overflow-x-auto rounded-md bg-white/40 p-2" />
}

export default Mermaid
