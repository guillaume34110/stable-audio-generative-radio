import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GenerativeRadioPage } from './GenerativeRadioPage'

describe('GenerativeRadioPage', () => {
  it('keeps the radio on its own standalone page shell', () => {
    const onBack = vi.fn()

    render(<GenerativeRadioPage onBack={onBack} />)

    expect(screen.getByTestId('generative-radio-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'À ton rythme.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }))
    fireEvent.click(screen.getByRole('button', { name: 'Le moteur' }))
    expect(screen.getByRole('link', { name: /Looking for a model\?/i })).toHaveAttribute('href', 'https://huggingface.co/stabilityai/stable-audio-3-medium')
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la radio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retourner au player' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
