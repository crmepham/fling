import { WandSparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

type BodyType = 'NONE' | 'JSON' | 'FORM' | 'TEXT'

const BODY_TYPES: BodyType[] = ['NONE', 'JSON', 'FORM', 'TEXT']

function parseJson(value: string): string | null {
  if (!value.trim()) return null
  try {
    JSON.parse(value)
    return null
  } catch (e) {
    return (e as SyntaxError).message
  }
}

interface Props {
  body: string
  bodyType: BodyType
  onBodyChange: (body: string) => void
  onBodyTypeChange: (type: BodyType) => void
}

export function BodyEditor({ body, bodyType, onBodyChange, onBodyTypeChange }: Props) {
  const jsonError = bodyType === 'JSON' ? parseJson(body) : null

  function handlePrettify() {
    try {
      onBodyChange(JSON.stringify(JSON.parse(body), null, 2))
    } catch {
      // invalid JSON — nothing to prettify
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Body type selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {BODY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onBodyTypeChange(type)}
            className={cn(
              'px-2.5 py-1 text-xs rounded font-medium transition-colors',
              bodyType === type
                ? 'bg-accent text-white'
                : 'text-muted hover:text-text hover:bg-overlay',
            )}
          >
            {type}
          </button>
        ))}

        {bodyType === 'JSON' && (
          <button
            onClick={handlePrettify}
            disabled={!!jsonError || !body.trim()}
            title="Prettify JSON"
            className={cn(
              'ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition-colors',
              'text-muted hover:text-text hover:bg-overlay',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            <WandSparkles size={11} />
            Prettify
          </button>
        )}
      </div>

      {/* Editor */}
      {bodyType === 'NONE' ? (
        <div className="flex-1 flex items-center justify-center text-xs text-subtle">
          No body
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={bodyType === 'JSON' ? '{\n  \n}' : ''}
            spellCheck={false}
            className={cn(
              'flex-1 w-full bg-transparent text-xs font-mono text-text',
              'p-3 resize-none outline-none placeholder:text-subtle',
            )}
          />
          {jsonError && (
            <div className="shrink-0 px-3 py-1.5 border-t border-red-900/50 bg-red-950/30 text-xs text-red-400 font-mono">
              {jsonError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
