import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/apiClient'
import type { EnvironmentDetail, EnvironmentSummary, PageResponse } from '../types/api'

export function useEnvironments() {
  return useQuery({
    queryKey: ['environments'],
    queryFn: () => api.listEnvironments(),
    select: (data) => data.data,
  })
}

export function useEnvironmentDetail(id: string | null) {
  return useQuery({
    queryKey: ['environment', id],
    queryFn: () => api.getEnvironment(id!),
    enabled: id !== null,
  })
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.createEnvironment(name),
    onSuccess: (created) => {
      // Insert immediately so the list updates without waiting for a refetch
      queryClient.setQueryData<PageResponse<EnvironmentSummary>>(['environments'], (old) => {
        const summary: EnvironmentSummary = {
          id: created.id,
          name: created.name,
          variableCount: 0,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        }
        if (!old) return { data: [summary], pagination: { page: 1, pageSize: 100, totalElements: 1, totalPages: 1 } }
        return {
          ...old,
          data: [...old.data, summary],
          pagination: { ...old.pagination, totalElements: old.pagination.totalElements + 1 },
        }
      })
    },
  })
}

export function useDeleteEnvironment(onDeleted?: (id: string) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteEnvironment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.removeQueries({ queryKey: ['environment', id] })
      onDeleted?.(id)
    },
  })
}

export function useBulkUpdateVariables() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, variables }: { id: string; variables: EnvironmentDetail['variables'] }) =>
      api.bulkUpdateVariables(
        id,
        variables.map((v) => ({
          id: v.id,
          key: v.key,
          value: v.value ?? '__UNCHANGED__',
          isSecret: v.isSecret,
        })),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['environment', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      // Invalidate so all subscribers (including App.tsx's useEnvironmentDetail) refetch
      queryClient.invalidateQueries({ queryKey: ['environment', data.id] })
    },
  })
}
