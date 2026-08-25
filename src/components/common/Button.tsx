/**
 * Button — the single button primitive of the app.
 *
 * Variants map to the design tokens; the `selected` prop renders the
 * "picked" state used by the wizard's option grids. Accessible: real
 * `<button>` with `aria-pressed` for toggle semantics.
 */
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import './Button.css'

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'accent' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Renders the button in its "selected" state (toggle grids). */
  selected?: boolean
  /** When true, the button spans the full grid width. */
  full?: boolean
  /** React 19: ref is forwarded as a regular prop to the DOM button. */
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export function Button({
  variant = 'default',
  selected = false,
  full = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'gm-button',
    `gm-button--${variant}`,
    selected ? 'gm-button--selected' : '',
    full ? 'gm-button--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={selected || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
