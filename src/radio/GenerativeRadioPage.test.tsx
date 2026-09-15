import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerativeRadioPage } from './GenerativeRadioPage'
import type { StableAudioRadioRequest } from './stable-audio-radio-api'

describe('GenerativeRadioPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

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
  it.each([
    { model: 'small', direction: 'An instrumental rock quartet, bright guitars, steady drums.\nQuiet verses, wide choruses.', phases: [], negative: 'Clipping, speech.\nHarsh distortion.' },
    { model: 'medium', direction: 'TrackType: Instrument\nFormat: Duo\nA piano and cello duet, soft and expressive.', phases: ['Intro', 'Verse', 'Chorus', 'Chorus', 'Outro'], negative: '' },
    { model: 'large', direction: 'TrackType: SFX\nOne wooden door closes, followed by a short room echo.', phases: [], negative: 'Music, speech' },
  ])('passes intact text and separate exclusions to the API for a $model catalog entry', async ({ model, direction, phases, negative }) => {
    // Exercise the real page and HTTP serialization with a simulated engine.
    // This verifies the client contract, not model availability or audio quality.
    window.localStorage.setItem('onus-local-engine-token', 'test-pairing')
    window.localStorage.setItem('onus-generative-radio-keywords', direction)
    window.localStorage.setItem('onus-generative-radio-negative-prompt', negative)
    window.localStorage.setItem('onus-generative-radio-phases', JSON.stringify(phases))
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-audio') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    const sent: StableAudioRadioRequest[] = []
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, window.location.origin).pathname
      if (path.endsWith('/health')) return json({ status: 'ok' })
      if (path.endsWith('/sfts')) return json({ runtime_ready: true, sfts: [{
        id: 'installed-model', filename: 'custom.safetensors', size_bytes: 1024,
        created_at: '2026-09-15', format: 'safetensors', base_model: `stable-audio-3-${model}`,
      }], model_variants: [] })
      if (path.endsWith('/generations') && init?.method === 'POST') {
        sent.push(JSON.parse(init.body as string) as StableAudioRadioRequest)
        return json({ generation_id: `job-${sent.length}`, status: 'pending' })
      }
      if (path.endsWith('/audio')) return new Response('test audio bytes', { headers: { 'content-type': 'audio/wav' } })
      if (/\/generations\/job-\d+$/.test(path)) return json({ generation_id: path.split('/').pop(), status: 'completed', audio_url: '/audio', duration_seconds: 240 })
      throw new Error(`Unexpected request: ${path}`)
    }))
    render(<GenerativeRadioPage />)
    const start = await screen.findByRole('button', { name: 'Démarrer la radio' })
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '90' } })
    fireEvent.click(start)
    await waitFor(() => expect(sent.length, screen.getByLabelText('État de la radio').textContent ?? '').toBe(2))
    await waitFor(() => expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY'))
    const expectedPrompt = phases.length ? `${direction}\nThe arrangement moves through Intro, then Verse, then Chorus, then Chorus, then Outro.` : direction
    for (const request of sent) {
      expect(request.prompt).toBe(expectedPrompt)
      expect(request.negative_prompt).toBe(negative)
      expect(request.bpm).toBe(90)
      expect(request.sft_id).toBe('installed-model')
      expect(request.model_variant).toBe('fp16')
    }
    expect(sent[1]!.continuation_from_generation_id).toBe('job-1')
  })

})
