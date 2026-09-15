import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerativeRadio, RADIO_KEYWORDS_STORAGE_KEY, RADIO_NEGATIVE_PROMPT_STORAGE_KEY, RADIO_FIXED_TAGS_STORAGE_KEY, RADIO_SKIN_STORAGE_KEY } from './GenerativeRadio'

const startRadio = () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la radio' }))

describe('GenerativeRadio', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:model') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('shows the unified machine surface and its essential physical controls on first visit', () => {
    render(<GenerativeRadio />)

    expect(screen.getByTestId('generative-radio')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'radio.studio' })).toBeInTheDocument()
    expect(screen.getAllByRole('slider')).toHaveLength(17)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Variante du modèle' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Ta direction sonore/ })).toHaveValue('Instrumental music.')
    expect(screen.getByRole('slider', { name: /^Influence$/ })).toHaveValue('100')
  })

  it('downloads the active WAV without interrupting playback or starting another generation', async () => {
    const downloads: { href: string; filename: string }[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, filename: this.download })
    })
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:first-wav', id: 'first', title: 'Piano / nocturne', durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:second-wav', id: 'second', title: 'Next passage', durationSeconds: 240 })
      .mockImplementation(() => new Promise(() => {}))
    const selectedModel = {
      id: 'model', filename: 'radio.safetensors', size_bytes: 1024,
      created_at: '2026-09-15', format: 'safetensors' as const, base_model: 'stable-audio-3-medium',
    }
    try {
      render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)
      const download = screen.getByRole('button', { name: 'Télécharger le morceau en lecture' })
      expect(download).toBeDisabled()
      expect(download.textContent).toBe('')
      expect(within(screen.getByTestId('next-radio-track')).queryByRole('button', { name: /Télécharger/ })).not.toBeInTheDocument()
      startRadio()
      await waitFor(() => expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY'))
      pause.mockClear()
      fireEvent.click(download)
      expect(downloads).toEqual([{ href: 'blob:first-wav', filename: 'Piano - nocturne.wav' }])
      expect(pause).not.toHaveBeenCalled()
      expect(onGenerate).toHaveBeenCalledTimes(2)
      expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:first-wav')
      expect(document.querySelector('a[download]')).not.toBeInTheDocument()

      fireEvent.ended(document.querySelector('audio')!)
      await waitFor(() => expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:second-wav'))
      fireEvent.click(download)
      expect(downloads[1]).toEqual({ href: 'blob:second-wav', filename: 'Next passage.wav' })
      expect(onGenerate).toHaveBeenCalledTimes(3)
    } finally {
      click.mockRestore()
      pause.mockRestore()
    }
  })

  it('cycles the physical skin LED and remembers the selected finish', () => {
    render(<GenerativeRadio />)

    const machine = screen.getByTestId('generative-radio')
    const toggle = screen.getByRole('button', { name: 'Skin suivant' })
    const readout = screen.getByLabelText('Skin sélectionné')

    expect(machine).toHaveAttribute('data-skin', 'white')
    expect(readout).toHaveTextContent('01')
    expect(readout).not.toHaveTextContent('Polar')
    expect(within(screen.getByRole('group', { name: 'Skin de la machine' })).getByText('/ 12')).not.toHaveClass('machine-screen')

    fireEvent.click(toggle)
    expect(machine).toHaveAttribute('data-skin', 'ectoplasma')
    expect(readout).toHaveTextContent('02')
    expect(window.localStorage.getItem(RADIO_SKIN_STORAGE_KEY)).toBe('ectoplasma')

    for (let index = 0; index < 11; index += 1) fireEvent.click(toggle)
    expect(machine).toHaveAttribute('data-skin', 'white')
    expect(readout).toHaveTextContent('01')
    expect(window.localStorage.getItem(RADIO_SKIN_STORAGE_KEY)).toBe('white')
  })

  it('focuses inline model setup from the primary action without losing the written direction', () => {
    const onGenerate = vi.fn()
    render(<GenerativeRadio runtimeReady={false} onGenerate={onGenerate} />)
    const direction = screen.getByRole('textbox', { name: /Ta direction sonore/ })
    fireEvent.change(direction, { target: { value: 'soft piano, warm tape' } })
    fireEvent.click(screen.getByRole('button', { name: 'Configurer la radio' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Connecte le moteur local')
    expect(screen.getByRole('combobox', { name: 'Variante du modèle' })).toHaveFocus()
    expect(onGenerate).not.toHaveBeenCalled()
    expect(direction).toHaveValue('soft piano, warm tape')
  })

  it('keeps an invalid model import error visible on the machine', () => {
    render(<GenerativeRadio />)
    fireEvent.change(screen.getByLabelText('Charger un modèle Stable Audio 3'), {
      target: { files: [new File(['invalid'], 'notes.txt', { type: 'text/plain' })] },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('format .safetensors')
    expect(screen.getByTestId('generative-radio')).toContainElement(screen.getByRole('alert'))
  })

  it('reports reconnect failure and allows another attempt', async () => {
    const onReconnect = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
    render(<GenerativeRadio runtimeReady={false} onReconnect={onReconnect} />)
    fireEvent.click(screen.getByRole('button', { name: 'ENGINE' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible'))
    fireEvent.click(screen.getByRole('button', { name: 'ENGINE' }))
    await waitFor(() => expect(onReconnect).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reorders phases without dragging', () => {
    render(<GenerativeRadio />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Ajouter une phase' }), { target: { value: 'Intro' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Ajouter une phase' }), { target: { value: 'Drop' } })
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer la phase à gauche' }))
    expect(JSON.parse(window.localStorage.getItem('onus-generative-radio-phases') ?? '[]')).toEqual(['Drop', 'Intro'])
  })

  it('imports a valid Stable Audio 3 model without exposing the local file path', async () => {
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

    const modelInput = screen.getByLabelText('Charger un modèle Stable Audio 3') as HTMLInputElement
    fireEvent.change(modelInput, { target: { files: [file] } })

    await waitFor(() => expect(onImportModel).toHaveBeenCalledWith(file))
    expect(await screen.findByText('my-style.safetensors', { selector: 'option' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer le modèle sélectionné' })).toBeInTheDocument()
    expect(modelInput.value).toBe('')
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

    fireEvent.change(screen.getByRole('textbox', { name: /Ta direction sonore/ }), { target: { value: 'dusty drums, warm tape' } })
    fireEvent.change(screen.getByLabelText(/Tempo/), { target: { value: '132' } })
    startRadio()

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

  it('keeps the entire free-text prompt unchanged across successive generations', async () => {
    const direction = 'TrackType: Music\nGenre: Jazz\nA piano trio, upright bass, brushed drums.\nQuiet at first, then expressive; piano, piano. Preserve the space between notes.'
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:full-first', id: '1'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:full-second', id: '2'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:full-third', id: '3'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: '3'.repeat(32), filename: 'radio.safetensors', size_bytes: 2048,
      created_at: '2026-09-10T00:00:00', format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Ta direction sonore' }), { target: { value: direction } })
    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY'))
    fireEvent.ended(document.querySelector('audio')!)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))

    for (const [request] of onGenerate.mock.calls) {
      expect(request.keywords).toBe(direction)
      expect(request.bpm).toBe(124)
      expect(request.drift).toBe(26)
      expect(request).not.toHaveProperty('fixedTags')
    }
    expect(new Set(onGenerate.mock.calls.map(([request]) => request.seed)).size).toBe(3)
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue(direction)
  })

  it('migrates legacy pinned phrases into the visible prompt once', async () => {
    const direction = 'Piano, softly played.\nA bassoon answers the piano.'
    window.localStorage.setItem(RADIO_KEYWORDS_STORAGE_KEY, direction)
    window.localStorage.setItem(RADIO_FIXED_TAGS_STORAGE_KEY, JSON.stringify(['piano', 'Bass', 'Warm (tape)', 'Warm (tape)']))
    const expected = `${direction}\nBass\nWarm (tape)`
    const onGenerate = vi.fn().mockResolvedValue({ audioUrl: 'blob:full-prompt', id: 'migration', durationSeconds: 240 })
    const selectedModel = {
      id: 'm'.repeat(32), filename: 'radio.safetensors', size_bytes: 2048,
      created_at: '2026-09-10T00:00:00', format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    const { unmount } = render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue(expected)
    expect(window.localStorage.getItem(RADIO_KEYWORDS_STORAGE_KEY)).toBe(expected)
    expect(window.localStorage.getItem(RADIO_FIXED_TAGS_STORAGE_KEY)).toBeNull()
    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    for (const [request] of onGenerate.mock.calls) expect(request.keywords).toBe(expected)

    fireEvent.change(screen.getByRole('textbox', { name: 'Ta direction sonore' }), { target: { value: direction } })
    unmount()
    render(<GenerativeRadio />)
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue(direction)
  })

  it('exposes the real-time pro monitoring controls without changing the generated recipe', () => {
    render(<GenerativeRadio />)

    expect(screen.getByRole('region', { name: 'Égaliseur' })).toBeInTheDocument()
    const eqCurve = screen.getByRole('img', { name: 'Réponse des filtres audio' }).querySelector('.eq-curve')
    expect(eqCurve).toBeInTheDocument()
    const initialCurve = eqCurve?.getAttribute('d')
    expect(initialCurve).toBeTruthy()
    expect(screen.queryByText('EN ATTENTE AUDIO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^DSP/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^LIMITER/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: /^PREAMP$/ })).toHaveValue('0')
    expect(screen.getByRole('slider', { name: /^FILTER$/ })).toHaveValue('32')

    fireEvent.change(screen.getByRole('slider', { name: /^PREAMP$/ }), { target: { value: '4' } })
    fireEvent.change(screen.getByRole('slider', { name: /^LOW$/ }), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /^LIMITER/ }))

    expect(eqCurve?.getAttribute('d')).not.toBe(initialCurve)
    expect(screen.getByRole('slider', { name: /^PREAMP$/ })).toHaveValue('4')
    expect(screen.getByRole('button', { name: /^LIMITER/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('slider', { name: /^PLAFOND$/ })).toHaveValue('-1')
  })

  it('can launch the persisted Berlin INT8 variant without a second model upload', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ audioUrl: 'blob:int8', id: '8'.repeat(16), durationSeconds: 120 })
    const modelVariants = [
      {
        id: 'fp16' as const,
        label: 'FP16 · modèle importé',
        description: 'Modèle choisi dans la page, précision native',
        available: true,
        bits: null,
        size_bytes: null,
        merged_sft: false,
        lora_strength: null,
      },
      {
        id: 'int8' as const,
        label: 'INT8 · modèle Berlin fusionné',
        description: 'DiT Medium quantifié INT8 · modèle Berlin intégré',
        available: true,
        bits: 8,
        size_bytes: 1_482_100_000,
        merged_sft: true,
        lora_strength: 0.25,
      },
      {
        id: 'int4' as const,
        label: 'INT4 · modèle Berlin fusionné',
        description: 'DiT Medium quantifié INT4 · modèle Berlin intégré',
        available: true,
        bits: 4,
        size_bytes: 794_100_000,
        merged_sft: true,
        lora_strength: 0.25,
      },
    ]
    render(<GenerativeRadio onGenerate={onGenerate} availableModelVariants={modelVariants} />)

    fireEvent.change(screen.getByLabelText(/Variante du modèle/), { target: { value: 'int8' } })
    expect(screen.getByRole('combobox', { name: 'Variante du modèle' })).toHaveValue('int8')
    expect(screen.getByRole('slider', { name: 'Influence' })).toBeDisabled()
    startRadio()

    await waitFor(() => expect(onGenerate).toHaveBeenCalled())
    expect(onGenerate.mock.calls[0]![0]).toEqual(expect.objectContaining({
      modelVariant: 'int8',
      sftId: null,
      sftFile: null,
      loraStrength: 0.25,
    }))
  })

  it('prepares an independent programme and shows current and next metadata on the facade', async () => {
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

    fireEvent.change(screen.getByRole('textbox', { name: /Ta direction sonore/ }), { target: { value: 'user tag alpha, user tag beta' } })
    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('01 / NOW')).toHaveLength(1)
    const first = onGenerate.mock.calls[0]![0]
    const continuation = onGenerate.mock.calls[1]![0]
    expect(first.continuationFromId).toBeNull()
    expect(continuation.continuationFromId).toBe('c'.repeat(16))
    expect(continuation.keywords).toBe(first.keywords)
    expect(continuation.bpm).toBe(first.bpm)
    expect(continuation.drift).toBe(first.drift)
    expect(continuation.keywords.split(',').map((tag: string) => tag.trim())).toEqual(['user tag alpha', 'user tag beta'])
    expect(continuation.durationSeconds).toBeGreaterThanOrEqual(120)
    expect(continuation.durationSeconds).toBeLessThanOrEqual(360)
    expect(screen.getByRole('status', { name: 'État de la radio' })).toHaveTextContent('Morceau indépendant prêt')
    expect(screen.getByTestId('current-radio-track')).toHaveTextContent('01 / NOW')
    for (const label of ['TONALITÉ', 'BPM CIBLE', 'MODE', 'ÉVOLUTION', 'ÉNERGIE', 'TEXTURE', 'MODÈLE', 'SEED', 'PROMPT', 'STRUCT.']) {
      expect(screen.getByTestId('current-radio-track')).toHaveTextContent(label)
    }
    expect(screen.getByTestId('current-radio-track')).toHaveTextContent('CONTINU')
    expect(screen.getByTestId('current-radio-track')).toHaveTextContent(onGenerate.mock.calls[0]![0].keywords)
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('02 / NEXT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('user tag alpha Relay')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('PROMPT')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(continuation.keywords)
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('DURÉE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('MODE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('LIBRE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('ÉVOLUTION')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('MODÈLE')
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(String(continuation.seed))
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent(continuation.modelVariant.toUpperCase())

    fireEvent.click(screen.getByRole('button', { name: 'Repartir de cette direction ↗' }))
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

  it('reserves a new seed for every successive buffered programme', async () => {
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:seed-first', id: 'a'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:seed-second', id: 'b'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:seed-third', id: 'c'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: 'd'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

    const audio = document.querySelector('audio.radio-audio') as HTMLAudioElement
    expect(audio).toBeInTheDocument()
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
    fireEvent.ended(audio)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))

    const requests = onGenerate.mock.calls.map(([request]) => request as { seed?: number; continuationFromId?: string | null })
    expect(new Set(requests.map((request) => request.seed)).size).toBe(3)
    expect(requests[2]!.continuationFromId).toBe('b'.repeat(16))
  })

  it('keeps the form-owned error visible and focuses keywords when empty', () => {
    render(<GenerativeRadio />)
    const keywords = screen.getByRole('textbox', { name: /Ta direction sonore/ })
    fireEvent.change(keywords, { target: { value: '' } })
    fireEvent.submit(screen.getByTestId('radio-form'))

    expect(screen.getByRole('alert')).toHaveTextContent('Décris le son souhaité')
    expect(keywords).toHaveAttribute('aria-invalid', 'true')
    expect(keywords).toHaveFocus()
  })

  it('keeps the buffered next programme intact and applies edits after the handoff', async () => {
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:first-settings', id: '1'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:buffered-settings', id: '2'.repeat(16), durationSeconds: 240 })
      .mockResolvedValueOnce({ audioUrl: 'blob:updated-settings', id: '3'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: '4'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

    fireEvent.change(screen.getByLabelText(/Tempo/), { target: { value: '138' } })
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

    expect(onGenerate.mock.calls[1]![0]).toEqual(expect.objectContaining({
      bpm: 124,
      drift: 26,
      continuationFromId: '1'.repeat(16),
    }))
    expect(screen.getByTestId('next-radio-track')).toHaveTextContent('124')

    fireEvent.change(screen.getByRole('textbox', { name: /Ta direction sonore/ }), { target: { value: 'future pad, glass percussion' } })
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    expect(onGenerate.mock.calls[1]![0].keywords).not.toContain('future pad')

    const audio = document.querySelector('audio.radio-audio') as HTMLAudioElement
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
    fireEvent.ended(audio)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))
    expect(onGenerate.mock.calls[2]![0]).toEqual(expect.objectContaining({
      bpm: 138,
      drift: 26,
      keywords: 'future pad, glass percussion',
      continuationFromId: '2'.repeat(16),
    }))
  })

  it('lets an in-flight next programme finish before applying queued settings', async () => {
    const bufferedNext = { audioUrl: 'blob:buffered-in-flight', id: '6'.repeat(16), durationSeconds: 240 }
    let resolveBufferedNext!: (result: typeof bufferedNext) => void
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:first-in-flight', id: '5'.repeat(16), durationSeconds: 240 })
      .mockImplementationOnce(() => new Promise<typeof bufferedNext>((resolve) => { resolveBufferedNext = resolve }))
      .mockResolvedValueOnce({ audioUrl: 'blob:updated-in-flight', id: '7'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: '8'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText(/Tempo/), { target: { value: '140' } })
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    resolveBufferedNext(bufferedNext)

    await waitFor(() => expect(screen.getByTestId('next-radio-track')).toHaveTextContent('READY'))
    expect(onGenerate.mock.calls[1]![0]).toEqual(expect.objectContaining({
      bpm: 124,
      continuationFromId: '5'.repeat(16),
    }))

    const audio = document.querySelector('audio.radio-audio') as HTMLAudioElement
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
    fireEvent.ended(audio)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))
    expect(onGenerate.mock.calls[2]![0]).toEqual(expect.objectContaining({
      bpm: 140,
      continuationFromId: '6'.repeat(16),
    }))
  })

  it('resumes the radio automatically when the buffered programme finishes late', async () => {
    const bufferedNext = { audioUrl: 'blob:late-buffered', id: '9'.repeat(16), durationSeconds: 240 }
    let resolveBufferedNext!: (result: typeof bufferedNext) => void
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:late-first', id: '8'.repeat(16), durationSeconds: 240 })
      .mockImplementationOnce(() => new Promise<typeof bufferedNext>((resolve) => { resolveBufferedNext = resolve }))
      .mockResolvedValueOnce({ audioUrl: 'blob:late-third', id: 'a'.repeat(16), durationSeconds: 240 })
    const selectedModel = {
      id: 'b'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    const audio = document.querySelector('audio.radio-audio') as HTMLAudioElement
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
    fireEvent.ended(audio)
    expect(screen.getByRole('status', { name: 'État de la radio' })).toHaveTextContent('Fin du programme')

    resolveBufferedNext(bufferedNext)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('heading', { name: 'Instrumental music Relay' })).toBeInTheDocument()
    expect(onGenerate.mock.calls[2]![0]).toEqual(expect.objectContaining({
      continuationFromId: '9'.repeat(16),
    }))
  })

  it('shows complete metadata for the next programme while it is being prepared', async () => {
    const secondResult = { audioUrl: 'blob:second-pending', id: 'b'.repeat(16), durationSeconds: 240 }
    let resolveSecond!: (result: typeof secondResult) => void
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:first-ready', id: 'a'.repeat(16), durationSeconds: 240 })
      .mockImplementationOnce(() => new Promise<typeof secondResult>((resolve) => { resolveSecond = resolve }))
    const selectedModel = {
      id: 'c'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

    const next = screen.getByTestId('next-radio-track')
    for (const label of ['TONALITÉ', 'BPM CIBLE', 'MODE', 'ÉVOLUTION', 'ÉNERGIE', 'TEXTURE', 'MODÈLE', 'SEED', 'PROMPT', 'STRUCT.']) {
      expect(next).toHaveTextContent(label)
    }
    expect(next).toHaveTextContent('CALCUL 4%')

    resolveSecond(secondResult)
    await waitFor(() => expect(next).toHaveTextContent('READY'))
  })

  it('keeps diffusion settings stable for an in-flight slot and uses edits for the following slot', async () => {
    const onGenerate = vi.fn()
      .mockResolvedValueOnce({ audioUrl: 'blob:expert-first', id: 'e'.repeat(16), durationSeconds: 120 })
      .mockResolvedValueOnce({ audioUrl: 'blob:expert-second', id: 'f'.repeat(16), durationSeconds: 120 })
      .mockResolvedValueOnce({ audioUrl: 'blob:expert-third', id: 'g'.repeat(16), durationSeconds: 120 })
    const selectedModel = {
      id: 'd'.repeat(32),
      filename: 'berlin-techno.safetensors',
      size_bytes: 2048,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }
    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    expect(screen.getByRole('region', { name: 'Génération' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /^STEPS$/ })).toHaveValue('8')
    expect(screen.getByRole('slider', { name: /^CFG$/ })).toHaveValue('1')
    expect(screen.getByRole('slider', { name: /^APG$/ })).toHaveValue('1')

    fireEvent.change(screen.getByRole('slider', { name: /^STEPS$/ }), { target: { value: '14' } })
    fireEvent.change(screen.getByRole('slider', { name: /^CFG$/ }), { target: { value: '2.5' } })
    fireEvent.change(screen.getByRole('slider', { name: /^APG$/ }), { target: { value: '0.75' } })

    startRadio()
    await waitFor(() => expect(onGenerate).toHaveBeenCalled())
    expect(onGenerate.mock.calls[0]![0]).toEqual(expect.objectContaining({
      steps: 14,
      cfg: 2.5,
      apg: 0.75,
    }))
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByRole('slider', { name: /^STEPS$/ }), { target: { value: '19' } })
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    expect(onGenerate.mock.calls[1]![0]).toEqual(expect.objectContaining({ steps: 14 }))

    const audio = document.querySelector('audio.radio-audio') as HTMLAudioElement
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
    fireEvent.ended(audio)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(3))
    expect(onGenerate.mock.calls[2]![0]).toEqual(expect.objectContaining({
      steps: 19,
      continuationFromId: 'f'.repeat(16),
    }))
  })

  it('persists keywords to localStorage and restores them across mounts', () => {
    window.localStorage.setItem(RADIO_KEYWORDS_STORAGE_KEY, 'dark synth, berghain pulse')
    const { unmount } = render(<GenerativeRadio />)

    const textarea = screen.getByRole('textbox', { name: /Ta direction sonore/ })
    expect(textarea).toHaveValue('dark synth, berghain pulse')

    // Modifying keywords updates localStorage
    fireEvent.change(textarea, { target: { value: 'deep tech, rolling groove' } })
    expect(window.localStorage.getItem(RADIO_KEYWORDS_STORAGE_KEY)).toBe('deep tech, rolling groove')

    unmount()
    render(<GenerativeRadio />)
    expect(screen.getByRole('textbox', { name: /Ta direction sonore/ })).toHaveValue('deep tech, rolling groove')

  })

  it('edits both LCDs as continuous text without tag controls or counters', () => {
    render(<GenerativeRadio />)
    const direction = 'Soft piano, with space between notes.\nA distant cello answers.'
    const excluded = 'Speech, clipped transients.\nSudden cuts, sudden cuts.'
    fireEvent.change(screen.getByRole('textbox', { name: 'Ta direction sonore' }), { target: { value: direction } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Exclusions sonores' }), { target: { value: excluded } })
    expect(window.localStorage.getItem(RADIO_KEYWORDS_STORAGE_KEY)).toBe(direction)
    expect(window.localStorage.getItem(RADIO_NEGATIVE_PROMPT_STORAGE_KEY)).toBe(excluded)
    const directionPanel = document.querySelector('.machine-direction') as HTMLElement
    const excludePanel = document.querySelector('.machine-exclude') as HTMLElement
    expect(within(directionPanel).getAllByRole('button')).toHaveLength(1)
    expect(within(excludePanel).queryByRole('button')).not.toBeInTheDocument()
    expect(within(directionPanel).queryByRole('slider')).not.toBeInTheDocument()
    expect(within(excludePanel).queryByRole('slider')).not.toBeInTheDocument()
    expect(excludePanel).not.toHaveTextContent('TAGS')
    expect(document.querySelector('.machine-chip-line')).not.toBeInTheDocument()
  })

  it('preserves deliberately empty directions and exclusions across reloads', () => {
    const { unmount } = render(<GenerativeRadio />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Ta direction sonore' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Exclusions sonores' }), { target: { value: '' } })
    unmount()
    render(<GenerativeRadio />)
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Exclusions sonores' })).toHaveValue('')
  })

  it('adds a catalog suggestion without rewriting the existing prose', () => {
    render(<GenerativeRadio />)
    const direction = 'A delicate duet, with quiet pauses.\nLet each note ring.'
    fireEvent.change(screen.getByRole('textbox', { name: 'Ta direction sonore' }), { target: { value: direction } })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les sons' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un son' }), { target: { value: 'piano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter Piano à la direction' }))
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue(`${direction}\nPiano`)
    expect(screen.queryByRole('button', { name: /Épingler|Détacher/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds, reorders, and removes phases in chronological timeline and includes arrangement in recipe', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ audioUrl: 'blob:audio', id: 'gen-phase', durationSeconds: 240 })
    const selectedModel = {
      id: 'm'.repeat(32),
      filename: 'model.safetensors',
      size_bytes: 1024,
      created_at: '2026-09-10T00:00:00',
      format: 'safetensors' as const,
      base_model: 'stable-audio-3-medium-mlx',
    }

    render(<GenerativeRadio onGenerate={onGenerate} selectedModel={selectedModel} />)

    const phases = screen.getByRole('combobox', { name: 'Ajouter une phase' })
    fireEvent.change(phases, { target: { value: 'Intro' } })
    fireEvent.change(phases, { target: { value: 'Drop' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner Intro, position 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la phase sélectionnée' }))
    expect(screen.queryByRole('button', { name: 'Sélectionner Intro, position 1' })).not.toBeInTheDocument()
    fireEvent.change(phases, { target: { value: 'Outro' } })

    // Keep the editable prompt separate from the arrangement until the API boundary.
    startRadio()

    await waitFor(() => expect(onGenerate).toHaveBeenCalled())
    const sentRequest = onGenerate.mock.calls[0]![0] as { keywords: string; phases: string[] }
    expect(sentRequest.keywords).toBe('Instrumental music.')
    expect(sentRequest.phases).toEqual(['Drop', 'Outro'])
  })

  it('keeps saved prose when legacy pin storage is malformed', () => {
    window.localStorage.setItem(RADIO_KEYWORDS_STORAGE_KEY, 'A solo koto, played gently.')
    window.localStorage.setItem(RADIO_FIXED_TAGS_STORAGE_KEY, '{broken')
    render(<GenerativeRadio />)
    expect(screen.getByRole('textbox', { name: 'Ta direction sonore' })).toHaveValue('A solo koto, played gently.')
  })
})
