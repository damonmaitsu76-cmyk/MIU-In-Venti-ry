import { useCallback, useEffect, useState } from 'react'
import { Boxes, History, LayoutDashboard, LogOut, Package, ShoppingCart } from 'lucide-react'
import LogoBadge from './components/LogoBadge'
import Wordmark from '@/components/Wordmark'
import ActivityLog from './components/ActivityLog'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import IngredientList from './components/IngredientList'
import Login from './components/Login'
import OrderEntry from './components/OrderEntry'
import ProductDashboard from './components/ProductDashboard'
import PageBackdrop from './components/PageBackdrop'
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

  if (session === undefined) return <div data-page="login" className="relative isolate min-h-dvh"><PageBackdrop animated rich /><p className="relative z-10 p-6 text-muted-foreground">Loading…</p></div>
  if (!session) return <Login />
  const staffName = session.user.email?.split('@')[0] || 'Staff'
  const currentView = view === 'dashboard' ? <Dashboard onInventoryChanged={refreshAttentionCount} /> : view === 'order' ? <OrderEntry onInventoryChanged={refreshAttentionCount} /> : view === 'inventory' ? <IngredientList onInventoryChanged={refreshAttentionCount} /> : view === 'products' ? <ProductDashboard /> : <ActivityLog />

  return <div data-page={view} className="relative isolate min-h-dvh text-foreground md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
    <PageBackdrop scale={0.6} />
    <aside className="relative z-10 hidden overflow-hidden border-r border-sand-400/60 bg-gradient-to-b from-cream-100 to-matcha-100 p-4 md:sticky md:top-0 md:flex md:h-dvh md:self-start md:flex-col">
      <svg aria-hidden="true" viewBox="0 0 240 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-matcha-200/70"><path d="M0,40 C40,10 80,70 120,40 C160,10 200,70 240,40 L240,120 L0,120 Z" fill="currentColor" /></svg>
      <div className="relative z-10"><Brand /></div>
      <nav className="relative z-10 mt-6 grid gap-2" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <NavigationButton key={id} active={view === id} label={label} icon={Icon} badge={id === 'dashboard' ? attentionCount : 0} onClick={() => navigate(id)} />)}</nav>
      <div className="relative z-10 mt-auto shrink-0 border-t pt-4"><p className="mb-2 truncate px-2 text-sm text-muted-foreground">{staffName}</p><Button variant="ghost" className="w-full justify-start" onClick={() => supabase.auth.signOut()}><LogOut />Sign out</Button></div>
    </aside>
    <main className="relative z-10 min-w-0 p-4 pt-6 pb-24 sm:p-6 sm:pt-8 md:pb-16 lg:p-8 lg:pb-16"><div className="mb-6 flex items-center justify-between md:hidden"><Brand compact /><Button variant="ghost" size="icon-lg" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut /></Button></div><div key={view} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">{currentView}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-sand-400/70 bg-cream-100/90 p-2 backdrop-blur md:hidden" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <NavigationButton key={id} compact active={view === id} label={label} icon={Icon} badge={id === 'dashboard' ? attentionCount : 0} onClick={() => navigate(id)} />)}</nav>
  </div>
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3 px-2 text-left">
      <LogoBadge size={compact ? 36 : 40} />
      {!compact && (
        <div>
          <Wordmark size="sm" tone="dark" />
          <p className="text-xs text-muted-foreground">Cafe operations</p>
        </div>
      )}
    </div>
  )
}
function NavigationButton({ active, label, icon: Icon, badge, onClick, compact }) { return <Button variant={active ? 'default' : 'ghost'} aria-current={active ? 'page' : undefined} className={`${compact ? 'relative h-12 flex-col gap-0 rounded-xl px-1 text-[11px]' : 'relative min-h-11 justify-start rounded-full'} ${active ? 'shadow-[0_8px_18px_-10px_rgb(var(--shadow-tint)/0.8)]' : 'hover:bg-matcha-100'}`} onClick={onClick}><Icon />{label}{badge > 0 && <span className={compact ? 'absolute right-2 top-1 rounded-full bg-destructive px-1.5 text-[10px] text-white ring-2 ring-cream-100' : 'ml-auto rounded-full bg-destructive px-1.5 text-xs text-white ring-2 ring-cream-100'}>{badge}</span>}</Button> }

export default App
