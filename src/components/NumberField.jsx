import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { parseAmount } from '@/lib/numbers'

export default function NumberField({
  value,
  onValueChange,
  min,
  max,
  decimals,
  suffix,
  className,
  ...props
}) {
  function handleChange(event) {
    let next = event.target.value.replace(/[^0-9.]/g, '')
    const [whole, ...fractionParts] = next.split('.')
    if (fractionParts.length) next = `${whole}.${fractionParts.join('')}`
    if (decimals != null && next.includes('.')) {
      const [nextWhole, fraction] = next.split('.')
      next = `${nextWhole}.${fraction.slice(0, decimals)}`
    }
    onValueChange(next)
  }

  function handleBlur() {
    const amount = parseAmount(value)
    if (amount == null) return
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, amount))
    onValueChange(String(clamped))
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(suffix && 'pr-12', props.className)}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}
