import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import heroImg from './assets/hero.png'
import IngredientList from './components/ingredientList'
import Login from './components/Login'
import { Button } from './components/ui/button'
import './App.css'

function App() {
  // undefined = still checking for an existing session, null = signed out
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
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
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
        <div>
          <h1>MIU In-Venti-ry</h1>
          <p>Ingredient tracking test for Miu In-Venti-Ry!!!</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </section>

      <IngredientList />
    </>
  )
}

export default App