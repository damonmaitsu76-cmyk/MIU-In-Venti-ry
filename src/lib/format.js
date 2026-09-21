export function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export function formatManilaDateTime(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

export function manilaDateString(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(value)
}

export function dayBoundary(date, end = false) {
  return `${date}T${end ? '23:59:59.999' : '00:00:00'}+08:00`
}

export function formatManilaTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

export function formatManilaDayHeading(value, now = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown day'
  const current = new Date(now)
  const today = manilaDateString(current)
  const yesterday = manilaDateString(new Date(current.getTime() - 24 * 60 * 60 * 1000))
  const dateString = manilaDateString(date)
  if (dateString === today) return 'Today'
  if (dateString === yesterday) return 'Yesterday'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric',
  }).format(date)
}

export function formatRelative(value, now = Date.now()) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'Unknown time'
  const minutes = Math.round((time - now) / 60_000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}
