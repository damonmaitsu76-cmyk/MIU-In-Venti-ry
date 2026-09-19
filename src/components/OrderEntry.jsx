import { useEffect, useMemo, useState } from 'react'
import { Coffee, Minus, Plus, ShoppingCart, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/formatPrice'

export default function OrderEntry() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [customOrderOpen, setCustomOrderOpen] = useState(false)

  async function loadProducts() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_orderable_products')
    if (error) setLoadError(error.message)
    else {
      setProducts(data || [])
      setLoadError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialProducts() {
      const { data, error } = await supabase.rpc('get_orderable_products')
      if (cancelled) return
      if (error) setLoadError(error.message)
      else {
        setProducts(data || [])
        setLoadError(null)
      }
      setLoading(false)
    }

    loadInitialProducts()
    return () => { cancelled = true }
  }, [])

  const standardCartItems = useMemo(() => cart.filter((line) => line.kind === 'product'), [cart])
  const customCartItems = useMemo(() => cart.filter((line) => line.kind === 'custom'), [cart])
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0),
    [cart],
  )

  function quantityInCart(productId) {
    return standardCartItems.find((line) => String(line.product_id) === String(productId))?.quantity || 0
  }

  function setProductQuantity(product, requestedQuantity) {
    const max = Math.max(0, Number(product.max_available_qty || 0))
    const quantity = Math.max(0, Math.min(Math.floor(Number(requestedQuantity) || 0), max))
    setCheckoutError(null)
    setCheckoutSuccess(null)
    setCart((lines) => {
      const otherLines = lines.filter((line) => !(line.kind === 'product' && String(line.product_id) === String(product.product_id)))
      if (!quantity) return otherLines
      return [...otherLines, {
        kind: 'product',
        key: `product-${product.product_id}`,
        product_id: product.product_id,
        product_name: product.product_name,
        price: Number(product.price || 0),
        quantity,
      }]
    })
  }

  function addCustomOrder(customLine) {
    setCheckoutError(null)
    setCheckoutSuccess(null)
    setCart((lines) => [...lines, customLine])
  }

  function removeCartLine(key) {
    setCheckoutError(null)
    setCheckoutSuccess(null)
    setCart((lines) => lines.filter((line) => line.key !== key))
  }

  async function completeOrder() {
    if (!cart.length) return
    setCheckingOut(true)
    setCheckoutError(null)
    setCheckoutSuccess(null)

    const productLines = standardCartItems.map((line) => ({ product_id: line.product_id, qty: line.quantity }))
    const customLineMap = new Map()
    customCartItems.flatMap((line) => line.lines).forEach((line) => {
      const existing = customLineMap.get(String(line.inventory_item_id)) || 0
      customLineMap.set(String(line.inventory_item_id), existing + Number(line.quantity))
    })
    const customLines = [...customLineMap.entries()].map(([inventoryItemId, quantity]) => ({
      inventory_item_id: Number(inventoryItemId),
      quantity,
    }))

    // This deliberately makes one call for the entire cart. The RPC validates
    // and deducts every standard and custom line in the same transaction.
    const { error } = await supabase.rpc('submit_order', {
      p_product_lines: productLines,
      p_custom_lines: customLines,
    })
    setCheckingOut(false)

    if (error) {
      setCheckoutError(error.message)
      await loadProducts()
      return
    }

    setCart([])
    setCheckoutSuccess('Order completed and inventory has been updated.')
    await loadProducts()
  }

  return (
    <section className="mx-auto max-w-7xl text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Order entry</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build an order first; inventory is deducted only at checkout.</p>
        </div>
        <Button variant="outline" onClick={() => setCustomOrderOpen(true)}><UtensilsCrossed />Custom order</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {loadError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}
          {loading ? <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Loading products…</p> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  cartQuantity={quantityInCart(product.product_id)}
                  onChangeQuantity={setProductQuantity}
                />
              ))}
              {!products.length && <p className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">There are no active products yet. Add products and recipes in the Products dashboard.</p>}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="m-0 text-lg font-semibold text-foreground">Current order</h2><ShoppingCart className="size-5 text-muted-foreground" /></div>
          {cart.length ? (
            <div className="grid gap-3">
              <div className="grid gap-3">
                {cart.map((line) => <CartLine key={line.key} line={line} onRemove={removeCartLine} />)}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 font-semibold text-foreground"><span>Total</span><span>{formatPrice(total)}</span></div>
              {checkoutError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Checkout could not be completed: {checkoutError} Review the updated availability and try again.</p>}
              {checkoutSuccess && <p className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">{checkoutSuccess}</p>}
              <Button onClick={completeOrder} disabled={checkingOut}>{checkingOut ? 'Completing order…' : 'Complete order'}</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items in this order yet.</p>
          )}
        </aside>
      </div>

      <CustomOrderDialog
        open={customOrderOpen}
        onOpenChange={setCustomOrderOpen}
        products={products}
        onAdd={addCustomOrder}
      />
    </section>
  )
}

