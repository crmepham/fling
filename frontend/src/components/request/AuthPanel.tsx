import { cn } from '../../lib/utils'
import { resolveVars } from '../../lib/variables'
import { VarColoredInput } from './VarColoredInput'
import type { AuthConfig, AuthType } from '../../types/api'

interface Props {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
  envVariables: Record<string, string>
  hasCollection?: boolean
  collectionAuth?: AuthConfig | null
}

const inputClass = cn(
  'w-full bg-transparent text-xs font-mono outline-none py-0.5',
  'border-b border-transparent focus:border-accent transition-colors',
)

export function AuthPanel({ auth, onChange, envVariables, hasCollection = false, collectionAuth }: Props) {
  return (
    <div className="p-4 space-y-5 overflow-y-auto flex-1">
      {/* Type */}
      <div className="flex items-center gap-4">
        <label className="text-xs text-subtle w-24 shrink-0">Auth type</label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ ...auth, type: e.target.value as AuthType })}
          className={cn(
            'bg-elevated border border-border rounded px-2 py-1',
            'text-xs text-text outline-none focus:ring-1 focus:ring-accent',
            'cursor-pointer',
          )}
        >
          <option value="none">None</option>
          {hasCollection && <option value="inherit">Inherit from collection</option>}
          <option value="basic">Basic</option>
        </select>
      </div>

      {auth.type === 'basic' && (
        <>
          {/* Enabled toggle */}
          <div className="flex items-center gap-4">
            <label className="text-xs text-subtle w-24 shrink-0">Enabled</label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={auth.enabled}
                onChange={(e) => onChange({ ...auth, enabled: e.target.checked })}
                className="w-3.5 h-3.5 accent-accent cursor-pointer"
              />
              <span className="text-xs text-muted">
                {auth.enabled ? 'Authorization header will be sent' : 'Authorization header is disabled'}
              </span>
            </label>
          </div>

          {/* Username */}
          <div className="flex items-center gap-4">
            <label className="text-xs text-subtle w-24 shrink-0">Username</label>
            <VarColoredInput
              value={auth.username}
              onChange={(v) => onChange({ ...auth, username: v })}
              placeholder="username"
              envVariables={envVariables}
              className={cn(inputClass, 'flex-1', !auth.enabled && 'opacity-50')}
            />
          </div>

          {/* Password */}
          <div className="flex items-center gap-4">
            <label className="text-xs text-subtle w-24 shrink-0">Password</label>
            <VarColoredInput
              value={auth.password}
              onChange={(v) => onChange({ ...auth, password: v })}
              placeholder="password"
              envVariables={envVariables}
              className={cn(inputClass, 'flex-1', !auth.enabled && 'opacity-50')}
            />
          </div>

          {/* Preview */}
          {(auth.username || auth.password) && (
            <div className="rounded border border-border bg-elevated px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Header preview</p>
              <p className={cn('text-xs font-mono break-all', auth.enabled ? 'text-text' : 'text-subtle line-through')}>
                Authorization: Basic {btoa(`${resolveVars(auth.username, envVariables)}:${resolveVars(auth.password, envVariables)}`)}
              </p>
            </div>
          )}
        </>
      )}

      {auth.type === 'inherit' && (
        <div className="space-y-3">
          {collectionAuth && collectionAuth.type !== 'none' ? (
            <div className="rounded border border-border bg-elevated px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Inherited header</p>
              <p className="text-xs font-mono break-all text-accent">
                Authorization: Basic {btoa(`${resolveVars(collectionAuth.username, envVariables)}:${resolveVars(collectionAuth.password, envVariables)}`)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-amber-400">No auth configured on this collection.</p>
          )}
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-subtle">No authentication will be sent with this request.</p>
      )}
    </div>
  )
}
