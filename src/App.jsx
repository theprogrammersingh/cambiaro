import { Suspense, lazy } from 'react'
import { AgentActivityPanel } from './components/AgentActivityPanel.jsx'
import { ConverterCard } from './components/ConverterCard.jsx'
import { DateControl } from './components/DateControl.jsx'
import { ConverterProvider } from './state/ConverterProvider.jsx'
import { useWebMcpTools } from './webmcp/useWebMcpTools.js'
import './App.css'

/**
 * The charting library is by far the heaviest thing here, and the chart is
 * secondary content below the primary card — so it loads on its own rather
 * than delaying the conversion the page exists to do.
 */
const RateChart = lazy(() =>
  import('./components/RateChart.jsx').then((module) => ({ default: module.RateChart })),
)

/**
 * Inside the provider, so the tools bind to the same state the UI renders.
 */
function Converter() {
  const { tools, support } = useWebMcpTools()

  return (
    <>
      <ConverterCard />
      <DateControl />
      <Suspense fallback={<div className="chart-placeholder" aria-hidden="true" />}>
        <RateChart />
      </Suspense>
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
