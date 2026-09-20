import { useEffect, useMemo, useState } from 'react'
import { Coffee, ShoppingCart, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ItemSelect from '@/components/ItemSelect'
import NumberField from '@/components/NumberField'
import Stepper from '@/components/Stepper'
import { formatPeso } from '@/lib/format'
import { imageUrlFor } from '@/lib/images'
import { parseAmount } from '@/lib/numbers'
import { canBeInRecipe, formatStock } from '@/lib/units'

function productMax(product) {
  const value = product.max_servings ?? product.max_available_qty
  return value == null ? null : Math.max(0, Number(value))
}

async function fetchOrderData() {
  return Promise.all([
    supabase.from('product_availability').select('*').eq('is_active', true).order('product_name', { ascending: true }),
    supabase.from('inventory_status').select('*').order('item_name', { ascending: true }),
  ])
}

export default function OrderEntry({ onInventoryChanged }) {
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [customOrderOpen, setCustomOrderOpen] = useState(false)
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false)

  async function loadOrderData() {
    setLoading(true)
    const [productsResult, inventoryResult] = await fetchOrderData()
    const error = productsResult.error || inventoryResult.error
    if (error) setLoadError(error.message)
    else { setProducts(productsResult.data || []); setInventory(inventoryResult.data || []); setLoadError(null) }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitialOrderData() {
      const [productsResult, inventoryResult] = await fetchOrderData()
      if (cancelled) return
      const error = productsResult.error || inventoryResult.error
      if (error) setLoadError(error.message)
      else { setProducts(productsResult.data || []); setInventory(inventoryResult.data || []); setLoadError(null) }
      setLoading(false)
    }
    loadInitialOrderData()
    return () => { cancelled = true }
  }, [])
  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0), [cart])
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + Number(line.quantity || 0), 0), [cart])
  function quantityInCart(productId) { return cart.find((line) => line.kind === 'standard' && String(line.product_id) === String(productId))?.quantity || 0 }
  function clearNotices() { setCheckoutError(null); setCheckoutSuccess(null) }
  function setProductQuantity(product, requestedQuantity) {
    const max = productMax(product) || 0
    const quantity = Math.min(max, Math.max(0, Math.floor(Number(requestedQuantity) || 0)))
    clearNotices()
    setCart((lines) => {
      const rest = lines.filter((line) => !(line.kind === 'standard' && String(line.product_id) === String(product.product_id)))
      return quantity ? [...rest, { kind: 'standard', key: `product-${product.product_id}`, product_id: product.product_id, product_name: product.product_name, price: Number(product.price || 0), quantity }] : rest
    })
  }
  function addCustomOrder(line) { clearNotices(); setCart((lines) => [...lines, line]) }
  function removeLine(key) { clearNotices(); setCart((lines) => lines.filter((line) => line.key !== key)) }
  async function completeOrder() {
    if (!cart.length) return
    setCheckingOut(true); clearNotices()
    const pLines = cart.map((line) => line.kind === 'standard'
      ? { kind: 'standard', product_id: line.product_id, qty: line.quantity }
      : { kind: 'custom', base_product_id: line.base_product_id, qty: line.quantity, ingredients: line.ingredients })
    const { error } = await supabase.rpc('checkout_order', { p_lines: pLines })
    setCheckingOut(false)
    if (error) { setCheckoutError(error.message); await loadOrderData(); return }
    setCart([]); setCheckoutSuccess('Order completed and inventory has been updated.'); setMobileOrderOpen(false)
    await loadOrderData(); onInventoryChanged?.()
  }

  return <section className="mx-auto max-w-7xl pb-32 text-left lg:pb-0"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Order entry</h1><p className="mt-1 text-sm text-muted-foreground">Build an order first; inventory is deducted only at checkout.</p></div><Button variant="outline" onClick={() => setCustomOrderOpen(true)}><UtensilsCrossed />Custom order</Button></div><div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"><div className="min-w-0">{loadError && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{loadError}</p><Button className="mt-2" variant="outline" size="sm" onClick={loadOrderData}>Retry</Button></div>}{loading ? <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4"><div className="h-80 animate-pulse rounded-xl bg-muted" /><div className="h-80 animate-pulse rounded-xl bg-muted" /></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">{products.map((product) => <ProductCard key={product.product_id} product={product} cartQuantity={quantityInCart(product.product_id)} onChangeQuantity={setProductQuantity} />)}{!products.length && <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">There are no active products yet. Add products and recipes in the Products page.</p>}</div>}</div><aside className="hidden h-fit rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:block"><OrderSummary cart={cart} total={total} checkingOut={checkingOut} checkoutError={checkoutError} checkoutSuccess={checkoutSuccess} onRemove={removeLine} onCheckout={completeOrder} /></aside></div><button type="button" className="fixed inset-x-3 bottom-16 z-30 flex min-h-12 items-center justify-between rounded-xl bg-primary px-4 text-left text-sm font-semibold text-primary-foreground shadow-lg lg:hidden" onClick={() => setMobileOrderOpen(true)}><span>View order · {itemCount} item{itemCount === 1 ? '' : 's'}</span><span>{formatPeso(total)}</span></button><Dialog open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}><DialogContent className="top-auto bottom-0 max-w-none translate-y-0 rounded-b-none sm:max-w-none"><DialogHeader><DialogTitle>Current order</DialogTitle></DialogHeader><OrderSummary cart={cart} total={total} checkingOut={checkingOut} checkoutError={checkoutError} checkoutSuccess={checkoutSuccess} onRemove={removeLine} onCheckout={completeOrder} /></DialogContent></Dialog><CustomOrderDialog open={customOrderOpen} onOpenChange={setCustomOrderOpen} products={products} inventory={inventory} onAdd={addCustomOrder} /></section>
}

