import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import NumberField from '@/components/NumberField'
import StatusBadge from '@/components/StatusBadge'
import { CATEGORY_OPTIONS, categoryLabel, ITEM_TYPES, optionsToItems, STATUS_OPTIONS } from '@/lib/inventoryConfig'
import { getMaintenanceState } from '@/lib/maintenance'
import { parseAmount } from '@/lib/numbers'
import { describeTracking, formatStock, fromStored, isPackTracked, resolveStorage, toStored } from '@/lib/units'

const TYPE_OPTIONS = Object.entries(ITEM_TYPES).map(([value, label]) => ({ value, label }))

async function fetchInventoryItems() {
  return supabase.from('inventory_status').select('*').order('item_name', { ascending: true })
}

function initialForm(item) {
  const type = item?.item_type || 'ingredient'
  const tracking = describeTracking(item)
  const inputUnit = tracking.trackingUnit === 'pkg' ? 'pkg' : item?.unit || tracking.trackingUnit
  return {
    name: item?.item_name || '',
    itemType: type,
    category: item?.category || CATEGORY_OPTIONS[type][0].value,
    trackingUnit: tracking.trackingUnit,
    piecesPerPkg: tracking.piecesPerPkg,
    quantity: item ? String(fromStored(item, item.current_quantity, inputUnit)) : '',
    minimum: item ? String(fromStored(item, item.minimum_quantity, inputUnit)) : '',
    needsMaintenance: Boolean(item?.needs_maintenance),
    maintenanceInterval: item?.maintenance_interval_days ? String(item.maintenance_interval_days) : '',
    lastMaintained: item?.last_maintained_at ? String(item.last_maintained_at).slice(0, 10) : '',
  }
}

export default function IngredientList({ onInventoryChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [itemType, setItemType] = useState('all')
  const [status, setStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)

  async function loadItems() {
    setLoading(true)
    const { data, error } = await fetchInventoryItems()
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
      const { data, error } = await fetchInventoryItems()
      if (cancelled) return
      if (error) setErrorMsg(error.message)
      else { setItems(data || []); setErrorMsg(null) }
      setLoading(false)
    }
    loadInitialItems()
    return () => { cancelled = true }
  }, [])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => (
      (!term || item.item_name?.toLowerCase().includes(term))
      && (itemType === 'all' || item.item_type === itemType)
      && (status === 'all' || item.stock_status === status)
    ))
  }, [items, itemType, search, status])

  function refresh() {
    loadItems()
    onInventoryChanged?.()
  }

  return (
    <section className="mx-auto max-w-7xl text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Track ingredients, packaging, and equipment.</p></div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}><Plus />Add inventory item</DialogTrigger>
          {addOpen && <InventoryItemDialog items={items} onSaved={() => { setAddOpen(false); refresh() }} />}
        </Dialog>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2" aria-label="Inventory type filters">
          {[{ value: 'all', label: 'All' }, ...TYPE_OPTIONS].map((option) => <Button key={option.value} type="button" variant={itemType === option.value ? 'default' : 'outline'} onClick={() => setItemType(option.value)}>{option.label}</Button>)}
        </div>
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search inventory" aria-label="Search inventory" /></div>
        <Select value={status} onValueChange={setStatus} items={optionsToItems(STATUS_OPTIONS)}><SelectTrigger className="w-full sm:w-48" aria-label="Filter by stock status"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      </div>

      {errorMsg && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{errorMsg}</p><Button className="mt-2" variant="outline" size="sm" onClick={loadItems}>Retry</Button></div>}

      {loading ? <InventorySkeleton /> : <><div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block"><table className="w-full text-sm"><thead className="border-b"><tr><th className="h-10 px-4 text-left font-medium">Name</th><th className="px-4 text-left font-medium">Type / category</th><th className="px-4 text-left font-medium">Quantity</th><th className="px-4 text-left font-medium">Status</th><th className="px-4 text-left font-medium">Maintenance</th><th className="px-4 text-right font-medium">Actions</th></tr></thead><tbody>{filteredItems.map((item) => <InventoryRow key={item.inventory_item_id} item={item} onUpdated={refresh} onEdit={setEditItem} />)}{!filteredItems.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No inventory items match these filters.</td></tr>}</tbody></table></div><div className="grid gap-3 md:hidden">{filteredItems.map((item) => <InventoryCard key={item.inventory_item_id} item={item} onUpdated={refresh} onEdit={setEditItem} />)}{!filteredItems.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No inventory items match these filters.</p>}</div></>}

      <Dialog open={Boolean(editItem)} onOpenChange={(open) => { if (!open) setEditItem(null) }}>{editItem && <InventoryItemDialog key={editItem.inventory_item_id} item={editItem} items={items} onSaved={() => { setEditItem(null); refresh() }} />}</Dialog>
    </section>
  )
}

