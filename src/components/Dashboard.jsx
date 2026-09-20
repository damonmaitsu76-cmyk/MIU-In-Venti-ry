import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UpdateQuantityDialog } from '@/components/IngredientList'
import StatusBadge from '@/components/StatusBadge'
import { formatManilaDateTime, formatRelative } from '@/lib/format'
import { optionsToItems } from '@/lib/inventoryConfig'
import { getMaintenanceState } from '@/lib/maintenance'
import { formatStock } from '@/lib/units'

const PAGE_SIZE = 25
const DATE_OPTIONS = [{ value: 'today', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'custom', label: 'Custom range' }]
const ENTITY_OPTIONS = [{ value: 'all', label: 'All activity' }, { value: 'inventory_item', label: 'Inventory' }, { value: 'product', label: 'Product' }]

function manilaDateString(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(value)
}
function dayBoundary(date, end = false) { return `${date}T${end ? '23:59:59.999' : '00:00:00'}+08:00` }
function auditItem(row) { return { unit: row.unit, pack_size: row.pack_size } }
function csvEscape(value) { return `"${String(value ?? '').replaceAll('"', '""')}"` }
async function fetchDashboardAlerts() {
  return Promise.all([
    supabase.from('inventory_status').select('*').order('item_name', { ascending: true }),
    supabase.from('product_availability').select('*').eq('is_active', true).order('product_name', { ascending: true }),
    supabase.from('profiles').select('id, display_name').order('display_name', { ascending: true }),
  ])
}
function initialAuditQuery() {
  const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - 6)
  return supabase.from('audit_log').select('*').gte('created_at', dayBoundary(manilaDateString(start))).lte('created_at', dayBoundary(manilaDateString(today), true)).order('audit_id', { ascending: false }).limit(PAGE_SIZE)
}

