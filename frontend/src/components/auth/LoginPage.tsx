import { useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api } from '../../lib/apiClient'

interface Props {
  onLogin: (username: string) => void
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.login(username.trim(), password)
      onLogin(res.username)
    } catch {
      setError('Invalid username or password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-base">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="#a855f7">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Fling</h1>
          <p className="mt-1 text-xs text-subtle">API client</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-elevated border border-border rounded-lg p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs text-subtle">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="admin"
              className={cn(
                'w-full bg-base border border-border rounded px-3 py-2',
                'text-sm text-text placeholder:text-subtle',
                'outline-none focus:ring-1 focus:ring-accent transition-colors',
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-subtle">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className={cn(
                'w-full bg-base border border-border rounded px-3 py-2',
                'text-sm text-text placeholder:text-subtle',
                'outline-none focus:ring-1 focus:ring-accent transition-colors',
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 rounded',
              'text-sm font-semibold transition-colors',
              'focus:outline-none disabled:cursor-not-allowed',
              isLoading || !username.trim() || !password
                ? 'bg-overlay text-subtle'
                : 'bg-accent text-white hover:bg-accent-dim',
            )}
          >
            <Send size={13} />
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
