import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { UpdateQuantityDialog } from '@/components/IngredientList'
import StatusBadge from '@/components/StatusBadge'
import { supabase } from '@/supabaseClient'
import { getMaintenanceState } from '@/lib/maintenance'
import { fetchPackageBlockedProducts } from '@/lib/recipes'
import { formatStock } from '@/lib/units'

const ALERT_VISIBLE_ROWS = 5
const ALERT_LIST_MAX_HEIGHT = 'calc(5 * 5.25rem + 4 * 0.5rem)'

async function fetchDashboardAlerts() {
  const [inventoryResult, productsResult] = await Promise.all([
    supabase.from('inventory_status').select('*').order('item_name', { ascending: true }),
    supabase.from('product_availability').select('*').eq('is_active', true).order('product_name', { ascending: true }),
  ])
  if (inventoryResult.error) return [inventoryResult, productsResult, { data: new Map(), error: null }]
  try {
    return [inventoryResult, productsResult, { data: await fetchPackageBlockedProducts(inventoryResult.data || []), error: null }]
  } catch (error) {
    return [inventoryResult, productsResult, { data: new Map(), error }]
  }
}

function withPackageBlockedProducts(products, blockedProducts) {
  return (products || []).map((product) => ({
    ...product,
    packageBlockedItemName: blockedProducts.get(String(product.product_id)) || null,
  }))
}

