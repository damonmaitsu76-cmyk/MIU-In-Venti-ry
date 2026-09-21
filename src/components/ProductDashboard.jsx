import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import ImageUpload from '@/components/ImageUpload'
import ItemSelect from '@/components/ItemSelect'
import NumberField from '@/components/NumberField'
import { formatPeso } from '@/lib/format'
import { imageUrlFor, uploadProductImage } from '@/lib/images'
import { parseAmount } from '@/lib/numbers'
import { canBeInRecipe, isPackTracked, recipeUnitLabel } from '@/lib/units'

const emptyRecipeRow = () => ({ key: crypto.randomUUID(), inventory_item_id: '', quantity_required: '' })

async function fetchProductDashboard() {
  return Promise.all([
    supabase.from('products').select('*').order('product_name', { ascending: true }),
    supabase.from('inventory_items').select('*').order('item_name', { ascending: true }),
  ])
}

export default function ProductDashboard() {
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  async function loadDashboard() {
    setLoading(true)
    const [productsResult, inventoryResult] = await fetchProductDashboard()
    const loadError = productsResult.error || inventoryResult.error
    if (loadError) setError(loadError.message)
    else { setProducts(productsResult.data || []); setInventory(inventoryResult.data || []); setError(null) }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitialDashboard() {
      const [productsResult, inventoryResult] = await fetchProductDashboard()
      if (cancelled) return
      const loadError = productsResult.error || inventoryResult.error
      if (loadError) setError(loadError.message)
      else { setProducts(productsResult.data || []); setInventory(inventoryResult.data || []); setError(null) }
      setLoading(false)
    }
    loadInitialDashboard()
    return () => { cancelled = true }
  }, [])
  function openNewProduct() { setSelectedProduct(null); setDialogOpen(true) }
  function openEditProduct(product) { setSelectedProduct(product); setDialogOpen(true) }
  function handleProductDeleted(message) { setNotice(message || null); loadDashboard() }

  return (
    <section className="mx-auto max-w-7xl text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Products</h1><p className="mt-1 text-sm text-muted-foreground">Manage menu items and the inventory recipe behind each one.</p></div><Button onClick={openNewProduct}><Plus />Add product</Button></div>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p><Button className="mt-2" variant="outline" size="sm" onClick={loadDashboard}>Retry</Button></div>}
      {notice && <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">{notice}</p>}
      {loading ? <div className="grid gap-2 rounded-xl border p-4"><div className="h-12 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /></div> : <div className="overflow-hidden rounded-xl border border-border bg-card"><table className="w-full text-sm"><thead className="border-b"><tr><th className="h-10 px-4 text-left font-medium">Image</th><th className="px-4 text-left font-medium">Name</th><th className="px-4 text-left font-medium">Price</th><th className="px-4 text-left font-medium">Status</th><th className="px-4 text-right font-medium">Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.product_id} className="border-b last:border-0 hover:bg-muted/40"><td className="p-4"><ProductThumbnail product={product} /></td><td className="p-4 font-medium text-foreground">{product.product_name}</td><td className="p-4 tabular-nums">{formatPeso(product.price)}</td><td className="p-4"><span className={product.is_active ? 'text-emerald-700' : 'text-muted-foreground'}>{product.is_active ? 'Active' : 'Archived'}</span></td><td className="p-4 text-right"><div className="inline-flex gap-2"><Button variant="outline" size="sm" onClick={() => openEditProduct(product)}>Edit</Button><DeleteProductButton product={product} onDeleted={handleProductDeleted} /></div></td></tr>)}{!products.length && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No products yet. Add a product and its recipe to make it orderable.</td></tr>}</tbody></table></div>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>{dialogOpen && <ProductDialog key={selectedProduct?.product_id ?? 'new'} product={selectedProduct} inventory={inventory} onClose={() => setDialogOpen(false)} onSaved={loadDashboard} />}</Dialog>
    </section>
  )
}

function DeleteProductButton({ product, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  async function deleteProduct() {
    setDeleting(true); setError(null)
    const { error: deleteError } = await supabase.from('products').delete().eq('product_id', product.product_id)
    if (deleteError) { setDeleting(false); setError('Could not delete this product. Please try again.'); return }
    let cleanupMessage = null
    if (product.image_path) {
      const { error: imageError } = await supabase.storage.from('product-images').remove([product.image_path])
      if (imageError) cleanupMessage = 'Product deleted, but its image could not be removed.'
    }
    setDeleting(false); setOpen(false); onDeleted(cleanupMessage)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!deleting) { setOpen(nextOpen); if (!nextOpen) setError(null) } }}>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}><Trash2 />Delete</Button>
      {open && <DialogContent size="sm" showCloseButton={!deleting}><DialogHeader><DialogTitle>Delete {product.product_name}?</DialogTitle></DialogHeader><DialogBody className="grid gap-3"><p className="text-sm text-muted-foreground">This permanently removes the product and its recipe. This can’t be undone.</p>{error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}</DialogBody><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button><Button type="button" variant="destructive" onClick={deleteProduct} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete product'}</Button></DialogFooter></DialogContent>}
    </Dialog>
  )
}