function InventorySkeleton() { return <div className="grid gap-2 rounded-xl border p-4"><div className="h-10 animate-pulse rounded bg-muted" /><div className="h-10 animate-pulse rounded bg-muted" /><div className="h-10 animate-pulse rounded bg-muted" /></div> }

function InventoryRow({ item, onUpdated, onEdit }) {
  const maintenance = getMaintenanceState(item)
  return <tr className="border-b last:border-0 hover:bg-muted/40"><td className="p-4 font-medium text-foreground">{item.item_name}</td><td className="p-4"><p>{ITEM_TYPES[item.item_type] || item.item_type}</p><p className="text-xs text-muted-foreground">{categoryLabel(item.category)}</p></td><td className="p-4"><p className="tabular-nums">{formatStock(item)}</p><p className="text-xs text-muted-foreground">Threshold: {formatStock(item, item.minimum_quantity)}</p></td><td className="p-4"><StatusBadge status={item.stock_status} /></td><td className="p-4 text-muted-foreground">{item.needs_maintenance ? maintenance.label : '—'}</td><td className="p-4 text-right"><div className="inline-flex gap-2"><UpdateQuantityDialog item={item} onUpdated={onUpdated} /><Button variant="outline" size="sm" onClick={() => onEdit(item)}><Pencil />Edit</Button></div></td></tr>
}

function InventoryCard({ item, onUpdated, onEdit }) {
  const maintenance = getMaintenanceState(item)
  return <article className="grid gap-3 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{item.item_name}</h2><p className="text-sm text-muted-foreground">{ITEM_TYPES[item.item_type] || item.item_type} · {categoryLabel(item.category)}</p></div><StatusBadge status={item.stock_status} /></div><div><p className="font-medium tabular-nums text-foreground">{formatStock(item)}</p><p className="text-xs text-muted-foreground">Threshold: {formatStock(item, item.minimum_quantity)}</p></div>{item.needs_maintenance && <p className="text-sm text-muted-foreground">{maintenance.label}</p>}<div className="flex gap-2"><UpdateQuantityDialog item={item} onUpdated={onUpdated} /><Button variant="outline" onClick={() => onEdit(item)}><Pencil />Edit</Button></div></article>
}

