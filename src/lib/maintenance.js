export function getMaintenanceState(item, now = new Date()) {
  if (!item?.needs_maintenance) return { status: 'not_needed', label: '' }
  const interval = Number(item.maintenance_interval_days)
  if (!Number.isInteger(interval) || interval <= 0) return { status: 'interval_unset', label: 'Interval not set' }
  if (!item.last_maintained_at) return { status: 'never_recorded', label: 'Not recorded' }
  const lastDone = new Date(item.last_maintained_at)
  if (Number.isNaN(lastDone.getTime())) return { status: 'never_recorded', label: 'Not recorded' }
  const dueAt = new Date(lastDone)
  dueAt.setDate(dueAt.getDate() + interval)
  const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / 86_400_000)
  if (daysUntilDue < 0) return { status: 'overdue', daysUntilDue, label: `Overdue ${Math.abs(daysUntilDue)} d` }
  if (daysUntilDue <= 3) return { status: 'due_soon', daysUntilDue, label: `Due in ${daysUntilDue} d` }
  return { status: 'ok', daysUntilDue, label: `Due in ${daysUntilDue} d` }
}
