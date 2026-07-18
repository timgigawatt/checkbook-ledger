import type { ReactNode } from 'react'

export function Switch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

export function FieldRow({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <button className="field-row" onClick={onClick}>
        <div className="label">{label}</div>
        <div className="value">{children}</div>
      </button>
    )
  }
  return (
    <div className="field-row">
      <div className="label">{label}</div>
      {children}
    </div>
  )
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet">{children}</div>
    </div>
  )
}

export function SheetHeader({
  title,
  left,
  right,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <div
      style={{
        padding: '16px 16px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: 17, color: 'var(--accent)', minWidth: 60, textAlign: 'left' }}>
        {left}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--accent)',
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {right}
      </div>
    </div>
  )
}
