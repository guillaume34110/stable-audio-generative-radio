import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { GenerativeRadio, type RadioGenerationRequest } from './GenerativeRadio'
import {
  createStableAudioRadioGeneration,
  listStableAudioRadioSfts,
  stableAudioRadioAudioBlob,
  uploadStableAudioRadioSft,
  waitForStableAudioRadioGeneration,
  type StableAudioRadioAdapter,
  type StableAudioRadioModelVariant,
} from './stable-audio-radio-api'
import {
  captureLocalEnginePairing,
  detectLocalEngine,
  getLocalEnginePairUrl,
  requestLocalEngineAccess,
  type LocalEngineStatus,
} from './local-engine-client'

type GenerativeRadioPageProps = {
  onBack?: () => void
}

const RADIO_SELECTED_MODEL_STORAGE_KEY = 'onus-generative-radio-selected-model'

const readSelectedModelId = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(RADIO_SELECTED_MODEL_STORAGE_KEY)?.trim()
    return stored || null
  } catch {
    return null
  }
}

const rememberSelectedModel = (modelId: string | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (modelId) window.localStorage.setItem(RADIO_SELECTED_MODEL_STORAGE_KEY, modelId)
    else window.localStorage.removeItem(RADIO_SELECTED_MODEL_STORAGE_KEY)
  } catch {
    // Ignore storage errors; the engine catalogue remains authoritative.
  }
}