function ProductCard({ product, cartQuantity, onChangeQuantity }) {
  const max = Math.max(0, Number(product.max_available_qty || 0))
  const soldOut = max === 0
  const exceedsAvailability = cartQuantity > max

  function increment(event) {
    event.stopPropagation()
    onChangeQuantity(product, cartQuantity + 1)
  }
  function decrement(event) {
    event.stopPropagation()
    onChangeQuantity(product, cartQuantity - 1)
  }
  function addOne() {
    if (!soldOut) onChangeQuantity(product, cartQuantity + 1)
  }

  return (
    <article
      className={`overflow-hidden rounded-lg border border-border bg-card transition ${soldOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-foreground/30'}`}
      onClick={soldOut ? undefined : addOne}
      onKeyDown={(event) => {
        if (!soldOut && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); addOne() }
      }}
      role={soldOut ? undefined : 'button'}
      tabIndex={soldOut ? undefined : 0}
      aria-disabled={soldOut || undefined}
    >
      <div className="flex h-36 items-center justify-center bg-muted">
        {product.image_url ? <img className="size-full object-cover" src={product.image_url} alt="" /> : <Coffee className="size-9 text-muted-foreground" />}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3"><h2 className="m-0 text-base font-semibold text-foreground">{product.product_name}</h2><span className="text-sm font-medium text-foreground">{formatPrice(product.price)}</span></div>
        {soldOut ? <p className="text-sm font-medium text-destructive">Sold out</p> : (
          <>
            <p className="text-xs text-muted-foreground">Up to {max} available</p>
            {exceedsAvailability && <p className="text-xs text-destructive">Cart quantity is above current availability. Reduce it before checkout.</p>}
            <div className="flex items-center justify-between" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="outline" size="icon-sm" onClick={decrement} disabled={!cartQuantity} aria-label={`Remove one ${product.product_name}`}><Minus /></Button>
              <span className="min-w-10 text-center text-sm font-semibold text-foreground" aria-label={`${cartQuantity} ${product.product_name} in current order`}>{cartQuantity}</span>
              <Button type="button" variant="outline" size="icon-sm" onClick={increment} disabled={cartQuantity >= max} aria-label={`Add one ${product.product_name}`}><Plus /></Button>
            </div>
          </>
        )}
      </div>
    </article>
  )
}

function CartLine({ line, onRemove }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <div><p className="font-medium text-foreground">{line.kind === 'custom' ? `Custom: ${line.product_name}` : line.product_name}</p><p className="text-muted-foreground">{line.quantity} × {formatPrice(line.price)}</p></div>
      <div className="flex items-center gap-1"><span className="font-medium text-foreground">{formatPrice(Number(line.price) * Number(line.quantity))}</span><Button variant="ghost" size="icon-xs" className="text-destructive" onClick={() => onRemove(line.key)} aria-label={`Remove ${line.product_name}`}><Trash2 /></Button></div>
    </div>
  )
}

