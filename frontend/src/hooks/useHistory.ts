import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/apiClient'

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => api.listHistory(),
    select: (data) => data.data,
    staleTime: 0,
  })
}

export function useClearHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.clearHistory(),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['history'] }),
  })
}
