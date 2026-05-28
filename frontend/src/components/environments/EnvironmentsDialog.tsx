import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, Trash2, Eye, EyeOff, X, Save, Download, Upload, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useToast } from '../../lib/toast'
import { useQueryClient } from '@tanstack/react-query'
import {
  useEnvironments,
  useEnvironmentDetail,
  useCreateEnvironment,
  useDeleteEnvironment,
  useBulkUpdateVariables,
} from '../../hooks/useEnvironments'
import { api } from '../../lib/apiClient'
import type { EnvironmentVariable } from '../../types/api'

// ─── Row type used only in the editor (tracks per-row dirty state) ────────────

interface EditableVar extends EnvironmentVariable {
  dirty: boolean   // true if value was edited (so we don't stomp secrets with '__UNCHANGED__')
  deleted: boolean // soft-delete until saved
}

function makeNewRow(): EditableVar {
  return {
    id: '',
    key: '',
    value: '',
    isSecret: false,
    dirty: true,
    deleted: false,
  }
}

// ─── Variable editor ──────────────────────────────────────────────────────────

interface VariableEditorProps {
  envId: string
}

function VariableEditor({ envId }: VariableEditorProps) {
  const { data: detail, isLoading } = useEnvironmentDetail(envId)
  const bulkUpdate = useBulkUpdateVariables()
  const toast = useToast()
  const [rows, setRows] = useState<EditableVar[]>([])
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set())

  // Sync rows when detail loads / changes
  useEffect(() => {
    if (!detail) return
    const saved = detail.variables.map((v) => ({ ...v, dirty: false, deleted: false }))
    const empty = Array.from({ length: Math.max(0, 5 - saved.length) }, makeNewRow)
    setRows([...saved, ...empty])
    setVisibleSecrets(new Set())
  }, [detail])

  function updateRow(index: number, patch: Partial<EditableVar>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch, dirty: true } : r))
    )
  }

  function addRow() {
    setRows((prev) => [...prev, makeNewRow()])
  }

  function toggleSecretVisibility(index: number) {
    setVisibleSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleSave() {
    const toSave = rows
      .filter((r) => !r.deleted)
      .filter((r) => r.key.trim() !== '')
      .map((r) => ({
        id: r.id || undefined,
        key: r.key,
        // If secret and not edited, send sentinel so backend preserves the value
        value: r.isSecret && !r.dirty ? '__UNCHANGED__' : (r.value ?? ''),
        isSecret: r.isSecret,
      }))

    try {
      await bulkUpdate.mutateAsync({
        id: envId,
        variables: toSave.map((v) => ({
          id: v.id ?? '',
          key: v.key,
          value: v.value,
          isSecret: v.isSecret,
        })),
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save variables', 'error')
    }
  }

  const visibleRows = rows.filter((r) => !r.deleted)
  const hasPendingChanges = rows.some((r) => r.dirty || r.deleted)

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-xs text-subtle">Loading…</div>
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Variable rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Header row */}
        {visibleRows.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-4 pt-3 pb-1">
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Key</span>
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Value</span>
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Secret</span>
            <span />
          </div>
        )}

        <div className="px-4 pb-3 space-y-1.5">
          {rows.map((row, i) => {
            if (row.deleted) return null
            const isVisible = visibleSecrets.has(i)
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                <input
                  value={row.key}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  placeholder="VARIABLE_NAME"
                  className={cn(
                    'h-7 px-2 rounded bg-base border border-border',
                    'text-xs font-mono text-text placeholder:text-subtle',
                    'outline-none focus:ring-1 focus:ring-accent focus:ring-inset',
                  )}
                />
                <div className="relative flex items-center">
                  <input
                    type={row.isSecret && !isVisible ? 'password' : 'text'}
                    value={row.value ?? ''}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                    placeholder={row.isSecret && !row.dirty && row.id ? '••••••••' : 'value'}
                    className={cn(
                      'h-7 px-2 pr-7 rounded bg-base border border-border w-full',
                      'text-xs font-mono text-text placeholder:text-subtle',
                      'outline-none focus:ring-1 focus:ring-accent focus:ring-inset',
                    )}
                  />
                  {row.isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility(i)}
                      className="absolute right-1.5 text-subtle hover:text-muted"
                    >
                      {isVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  )}
                </div>

                {/* Secret toggle */}
                <button
                  type="button"
                  onClick={() => updateRow(i, { isSecret: !row.isSecret })}
                  title={row.isSecret ? 'Mark as plain' : 'Mark as secret'}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center rounded border text-xs font-semibold transition-colors',
                    row.isSecret
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-subtle hover:text-muted hover:border-border',
                  )}
                >
                  S
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.map((r, j) => j === i ? { ...r, deleted: true } : r))}
                  className="w-7 h-7 flex items-center justify-center text-subtle hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={addRow}
          className={cn(
            'flex items-center gap-1.5 h-7 px-3 rounded text-xs',
            'text-subtle hover:text-text hover:bg-overlay border border-border transition-colors cursor-pointer',
          )}
        >
          <Plus size={11} />
          Add variable
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasPendingChanges || bulkUpdate.isPending}
            className={cn(
              'flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium transition-colors',
              hasPendingChanges
                ? 'bg-accent text-white hover:bg-accent-dim cursor-pointer'
                : 'bg-overlay text-subtle cursor-default',
              'disabled:cursor-not-allowed',
            )}
          >
            <Save size={11} />
            {bulkUpdate.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Environments dialog ──────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEnvId: string
  onEnvChange: (id: string) => void
}

