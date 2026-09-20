export const ITEM_TYPES = {
  ingredient: 'Ingredient',
  material: 'Material',
}

export const CATEGORY_OPTIONS = {
  ingredient: [
    { value: 'base', label: 'Base' },
    { value: 'milk', label: 'Milk' },
    { value: 'sweetener', label: 'Sweetener' },
    { value: 'flavor', label: 'Flavor' },
    { value: 'addon', label: 'Add-on' },
    { value: 'other', label: 'Other' },
  ],
  material: [
    { value: 'packaging', label: 'Packaging' },
    { value: 'serving', label: 'Serving' },
    { value: 'equipment', label: 'Equipment' },
  ],
}

export const INGREDIENT_UNITS = [
  { value: 'g', label: 'g' },
  { value: 'mL', label: 'mL' },
  { value: 'pc', label: 'pc' },
]

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ok', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock · reorder' },
  { value: 'out_of_stock', label: 'Out of stock' },
]

export const STOCK_STATUS = {
  ok: { label: 'In stock', variant: 'success' },
  low_stock: { label: 'Low stock · reorder', variant: 'warning' },
  out_of_stock: { label: 'Out of stock', variant: 'destructive' },
}

export function categoryLabel(value) {
  return Object.values(CATEGORY_OPTIONS).flat().find((option) => option.value === value)?.label || value || 'Uncategorised'
}

export function optionsToItems(options) {
  return options.reduce((items, option) => ({ ...items, [String(option.value)]: option.label }), {})
}
