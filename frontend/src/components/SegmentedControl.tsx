import { useRef, type KeyboardEvent } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/**
 * Accessible single-choice segmented control (WAI-ARIA radio group pattern):
 * one tab stop, ←/→/↑/↓ move and select, Home/End jump to the ends.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'default',
}: {
  label: string
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  size?: 'default' | 'small'
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value))

  function move(index: number) {
    const next = (index + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(currentIndex + 1),
      ArrowDown: () => move(currentIndex + 1),
      ArrowLeft: () => move(currentIndex - 1),
      ArrowUp: () => move(currentIndex - 1),
      Home: () => move(0),
      End: () => move(options.length - 1),
    }
    const action = keys[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
  }

  return (
    <div className={`segmented${size === 'small' ? ' segmented-small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => { refs.current[index] = element }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={checked ? 'active' : ''}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
