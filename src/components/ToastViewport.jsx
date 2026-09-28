import { useEffect, useRef, useState } from 'react'
import { Check, Info, TriangleAlert, X } from 'lucide-react'
import { toastEvent } from '@/lib/toast'

const tones = {
  success: { Icon: Check, className: 'border-matcha-300 bg-cream-100 text-matcha-900' },
  error: { Icon: TriangleAlert, className: 'border-destructive/40 bg-cream-100 text-destructive' },
  warning: { Icon: TriangleAlert, className: 'border-amber-300 bg-cream-100 text-amber-900' },
  info: { Icon: Info, className: 'border-sand-400 bg-cream-100 text-foreground' },
}

export default function ToastViewport() {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  useEffect(() => {
    const activeTimers = timers.current
    function onToast(event) {
      const item = event.detail
      setItems((current) => [...current.slice(-2), item])
      const timer = window.setTimeout(() => {
        setItems((current) => current.filter(({ id }) => id !== item.id))
        activeTimers.delete(item.id)
      }, item.tone === 'error' ? 8000 : 5000)
      activeTimers.set(item.id, timer)
    }
    window.addEventListener(toastEvent, onToast)
    return () => {
      window.removeEventListener(toastEvent, onToast)
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  function dismiss(id) {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  return <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-5 sm:w-[min(24rem,calc(100vw-2.5rem))]" aria-label="Notifications">
    {items.map((item) => {
      const { Icon, className } = tones[item.tone] || tones.info
      return <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-3 shadow-[0_18px_40px_-18px_rgb(var(--shadow-tint)/0.55)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300 ${className}`}>
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-medium leading-5">{item.message}</p>
        <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)} className="rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><X className="size-4" /></button>
      </div>
    })}
  </div>
}