function ProductDialog({ product, inventory, onClose, onSaved }) {
  const [name, setName] = useState(product?.product_name || '')
  const [price, setPrice] = useState(product?.price == null ? '' : String(product.price))
  const [active, setActive] = useState(product?.is_active ?? true)
  const [ingredientRows, setIngredientRows] = useState([emptyRecipeRow()])
  const [materialRows, setMaterialRows] = useState([])
  const [loadingRecipe, setLoadingRecipe] = useState(Boolean(product))
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const ingredientItems = useMemo(() => inventory.filter((item) => item.item_type === 'ingredient'), [inventory])
  const materialItems = useMemo(() => inventory.filter((item) => item.item_type === 'material'), [inventory])
  const selectedIds = [...ingredientRows, ...materialRows].map((row) => String(row.inventory_item_id)).filter(Boolean)
  const blockedRows = [...ingredientRows, ...materialRows].filter((row) => row.inventory_item_id && !canBeInRecipe(inventory.find((item) => String(item.inventory_item_id) === String(row.inventory_item_id))))
  const hasBlockedRows = blockedRows.length > 0
  const displayedError = error || (hasBlockedRows ? 'Fix or remove the highlighted recipe lines before saving.' : null)

  useEffect(() => {
    if (!product) return undefined
    let cancelled = false
    async function loadRecipe() {
      const { data: recipe, error: recipeError } = await supabase.from('recipes').select('recipe_id, recipe_items(inventory_item_id, quantity_required)').eq('product_id', product.product_id).maybeSingle()
      if (cancelled) return
      if (recipeError) { setError(recipeError.message); setLoadingRecipe(false); return }
      const rows = recipe?.recipe_items || []
      const hydrated = rows.map((row) => ({ ...row, key: crypto.randomUUID() }))
      const nextIngredients = hydrated.filter((row) => inventory.find((item) => item.inventory_item_id === row.inventory_item_id)?.item_type !== 'material')
      const nextMaterials = hydrated.filter((row) => inventory.find((item) => item.inventory_item_id === row.inventory_item_id)?.item_type === 'material')
      setIngredientRows(nextIngredients.length ? nextIngredients : [emptyRecipeRow()])
      setMaterialRows(nextMaterials)
      setLoadingRecipe(false)
    }
    loadRecipe()
    return () => { cancelled = true }
  }, [inventory, product])

  function changeRow(setRows, key, field, value) { setRows((rows) => rows.map((row) => row.key === key ? { ...row, [field]: value } : row)) }
  function removeRow(setRows, key, keepOne) { setRows((rows) => { const next = rows.filter((row) => row.key !== key); return keepOne && !next.length ? [emptyRecipeRow()] : next }) }
  async function save(event) {
    event.preventDefault()
    const combinedRows = [...ingredientRows, ...materialRows].filter((row) => row.inventory_item_id || row.quantity_required)
    const normalizedRows = combinedRows.map((row) => ({ inventory_item_id: Number(row.inventory_item_id), quantity_required: parseAmount(row.quantity_required) }))
    const normalizedIngredients = ingredientRows.filter((row) => row.inventory_item_id || row.quantity_required)
    if (!name.trim()) return setError('Product name is required.')
    if (parseAmount(price) == null || parseAmount(price) < 0) return setError('Enter a valid price.')
    if (!normalizedIngredients.length) return setError('Add at least one ingredient.')
    if (normalizedRows.some((row) => !Number.isInteger(row.inventory_item_id) || row.inventory_item_id <= 0 || row.quantity_required == null || row.quantity_required <= 0)) return setError('Every selected item needs a positive amount.')
    if (new Set(normalizedRows.map((row) => row.inventory_item_id)).size !== normalizedRows.length) return setError('Use each item only once in a recipe.')
    const blockedItems = normalizedRows.map((row) => inventory.find((item) => item.inventory_item_id === row.inventory_item_id)).filter((item) => !canBeInRecipe(item))
    if (blockedItems.length) {
      const names = [...new Set(blockedItems.map((item) => item.item_name))].join(', ')
      return setError(`${names} ${blockedItems.length === 1 ? 'is' : 'are'} tracked by whole package and can't be part of a recipe. Set pieces per pkg in Inventory first.`)
    }
    setSaving(true); setError(null)
    let uploadedPath = null
    try {
      uploadedPath = imageFile ? await uploadProductImage(imageFile) : null
      const imagePath = imageRemoved ? null : uploadedPath || product?.image_path || null
      const { error: saveError } = await supabase.rpc('save_product', { p_product_id: product?.product_id ?? null, p_name: name.trim(), p_price: parseAmount(price), p_image_path: imagePath, p_is_active: active, p_items: normalizedRows })
      if (saveError) throw saveError
      const oldPath = product?.image_path
      if (oldPath && oldPath !== imagePath) await supabase.storage.from('product-images').remove([oldPath])
      setSaving(false); onClose(); onSaved()
    } catch (saveError) {
      if (uploadedPath) await supabase.storage.from('product-images').remove([uploadedPath])
      setSaving(false); setError(saveError.message || 'Could not save this product.')
    }
  }

  return (
    <DialogContent size="lg">
      <DialogHeader><DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle></DialogHeader>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <DialogBody className="grid gap-6">
          <fieldset className="grid gap-4"><legend className="text-base font-semibold text-foreground">Details</legend><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="product-name">Name</Label><Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="product-price">Price</Label><NumberField id="product-price" value={price} onValueChange={setPrice} min={0} decimals={2} suffix="₱" /></div></div><div className="grid gap-1.5"><Label>Image</Label><ImageUpload product={imageRemoved ? null : product} file={imageFile} onFileChange={(file) => { setImageFile(file); setImageRemoved(false) }} onRemove={() => { setImageFile(null); setImageRemoved(true) }} disabled={saving} /></div><div className="flex items-center gap-2"><Switch id="product-active" checked={active} onCheckedChange={setActive} /><Label htmlFor="product-active" className="cursor-pointer font-normal">Active and available to order</Label></div></fieldset>
          {loadingRecipe ? <p className="text-sm text-muted-foreground">Loading recipe…</p> : <><RecipeSection title="Ingredients" description="These are the drink's consumable ingredients." rows={ingredientRows} items={ingredientItems} selectedIds={selectedIds} onAdd={() => setIngredientRows((rows) => [...rows, emptyRecipeRow()])} onUpdate={(key, field, value) => changeRow(setIngredientRows, key, field, value)} onRemove={(key) => removeRow(setIngredientRows, key, true)} keepOne /><RecipeSection title="Materials" description="Materials can be added only when tracked by piece. Items tracked by whole package (Cups, Straws, Cellophane, Parchment Paper, Tissue) must first be given a pieces-per-package number in Inventory → Edit → Set pieces per pkg." rows={materialRows} items={materialItems} selectedIds={selectedIds} onAdd={() => setMaterialRows((rows) => [...rows, emptyRecipeRow()])} onUpdate={(key, field, value) => changeRow(setMaterialRows, key, field, value)} onRemove={(key) => removeRow(setMaterialRows, key, false)} /></>}
        </DialogBody>
        {displayedError && <p className="mx-6 mb-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{displayedError}</p>}
        <DialogFooter><Button type="submit" disabled={saving || loadingRecipe || hasBlockedRows}>{saving ? 'Saving…' : 'Save product and recipe'}</Button></DialogFooter>
      </form>
    </DialogContent>
  )
}

function RecipeSection({ title, description, rows, items, selectedIds, onAdd, onUpdate, onRemove, keepOne }) {
  return (
    <fieldset className="grid gap-3 rounded-xl border p-4">
      <legend className="px-1 text-base font-semibold text-foreground">{title}</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}><Plus />Add {title === 'Ingredients' ? 'ingredient' : 'material'}</Button>
      </div>
      {rows.map((row) => {
        const selected = items.find((item) => String(item.inventory_item_id) === String(row.inventory_item_id))
        const blocked = selected && !canBeInRecipe(selected)
        const amount = Number(row.quantity_required)
        const wholePackageAmount = isPackTracked(selected) && Number.isFinite(amount) && amount >= Number(selected.pack_size)
        return (
          <div key={row.key} className={`grid gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_10rem_2.25rem] sm:items-end ${blocked ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-3' : ''}`}>
            <div className="grid min-w-0 gap-1.5">
              <Label className="min-w-0" htmlFor={`recipe-item-${row.key}`}><span className="truncate">{selected?.item_name || (title === 'Ingredients' ? 'Ingredient' : 'Material')}</span></Label>
              <ItemSelect id={`recipe-item-${row.key}`} value={String(row.inventory_item_id)} onValueChange={(value) => onUpdate(row.key, 'inventory_item_id', value)} items={items} filter={title === 'Ingredients' ? 'ingredient' : 'material'} includePkgOnly={title === 'Materials'} disabledValues={selectedIds.filter((id) => id !== String(row.inventory_item_id))} placeholder={`Choose ${title.toLowerCase().slice(0, -1)}`} />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label className="whitespace-nowrap" htmlFor={`recipe-amount-${row.key}`}>Amount per product</Label>
              <NumberField id={`recipe-amount-${row.key}`} value={row.quantity_required} onValueChange={(value) => onUpdate(row.key, 'quantity_required', value)} min={0} suffix={recipeUnitLabel(selected)} disabled={blocked} />
            </div>
            <Button type="button" variant="ghost" size="icon" className="justify-self-end text-destructive sm:justify-self-auto" onClick={() => onRemove(row.key)} disabled={keepOne && rows.length === 1} aria-label={`Remove ${selected?.item_name || title}`}><Trash2 /></Button>
            {blocked && <p className="flex items-center gap-1.5 text-xs text-destructive sm:col-span-full"><TriangleAlert className="size-4 shrink-0" />{selected.item_name} is tracked by whole package, so one product can't use it. Set its pieces per package in Inventory, or remove this line.</p>}
            {!blocked && isPackTracked(selected) && <p className={`text-xs sm:col-span-full ${wholePackageAmount ? 'text-amber-800' : 'text-muted-foreground'}`}>1 pkg = {selected.pack_size} pc{wholePackageAmount && ` — That's a whole package or more (${selected.pack_size} pc per pkg). Enter the pieces used by one product.`}</p>}
          </div>
        )
      })}
      {!items.length && <p className="text-sm text-muted-foreground">Add matching inventory items first.</p>}
    </fieldset>
  )
}

function ProductThumbnail({ product }) {
  const imageUrl = imageUrlFor(product)
  if (!imageUrl) return <div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon className="size-4" /></div>
  return <img className="size-10 rounded object-cover" src={imageUrl} alt="" />
}