function ProductCard({ product, cartQuantity, onChangeQuantity }) {
  const max = productMax(product)
  const noRecipe = max == null
  const noPrice = Number(product.price || 0) <= 0
  const unavailable = noRecipe || noPrice || max === 0
  const imageUrl = imageUrlFor(product)
  let availability = `Up to ${max} available`
  let availabilityClass = 'text-muted-foreground'
  if (noPrice) availability = 'Set price before ordering'
  else if (noRecipe) availability = 'No recipe yet'
  else if (max === 0) { availability = `Unavailable — out of ${product.limiting_item_name || 'stock'}`; availabilityClass = 'text-destructive' }
  else if (max <= 3) { availability = `Only ${max} left`; availabilityClass = 'text-amber-700' }
  return <article className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card ${unavailable ? 'opacity-65' : ''}`}><div className="aspect-[4/3] bg-muted">{imageUrl ? <img className="size-full object-cover" src={imageUrl} alt="" /> : <div className="flex size-full items-center justify-center"><Coffee className="size-10 text-muted-foreground" /></div>}</div><div className="flex flex-1 flex-col gap-3 p-4"><div className="flex min-w-0 items-start gap-3"><h2 className="min-w-0 flex-1 line-clamp-2 text-base font-semibold leading-snug text-foreground">{product.product_name}</h2><span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${noPrice ? 'text-muted-foreground' : 'text-foreground'}`}>{noPrice ? 'Set price' : formatPeso(product.price)}</span></div><p className={`text-sm ${availabilityClass}`}>{availability}</p><div className="mt-auto"><Stepper value={cartQuantity} onChange={(quantity) => onChangeQuantity(product, quantity)} min={0} max={unavailable ? 0 : max} label={`${product.product_name} in current order`} /></div></div></article>
}

function OrderSummary({ cart, total, checkingOut, checkoutError, checkoutSuccess, onRemove, onCheckout }) {
  return <div className="grid gap-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Current order</h2><ShoppingCart className="size-5 text-muted-foreground" /></div>{cart.length ? <><div className="grid gap-3">{cart.map((line) => <CartLine key={line.key} line={line} onRemove={onRemove} />)}</div><div className="flex items-center justify-between border-t pt-3 font-semibold text-foreground"><span>Total</span><span className="tabular-nums">{formatPeso(total)}</span></div>{checkoutError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Checkout could not be completed: {checkoutError}</p>}{checkoutSuccess && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{checkoutSuccess}</p>}<Button onClick={onCheckout} disabled={checkingOut}>{checkingOut ? 'Completing order…' : 'Complete order'}</Button></> : <p className="text-sm text-muted-foreground">No items in this order yet.</p>}</div>
}

