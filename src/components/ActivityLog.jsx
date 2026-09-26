import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, ClipboardCheck, Download, History, ListChecks, PackageMinus, PackagePlus, Pencil, Plus, RefreshCw, ShoppingCart, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/supabaseClient'
import { ACTION_LABELS, ACTION_TONES, DATE_RANGE_OPTIONS, SHOW_OPTIONS, actionOptionsForShow, activityEntityLabel, describeActivity, describeBatch, describeChange, groupRowsByDay } from '@/lib/activity'
import { dayBoundary, formatManilaDateTime, formatManilaTime, formatRelative, manilaDateString } from '@/lib/format'
import { optionsToItems } from '@/lib/inventoryConfig'
import { formatStock } from '@/lib/units'
import { withTimeout } from '@/lib/withTimeout'

const PAGE_SIZE = 25
const CSV_PAGE_SIZE = 1000
const CSV_MAX_ROWS = 5000
const DEFAULT_FILTERS = { dateRange: '7', show: 'all', action: 'all', actorId: 'all', search: '', customStart: '', customEnd: '' }

const ACTION_ICONS = {
  restock: PackagePlus, usage: PackageMinus, correction: ClipboardCheck, order_deduction: ShoppingCart,
  unit_converted: RefreshCw, maintenance: Wrench, edited: Pencil, created: Plus, deleted: Trash2,
  archived: Archive, restored: ArchiveRestore, recipe_changed: ListChecks,
}

const TONE_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-800',
  destructive: 'bg-destructive/10 text-destructive', neutral: 'bg-muted text-muted-foreground',
}

function applyAuditFilters(query, filters) {
  let start = null
  let end = null
  const today = new Date()
  if (filters.dateRange === 'today') { start = manilaDateString(today); end = start }
  if (filters.dateRange === '7') { const date = new Date(today); date.setDate(today.getDate() - 6); start = manilaDateString(date); end = manilaDateString(today) }
  if (filters.dateRange === '30') { const date = new Date(today); date.setDate(today.getDate() - 29); start = manilaDateString(date); end = manilaDateString(today) }
  if (filters.dateRange === 'custom') { start = filters.customStart || null; end = filters.customEnd || null }
  if (start) query = query.gte('created_at', dayBoundary(start))
  if (end) query = query.lte('created_at', dayBoundary(end, true))
  if (filters.show === 'inventory') query = query.eq('entity_type', 'inventory_item')
  if (filters.show === 'product') query = query.eq('entity_type', 'product')
  if (filters.action !== 'all') query = query.eq('action', filters.action)
  if (filters.actorId !== 'all') query = query.eq('actor_id', filters.actorId)
  if (filters.search.trim()) query = query.ilike('entity_name', `%${filters.search.trim()}%`)
  return query
}

async function fetchAuditPage(filters, { cursor = null, limit = PAGE_SIZE, includeTotal = false } = {}) {
  let query = supabase.from('audit_log').select('*', includeTotal ? { count: 'exact' } : undefined).order('audit_id', { ascending: false }).limit(limit)
  query = applyAuditFilters(query, filters)
  if (cursor) query = query.lt('audit_id', cursor)
  return query
}

function auditItem(row) {
  return { unit: row.unit, pack_size: row.pack_size }
}

