import { categoryLabel } from '@/lib/inventoryConfig'
import { formatManilaDateTime, formatManilaDayHeading, formatPeso } from '@/lib/format'
import { formatStock } from '@/lib/units'

export const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
]

export const SHOW_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'inventory', label: 'Stock & inventory' },
  { value: 'product', label: 'Products & recipes' },
]

const STOCK_ACTIONS = [
  { value: 'restock', label: 'Restocked' },
  { value: 'usage', label: 'Used' },
  { value: 'correction', label: 'Recounted' },
  { value: 'order_deduction', label: 'Order deductions' },
  { value: 'unit_converted', label: 'Converted to pieces' },
  { value: 'maintenance', label: 'Maintenance done' },
  { value: 'edited', label: 'Edited' },
  { value: 'created', label: 'Added' },
  { value: 'deleted', label: 'Deleted' },
]

const PRODUCT_ACTIONS = [
  { value: 'created', label: 'Added' },
  { value: 'edited', label: 'Edited' },
  { value: 'recipe_changed', label: 'Recipe changed' },
  { value: 'archived', label: 'Archived' },
  { value: 'restored', label: 'Restored' },
  { value: 'deleted', label: 'Deleted' },
]

export const ACTION_LABELS = {
  restock: 'Restocked', usage: 'Used', correction: 'Recounted', order_deduction: 'Order deduction',
  unit_converted: 'Converted to pieces', maintenance: 'Maintenance done', edited: 'Edited',
  created: 'Added', deleted: 'Deleted', recipe_changed: 'Recipe changed', archived: 'Archived', restored: 'Restored',
}

export const ACTION_TONES = {
  restock: 'success', usage: 'destructive', correction: 'neutral', order_deduction: 'neutral',
  unit_converted: 'warning', maintenance: 'warning', edited: 'neutral', created: 'success',
  deleted: 'destructive', archived: 'neutral', restored: 'success', recipe_changed: 'neutral',
}

export function actionOptionsForShow(show) {
  if (show === 'inventory') return [{ value: 'all', label: 'All changes' }, ...STOCK_ACTIONS]
  if (show === 'product') return [{ value: 'all', label: 'All changes' }, ...PRODUCT_ACTIONS]
  const actions = new Map()
  for (const option of [...STOCK_ACTIONS, ...PRODUCT_ACTIONS]) {
    const shared = ['created', 'edited', 'deleted'].includes(option.value)
    actions.set(option.value, { ...option, label: shared ? ({ created: 'Added', edited: 'Edited', deleted: 'Deleted' }[option.value]) : option.label })
  }
  return [{ value: 'all', label: 'All changes' }, ...actions.values()]
}

export function activityEntityLabel(entityType) {
  return entityType === 'product' ? 'Products & recipes' : 'Stock & inventory'
}

function auditItem(row) {
  return { unit: row.unit, pack_size: row.pack_size }
}

function changeValue(key, value) {
  if (value == null || value === '') return '—'
  if (key === 'category') return categoryLabel(value)
  if (key === 'price') return formatPeso(value)
  if (['needs_maintenance', 'is_active'].includes(key)) return value ? 'Yes' : 'No'
  if (key === 'last_maintained_at') return formatManilaDateTime(value)
  return String(value)
}

export function describeChange(key, value) {
  if (value && typeof value === 'object' && ('old_quantity' in value || 'new_quantity' in value)) {
    const name = value.item_name || 'Recipe item'
    if (value.old_quantity == null) return { label: 'Recipe', text: `${name}: added ${value.new_quantity}` }
    if (value.new_quantity == null) return { label: 'Recipe', text: `${name}: removed (was ${value.old_quantity})` }
    return { label: 'Recipe', text: `${name}: ${value.old_quantity} → ${value.new_quantity}` }
  }
  const labels = {
    item_name: 'Name', item_type: 'Type', category: 'Category', unit: 'Unit', pack_size: 'Pieces per package',
    minimum_quantity: 'Low-stock threshold', needs_maintenance: 'Needs maintenance',
    maintenance_interval_days: 'Maintenance every (days)', last_maintained_at: 'Last maintained',
    product_name: 'Name', price: 'Price', is_active: 'Active', image_path: 'Photo',
  }
  if (key === 'image_path') {
    if (!value?.old && value?.new) return { label: labels[key], before: '—', after: 'Added' }
    if (value?.old && !value?.new) return { label: labels[key], before: 'Existing', after: 'Removed' }
    return { label: labels[key], before: 'Existing', after: 'Changed' }
  }
  return {
    label: labels[key] || key.replaceAll('_', ' '),
    before: changeValue(key, value?.old),
    after: changeValue(key, value?.new),
  }
}

export function describeActivity(row) {
  const staff = row.actor_name || 'System'
  const name = row.entity_name || 'Deleted record'
  const item = auditItem(row)
  const usedAmount = row.quantity_delta == null ? '' : formatStock(item, Math.abs(Number(row.quantity_delta)))
  const verbs = {
    restock: `restocked ${name}`,
    usage: `used ${usedAmount}${usedAmount ? ' of ' : ''}${name}`,
    correction: `recounted ${name}`,
    order_deduction: `deducted ${name} for an order`,
    unit_converted: `converted ${name} to piece tracking`,
    maintenance: `marked ${name} as maintained`,
    edited: `edited ${name}`,
    created: `added ${name}`,
    deleted: `deleted ${name}`,
    archived: `archived ${name}`,
    restored: `restored ${name}`,
    recipe_changed: `changed the recipe of ${name}`,
  }
  return { headline: `${staff} ${verbs[row.action] || `updated ${name}`}`, staff, name }
}

export function describeBatch(rows) {
  const first = rows[0]
  const staff = first?.actor_name || 'System'
  const source = first?.source
  if (source === 'order') return { headline: `${staff} completed an order — ${rows.length} item${rows.length === 1 ? '' : 's'} deducted`, staff }
  if (source === 'product') {
    const productRow = rows.find((row) => row.entity_type === 'product')
    const productName = productRow?.entity_name || first?.entity_name || 'a product'
    if (productRow?.action === 'created') return { headline: `${staff} added product ${productName}`, staff }
    const recipeCount = rows.filter((row) => row.action === 'recipe_changed').length
    return { headline: `${staff} updated product ${productName}${recipeCount ? ` (${recipeCount} recipe change${recipeCount === 1 ? '' : 's'})` : ''}`, staff }
  }
  if (source === 'conversion') return { headline: `${staff} converted ${first?.entity_name || 'an item'} to piece tracking`, staff }
  return { headline: `${staff} made ${rows.length} changes`, staff }
}

export function groupRowsByDay(rows) {
  const groups = new Map()
  for (const row of rows) {
    const heading = formatManilaDayHeading(row.created_at)
    if (!groups.has(heading)) groups.set(heading, [])
    groups.get(heading).push(row)
  }
  return [...groups.entries()].map(([heading, entries]) => ({ heading, entries }))
}
