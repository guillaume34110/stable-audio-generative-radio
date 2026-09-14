import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GenerativeRadioPage } from './GenerativeRadioPage'

describe('GenerativeRadioPage', () => {
  it('keeps the radio on its own standalone page shell', () => {
    const onBack = vi.fn()

    render(<GenerativeRadioPage onBack={onBack} />)

    expect(screen.getByTestId('generative-radio-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'radio.studio' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Modèles installés' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ENGINE' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retourner au player' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
