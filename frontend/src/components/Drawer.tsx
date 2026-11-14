import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { Icon } from './Icon'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Side drawer.
 * - Wide screens: non-modal complementary panel; the page stays usable, no focus trap.
 * - Narrow screens (< 768px): it covers the page, so it becomes a modal dialog with a backdrop and a
 *   focus trap.
 * Escape closes it; focus moves to the heading on open and returns to the opener on close.
 * Motion: opens in 220 ms, closes in 150 ms (transform + opacity only).
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  wide = false,
  returnFocusTo,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Element to focus after closing when the opener is gone (e.g. a map cell). */
  returnFocusTo?: () => HTMLElement | null
}) {
  const modal = useMediaQuery(NARROW_QUERY)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      return
    }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // The panel is in the DOM once this effect runs (motion animates styles, not mounting).
    headingRef.current?.focus({ preventScroll: true })
    return () => {
      const opener = openerRef.current
      const target = opener && document.contains(opener) && opener !== document.body ? opener : returnFocusTo?.() ?? null
      target?.focus()
    }
    // returnFocusTo is read at close time only.
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (modal && event.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (items.length === 0) {
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, modal])

  return (
    <AnimatePresence>
      {open && (
        <>
          {modal && (
            <motion.div
              key="backdrop"
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.22 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              onClick={onClose}
              aria-hidden="true"
            />
          )}
          <motion.div
            key="panel"
            ref={panelRef}
            className={`drawer${wide ? ' drawer-wide' : ''}`}
            role={modal ? 'dialog' : 'complementary'}
            aria-modal={modal ? true : undefined}
            aria-labelledby={titleId}
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ x: 24, opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
          >
            <div className="drawer-head">
              <h2 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
              <button type="button" className="icon-button" onClick={onClose} aria-label={`Đóng: ${title}`}>
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
