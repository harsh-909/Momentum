/**
 * Shared button primitives so every button reads as one system instead of a
 * dozen hand-tuned class strings. Instrument look: flat, hairline borders,
 * rationed accent, 8px radius, click easing.
 *
 * - <Button>      text (optionally icon) button with variants + sizes.
 * - <IconButton>  square icon-only chrome button (needs an accessible label).
 */
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent-fill text-on-accent hover:opacity-90',
  secondary: 'border border-line bg-face text-ink hover:border-muted',
  ghost: 'text-muted hover:text-ink',
  danger: 'bg-alert text-on-status hover:opacity-90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'gap-1.5 px-3 py-1.5 text-[10px]',
  md: 'gap-2 px-4 py-2 text-[11px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button
      type={type}
      className={`label-caps inline-flex items-center justify-center rounded-btn font-display transition-[opacity,color,border-color] duration-150 ease-click disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the button shows only an icon, so it needs an accessible name. */
  label: string
}

export function IconButton({
  label,
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-btn border border-line bg-face text-muted transition-colors duration-150 ease-click hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
