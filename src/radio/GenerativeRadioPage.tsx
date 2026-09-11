import { useEffect, useRef, useState, type ReactElement } from 'react'
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

type GenerativeRadioPageProps = {
  onBack?: () => void
}

export const GenerativeRadioPage = ({ onBack }: GenerativeRadioPageProps): ReactElement => {
  const handleBack = onBack ?? (() => window.history.back())
  const [models, setModels] = useState<StableAudioRadioAdapter[]>([])
  const [modelVariants, setModelVariants] = useState<StableAudioRadioModelVariant[]>([])
  const [selectedModel, setSelectedModel] = useState<StableAudioRadioAdapter | null>(null)
  const [stableAudioRuntimeReady, setStableAudioRuntimeReady] = useState<boolean | null>(null)
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

  useEffect(() => {
    let active = true
    void listStableAudioRadioSfts().then((catalog) => {
      if (!active) return
      setStableAudioRuntimeReady(catalog.runtime_ready)
      setModels(catalog.sfts)
      setModelVariants(catalog.model_variants)
      setSelectedModel((current) => current ?? catalog.sfts[0] ?? null)
    }).catch(() => {
      if (active) setStableAudioRuntimeReady(false)
    })
    return () => {
      active = false
      for (const url of [...audioUrlsRef.current]) releaseAudioUrl(url)
    }
  }, [])

  const handleImportModel = async (file: File): Promise<StableAudioRadioAdapter> => {
    const adapter = await uploadStableAudioRadioSft(file)
    setModels((current) => [adapter, ...current.filter((item) => item.id !== adapter.id)])
    setSelectedModel(adapter)
    setStableAudioRuntimeReady(true)
    return adapter
  }

  const handleGenerate = async (request: RadioGenerationRequest, onProgress?: (progress: number) => void) => {
    if (request.modelVariant === 'fp16' && !request.sftId) {
      throw new Error('Importe un SFT Stable Audio 3 avant de générer.')
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

  const engineCopy = stableAudioRuntimeReady === false
    ? 'Le runtime Stable Audio 3 MLX n’est pas disponible.'
    : 'Lecteur navigateur prêt · tes SFT restent sur ta machine.'

  return <div className="radio-page" data-testid="generative-radio-page">
    <header className="radio-page-header">
      <button className="radio-page-back" type="button" onClick={handleBack} aria-label="Retourner au player">← RADIO</button>
      <div className="radio-page-brand"><strong>AI RADIO</strong><span>STABLE AUDIO 3 / LOCAL PLAYER</span></div>
      <span className="radio-page-mark">BROWSER-FIRST</span>
    </header>

    <main className="radio-page-main">
      <div className="radio-page-intro">
        <div><span>GENERATIVE RADIO / LOCAL SFT PLAYER</span><h1>Une radio qui évolue avec toi.</h1></div>
        <p>{engineCopy} Importe un checkpoint `.safetensors`, donne une direction sonore, puis laisse Stable Audio 3 construire un flux endless : chaque morceau est généré indépendamment, tandis que seul l’arc procédural partagé évolue sur environ six minutes, sans réinjecter l’audio précédent.</p>
      </div>
      <GenerativeRadio
        availableModels={models}
        availableModelVariants={modelVariants}
        onClearModel={() => setSelectedModel(null)}
        onGenerate={handleGenerate}
        onImportModel={handleImportModel}
        onReleaseAudioUrl={releaseAudioUrl}
        onSelectModel={setSelectedModel}
        selectedModel={selectedModel}
      />
    </main>

    <footer className="radio-page-footer"><span>LOCAL MODEL / STABLE AUDIO 3 MEDIUM</span><span>FP16 · INT8 · INT4 · INT2 · INT1 / TESTABLE</span><span>FLUX ENDLESS / ARC 6 MIN</span><span>OPEN SOURCE PLAYER</span></footer>
  </div>
}
