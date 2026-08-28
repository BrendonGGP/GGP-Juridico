/**
 * Ícones de traço fino, como o manual da marca especifica ("sóbrios,
 * elegantes, minimalistas"). Sem preenchimento, sem emoji.
 *
 * São decorativos: sempre acompanham um rótulo em texto, então recebem
 * aria-hidden. Ícone sozinho nunca comunica significado neste sistema.
 */

type Props = { className?: string }

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconePainel({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

export function IconeVisaoExecutiva({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  )
}

export function IconeRelatorio({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

export function IconeImportacao({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
    </svg>
  )
}

export function IconeBusca({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function IconeAtencao({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l9.5 16.5H2.5z" />
      <path d="M12 9v5M12 17.5h.01" />
    </svg>
  )
}

export function IconeBaixar({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
    </svg>
  )
}

export function IconeSeta({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
