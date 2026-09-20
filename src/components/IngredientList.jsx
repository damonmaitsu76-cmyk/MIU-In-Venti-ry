import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const isEquipment = (item) => String(item.category || '').trim().toLowerCase() === 'equipment'

export default function IngredientList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_full_status')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) setErrorMsg(error.message)
    else {
      setItems(data || [])
      setErrorMsg(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialItems() {
      const { data, error } = await supabase
        .from('inventory_full_status')
        .select('*')
        .order('item_name', { ascending: true })

      if (cancelled) return
      if (error) setErrorMsg(error.message)
      else {
        setItems(data || [])
        setErrorMsg(null)
      }
      setLoading(false)
    }

    loadInitialItems()
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    [items],
  )
  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch = !searchTerm || item.item_name?.toLowerCase().includes(searchTerm)
      const matchesCategory = category === 'all' || item.category === category
      const matchesStatus = status === 'all' || item.stock_status === status
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [items, search, category, status])

  return (
    <section className="mx-auto max-w-7xl text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track ingredients, packaging, and equipment.</p>
        </div>
        <AddIngredientDialog onAdded={loadItems} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search inventory"
            aria-label="Search inventory"
          />
        </div>
        <Select
          value={category}
          onValueChange={setCategory}
        >
          <SelectTrigger className="w-full" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={setStatus}
        >
          <SelectTrigger className="w-full" aria-label="Filter by stock status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ok">In stock</SelectItem>
            <SelectItem value="low_stock">Low stock</SelectItem>
            <SelectItem value="out_of_stock">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorMsg && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorMsg}</p>}

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading inventory…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Minimum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.inventory_item_id}>
                  <TableCell className="font-medium text-foreground">{item.item_name}</TableCell>
                  <TableCell>{item.category || 'Uncategorised'}</TableCell>
                  <TableCell>{item.current_quantity} {item.unit}</TableCell>
                  <TableCell>{item.minimum_quantity} {item.unit}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StockStatusBadge status={item.stock_status} />
                      {isEquipment(item) && <MaintenanceStatusBadge status={item.maintenance_status} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <UpdateQuantityDialog item={item} onUpdated={loadItems} />
                  </TableCell>
                </TableRow>
              ))}
              {!filteredItems.length && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No inventory items match these filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}

function StockStatusBadge({ status }) {
  if (status === 'out_of_stock') return <Badge variant="destructive">Out of stock</Badge>
  if (status === 'low_stock') return <Badge variant="secondary">Low stock</Badge>
  return <Badge>In stock</Badge>
}

function MaintenanceStatusBadge({ status }) {
  if (status === 'overdue') return <Badge variant="destructive">Maintenance overdue</Badge>
  if (status === 'due_soon') return <Badge variant="secondary">Maintenance due soon</Badge>
  if (status === 'unknown') return <Badge variant="outline">Maintenance unknown</Badge>
  if (status === 'ok') return <Badge variant="outline">Maintenance OK</Badge>
  return null
}

function AddIngredientDialog({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minimum, setMinimum] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function resetForm() {
    setName(''); setCategory(''); setUnit(''); setQuantity(''); setMinimum(''); setError(null)
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!name.trim() || !unit.trim()) {
      setError('Item name and tracking unit are required.')
      return
    }
    if (Number(quantity || 0) < 0 || Number(minimum || 0) < 0) {
      setError('Quantities cannot be negative.')
      return
    }

    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('inventory_items').insert({
      item_name: name.trim(),
      category: category.trim() || 'Other',
      unit: unit.trim(),
      current_quantity: Number(quantity) || 0,
      minimum_quantity: Number(minimum) || 0,
    })
    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }
    setOpen(false)
    resetForm()
    onAdded()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetForm() }}>
      <DialogTrigger asChild><Button>Add new item</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add ingredient</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="ingredient-name">Item name</Label><Input id="ingredient-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ingredient-category">Category</Label><Input id="ingredient-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Matcha, Milk, Equipment…" /></div>
          <div className="grid gap-1.5"><Label htmlFor="ingredient-unit">Tracking unit</Label><Input id="ingredient-unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="g, mL, pc" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="ingredient-quantity">Current quantity</Label><Input id="ingredient-quantity" type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ingredient-minimum">Minimum stock</Label><Input id="ingredient-minimum" type="number" min="0" step="any" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UpdateQuantityDialog({ item, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('add')
  const [amount, setAmount] = useState('')
  const [interval, setInterval] = useState(item.maintenance_interval_days ?? '')
  const [saving, setSaving] = useState(false)
  const [markingReplaced, setMarkingReplaced] = useState(false)
  const [error, setError] = useState(null)
  const [replacedToday, setReplacedToday] = useState(false)
  const equipment = isEquipment(item)

  function resetForm() {
    setMode('add'); setAmount(''); setInterval(item.maintenance_interval_days ?? ''); setError(null); setReplacedToday(false)
  }

  async function handleSave(event) {
    event.preventDefault()
    const hasAmount = amount !== ''
    const numericAmount = Number(amount)
    if (hasAmount && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
      setError('Enter a positive adjustment amount.')
      return
    }
    if (equipment && interval !== '' && (!Number.isInteger(Number(interval)) || Number(interval) <= 0)) {
      setError('Maintenance interval must be a whole number of days.')
      return
    }

    const nextQuantity = Number(item.current_quantity) + (hasAmount ? (mode === 'add' ? numericAmount : -numericAmount) : 0)
    if (nextQuantity < 0) {
      setError(`That would take ${item.item_name} below zero.`)
      return
    }

    const changes = {}
    if (hasAmount) changes.current_quantity = nextQuantity
    if (equipment && interval !== '') changes.maintenance_interval_days = Number(interval)
    if (!Object.keys(changes).length) {
      setError('Enter an adjustment or change the maintenance interval.')
      return
    }

    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(changes)
      .eq('inventory_item_id', item.inventory_item_id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setOpen(false)
    resetForm()
    onUpdated()
  }

  async function markReplacedToday() {
    setMarkingReplaced(true)
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ last_maintained_at: today })
      .eq('inventory_item_id', item.inventory_item_id)
    setMarkingReplaced(false)
    if (updateError) setError(updateError.message)
    else {
      setReplacedToday(true)
      onUpdated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetForm() }}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Update</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Update {item.item_name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4">
          <p className="text-sm text-muted-foreground">Current quantity: {item.current_quantity} {item.unit}</p>
          <div className="flex gap-2">
            <Button type="button" variant={mode === 'add' ? 'default' : 'outline'} onClick={() => setMode('add')}>Received stock</Button>
            <Button type="button" variant={mode === 'use' ? 'default' : 'outline'} onClick={() => setMode('use')}>Used stock</Button>
          </div>
          <div className="grid gap-1.5"><Label htmlFor={`amount-${item.inventory_item_id}`}>Amount ({item.unit})</Label><Input id={`amount-${item.inventory_item_id}`} type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>

          {equipment && (
            <div className="grid gap-3 rounded-md border border-border p-3">
              <div className="grid gap-1.5"><Label htmlFor={`maintenance-${item.inventory_item_id}`}>Maintenance interval (days)</Label><Input id={`maintenance-${item.inventory_item_id}`} type="number" min="1" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} /></div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Last replaced: {item.last_maintained_at || 'not recorded'}</p>
                <Button type="button" variant="outline" size="sm" onClick={markReplacedToday} disabled={markingReplaced}>{markingReplaced ? 'Saving…' : 'Mark as replaced today'}</Button>
              </div>
              {replacedToday && <p className="text-xs text-muted-foreground">Replacement date saved.</p>}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm update'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
