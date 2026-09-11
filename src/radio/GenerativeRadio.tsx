import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactElement } from 'react'
import type {
  StableAudioRadioAdapter,
  StableAudioRadioModelVariant,
  StableAudioRadioModelVariantId,
} from './stable-audio-radio-api'
import {
  createRadioDsp,
  defaultRadioDspSettings,
  type RadioDspController,
  type RadioDspMeter,
  type RadioDspSettings,
} from './radio-dsp'

export type RadioEvolution = 'slow' | 'fluid' | 'wild'

export type RadioGenerationRequest = {
  keywords: string
  bpm: number
  drift: number
  energy: number
  texture: number
  evolution: RadioEvolution
  durationSeconds: number
  loraStrength: number
  modelVariant: StableAudioRadioModelVariantId
  sftFile: File | null
  sftId: string | null
  seed?: number
  // Backend lineage only: no audio from the previous track is reused.
  continuationFromId?: string | null
}

export type RadioGenerationResult = {
  audioUrl: string
  id?: string
  title?: string
  bpm?: number
  key?: string
  durationSeconds?: number
}

type RadioTrack = {
  id: number | string
  title: string
  bpm: number
  key: string
  mode: 'programme' | 'independent'
  evolution: RadioEvolution
  durationSeconds: number
  audioUrl?: string
  state: 'playing' | 'ready' | 'queued'
  recipe: RadioRecipe
}

type RadioRecipe = {
  keywords: string
  tags: string[]
  keywordPool: string[]
  bpm: number
  drift: number
  energy: number
  texture: number
  evolution: RadioEvolution
  durationSeconds: number
  loraStrength: number
  modelVariant: StableAudioRadioModelVariantId
  seed: number
}

type ModelImportState = 'idle' | 'uploading' | 'ready' | 'error'

