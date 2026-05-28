import { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, LogOut, Plus, Settings, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/apiClient'
import { useEnvironments } from '../../hooks/useEnvironments'
import { EnvironmentsDialog } from '../environments/EnvironmentsDialog'

interface Props {
  selectedEnv: string
  onEnvChange: (id: string) => void
  onNewRequest: () => void
  onLogout: () => void
}

export function TopBar({ selectedEnv, onEnvChange, onNewRequest, onLogout }: Props) {
  const { data: environments = [] } = useEnvironments()
  const [envDialogOpen, setEnvDialogOpen] = useState(false)

  async function handleLogout() {
    await api.logout().catch(() => {})
    onLogout()
  }

  const activeEnv = environments.find((e) => e.id === selectedEnv)
  const label = activeEnv?.name ?? 'No environment'

  return (
    <>
      <header className="flex items-center justify-between px-4 h-10 border-b border-border bg-elevated shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent" fill="currentColor" />
          <span className="text-sm font-semibold tracking-tight text-text">fling</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewRequest}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2.5 rounded text-xs',
              'text-subtle hover:text-text hover:bg-overlay',
              'border border-border hover:border-border',
              'transition-colors cursor-pointer',
            )}
          >
            <Plus size={11} />
            New Request
          </button>

          <div className="flex items-center gap-0">
            <Select.Root value={selectedEnv} onValueChange={onEnvChange}>
              <Select.Trigger
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1 rounded-l text-xs',
                  'text-muted hover:text-text hover:bg-overlay',
                  'border border-transparent hover:border-border',
                  'transition-colors cursor-pointer outline-none',
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    activeEnv ? 'bg-accent' : 'bg-subtle',
                  )}
                />
                <Select.Value>{label}</Select.Value>
                <ChevronDown size={11} className="text-subtle" />
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  className="z-50 min-w-[180px] bg-elevated border border-border rounded shadow-xl"
                  position="popper"
                  sideOffset={6}
                  align="end"
                >
                  <Select.Viewport className="p-1">
                    <Select.Item
                      value="none"
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 text-xs rounded',
                        'cursor-pointer outline-none transition-colors',
                        'text-muted data-[highlighted]:bg-overlay data-[highlighted]:text-text',
                      )}
                    >
                      <Select.ItemText>No environment</Select.ItemText>
                    </Select.Item>
                    {environments.map((env) => (
                      <Select.Item
                        key={env.id}
                        value={env.id}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 text-xs rounded',
                          'cursor-pointer outline-none transition-colors',
                          'text-muted data-[highlighted]:bg-overlay data-[highlighted]:text-text',
                        )}
                      >
                        <Select.ItemText>{env.name}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            <button
              onClick={() => setEnvDialogOpen(true)}
              title="Manage environments"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-r text-subtle',
                'hover:text-text hover:bg-overlay border border-transparent hover:border-border',
                'transition-colors cursor-pointer',
              )}
            >
              <Settings size={11} />
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded text-subtle',
              'hover:text-text hover:bg-overlay',
              'transition-colors cursor-pointer',
            )}
          >
            <LogOut size={11} />
          </button>
        </div>
      </header>

      <EnvironmentsDialog
        open={envDialogOpen}
        onOpenChange={setEnvDialogOpen}
        selectedEnvId={selectedEnv}
        onEnvChange={(id) => {
          onEnvChange(id)
          setEnvDialogOpen(false)
        }}
      />
    </>
  )
}
