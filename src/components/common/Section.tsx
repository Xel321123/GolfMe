/**
 * Section — the card container used across all views.
 */
import type { ReactNode } from 'react'
import './Section.css'

interface SectionProps {
  title?: string
  /** Accent color for the title (default muted). */
  accent?: 'default' | 'green' | 'blue' | 'orange'
  children: ReactNode
}

export function Section({ title, accent = 'default', children }: SectionProps) {
  return (
    <section className="gm-section">
      {title !== undefined && (
        <h3 className={`gm-section__title gm-section__title--${accent}`}>{title}</h3>
      )}
      {children}
    </section>
  )
}
