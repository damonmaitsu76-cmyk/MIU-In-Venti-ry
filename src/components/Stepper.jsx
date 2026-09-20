import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Stepper({ value, onChange, min = 0, max = Infinity, step = 1, label }) {
  const numericValue = Number(value || 0)
  function change(next) {
    onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <div className="flex items-center justify-between gap-2" aria-label={label}>
      <Button type="button" variant="outline" size="icon-lg" onClick={() => change(numericValue - step)} disabled={numericValue <= min} aria-label={`Decrease ${label}`}><Minus /></Button>
      <span className="min-w-10 select-none text-center text-sm font-semibold tabular-nums text-foreground" aria-live="polite">{numericValue}</span>
      <Button type="button" variant="outline" size="icon-lg" onClick={() => change(numericValue + step)} disabled={numericValue >= max} aria-label={`Increase ${label}`}><Plus /></Button>
    </div>
  )
}
