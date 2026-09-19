import { useEffect, useState } from 'react'
import { Boxes, ClipboardList, LogOut, Package, ShoppingCart } from 'lucide-react'
import { supabase } from './supabaseClient'
import IngredientList from './components/ingredientList'
import Login from './components/Login'
import OrderEntry from './components/OrderEntry'
import ProductDashboard from './components/ProductDashboard'
import { Button } from './components/ui/button'
import './App.css'

const navigation = [
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Order entry', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
]

function App() {
  // undefined = still checking for an existing session, null = signed out
  const [session, setSession] = useState(undefined)
  const [view, setView] = useState('inventory')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    )

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <p className="p-6 text-muted-foreground">Loading...</p>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-border bg-sidebar p-4 md:min-h-screen md:border-r md:border-b-0">
        <div className="mb-6 flex items-center gap-2 px-2 text-left">
          <div className="rounded-md bg-primary p-2 text-primary-foreground"><ClipboardList className="size-5" /></div>
          <div>
            <p className="text-sm font-semibold text-foreground">MIU In-Venti-ry</p>
            <p className="text-xs text-muted-foreground">Cafe operations</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={view === id ? 'secondary' : 'ghost'}
              className="shrink-0 justify-start"
              onClick={() => setView(id)}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </nav>

        <Button
          variant="ghost"
          className="mt-4 w-full justify-start md:mt-10"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut />
          Sign out
        </Button>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        {view === 'inventory' && <IngredientList />}
        {view === 'orders' && <OrderEntry />}
        {view === 'products' && <ProductDashboard />}
      </main>
    </div>
  )
}

export default App
