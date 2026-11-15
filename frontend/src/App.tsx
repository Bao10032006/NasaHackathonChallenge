import { useEffect, useRef, useState } from 'react'
import { Embers } from './Embers'
import ExploreScreen from './explore/ExploreScreen'
import { CompareScreen } from './compare/CompareScreen'
import type { CompareSelection } from './compare/CompareScreen'

export default function App() {
  const [comparison, setComparison] = useState<CompareSelection>()
  const entry = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!comparison) entry.current?.focus()
  }, [comparison])

  return (
    <>
      <Embers />
      <div hidden={Boolean(comparison)}>
        <ExploreScreen onCompare={(selection) => {
          entry.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          setComparison(selection)
        }} />
      </div>
      {comparison && <CompareScreen selection={comparison} onBack={() => setComparison(undefined)} />}
    </>
  )
}
