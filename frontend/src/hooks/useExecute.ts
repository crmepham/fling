import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/apiClient'
import { useRequestStore } from '../store/requestStore'

export function useExecute() {
  const { method, url, params, headers, body, bodyType, selectedEnvironmentId, setResponse, setExecuting } =
    useRequestStore()

  return useMutation({
    mutationFn: () =>
      api.execute({
        environmentId: selectedEnvironmentId ?? undefined,
        method,
        url,
        queryParams: params
          .filter((p) => p.key.trim() !== '')
          .map(({ key, value, enabled }) => ({ key, value, enabled })),
        headers: headers
          .filter((h) => h.key.trim() !== '')
          .map(({ key, value, enabled }) => ({ key, value, enabled })),
        body: body || undefined,
        bodyType,
      }),
    onMutate: () => setExecuting(true),
    onSettled: () => setExecuting(false),
    onSuccess: (data) => setResponse(data),
  })
}
