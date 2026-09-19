import { useEffect, useState } from 'react'
import { ImageIcon, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatPrice } from '@/lib/formatPrice'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const emptyRecipeRow = () => ({ key: crypto.randomUUID(), inventory_item_id: '', quantity_required: '' })

export default function ProductDashboard() {
  const [products, setProducts] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  async function loadDashboard() {
    setLoading(true)
    const [productsResult, ingredientsResult] = await Promise.all([
      supabase.from('products').select('*').order('product_name', { ascending: true }),
      supabase.from('inventory_items').select('inventory_item_id, item_name, unit').order('item_name', { ascending: true }),
    ])

    const loadError = productsResult.error || ingredientsResult.error
    if (loadError) setError(loadError.message)
    else {
      setProducts(productsResult.data || [])
      setIngredients(ingredientsResult.data || [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialDashboard() {
      const [productsResult, ingredientsResult] = await Promise.all([
        supabase.from('products').select('*').order('product_name', { ascending: true }),
        supabase.from('inventory_items').select('inventory_item_id, item_name, unit').order('item_name', { ascending: true }),
      ])
      if (cancelled) return

      const loadError = productsResult.error || ingredientsResult.error
      if (loadError) setError(loadError.message)
      else {
        setProducts(productsResult.data || [])
        setIngredients(ingredientsResult.data || [])
        setError(null)
      }
      setLoading(false)
    }

    loadInitialDashboard()
    return () => { cancelled = true }
  }, [])

  function openNewProduct() {
    setSelectedProduct(null)
    setDialogOpen(true)
  }

  function openEditProduct(product) {
    setSelectedProduct(product)
    setDialogOpen(true)
  }

  return (
    <section className="mx-auto max-w-7xl text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage menu items and the inventory recipe behind each one.</p>
        </div>
        <Button onClick={openNewProduct}><Plus />Add product</Button>
      </div>

      {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading products…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.product_id}>
                  <TableCell><ProductThumbnail product={product} /></TableCell>
                  <TableCell className="font-medium text-foreground">{product.product_name}</TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEditProduct(product)}>Edit</Button></TableCell>
                </TableRow>
              ))}
              {!products.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No products yet. Add a product and its recipe to make it orderable.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      {dialogOpen && <ProductDialog
        key={selectedProduct?.product_id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
        ingredients={ingredients}
        onSaved={loadDashboard}
      />}
    </section>
  )
}

