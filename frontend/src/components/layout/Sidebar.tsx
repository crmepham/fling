import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, ChevronRight, FolderOpen, Folder, FileCode2, Plus, X, Loader2, Trash2, Play, Copy, GripVertical, Settings2 } from 'lucide-react'
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
  useDuplicateRequest, useMoveRequest, useRequests, useReorderCollections, useReorderRequests,
} from '../../hooks/useCollections'
import { api } from '../../lib/apiClient'
import type { Collection, PageResponse, SavedRequest } from '../../types/api'
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
            <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors">
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
              <Dialog.Close className="px-3 py-1.5 text-xs rounded text-muted hover:text-text hover:bg-overlay transition-colors">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || isDuplicate || isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                  'bg-accent text-white hover:bg-accent-dim transition-colors',
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
        className={cn(
          'flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 pl-8 text-xs transition-colors',
          isActive ? 'text-text' : 'text-muted group-hover:text-text',
        )}
      >
        <MethodBadge method={req.method} />
        <span className="truncate"><Highlight text={req.name} query={search} /></span>
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
  dragHandleProps,
  envVariables,
  onRequestSelect,
  onRequestSend,
}: {
  collection: Collection
  isLast: boolean
  search: string
  activeRequestId?: string
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
}) {
  const q = search.toLowerCase()
  const toast = useToast()
  const [open, setOpen] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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
          <button className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 text-xs font-medium text-muted group-hover:text-text transition-colors">
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
                <Dialog.Close className="p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-colors">
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
                <Dialog.Close className="px-3 py-1.5 text-xs rounded text-muted hover:text-text hover:bg-overlay transition-colors">
                  {isLast ? 'OK' : 'Cancel'}
                </Dialog.Close>
                {!isLast && (
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium',
                      'bg-red-600 text-white hover:bg-red-700 transition-colors',
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
                  search={search}
                  showDragHandle={showDragHandle}
                  onRequestSelect={onRequestSelect}
                  onRequestSend={onRequestSend}
                  onDuplicateRequest={(id) => duplicateRequest(id, {
                    onError: () => toast('Failed to duplicate request. Please try again.'),
                  })}
                  onDeleteRequest={(id) => deleteRequest(id, {
                    onError: () => toast('Failed to delete request. Please try again.'),
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
  envVariables,
  onRequestSelect,
  onRequestSend,
}: {
  collection: Collection
  isLast: boolean
  search: string
  activeRequestId?: string
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
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
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        envVariables={envVariables}
        onRequestSelect={onRequestSelect}
        onRequestSend={onRequestSend}
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
  envVariables: Record<string, string>
  onRequestSelect: (req: SavedRequest) => void
  onRequestSend: (req: SavedRequest) => void
  onHistorySelect: (id: string) => void
}

export function Sidebar({ activeRequestId, envVariables, onRequestSelect, onRequestSend, onHistorySelect }: SidebarProps) {
  const [view, setView] = useState<'collections' | 'history'>('collections')
  const [search, setSearch] = useState('')
  const toast = useToast()
  const { data: collections = [], isLoading, isError } = useCollections()
  const { mutate: reorderCollections } = useReorderCollections()
  const { mutate: reorderRequests } = useReorderRequests()
  const { mutate: moveRequest } = useMoveRequest()
  const queryClient = useQueryClient()

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

    // ── Collection reorder ─────────────────────────────────────────────────
    if (activeType === 'collection' && overType === 'collection') {
      const oldIndex = collections.findIndex((c) => c.id === active.id)
      const newIndex = collections.findIndex((c) => c.id === over.id)
      const reordered = arrayMove(collections, oldIndex, newIndex)

      // Optimistic update directly in the React Query cache
      const cached = queryClient.getQueryData<PageResponse<Collection>>(['collections'])
      if (cached) queryClient.setQueryData(['collections'], { ...cached, data: reordered })

      reorderCollections(reordered.map((c) => c.id), {
        onError: () => {
          // Roll back optimistic update
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
    <aside className="flex flex-col w-56 shrink-0 border-r border-border bg-elevated overflow-hidden">
      {/* View tabs */}
      <div className="flex shrink-0 border-b border-border">
        {(['collections', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors',
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

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest">Collections</span>
          <CreateCollectionDialog>
            <button className="p-0.5 rounded hover:bg-overlay text-subtle hover:text-text transition-colors" title="New collection">
              <Plus size={12} />
            </button>
          </CreateCollectionDialog>
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={collections.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {collections.map((col) => (
              <SortableCollectionItem
                key={col.id}
                collection={col}
                isLast={collections.length === 1}
                search={search}
                activeRequestId={activeRequestId}
                envVariables={envVariables}
                onRequestSelect={onRequestSelect}
                onRequestSend={onRequestSend}
              />
            ))}
          </SortableContext>
        </DndContext>
        </div>
      </>}
    </aside>
  )
}
