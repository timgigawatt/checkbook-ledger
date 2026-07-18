export function CheckIcon({ size = 13, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={(size * 10) / 13} viewBox="0 0 13 10">
      <path
        d="M1 5L4.8 8.8L12 1.2"
        stroke={color}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TransferIcon({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={(size * 11) / 13} viewBox="0 0 13 11">
      <path
        d="M1 3H12M12 3L9.5 1M12 3L9.5 5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8H1M1 8L3.5 6M1 8L3.5 10"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PlusIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22">
      <path d="M11 2V20M2 11H20" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronDown({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6">
      <path
        d="M1 1L5 5L9 1"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronRight({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12">
      <path
        d="M1 1L6 6L1 11"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SearchIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15">
      <circle cx="6.5" cy="6.5" r="5" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M10.5 10.5L14 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ReconcileIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="1.6" fill="none" />
      <path
        d="M4.4 7L6.3 8.9L9.8 5.2"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