function CartLine({ line, onRemove }) {
  return <div className="flex items-start justify-between gap-2 text-sm"><div><p className="font-medium text-foreground">{line.kind === 'custom' ? `${line.product_name} — custom` : line.product_name}</p><p className="text-muted-foreground">{line.quantity} × {formatPeso(line.price)}</p>{line.kind === 'custom' && <p className="mt-1 text-xs text-muted-foreground">{line.ingredients.length} custom ingredient{line.ingredients.length === 1 ? '' : 's'}</p>}</div><div className="flex items-center gap-1"><span className="font-medium tabular-nums text-foreground">{formatPeso(Number(line.price) * Number(line.quantity))}</span><Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => onRemove(line.key)} aria-label={`Remove ${line.product_name}`}><Trash2 /></Button></div></div>
}

function CustomOrderDialog({ open, onOpenChange, products, inventory, onAdd }) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [rows, setRows] = useState([])
  const [originalRows, setOriginalRows] = useState([])
  const [loadingRecipe, setLoadingRecipe] = useState(false)
  const [error, setError] = useState(null)
  const availableProducts = products.filter((product) => productMax(product) !== null && productMax(product) > 0 && Number(product.price || 0) > 0)
  const selectedProduct = availableProducts.find((product) => String(product.product_id) === String(productId))
  const productItems = Object.fromEntries(availableProducts.map((product) => [String(product.product_id), product.product_name]))
  const selectedIds = rows.map((row) => String(row.inventory_item_id)).filter(Boolean)
  const validRows = rows.filter((row) => row.inventory_item_id && parseAmount(row.amount) != null && parseAmount(row.amount) > 0)
  const maxQuantity = validRows.length ? Math.max(0, Math.min(...validRows.map((row) => {
    const item = inventory.find((entry) => String(entry.inventory_item_id) === String(row.inventory_item_id))
    return item ? Math.floor(Number(item.current_quantity) / Number(row.amount)) : 0
  }))) : 0
  const parsedQuantity = Math.min(Math.max(1, Math.floor(parseAmount(quantity) || 1)), Math.max(1, maxQuantity || 1))

  useEffect(() => {
    if (!open || !productId) return undefined
    let cancelled = false
    async function loadRecipe() {
      setLoadingRecipe(true); setError(null)
      const { data, error: recipeError } = await supabase.from('recipes').select('recipe_id, recipe_items(inventory_item_id, quantity_required)').eq('product_id', Number(productId)).maybeSingle()
      if (cancelled) return
      if (recipeError) { setError(recipeError.message); setRows([]); setOriginalRows([]) }
      else {
        const nextRows = (data?.recipe_items || []).map((row) => ({ key: crypto.randomUUID(), inventory_item_id: String(row.inventory_item_id), amount: String(row.quantity_required) }))
        setRows(nextRows); setOriginalRows(nextRows.map((row) => ({ ...row })))
      }
      setLoadingRecipe(false)
    }
    loadRecipe()
    return () => { cancelled = true }
  }, [open, productId])

  function reset() { setProductId(''); setQuantity('1'); setRows([]); setOriginalRows([]); setError(null); setLoadingRecipe(false) }
  function setRow(key, field, value) { setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row)) }
  function removeRow(key) { setRows((current) => current.filter((row) => row.key !== key)) }
  function resetOriginal() { setRows(originalRows.map((row) => ({ ...row, key: crypto.randomUUID() }))); setQuantity('1'); setError(null) }
  function rowChanged(row) { const original = originalRows.find((entry) => entry.inventory_item_id === row.inventory_item_id); return !original || Number(original.amount) !== Number(row.amount) }
  function addToCart(event) {
    event.preventDefault()
    if (!selectedProduct) return setError('Choose a base product.')
    if (!rows.length || rows.some((row) => !row.inventory_item_id || parseAmount(row.amount) == null || parseAmount(row.amount) <= 0)) return setError('Keep at least one item with a positive amount.')
    if (maxQuantity < 1) return setError('The edited recipe is not available at the current stock levels.')
    if (parseAmount(quantity) == null || parseAmount(quantity) < 1 || parseAmount(quantity) > maxQuantity) return setError(`Quantity must be between 1 and ${maxQuantity}.`)
    const ingredients = rows.map((row) => ({ inventory_item_id: Number(row.inventory_item_id), amount: Number(row.amount) }))
    onAdd({ kind: 'custom', key: `custom-${crypto.randomUUID()}`, base_product_id: selectedProduct.product_id, product_name: selectedProduct.product_name, price: Number(selectedProduct.price || 0), quantity: parsedQuantity, ingredients })
    onOpenChange(false); reset()
  }
  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Custom order</DialogTitle></DialogHeader><form onSubmit={addToCart} className="grid gap-5"><p className="text-sm text-muted-foreground">Start from a product recipe, then adjust the ingredients before adding this custom drink to the local order.</p><div className="grid gap-1.5"><Label htmlFor="custom-base">Base product</Label><Select value={productId} onValueChange={(value) => { setProductId(value); setQuantity('1') }} items={productItems}><SelectTrigger id="custom-base" className="w-full"><SelectValue placeholder="Choose a product" /></SelectTrigger><SelectContent>{availableProducts.map((product) => <SelectItem key={product.product_id} value={String(product.product_id)}>{product.product_name}</SelectItem>)}</SelectContent></Select></div>{selectedProduct && <div className="flex flex-wrap items-end gap-3"><div className="grid w-36 gap-1.5"><Label htmlFor="custom-quantity">Quantity</Label><NumberField id="custom-quantity" value={quantity} onValueChange={setQuantity} min={1} decimals={0} /></div><p className="pb-2 text-sm text-muted-foreground">Up to {maxQuantity} based on the edited recipe.</p></div>}{loadingRecipe && <p className="text-sm text-muted-foreground">Loading recipe…</p>}{selectedProduct && !loadingRecipe && <fieldset className="grid gap-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><legend className="text-base font-semibold text-foreground">Ingredients and materials</legend><p className="text-sm text-muted-foreground">Amounts are per drink. Whole-package materials cannot be added.</p></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), inventory_item_id: '', amount: '' }])}>+ Add ingredient or material</Button><Button type="button" variant="ghost" size="sm" onClick={resetOriginal} disabled={!originalRows.length}>Reset to original recipe</Button></div></div>{rows.map((row) => { const item = inventory.find((entry) => String(entry.inventory_item_id) === String(row.inventory_item_id)); return <div key={row.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"><div className="grid gap-1"><Label htmlFor={`custom-item-${row.key}`}>{item?.item_name || 'Item'}{rowChanged(row) && <span className="ml-2 text-xs font-normal text-amber-700">Changed</span>}</Label><ItemSelect id={`custom-item-${row.key}`} value={row.inventory_item_id} onValueChange={(value) => setRow(row.key, 'inventory_item_id', value)} items={inventory.filter(canBeInRecipe)} disabledValues={selectedIds.filter((id) => id !== String(row.inventory_item_id))} includePkgOnly={false} placeholder="Choose ingredient or material" />{item && <p className="text-xs text-muted-foreground">Currently {formatStock(item)} available</p>}</div><div className="grid gap-1.5"><Label htmlFor={`custom-amount-${row.key}`}>Amount per drink ({item?.unit || 'unit'})</Label><NumberField id={`custom-amount-${row.key}`} value={row.amount} onValueChange={(value) => setRow(row.key, 'amount', value)} min={0} suffix={item?.unit} /></div><Button type="button" variant="ghost" size="icon-lg" className="text-destructive" onClick={() => removeRow(row.key)} aria-label={`Remove ${item?.item_name || 'item'}`}><Trash2 /></Button></div>})}{!rows.length && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Add at least one ingredient or material.</p>}</fieldset>}{error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}<DialogFooter><Button type="submit" disabled={!selectedProduct || loadingRecipe}>Add custom drink to order</Button></DialogFooter></form></DialogContent></Dialog>
}
