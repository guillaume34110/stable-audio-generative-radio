import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerativeRadio } from './GenerativeRadio'

describe('GenerativeRadio', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:model') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('renders the compact radio recipe and live buffer', () => {
    render(<GenerativeRadio />)

    expect(screen.getByTestId('generative-radio')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Façonne ta radio' })).toBeInTheDocument()
    expect(screen.getByText('00:00 PRÊT')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Mots-clés/ })).toHaveValue('minimal, minimal techno')
    expect(screen.getByRole('slider', { name: /Influence SFT/ })).toHaveValue('100')
  })

  it('imports a valid Stable Audio 3 SFT without exposing the local file path', async () => {
    const adapter = {
      id: 'a'.repeat(32),
      filename: 'my-style.safetensors',
      size_bytes: 1024,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    const onImportModel = vi.fn().mockResolvedValue(adapter)
    render(<GenerativeRadio onImportModel={onImportModel} />)
    const file = new File(['weights'], 'my-style.safetensors', { type: 'application/octet-stream' })

    fireEvent.change(screen.getByLabelText('Charger un SFT Stable Audio 3'), { target: { files: [file] } })

    await waitFor(() => expect(onImportModel).toHaveBeenCalledWith(file))
    expect(await screen.findByText('my-style.safetensors', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer le SFT sélectionné' })).toBeInTheDocument()
    expect(screen.queryByText('/Users/')).not.toBeInTheDocument()
  })

  it('sends one long recipe for the current programme', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ audioUrl: 'blob:audio', id: 'a'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: 'b'.repeat(32),
      filename: 'radio.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    fireEvent.change(screen.getByRole('textbox', { name: /Mots-clés/ }), { target: { value: 'dusty drums, warm tape' } })
    fireEvent.change(screen.getByLabelText(/Tempo de base/), { target: { value: '132' } })
    fireEvent.click(screen.getByRole('button', { name: '✦ GÉNÉRER LE PROGRAMME' }))

    await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      keywords: 'dusty drums, warm tape',
      bpm: 132,
      drift: 26,
      energy: 62,
      texture: 48,
      evolution: 'fluid',
      durationSeconds: 330,
      loraStrength: 1,
      sftFile: null,
      sftId: selectedModel.id,
    }), expect.any(Function)))
    expect(await screen.findByText(/Programme prêt|Morceau indépendant prêt/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'dusty drums Drift' })).toBeInTheDocument()
  })

  it('keeps an unlimited user tag pool and samples only user tags per generation', async () => {
    const userTags = [
      'minimal techno',
      'dry kick',
      'metallic hats',
      'sub bass',
      'warehouse reverb',
      'tape saturation',
      'rolling groove',
      'night drive',
      'neon tension',
      'slow filter motion',
    ]
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:pool-first', id: '1'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:pool-second', id: '2'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: '3'.repeat(32),
      filename: 'radio.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    fireEvent.change(screen.getByRole('textbox', { name: /Mots-clés/ }), { target: { value: userTags.join(', ') } })
    expect(screen.getByText('10 TAGS')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✦ GÉNÉRER LE PROGRAMME' }))

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

    const pool = new Set(userTags)
    const requests = onGenerate.mock.calls.map(([request]) => request)
    for (const request of requests) {
      const selectedTags = request.keywords.split(',').map((tag: string) => tag.trim()).filter(Boolean)
      expect(selectedTags.length).toBeGreaterThanOrEqual(2)
      expect(selectedTags.length).toBeLessThan(userTags.length)
      expect(selectedTags.every((tag: string) => pool.has(tag))).toBe(true)
    }
    expect(requests[1]!.keywords).not.toBe(requests[0]!.keywords)
    expect(screen.getByText('6/10 TAGS')).toBeInTheDocument()
  })

  it('exposes the real-time pro monitoring controls without changing the generated recipe', () => {
    render(<GenerativeRadio />)

    expect(screen.getByTestId('radio-dsp-panel')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /DSP PRO \/ MONITORING/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /LIMITER INTELLIGENT/ })).toBeChecked()
    expect(screen.getByRole('slider', { name: /Préampli/ })).toHaveValue('0')
    expect(screen.getByRole('slider', { name: /Filtre bruit/ })).toHaveValue('32')

    fireEvent.change(screen.getByRole('slider', { name: /Préampli/ }), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /LIMITER INTELLIGENT/ }))

    expect(screen.getByRole('slider', { name: /Préampli/ })).toHaveValue('4')
    expect(screen.getByRole('checkbox', { name: /LIMITER INTELLIGENT/ })).not.toBeChecked()
    expect(screen.getByRole('slider', { name: /Plafond/ })).toBeDisabled()
  })

  it('can launch the persisted Berlin INT8 variant without a second SFT upload', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ audioUrl: 'blob:int8', id: '8'.repeat(16), durationSeconds: 120 })
    const modelVariants = [
      {
        id: 'fp16' as const,
        label: 'FP16 · SFT importé',
        description: 'SFT choisi dans la page, précision native',
        available: true,
        bits: null,
        size_bytes: null,
        merged_sft: false,
        lora_strength: null,
      },
      {
        id: 'int8' as const,
        label: 'INT8 · Berlin SFT fusionné',
        description: 'DiT Medium quantifié INT8 · SFT Berlin intégré',
        available: true,
        bits: 8,
        size_bytes: 1_482_100_000,
        merged_sft: true,
        lora_strength: 0.25,
      },
      {
        id: 'int4' as const,
        label: 'INT4 · Berlin SFT fusionné',
        description: 'DiT Medium quantifié INT4 · SFT Berlin intégré',
        available: true,
        bits: 4,
        size_bytes: 794_100_000,
        merged_sft: true,
        lora_strength: 0.25,
      },
    ]
    render(<GenerativeRadio onGenerate={onGenerate} availableModelVariants={modelVariants} />)

    fireEvent.change(screen.getByLabelText(/Variante du modèle/), { target: { value: 'int8' } })
    expect(screen.getByText('INT8 · Berlin SFT fusionné', { selector: 'strong' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✦ GÉNÉRER LE PROGRAMME' }))

    await waitFor(() => expect(onGenerate).toHaveBeenCalled())
    expect(onGenerate.mock.calls[0]![0]).toEqual(expect.objectContaining({
      modelVariant: 'int8',
      sftId: null,
      sftFile: null,
      loraStrength: 0.25,
    }))
  })

  it('prepares a hidden independent programme from the finished programme and keeps one visible flow', async () => {
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:first', id: 'c'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:second', id: 'd'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:manual', id: 'f'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: 'e'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    fireEvent.change(screen.getByRole('textbox', { name: /Mots-clés/ }), { target: { value: 'user tag alpha, user tag beta' } })
    fireEvent.click(screen.getByRole('button', { name: '✦ GÉNÉRER LE PROGRAMME' }))
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('01 · FLUX ACTIF')).toHaveLength(1)
    const first = onGenerate.mock.calls[0]![0]
    const continuation = onGenerate.mock.calls[1]![0]
    expect(first.continuationFromId).toBeNull()
    expect(continuation.continuationFromId).toBe('c'.repeat(16))
    expect(continuation.keywords).toBe(first.keywords)
    expect(continuation.keywords.split(',').map((tag: string) => tag.trim())).toEqual(['user tag alpha', 'user tag beta'])
    expect(continuation.durationSeconds).toBeGreaterThanOrEqual(120)
    expect(continuation.durationSeconds).toBeLessThanOrEqual(360)
    expect(screen.getByRole('status')).toHaveTextContent('Morceau indépendant prêt')
    expect(screen.getByTestId('current-radio-track')).toHaveTextContent('01 · FLUX ACTIF')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('02 · UP NEXT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('user tag alpha Relay')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY / PRÊT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('PROMPT UTILISÉ · 2/2 TAGS')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(continuation.keywords)
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('DURÉE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('MODE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('INDÉPENDANT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('ÉVOLUTION')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('SFT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(String(continuation.seed))
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(continuation.modelVariant.toUpperCase())
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('GENERATION ID · ' + 'd'.repeat(16))

    fireEvent.click(screen.getByRole('button', { name: '✦ RÉGÉNÉRER LE PROGRAMME' }))
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))

    const manual = onGenerate.mock.calls[2]![0]
    expect(manual.continuationFromId).toBeNull()
    expect(manual.keywords.split(',').map((tag: string) => tag.trim()).filter(Boolean)).toEqual(['user tag alpha', 'user tag beta'])
    expect(manual.bpm).toBeGreaterThanOrEqual(60)
    expect(manual.bpm).toBeLessThanOrEqual(220)
    expect(manual.drift).toBeGreaterThanOrEqual(0)
    expect(manual.drift).toBeLessThanOrEqual(100)
    expect(manual.energy).toBeGreaterThanOrEqual(0)
    expect(manual.energy).toBeLessThanOrEqual(100)
    expect(manual.texture).toBeGreaterThanOrEqual(0)
    expect(manual.texture).toBeLessThanOrEqual(100)
    expect(manual.durationSeconds).toBeGreaterThanOrEqual(120)
    expect(manual.durationSeconds).toBeLessThanOrEqual(360)
    expect(manual.loraStrength).toBeGreaterThanOrEqual(0)
    expect(manual.loraStrength).toBeLessThanOrEqual(1)
    expect(manual.seed).toBeGreaterThanOrEqual(0)
  })

  it('keeps the form-owned error visible and focuses keywords when empty', () => {
    render(<GenerativeRadio />)
    const keywords = screen.getByRole('textbox', { name: /Mots-clés/ })
    fireEvent.change(keywords, { target: { value: '' } })
    fireEvent.submit(screen.getByTestId('radio-form'))

    expect(screen.getByRole('alert')).toHaveTextContent('Ajoute au moins un mot-clé')
    expect(keywords).toHaveAttribute('aria-invalid', 'true')
    expect(keywords).toHaveFocus()
  })
})
