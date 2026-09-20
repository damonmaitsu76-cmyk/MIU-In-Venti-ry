import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { categoryLabel } from '@/lib/inventoryConfig'
import { canBeInRecipe, formatStock } from '@/lib/units'

export default function ItemSelect({
  value,
  onValueChange,
  items,
  filter = 'all',
  disabledValues = [],
  includePkgOnly = false,
  placeholder = 'Choose an item',
  id,
}) {
  const disabled = new Set(disabledValues.map(String))
  const visibleItems = items.filter((item) => {
    if (filter !== 'all' && item.item_type !== filter) return false
    return includePkgOnly || canBeInRecipe(item)
  })
  const groups = visibleItems.reduce((all, item) => {
    const key = `${item.item_type || 'ingredient'}-${item.category || 'other'}`
    if (!all[key]) all[key] = []
    all[key].push(item)
    return all
  }, {})
  const selectItems = Object.fromEntries(visibleItems.map((item) => [
    String(item.inventory_item_id), `${item.item_name} · ${item.unit}`,
  ]))

  return (
    <Select value={value} onValueChange={onValueChange} items={selectItems}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {Object.entries(groups).map(([group, groupItems]) => (
          <SelectGroup key={group}>
            <SelectLabel>{categoryLabel(groupItems[0].category)}</SelectLabel>
            {groupItems.map((item) => {
              const itemValue = String(item.inventory_item_id)
              const isPkgOnly = item.unit === 'pkg'
              return (
                <SelectItem key={itemValue} value={itemValue} disabled={disabled.has(itemValue) || isPkgOnly}>
                  <span>{item.item_name} · {item.unit}</span>
                  {isPkgOnly && <span className="text-xs text-muted-foreground">Whole pkg only</span>}
                  {item.current_quantity != null && <span className="text-xs text-muted-foreground">{formatStock(item)} left</span>}
                </SelectItem>
              )
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
