import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/apiClient'
import type { AuthConfig, ResponseExtraction } from '../types/api'

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => api.listCollections(),
    select: (data) => data.data,
  })
}

export function useReorderCollections() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.reorderCollections(ids),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['collections'] }),
  })
}

export function useReorderRequests() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, ids }: { collectionId: string; ids: string[] }) =>
      api.reorderRequests(collectionId, ids),
    onSuccess: (_, { collectionId }) =>
      queryClient.refetchQueries({ queryKey: ['requests', collectionId] }),
  })
}

export function useMoveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, collectionId }: { id: string; collectionId: string }) =>
      api.moveRequest(id, collectionId),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['requests'] }),
  })
}

export function useDuplicateRequest(collectionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.duplicateRequest(id),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['requests', collectionId] }),
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['collections'] }),
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      api.createCollection(name, description),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['collections'] }),
  })
}

export function useRequests(collectionId: string) {
  return useQuery({
    queryKey: ['requests', collectionId],
    queryFn: () => api.listRequests(collectionId),
    select: (data) => data.data,
    enabled: !!collectionId,
  })
}

export function useUpdateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; collectionId: string; name: string; method: string; url: string; queryParams: Array<{ key: string; value: string; enabled: boolean }>; headers: Array<{ key: string; value: string; enabled: boolean }>; body?: string; bodyType: string; auth?: AuthConfig | null; responseExtractions?: ResponseExtraction[] }) =>
      api.updateRequest(id, body),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['requests'] }),
  })
}

export function useDeleteRequest(collectionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteRequest(id),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['requests', collectionId] }),
  })
}

export function useSaveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createRequest,
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['requests'] }),
  })
}

export function useUpdateCollectionAuth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, auth }: { id: string; auth: AuthConfig | null }) =>
      api.updateCollectionAuth(id, auth),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['collections'] }),
  })
}

export function usePinCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.pinCollection(id),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['collections'] }),
  })
}