export function EnvironmentsDialog({ open, onOpenChange, selectedEnvId, onEnvChange }: Props) {
  const queryClient = useQueryClient()
  const { data: environments = [], isLoading } = useEnvironments()
  const createEnv = useCreateEnvironment()
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function handleExport(envId: string, envName: string) {
    try {
      const detail = await api.getEnvironment(envId)
      const payload = {
        flingVersion: '1',
        exportedAt: new Date().toISOString(),
        environment: {
          name: detail.name,
          variables: detail.variables.map((v) => ({
            key: v.key,
            value: v.value ?? '',
            isSecret: v.isSecret,
          })),
        },
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${envName}.fling-env.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Failed to export environment. Please try again.')
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!importInputRef.current) return
    importInputRef.current.value = ''
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        toast('Invalid file — could not parse JSON.')
        return
      }

      if (typeof data !== 'object' || data === null) {
        toast('Invalid environment export file.')
        return
      }
      const root = data as Record<string, unknown>
      if ('collection' in root) {
        toast('This looks like a collection export. Please use the import option in the sidebar.')
        return
      }
      if (
        !('environment' in root) ||
        typeof root.environment !== 'object' ||
        root.environment === null
      ) {
        toast('Invalid environment export file.')
        return
      }

      const env = (data as Record<string, unknown>).environment as Record<string, unknown>

      if (typeof env.name !== 'string' || !env.name.trim()) {
        toast('Invalid export file: missing environment name.')
        return
      }
      if (!Array.isArray(env.variables)) {
        toast('Invalid export file: missing variables array.')
        return
      }

      const { name, variables } = env as { name: string; variables: unknown[] }

      for (let i = 0; i < variables.length; i++) {
        const v = variables[i] as Record<string, unknown>
        if (typeof v.key !== 'string' || !v.key.trim()) {
          toast(`Invalid export file: variable ${i + 1} is missing a key.`)
          return
        }
      }

      if (environments.some((e) => e.name.toLowerCase() === name.trim().toLowerCase())) {
        toast(`An environment named "${name}" already exists.`)
        return
      }

      const created = await createEnv.mutateAsync(name.trim())
      await api.bulkUpdateVariables(
        created.id,
        variables.map((v) => {
          const vr = v as Record<string, unknown>
          return {
            key: vr.key as string,
            value: typeof vr.value === 'string' ? vr.value : '',
            isSecret: vr.isSecret === true,
          }
        }),
      )
      await queryClient.invalidateQueries({ queryKey: ['environments'] })

      setActiveEnvId(created.id)
      toast(`Imported "${name}" with ${variables.length} variable${variables.length !== 1 ? 's' : ''}.`, 'success')
    } catch {
      toast('Failed to import environment. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const deleteEnv = useDeleteEnvironment((deletedId) => {
    const next = environments.find((e) => e.id !== deletedId)
    if (activeEnvId === deletedId) setActiveEnvId(next?.id ?? null)
    if (selectedEnvId === deletedId) onEnvChange(next?.id ?? 'none')
    setConfirmDeleteId(null)
  })

  // Auto-select first env when dialog opens (if none selected)
  useEffect(() => {
    if (open && environments.length > 0 && activeEnvId === null) {
      setActiveEnvId(environments[0].id)
    }
  }, [open, environments, activeEnvId])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setNewName('')
      setCreateError(null)
      setConfirmDeleteId(null)
    }
  }, [open])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (environments.some((env) => env.name.toLowerCase() === name.toLowerCase())) {
      setCreateError('An environment with this name already exists')
      return
    }
    setCreateError(null)
    try {
      const created = await createEnv.mutateAsync(name)
      setNewName('')
      setActiveEnvId(created.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create')
    }
  }

  const activeEnv = environments.find((e) => e.id === activeEnvId)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className={cn(
            'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[680px] max-w-[95vw] h-[480px] max-h-[90vh]',
            'bg-elevated border border-border rounded-lg shadow-2xl',
            'flex flex-col overflow-hidden',
          )}
          onEscapeKeyDown={(e) => {
            if (confirmDeleteId) {
              e.preventDefault()
              setConfirmDeleteId(null)
            }
          }}
        >
          {/* Dialog header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <Dialog.Title className="text-sm font-semibold text-text">Environments</Dialog.Title>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                title="Import environment"
                className="flex items-center gap-1.5 h-6 px-2 rounded text-[10px] border border-border text-subtle hover:text-text hover:bg-overlay transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isImporting ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                Import
              </button>
              <Dialog.Close className="text-subtle hover:text-muted transition-colors cursor-pointer">
                <X size={14} />
              </Dialog.Close>
            </div>
          </div>

          {/* Body: two-column layout */}
          <div className="flex flex-1 min-h-0">
            {/* Left: environment list */}
            <div className="w-48 shrink-0 border-r border-border flex flex-col">
              <div className="flex-1 overflow-y-auto py-2">
                {isLoading && (
                  <p className="px-3 py-2 text-xs text-subtle">Loading…</p>
                )}
                {!isLoading && environments.length === 0 && (
                  <p className="px-3 py-2 text-xs text-subtle">No environments</p>
                )}
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={cn(
                      'group flex items-center justify-between px-3 py-1.5 mx-1 rounded cursor-pointer select-none',
                      'transition-colors',
                      activeEnvId === env.id
                        ? 'bg-accent/10 text-text'
                        : 'text-muted hover:bg-overlay hover:text-text',
                    )}
                    onClick={() => setActiveEnvId(env.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{env.name}</p>
                      <p className="text-[10px] text-subtle">{env.variableCount} variable{env.variableCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleExport(env.id, env.name) }}
                        title="Export environment"
                        className="text-subtle hover:text-text p-0.5 transition-colors cursor-pointer"
                      >
                        <Download size={11} />
                      </button>
                      {environments.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(env.id) }}
                          title="Delete environment"
                          className="text-subtle hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Create form */}
              <div className="shrink-0 border-t border-border p-2">
                <form onSubmit={handleCreate} className="flex flex-col gap-1">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New environment…"
                    className={cn(
                      'h-7 px-2 rounded bg-base border border-border',
                      'text-xs text-text placeholder:text-subtle',
                      'outline-none focus:ring-1 focus:ring-accent focus:ring-inset',
                    )}
                  />
                  {createError && <p className="text-[10px] text-red-400 px-1">{createError}</p>}
                  <button
                    type="submit"
                    disabled={!newName.trim() || createEnv.isPending}
                    className={cn(
                      'flex items-center justify-center gap-1 h-7 rounded text-xs font-medium',
                      'bg-accent text-white hover:bg-accent-dim transition-colors cursor-pointer',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    <Plus size={11} />
                    Create
                  </button>
                </form>
              </div>
            </div>

            {/* Right: variable editor */}
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              {activeEnvId == null ? (
                <div className="flex-1 flex items-center justify-center text-xs text-subtle">
                  Select or create an environment
                </div>
              ) : (
                <>
                  {/* Env header with "Use this" button */}
                  <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
                    <span className="text-xs font-medium text-text">{activeEnv?.name}</span>
                    <button
                      onClick={() => onEnvChange(activeEnvId === selectedEnvId ? 'none' : activeEnvId)}
                      className={cn(
                        'h-6 px-2.5 rounded text-[10px] font-medium border transition-colors cursor-pointer',
                        activeEnvId === selectedEnvId
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-accent bg-accent text-white hover:bg-accent-dim',
                      )}
                    >
                      {activeEnvId === selectedEnvId ? 'Active' : 'Use this'}
                    </button>
                  </div>
                  <VariableEditor key={activeEnvId} envId={activeEnvId} />
                </>
              )}
            </div>
          </div>

          {/* Confirm delete overlay */}
          {confirmDeleteId && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-elevated border border-border rounded-lg p-5 w-72 shadow-2xl">
                <p className="text-sm font-semibold text-text mb-1">Delete environment?</p>
                <p className="text-xs text-muted mb-4">
                  This will remove the environment and all its variables. This cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="h-7 px-3 rounded text-xs border border-border text-subtle hover:text-text hover:bg-overlay transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteEnv.mutate(confirmDeleteId)}
                    disabled={deleteEnv.isPending}
                    className="h-7 px-3 rounded text-xs bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {deleteEnv.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
