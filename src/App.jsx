import heroImg from './assets/hero.png'
import IngredientList from './components/IngredientList'
import './App.css'

function App() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
        <div>
          <h1>MIU In-Venti-ry</h1>
          <p>Ingredient tracking test for Miu Matcha Cafe</p>
        </div>
      </section>

      <IngredientList />
    </>
  )
}

export default App