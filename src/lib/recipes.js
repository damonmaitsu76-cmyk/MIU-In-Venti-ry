import { supabase } from '@/supabaseClient'

export async function fetchPackageBlockedProducts(inventory) {
  const wholePackages = new Map(
    inventory
      .filter((item) => item.unit === 'pkg')
      .map((item) => [String(item.inventory_item_id), item.item_name])
  )
  if (!wholePackages.size) return new Map()

  const { data, error } = await supabase
    .from('recipes')
    .select('product_id, recipe_items(inventory_item_id)')
  if (error) throw error

  const blockedProducts = new Map()
  for (const recipe of data || []) {
    const blockedItem = recipe.recipe_items?.find((row) => wholePackages.has(String(row.inventory_item_id)))
    if (blockedItem) blockedProducts.set(String(recipe.product_id), wholePackages.get(String(blockedItem.inventory_item_id)))
  }
  return blockedProducts
}
