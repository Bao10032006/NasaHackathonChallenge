import type { ReactNode } from 'react'

/** Scroll container for wide tables so they never widen the page; keyboard-scrollable. */
export function DataTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="data-table">{children}</table>
    </div>
  )
}