function CustomOrderDialog({ open, onOpenChange, products, onAdd }) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const availableProducts = products.filter((product) => Number(product.max_available_qty || 0) > 0)
  const selectedProduct = availableProducts.find((product) => String(product.product_id) === String(productId))
  const selectedProductId = selectedProduct?.product_id ?? null
  const maxQuantity = Number(selectedProduct?.max_available_qty || 0)

  function reset() {
    setProductId(''); setQuantity(1); setIngredients([]); setError(null); setLoading(false)
  }

  useEffect(() => {
    if (!open || !selectedProductId) return
    let cancelled = false
    async function loadAvailability() {
      setLoading(true)
      setError(null)
      const { data, error: availabilityError } = await supabase.rpc('check_product_availability', {
        p_product_id: selectedProductId,
        p_qty: quantity,
      })
      if (!cancelled) {
        if (availabilityError) {
          setError(availabilityError.message)
          setIngredients([])
        } else {
          setIngredients((data || []).map((line) => ({
            key: crypto.randomUUID(),
            inventory_item_id: line.inventory_item_id,
            item_name: line.item_name,
            quantity: Number(line.required),
            available: Number(line.available),
          })))
        }
        setLoading(false)
      }
    }
    loadAvailability()
    return () => { cancelled = true }
  }, [open, selectedProductId, quantity])

  function changeQuantity(nextQuantity) {
    setQuantity(Math.max(1, Math.min(maxQuantity, Number(nextQuantity) || 1)))
  }

  function updateIngredient(key, value) {
    setIngredients((lines) => lines.map((line) => line.key === key ? { ...line, quantity: value } : line))
  }

  function removeIngredient(key) {
    setIngredients((lines) => lines.filter((line) => line.key !== key))
  }

  function addToCart(event) {
    event.preventDefault()
    const lines = ingredients.map((line) => ({ inventory_item_id: line.inventory_item_id, quantity: Number(line.quantity) }))
    if (!selectedProduct) {
      setError('Choose a base product.')
      return
    }
    if (!lines.length || lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setError('Keep at least one ingredient with a positive amount.')
      return
    }
    onAdd({
      kind: 'custom',
      key: `custom-${crypto.randomUUID()}`,
      product_name: selectedProduct.product_name,
      price: Number(selectedProduct.price || 0),
      quantity,
      lines,
    })
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) reset() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Custom order</DialogTitle></DialogHeader>
        <form onSubmit={addToCart} className="grid gap-5">
          <p className="text-sm text-muted-foreground">Start from a product recipe, then adjust the ingredients before adding this custom drink to the local order.</p>
          <div className="grid gap-1.5"><Label htmlFor="custom-base">Base product</Label><Select value={productId} onValueChange={(value) => { setProductId(value); setQuantity(1) }}><SelectTrigger id="custom-base" className="w-full"><SelectValue placeholder="Choose a product" /></SelectTrigger><SelectContent>{availableProducts.map((product) => <SelectItem key={product.product_id} value={String(product.product_id)}>{product.product_name}</SelectItem>)}</SelectContent></Select></div>
          {selectedProduct && <div className="flex items-end gap-2"><div className="grid gap-1.5"><Label htmlFor="custom-quantity">Quantity</Label><Input id="custom-quantity" type="number" min="1" max={maxQuantity} value={quantity} onChange={(event) => changeQuantity(event.target.value)} /></div><p className="pb-2 text-xs text-muted-foreground">Up to {maxQuantity} based on the original recipe.</p></div>}

          {loading && <p className="text-sm text-muted-foreground">Loading ingredient availability…</p>}
          {!loading && ingredients.length > 0 && <div className="grid gap-3"><div><h3 className="text-sm font-medium text-foreground">Ingredients</h3><p className="text-xs text-muted-foreground">You can change amounts or remove ingredients. Checkout will validate the edited list.</p></div>{ingredients.map((line) => <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-2"><div><p className="text-sm font-medium text-foreground">{line.item_name}</p><p className="text-xs text-muted-foreground">Currently {line.available} available</p></div><div className="grid gap-1.5"><Label htmlFor={`custom-line-${line.key}`}>Amount</Label><Input id={`custom-line-${line.key}`} type="number" min="0" step="any" value={line.quantity} onChange={(event) => updateIngredient(line.key, event.target.value)} /></div><Button type="button" variant="ghost" size="icon-sm" className="mb-px text-destructive" onClick={() => removeIngredient(line.key)} aria-label={`Remove ${line.item_name}`}><Trash2 /></Button></div>)}</div>}
          {productId && !loading && !ingredients.length && !error && <p className="text-sm text-destructive">This product has no recipe ingredients to customise.</p>}
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={!selectedProduct || loading}>Add custom drink to order</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
