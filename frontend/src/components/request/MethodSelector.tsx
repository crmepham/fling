import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { HttpMethod } from '../../types/api'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    'text-method-get',
  POST:   'text-method-post',
  PUT:    'text-method-put',
  PATCH:  'text-method-patch',
  DELETE: 'text-method-delete',
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface Props {
  value: HttpMethod
  onChange: (method: HttpMethod) => void
}

export function MethodSelector({ value, onChange }: Props) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as HttpMethod)}>
      <Select.Trigger
        className={cn(
          'flex items-center gap-1.5 px-3 h-9 rounded-l border border-border bg-elevated',
          'text-xs font-semibold tracking-wider font-mono cursor-pointer',
          'hover:bg-overlay focus:outline-none focus:ring-1 focus:ring-accent',
          'transition-colors min-w-[76px]',
          METHOD_COLORS[value],
        )}
      >
        <Select.Value />
        <ChevronDown size={12} className="text-subtle ml-auto shrink-0" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-50 min-w-[100px] bg-elevated border border-border rounded shadow-xl overflow-hidden"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            {METHODS.map((method) => (
              <Select.Item
                key={method}
                value={method}
                className={cn(
                  'flex items-center px-3 py-2 text-xs font-semibold font-mono tracking-wider',
                  'cursor-pointer outline-none select-none',
                  'data-[highlighted]:bg-overlay transition-colors',
                  METHOD_COLORS[method],
                )}
              >
                <Select.ItemText>{method}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
