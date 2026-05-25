import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { resolveVars } from '../../lib/variables'
import { cn } from '../../lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  placeholder?: string
  envVariables?: Record<string, string>
  className?: string
}

export const VarColoredInput = forwardRef<HTMLInputElement, Props>(
function VarColoredInput({ value, onChange, onKeyDown, onBlur, placeholder, envVariables = {}, className }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current!)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const input = inputRef.current
    const overlay = overlayRef.current
    if (!input || !overlay) return
    const sync = () => { overlay.scrollLeft = input.scrollLeft }
    input.addEventListener('scroll', sync)
    return () => input.removeEventListener('scroll', sync)
  }, [])

  useEffect(() => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  })

  const parts = value.split(/({{[\w]+}})/g)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        spellCheck={false}
        style={{ caretColor: 'var(--color-text)' }}
        className={cn('text-transparent placeholder:text-subtle', className)}
      />

      {/* Coloured overlay — rendered after input so it sits on top (z-index) */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap pointer-events-none text-xs font-mono"
      >
        {parts.map((part, i) => {
          const isVar = /^{{[\w]+}}$/.test(part)
          if (!isVar) return <span key={i} className="text-text pointer-events-none">{part}</span>

          const name = part.slice(2, -2)
          const resolved = name in envVariables
          const resolvedValue = resolved ? resolveVars(envVariables[name], envVariables) : undefined

          return (
            <Tooltip.Root key={i} delayDuration={300}>
              <Tooltip.Trigger asChild>
                <span
                  className={cn(
                    'pointer-events-auto cursor-text',
                    resolved ? 'text-accent' : 'text-amber-400',
                  )}
                  onMouseDown={(e) => {
                    // Forward focus to the input without stealing it
                    e.preventDefault()
                    inputRef.current?.focus()
                  }}
                >
                  {part}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  sideOffset={4}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-mono shadow-lg z-50',
                    'bg-elevated border border-border',
                    resolved ? 'text-accent' : 'text-amber-400',
                  )}
                >
                  {resolved ? resolvedValue : 'Not set'}
                  <Tooltip.Arrow className="fill-border" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )
        })}
      </div>
    </div>
  )
})
