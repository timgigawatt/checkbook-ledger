import { CheckIcon } from './icons'

type DiscState = 'uncleared' | 'cleared' | 'selected'

/**
 * The cleared indicator from the design system: solid accent disc with a
 * check when cleared, dashed ring when outstanding, outlined ring with an
 * accent check while selected in batch mode. 44px hit area around a 28px disc.
 */
export function ClearedDisc({
  state,
  onClick,
  label,
}: {
  state: DiscState
  onClick?: () => void
  label?: string
}) {
  const disc =
    state === 'cleared' ? (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckIcon color="var(--check-on-disc)" />
      </div>
    ) : state === 'selected' ? (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid var(--accent)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckIcon color="var(--accent)" />
      </div>
    ) : (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px dashed var(--dashed-ring)',
          boxSizing: 'border-box',
        }}
      />
    )

  if (!onClick) return <div className="disc-wrap">{disc}</div>
  return (
    <button className="disc-wrap" onClick={onClick} aria-label={label ?? 'Toggle cleared'}>
      {disc}
    </button>
  )
}
