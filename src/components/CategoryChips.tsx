import { classNames } from '../lib/format'
import type { Category } from '../types'

/**
 * The horizontal category chip rail that sits under the header on Home.
 * Sticky, horizontally scrollable, scrollbar hidden — as on YouTube.
 */
export function CategoryChips({
  categories,
  active,
  onChange,
}: {
  categories: Category[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="no-scrollbar sticky top-[var(--app-header-h)] z-30 flex gap-3 overflow-x-auto bg-bg px-4 py-3 md:px-6">
      {categories.map((c) => {
        const isActive = c.id === active
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={classNames(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors',
              isActive
                ? 'bg-chip-on text-chip-on-fg'
                : 'bg-chip text-fg hover:bg-chip-hover',
            )}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