export function InventoryItemDialog({ item, items, onSaved }) {
  const [form, setForm] = useState(() => initialForm(item))
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState(null)
  const editMode = Boolean(item)
  const categories = CATEGORY_OPTIONS[form.itemType]
  const storagePreview = resolveStorage({ trackingUnit: form.trackingUnit, piecesPerPkg: form.piecesPerPkg })
  const previewItem = { unit: storagePreview.unit, pack_size: storagePreview.pack_size }
  const inputUnit = form.trackingUnit === 'pkg' ? 'pkg' : storagePreview.unit
  const storedQuantity = toStored(previewItem, form.quantity || 0, inputUnit)

  function change(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function changeType(nextType) { setForm((current) => ({ ...current, itemType: nextType, category: CATEGORY_OPTIONS[nextType][0].value, trackingUnit: nextType === 'material' ? 'pc' : 'g', piecesPerPkg: '', needsMaintenance: false, maintenanceInterval: '', lastMaintained: '' })) }
  async function save(event) {
    event.preventDefault()
    const name = form.name.trim(); const current = parseAmount(form.quantity); const minimum = parseAmount(form.minimum); const packSize = form.piecesPerPkg === '' ? null : parseAmount(form.piecesPerPkg)
    if (!name) return setError('Item name is required.')
    if (items.some((existing) => existing.inventory_item_id !== item?.inventory_item_id && existing.item_name.trim().toLowerCase() === name.toLowerCase())) return setError('An inventory item already uses this name.')
    if (current == null || current < 0 || minimum == null || minimum < 0) return setError('Enter a current quantity and low-stock threshold of zero or more.')
    if (form.itemType === 'material' && form.trackingUnit === 'pkg' && packSize != null && packSize <= 0) return setError('Pieces per package must be greater than zero.')
    if (form.needsMaintenance && (!Number.isInteger(Number(form.maintenanceInterval)) || Number(form.maintenanceInterval) <= 0)) return setError('Enter a whole maintenance interval in days.')
    const storage = resolveStorage({ trackingUnit: form.trackingUnit, piecesPerPkg: packSize }); const entered = form.trackingUnit === 'pkg' ? 'pkg' : storage.unit
    const payload = { item_name: name, category: form.category, item_type: form.itemType, unit: storage.unit, pack_size: storage.pack_size, current_quantity: toStored(storage, current, entered), minimum_quantity: toStored(storage, minimum, entered), needs_maintenance: form.itemType === 'material' && form.needsMaintenance, maintenance_interval_days: form.itemType === 'material' && form.needsMaintenance ? Number(form.maintenanceInterval) : null, last_maintained_at: form.itemType === 'material' && form.needsMaintenance && form.lastMaintained ? new Date(`${form.lastMaintained}T00:00:00+08:00`).toISOString() : null }
    if (editMode) { delete payload.item_type; delete payload.unit; delete payload.current_quantity; delete payload.minimum_quantity; if (!isPackTracked(item)) delete payload.pack_size }
    setSaving(true); setError(null)
    const result = editMode ? await supabase.from('inventory_items').update(payload).eq('inventory_item_id', item.inventory_item_id) : await supabase.from('inventory_items').insert(payload)
    setSaving(false)
    if (result.error) return setError(result.error.message)
    onSaved()
  }
  async function convertWholePack() {
    const packSize = parseAmount(form.piecesPerPkg)
    if (packSize == null || packSize <= 0) return setError('Enter pieces per package before converting.')
    setConverting(true); setError(null)
    const { error: convertError } = await supabase.rpc('convert_item_to_pack', { p_item_id: item.inventory_item_id, p_pack_size: packSize })
    setConverting(false)
    if (convertError) return setError(convertError.message)
    onSaved()
  }
  return <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editMode ? `Edit ${item.item_name}` : 'Add inventory item'}</DialogTitle></DialogHeader><form onSubmit={save} className="grid gap-5"><div className="grid gap-1.5"><Label htmlFor="inventory-name">Name</Label><Input id="inventory-name" value={form.name} onChange={(event) => change('name', event.target.value)} /></div><fieldset className="grid gap-2"><legend className="text-sm font-medium">Type</legend><div className="flex gap-2">{TYPE_OPTIONS.map((option) => <Button key={option.value} type="button" variant={form.itemType === option.value ? 'default' : 'outline'} className="min-h-11" disabled={editMode} onClick={() => changeType(option.value)}>{option.label}</Button>)}</div>{editMode && <p className="text-xs text-muted-foreground">Item type cannot be changed after creation.</p>}</fieldset><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="inventory-category">Category</Label><Select value={form.category} onValueChange={(value) => change('category', value)} items={optionsToItems(categories)}><SelectTrigger id="inventory-category" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>{form.itemType === 'ingredient' ? <div className="grid gap-1.5"><Label htmlFor="inventory-unit">Unit</Label><Select value={form.trackingUnit} onValueChange={(value) => change('trackingUnit', value)} disabled={editMode} items={{ g: 'g', mL: 'mL', pc: 'pc' }}><SelectTrigger id="inventory-unit" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{['g', 'mL', 'pc'].map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div> : <fieldset className="grid gap-2"><legend className="text-sm font-medium">Tracking unit</legend><div className="flex gap-2">{['pc', 'pkg'].map((unit) => <Button key={unit} type="button" variant={form.trackingUnit === unit ? 'default' : 'outline'} disabled={editMode} onClick={() => change('trackingUnit', unit)}>{unit}</Button>)}</div></fieldset>}</div>{form.itemType === 'material' && form.trackingUnit === 'pkg' && <div className="grid gap-1.5"><Label htmlFor="pack-size">Pieces per pkg (optional)</Label><NumberField id="pack-size" value={form.piecesPerPkg} onValueChange={(value) => change('piecesPerPkg', value)} min={1} suffix="pc" disabled={editMode && item.unit === 'pkg'} /><p className="text-xs text-muted-foreground">Fill this in to deduct individual pieces. Leave empty to count whole packages manually.</p>{editMode && item.unit === 'pkg' && <Button type="button" variant="outline" onClick={convertWholePack} disabled={converting || !form.piecesPerPkg}>{converting ? 'Converting…' : 'Set pieces per pkg'}</Button>}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="inventory-quantity">{editMode ? 'Current quantity' : 'Starting quantity'}</Label><NumberField id="inventory-quantity" value={form.quantity} onValueChange={(value) => change('quantity', value)} min={0} suffix={form.trackingUnit} disabled={editMode} /></div><div className="grid gap-1.5"><Label htmlFor="inventory-minimum">Low-stock threshold</Label><NumberField id="inventory-minimum" value={form.minimum} onValueChange={(value) => change('minimum', value)} min={0} suffix={form.trackingUnit} disabled={editMode} /></div></div>{editMode && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Unit and quantity are read-only here. Use Update stock to change quantity; use the package conversion action when appropriate.</p>}{form.itemType === 'material' && <fieldset className="grid gap-3 rounded-lg border p-4"><div className="flex items-center justify-between gap-4"><div><Label htmlFor="needs-maintenance" className="cursor-pointer">Needs maintenance / replacement</Label><p className="text-xs text-muted-foreground">Only show this for materials that need a regular task.</p></div><Switch id="needs-maintenance" checked={form.needsMaintenance} onCheckedChange={(checked) => change('needsMaintenance', checked)} /></div>{form.needsMaintenance && <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="maintenance-interval">Every</Label><NumberField id="maintenance-interval" value={form.maintenanceInterval} onValueChange={(value) => change('maintenanceInterval', value)} min={1} decimals={0} suffix="days" /></div><div className="grid gap-1.5"><Label htmlFor="last-maintained">Last done (optional)</Label><Input id="last-maintained" type="date" value={form.lastMaintained} onChange={(event) => change('lastMaintained', event.target.value)} /></div></div>}</fieldset>}<p className="text-sm text-muted-foreground">{isPackTracked(previewItem) ? `Stored as ${formatStock(previewItem, storedQuantity)}.` : storagePreview.unit === 'pkg' ? 'Whole packs only — not usable in recipes.' : `Stored as ${formatStock(previewItem, storedQuantity)}.`}</p>{error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}<DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editMode ? 'Save changes' : 'Save item'}</Button></DialogFooter></form></DialogContent>
}

export function UpdateQuantityDialog({ item, onUpdated }) {
  const [open, setOpen] = useState(false); const [mode, setMode] = useState('received'); const [amount, setAmount] = useState(''); const [enteredUnit, setEnteredUnit] = useState(isPackTracked(item) ? 'pkg' : item.unit); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const [markingDone, setMarkingDone] = useState(false); const [error, setError] = useState(null)
  const numericAmount = parseAmount(amount); const storedAmount = numericAmount == null ? null : toStored(item, numericAmount, enteredUnit); const nextQuantity = mode === 'recount' ? storedAmount : Number(item.current_quantity) + (mode === 'used' ? -(storedAmount || 0) : (storedAmount || 0))
  function reset() { setMode('received'); setAmount(''); setEnteredUnit(isPackTracked(item) ? 'pkg' : item.unit); setNote(''); setError(null) }
  async function save(event) { event.preventDefault(); if (storedAmount == null || storedAmount < 0 || (mode !== 'recount' && storedAmount === 0)) return setError('Enter a valid amount.'); if (nextQuantity < 0) return setError(`That would take ${item.item_name} below zero.`); if (note.length > 200) return setError('Notes must be 200 characters or fewer.'); setSaving(true); setError(null); const result = mode === 'recount' ? await supabase.rpc('set_inventory_count', { p_item_id: item.inventory_item_id, p_new_qty: storedAmount, p_note: note || null }) : await supabase.rpc('adjust_inventory', { p_item_id: item.inventory_item_id, p_delta: mode === 'used' ? -storedAmount : storedAmount, p_reason: mode === 'used' ? 'usage' : 'restock', p_note: note || null }); setSaving(false); if (result.error) return setError(result.error.message); setOpen(false); reset(); onUpdated() }
  async function markDone() { setMarkingDone(true); setError(null); const { error: maintenanceError } = await supabase.from('inventory_items').update({ last_maintained_at: new Date().toISOString() }).eq('inventory_item_id', item.inventory_item_id); setMarkingDone(false); if (maintenanceError) return setError(maintenanceError.message); onUpdated() }
  return <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset() }}><DialogTrigger render={<Button variant="outline" size="sm" />}>Update</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Update {item.item_name}</DialogTitle></DialogHeader><form onSubmit={save} className="grid gap-4"><p className="text-sm text-muted-foreground">Current quantity: {formatStock(item)}</p><div className="flex flex-wrap gap-2">{['received', 'used', 'recount'].map((option) => <Button key={option} type="button" variant={mode === option ? 'default' : 'outline'} onClick={() => setMode(option)}>{option === 'received' ? 'Received' : option === 'used' ? 'Used' : 'Recount'}</Button>)}</div><div className="grid gap-2"><Label htmlFor={`stock-amount-${item.inventory_item_id}`}>{mode === 'recount' ? 'Physical count' : 'Amount'}</Label><div className="flex gap-2"><NumberField id={`stock-amount-${item.inventory_item_id}`} value={amount} onValueChange={setAmount} min={0} suffix={enteredUnit} />{isPackTracked(item) && <div className="flex shrink-0 gap-1">{['pkg', 'pc'].map((unit) => <Button key={unit} type="button" variant={enteredUnit === unit ? 'default' : 'outline'} onClick={() => setEnteredUnit(unit)}>{unit}</Button>)}</div>}</div></div><div className="grid gap-1.5"><Label htmlFor={`stock-note-${item.inventory_item_id}`}>Note (optional)</Label><textarea id={`stock-note-${item.inventory_item_id}`} className="min-h-20 w-full rounded-md border bg-transparent p-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} /></div><p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Will become: <strong className="text-foreground">{formatStock(item, nextQuantity)}</strong></p>{item.needs_maintenance && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><p className="text-xs text-muted-foreground">Last done: {item.last_maintained_at ? new Date(item.last_maintained_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : 'not recorded'}</p><Button type="button" variant="outline" size="sm" onClick={markDone} disabled={markingDone}>{markingDone ? 'Saving…' : 'Mark as done today'}</Button></div>}{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm update'}</Button></DialogFooter></form></DialogContent></Dialog>
}