const defaultKeywords = 'minimal, minimal techno'
const minimumRadioProgramSeconds = 120
const maximumRadioProgramSeconds = 360
const defaultProgramDurationSeconds = 330
const maximumSftBytes = 2 * 1024 * 1024 * 1024
const fallbackModelVariants: readonly StableAudioRadioModelVariant[] = [
  {
    id: 'fp16',
    label: 'FP16 · SFT importé',
    description: 'SFT choisi dans la page, précision native',
    available: true,
    bits: null,
    size_bytes: null,
    merged_sft: false,
    lora_strength: null,
  },
  {
    id: 'int8',
    label: 'INT8 · Berlin SFT fusionné',
    description: 'DiT Medium quantifié INT8 · SFT Berlin intégré',
    available: false,
    bits: 8,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int4',
    label: 'INT4 · Berlin SFT fusionné',
    description: 'DiT Medium quantifié INT4 · SFT Berlin intégré',
    available: false,
    bits: 4,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int2',
    label: 'INT2 · Berlin SFT fusionné',
    description: 'DiT Medium quantifié INT2 · SFT Berlin intégré',
    available: false,
    bits: 2,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int1',
    label: 'INT1 · Berlin SFT expérimental',
    description: 'DiT Medium binaire packé INT1 · SFT Berlin intégré',
    available: false,
    bits: 1,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
]
const evolutionLabels: readonly { id: RadioEvolution; label: string; hint: string }[] = [
  { id: 'slow', label: 'LENTE', hint: 'Transitions longues' },
  { id: 'fluid', label: 'FLUIDE', hint: 'Évolution régulière' },
  { id: 'wild', label: 'SAUVAGE', hint: 'Ruptures assumées' },
]

const evolutionLabel = (value: RadioEvolution): string => evolutionLabels.find((item) => item.id === value)?.label ?? value.toUpperCase()

const formatClock = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`

const formatDecibels = (value: number): string => value <= -59 ? '-∞ dB' : `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} Mo`
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

const parseKeywords = (value: string): string[] => {
  const seen = new Set<string>()
  return value
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false
      const normalized = token.toLocaleLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

const proceduralValue = (seed: number, channel: number): number => {
  const value = Math.sin((seed + channel * 101.37) * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const pickGenerationTags = (pool: readonly string[], seed: number): string[] => {
  if (pool.length <= 2) return [...pool]
  const minimum = pool.length <= 6 ? Math.max(2, pool.length - 1) : Math.min(pool.length, 5)
  const maximum = pool.length <= 8
    ? Math.max(minimum, pool.length - 1)
    : Math.min(pool.length - 1, 14)
  const targetSize = minimum + Math.floor(proceduralValue(seed, 97) * (maximum - minimum + 1))
  return pool
    .map((tag, index) => ({ tag, index, rank: proceduralValue(seed, index + 101) }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, targetSize)
    .sort((left, right) => left.index - right.index)
    .map(({ tag }) => tag)
}

const buildProceduralRecipe = (input: Omit<RadioRecipe, 'keywords' | 'tags' | 'keywordPool' | 'seed'> & { keywords: string }, variation: number, enabled: boolean): RadioRecipe => {
  const keywordPool = parseKeywords(input.keywords)
  const normalizedKeywords = keywordPool.join(', ')
  const seed = hashString(`${normalizedKeywords}:${variation}`) % 2_147_483_647
  const tags = enabled ? pickGenerationTags(keywordPool, seed) : [...keywordPool]
  const baseRecipe: RadioRecipe = {
    ...input,
    keywords: tags.join(', '),
    tags,
    keywordPool,
    seed,
  }
  if (!enabled || variation === 0) return baseRecipe

  // Auto-evolution may change the numerical controls, but it must never
  // invent a style, instrument, texture, or other content tag.

  const trajectorySeed = hashString(normalizedKeywords)
  const swing = (channel: number, amplitude: number): number => {
    const phase = proceduralValue(trajectorySeed, channel + 20) * Math.PI * 2
    const period = 4.5 + proceduralValue(trajectorySeed, channel + 30) * 3.5
    const smooth = Math.sin((variation + 1) / period + phase)
    const localJitter = (proceduralValue(seed, channel) * 2 - 1) * 0.18
    return (smooth * 0.82 + localJitter) * amplitude
  }
  const nextEvolution: Record<RadioEvolution, readonly RadioEvolution[]> = {
    slow: ['slow', 'slow', 'fluid', 'slow', 'fluid', 'wild'],
    fluid: ['fluid', 'slow', 'fluid', 'wild', 'fluid', 'slow'],
    wild: ['wild', 'fluid', 'wild', 'fluid', 'slow', 'wild'],
  }
  return {
    ...baseRecipe,
    bpm: clamp(Math.round(input.bpm + swing(1, Math.max(1, input.drift / 4))), 60, 220),
    drift: clamp(Math.round(input.drift + swing(2, 24)), 0, 100),
    energy: clamp(Math.round(input.energy + swing(3, 18)), 0, 100),
    texture: clamp(Math.round(input.texture + swing(4, 20)), 0, 100),
    evolution: nextEvolution[input.evolution][variation % nextEvolution[input.evolution].length]!,
    durationSeconds: clamp(Math.round(input.durationSeconds + swing(5, 12)), minimumRadioProgramSeconds, maximumRadioProgramSeconds),
    loraStrength: input.modelVariant === 'fp16'
      ? clamp(Number((input.loraStrength + swing(6, 0.12)).toFixed(3)), 0, 1)
      : 0.25,
    modelVariant: input.modelVariant,
    seed,
  }
}

const titleForKeywords = (keywords: string[], index: number): string => {
  const lead = keywords[0] ?? 'Signal'
  const suffixes = ['Drift', 'Relay', 'Bloom', 'Current']
  return `${lead.slice(0, 18)} ${suffixes[index % suffixes.length]}`
}

const trackFromRecipe = (
  recipe: RadioRecipe,
  titleIndex: number,
  mode: RadioTrack['mode'] = 'independent',
  id: number | string = `pending-${recipe.seed}`,
): RadioTrack => ({
  id,
  title: titleForKeywords(recipe.tags, titleIndex),
  bpm: recipe.bpm,
  key: 'F#m',
  mode,
  evolution: recipe.evolution,
  durationSeconds: recipe.durationSeconds,
  state: 'queued',
  recipe,
})

const trackFromResult = (
  result: RadioGenerationResult,
  recipe: RadioRecipe,
  titleIndex: number,
  mode: RadioTrack['mode'] = 'programme',
): RadioTrack => ({
  ...trackFromRecipe(recipe, titleIndex, mode, result.id ?? Date.now()),
  title: result.title ?? titleForKeywords(recipe.tags, titleIndex),
  bpm: result.bpm ?? recipe.bpm,
  key: result.key ?? 'F#m',
  durationSeconds: result.durationSeconds ?? recipe.durationSeconds,
  audioUrl: result.audioUrl,
  state: 'ready',
})

const buildContinuationRecipe = (sourceRecipe: RadioRecipe, variation: number): RadioRecipe => buildProceduralRecipe({
  keywords: sourceRecipe.keywordPool.join(', '),
  bpm: sourceRecipe.bpm,
  drift: sourceRecipe.drift,
  energy: sourceRecipe.energy,
  texture: sourceRecipe.texture,
  evolution: sourceRecipe.evolution,
  durationSeconds: sourceRecipe.durationSeconds,
  loraStrength: sourceRecipe.loraStrength,
  modelVariant: sourceRecipe.modelVariant,
}, variation, true)

type RadioTrackCardProps = {
  track: RadioTrack
  slot: 'current' | 'next'
  statusLabel: string
  building?: boolean
}

const RadioTrackCard = ({ track, slot, statusLabel, building = false }: RadioTrackCardProps): ReactElement => {
  const isCurrent = slot === 'current'
  const trackClassName = `radio-queue-row is-${slot}${building ? ' is-building' : ''}`
  return <div className={trackClassName} data-testid={isCurrent ? 'current-radio-track' : 'next-radio-track'} aria-label={isCurrent ? 'Morceau actif' : 'Prochain morceau'}>
    <div className="radio-queue-track-heading"><span>{isCurrent ? '01 · FLUX ACTIF' : '02 · UP NEXT'}</span><b>{statusLabel}</b></div>
    <strong className="radio-queue-title">{track.title}</strong>
    <dl className="radio-track-info-grid">
      <div><dt>KEY</dt><dd>{track.key}</dd></div>
      <div><dt>BPM</dt><dd>{track.bpm}</dd></div>
      <div><dt>DURÉE</dt><dd>{formatClock(track.durationSeconds)}</dd></div>
      <div><dt>MODE</dt><dd>{track.mode === 'independent' ? 'INDÉPENDANT' : 'PROGRAMME'}</dd></div>
      <div><dt>ÉVOLUTION</dt><dd>{evolutionLabel(track.recipe.evolution)}</dd></div>
      <div><dt>DÉRIVE</dt><dd>±{Math.round(track.recipe.drift / 4)} BPM</dd></div>
      <div><dt>ÉNERGIE</dt><dd>{track.recipe.energy}%</dd></div>
      <div><dt>MATIÈRE</dt><dd>{track.recipe.texture}%</dd></div>
      <div><dt>SFT</dt><dd>{track.recipe.modelVariant.toUpperCase()} · {Math.round(track.recipe.loraStrength * 100)}%</dd></div>
      <div><dt>SEED</dt><dd>{track.recipe.seed}</dd></div>
    </dl>
    <div className="radio-track-prompt" aria-label={isCurrent ? 'Prompt du morceau actif' : 'Prompt de la prochaine génération'}>
      <span>PROMPT UTILISÉ · {track.recipe.tags.length}/{track.recipe.keywordPool.length} TAGS</span>
      <p>{track.recipe.keywords}</p>
    </div>
    <small className="radio-track-id">GENERATION ID · {track.state === 'queued' ? 'EN PRÉPARATION' : String(track.id)}</small>
  </div>
}

const percentStyle = (value: number): CSSProperties => ({ '--radio-fill': `${value}%` } as CSSProperties)

const defaultRadioDspMeter: RadioDspMeter = { inputPeakDb: -60, outputPeakDb: -60, gainReductionDb: 0 }

type GenerativeRadioProps = {
  availableModels?: readonly StableAudioRadioAdapter[]
  availableModelVariants?: readonly StableAudioRadioModelVariant[]
  onClearModel?: () => void
  onGenerate?: (request: RadioGenerationRequest, onProgress?: (progress: number) => void) => Promise<RadioGenerationResult | void>
  onImportModel?: (file: File) => Promise<StableAudioRadioAdapter | void>
  onReleaseAudioUrl?: (audioUrl?: string) => void
  onSelectModel?: (model: StableAudioRadioAdapter) => void
  selectedModel?: StableAudioRadioAdapter | null
}

export const GenerativeRadio = ({
  availableModels = [],
  availableModelVariants = [],
  onClearModel,
  onGenerate,
  onImportModel,
  onReleaseAudioUrl,
  onSelectModel,
  selectedModel,
}: GenerativeRadioProps): ReactElement => {
  const [keywords, setKeywords] = useState(defaultKeywords)
  const [sftFile, setSftFile] = useState<File | null>(null)
  const [localModel, setLocalModel] = useState<StableAudioRadioAdapter | null>(selectedModel ?? null)
  const [modelImportState, setModelImportState] = useState<ModelImportState>(selectedModel ? 'ready' : 'idle')
  const [bpm, setBpm] = useState(124)
  const [drift, setDrift] = useState(26)
  const [energy, setEnergy] = useState(62)
  const [texture, setTexture] = useState(48)
  const [durationSeconds, setDurationSeconds] = useState(defaultProgramDurationSeconds)
  const [loraStrength, setLoraStrength] = useState(100)
  const [modelVariant, setModelVariant] = useState<StableAudioRadioModelVariantId>('fp16')
  const [evolution, setEvolution] = useState<RadioEvolution>('fluid')
  const [preampDb, setPreampDb] = useState(defaultRadioDspSettings.preampDb)
  const [dspEnabled, setDspEnabled] = useState(defaultRadioDspSettings.dspEnabled)
  const [noiseFilter, setNoiseFilter] = useState(defaultRadioDspSettings.noiseFilter)
  const [dspAmount, setDspAmount] = useState(defaultRadioDspSettings.dspAmount)
  const [limiterEnabled, setLimiterEnabled] = useState(defaultRadioDspSettings.limiterEnabled)
  const [limiterCeilingDb, setLimiterCeilingDb] = useState(defaultRadioDspSettings.limiterCeilingDb)
  const [dspMeter, setDspMeter] = useState(defaultRadioDspMeter)
  const [activeRecipe, setActiveRecipe] = useState<RadioRecipe | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [currentTrack, setCurrentTrack] = useState<RadioTrack | null>(null)
  const [continuationTrack, setContinuationTrack] = useState<RadioTrack | null>(null)
  const [continuationPreview, setContinuationPreview] = useState<RadioTrack | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [continuationGenerating, setContinuationGenerating] = useState(false)
  const [status, setStatus] = useState('Importe un SFT Stable Audio 3 ou choisis une variante INT8/INT4/INT2/INT1.')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const dspRef = useRef<RadioDspController | null>(null)
  const playbackPositionRef = useRef(position)
  const keywordsRef = useRef<HTMLTextAreaElement | null>(null)
  const generateNextRef = useRef<(autoplay?: boolean) => Promise<void>>(async () => undefined)
  const autoplayAfterGenerationRef = useRef(false)
  const variationCounterRef = useRef(0)
  const continuationTrackRef = useRef<RadioTrack | null>(null)
  const continuationGeneratingRef = useRef(false)
  const programSessionRef = useRef(0)
  const playbackEndedRef = useRef(false)

  useEffect(() => {
    if (selectedModel) {
      setLocalModel(selectedModel)
      setModelImportState('ready')
    }
  }, [selectedModel])

  useEffect(() => {
    variationCounterRef.current = 0
    setActiveRecipe(null)
  }, [keywords, bpm, drift, energy, texture, durationSeconds, loraStrength, evolution, modelVariant])

  useEffect(() => {
    playbackPositionRef.current = position
  }, [position])

  const keywordTokens = useMemo(() => parseKeywords(keywords), [keywords])
  const selectedAdapter = selectedModel ?? localModel
  const modelOptions = useMemo(() => {
    const options = selectedAdapter ? [selectedAdapter, ...availableModels] : [...availableModels]
    return options.filter((model, index, all) => all.findIndex((item) => item.id === model.id) === index)
  }, [availableModels, selectedAdapter])
  const modelVariantOptions = useMemo(
    () => availableModelVariants.length ? availableModelVariants : fallbackModelVariants,
    [availableModelVariants],
  )
  const selectedModelVariant = modelVariantOptions.find((variant) => variant.id === modelVariant) ?? fallbackModelVariants[0]
  const quantizedModelSelected = modelVariant !== 'fp16'
  const currentTrackDuration = currentTrack?.durationSeconds ?? defaultProgramDurationSeconds
  const progress = currentTrack ? clamp((position / currentTrackDuration) * 100, 0, 100) : 0
  const remainingSeconds = currentTrack ? Math.max(0, currentTrackDuration - position) : 0
  const bufferAdvance = currentTrack ? `${formatClock(remainingSeconds)} RESTANT` : '00:00 PRÊT'
  const continuationBufferState = continuationGenerating ? 'MORCEAU INDÉPENDANT EN CALCUL' : continuationTrack ? 'MORCEAU INDÉPENDANT PRÊT' : currentTrack ? 'PROCHAIN MORCEAU À PRÉPARER' : 'EN ATTENTE'
  const displayedTags = activeRecipe?.tags ?? keywordTokens
  const displayedTagPool = activeRecipe?.keywordPool ?? keywordTokens
  const tagCountLabel = activeRecipe ? `${displayedTags.length}/${displayedTagPool.length} TAGS` : `${displayedTagPool.length} TAGS`
  const displayedEvolution = currentTrack?.evolution ?? activeRecipe?.evolution ?? evolution
  const activeQueueTrack = currentTrack ?? (generating && activeRecipe
    ? trackFromRecipe(activeRecipe, variationCounterRef.current, 'programme')
    : null)
  const projectedSourceTrack = currentTrack ?? activeQueueTrack
  const projectedVariation = currentTrack ? variationCounterRef.current : variationCounterRef.current + 1
  const projectedContinuationTrack = projectedSourceTrack
    ? trackFromRecipe(buildContinuationRecipe(projectedSourceTrack.recipe, projectedVariation), projectedVariation, 'independent')
    : null
  const nextQueueTrack = continuationTrack ?? continuationPreview ?? projectedContinuationTrack
  const radioDspSettings = useMemo<RadioDspSettings>(() => ({
    preampDb,
    dspEnabled,
    noiseFilter,
    dspAmount,
    limiterEnabled,
    limiterCeilingDb,
  }), [dspAmount, dspEnabled, limiterCeilingDb, limiterEnabled, noiseFilter, preampDb])

  useEffect(() => {
    dspRef.current?.setSettings(radioDspSettings)
  }, [radioDspSettings])

  useEffect(() => {
    const meterTimer = window.setInterval(() => {
      if (dspRef.current) setDspMeter(dspRef.current.readMeter())
    }, 140)
    return () => window.clearInterval(meterTimer)
  }, [])

  useEffect(() => () => {
    dspRef.current?.dispose()
    dspRef.current = null
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audioUrl) return
    playbackEndedRef.current = false
    audio.pause()
    audio.currentTime = 0
    audio.load()
    setPosition(0)
    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false)
        setStatus('Clique sur lecture pour autoriser la sortie audio.')
      })
    }
  }, [currentTrack?.audioUrl])

  const handleSftFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setError(null)
    if (!file.name.toLowerCase().endsWith('.safetensors')) {
      setError('Choisis un adaptateur Stable Audio 3 au format .safetensors.')
      event.currentTarget.value = ''
      return
    }
    if (file.size > maximumSftBytes) {
      setError('Le SFT doit peser moins de 2 Go.')
      event.currentTarget.value = ''
      return
    }
    setSftFile(file)
    setLocalModel(null)
    setModelVariant('fp16')
    setModelImportState(onImportModel ? 'uploading' : 'ready')
    setStatus(onImportModel ? `Import du SFT en cours · ${file.name}` : `SFT sélectionné · ${file.name}`)
    if (!onImportModel) return
    try {
      const adapter = await onImportModel(file)
      if (adapter) setLocalModel(adapter)
      setModelImportState('ready')
      setStatus(`SFT Stable Audio 3 prêt · ${adapter?.filename ?? file.name}`)
    } catch (importError) {
      setModelImportState('error')
      setError(importError instanceof Error ? importError.message : 'Impossible d’importer ce SFT.')
      setStatus('Import du SFT interrompu.')
    }
  }

  const selectInstalledModel = (event: ChangeEvent<HTMLSelectElement>): void => {
    const model = modelOptions.find((item) => item.id === event.currentTarget.value)
    if (!model) return
    setSftFile(null)
    setLocalModel(model)
    setModelVariant('fp16')
    setModelImportState('ready')
    onSelectModel?.(model)
    setError(null)
    setStatus(`SFT Stable Audio 3 sélectionné · ${model.filename}`)
  }

  const selectModelVariant = (event: ChangeEvent<HTMLSelectElement>): void => {
    const variant = modelVariantOptions.find((item) => item.id === event.currentTarget.value)
    if (!variant || !variant.available) return
    setModelVariant(variant.id)
    setError(null)
    setStatus(
      variant.id === 'fp16'
        ? 'Variante FP16 sélectionnée · le SFT importé sera utilisé.'
        : `${variant.label} sélectionné · le SFT est déjà fusionné dans le DiT.`,
    )
  }

  const resetModel = (): void => {
    setSftFile(null)
    setLocalModel(null)
    setModelVariant('fp16')
    setModelImportState('idle')
    onClearModel?.()
    setError(null)
    setStatus('Aucun SFT chargé · importe un adaptateur pour reprendre.')
  }

  const ensureRadioDsp = (): RadioDspController | null => {
    if (dspRef.current) return dspRef.current
    const audio = audioRef.current
    if (!audio) return null
    try {
      dspRef.current = createRadioDsp(audio, radioDspSettings)
      return dspRef.current
    } catch (dspError) {
      setError(dspError instanceof Error ? dspError.message : 'Le DSP navigateur n’est pas disponible.')
      return null
    }
  }

  const releaseTrackAudio = (track: RadioTrack | null | undefined): void => {
    if (track?.audioUrl) onReleaseAudioUrl?.(track.audioUrl)
  }

  const handleStart = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!keywords.trim()) {
      setError('Ajoute au moins un mot-clé pour lancer la radio.')
      setStatus('La recette est incomplète.')
      keywordsRef.current?.focus()
      return
    }
    if (!currentTrack) {
      await ensureRadioDsp()?.resume()
      autoplayAfterGenerationRef.current = true
      await generateNextRef.current(true)
      return
    }
    setError(null)
    await ensureRadioDsp()?.resume()
    setPlaying(true)
    void audioRef.current?.play().catch(() => setError('La sortie audio est bloquée par le navigateur.'))
    setStatus(`Programme actif · ${bpm} BPM cible · évolution interne en cours.`)
  }

  const togglePlayback = async (): Promise<void> => {
    if (!keywords.trim()) {
      setError('Ajoute au moins un mot-clé pour lancer la radio.')
      keywordsRef.current?.focus()
      return
    }
    if (!currentTrack?.audioUrl) {
      await ensureRadioDsp()?.resume()
      autoplayAfterGenerationRef.current = true
      await generateNextRef.current(true)
      return
    }
    setError(null)
    await ensureRadioDsp()?.resume()
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play().catch(() => setError('La sortie audio est bloquée par le navigateur.'))
      setStatus('Programme actif · évolution interne en cours.')
    } else {
      audio.pause()
      setStatus('Programme en pause · il reprend au même endroit.')
    }
  }

  async function prefetchContinuation(sourceTrack: RadioTrack, sourceRecipe: RadioRecipe, session: number): Promise<void> {
    if (continuationGeneratingRef.current || continuationTrackRef.current || !onGenerate || typeof sourceTrack.id !== 'string') return

    continuationGeneratingRef.current = true
    setContinuationGenerating(true)
    setGenerationProgress(4)
    const variation = variationCounterRef.current
    const recipe = buildContinuationRecipe(sourceRecipe, variation)
    const previewTrack = trackFromRecipe(recipe, variation, 'independent')
    setContinuationPreview(previewTrack)
    const request: RadioGenerationRequest = {
      keywords: recipe.keywords,
      bpm: recipe.bpm,
      drift: recipe.drift,
      energy: recipe.energy,
      texture: recipe.texture,
      evolution: recipe.evolution,
      durationSeconds: recipe.durationSeconds,
      loraStrength: recipe.loraStrength,
      modelVariant: sourceRecipe.modelVariant,
      sftFile: sourceRecipe.modelVariant === 'fp16' ? sftFile : null,
      sftId: sourceRecipe.modelVariant === 'fp16' ? selectedAdapter?.id ?? null : null,
      seed: recipe.seed,
      continuationFromId: sourceTrack.id,
    }
    let completedTrack: RadioTrack | null = null
    try {
      setStatus('Stable Audio 3 prépare un morceau indépendant…')
      const result = await onGenerate(request, (nextProgress) => {
        if (session === programSessionRef.current) setGenerationProgress(clamp(nextProgress, 0, 100))
      })
      if (!result?.audioUrl) throw new Error('Le moteur n’a pas renvoyé le morceau indépendant.')
      if (session !== programSessionRef.current) {
        onReleaseAudioUrl?.(result.audioUrl)
        return
      }
      completedTrack = trackFromResult(result, recipe, variation, 'independent')
      releaseTrackAudio(continuationTrackRef.current)
      continuationTrackRef.current = completedTrack
      setContinuationPreview(null)
      setContinuationTrack(completedTrack)
      variationCounterRef.current = variation + 1
      setGenerationProgress(100)
      setStatus('Morceau indépendant prêt en avance · le flux gardera la même évolution.')
    } catch {
      if (session === programSessionRef.current) setStatus('Programme actif · le morceau indépendant doit être recalculé.')
    } finally {
      continuationGeneratingRef.current = false
      if (session !== programSessionRef.current) return
      setContinuationGenerating(false)
      if (!completedTrack) setContinuationPreview(previewTrack)
      if (completedTrack && playbackEndedRef.current && continuationTrackRef.current?.id === completedTrack.id) activateContinuation(completedTrack)
    }
  }

  function activateContinuation(track: RadioTrack): void {
    if (!track.audioUrl) return
    playbackEndedRef.current = false
    if (currentTrack?.id !== track.id) releaseTrackAudio(currentTrack)
    continuationTrackRef.current = null
    setContinuationTrack(null)
    setContinuationPreview(null)
    setCurrentTrack(track)
    setPosition(0)
    setPlaying(true)
    setStatus('Morceau indépendant actif · l’arc procédural se poursuit.')
    void prefetchContinuation(track, track.recipe, programSessionRef.current)
  }

  const generateNext = async (autoplay = false): Promise<void> => {
    if (generating || continuationGeneratingRef.current) return
    if (!keywords.trim()) {
      setError('Ajoute au moins un mot-clé avant de générer le programme.')
      keywordsRef.current?.focus()
      return
    }
    if (modelImportState === 'uploading') {
      setError('Attends la fin de l’import du SFT avant de générer.')
      return
    }
    if (!selectedModelVariant?.available) {
      setError(`La variante ${modelVariant.toUpperCase()} n’est pas installée dans le moteur local.`)
      setStatus('Choisis une variante disponible pour lancer la radio.')
      return
    }
    if (modelVariant === 'fp16' && !selectedAdapter && !sftFile) {
      setError('Importe d’abord un SFT Stable Audio 3 depuis ta machine.')
      setStatus('Aucun SFT ou modèle quantifié sélectionné.')
      return
    }
    if (!onGenerate) {
      setError('Le moteur Stable Audio 3 n’est pas connecté à cette page.')
      setStatus('Connexion au moteur local requise.')
      return
    }
    setError(null)
    const session = programSessionRef.current + 1
    programSessionRef.current = session
    playbackEndedRef.current = false
    releaseTrackAudio(continuationTrackRef.current)
    continuationTrackRef.current = null
    setContinuationTrack(null)
    setContinuationPreview(null)
    setContinuationGenerating(false)
    setGenerating(true)
    setGenerationProgress(12)
    const variation = variationCounterRef.current
    const recipe = buildProceduralRecipe({
      keywords: keywords.trim(),
      bpm,
      drift,
      energy,
      texture,
      evolution,
      durationSeconds,
      loraStrength: modelVariant === 'fp16' ? loraStrength / 100 : 0.25,
      modelVariant,
    }, variation, true)
    setActiveRecipe(recipe)
    setStatus('Stable Audio 3 compose un programme continu de plusieurs minutes…')
    const request: RadioGenerationRequest = {
      keywords: recipe.keywords,
      bpm: recipe.bpm,
      drift: recipe.drift,
      energy: recipe.energy,
      texture: recipe.texture,
      evolution: recipe.evolution,
      durationSeconds: recipe.durationSeconds,
      loraStrength: recipe.loraStrength,
      modelVariant: recipe.modelVariant,
      sftFile: recipe.modelVariant === 'fp16' ? sftFile : null,
      sftId: recipe.modelVariant === 'fp16' ? selectedAdapter?.id ?? null : null,
      seed: recipe.seed,
      continuationFromId: null,
    }
    try {
      const result = await onGenerate(request, (nextProgress) => setGenerationProgress(clamp(nextProgress, 0, 100)))
      if (!result?.audioUrl) throw new Error('Le moteur n’a pas renvoyé de fichier audio.')
      variationCounterRef.current = variation + 1
      const nextTrack = trackFromResult(result, recipe, variation)
      const previousTrack = currentTrack
      setCurrentTrack(nextTrack)
      if (previousTrack?.id !== nextTrack.id) {
        window.setTimeout(() => releaseTrackAudio(previousTrack), 0)
      }
      if (autoplay || autoplayAfterGenerationRef.current || playing) setPlaying(true)
      autoplayAfterGenerationRef.current = false
      setGenerationProgress(100)
      setStatus(`Programme prêt · ${nextTrack.title} évolue sans découpe.`)
      void prefetchContinuation(nextTrack, recipe, session)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Le programme n’a pas pu être préparé.')
      setStatus('Génération interrompue.')
    } finally {
      setGenerating(false)
    }
  }

  generateNextRef.current = generateNext

  const handleAudioTimeUpdate = (): void => {
    const audio = audioRef.current
    if (!audio) return
    playbackPositionRef.current = audio.currentTime
    setPosition(audio.currentTime)
  }

  const handleAudioEnded = (): void => {
    playbackEndedRef.current = true
    const continuation = continuationTrackRef.current
    if (continuation) {
      activateContinuation(continuation)
      return
    }
    setPlaying(false)
    setPosition(0)
    setStatus(continuationGeneratingRef.current ? 'Fin du programme · le morceau indépendant termine sa préparation…' : 'Programme terminé · génère un nouveau programme pour repartir.')
  }

  const handleSeek = (event: ChangeEvent<HTMLInputElement>): void => {
    const nextPosition = event.currentTarget.valueAsNumber
    const audio = audioRef.current
    if (audio) audio.currentTime = nextPosition
    playbackPositionRef.current = nextPosition
    setPosition(nextPosition)
  }

  return <section className="radio-widget" aria-labelledby="radio-widget-heading" data-testid="generative-radio">
    <header className="radio-widget-topline">
      <div className="radio-live-label"><i aria-hidden="true" /> <span>GEN RADIO</span><small>FLUX VIVANT</small></div>
      <div className="radio-engine-label"><span>STABLE AUDIO 3 / {modelVariant.toUpperCase()}</span><b>LOCAL SFT · 1,5×</b></div>
    </header>

    <div className="radio-widget-grid">
      <div className="radio-player-column">
        <div className="radio-model-frame radio-sft-frame">
          <div className="radio-sft-visual" aria-hidden="true">
            <div className="radio-sft-mark"><strong>SA3</strong><span>MEDIUM / {modelVariant.toUpperCase()} / MLX</span></div>
            <div className="radio-sft-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <span className="radio-sft-corner">DIFFUSION / 8 STEPS</span>
          </div>
          <span className="radio-model-stamp">SFT / STABLE AUDIO 3</span>
          <label className={`radio-model-upload ${modelImportState === 'uploading' ? 'is-uploading' : ''}`}>
            <input className="radio-file-input" type="file" accept=".safetensors,application/octet-stream" onChange={(event) => void handleSftFile(event)} aria-label="Charger un SFT Stable Audio 3" disabled={modelImportState === 'uploading'} />
            <span>{modelImportState === 'uploading' ? 'IMPORT EN COURS…' : '＋ IMPORTER UN SFT'}</span>
          </label>
        </div>
        <div className={`radio-sft-details ${selectedAdapter || quantizedModelSelected ? 'is-ready' : ''}`} aria-live="polite">
          <strong>{quantizedModelSelected ? selectedModelVariant?.label : selectedAdapter?.filename ?? sftFile?.name ?? 'Aucun SFT chargé'}</strong>
          <small>{quantizedModelSelected ? `${selectedModelVariant?.size_bytes ? formatBytes(selectedModelVariant.size_bytes) : 'poids locaux'} · SFT Berlin fusionné · influence 25% fixe` : selectedAdapter ? `${formatBytes(selectedAdapter.size_bytes)} · adaptateur local prêt` : sftFile ? `${formatBytes(sftFile.size)} · en attente du moteur local` : 'Fichier .safetensors Stable Audio 3 requis'}</small>
        </div>
        {modelOptions.length > 0 && <label className="radio-model-select" htmlFor="radio-installed-sft"><span>SFT installés</span><select id="radio-installed-sft" value={selectedAdapter?.id ?? ''} onChange={selectInstalledModel}><option value="">Choisir un adaptateur…</option>{modelOptions.map((model) => <option key={model.id} value={model.id}>{model.filename}</option>)}</select></label>}
        <label className="radio-model-select" htmlFor="radio-model-variant"><span>Variante du modèle</span><select id="radio-model-variant" value={modelVariant} onChange={selectModelVariant}>{modelVariantOptions.map((variant) => <option key={variant.id} value={variant.id} disabled={!variant.available}>{variant.label}{variant.available ? '' : ' · non installée'}</option>)}</select><small>{selectedModelVariant?.description ?? 'Choisis une précision Stable Audio 3.'}</small></label>
        <a className="radio-model-help" href="https://huggingface.co/stabilityai/stable-audio-3-medium" target="_blank" rel="noreferrer">Looking for a model? <span>Stable Audio 3 Medium on Hugging Face ↗</span></a>
        {(selectedAdapter || sftFile) && <button className="radio-model-reset" type="button" onClick={resetModel}>Retirer le SFT sélectionné</button>}

        <div className="radio-track-copy">
          <span className="radio-eyebrow">NOW PLAYING</span>
          <h2 id="radio-widget-heading">{currentTrack?.title ?? 'En attente du premier programme'}</h2>
          <p><span>{currentTrack ? `${currentTrack.key} · ${currentTrack.bpm} BPM` : 'Aucun audio chargé'}</span><b>{evolutionLabels.find((item) => item.id === displayedEvolution)?.label}</b></p>
        </div>

        <div className="radio-transport">
          <button className="radio-play" type="button" onClick={() => void togglePlayback()} aria-pressed={playing} aria-label={playing ? 'Mettre la radio en pause' : 'Lancer la radio'} disabled={generating && !currentTrack}>{playing ? 'Ⅱ' : '▶'}</button>
          <div className="radio-timeline">
            <div className="radio-timeline-bar"><i style={{ width: `${progress}%` }} aria-hidden="true" /><input type="range" min="0" max={currentTrackDuration} step="0.1" value={Math.min(position, currentTrackDuration)} onChange={handleSeek} aria-label="Position dans le programme" disabled={!currentTrack} /></div>
            <div className="radio-timeline-meta"><span>{formatClock(position)}</span><span>{formatClock(currentTrackDuration)}</span></div>
          </div>
        </div>
        <audio ref={audioRef} className="radio-audio" src={currentTrack?.audioUrl} preload="auto" aria-label={currentTrack ? `Lecture de ${currentTrack.title}` : 'Lecteur Stable Audio 3'} onPlay={() => { setPlaying(true); void dspRef.current?.resume() }} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Le WAV généré ne peut pas être décodé par le navigateur.'); setStatus('Lecture impossible · le moteur prépare un WAV compatible navigateur.') }} onTimeUpdate={handleAudioTimeUpdate} onLoadedMetadata={() => { if (audioRef.current?.duration && Number.isFinite(audioRef.current.duration)) setPosition(Math.min(audioRef.current.currentTime, audioRef.current.duration)) }} onEnded={handleAudioEnded} />

        <div className="radio-buffer" aria-label="État du programme">
          <div className="radio-buffer-heading"><span>PROGRAMME AUDIO</span><b>{generating || continuationGenerating ? `${generationProgress}%` : bufferAdvance}</b></div>
          <div className="radio-buffer-track" aria-hidden="true"><i className={currentTrack ? 'is-playing' : 'is-empty'} /><i className={generating || continuationGenerating ? 'is-building' : currentTrack ? 'is-ready' : 'is-empty'} /><i className={continuationTrack ? 'is-ready' : 'is-empty'} /><i className="is-empty" /></div>
          <div className="radio-buffer-meta"><span>{currentTrack ? 'PROGRAMME' : 'VIDE'}</span><span>{generating ? 'COMPOSITION' : continuationBufferState}</span><span>UN SEUL FLUX</span><span>{currentTrack ? 'SANS COUPURE' : 'PRÊT'}</span></div>
        </div>
      </div>

      <form className="radio-recipe" noValidate onSubmit={(event) => void handleStart(event)} data-testid="radio-form">
            <div className="radio-recipe-heading"><div><span className="radio-eyebrow">DIRECTIVE SONORE</span><h3>Façonne ta radio</h3></div><span className="radio-recipe-count">{tagCountLabel}</span></div>
        <label className="radio-keyword-field" htmlFor="radio-keywords"><span>Mots-clés</span><small>Pool sans limite · virgules ou retours à la ligne · tirage différent à chaque génération</small><textarea className="radio-keyword-textarea resize-none" ref={keywordsRef} id="radio-keywords" rows={3} value={keywords} onChange={(event) => { setKeywords(event.currentTarget.value); if (error) setError(null) }} placeholder="ambient pads, broken beat…" aria-describedby={error ? 'radio-error' : undefined} aria-invalid={Boolean(error)} /></label>
        <div className="radio-keyword-chips" aria-label="Tags utilisés par la génération">{displayedTags.map((token) => <span key={token}>{token}</span>)}</div>

        <div className="radio-procedural-panel" data-testid="radio-procedural-panel">
          <div className="radio-procedural-toggle">
            <i aria-hidden="true" />
            <span><strong>Évolution procédurale</strong><small>Seuls les tags saisis sont utilisés comme matière; tempo, énergie et couches dérivent lentement</small></span>
            <b>ON</b>
          </div>
          <p>{activeRecipe ? `Flux actif · ${activeRecipe.tags.length} tags tirés au hasard depuis un pool de ${activeRecipe.keywordPool.length} tags utilisateur · ${activeRecipe.bpm} BPM · énergie ${activeRecipe.energy}% · matière ${activeRecipe.texture}%` : `Tags utilisateur uniquement · nombre de tags variable à chaque génération · tempo, énergie et matière évoluent sur 6 min`}</p>
        </div>

        <div className="radio-dsp-panel" data-testid="radio-dsp-panel">
          <label className="radio-dsp-switch" htmlFor="radio-dsp-enabled">
            <input id="radio-dsp-enabled" type="checkbox" checked={dspEnabled} onChange={(event) => setDspEnabled(event.currentTarget.checked)} />
            <span><strong>DSP PRO / MONITORING</strong><small>Préampli, nettoyage spectral et finition intégrés à la lecture</small></span>
            <b>{dspEnabled ? 'ON' : 'OFF'}</b>
          </label>
          <p>Chaîne temps réel · le WAV généré reste intact · réglages appliqués uniquement au player.</p>
          <div className="radio-dsp-control-grid">
            <label className="radio-slider-field" htmlFor="radio-preamp"><span>Préampli <b>{formatDecibels(preampDb)}</b></span><input id="radio-preamp" type="range" min="-12" max="12" step="0.5" value={preampDb} style={percentStyle((preampDb + 12) / 24 * 100)} onChange={(event) => setPreampDb(event.currentTarget.valueAsNumber)} /></label>
            <label className="radio-slider-field" htmlFor="radio-dsp-amount"><span>DSP / clarté <b>{dspAmount}%</b></span><input id="radio-dsp-amount" type="range" min="0" max="100" step="1" value={dspAmount} style={percentStyle(dspAmount)} onChange={(event) => setDspAmount(event.currentTarget.valueAsNumber)} disabled={!dspEnabled} /></label>
            <label className="radio-slider-field" htmlFor="radio-noise-filter"><span>Filtre bruit <b>{noiseFilter}%</b></span><input id="radio-noise-filter" type="range" min="0" max="100" step="1" value={noiseFilter} style={percentStyle(noiseFilter)} onChange={(event) => setNoiseFilter(event.currentTarget.valueAsNumber)} disabled={!dspEnabled} /></label>
            <label className="radio-dsp-switch radio-dsp-limiter-switch" htmlFor="radio-limiter-enabled">
              <input id="radio-limiter-enabled" type="checkbox" checked={limiterEnabled} onChange={(event) => setLimiterEnabled(event.currentTarget.checked)} />
              <span><strong>LIMITER INTELLIGENT</strong><small>Auto-trim + plafond de sécurité</small></span>
              <b>{limiterEnabled ? 'ON' : 'OFF'}</b>
            </label>
            <label className="radio-slider-field" htmlFor="radio-limiter-ceiling"><span>Plafond <b>{formatDecibels(limiterCeilingDb)}</b></span><input id="radio-limiter-ceiling" type="range" min="-6" max="-0.3" step="0.1" value={limiterCeilingDb} style={percentStyle((limiterCeilingDb + 6) / 5.7 * 100)} onChange={(event) => setLimiterCeilingDb(event.currentTarget.valueAsNumber)} disabled={!limiterEnabled} /></label>
          </div>
          <div className="radio-dsp-meter" aria-label="Mètre de sortie DSP">
            <div className="radio-dsp-meter-heading"><span>MONITORING LIVE</span><b>{limiterEnabled ? `GR ${formatDecibels(dspMeter.gainReductionDb)}` : 'LIMITEUR OFF'}</b></div>
            <div className="radio-dsp-meter-bar"><i style={{ width: `${clamp((dspMeter.outputPeakDb + 60) / 60 * 100, 0, 100)}%` }} /></div>
            <div className="radio-dsp-meter-values"><span>IN {formatDecibels(dspMeter.inputPeakDb)}</span><span>OUT {formatDecibels(dspMeter.outputPeakDb)}</span><span>CEIL {formatDecibels(limiterCeilingDb)}</span></div>
          </div>
        </div>

        <div className="radio-control-grid">
          <label className="radio-slider-field" htmlFor="radio-bpm"><span>Tempo de base <b>{bpm} BPM</b></span><input id="radio-bpm" type="range" min="60" max="220" step="1" value={bpm} style={percentStyle((bpm - 60) / 160 * 100)} onChange={(event) => setBpm(event.currentTarget.valueAsNumber)} /></label>
          <label className="radio-slider-field" htmlFor="radio-drift"><span>Dérive <b>±{Math.round(drift / 4)} BPM</b></span><input id="radio-drift" type="range" min="0" max="100" step="1" value={drift} style={percentStyle(drift)} onChange={(event) => setDrift(event.currentTarget.valueAsNumber)} /></label>
          <label className="radio-slider-field" htmlFor="radio-energy"><span>Énergie <b>{energy}%</b></span><input id="radio-energy" type="range" min="0" max="100" step="1" value={energy} style={percentStyle(energy)} onChange={(event) => setEnergy(event.currentTarget.valueAsNumber)} /></label>
          <label className="radio-slider-field" htmlFor="radio-texture"><span>Matière <b>{texture}%</b></span><input id="radio-texture" type="range" min="0" max="100" step="1" value={texture} style={percentStyle(texture)} onChange={(event) => setTexture(event.currentTarget.valueAsNumber)} /></label>
          <label className="radio-slider-field" htmlFor="radio-duration"><span>Programme <b>{formatClock(durationSeconds)}</b></span><input id="radio-duration" type="range" min={minimumRadioProgramSeconds} max={maximumRadioProgramSeconds} step="1" value={durationSeconds} style={percentStyle((durationSeconds - minimumRadioProgramSeconds) / (maximumRadioProgramSeconds - minimumRadioProgramSeconds) * 100)} onChange={(event) => setDurationSeconds(event.currentTarget.valueAsNumber)} /></label>
          <label className="radio-slider-field" htmlFor="radio-sft-strength"><span>Influence SFT <b>{quantizedModelSelected ? '25% FIXE' : `${loraStrength}%`}</b></span><input id="radio-sft-strength" type="range" min="0" max="100" step="1" value={quantizedModelSelected ? 25 : loraStrength} style={percentStyle(quantizedModelSelected ? 25 : loraStrength)} onChange={(event) => setLoraStrength(event.currentTarget.valueAsNumber)} disabled={quantizedModelSelected} /></label>
        </div>

        <fieldset className="radio-evolution-field"><legend>Courbe d’évolution</legend><div className="radio-evolution-options">{evolutionLabels.map((item) => <button key={item.id} className={evolution === item.id ? 'is-selected' : ''} type="button" aria-pressed={evolution === item.id} onClick={() => setEvolution(item.id)}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div></fieldset>

        <div className="radio-recipe-footer">
          <span className="radio-procedural-footer-toggle radio-static-mode"><i aria-hidden="true" /> <span>Auto-évolution</span><b>ON</b></span>
          <span className="radio-program-mode"><i aria-hidden="true" /> <span>Programme unique</span><b>ÉVOLUTIF</b></span>
          <button className="radio-generate-button" type="button" disabled={generating || continuationGenerating || modelImportState === 'uploading' || !selectedModelVariant?.available} onClick={() => void generateNext()}>{generating ? 'COMPOSITION EN COURS…' : continuationGenerating ? 'MORCEAU INDÉPENDANT EN CALCUL…' : currentTrack ? '✦ RÉGÉNÉRER LE PROGRAMME' : '✦ GÉNÉRER LE PROGRAMME'}</button>
        </div>
        {error && <p className="radio-error" id="radio-error" role="alert">{error}</p>}
        <p className="radio-status" role="status" aria-live="polite"><i aria-hidden="true" />{status}</p>
      </form>
    </div>

    <div className="radio-queue" aria-label="Programme de la radio">
      {activeQueueTrack ? <>
        <RadioTrackCard track={activeQueueTrack} slot="current" statusLabel={currentTrack ? (playing ? 'PLAYING / ACTIF' : 'PAUSED / PAUSE') : 'BUILDING / CALCUL'} building={!currentTrack} />
        {nextQueueTrack ? <RadioTrackCard track={nextQueueTrack} slot="next" statusLabel={continuationTrack ? 'READY / PRÊT' : continuationGenerating ? `BUILDING / ${generationProgress}%` : 'WAITING / ATTENTE'} building={continuationGenerating} /> : <div className="radio-queue-row is-next is-empty" data-testid="next-radio-track" aria-label="Prochain morceau"><div className="radio-queue-track-heading"><span>02 · UP NEXT</span><b>WAITING / ATTENTE</b></div><strong className="radio-queue-title">Prochain morceau en attente</strong><small>Les paramètres complets apparaîtront dès le lancement de sa préparation.</small></div>}
      </> : <div className="radio-queue-empty">Aucun flux dans le lecteur · importe ton SFT puis lance la composition.</div>}
    </div>
  </section>
}
