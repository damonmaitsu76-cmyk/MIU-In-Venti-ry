export function parseAmount(value) {
  if (value == null || value === '' || !/^\d*(\.\d*)?$/.test(value)) return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}
