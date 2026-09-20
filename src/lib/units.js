export function trimNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export function isPackTracked(item) {
  return item?.unit === 'pc' && item?.pack_size != null && Number(item.pack_size) > 0
}

export function resolveStorage({ trackingUnit, piecesPerPkg }) {
  const packSize = Number(piecesPerPkg)
  if (trackingUnit === 'pkg' && Number.isFinite(packSize) && packSize > 0) return { unit: 'pc', pack_size: packSize }
  return { unit: trackingUnit, pack_size: null }
}

export function describeTracking(item) {
  if (isPackTracked(item)) return { trackingUnit: 'pkg', piecesPerPkg: String(item.pack_size) }
  return { trackingUnit: item?.unit || 'pc', piecesPerPkg: '' }
}

export function formatStock(item, quantity = item?.current_quantity) {
  const amount = Number(quantity)
  if (!Number.isFinite(amount)) return '—'
  if (!isPackTracked(item)) return `${trimNumber(amount)} ${item?.unit || ''}`.trim()
  const packSize = Number(item.pack_size)
  const packages = Math.floor(amount / packSize)
  const pieces = amount - (packages * packSize)
  const parts = []
  if (packages) parts.push(`${trimNumber(packages)} pkg`)
  if (pieces || !parts.length) parts.push(`${trimNumber(pieces)} pc`)
  return `${parts.join(' + ')} (${trimNumber(amount)} pc)`
}

export function toStored(item, amount, enteredUnit) {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return null
  return isPackTracked(item) && enteredUnit === 'pkg' ? numeric * Number(item.pack_size) : numeric
}

export function fromStored(item, quantity, targetUnit) {
  const numeric = Number(quantity)
  if (!Number.isFinite(numeric)) return null
  return isPackTracked(item) && targetUnit === 'pkg' ? numeric / Number(item.pack_size) : numeric
}

export function recipeUnitLabel(item) {
  return item?.unit || ''
}

export function canBeInRecipe(item) {
  return item?.unit !== 'pkg'
}
