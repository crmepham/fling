import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Bookmark, Loader2, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useCollections, useRequests, useSaveRequest, useUpdateRequest } from '../../hooks/useCollections'
import type { HttpMethod, KeyValue, SavedRequest, AuthConfig, ResponseExtraction } from '../../types/api'

interface Props {
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  auth: AuthConfig
  responseExtractions: ResponseExtraction[]
  preRequestId: string | null
  preRequestSuccessCodes: number[]
  activeRequest: SavedRequest | null
  isDirty: boolean
  onSaved: (saved: SavedRequest) => void
}

export function SaveRequestDialog({ method, url, params, headers, body, bodyType, auth, responseExtractions, preRequestId, preRequestSuccessCodes, activeRequest, isDirty, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: collections = [] } = useCollections()
  const { data: existingRequests = [] } = useRequests(collectionId)
  const { mutate: saveRequest, isPending: isSaving } = useSaveRequest()
  const { mutate: updateRequest, isPending: isUpdating } = useUpdateRequest()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && !open) {
        e.preventDefault()
        if (!url.trim()) return
        if (activeRequest !== null) {
          updateRequest(
            {
              id: activeRequest.id,
              collectionId: activeRequest.collectionId ?? collections[0]?.id ?? '',
              name: activeRequest.name,
              method,
              url: url.split('?')[0],
              queryParams: params.filter((p) => p.key.trim() !== '').map(({ key, value, enabled }) => ({ key, value, enabled })),
              headers: headers.filter((h) => h.key.trim() !== '').map(({ key, value, enabled }) => ({ key, value, enabled })),
              body: body || undefined,
              bodyType,
              auth: auth.type === 'none' && !auth.username && !auth.password ? null : auth,
              responseExtractions,
              preRequestId,
              preRequestSuccessCodes,
            },
            { onSuccess: (saved) => onSaved(saved) },
          )
        } else {
          handleOpenChange(true)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, url, activeRequest, method, params, headers, body, bodyType, auth, collections, responseExtractions, preRequestId, preRequestSuccessCodes])

  const isPending = isSaving || isUpdating
  const isUpdate = activeRequest !== null

  const isDuplicate =
    name.trim() !== '' &&
    existingRequests.some((r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== activeRequest?.id)

  function handleOpenChange(next: boolean) {
    if (next) {
      if (activeRequest !== null) {
        // Pre-populate from the loaded saved request every time the dialog opens
        setName(activeRequest.name)
        setCollectionId(activeRequest.collectionId ?? collections[0]?.id ?? '')
      } else {
        setName('')
        const valid = collections.some((c) => c.id === collectionId)
        if (!valid && collections.length > 0) {
          setCollectionId(collections[0].id)
        }
      }
    }
    setOpen(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !collectionId || isDuplicate) return
    setSubmitError(null)

    const requestBody = {
      collectionId,
      name: name.trim(),
      method,
      url: url.split('?')[0],
      queryParams: params
        .filter((p) => p.key.trim() !== '')
        .map(({ key, value, enabled }) => ({ key, value, enabled })),
      headers: headers
        .filter((h) => h.key.trim() !== '')
        .map(({ key, value, enabled }) => ({ key, value, enabled })),
      body: body || undefined,
      bodyType,
      auth: auth.type === 'none' && !auth.username && !auth.password ? null : auth,
      responseExtractions,
      preRequestId,
      preRequestSuccessCodes,
    }

    const onError = () => setSubmitError('Failed to save request. Please try again.')

    if (isUpdate) {
      updateRequest(
        { id: activeRequest.id, ...requestBody },
        { onSuccess: (saved) => { setOpen(false); onSaved(saved) }, onError },
      )
    } else {
      saveRequest(
        requestBody,
        { onSuccess: (saved) => { setOpen(false); onSaved(saved) }, onError },
      )
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          disabled={!url.trim()}
          title={isUpdate ? `Save changes to "${activeRequest.name}"` : 'Save request'}
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 ml-1',
            'border rounded text-xs transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none',
            isDirty
              ? 'border-accent bg-accent text-white hover:bg-accent-dim'
              : 'border-border bg-elevated text-subtle hover:text-text hover:bg-overlay',
          )}
        >
          <Bookmark size={13} />
          Save
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />

        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-sm bg-elevated border border-border rounded-lg shadow-2xl',
          'p-5 focus:outline-none',
        )}>
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold text-text">
              {isUpdate ? 'Update request' : 'Save request'}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors">
              <X size={14} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted" htmlFor="request-name">
                Name
              </label>
              <input
                id="request-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Get users"
                maxLength={255}
                autoFocus
                className={cn(
                  'w-full px-3 py-2 rounded bg-base border',
                  'text-sm text-text placeholder:text-subtle',
                  'outline-none transition-colors',
                  isDuplicate
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-accent',
                )}
              />
              {isDuplicate && (
                <p className="text-xs text-red-400">
                  A request with this name already exists in this collection
                </p>
              )}
            </div>

            {/* Collection picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted" htmlFor="collection-select">
                Collection
              </label>
              {collections.length === 0 ? (
                <p className="text-xs text-subtle italic">No collections — create one first</p>
              ) : (
                <select
                  id="collection-select"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded bg-base border border-border',
                    'text-sm text-text',
                    'outline-none focus:border-accent transition-colors',
                    'cursor-pointer',
                  )}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close className={cn(
                'px-3 py-1.5 text-xs rounded text-muted',
                'hover:text-text hover:bg-overlay transition-colors',
              )}>
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || !collectionId || isDuplicate || isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                  'bg-accent text-white hover:bg-accent-dim transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {isPending && <Loader2 size={11} className="animate-spin" />}
                {isUpdate ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
