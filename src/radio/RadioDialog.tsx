import { useEffect, useRef, type ReactNode } from 'react'

/** Native top-layer dialog: keyboard containment, Escape and focus restoration. */
export function RadioDialog({ open, onClose, title, children, wide = false }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

  return <dialog ref={ref} className={`radio-dialog ${wide ? 'is-wide' : ''}`} aria-label={title}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="radio-dialog-surface">
      <header className="radio-dialog-heading"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`Fermer ${title.toLowerCase()}`}>×</button></header>
      {children}
    </div>
  </dialog>
}
