import { cn } from '../../lib/utils'

interface Props {
  status: number
  statusText: string
}

export function StatusBadge({ status, statusText }: Props) {
  const color =
    status >= 500 ? 'text-status-5xx bg-red-950/40 border-red-900/30' :
    status >= 400 ? 'text-status-4xx bg-amber-950/40 border-amber-900/30' :
    status >= 300 ? 'text-status-3xx bg-blue-950/40 border-blue-900/30' :
                    'text-status-2xx bg-green-950/40 border-green-900/30'

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border',
      color,
    )}>
      {status} {statusText}
    </span>
  )
}