function ProductDialog({ open, onOpenChange, product, ingredients, onSaved }) {
  const [name, setName] = useState(product?.product_name || '')
  const [price, setPrice] = useState(product?.price ?? '')
  const [imageUrl, setImageUrl] = useState(product?.image_url || '')
  const [active, setActive] = useState(product?.is_active ?? true)
  const [recipeRows, setRecipeRows] = useState([emptyRecipeRow()])
  const [loadingRecipe, setLoadingRecipe] = useState(Boolean(product))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!product) return

    let cancelled = false
    async function loadRecipe() {
      const { data: recipes, error: recipeError } = await supabase
        .from('recipes')
        .select('recipe_id')
        .eq('product_id', product.product_id)
        .order('recipe_id', { ascending: true })

      if (recipeError) {
        if (!cancelled) setError(recipeError.message)
        if (!cancelled) setLoadingRecipe(false)
        return
      }

      const recipeId = recipes?.[0]?.recipe_id
      if (!recipeId) {
        if (!cancelled) {
          setRecipeRows([emptyRecipeRow()])
          setLoadingRecipe(false)
        }
        return
      }

      const { data: rows, error: rowsError } = await supabase
        .from('recipe_items')
        .select('inventory_item_id, quantity_required')
        .eq('recipe_id', recipeId)

      if (!cancelled) {
        if (rowsError) setError(rowsError.message)
        else setRecipeRows(rows?.length ? rows.map((row) => ({ ...row, key: crypto.randomUUID() })) : [emptyRecipeRow()])
        setLoadingRecipe(false)
      }
    }
    loadRecipe()
    return () => { cancelled = true }
  }, [product])

  function closeDialog(nextOpen) {
    if (!nextOpen && !saving) onOpenChange(false)
  }

  function updateRecipeRow(key, field, value) {
    setRecipeRows((rows) => rows.map((row) => row.key === key ? { ...row, [field]: value } : row))
  }

  function removeRecipeRow(key) {
    setRecipeRows((rows) => rows.length > 1 ? rows.filter((row) => row.key !== key) : [emptyRecipeRow()])
  }

  async function handleSave(event) {
    event.preventDefault()
    const normalizedRows = recipeRows
      .filter((row) => row.inventory_item_id !== '' || row.quantity_required !== '')
      .map((row) => ({
        inventory_item_id: Number(row.inventory_item_id),
        quantity_required: Number(row.quantity_required),
      }))

    if (!name.trim()) {
      setError('Product name is required.')
      return
    }
    if (!Number.isFinite(Number(price)) || Number(price) < 0 || price === '') {
      setError('Enter a valid price.')
      return
    }
    if (!normalizedRows.length) {
      setError('Add at least one ingredient to the recipe.')
      return
    }
    if (normalizedRows.some((row) => !Number.isInteger(row.inventory_item_id) || row.inventory_item_id <= 0 || !Number.isFinite(row.quantity_required) || row.quantity_required <= 0)) {
      setError('Every recipe row needs an ingredient and a positive quantity.')
      return
    }
    if (new Set(normalizedRows.map((row) => row.inventory_item_id)).size !== normalizedRows.length) {
      setError('Use each ingredient only once in a recipe.')
      return
    }

    setSaving(true)
    setError(null)
    const productFields = {
      product_name: name.trim(),
      price: Number(price),
      image_url: imageUrl.trim() || null,
      is_active: active,
    }
    const productResult = product
      ? await supabase.from('products').update(productFields).eq('product_id', product.product_id).select().single()
      : await supabase.from('products').insert(productFields).select().single()

    if (productResult.error) {
      setSaving(false)
      setError(productResult.error.message)
      return
    }

    const savedProduct = productResult.data
    const { data: existingRecipes, error: existingRecipesError } = await supabase
      .from('recipes')
      .select('recipe_id')
      .eq('product_id', savedProduct.product_id)
      .order('recipe_id', { ascending: true })

    if (existingRecipesError) {
      setSaving(false)
      setError(existingRecipesError.message)
      return
    }

    let recipeId = existingRecipes?.[0]?.recipe_id
    if (!recipeId) {
      const { data: newRecipe, error: newRecipeError } = await supabase
        .from('recipes')
        .insert({
          product_id: savedProduct.product_id,
          // recipe_name is required by the existing database schema. Product
          // names are the source of truth for the staff-facing label.
          recipe_name: `${savedProduct.product_name} recipe`,
        })
        .select()
        .single()
      if (newRecipeError) {
        setSaving(false)
        setError(newRecipeError.message)
        return
      }
      recipeId = newRecipe.recipe_id
    } else {
      const { error: recipeNameError } = await supabase
        .from('recipes')
        .update({ recipe_name: `${savedProduct.product_name} recipe` })
        .eq('recipe_id', recipeId)
      if (recipeNameError) {
        setSaving(false)
        setError(recipeNameError.message)
        return
      }
    }

    const existingRecipeIds = existingRecipes?.map((recipe) => recipe.recipe_id) || [recipeId]
    const { error: deleteError } = await supabase
      .from('recipe_items')
      .delete()
      .in('recipe_id', existingRecipeIds)
    if (deleteError) {
      setSaving(false)
      setError(deleteError.message)
      return
    }

    if (normalizedRows.length) {
      const { error: insertRowsError } = await supabase
        .from('recipe_items')
        .insert(normalizedRows.map((row) => ({ ...row, recipe_id: recipeId })))
      if (insertRowsError) {
        setSaving(false)
        setError(insertRowsError.message)
        return
      }
    }

    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="grid gap-6">
          <fieldset className="grid gap-4">
            <legend className="text-sm font-medium text-foreground">Product details</legend>
            <div className="grid gap-1.5"><Label htmlFor="product-name">Name</Label><Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="product-price">Price</Label><Input id="product-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="product-image">Image URL</Label><Input id="product-image" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></div>
            <div className="flex items-center gap-2"><Switch id="product-active" checked={active} onCheckedChange={setActive} /><Label htmlFor="product-active" className="cursor-pointer text-sm font-normal">Active and available to order</Label></div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="sr-only">Recipe</legend>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium text-foreground">Recipe</p><p className="text-xs text-muted-foreground">Amounts are consumed for each product sold.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={() => setRecipeRows((rows) => [...rows, emptyRecipeRow()])}><Plus />Add ingredient row</Button>
            </div>
            {loadingRecipe ? <p className="text-sm text-muted-foreground">Loading recipe…</p> : recipeRows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`recipe-item-${row.key}`}>Ingredient {index + 1}</Label>
                  <Select value={String(row.inventory_item_id)} onValueChange={(value) => updateRecipeRow(row.key, 'inventory_item_id', value)}>
                    <SelectTrigger id={`recipe-item-${row.key}`} className="w-full"><SelectValue placeholder="Choose ingredient" /></SelectTrigger>
                    <SelectContent>
                      {ingredients.map((ingredient) => <SelectItem key={ingredient.inventory_item_id} value={String(ingredient.inventory_item_id)}>{ingredient.item_name} ({ingredient.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label htmlFor={`recipe-quantity-${row.key}`}>Per product</Label><Input id={`recipe-quantity-${row.key}`} type="number" min="0" step="any" value={row.quantity_required} onChange={(event) => updateRecipeRow(row.key, 'quantity_required', event.target.value)} /></div>
                <Button type="button" variant="ghost" size="icon-sm" className="mb-px text-destructive" onClick={() => removeRecipeRow(row.key)} aria-label={`Remove ingredient ${index + 1}`}><Trash2 /></Button>
              </div>
            ))}
            {!ingredients.length && <p className="text-sm text-muted-foreground">Add inventory ingredients before defining a recipe.</p>}
          </fieldset>

          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={saving || loadingRecipe}>{saving ? 'Saving…' : 'Save product and recipe'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProductThumbnail({ product }) {
  if (!product.image_url) return <div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon className="size-4" /></div>
  return <img className="size-10 rounded object-cover" src={product.image_url} alt="" />
}
