import { AgentActivityPanel } from './components/AgentActivityPanel.jsx'
import { ConverterCard } from './components/ConverterCard.jsx'
import { ConverterProvider } from './state/ConverterProvider.jsx'
import { useWebMcpTools } from './webmcp/useWebMcpTools.js'
import './App.css'

/**
 * Inside the provider, so the tools bind to the same state the UI renders.
 */
function Converter() {
  const { tools, support } = useWebMcpTools()

  return (
    <>
      <ConverterCard />
      <AgentActivityPanel tools={tools} support={support} />
    </>
  )
}

function App() {
  return (
    <ConverterProvider>
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Currency Converter</h1>
          <p className="app__subtitle">
            Live and historical exchange rates. No account, no key.
          </p>
        </header>
        <main className="app__main">
          <Converter />
        </main>
      </div>
    </ConverterProvider>
  )
}

export default App