export default function Dashboard({ onInventoryChanged }) {
  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState(null)
  const [auditRows, setAuditRows] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [staff, setStaff] = useState([])
  const [dateRange, setDateRange] = useState('7')
  const [entityType, setEntityType] = useState('all')
  const [action, setAction] = useState('all')
  const [actorId, setActorId] = useState('all')
  const [search, setSearch] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const liveRef = useRef(null)

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    const [inventoryResult, productsResult, staffResult] = await fetchDashboardAlerts()
    const error = inventoryResult.error || productsResult.error || staffResult.error
    if (error) setAlertsError(error.message)
    else { setInventory(inventoryResult.data || []); setProducts(productsResult.data || []); setStaff(staffResult.data || []); setAlertsError(null) }
    setAlertsLoading(false)
  }, [])

  const dateFilters = useCallback((query) => {
    let start = null; let end = null
    const today = new Date()
    if (dateRange === 'today') { start = manilaDateString(today); end = start }
    if (dateRange === '7') { const date = new Date(today); date.setDate(today.getDate() - 6); start = manilaDateString(date); end = manilaDateString(today) }
    if (dateRange === '30') { const date = new Date(today); date.setDate(today.getDate() - 29); start = manilaDateString(date); end = manilaDateString(today) }
    if (dateRange === 'custom') { start = customStart || null; end = customEnd || null }
    if (start) query = query.gte('created_at', dayBoundary(start))
    if (end) query = query.lte('created_at', dayBoundary(end, true))
    return query
  }, [customEnd, customStart, dateRange])

  const loadAudit = useCallback(async ({ append = false, cursor = null } = {}) => {
    setAuditLoading(true)
    let query = supabase.from('audit_log').select('*').order('audit_id', { ascending: false }).limit(PAGE_SIZE)
    query = dateFilters(query)
    if (entityType !== 'all') query = query.eq('entity_type', entityType)
    if (action !== 'all') query = query.eq('action', action)
    if (actorId !== 'all') query = query.eq('actor_id', actorId)
    if (search.trim()) query = query.ilike('entity_name', `%${search.trim()}%`)
    if (cursor) query = query.lt('audit_id', cursor)
    const { data, error } = await query
    setAuditLoading(false)
    if (error) { setAuditError(error.message); return }
    setAuditError(null)
    setAuditRows((current) => append ? [...current, ...(data || [])] : (data || []))
    setHasMore((data || []).length === PAGE_SIZE)
  }, [action, actorId, dateFilters, entityType, search])

  useEffect(() => { liveRef.current = { loadAlerts, loadAudit, onInventoryChanged } }, [loadAlerts, loadAudit, onInventoryChanged])
  useEffect(() => {
    let cancelled = false
    async function loadInitialDashboard() {
      const [[inventoryResult, productsResult, staffResult], auditResult] = await Promise.all([fetchDashboardAlerts(), initialAuditQuery()])
      if (cancelled) return
      const alertError = inventoryResult.error || productsResult.error || staffResult.error
      if (alertError) setAlertsError(alertError.message)
      else { setInventory(inventoryResult.data || []); setProducts(productsResult.data || []); setStaff(staffResult.data || []); setAlertsError(null) }
      setAlertsLoading(false)
      if (auditResult.error) setAuditError(auditResult.error.message)
      else { setAuditRows(auditResult.data || []); setHasMore((auditResult.data || []).length === PAGE_SIZE); setAuditError(null) }
      setAuditLoading(false)
    }
    loadInitialDashboard()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => liveRef.current?.loadAudit())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => { liveRef.current?.loadAlerts(); liveRef.current?.onInventoryChanged?.() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const outOfStock = inventory.filter((item) => item.stock_status === 'out_of_stock')
  const lowStock = inventory.filter((item) => item.stock_status === 'low_stock')
  const maintenance = inventory.map((item) => ({ item, state: getMaintenanceState(item) })).filter(({ state }) => ['overdue', 'due_soon', 'interval_unset', 'never_recorded'].includes(state.status)).sort((a, b) => (a.state.daysUntilDue ?? Infinity) - (b.state.daysUntilDue ?? Infinity))
  const unavailableProducts = products.filter((product) => product.max_servings === null || Number(product.max_servings) === 0)
  const actionOptions = [{ value: 'all', label: 'All actions' }, ...[...new Set(auditRows.map((row) => row.action))].map((value) => ({ value, label: value.replaceAll('_', ' ') }))]
  const staffOptions = [{ value: 'all', label: 'All staff' }, ...staff.map((person) => ({ value: person.id, label: person.display_name }))]
  const groupedRows = useMemo(() => auditRows.reduce((groups, row) => {
    const key = row.batch_id || `single-${row.audit_id}`
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
    return groups
  }, {}), [auditRows])
  function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function refreshAll() { loadAlerts(); loadAudit(); onInventoryChanged?.() }
  function exportCsv() {
    const header = ['Time (Manila)', 'Staff', 'Action', 'Entity', 'Item/Product', 'Before', 'After', 'Delta', 'Source', 'Note']
    const lines = auditRows.map((row) => [formatManilaDateTime(row.created_at), row.actor_name, row.action, row.entity_type, row.entity_name, row.quantity_before == null ? '' : formatStock(auditItem(row), row.quantity_before), row.quantity_after == null ? '' : formatStock(auditItem(row), row.quantity_after), row.quantity_delta == null ? '' : formatStock(auditItem(row), row.quantity_delta), row.source, row.note].map(csvEscape).join(','))
    const blob = new Blob([[header.map(csvEscape).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'miu-inventory-audit.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="mx-auto max-w-7xl scroll-mt-4 text-left"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Stock alerts, maintenance work, unavailable drinks, and staff activity.</p></div><Button variant="outline" onClick={refreshAll}><RefreshCw />Refresh</Button></div><div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryTile label="Out of stock" value={outOfStock.length} variant="destructive" onClick={() => scrollTo('out-of-stock')} /><SummaryTile label="Low stock" value={lowStock.length} variant="warning" onClick={() => scrollTo('low-stock')} /><SummaryTile label="Maintenance due" value={maintenance.length} onClick={() => scrollTo('maintenance-due')} /><SummaryTile label="Unavailable drinks" value={unavailableProducts.length} onClick={() => scrollTo('unavailable-drinks')} /></div>{alertsError && <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{alertsError}</p><Button className="mt-2" variant="outline" size="sm" onClick={loadAlerts}>Retry alerts</Button></div>}{alertsLoading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-48 animate-pulse rounded-xl bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-muted" /></div> : <div className="grid gap-4 xl:grid-cols-2"><AlertPanel id="out-of-stock" title="Out of stock" empty="Everything is currently in stock." items={outOfStock} onUpdated={loadAlerts} renderItem={(item) => <StockAlertRow item={item} onUpdated={loadAlerts} />} /><AlertPanel id="low-stock" title="Low stock · reorder" empty="No low-stock items need reordering." items={lowStock} onUpdated={loadAlerts} renderItem={(item) => <StockAlertRow item={item} onUpdated={loadAlerts} />} /><AlertPanel id="maintenance-due" title="Maintenance due" empty="No maintenance work is due." items={maintenance} renderItem={({ item, state }) => <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium text-foreground">{item.item_name}</p><p className="text-sm text-muted-foreground">{state.label}</p></div><UpdateQuantityDialog item={item} onUpdated={loadAlerts} /></div>} /><AlertPanel id="unavailable-drinks" title="Unavailable drinks" empty="Every active drink has an available recipe." items={unavailableProducts} renderItem={(product) => <div className="rounded-lg border p-3"><p className="font-medium text-foreground">{product.product_name}</p><p className="text-sm text-muted-foreground">{product.max_servings === null ? 'No recipe yet' : `Out of ${product.limiting_item_name || 'stock'}`}</p></div>} /></div>}<section className="mt-8" id="activity-log"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold text-foreground">Activity log</h2><p className="text-sm text-muted-foreground">Stock, inventory, product, and recipe changes.</p></div><Button variant="outline" onClick={exportCsv} disabled={!auditRows.length}><Download />Export CSV</Button></div><div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"><div className="grid gap-1.5"><Label>Date range</Label><Select value={dateRange} onValueChange={setDateRange} items={optionsToItems(DATE_OPTIONS)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{DATE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>{dateRange === 'custom' && <><div className="grid gap-1.5"><Label htmlFor="audit-start">From</Label><Input id="audit-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="audit-end">To</Label><Input id="audit-end" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div></>}<div className="grid gap-1.5"><Label>Entity</Label><Select value={entityType} onValueChange={setEntityType} items={optionsToItems(ENTITY_OPTIONS)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{ENTITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Action</Label><Select value={action} onValueChange={setAction} items={optionsToItems(actionOptions)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{actionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Staff</Label><Select value={actorId} onValueChange={setActorId} items={optionsToItems(staffOptions)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{staffOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5 lg:col-span-2"><Label htmlFor="audit-search">Search item or product</Label><Input id="audit-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="e.g. Matcha" /></div><div className="flex items-end"><Button className="w-full" onClick={() => loadAudit()}>Apply filters</Button></div></div>{auditError && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{auditError}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => loadAudit()}>Retry log</Button></div>}<div className="rounded-xl border bg-card">{auditLoading && !auditRows.length ? <div className="grid gap-2 p-4"><div className="h-10 animate-pulse rounded bg-muted" /><div className="h-10 animate-pulse rounded bg-muted" /></div> : Object.values(groupedRows).map((group) => <AuditGroup key={group[0].batch_id || group[0].audit_id} rows={group} />)}{!auditLoading && !auditRows.length && <p className="p-10 text-center text-sm text-muted-foreground">No activity matches these filters.</p>}</div>{hasMore && <div className="mt-4 text-center"><Button variant="outline" onClick={() => loadAudit({ append: true, cursor: auditRows[auditRows.length - 1]?.audit_id })} disabled={auditLoading}>{auditLoading ? 'Loading…' : 'Load more'}</Button></div>}</section></section>
}

function SummaryTile({ label, value, variant, onClick }) { return <button type="button" className={`rounded-xl border p-4 text-left transition hover:bg-muted ${variant === 'destructive' ? 'border-destructive/30' : variant === 'warning' ? 'border-amber-200' : ''}`} onClick={onClick}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{value}</p></button> }
function AlertPanel({ id, title, empty, items, renderItem }) { return <section id={id} className="scroll-mt-4 rounded-xl border bg-card p-4"><h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>{items.length ? <div className="grid gap-2">{items.map((item) => <div key={item.item?.inventory_item_id || item.inventory_item_id || item.product_id}>{renderItem(item)}</div>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}</section> }
function StockAlertRow({ item, onUpdated }) { return <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium text-foreground">{item.item_name}</p><p className="text-sm text-muted-foreground">{formatStock(item)} / threshold {formatStock(item, item.minimum_quantity)}</p></div><div className="grid justify-items-end gap-1"><StatusBadge status={item.stock_status} /><UpdateQuantityDialog item={item} onUpdated={onUpdated} /></div></div> }
function AuditGroup({ rows }) { const first = rows[0]; const grouped = rows.length > 1; return <details className="border-b last:border-0" open={!grouped}><summary className="cursor-pointer list-none p-4 hover:bg-muted/40"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium capitalize text-foreground">{grouped ? `${first.action.replaceAll('_', ' ')} · ${rows.length} changes` : first.action.replaceAll('_', ' ')}</p><p className="text-sm text-muted-foreground" title={formatManilaDateTime(first.created_at)}>{formatRelative(first.created_at)} · {first.actor_name || 'System'}</p></div><span className="text-sm text-muted-foreground">{grouped ? 'Show details' : first.entity_name}</span></div></summary><div className="grid gap-2 border-t bg-muted/20 p-3">{rows.map((row) => <AuditRow key={row.audit_id} row={row} />)}</div></details> }
function AuditRow({ row }) { const item = auditItem(row); const quantity = row.quantity_before == null && row.quantity_after == null ? null : `${row.quantity_before == null ? '—' : formatStock(item, row.quantity_before)} → ${row.quantity_after == null ? '—' : formatStock(item, row.quantity_after)}${row.quantity_delta == null ? '' : ` (${Number(row.quantity_delta) > 0 ? '+' : ''}${formatStock(item, row.quantity_delta)})`}`; return <div className="rounded-lg border bg-card p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium text-foreground">{row.entity_name || 'Deleted record'}</p><p className="capitalize text-muted-foreground">{row.entity_type.replaceAll('_', ' ')} · {row.source}</p></div><p className="text-muted-foreground" title={formatManilaDateTime(row.created_at)}>{formatRelative(row.created_at)}</p></div>{quantity && <p className="mt-2 tabular-nums text-foreground">{quantity}</p>}{row.note && <p className="mt-2 text-muted-foreground">Note: {row.note}</p>}{row.changes && <details className="mt-2"><summary className="cursor-pointer text-muted-foreground">View changes</summary><pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{JSON.stringify(row.changes, null, 2)}</pre></details>}</div> }
