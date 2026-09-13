import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function IngredientList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_status')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) setErrorMsg(error.message)
    else { setItems(data); setErrorMsg(null) }
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  if (loading) return <p className="p-6 text-muted-foreground">Loading...</p>
  if (errorMsg) return <p className="p-6 text-destructive">Error: {errorMsg}</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ingredients</h2>
        <AddIngredientDialog onAdded={loadItems} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.inventory_item_id}>
              <TableCell>{item.item_name}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell>{item.current_quantity} {item.unit}</TableCell>
              <TableCell><StatusBadge status={item.stock_status} /></TableCell>
              <TableCell className="text-right">
                <UpdateQuantityDialog item={item} onUpdated={loadItems} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'out_of_stock') return <Badge variant="destructive">Out of stock</Badge>
  if (status === 'low_stock') return <Badge variant="secondary">Low stock</Badge>
  return <Badge>OK</Badge>
}

function AddIngredientDialog({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minimum, setMinimum] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name || !unit) return
    setSaving(true)
    const { error } = await supabase.from('inventory_items').insert({
      item_name: name,
      category: category || 'Other',
      unit,
      current_quantity: Number(quantity) || 0,
      minimum_quantity: Number(minimum) || 0,
    })
    setSaving(false)
    if (!error) {
      setOpen(false)
      setName(''); setCategory(''); setUnit(''); setQuantity(''); setMinimum('')
      onAdded()
    } else {
      alert(error.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Add Ingredient</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Ingredient</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Matcha, Equipment..." /></div>
          <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, mL, pc" /></div>
          <div><Label>Starting quantity</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div><Label>Low-stock threshold</Label><Input type="number" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateQuantityDialog({ item, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('add')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    const delta = mode === 'add' ? amt : -amt
    const newQuantity = item.current_quantity + delta

    if (newQuantity < 0) {
      alert(`That would take ${item.item_name} below zero.`)
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('inventory_item_id', item.inventory_item_id)
    setSaving(false)

    if (!error) { setOpen(false); setAmount(''); onUpdated() }
    else alert(error.message)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Update</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item.item_name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Current: {item.current_quantity} {item.unit}</p>
        <div className="flex gap-2 my-3">
          <Button variant={mode === 'add' ? 'default' : 'outline'} onClick={() => setMode('add')}>Received stock</Button>
          <Button variant={mode === 'use' ? 'default' : 'outline'} onClick={() => setMode('use')}>Used stock</Button>
        </div>
        <div><Label>Amount ({item.unit})</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}