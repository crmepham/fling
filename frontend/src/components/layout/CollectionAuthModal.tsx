import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { resolveVars } from '../../lib/variables'
import { useUpdateCollectionAuth } from '../../hooks/useCollections'
import type { Collection, AuthConfig, AuthType } from '../../types/api'
import { VarColoredInput } from '../request/VarColoredInput'

const defaultAuth: AuthConfig = { type: 'none', enabled: true, username: '', password: '' }

const inputClass = cn(
  'w-full bg-transparent text-xs font-mono outline-none py-0.5',
  'border-b border-transparent focus:border-accent transition-colors',
)

interface Props {
  collection: Collection
  envVariables: Record<string, string>
  children: React.ReactNode
}

export function CollectionAuthModal({ collection, envVariables, children }: Props) {
  const [open, setOpen] = useState(false)
  const [auth, setAuth] = useState<AuthConfig>(defaultAuth)
  const { mutate: updateAuth, isPending } = useUpdateCollectionAuth()

  function handleOpenChange(next: boolean) {
    if (next) setAuth(collection.auth ?? defaultAuth)
    setOpen(next)
  }

  function handleSave() {
    const authToSave = auth.type === 'none' ? null : auth
    updateAuth(
      { id: collection.id, auth: authToSave },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-sm bg-elevated border border-border rounded-lg shadow-2xl',
          'p-5 focus:outline-none',
        )}>
          <div className="flex items-center justify-between mb-1">
            <Dialog.Title className="text-sm font-semibold text-text">Collection auth</Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors cursor-pointer">
              <X size={14} />
            </Dialog.Close>
          </div>
          <p className="text-xs text-subtle mb-4 truncate">{collection.name}</p>

          <div className="space-y-4 mb-5">
            {/* Type */}
            <div className="flex items-center gap-4">
              <label className="text-xs text-subtle w-20 shrink-0">Auth type</label>
              <select
                value={auth.type}
                onChange={(e) => setAuth({ ...auth, type: e.target.value as AuthType })}
                className={cn(
                  'bg-base border border-border rounded px-2 py-1',
                  'text-xs text-text outline-none focus:ring-1 focus:ring-accent cursor-pointer',
                )}
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="bearer">Bearer token</option>
              </select>
            </div>

            {auth.type === 'basic' && (
              <>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-subtle w-20 shrink-0">Username</label>
                  <VarColoredInput
                    value={auth.username}
                    onChange={(v) => setAuth({ ...auth, username: v })}
                    placeholder="username"
                    envVariables={envVariables}
                    className={cn(inputClass, 'flex-1')}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-subtle w-20 shrink-0">Password</label>
                  <VarColoredInput
                    value={auth.password}
                    onChange={(v) => setAuth({ ...auth, password: v })}
                    placeholder="password"
                    envVariables={envVariables}
                    className={cn(inputClass, 'flex-1')}
                  />
                </div>
              </>
            )}

            {auth.type === 'basic' && (auth.username || auth.password) && (
              <div className="rounded border border-border bg-elevated px-3 py-2 space-y-1">
                <p className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Header preview</p>
                <p className="text-xs font-mono break-all text-text">
                  Authorization: Basic {btoa(`${resolveVars(auth.username, envVariables)}:${resolveVars(auth.password, envVariables)}`)}
                </p>
              </div>
            )}

            {auth.type === 'bearer' && (
              <>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-subtle w-20 shrink-0">Token</label>
                  <VarColoredInput
                    value={auth.token ?? ''}
                    onChange={(v) => setAuth({ ...auth, token: v })}
                    placeholder="your-token"
                    envVariables={envVariables}
                    className="w-full bg-transparent text-xs font-mono outline-none py-0.5 border-b border-transparent focus:border-accent transition-colors flex-1"
                  />
                </div>
                {auth.token && (
                  <div className="rounded border border-border bg-elevated px-3 py-2 space-y-1">
                    <p className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Header preview</p>
                    <p className="text-xs font-mono break-all text-text">
                      Authorization: Bearer {resolveVars(auth.token, envVariables)}
                    </p>
                  </div>
                )}
              </>
            )}

            {auth.type === 'none' && (
              <p className="text-xs text-subtle">No authentication will be applied at the collection level.</p>
            )}
          </div>

          <div className="rounded border border-border/50 bg-base/50 px-3 py-2 mb-5">
            <p className="text-[11px] text-subtle leading-relaxed">
              Requests in this collection can use this auth by selecting{' '}
              <span className="text-text font-medium">Inherit from collection</span> in their Auth tab.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Dialog.Close className="px-3 py-1.5 text-xs rounded text-muted hover:text-text hover:bg-overlay transition-colors cursor-pointer">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={isPending}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                'bg-accent text-white hover:bg-accent-dim transition-colors cursor-pointer',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {isPending && <Loader2 size={11} className="animate-spin" />}
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