function deltaLabel(row) {
  const delta = Number(row.quantity_delta)
  if (!Number.isFinite(delta) || delta === 0) return null
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${formatStock(auditItem(row), Math.abs(delta))}`
}

function groupedEntries(rows) {
  const entries = new Map()
  for (const row of rows) {
    const key = row.batch_id || `single-${row.audit_id}`
    if (!entries.has(key)) entries.set(key, { key, created_at: row.created_at, rows: [] })
    entries.get(key).rows.push(row)
  }
  return [...entries.values()]
}

export default function ActivityLog() {
  const [dateRange, setDateRange] = useState(DEFAULT_FILTERS.dateRange)
  const [show, setShow] = useState(DEFAULT_FILTERS.show)
  const [action, setAction] = useState(DEFAULT_FILTERS.action)
  const [actorId, setActorId] = useState(DEFAULT_FILTERS.actorId)
  const [search, setSearch] = useState(DEFAULT_FILTERS.search)
  const [debouncedSearch, setDebouncedSearch] = useState(DEFAULT_FILTERS.search)
  const [customStart, setCustomStart] = useState(DEFAULT_FILTERS.customStart)
  const [customEnd, setCustomEnd] = useState(DEFAULT_FILTERS.customEnd)
  const [staff, setStaff] = useState([])
  const [auditResult, setAuditResult] = useState({ key: '', rows: [], total: null, error: null, hasMore: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [liveStatus, setLiveStatus] = useState('SUBSCRIBED')
  const liveRef = useRef(null)
  const refreshTimerRef = useRef(null)

  const filters = useMemo(() => ({ dateRange, show, action, actorId, search: debouncedSearch, customStart, customEnd }), [action, actorId, customEnd, customStart, dateRange, debouncedSearch, show])
  const filterKey = useMemo(() => JSON.stringify(filters), [filters])
  const actionOptions = useMemo(() => actionOptionsForShow(show), [show])
  const staffOptions = useMemo(() => [{ value: 'all', label: 'All staff' }, ...staff.map((person) => ({ value: person.id, label: person.display_name || 'Unnamed staff' }))], [staff])
  const loading = auditResult.key !== filterKey
  const filterChanged = dateRange !== DEFAULT_FILTERS.dateRange || show !== DEFAULT_FILTERS.show || action !== DEFAULT_FILTERS.action || actorId !== DEFAULT_FILTERS.actorId || search !== DEFAULT_FILTERS.search || customStart !== DEFAULT_FILTERS.customStart || customEnd !== DEFAULT_FILTERS.customEnd

  useEffect(() => {
    let cancelled = false
    async function loadStaff() {
      const { data } = await supabase.from('profiles').select('id, display_name').order('display_name', { ascending: true })
      if (!cancelled) setStaff(data || [])
    }
    loadStaff()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timeout)
  }, [search])
  useEffect(() => {
    let cancelled = false
    async function loadFirstPage() {
      const { data, error, count } = await withTimeout(fetchAuditPage(filters, { includeTotal: true }))
      if (cancelled) return
      setAuditResult({ key: filterKey, rows: data || [], total: count ?? 0, error: error?.message || null, hasMore: !error && (data || []).length === PAGE_SIZE })
    }
    loadFirstPage()
    return () => { cancelled = true }
  }, [filterKey, filters, refreshVersion])
  useEffect(() => {
    liveRef.current = () => {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => setRefreshVersion((version) => version + 1), 500)
    }
  }, [])
  useEffect(() => {
    const channel = supabase.channel('activity-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => liveRef.current?.())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLiveStatus(status)
      })
    return () => { window.clearTimeout(refreshTimerRef.current); supabase.removeChannel(channel) }
  }, [])

  const entriesByDay = useMemo(() => groupRowsByDay(groupedEntries(auditResult.rows)), [auditResult.rows])

  function handleShowChange(nextShow) {
    const nextOptions = actionOptionsForShow(nextShow)
    setShow(nextShow)
    if (!nextOptions.some((option) => option.value === action)) setAction('all')
  }
  function clearFilters() {
    setDateRange(DEFAULT_FILTERS.dateRange); setShow(DEFAULT_FILTERS.show); setAction(DEFAULT_FILTERS.action); setActorId(DEFAULT_FILTERS.actorId); setSearch(DEFAULT_FILTERS.search); setDebouncedSearch(DEFAULT_FILTERS.search); setCustomStart(DEFAULT_FILTERS.customStart); setCustomEnd(DEFAULT_FILTERS.customEnd)
  }
  async function loadMore() {
    const cursor = auditResult.rows[auditResult.rows.length - 1]?.audit_id
    if (!cursor) return
    setLoadingMore(true)
    const { data, error } = await fetchAuditPage(filters, { cursor })
    setLoadingMore(false)
    if (error) { setAuditResult((current) => ({ ...current, error: error.message })); return }
    setAuditResult((current) => ({ ...current, rows: [...current.rows, ...(data || [])], hasMore: (data || []).length === PAGE_SIZE, error: null }))
  }
  async function exportCsv() {
    setExporting(true); setExportNote(null)
    const rows = []
    let cursor = null
    let capped = false
    try {
      while (rows.length < CSV_MAX_ROWS) {
        const { data, error } = await fetchAuditPage(filters, { cursor, limit: CSV_PAGE_SIZE })
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < CSV_PAGE_SIZE) break
        cursor = data[data.length - 1]?.audit_id
        if (!cursor || rows.length >= CSV_MAX_ROWS) capped = true
      }
      const selectedRows = rows.slice(0, CSV_MAX_ROWS)
      const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
      const header = ['Time (Manila)', 'Staff', 'Action', 'Entity', 'Item/Product', 'Before', 'After', 'Delta', 'Source', 'Note']
      const lines = selectedRows.map((row) => [formatManilaDateTime(row.created_at), row.actor_name || 'System', ACTION_LABELS[row.action] || row.action, activityEntityLabel(row.entity_type), row.entity_name, row.quantity_before == null ? '' : formatStock(auditItem(row), row.quantity_before), row.quantity_after == null ? '' : formatStock(auditItem(row), row.quantity_after), deltaLabel(row) || '', row.source, row.note].map(csvEscape).join(','))
      const blob = new Blob([[header.map(csvEscape).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `miu-activity-${manilaDateString()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      if (capped) setExportNote(`Export capped at ${CSV_MAX_ROWS.toLocaleString()} matching changes.`)
    } catch (error) {
      setExportNote(error.message || 'Could not prepare the activity export.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl text-left">
      <div className="mb-6"><h1 className="text-2xl font-semibold tracking-tight text-foreground">Activity</h1><p className="mt-1 text-sm text-muted-foreground">Every stock change and product edit — who made it, what changed, and when. Newest first.</p>{liveStatus !== 'SUBSCRIBED' && <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground" role="status">Live updates paused — showing last loaded data.</p><Button variant="outline" size="sm" onClick={() => setRefreshVersion((version) => version + 1)}><RefreshCw />Refresh</Button></div>}</div>
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Date range" value={dateRange} onValueChange={setDateRange} options={DATE_RANGE_OPTIONS} />
        <FilterSelect label="Show" value={show} onValueChange={handleShowChange} options={SHOW_OPTIONS} />
        <FilterSelect label="Type of change" value={action} onValueChange={setAction} options={actionOptions} />
        <FilterSelect label="Staff" value={actorId} onValueChange={setActorId} options={staffOptions} />
        {dateRange === 'custom' && <><div className="grid gap-1.5"><Label htmlFor="activity-start">From</Label><Input id="activity-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="activity-end">To</Label><Input id="activity-end" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div></>}
        <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="activity-search">Search by item or product name</Label><Input id="activity-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item or product name" /></div>
        <div className="flex items-end"><Button variant="ghost" className="w-full sm:w-auto" onClick={clearFilters} disabled={!filterChanged}>Clear filters</Button></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Showing {auditResult.rows.length} of {auditResult.total ?? auditResult.rows.length} changes</p><Button variant="outline" onClick={exportCsv} disabled={exporting}>{exporting ? 'Preparing…' : <><Download />Export CSV</>}</Button></div>
      {exportNote && <p className="mb-4 text-sm text-muted-foreground">{exportNote}</p>}
      {loading && !auditResult.rows.length ? <ActivitySkeleton /> : auditResult.error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{auditResult.error}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => setRefreshVersion((version) => version + 1)}>Retry</Button></div> : !auditResult.rows.length ? <div className="rounded-xl border border-dashed p-10 text-center"><p className="text-sm text-muted-foreground">No activity matches these filters.</p><p className="mt-1 text-sm text-muted-foreground">Try a wider date range.</p><Button className="mt-3" variant="outline" onClick={clearFilters}>Clear filters</Button></div> : <div className="grid gap-6">{entriesByDay.map(({ heading, entries }) => <section key={heading}><h2 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{heading}</h2><div className="overflow-hidden rounded-xl border bg-card">{entries.map((entry) => <ActivityEntry key={entry.key} entry={entry} />)}</div></section>)}</div>}
      {auditResult.hasMore && <div className="mt-6 text-center"><Button variant="outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load 25 more'}</Button></div>}
    </section>
  )
}

function FilterSelect({ label, value, onValueChange, options }) {
  return <div className="grid gap-1.5"><Label>{label}</Label><Select value={value} onValueChange={onValueChange} items={optionsToItems(options)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
}

function ActivitySkeleton() {
  return <div className="grid gap-2 rounded-xl border bg-card p-4"><div className="h-16 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded bg-muted" /></div>
}

function ActivityEntry({ entry }) {
  const batched = Boolean(entry.rows[0].batch_id) && entry.rows.length > 1
  if (!batched) return <ActivityLine row={entry.rows[0]} />
  const batch = describeBatch(entry.rows)
  return <details className="group/batch border-b last:border-b-0"><summary className="cursor-pointer list-none hover:bg-muted/40"><ActivityLine row={entry.rows[0]} headline={batch.headline} batch /><span className="sr-only">Show details</span></summary><div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none group-open/batch:grid-rows-[1fr] group-open/batch:opacity-100"><div className="min-h-0 overflow-hidden"><div className="border-t bg-muted/20 px-4 py-2"><p className="mb-2 text-xs text-muted-foreground">Individual changes</p>{entry.rows.map((row) => <ActivityLine key={row.audit_id} row={row} nested />)}</div></div></div></details>
}

function ActivityLine({ row, headline, batch = false, nested = false }) {
  const Icon = ACTION_ICONS[row.action] || History
  const tone = ACTION_TONES[row.action] || 'neutral'
  const description = describeActivity(row)
  const hasQuantity = row.quantity_before != null || row.quantity_after != null
  const changes = row.changes && typeof row.changes === 'object' ? row.action === 'recipe_changed' ? [describeChange('recipe_changed', row.changes)] : Object.entries(row.changes).map(([key, value]) => describeChange(key, value)) : []
  return <div className={`flex gap-3 p-4 ${nested ? 'border-t first:border-t-0' : 'border-b last:border-b-0'} sm:items-start`}><span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="font-medium text-foreground">{headline || description.headline}</p>{!batch && <>{hasQuantity ? <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className="tabular-nums">{row.quantity_before == null ? '—' : formatStock(auditItem(row), row.quantity_before)} → {row.quantity_after == null ? '—' : formatStock(auditItem(row), row.quantity_after)}</span>{deltaLabel(row) && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${Number(row.quantity_delta) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>{deltaLabel(row)}</span>}</p> : changes[0]?.text ? <p className="mt-1 text-sm text-muted-foreground">{changes[0].text}</p> : <p className="mt-1 text-sm text-muted-foreground">{ACTION_LABELS[row.action] || 'Updated'}</p>}{row.note?.trim() && <p className="mt-1 text-sm text-muted-foreground">Note: {row.note.trim()}</p>}{changes.length > 0 && <details className="group/changes mt-2"><summary className="cursor-pointer text-sm text-muted-foreground">View changes</summary><div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none group-open/changes:grid-rows-[1fr] group-open/changes:opacity-100"><div className="min-h-0 overflow-hidden"><dl className="mt-2 grid gap-1 rounded-md bg-muted/60 p-3 text-sm">{changes.map((change, index) => <div key={`${change.label}-${index}`} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-medium text-foreground">{change.label}</dt><dd className="min-w-0 text-muted-foreground">{change.text || `${change.before} → ${change.after}`}</dd></div>)}</dl></div></div></details>}</>}</div><div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right"><p title={formatManilaDateTime(row.created_at)}>{formatManilaTime(row.created_at)}</p><p className="mt-1">{formatRelative(row.created_at)}</p>{batch && <p className="mt-1 font-medium">Show details</p>}</div></div>
}
