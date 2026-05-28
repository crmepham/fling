import { useState, useRef } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, ChevronRight, FolderOpen, Folder, FileCode2, Plus, X, Loader2, Trash2, Play, Copy, GripVertical, Settings2, Pin, PinOff, Download, Upload } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '../../lib/utils'
import { useToast } from '../../lib/toast'
import { HistoryPanel } from './HistoryPanel'
import {
  useCollections, useCreateCollection, useDeleteCollection, useDeleteRequest,
  useDuplicateRequest, useMoveRequest, usePinCollection, useRequests, useReorderCollections, useReorderRequests,
} from '../../hooks/useCollections'
import { api } from '../../lib/apiClient'
import type { Collection, PageResponse, SavedRequest } from '../../types/api'
import type { NewDraft } from '../../App'
import { CollectionAuthModal } from './CollectionAuthModal'

// ─── Highlight ───────────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/30 text-text rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Method badge ────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    'text-method-get',
  POST:   'text-method-post',
  PUT:    'text-method-put',
  PATCH:  'text-method-patch',
  DELETE: 'text-method-delete',
}

function MethodBadge({ method }: { method: string }) {
  const color = METHOD_COLORS[method] ?? 'text-subtle'
  return (
    <span className={cn('font-mono font-semibold shrink-0 text-[10px] leading-none', color)}>
      {method}
    </span>
  )
}

// ─── Create Collection Dialog ────────────────────────────────────────────────

function CreateCollectionDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { mutate: createCollection, isPending } = useCreateCollection()
  const { data: collections = [] } = useCollections()

  const isDuplicate = name.trim() !== '' &&
    collections.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || isDuplicate) return
    setSubmitError(null)
    createCollection(
      { name: name.trim() },
      {
        onSuccess: () => { setOpen(false); setName('') },
        onError: () => setSubmitError('Failed to create collection. Please try again.'),
      },
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-sm bg-elevated border border-border rounded-lg shadow-2xl',
          'p-5 focus:outline-none',
        )}>
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold text-text">New collection</Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors cursor-pointer">
              <X size={14} />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted" htmlFor="collection-name">Name</label>
              <input
                id="collection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. User Service"
                maxLength={255}
                autoFocus
                className={cn(
                  'w-full px-3 py-2 rounded bg-base border text-sm text-text placeholder:text-subtle outline-none transition-colors',
                  isDuplicate ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-accent',
                )}
              />
              {isDuplicate && <p className="text-xs text-red-400">A collection with this name already exists</p>}
            </div>
            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close className="px-3 py-1.5 text-xs rounded text-muted hover:text-text hover:bg-overlay transition-colors cursor-pointer">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || isDuplicate || isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                  'bg-accent text-white hover:bg-accent-dim transition-colors cursor-pointer',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {isPending && <Loader2 size={11} className="animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Sortable request item ────────────────────────────────────────────────────
// Drag handle sits between the play button and delete button (right side).

function SortableRequestItem({
  req,
  collectionId,
  activeRequestId,
  isDirty,
  search,
  showDragHandle,
  onRequestSelect,
  onRequestSend,
  onDuplicateRequest,
  onDeleteRequest,
  isDeletingRequest,
}: {
  req: SavedRequest
  collectionId: string
  activeRequestId?: string
  isDirty?: boolean
  search: string
  showDragHandle: boolean
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
  onDuplicateRequest: (id: string) => void
  onDeleteRequest: (id: string) => void
  isDeletingRequest: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: req.id, data: { type: 'request', collectionId } })

  const isActive = req.id === activeRequestId
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center group rounded-sm transition-colors',
        isActive ? 'bg-accent/10' : 'hover:bg-overlay',
      )}
    >
      <button
        onClick={() => onRequestSelect(req)}
        title={req.name}
        className={cn(
          'flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 pl-8 text-xs transition-colors cursor-pointer',
          isActive ? 'text-text' : 'text-muted group-hover:text-text',
        )}
      >
        <MethodBadge method={req.method} />
        <span className="truncate"><Highlight text={req.name} query={search} /></span>
        {(isActive ? isDirty : !!localStorage.getItem(`fling:draft:${req.id}`)) && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
        )}
      </button>

      <button
        onClick={() => onRequestSend(req)}
        title="Send request"
        className={cn(
          'p-1.5 rounded transition-all shrink-0',
          'opacity-0 group-hover:opacity-100',
          'text-subtle hover:text-accent hover:bg-accent/10 cursor-pointer',
        )}
      >
        <Play size={12} />
      </button>

      <button
        onClick={() => onDuplicateRequest(req.id)}
        title="Duplicate request"
        className={cn(
          'p-1.5 rounded transition-all shrink-0',
          'opacity-0 group-hover:opacity-100',
          'text-subtle hover:text-text hover:bg-overlay cursor-pointer',
        )}
      >
        <Copy size={12} />
      </button>

      {showDragHandle && (
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className={cn(
            'p-1.5 rounded transition-all shrink-0',
            'opacity-0 group-hover:opacity-100',
            'text-subtle hover:text-text cursor-grab active:cursor-grabbing touch-none',
          )}
          tabIndex={-1}
        >
          <GripVertical size={12} />
        </button>
      )}

      <button
        onClick={() => onDeleteRequest(req.id)}
        disabled={isDeletingRequest}
        title="Delete request"
        className={cn(
          'p-1.5 mr-1 rounded transition-all shrink-0',
          'opacity-0 group-hover:opacity-100',
          'text-subtle hover:text-status-5xx hover:bg-red-950/40 cursor-pointer',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
      >
        {isDeletingRequest ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </div>
  )
}

// ─── Collection item ─────────────────────────────────────────────────────────
// No DndContext here — the parent Sidebar owns it. We only provide SortableContext
// for this collection's requests so dnd-kit knows their relative order.

function CollectionItem({
  collection,
  isLast,
  search,
  activeRequestId,
  isDirty,
  dragHandleProps,
  envVariables,
  onRequestSelect,
  onRequestSend,
  onPin,
}: {
  collection: Collection
  isLast: boolean
  search: string
  activeRequestId?: string
  isDirty?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
  onPin: (id: string) => void
}) {
  const q = search.toLowerCase()
  const toast = useToast()
  const [open, setOpen] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { data: requests = [] } = useRequests(collection.id)
  const { mutate: deleteCollection } = useDeleteCollection()
  const { mutate: deleteRequest, isPending: isDeletingRequest } = useDeleteRequest(collection.id)
  const { mutate: duplicateRequest } = useDuplicateRequest(collection.id)

  const showDragHandle = q === ''
  const collectionMatches = !q || collection.name.toLowerCase().includes(q)
  // If the collection name itself matches, show all its requests; otherwise filter by request name
  const matchingRequests = q && !collectionMatches
    ? requests.filter((r) => r.name.toLowerCase().includes(q))
    : requests
  // Always expand while a search is active (we only reach here if something matched)
  const effectiveOpen = q ? true : open

  // All hooks must be called before any conditional return
  if (q && !collectionMatches && matchingRequests.length === 0) return null

  async function handleExport() {
    setIsExporting(true)
    try {
      const result = await api.listRequests(collection.id)
      const payload = {
        flingVersion: '1',
        exportedAt: new Date().toISOString(),
        collection: {
          name: collection.name,
          description: collection.description,
          auth: collection.auth ?? null,
          requests: result.data.map((r) => ({
            name: r.name,
            method: r.method,
            url: r.url,
            queryParams: r.queryParams,
            headers: r.headers,
            body: r.body ?? null,
            bodyType: r.bodyType,
            auth: r.auth ?? null,
          })),
        },
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection.name}.fling.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Failed to export collection. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await Promise.all(requests.map((r) => api.deleteRequest(r.id)))
      deleteCollection(collection.id, {
        onSuccess: () => setConfirmOpen(false),
        onError: () => toast('Failed to delete collection. Please try again.'),
      })
    } catch {
      toast('Failed to delete one or more requests. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Collapsible.Root open={effectiveOpen} onOpenChange={setOpen}>
      <div className="flex items-center group rounded-sm hover:bg-overlay transition-colors">
        <Collapsible.Trigger asChild>
          <button className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 text-xs font-medium text-muted group-hover:text-text transition-colors cursor-pointer">
            <ChevronRight
              size={12}
              className={cn('text-subtle transition-transform duration-150 shrink-0', open && 'rotate-90')}
            />
            {open
              ? <FolderOpen size={13} className="text-accent/70 shrink-0" />
              : <Folder size={13} className="text-accent/70 shrink-0" />
            }
            <span className="truncate"><Highlight text={collection.name} query={search} /></span>
          </button>
        </Collapsible.Trigger>

        {showDragHandle && dragHandleProps && (
          <button
            {...dragHandleProps}
            title="Drag to reorder collection"
            className={cn(
              'p-1.5 rounded transition-all shrink-0',
              'opacity-0 group-hover:opacity-100',
              'text-subtle hover:text-text cursor-grab active:cursor-grabbing touch-none',
            )}
            tabIndex={-1}
          >
            <GripVertical size={12} />
          </button>
        )}

        <button
          onClick={() => onPin(collection.id)}
          title={collection.pinned ? 'Unpin collection' : 'Pin collection'}
          className={cn(
            'p-1.5 rounded transition-all shrink-0',
            collection.pinned
              ? 'opacity-100 text-accent hover:text-subtle'
              : 'opacity-0 group-hover:opacity-100 text-subtle hover:text-accent',
            'hover:bg-overlay cursor-pointer',
          )}
        >
          {collection.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>

        <CollectionAuthModal collection={collection} envVariables={envVariables}>
          <button
            title="Collection auth settings"
            className={cn(
              'relative p-1.5 rounded transition-all shrink-0',
              'opacity-0 group-hover:opacity-100',
              'text-subtle hover:text-text hover:bg-overlay cursor-pointer',
            )}
          >
            <Settings2 size={12} />
            {collection.auth && collection.auth.type !== 'none' && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        </CollectionAuthModal>

        <button
          onClick={handleExport}
          disabled={isExporting}
          title="Export collection"
          className={cn(
            'p-1.5 rounded transition-all shrink-0',
            'opacity-0 group-hover:opacity-100',
            'text-subtle hover:text-text hover:bg-overlay cursor-pointer',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
        >
          {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isDeleting}
          title="Delete collection"
          className={cn(
            'p-1.5 mr-1 rounded transition-all shrink-0',
            'opacity-0 group-hover:opacity-100',
            'text-subtle hover:text-status-5xx hover:bg-red-950/40 cursor-pointer',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
        >
          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>

        <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
            <Dialog.Content className={cn(
              'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-sm bg-elevated border border-border rounded-lg shadow-2xl',
              'p-5 focus:outline-none',
            )}>
              <div className="flex items-center justify-between mb-3">
                <Dialog.Title className="text-sm font-semibold text-text">Delete collection</Dialog.Title>
                <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors cursor-pointer">
                  <X size={14} />
                </Dialog.Close>
              </div>
              <Dialog.Description className="text-xs text-muted mb-5">
                {isLast
                  ? <>You must have at least one collection. Create another before deleting <span className="text-text font-medium">{collection.name}</span>.</>
                  : requests.length > 0
                    ? <>Delete <span className="text-text font-medium">{collection.name}</span> and its <span className="text-text font-medium">{requests.length} request{requests.length !== 1 ? 's' : ''}</span>? This cannot be undone.</>
                    : <>Delete <span className="text-text font-medium">{collection.name}</span>? This cannot be undone.</>
                }
              </Dialog.Description>
              <div className="flex justify-end gap-2">
                <Dialog.Close className="px-3 py-1.5 text-xs rounded text-muted hover:text-text hover:bg-overlay transition-colors cursor-pointer">
                  {isLast ? 'OK' : 'Cancel'}
                </Dialog.Close>
                {!isLast && (
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                      'bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    {isDeleting && <Loader2 size={11} className="animate-spin" />}
                    Delete
                  </button>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <Collapsible.Content>
        {matchingRequests.length === 0
          ? <p className="px-8 py-1 text-xs text-subtle italic">{q ? 'No matches' : 'No requests'}</p>
          : (
            // SortableContext tells dnd-kit the order of requests in this collection.
            // The DndContext itself lives in the parent Sidebar — this enables cross-collection dragging.
            <SortableContext items={matchingRequests.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {matchingRequests.map((req) => (
                <SortableRequestItem
                  key={req.id}
                  req={req}
                  collectionId={collection.id}
                  activeRequestId={activeRequestId}
                  isDirty={isDirty}
                  search={search}
                  showDragHandle={showDragHandle}
                  onRequestSelect={onRequestSelect}
                  onRequestSend={onRequestSend}
                  onDuplicateRequest={(id) => duplicateRequest(id, {
                    onError: () => toast('Failed to duplicate request. Please try again.'),
                  })}
                  onDeleteRequest={(id) => deleteRequest(id, {
                    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to delete request. Please try again.'),
                  })}
                  isDeletingRequest={isDeletingRequest}
                />
              ))}
            </SortableContext>
          )
        }
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

// ─── Sortable collection item ─────────────────────────────────────────────────

function SortableCollectionItem({
  collection,
  isLast,
  search,
  activeRequestId,
  isDirty,
  envVariables,
  onRequestSelect,
  onRequestSend,
  onPin,
}: {
  collection: Collection
  isLast: boolean
  search: string
  activeRequestId?: string
  isDirty?: boolean
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
  onPin: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: collection.id, data: { type: 'collection' } })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}>
      <CollectionItem
        collection={collection}
        isLast={isLast}
        search={search}
        activeRequestId={activeRequestId}
        isDirty={isDirty}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        envVariables={envVariables}
        onRequestSelect={onRequestSelect}
        onRequestSend={onRequestSend}
        onPin={onPin}
      />
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
//
// A single DndContext covers both collections and requests. This is what makes
// cross-collection request dragging possible — dnd-kit can detect when a request
// is dragged over a different collection's SortableContext.

interface SidebarProps {
  activeRequestId?: string
  activeDraftId?: string | null
  isDirty?: boolean
  newDrafts?: NewDraft[]
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
  onHistorySelect: (id: string) => void
  onDraftSelect?: (id: string) => void
  onDraftDiscard?: (id: string) => void
}

export function Sidebar({ activeRequestId, activeDraftId, isDirty, newDrafts = [], envVariables, onRequestSelect, onRequestSend, onHistorySelect, onDraftSelect, onDraftDiscard }: SidebarProps) {
  const [view, setView] = useState<'collections' | 'history'>('collections')
  const [search, setSearch] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { data: collections = [], isLoading, isError } = useCollections()
  const { mutate: reorderCollections } = useReorderCollections()
  const { mutate: reorderRequests } = useReorderRequests()
  const { mutate: moveRequest } = useMoveRequest()
  const { mutate: pinCollection } = usePinCollection()
  const queryClient = useQueryClient()

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
        toast('Invalid collection export file.')
        return
      }
      const root = data as Record<string, unknown>
      if ('environment' in root) {
        toast('This looks like an environment export. Please use the import option in the Environments dialog.')
        return
      }
      if (
        !('collection' in root) ||
        typeof root.collection !== 'object' ||
        root.collection === null
      ) {
        toast('Invalid collection export file.')
        return
      }

      const col = (data as Record<string, unknown>).collection as Record<string, unknown>

      if (typeof col.name !== 'string' || !col.name.trim()) {
        toast('Invalid export file: missing collection name.')
        return
      }
      if (!Array.isArray(col.requests)) {
        toast('Invalid export file: missing requests array.')
        return
      }

      const { name, description, auth, requests } = col as {
        name: string
        description?: string
        auth?: unknown
        requests: unknown[]
      }

      for (let i = 0; i < requests.length; i++) {
        const r = requests[i] as Record<string, unknown>
        if (typeof r.name !== 'string' || !r.name.trim()) {
          toast(`Invalid export file: request ${i + 1} is missing a name.`)
          return
        }
        if (typeof r.method !== 'string' || !r.method.trim()) {
          toast(`Invalid export file: request "${r.name}" is missing a method.`)
          return
        }
        if (typeof r.url !== 'string' || !r.url.trim()) {
          toast(`Invalid export file: request "${r.name}" is missing a URL.`)
          return
        }
        const urlStr = (r.url as string).trim()
        if (!/^https?:\/\/.+/i.test(urlStr) && !urlStr.startsWith('{{')) {
          toast(`Invalid export file: request "${r.name as string}" has an invalid URL.`)
          return
        }
      }

      if (collections.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
        toast(`A collection named "${name}" already exists.`)
        return
      }

      const created = await api.createCollection(name.trim(), typeof description === 'string' ? description : '')
      if (auth && typeof auth === 'object') {
        await api.updateCollectionAuth(created.id, auth as never)
      }
      for (const req of requests) {
        const r = req as Record<string, unknown>
        await api.createRequest({
          collectionId: created.id,
          name: r.name as string,
          method: r.method as string,
          url: r.url as string,
          queryParams: Array.isArray(r.queryParams) ? r.queryParams : [],
          headers: Array.isArray(r.headers) ? r.headers : [],
          body: typeof r.body === 'string' ? r.body : undefined,
          bodyType: typeof r.bodyType === 'string' ? r.bodyType : 'NONE',
          auth: r.auth && typeof r.auth === 'object' ? r.auth as never : null,
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['collections'] })
      toast(`Imported "${name}" with ${requests.length} request${requests.length !== 1 ? 's' : ''}.`, 'success')
    } catch {
      toast('Failed to import collection. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const pinnedCollections = collections.filter((c) => c.pinned)
  const unpinnedCollections = collections.filter((c) => !c.pinned)

  const isDraggingDisabled = search !== ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || isDraggingDisabled) return

    const activeType = active.data.current?.type as string | undefined
    const overType = over.data.current?.type as string | undefined

    // ── Collection reorder (within same pinned/unpinned group) ────────────
    if (activeType === 'collection' && overType === 'collection') {
      const activeIsPinned = collections.find((c) => c.id === active.id)?.pinned ?? false
      const overIsPinned = collections.find((c) => c.id === over.id)?.pinned ?? false
      // Only reorder within the same group
      if (activeIsPinned !== overIsPinned) return

      const group = activeIsPinned ? pinnedCollections : unpinnedCollections
      const oldIndex = group.findIndex((c) => c.id === active.id)
      const newIndex = group.findIndex((c) => c.id === over.id)
      const reorderedGroup = arrayMove(group, oldIndex, newIndex)
      const otherGroup = activeIsPinned ? unpinnedCollections : pinnedCollections
      // Preserve global order: pinned first, then unpinned
      const reordered = activeIsPinned
        ? [...reorderedGroup, ...otherGroup]
        : [...otherGroup, ...reorderedGroup]

      const cached = queryClient.getQueryData<PageResponse<Collection>>(['collections'])
      if (cached) queryClient.setQueryData(['collections'], { ...cached, data: reordered })

      reorderCollections(reordered.map((c) => c.id), {
        onError: () => {
          if (cached) queryClient.setQueryData(['collections'], cached)
          toast('Failed to save collection order.')
        },
      })
      return
    }

    // ── Request drag ───────────────────────────────────────────────────────
    if (activeType === 'request') {
      const fromCollectionId = active.data.current?.collectionId as string | undefined

      // Determine target collection:
      //   - Dropped on a request → use that request's collectionId
      //   - Dropped on a collection header → use the collection's id
      const toCollectionId = overType === 'collection'
        ? (over.id as string)
        : (over.data.current?.collectionId as string | undefined)

      if (!fromCollectionId || !toCollectionId) return

      if (fromCollectionId === toCollectionId) {
        // ── Within-collection reorder ──────────────────────────────────────
        const cached = queryClient.getQueryData<PageResponse<SavedRequest>>(['requests', fromCollectionId])
        if (!cached) return
        const reqs = cached.data
        const oldIndex = reqs.findIndex((r) => r.id === active.id)
        const newIndex = reqs.findIndex((r) => r.id === over.id)
        const reordered = arrayMove(reqs, oldIndex, newIndex)

        // Optimistic update
        queryClient.setQueryData(['requests', fromCollectionId], { ...cached, data: reordered })
        reorderRequests({ collectionId: fromCollectionId, ids: reordered.map((r) => r.id) }, {
          onError: () => {
            queryClient.setQueryData(['requests', fromCollectionId], cached)
            toast('Failed to save request order.')
          },
        })
      } else {
        // ── Cross-collection move ──────────────────────────────────────────
        moveRequest({ id: active.id as string, collectionId: toCollectionId }, {
          onError: () => toast('Failed to move request. Please try again.'),
        })
      }
    }
  }

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-border bg-elevated overflow-hidden">
      {/* View tabs */}
      <div className="flex shrink-0 border-b border-border">
        {(['collections', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors cursor-pointer',
              view === v
                ? 'text-text border-b-2 border-accent -mb-px'
                : 'text-subtle hover:text-muted',
            )}
          >
            {v === 'collections' ? 'Collections' : 'History'}
          </button>
        ))}
      </div>

      {view === 'history' && <HistoryPanel onHistorySelect={onHistorySelect} />}

      {view === 'collections' && <>
        {/* Search */}
        <div className="px-2 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-base rounded border border-border focus-within:border-accent transition-colors">
            <Search size={11} className="text-subtle shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-text placeholder:text-subtle outline-none min-w-0"
            />
          </div>
        </div>

        {/* Drafts section */}
        {newDrafts.length > 0 && !search && (
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center px-3 py-1.5">
              <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Drafts</span>
            </div>
            <div className="px-1.5 pb-1.5 space-y-0.5">
              {newDrafts.map((draft) => {
                const isActive = draft.id === activeDraftId
                const displayUrl = draft.url && draft.url !== 'https://' ? draft.url.split('?')[0] : 'New request'
                return (
                  <div
                    key={draft.id}
                    className={cn(
                      'flex items-center group rounded-sm transition-colors',
                      isActive ? 'bg-accent/10' : 'hover:bg-overlay',
                    )}
                  >
                    <button
                      onClick={() => onDraftSelect?.(draft.id)}
                      className={cn(
                        'flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 text-xs transition-colors',
                        isActive ? 'text-text' : 'text-muted group-hover:text-text',
                      )}
                    >
                      <MethodBadge method={draft.method} />
                      <span className="truncate italic">{displayUrl}</span>
                    </button>
                    <button
                      onClick={() => onDraftDiscard?.(draft.id)}
                      title="Discard draft"
                      className={cn(
                        'p-1.5 mr-1 rounded transition-all shrink-0',
                        'opacity-0 group-hover:opacity-100',
                        'text-subtle hover:text-status-5xx hover:bg-red-950/40 cursor-pointer',
                      )}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Collections header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Collections</span>
          <div className="flex items-center gap-1">
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
              title="Import collection"
              className="p-0.5 rounded hover:bg-overlay text-subtle hover:text-text transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImporting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            </button>
            <CreateCollectionDialog>
              <button className="p-0.5 rounded hover:bg-overlay text-subtle hover:text-text transition-colors cursor-pointer" title="New collection">
                <Plus size={12} />
              </button>
            </CreateCollectionDialog>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-xs text-subtle gap-2">
            <Loader2 size={13} className="animate-spin" />
            Loading…
          </div>
        )}
        {isError && (
          <p className="px-2 py-4 text-xs text-status-5xx text-center">Failed to load</p>
        )}
        {!isLoading && !isError && collections.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <FileCode2 size={18} className="text-subtle" />
            <p className="text-xs text-subtle">No collections yet</p>
          </div>
        )}

        {/* Pinned collections */}
        {!isLoading && !isError && pinnedCollections.length > 0 && !search && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pinnedCollections.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {pinnedCollections.map((col) => (
                <SortableCollectionItem
                  key={col.id}
                  collection={col}
                  isLast={collections.length === 1}
                  search={search}
                  activeRequestId={activeRequestId}
                  isDirty={isDirty}
                  envVariables={envVariables}
                  onRequestSelect={onRequestSelect}
                  onRequestSend={onRequestSend}
                  onPin={pinCollection}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Unpinned collections */}
        {!isLoading && !isError && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={unpinnedCollections.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {(search ? collections : unpinnedCollections).map((col) => (
                <SortableCollectionItem
                  key={col.id}
                  collection={col}
                  isLast={collections.length === 1}
                  search={search}
                  activeRequestId={activeRequestId}
                  isDirty={isDirty}
                  envVariables={envVariables}
                  onRequestSelect={onRequestSelect}
                  onRequestSend={onRequestSend}
                  onPin={pinCollection}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        </div>
      </>}
    </aside>
  )
}