export default function Dashboard({ onInventoryChanged }) {
  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState(null)
  const liveRef = useRef(null)

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    const [inventoryResult, productsResult, blockedProductsResult] = await fetchDashboardAlerts()
    const error = inventoryResult.error || productsResult.error || blockedProductsResult.error
    if (error) setAlertsError(error.message)
    else {
      setInventory(inventoryResult.data || [])
      setProducts(withPackageBlockedProducts(productsResult.data, blockedProductsResult.data))
      setAlertsError(null)
    }
    setAlertsLoading(false)
  }, [])

  useEffect(() => { liveRef.current = { loadAlerts, onInventoryChanged } }, [loadAlerts, onInventoryChanged])
  useEffect(() => {
    let cancelled = false
    async function loadInitialDashboard() {
      const [inventoryResult, productsResult, blockedProductsResult] = await fetchDashboardAlerts()
      if (cancelled) return
      const error = inventoryResult.error || productsResult.error || blockedProductsResult.error
      if (error) setAlertsError(error.message)
      else {
        setInventory(inventoryResult.data || [])
        setProducts(withPackageBlockedProducts(productsResult.data, blockedProductsResult.data))
        setAlertsError(null)
      }
      setAlertsLoading(false)
    }
    loadInitialDashboard()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        liveRef.current?.loadAlerts()
        liveRef.current?.onInventoryChanged?.()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const outOfStock = inventory.filter((item) => item.stock_status === 'out_of_stock')
  const lowStock = inventory.filter((item) => item.stock_status === 'low_stock')
  const maintenance = inventory
    .map((item) => ({ item, state: getMaintenanceState(item) }))
    .filter(({ state }) => ['overdue', 'due_soon', 'interval_unset', 'never_recorded'].includes(state.status))
    .sort((a, b) => (a.state.daysUntilDue ?? Infinity) - (b.state.daysUntilDue ?? Infinity))
  const unavailableProducts = products.filter((product) => product.packageBlockedItemName || product.max_servings === null || Number(product.max_servings) === 0)

  function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function refreshAll() { loadAlerts(); onInventoryChanged?.() }

  return (
    <section className="mx-auto max-w-7xl scroll-mt-4 text-left">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Stock alerts, maintenance work, and unavailable drinks.</p></div>
        <div className="flex flex-wrap gap-2"><a href="#/activity" className={buttonVariants({ variant: 'outline' })}>Activity log</a><Button variant="outline" onClick={refreshAll}><RefreshCw />Refresh</Button></div>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryTile label="Out of stock" value={outOfStock.length} variant="destructive" onClick={() => scrollTo('out-of-stock')} /><SummaryTile label="Low stock" value={lowStock.length} variant="warning" onClick={() => scrollTo('low-stock')} /><SummaryTile label="Maintenance due" value={maintenance.length} onClick={() => scrollTo('maintenance-due')} /><SummaryTile label="Unavailable drinks" value={unavailableProducts.length} onClick={() => scrollTo('unavailable-drinks')} /></div>
      {alertsError && <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{alertsError}</p><Button className="mt-2" variant="outline" size="sm" onClick={loadAlerts}>Retry alerts</Button></div>}
      {alertsLoading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-48 animate-pulse rounded-xl bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-muted" /></div> : <div className="grid gap-4 xl:grid-cols-2"><AlertPanel id="out-of-stock" title="Out of stock" empty="Everything is currently in stock." items={outOfStock} ariaLabel="Out of stock items" renderItem={(item) => <StockAlertRow item={item} onUpdated={loadAlerts} />} /><AlertPanel id="low-stock" title="Low stock · reorder" empty="No low-stock items need reordering." items={lowStock} ariaLabel="Low-stock items" renderItem={(item) => <StockAlertRow item={item} onUpdated={loadAlerts} />} /><AlertPanel id="maintenance-due" title="Maintenance due" empty="No maintenance work is due." items={maintenance} ariaLabel="Maintenance due items" renderItem={({ item, state }) => <MaintenanceAlertRow item={item} state={state} onUpdated={loadAlerts} />} /><AlertPanel id="unavailable-drinks" title="Unavailable drinks" empty="Every active drink has an available recipe." items={unavailableProducts} ariaLabel="Unavailable drinks" renderItem={(product) => <UnavailableProductRow product={product} />} /></div>}
    </section>
  )
}

function SummaryTile({ label, value, variant, onClick }) {
  return <button type="button" className={`rounded-xl border p-4 text-left transition hover:bg-muted ${variant === 'destructive' ? 'border-destructive/30' : variant === 'warning' ? 'border-amber-200' : ''}`} onClick={onClick}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{value}</p></button>
}

function AlertPanel({ id, title, empty, items, ariaLabel, renderItem }) {
  const scrollable = items.length > ALERT_VISIBLE_ROWS
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">{title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span></div>
      {items.length ? <><div className="scroll-thin grid content-start gap-2 overflow-y-auto overscroll-contain pr-1" style={{ maxHeight: ALERT_LIST_MAX_HEIGHT }} {...(scrollable ? { tabIndex: 0, role: 'region', 'aria-label': ariaLabel } : {})}>{items.map((item) => <div key={item.item?.inventory_item_id || item.inventory_item_id || item.product_id} className="h-[5.25rem]">{renderItem(item)}</div>)}</div>{scrollable && <p className="mt-2 text-xs text-muted-foreground">{ALERT_VISIBLE_ROWS} of {items.length} shown — scroll for more</p>}</> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  )
}

function StockAlertRow({ item, onUpdated }) {
  return <div className="flex h-full items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium text-foreground">{item.item_name}</p><p className="truncate text-sm text-muted-foreground">{formatStock(item)} / threshold {formatStock(item, item.minimum_quantity)}</p></div><div className="grid shrink-0 justify-items-end gap-1"><StatusBadge status={item.stock_status} /><UpdateQuantityDialog item={item} onUpdated={onUpdated} /></div></div>
}

function MaintenanceAlertRow({ item, state, onUpdated }) {
  return <div className="flex h-full items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium text-foreground">{item.item_name}</p><p className="truncate text-sm text-muted-foreground">{state.label}</p></div><UpdateQuantityDialog item={item} onUpdated={onUpdated} /></div>
}

function UnavailableProductRow({ product }) {
  const detail = product.packageBlockedItemName ? `Recipe uses ${product.packageBlockedItemName}, which is tracked by whole package — fix it in Products` : product.max_servings === null ? 'No recipe yet' : `Unavailable — out of ${product.limiting_item_name || 'stock'}`
  return <div className="flex h-full flex-col justify-center rounded-lg border p-3"><p className="truncate font-medium text-foreground">{product.product_name}</p><p className={`truncate text-sm ${product.packageBlockedItemName ? 'text-destructive' : 'text-muted-foreground'}`}>{detail}</p></div>
}