export const GenerativeRadioPage = ({ onBack }: GenerativeRadioPageProps): ReactElement => {
  const [models, setModels] = useState<StableAudioRadioAdapter[]>([])
  const [modelVariants, setModelVariants] = useState<StableAudioRadioModelVariant[]>([])
  const [selectedModel, setSelectedModel] = useState<StableAudioRadioAdapter | null>(null)
  const [engineStatus, setEngineStatus] = useState<LocalEngineStatus['state']>('checking')
  const [stableAudioRuntimeReady, setStableAudioRuntimeReady] = useState<boolean | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const audioUrlsRef = useRef<Set<string>>(new Set())

  const releaseAudioUrl = (url?: string): void => {
    if (!url || !audioUrlsRef.current.has(url)) return
    audioUrlsRef.current.delete(url)
    URL.revokeObjectURL(url)
  }

  const retainAudioUrl = (url: string): void => {
    if (!url.startsWith('blob:')) return
    audioUrlsRef.current.add(url)
    if (audioUrlsRef.current.size <= 2) return
    for (const staleUrl of [...audioUrlsRef.current]) {
      if (staleUrl === url) continue
      releaseAudioUrl(staleUrl)
      if (audioUrlsRef.current.size <= 2) break
    }
  }

  const loadCatalog = useCallback(async (): Promise<void> => {
    const catalog = await listStableAudioRadioSfts()
    setStableAudioRuntimeReady(catalog.runtime_ready)
    setModels(catalog.sfts)
    setModelVariants(catalog.model_variants)
    const storedModelId = readSelectedModelId()
    const nextModel = catalog.sfts.find((model) => model.id === storedModelId) ?? catalog.sfts[0] ?? null
    setSelectedModel(nextModel)
    rememberSelectedModel(nextModel?.id ?? null)
    setEngineError(null)
  }, [])

  useEffect(() => {
    captureLocalEnginePairing()
    let active = true
    void detectLocalEngine().then((status) => {
      if (!active) return
      setEngineStatus(status.state)
      if (status.state !== 'connected') {
        setStableAudioRuntimeReady(false)
        setEngineError(status.state === 'unpaired'
          ? 'Le moteur répond, mais cette page doit être appairée avant de charger un modèle.'
          : 'Le moteur local ne répond pas. Vérifie qu’il est lancé, puis réessaie.')
        return
      }
      void loadCatalog().catch((error: unknown) => {
        if (!active) return
        setStableAudioRuntimeReady(false)
        setEngineError(error instanceof Error ? error.message : 'Connexion au moteur Stable Audio impossible.')
      })
    })
    return () => {
      active = false
      for (const url of [...audioUrlsRef.current]) releaseAudioUrl(url)
    }
  }, [loadCatalog])

  const handleConnectLocalEngine = async (): Promise<void> => {
    setEngineError(null)
    try {
      const status = await requestLocalEngineAccess()
      setEngineStatus(status.state)
      if (status.state !== 'connected') {
        setStableAudioRuntimeReady(false)
        setEngineError(status.state === 'unpaired'
          ? 'Le moteur répond, mais cette page doit être appairée avant de charger un modèle.'
          : 'Le moteur local ne répond pas. Vérifie qu’il est lancé, puis réessaie.')
        return
      }
      await loadCatalog()
    } catch (error: unknown) {
      setStableAudioRuntimeReady(false)
      setEngineError(error instanceof Error ? error.message : 'Connexion au moteur Stable Audio impossible.')
    }
  }

  const handleImportModel = async (file: File): Promise<StableAudioRadioAdapter> => {
    const adapter = await uploadStableAudioRadioSft(file)
    setModels((current) => [adapter, ...current.filter((item) => item.id !== adapter.id)])
    setSelectedModel(adapter)
    rememberSelectedModel(adapter.id)
    setStableAudioRuntimeReady(true)
    setEngineStatus('connected')
    return adapter
  }

  const handleSelectModel = (model: StableAudioRadioAdapter): void => {
    setSelectedModel(model)
    rememberSelectedModel(model.id)
  }

  const handleClearModel = (): void => {
    setSelectedModel(null)
    rememberSelectedModel(null)
  }

  const handleGenerate = async (request: RadioGenerationRequest, onProgress?: (progress: number) => void) => {
    if (request.modelVariant === 'fp16' && !request.sftId) {
      throw new Error('Importe un modèle Stable Audio 3 avant de générer.')
    }
    const job = await createStableAudioRadioGeneration({
      sft_id: request.sftId,
      model_variant: request.modelVariant,
      prompt: request.keywords,
      bpm: request.bpm,
      drift: request.drift,
      energy: request.energy,
      texture: request.texture,
      evolution: request.evolution,
      duration_seconds: request.durationSeconds,
      lora_strength: request.loraStrength,
      seed: request.seed,
      steps: request.steps,
      cfg: request.cfg,
      apg: request.apg,
      negative_prompt: request.negativePrompt,
      continuation_from_generation_id: request.continuationFromId ?? undefined,
    })
    const completed = await waitForStableAudioRadioGeneration(job.generation_id, (update) => onProgress?.(update.progress ?? 0))
    if (!completed.audio_url) throw new Error('Le moteur a terminé sans exposer le WAV.')
    const completedGenerationId = completed.generation_id ?? completed.id ?? job.generation_id
    const audio = await stableAudioRadioAudioBlob(completedGenerationId)
    const audioUrl = URL.createObjectURL(audio)
    retainAudioUrl(audioUrl)
    return {
      audioUrl,
      id: completedGenerationId,
      bpm: completed.bpm ?? request.bpm,
      durationSeconds: completed.duration_seconds ?? request.durationSeconds,
    }
  }

  const reconnect = async (): Promise<void> => {
    await handleConnectLocalEngine()
  }

  const engineMessage = engineError
    ?? (stableAudioRuntimeReady === false
      ? 'Le runtime Stable Audio 3 n’est pas prêt dans le moteur local.'
      : engineStatus === 'connected'
        ? 'Moteur local prêt. Tes modèles restent sur ta machine après rechargement.'
        : 'Appaire le moteur local pour charger un modèle et lancer la radio.')

  return <div className="radio-page" data-testid="generative-radio-page">
    <main className="radio-page-main">
      <GenerativeRadio
        onBack={onBack}
        engineMessage={engineMessage}
        pairingUrl={engineStatus === 'unpaired' ? getLocalEnginePairUrl() : undefined}
        runtimeReady={stableAudioRuntimeReady}
        onReconnect={reconnect}
        availableModels={models}
        availableModelVariants={modelVariants}
        onClearModel={handleClearModel}
        onGenerate={handleGenerate}
        onImportModel={handleImportModel}
        onReleaseAudioUrl={releaseAudioUrl}
        onSelectModel={handleSelectModel}
        selectedModel={selectedModel}
      />
    </main>
  </div>
}
