import { useEffect, useRef, useState } from 'react'
import { List } from 'react-window'
import { useAgentPulse } from '../hooks/useAgentPulse.js'
import { useConverter } from '../state/converterContext.js'
import './CurrencyCombobox.css'

const ROW_HEIGHT = 44 // also the minimum tap target (§2)
const LIST_HEIGHT = 264

function filterCurrencies(currencies, query) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return currencies
  return currencies.filter(
    (entry) =>
      entry.code.toLowerCase().includes(trimmed) || entry.name.toLowerCase().includes(trimmed),
  )
}

/** A currency's own symbol where it has one, else a two-letter monogram (§5.2). */
function badgeFor(entry) {
  return entry.symbol && entry.symbol.length <= 3 ? entry.symbol : entry.code.slice(0, 2)
}

function Row({ index, style, items, activeIndex, selected, onPick, listId }) {
  const entry = items[index]
  const isActive = index === activeIndex
  return (
    <div
      style={style}
      id={`${listId}-option-${index}`}
      role="option"
      aria-selected={entry.code === selected}
      className={`combo__option${isActive ? ' combo__option--active' : ''}`}
      onMouseDown={(event) => {
        event.preventDefault() // keep focus in the search field
        onPick(entry.code)
      }}
    >
      <span className="combo__badge" aria-hidden="true">
        {badgeFor(entry)}
      </span>
      <span className="combo__code">{entry.code}</span>
      <span className="combo__name">{entry.name}</span>
    </div>
  )
}

/**
 * Searchable, virtualised currency picker. Filters on code or name, and is
 * fully operable from the keyboard: arrows move, type-ahead filters,
 * Enter commits, Escape dismisses (§5.2, §7).
 */
export function CurrencyCombobox({ id, label, value, onChange, pulseToken }) {
  const { currencies } = useConverter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const pulsing = useAgentPulse(pulseToken)

  const items = filterCurrencies(currencies, query)
  const selected = currencies.find((entry) => entry.code === value)
  const listId = `${id}-listbox`

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Keep the highlighted row in view as the arrows move through it.
  useEffect(() => {
    if (!open || items.length === 0) return
    listRef.current?.scrollToRow({ index: Math.min(activeIndex, items.length - 1), align: 'auto' })
  }, [activeIndex, open, items.length])

  function openWith(nextQuery = '') {
    setQuery(nextQuery)
    const index = items.findIndex((entry) => entry.code === value)
    setActiveIndex(index > -1 ? index : 0)
    setOpen(true)
  }

  function commit(code) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(event) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openWith()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(Math.max(items.length - 1, 0))
        break
      case 'Enter':
        event.preventDefault()
        if (items[activeIndex]) commit(items[activeIndex].code)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        setQuery('')
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  return (
    <div className="combo" ref={wrapperRef}>
      <label className="label" htmlFor={id} id={`${id}-label`}>
        {label}
      </label>

      {open ? (
        <div className={`combo__control combo__control--open${pulsing ? ' is-agent-touched' : ''}`}>
          <input
            ref={inputRef}
            id={id}
            className="combo__search"
            type="text"
            role="combobox"
            autoComplete="off"
            placeholder="Search code or name"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-labelledby={`${id}-label`}
            aria-activedescendant={
              items[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      ) : (
        <button
          type="button"
          id={id}
          className={`combo__control combo__trigger${pulsing ? ' is-agent-touched' : ''}`}
          role="combobox"
          aria-expanded="false"
          aria-controls={listId}
          aria-labelledby={`${id}-label ${id}`}
          onClick={() => openWith()}
          onKeyDown={onKeyDown}
        >
          <span className="combo__badge" aria-hidden="true">
            {selected ? badgeFor(selected) : '—'}
          </span>
          <span className="combo__value">
            <span className="combo__code">{value}</span>
            {selected ? <span className="combo__name">{selected.name}</span> : null}
          </span>
          <svg className="combo__caret" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open ? (
        <div className="combo__popover">
          {items.length === 0 ? (
            <p className="combo__empty">Couldn&rsquo;t find that currency.</p>
          ) : (
            <List
              listRef={listRef}
              className="combo__list"
              role="listbox"
              id={listId}
              aria-label={label}
              style={{ height: Math.min(LIST_HEIGHT, items.length * ROW_HEIGHT) }}
              rowComponent={Row}
              rowCount={items.length}
              rowHeight={ROW_HEIGHT}
              rowProps={{ items, activeIndex, selected: value, onPick: commit, listId }}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
