import { useCallback, useEffect, useState } from 'react'
import { Boxes, ClipboardList, History, LayoutDashboard, LogOut, Package, ShoppingCart } from 'lucide-react'
import ActivityLog from './components/ActivityLog'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import IngredientList from './components/IngredientList'
import Login from './components/Login'
import OrderEntry from './components/OrderEntry'
import ProductDashboard from './components/ProductDashboard'
import { Button } from './components/ui/button'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'order', label: 'Order', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'activity', label: 'Activity', icon: History },
]

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, '')
  return navigation.some((entry) => entry.id === route) ? route : 'dashboard'
}

function useHashRoute() {
  const [route, setRoute] = useState(routeFromHash)
  useEffect(() => {
    if (!window.location.hash) window.location.hash = '/dashboard'
    const update = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  function navigate(nextRoute) { window.location.hash = `/${nextRoute}` }
  return [route, navigate]
}

function App() {
  const [session, setSession] = useState(undefined)
  const [attentionCount, setAttentionCount] = useState(0)
  const [view, navigate] = useHashRoute()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => setSession(nextSession))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])

  const refreshAttentionCount = useCallback(async () => {
    if (!session) return
    const { data } = await supabase.from('inventory_status').select('stock_status').in('stock_status', ['low_stock', 'out_of_stock'])
    setAttentionCount(data?.length || 0)
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    let cancelled = false
    async function loadInitialAttentionCount() {
      const { data } = await supabase.from('inventory_status').select('stock_status').in('stock_status', ['low_stock', 'out_of_stock'])
      if (!cancelled) setAttentionCount(data?.length || 0)
    }
    loadInitialAttentionCount()
    return () => { cancelled = true }
  }, [session])

  if (session === undefined) return <p className="p-6 text-muted-foreground">Loading…</p>
  if (!session) return <Login />
  const staffName = session.user.email?.split('@')[0] || 'Staff'
  const currentView = view === 'dashboard' ? <Dashboard onInventoryChanged={refreshAttentionCount} /> : view === 'order' ? <OrderEntry onInventoryChanged={refreshAttentionCount} /> : view === 'inventory' ? <IngredientList onInventoryChanged={refreshAttentionCount} /> : view === 'products' ? <ProductDashboard /> : <ActivityLog />

  return <div className="min-h-dvh bg-background text-foreground md:grid md:grid-cols-[15rem_minmax(0,1fr)]"><aside className="hidden border-r border-sidebar-border bg-sidebar p-4 md:sticky md:top-0 md:flex md:h-dvh md:self-start md:flex-col md:overflow-y-auto"><Brand /><nav className="mt-6 grid gap-2" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <NavigationButton key={id} active={view === id} label={label} icon={Icon} badge={id === 'dashboard' ? attentionCount : 0} onClick={() => navigate(id)} />)}</nav><div className="mt-auto shrink-0 border-t pt-4"><p className="mb-2 truncate px-2 text-sm text-muted-foreground">{staffName}</p><Button variant="ghost" className="w-full justify-start" onClick={() => supabase.auth.signOut()}><LogOut />Sign out</Button></div></aside><main className="min-w-0 p-4 pb-24 sm:p-6 md:pb-6 lg:p-8"><div className="mb-6 flex items-center justify-between md:hidden"><Brand compact /><Button variant="ghost" size="icon-lg" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut /></Button></div>{currentView}</main><nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 p-2 backdrop-blur md:hidden" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <NavigationButton key={id} compact active={view === id} label={label} icon={Icon} badge={id === 'dashboard' ? attentionCount : 0} onClick={() => navigate(id)} />)}</nav></div>
}

function Brand({ compact = false }) { return <div className="flex items-center gap-2 px-2 text-left"><div className="rounded-md bg-primary p-2 text-primary-foreground"><ClipboardList className="size-5" /></div>{!compact && <div><p className="text-sm font-semibold text-foreground">MIU In-Venti-ry</p><p className="text-xs text-muted-foreground">Cafe operations</p></div>}</div> }
function NavigationButton({ active, label, icon: Icon, badge, onClick, compact }) { return <Button variant={active ? 'secondary' : 'ghost'} className={compact ? 'relative h-12 flex-col gap-0 px-1 text-[11px]' : 'relative min-h-11 justify-start'} onClick={onClick}><Icon />{label}{badge > 0 && <span className={compact ? 'absolute right-2 top-1 rounded-full bg-destructive px-1.5 text-[10px] text-white' : 'ml-auto rounded-full bg-destructive px-1.5 text-xs text-white'}>{badge}</span>}</Button> }

export default App
