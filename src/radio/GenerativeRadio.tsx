import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type CSSProperties, type ReactElement } from 'react'
import { RadioDialog } from './RadioDialog'
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
import {
  CATEGORY_LABELS,
  formatPhasesPrompt,
  STABLE_AUDIO_TAGS,
  STABLE_AUDIO_TAG_CATALOG_NOTE,
  TRACK_PHASES,
  type TagCategory,
} from './stable-audio-tags'

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
  steps?: number
  cfg?: number
  apg?: number
  negativePrompt?: string
  phases?: string[]
  fixedTags?: string[]
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
  fixedTags?: string[]
  phases?: string[]
  bpm: number
  drift: number
  energy: number
  texture: number
  evolution: RadioEvolution
  durationSeconds: number
  loraStrength: number
  modelVariant: StableAudioRadioModelVariantId
  seed: number
  steps?: number
  cfg?: number
  apg?: number
  negativePrompt?: string
}

type RadioGenerationSettings = Omit<RadioRecipe, 'tags' | 'keywordPool' | 'seed'> & {
  customSeed?: number
  sftFile?: File | null
  sftId?: string | null
}

type ModelImportState = 'idle' | 'uploading' | 'ready' | 'error'

const defaultKeywords = 'minimal, minimal techno'
const defaultNegativePrompt = 'lead vocals, singing, speech, spoken words, vocal chops, broadband static, silence, clipping, abrupt truncation'
const defaultSteps = 8
const defaultCfg = 1.0
const defaultApg = 1.0

export const RADIO_KEYWORDS_STORAGE_KEY = 'onus-generative-radio-keywords'
export const RADIO_NEGATIVE_PROMPT_STORAGE_KEY = 'onus-generative-radio-negative-prompt'
export const RADIO_PHASES_STORAGE_KEY = 'onus-generative-radio-phases'
export const RADIO_FIXED_TAGS_STORAGE_KEY = 'onus-generative-radio-fixed-tags'

const initialKeywords = (): string => {
  if (typeof window === 'undefined') return defaultKeywords
  try {
    const stored = window.localStorage.getItem(RADIO_KEYWORDS_STORAGE_KEY)
    return stored !== null && stored.trim() !== '' ? stored : defaultKeywords
  } catch {
    return defaultKeywords
  }
}

const initialNegativePrompt = (): string => {
  if (typeof window === 'undefined') return defaultNegativePrompt
  try {
    const stored = window.localStorage.getItem(RADIO_NEGATIVE_PROMPT_STORAGE_KEY)
    return stored !== null && stored.trim() !== '' ? stored : defaultNegativePrompt
  } catch {
    return defaultNegativePrompt
  }
}

const initialPhases = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(RADIO_PHASES_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
    return []
  } catch {
    return []
  }
}

const initialFixedTags = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(RADIO_FIXED_TAGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    }
    return []
  } catch {
    return []
  }
}

const minimumRadioProgramSeconds = 120
const maximumRadioProgramSeconds = 360
const defaultProgramDurationSeconds = 330
const maximumSftBytes = 2 * 1024 * 1024 * 1024
const fallbackModelVariants: readonly StableAudioRadioModelVariant[] = [
  {
    id: 'fp16',
    label: 'FP16 · modèle importé',
    description: 'Modèle choisi dans la page, précision native',
    available: true,
    bits: null,
    size_bytes: null,
    merged_sft: false,
    lora_strength: null,
  },
  {
    id: 'int8',
    label: 'INT8 · modèle Berlin fusionné',
    description: 'DiT Medium quantifié INT8 · modèle Berlin intégré',
    available: false,
    bits: 8,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int4',
    label: 'INT4 · modèle Berlin fusionné',
    description: 'DiT Medium quantifié INT4 · modèle Berlin intégré',
    available: false,
    bits: 4,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int2',
    label: 'INT2 · modèle Berlin fusionné',
    description: 'DiT Medium quantifié INT2 · modèle Berlin intégré',
    available: false,
    bits: 2,
    size_bytes: null,
    merged_sft: true,
    lora_strength: 0.25,
  },
  {
    id: 'int1',
    label: 'INT1 · modèle Berlin expérimental',
    description: 'DiT Medium binaire packé INT1 · modèle Berlin intégré',
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

const buildEqCurve = (lowGainDb: number, midGainDb: number, highGainDb: number, enabled: boolean): number[] => {
  if (!enabled) return new Array(96).fill(0)
  return Array.from({ length: 96 }, (_, index) => {
    const frequency = 20 * 1000 ** (index / 95)
    const lowWeight = 1 / (1 + (frequency / 180) ** 4)
    const midDistance = Math.log(frequency / 2_200) / Math.log(2)
    const midWeight = Math.exp(-0.5 * (midDistance / 1.15) ** 2)
    const highWeight = 1 / (1 + (4_500 / frequency) ** 4)
    return lowGainDb * lowWeight + midGainDb * midWeight + highGainDb * highWeight
  })
}

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

const buildProceduralRecipe = (input: RadioGenerationSettings, variation: number, enabled: boolean): RadioRecipe => {
  const keywordPool = parseKeywords(input.keywords)
  const fixedTags = parseKeywords((input.fixedTags ?? []).join('\n'))
  const fixedLower = new Set(fixedTags.map((t) => t.toLowerCase()))
  const variablePool = keywordPool.filter((t) => !fixedLower.has(t.toLowerCase()))
  const normalizedKeywords = Array.from(new Set([...fixedTags, ...keywordPool])).join(', ')
  const autoSeed = hashString(`${normalizedKeywords}:${variation}`) % 2_147_483_647
  const seed = typeof input.customSeed === 'number' && Number.isFinite(input.customSeed)
    ? input.customSeed
    : autoSeed
  // Fixed tags are the base of every recipe; optional tags are sampled only
  // from the user's keyword field, never from the built-in catalogue.
  const variableTags = enabled ? pickGenerationTags(variablePool, seed) : [...variablePool]
  const tags = Array.from(new Set([...fixedTags, ...variableTags]))
  const phases = input.phases ?? []
  const phasesSuffix = phases.length > 0 ? formatPhasesPrompt(phases) : ''
  const generatedKeywords = [tags.join(', '), phasesSuffix].filter(Boolean).join(' · ')
  const baseRecipe: RadioRecipe = {
    ...input,
    keywords: generatedKeywords,
    tags,
    keywordPool,
    fixedTags,
    phases,
    seed,
    steps: input.steps ?? defaultSteps,
    cfg: input.cfg ?? defaultCfg,
    apg: input.apg ?? defaultApg,
    negativePrompt: input.negativePrompt ?? defaultNegativePrompt,
  }
  if (!enabled || variation === 0) return baseRecipe

  // Auto-evolution may change the non-tempo controls, but it must never
  // invent a style, instrument, texture, or other content tag. BPM is the
  // user's hard target and must stay identical for every generated window.

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
    bpm: input.bpm,
    drift: input.drift,
    energy: clamp(Math.round(input.energy + swing(3, 18)), 0, 100),
    texture: clamp(Math.round(input.texture + swing(4, 20)), 0, 100),
    evolution: nextEvolution[input.evolution][variation % nextEvolution[input.evolution].length]!,
    durationSeconds: clamp(Math.round(input.durationSeconds + swing(5, 12)), minimumRadioProgramSeconds, maximumRadioProgramSeconds),
    loraStrength: input.modelVariant === 'fp16'
      ? clamp(Number((input.loraStrength + swing(6, 0.12)).toFixed(3)), 0, 1)
      : 0.25,
    modelVariant: input.modelVariant,
    seed,
    steps: input.steps ?? defaultSteps,
    cfg: input.cfg ?? defaultCfg,
    apg: input.apg ?? defaultApg,
    negativePrompt: input.negativePrompt ?? defaultNegativePrompt,
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
  key: '—',
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
  bpm: recipe.bpm,
  key: result.key ?? '—',
  durationSeconds: result.durationSeconds ?? recipe.durationSeconds,
  audioUrl: result.audioUrl,
  state: 'ready',
})

const buildContinuationRecipe = (
  sourceRecipe: RadioRecipe,
  variation: number,
  latestSettings?: RadioGenerationSettings,
): RadioRecipe => buildProceduralRecipe(latestSettings ?? {
  keywords: sourceRecipe.keywordPool.join(', '),
  fixedTags: sourceRecipe.fixedTags,
  phases: sourceRecipe.phases,
  bpm: sourceRecipe.bpm,
  drift: sourceRecipe.drift,
  energy: sourceRecipe.energy,
  texture: sourceRecipe.texture,
  evolution: sourceRecipe.evolution,
  durationSeconds: sourceRecipe.durationSeconds,
  loraStrength: sourceRecipe.loraStrength,
  modelVariant: sourceRecipe.modelVariant,
  steps: sourceRecipe.steps,
  cfg: sourceRecipe.cfg,
  apg: sourceRecipe.apg,
  negativePrompt: sourceRecipe.negativePrompt,
}, variation, true)

const MachineKey = ({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement =>
  <button {...props} className={className}>
    {className.includes('machine-generate') && ['machine-button-frame', 'machine-button-cap'].map((layer) =>
      <span key={layer} className={`machine-button-skin ${layer}`} aria-hidden="true">{[[651, 47], [698, 171], [869, 47]].map(([x, width]) =>
        <svg key={x} viewBox={`${x} 998 ${width} 153`} preserveAspectRatio="none"><image href="/assets/hardware/components-v1.png" width="1254" height="1254" /></svg>
      )}</span>
    )}
    <span className="machine-key-label">{children}</span>
  </button>

type MachineKnobProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  display: string
  onChange: (value: number) => void
  accent?: 'lime' | 'cyan' | 'orange' | 'pink' | 'red'
  disabled?: boolean
}

const MachineKnob = ({ id, label, value, min, max, step = 1, display, onChange, accent = 'lime', disabled = false }: MachineKnobProps): ReactElement => {
  const initialValue = useRef(value)
  const drag = useRef<{ x: number; y: number; value: number } | null>(null)
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const style = { '--knob-angle': `${-135 + ratio * 270}deg`, '--knob-arc': `${ratio * 270}deg` } as CSSProperties
  return <label className={`machine-knob is-${accent} ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
    <span className="machine-knob-label">{label}</span>
    <span className="machine-knob-control" style={style}>
      <span className="machine-knob-body" aria-hidden="true">
        <svg className="machine-led-ring" viewBox="0 0 100 100"><path className="machine-led-track" d="M17.47 82.53A46 46 0 1 1 82.53 82.53" /><path className="machine-led-fill" d="M17.47 82.53A46 46 0 1 1 82.53 82.53" pathLength="100" strokeDasharray={`${ratio * 100} 100`} /></svg>
        <i />
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-label={label} aria-valuetext={display}
        onChange={(event) => { if (!drag.current) onChange(event.currentTarget.valueAsNumber) }}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, value } }}
        onPointerMove={(event) => { if (!drag.current) return; const delta = (drag.current.y - event.clientY + (event.clientX - drag.current.x) * .35) * (max - min) / (event.shiftKey ? 1800 : 180); onChange(Number(clamp(Math.round((drag.current.value + delta) / step) * step, min, max).toFixed(4))) }}
        onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onDoubleClick={() => onChange(initialValue.current)} />
    </span>
    <span className="machine-screen machine-knob-value" aria-hidden="true">{display}</span>
  </label>
}

const defaultRadioDspMeter: RadioDspMeter = { inputPeakDb: -60, outputPeakDb: -60, gainReductionDb: 0 }

type TrackReadoutProps = {
  track: RadioTrack | null
  next?: boolean
  status: string
  progress: number
  position?: number
}

const TrackReadout = ({ track, next = false, status, progress, position = 0 }: TrackReadoutProps): ReactElement =>
  <section className={`machine-panel machine-track-panel ${next ? 'is-next' : 'is-current'}`} aria-label={next ? 'Prochain morceau' : 'Morceau actif'} data-testid={next ? 'next-radio-track' : 'current-radio-track'}>
    <h2 className="machine-silkscreen">{next ? 'À SUIVRE' : 'EN LECTURE'}</h2>
    <div className="machine-screen machine-track-screen">
      <div className="machine-screen-head"><span>{next ? '02 / NEXT' : '01 / NOW'}</span><b>{status}</b></div>
      <h3 title={track?.title}>{track?.title ?? (next ? 'Prochain morceau en attente' : 'Aucun morceau chargé')}</h3>
      <div className="machine-track-clock"><strong>{track ? formatClock(next ? track.durationSeconds : position) : '--:--'}</strong><span>{next ? (track?.audioUrl ? 'DURÉE' : 'DURÉE CIBLE') : `/ ${track ? formatClock(track.durationSeconds) : '--:--'}`}</span><div className="machine-progress" aria-label={next ? 'Préparation du prochain morceau' : 'Avancement du morceau'}><i style={{ width: `${progress}%` }} /></div></div>
      <dl className="machine-data-grid">
        {[
          ['BPM CIBLE', track?.bpm], ['TONALITÉ', track?.key], ['ÉNERGIE', track ? `${track.recipe.energy}%` : null], ['TEXTURE', track ? `${track.recipe.texture}%` : null],
          ['MODÈLE', track?.recipe.modelVariant.toUpperCase()], ['SEED', track?.recipe.seed], ['ÉVOLUTION', track ? evolutionLabel(track.evolution) : null], ['MODE', track ? track.mode === 'independent' ? 'LIBRE' : 'CONTINU' : null],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}
      </dl>
      <div className="machine-track-detail"><span>TAGS</span><p title={track?.recipe.keywords}>{track?.recipe.keywords ?? '—'}</p></div>
      <div className="machine-track-detail"><span>STRUCT.</span><p>{track ? track.recipe.phases?.join(' › ') || 'AUTO' : '—'}</p></div>
    </div>
  </section>

type GenerativeRadioProps = {
  onBack?: () => void
  engineMessage?: string | null
  pairingUrl?: string
  runtimeReady?: boolean | null
  onReconnect?: () => Promise<void>
  availableModels?: readonly StableAudioRadioAdapter[]
  availableModelVariants?: readonly StableAudioRadioModelVariant[]
  initialFixedTags?: readonly string[]
  initialPhases?: readonly string[]
  onClearModel?: () => void
  onGenerate?: (request: RadioGenerationRequest, onProgress?: (progress: number) => void) => Promise<RadioGenerationResult | void>
  onImportModel?: (file: File) => Promise<StableAudioRadioAdapter | void>
  onReleaseAudioUrl?: (audioUrl?: string) => void
  onSelectModel?: (model: StableAudioRadioAdapter) => void
  selectedModel?: StableAudioRadioAdapter | null
}

export const GenerativeRadio = ({
  onBack,
  engineMessage,
  pairingUrl,
  runtimeReady = true,
  onReconnect,
  availableModels = [],
  availableModelVariants = [],
  initialFixedTags: initialFixedTagsProp,
  initialPhases: initialPhasesProp,
  onClearModel,
  onGenerate,
  onImportModel,
  onReleaseAudioUrl,
  onSelectModel,
  selectedModel,
}: GenerativeRadioProps): ReactElement => {
  const machineRef = useRef<HTMLElement | null>(null)
  const [machineFit, setMachineFit] = useState({ scale: 1, height: 0 })

  useLayoutEffect(() => {
    const machine = machineRef.current
    if (!machine) return
    const fit = () => {
      const height = machine.offsetHeight
      if (!height) return
      const page = machine.closest('.radio-page')
      const pageStyle = page ? getComputedStyle(page) : null
      const inset = pageStyle ? parseFloat(pageStyle.paddingTop) + parseFloat(pageStyle.paddingBottom) : 16
      const scale = window.innerWidth > 820 ? Math.min(1, Math.max(0.1, (window.innerHeight - inset) / height)) : 1
      setMachineFit((previous) => Math.abs(previous.scale - scale) < .0001 && previous.height === height ? previous : { scale, height })
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(machine)
    window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit) }
  }, [])

  const [reconnecting, setReconnecting] = useState(false)
  const [keywords, setKeywords] = useState(initialKeywords)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedExcludedTag, setSelectedExcludedTag] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null)
  const [phases, setPhases] = useState<string[]>(() => {
    if (initialPhasesProp && initialPhasesProp.length > 0) return [...initialPhasesProp]
    return initialPhases()
  })
  const [fixedTags, setFixedTags] = useState<string[]>(() => {
    if (initialFixedTagsProp && initialFixedTagsProp.length > 0) return [...initialFixedTagsProp]
    return initialFixedTags()
  })
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [modalCategory, setModalCategory] = useState<TagCategory | 'all'>('all')
  const [modalSearch, setModalSearch] = useState('')
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
  const [steps, setSteps] = useState(defaultSteps)
  const [cfg, setCfg] = useState(defaultCfg)
  const [apg, setApg] = useState(defaultApg)
  const [seedInput, setSeedInput] = useState('')
  const [negativePrompt, setNegativePrompt] = useState(initialNegativePrompt)
  const [preampDb, setPreampDb] = useState(defaultRadioDspSettings.preampDb)
  const [lowGainDb, setLowGainDb] = useState(1.5)
  const [midGainDb, setMidGainDb] = useState(-0.5)
  const [highGainDb, setHighGainDb] = useState(2)
  const [volume, setVolume] = useState(78)
  const [dspEnabled, setDspEnabled] = useState(defaultRadioDspSettings.dspEnabled)
  const [noiseFilter, setNoiseFilter] = useState(defaultRadioDspSettings.noiseFilter)
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
  const [status, setStatus] = useState('Importe un modèle Stable Audio 3 ou choisis une variante INT8/INT4/INT2/INT1.')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const dspRef = useRef<RadioDspController | null>(null)
  const playbackPositionRef = useRef(position)
  const keywordsRef = useRef<HTMLTextAreaElement | null>(null)
  const generateNextRef = useRef<(autoplay?: boolean) => Promise<void>>(async () => undefined)
  const autoplayAfterGenerationRef = useRef(false)
  const variationCounterRef = useRef(0)
  const currentTrackRef = useRef<RadioTrack | null>(null)
  const continuationTrackRef = useRef<RadioTrack | null>(null)
  const continuationGeneratingRef = useRef(false)
  const programSessionRef = useRef(0)
  const playbackEndedRef = useRef(false)
  const latestGenerationSettingsRef = useRef<RadioGenerationSettings | null>(null)

  useEffect(() => {
    if (selectedModel) {
      setLocalModel(selectedModel)
      setModelImportState('ready')
      setStatus(`Modèle Stable Audio 3 sélectionné · ${selectedModel.filename}`)
    }
  }, [selectedModel])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(RADIO_KEYWORDS_STORAGE_KEY, keywords)
    } catch {
      // Ignore storage errors
    }
  }, [keywords])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(RADIO_NEGATIVE_PROMPT_STORAGE_KEY, negativePrompt)
    } catch {
      // Ignore storage errors
    }
  }, [negativePrompt])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(RADIO_PHASES_STORAGE_KEY, JSON.stringify(phases))
    } catch {
      // Ignore storage errors
    }
  }, [phases])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(RADIO_FIXED_TAGS_STORAGE_KEY, JSON.stringify(fixedTags))
    } catch {
      // Ignore storage errors
    }
  }, [fixedTags])


  useEffect(() => {
    playbackPositionRef.current = position
  }, [position])

  const keywordTokens = useMemo(() => parseKeywords(keywords), [keywords])
  const negativePromptTokens = useMemo(() => parseKeywords(negativePrompt), [negativePrompt])
  const moveFacadeTag = (excluded: boolean, direction: number): void => {
    const tokens = [...(excluded ? negativePromptTokens : keywordTokens)]
    const index = tokens.indexOf((excluded ? selectedExcludedTag : selectedTag) ?? '')
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= tokens.length) return
    ;[tokens[index], tokens[destination]] = [tokens[destination]!, tokens[index]!]
    ;(excluded ? setNegativePrompt : setKeywords)(tokens.join(', '))
  }
  const selectedAdapter = selectedModel ?? localModel
  latestGenerationSettingsRef.current = {
    keywords,
    fixedTags: [...fixedTags],
    phases: [...phases],
    bpm,
    drift,
    energy,
    texture,
    evolution,
    durationSeconds,
    loraStrength: modelVariant === 'fp16' ? loraStrength / 100 : 0.25,
    modelVariant,
    steps,
    cfg,
    apg,
    negativePrompt,
    customSeed: seedInput.trim() !== '' && Number.isFinite(Number(seedInput)) ? Number(seedInput) : undefined,
    sftFile: modelVariant === 'fp16' ? sftFile : null,
    sftId: modelVariant === 'fp16' ? selectedAdapter?.id ?? null : null,
  }
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
  const activeQueueTrack = currentTrack ?? (generating && activeRecipe
    ? trackFromRecipe(activeRecipe, variationCounterRef.current, 'programme')
    : null)
  const projectedSourceTrack = currentTrack ?? activeQueueTrack
  const projectedVariation = currentTrack ? variationCounterRef.current : variationCounterRef.current + 1
  const projectedContinuationTrack = projectedSourceTrack
    ? trackFromRecipe(buildContinuationRecipe(projectedSourceTrack.recipe, projectedVariation, latestGenerationSettingsRef.current ?? undefined), projectedVariation, 'independent')
    : null
  const nextQueueTrack = continuationTrack ?? continuationPreview ?? projectedContinuationTrack
  const radioDspSettings = useMemo<RadioDspSettings>(() => ({
    lowGainDb, midGainDb, highGainDb, volume,
    preampDb,
    dspEnabled,
    noiseFilter,
    dspAmount: 0,
    limiterEnabled,
    limiterCeilingDb,
  }), [dspEnabled, limiterCeilingDb, limiterEnabled, noiseFilter, preampDb, lowGainDb, midGainDb, highGainDb, volume])
  const eqResponse = useMemo(
    () => buildEqCurve(lowGainDb, midGainDb, highGainDb, dspEnabled),
    [dspEnabled, highGainDb, lowGainDb, midGainDb],
  )

  useEffect(() => {
    dspRef.current?.setSettings(radioDspSettings)
  }, [radioDspSettings])

  useEffect(() => {
    const meterTimer = window.setInterval(() => {
      if (dspRef.current) {
        setDspMeter(dspRef.current.readMeter())
      }
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
      setError('Choisis un modèle Stable Audio 3 au format .safetensors.')
      event.currentTarget.value = ''
      return
    }
    if (file.size > maximumSftBytes) {
      setError('Le modèle doit peser moins de 2 Go.')
      event.currentTarget.value = ''
      return
    }
    setSftFile(file)
    setLocalModel(null)
    setModelVariant('fp16')
    setModelImportState(onImportModel ? 'uploading' : 'ready')
    setStatus(onImportModel ? `Import du modèle en cours · ${file.name}` : `Modèle sélectionné · ${file.name}`)
    if (!onImportModel) return
    try {
      const adapter = await onImportModel(file)
      if (adapter) setLocalModel(adapter)
      setModelImportState('ready')
      setStatus(`Modèle Stable Audio 3 prêt · ${adapter?.filename ?? file.name}`)
    } catch (importError) {
      setModelImportState('error')
      setError(importError instanceof Error ? importError.message : 'Impossible d’importer ce modèle.')
      setStatus('Import du modèle interrompu.')
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
    setStatus(`Modèle Stable Audio 3 sélectionné · ${model.filename}`)
  }

  const selectModelVariant = (event: ChangeEvent<HTMLSelectElement>): void => {
    const variant = modelVariantOptions.find((item) => item.id === event.currentTarget.value)
    if (!variant || !variant.available) return
    setModelVariant(variant.id)
    setError(null)
    setStatus(
      variant.id === 'fp16'
        ? 'Variante FP16 sélectionnée · le modèle importé sera utilisé.'
        : `${variant.label} sélectionné · le modèle est déjà fusionné dans le DiT.`,
    )
  }

  const resetModel = (): void => {
    setSftFile(null)
    setLocalModel(null)
    setModelVariant('fp16')
    setModelImportState('idle')
    onClearModel?.()
    setError(null)
    setStatus('Aucun modèle chargé · importe un fichier pour reprendre.')
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



  const togglePlayback = async (): Promise<void> => {
    if (!keywords.trim() && fixedTags.length === 0) {
      setError('Ajoute au moins un mot-clé ou un tag fixe pour lancer la radio.')
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
    // Snapshot the controls when this generation enters the queue. Later edits
    // stay pending for the following slot so an already-running request can
    // finish without replacing audio that is about to play.
    const generationSettings = latestGenerationSettingsRef.current
    if (!generationSettings?.keywords.trim() && (!generationSettings?.fixedTags || generationSettings.fixedTags.length === 0)) return

    continuationGeneratingRef.current = true
    setContinuationGenerating(true)
    setGenerationProgress(4)
    const variation = variationCounterRef.current
    // Reserve the sequence slot before awaiting the model. The buffered track
    // can become active while this request is finishing, so allocating here
    // prevents the following prefetch from reusing its seed.
    variationCounterRef.current = variation + 1
    const recipe = buildContinuationRecipe(sourceRecipe, variation, generationSettings)
    const previewTrack = trackFromRecipe(recipe, variation, 'independent')
    setContinuationPreview(previewTrack)
    const request: RadioGenerationRequest = {
      keywords: recipe.keywords,
      phases: recipe.phases,
      fixedTags: recipe.fixedTags,
      bpm: recipe.bpm,
      drift: recipe.drift,
      energy: recipe.energy,
      texture: recipe.texture,
      evolution: recipe.evolution,
      durationSeconds: recipe.durationSeconds,
      loraStrength: recipe.loraStrength,
      modelVariant: recipe.modelVariant,
      sftFile: recipe.modelVariant === 'fp16' ? generationSettings.sftFile ?? null : null,
      sftId: recipe.modelVariant === 'fp16' ? generationSettings.sftId ?? null : null,
      seed: recipe.seed,
      steps: recipe.steps,
      cfg: recipe.cfg,
      apg: recipe.apg,
      negativePrompt: recipe.negativePrompt,
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
      continuationTrackRef.current = completedTrack
      setContinuationTrack(completedTrack)
      setContinuationPreview(null)
      setStatus('Morceau indépendant prêt · transition continue armée.')
      if (playbackEndedRef.current && currentTrackRef.current?.id === sourceTrack.id) {
        // Let the request clean up its in-flight flag before arming the next
        // prefetch. This keeps a late result from stopping the radio between
        // two programmes.
        const preparedTrack = completedTrack
        window.setTimeout(() => {
          if (session !== programSessionRef.current) return
          if (continuationTrackRef.current?.id !== preparedTrack.id) return
          if (currentTrackRef.current?.id !== sourceTrack.id || !playbackEndedRef.current) return
          activateContinuation(preparedTrack)
        }, 0)
      }
    } catch {
      if (session === programSessionRef.current) {
        setContinuationTrack(null)
        setContinuationPreview(null)
        setStatus('Morceau indépendant indisponible · la lecture reste continue.')
      }
    } finally {
      if (session === programSessionRef.current) {
        continuationGeneratingRef.current = false
        setContinuationGenerating(false)
        setGenerationProgress(0)
      }
    }
  }

  function activateContinuation(track: RadioTrack): void {
    if (!track.audioUrl) return
    playbackEndedRef.current = false
    if (currentTrack?.id !== track.id) releaseTrackAudio(currentTrack)
    continuationTrackRef.current = null
    setContinuationTrack(null)
    setContinuationPreview(null)
    currentTrackRef.current = track
    setCurrentTrack(track)
    setPosition(0)
    setPlaying(true)
    setStatus('Morceau indépendant actif · l’arc procédural se poursuit.')
    void prefetchContinuation(track, track.recipe, programSessionRef.current)
  }

  const generateNext = async (autoplay = false): Promise<void> => {
    if (generating || continuationGeneratingRef.current) return
    if (!keywords.trim() && fixedTags.length === 0) {
      setError('Ajoute au moins un mot-clé ou un tag fixe avant de générer le programme.')
      keywordsRef.current?.focus()
      return
    }
    if (modelImportState === 'uploading') {
      setError('Attends la fin de l’import du modèle avant de générer.')
      return
    }
    if (!selectedModelVariant?.available) {
      setError(`La variante ${modelVariant.toUpperCase()} n’est pas installée dans le moteur local.`)
      setStatus('Choisis une variante disponible pour lancer la radio.')
      return
    }
    if (modelVariant === 'fp16' && !selectedAdapter && !sftFile) {
      setError('Importe d’abord un modèle Stable Audio 3 depuis ta machine.')
      setStatus('Aucun modèle ou modèle quantifié sélectionné.')
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
      fixedTags,
      phases,
      bpm,
      drift,
      energy,
      texture,
      evolution,
      durationSeconds,
      loraStrength: modelVariant === 'fp16' ? loraStrength / 100 : 0.25,
      modelVariant,
      steps,
      cfg,
      apg,
      negativePrompt,
      customSeed: seedInput.trim() !== '' && Number.isFinite(Number(seedInput)) ? Number(seedInput) : undefined,
    }, variation, true)
    setActiveRecipe(recipe)
    setStatus('Stable Audio 3 compose un programme continu de plusieurs minutes…')
    const request: RadioGenerationRequest = {
      keywords: recipe.keywords,
      phases: recipe.phases,
      fixedTags: recipe.fixedTags,
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
      steps: recipe.steps,
      cfg: recipe.cfg,
      apg: recipe.apg,
      negativePrompt: recipe.negativePrompt,
      continuationFromId: null,
    }
    try {
      const result = await onGenerate(request, (nextProgress) => setGenerationProgress(clamp(nextProgress, 0, 100)))
      if (!result?.audioUrl) throw new Error('Le moteur n’a pas renvoyé de fichier audio.')
      variationCounterRef.current = variation + 1
      const nextTrack = trackFromResult(result, recipe, variation)
      const previousTrack = currentTrack
      currentTrackRef.current = nextTrack
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

  const handleRemoveKeyword = (keywordToRemove: string): void => {
    const updated = parseKeywords(keywords)
      .filter((token) => token.toLowerCase() !== keywordToRemove.toLowerCase())
      .join(', ')
    setKeywords(updated)
  }

  const handleToggleFixedTag = (tagLabel: string): void => {
    setFixedTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tagLabel.toLowerCase())
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== tagLabel.toLowerCase())
      }
      return [...prev, tagLabel]
    })
  }

  const handleToggleTag = (tagLabel: string): void => {
    const current = parseKeywords(keywords)
    const exists = current.some((token) => token.toLowerCase() === tagLabel.toLowerCase())
    if (exists) {
      handleRemoveKeyword(tagLabel)
    } else {
      setKeywords(current.length > 0 ? `${keywords.trim().replace(/[, ]+$/, '')}, ${tagLabel}` : tagLabel)
    }
  }

  const handleAddPhase = (phaseLabel: string): void => {
    setPhases((prev) => [...prev, phaseLabel])
  }

  const handleRemovePhase = (indexToRemove: number): void => {
    setPhases((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const filteredTags = useMemo(() => {
    const query = modalSearch.trim().toLowerCase()
    return STABLE_AUDIO_TAGS.filter((tag) => {
      if (modalCategory !== 'all' && tag.category !== modalCategory) return false
      if (!query) return true
      return tag.label.toLowerCase().includes(query) || (tag.description && tag.description.toLowerCase().includes(query))
    })
  }, [modalCategory, modalSearch])

  const filteredPhases = useMemo(() => {
    const query = modalSearch.trim().toLowerCase()
    return TRACK_PHASES.filter((phase) => {
      if (!query) return true
      return phase.label.toLowerCase().includes(query) || phase.description.toLowerCase().includes(query) || phase.shortCode.toLowerCase().includes(query)
    })
  }, [modalSearch])

  const needsModel = !selectedModelVariant?.available || (modelVariant === 'fp16' && !selectedAdapter && !sftFile)
  const setupNeeded = runtimeReady !== true || needsModel
  const startListening = () => {
    if (!keywords.trim() && fixedTags.length === 0) { void generateNext(); return }
    if (setupNeeded) { setError(runtimeReady !== true ? engineMessage || 'Connecte le moteur local avec ENGINE.' : 'Choisis une variante installée ou importe ton modèle.'); document.getElementById('machine-model-variant')?.focus(); return }
    const browserWindow = window as Window & typeof globalThis & { webkitAudioContext?: unknown }
    if (browserWindow.AudioContext || browserWindow.webkitAudioContext) void ensureRadioDsp()?.resume()
    void generateNext(true)
  }
  const reconnect = async () => {
    if (!onReconnect || reconnecting) return
    setReconnecting(true)
    setError(null)
    try { await onReconnect() } catch { setError('Connexion impossible. Vérifie que ton moteur local est démarré, puis réessaie.') } finally { setReconnecting(false) }
  }

  return <div className="machine-fit" style={{ height: machineFit.height ? machineFit.height * machineFit.scale : undefined }}><section ref={machineRef} style={{ transform: `scale(${machineFit.scale})` }} className={`radio-widget machine ${playing ? 'is-playing' : ''}`} aria-labelledby="radio-widget-heading" data-testid="generative-radio">
    <header className="machine-toprail">
      <div className="machine-brand"><svg aria-hidden="true" viewBox="0 0 54 48"><path d="M2 27h6l5-13 6 26 7-36 7 39 6-26 5 17 4-7h4" /></svg><h1 id="radio-widget-heading">radio.studio</h1><small>GENERATIVE MUSIC WORKSTATION</small></div>
      <div className="machine-model-screen machine-screen"><select id="machine-model-variant" aria-label="Variante du modèle" value={modelVariant} onChange={selectModelVariant}>{modelVariantOptions.map((variant) => <option key={variant.id} value={variant.id} disabled={!variant.available}>{variant.label}{variant.available ? '' : ' · indisponible'}</option>)}</select><select aria-label="Modèles installés" value={selectedAdapter?.id ?? ''} disabled={quantizedModelSelected} onChange={selectInstalledModel}><option value="">{quantizedModelSelected ? 'BERLIN · FUSIONNÉ' : 'CHOISIR UN MODÈLE'}</option>{modelOptions.map((model) => <option key={model.id} value={model.id}>{model.filename}</option>)}</select>{pairingUrl ? <a href={pairingUrl}>APPAIRER LE MOTEUR ↗</a> : <span>{reconnecting ? 'CONNEXION…' : runtimeReady === false ? 'ENGINE OFFLINE' : runtimeReady === null ? 'SCANNING ENGINE' : needsModel ? 'MODEL REQUIRED' : 'LOCAL READY'}</span>}</div>
      <div className="machine-top-actions">
        {onBack && <MachineKey className="machine-key is-small" type="button" onClick={onBack} aria-label="Retourner au player">←</MachineKey>}
        {onReconnect && <MachineKey className="machine-key is-small" type="button" onClick={() => void reconnect()} disabled={reconnecting}>{reconnecting ? 'SCAN…' : 'ENGINE'}</MachineKey>}
        <label className="machine-key is-small machine-import">IMPORT<input type="file" accept=".safetensors" aria-label="Charger un modèle Stable Audio 3" onChange={(event) => void handleSftFile(event)} disabled={modelImportState === 'uploading'} /></label>
        {(selectedAdapter || sftFile) && <MachineKey type="button" className="machine-key is-small" onClick={resetModel} aria-label="Retirer le modèle sélectionné">×</MachineKey>}
      </div>
    </header>

    <form className="machine-console" noValidate onSubmit={(event) => { event.preventDefault(); startListening() }} data-testid="radio-form">
      <div className="machine-left-stack">
        <section className="machine-panel machine-direction">
        <h2 className="machine-silkscreen">DIRECTION <button type="button" onClick={() => setTagModalOpen(true)} aria-label="Explorer les sons">SONS +</button></h2>
        <div className="machine-tag-display-row">
          <div className="machine-screen machine-prompt-screen">
            <textarea ref={keywordsRef} id="radio-keywords" rows={1} wrap="soft" value={keywords} onChange={(event) => { setKeywords(event.currentTarget.value); if (error) setError(null) }} placeholder="minimal techno, warm textures, deep bass" aria-label="Ta direction sonore" aria-describedby={error?.startsWith('Ajoute au moins') ? 'radio-error' : undefined} aria-invalid={Boolean(error?.startsWith('Ajoute au moins'))} />
            <div className="machine-chip-line">{Array.from(new Set([...keywordTokens, ...fixedTags])).map((tag) => <button type="button" key={tag} aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}>{fixedTags.includes(tag) ? '◆ ' : ''}{tag}</button>)}</div>
          </div>
          <div className="machine-tag-encoder"><MachineKnob id="direction-select" label="Sélection du tag" value={Math.max(0, keywordTokens.indexOf(selectedTag ?? ''))} min={0} max={Math.max(1, keywordTokens.length - 1)} display="" disabled={!keywordTokens.length} onChange={(index) => setSelectedTag(keywordTokens[index] ?? null)} /></div>
        </div>
        <div className="machine-tag-actions">
          <MachineKey type="button" className="machine-key" onClick={() => keywordsRef.current?.focus()}>ADD</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedTag} onClick={() => { if (selectedTag) { handleRemoveKeyword(selectedTag); setFixedTags((tags) => tags.filter((tag) => tag !== selectedTag)) } setSelectedTag(null) }}>REMOVE</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedTag} onClick={() => moveFacadeTag(false, -1)}>LEFT</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedTag} onClick={() => moveFacadeTag(false, 1)}>RIGHT</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedTag} aria-pressed={!!selectedTag && fixedTags.includes(selectedTag)} onClick={() => { if (selectedTag) handleToggleFixedTag(selectedTag) }}>PIN</MachineKey>
        </div>
      </section>
        <section className="machine-panel machine-exclude">
        <h2 className="machine-silkscreen">EXCLUDE <span className="machine-screen machine-count">{negativePromptTokens.length} TAGS</span></h2>
        <div className="machine-tag-display-row">
          <div className="machine-screen machine-negative-screen">
            <textarea id="radio-negative-prompt-face" rows={1} wrap="soft" value={negativePrompt} onChange={(event) => setNegativePrompt(event.currentTarget.value)} aria-label="Exclusions sonores" />
            <div className="machine-chip-line">{negativePromptTokens.map((tag) => <button type="button" key={tag} aria-pressed={selectedExcludedTag === tag} onClick={() => setSelectedExcludedTag(tag)}>{tag}</button>)}</div>
          </div>
          <div className="machine-tag-encoder"><MachineKnob id="exclude-select" label="Sélection du tag négatif" value={Math.max(0, negativePromptTokens.indexOf(selectedExcludedTag ?? ''))} min={0} max={Math.max(1, negativePromptTokens.length - 1)} display="" disabled={!negativePromptTokens.length} onChange={(index) => setSelectedExcludedTag(negativePromptTokens[index] ?? null)} /></div>
        </div>
        <div className="machine-tag-actions">
          <MachineKey type="button" className="machine-key" onClick={() => document.getElementById('radio-negative-prompt-face')?.focus()}>ADD</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedExcludedTag} onClick={() => { setNegativePrompt(negativePromptTokens.filter((tag) => tag !== selectedExcludedTag).join(', ')); setSelectedExcludedTag(null) }}>REMOVE</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedExcludedTag} onClick={() => moveFacadeTag(true, -1)}>LEFT</MachineKey>
          <MachineKey type="button" className="machine-key" disabled={!selectedExcludedTag} onClick={() => moveFacadeTag(true, 1)}>RIGHT</MachineKey>
        </div>
      </section>
        <TrackReadout track={activeQueueTrack} status={generating ? `CALCUL ${generationProgress}%` : playing ? 'PLAY' : currentTrack ? 'PAUSE' : 'STANDBY'} progress={generating ? generationProgress : progress} position={position} />
        <section className="machine-panel machine-evolution" aria-label="Évolution">
        <h2 className="machine-silkscreen">ÉVOLUTION</h2>
        <div>{(['slow', 'fluid', 'wild'] as RadioEvolution[]).map((mode) => <MachineKey type="button" key={mode} className={`machine-key ${evolution === mode ? 'is-selected' : ''}`} aria-pressed={evolution === mode} onClick={() => setEvolution(mode)}>{evolutionLabel(mode)}</MachineKey>)}</div>
      </section>
      </div>

      <section className="machine-panel machine-structure-panel" aria-label="Structure du morceau">
        <h2 className="machine-silkscreen">STRUCTURE <span className="machine-arrangement-actions">
          <select aria-label="Ajouter une phase" value="" onChange={(event) => { if (event.currentTarget.value) { handleAddPhase(event.currentTarget.value); setSelectedPhase(phases.length) } }}><option value="">＋ PHASE</option>{TRACK_PHASES.map((phase) => <option key={phase.id} value={phase.label}>{phase.label}</option>)}</select>
          {[-1, 1].map((direction) => <MachineKey key={direction} type="button" className="machine-key" aria-label={direction < 0 ? 'Déplacer la phase à gauche' : 'Déplacer la phase à droite'} disabled={selectedPhase === null || selectedPhase + direction < 0 || selectedPhase + direction >= phases.length} onClick={() => { if (selectedPhase === null) return; const next = [...phases]; const target = selectedPhase + direction; [next[selectedPhase], next[target]] = [next[target]!, next[selectedPhase]!]; setPhases(next); setSelectedPhase(target) }}>{direction < 0 ? '←' : '→'}</MachineKey>)}
          <MachineKey type="button" className="machine-key" disabled={selectedPhase === null} onClick={() => { if (selectedPhase !== null) handleRemovePhase(selectedPhase); setSelectedPhase(null) }} aria-label="Retirer la phase sélectionnée">−</MachineKey>
        </span></h2>
        <div className="machine-phase-keys">{(phases.length ? phases : ['Intro', 'Build', 'Drop', 'Groove', 'Breakdown', 'Outro']).map((phase, index) => <button type="button" key={`${phase}-${index}`} className={`machine-phase ${phases.length ? '' : 'is-ghost'}`} aria-pressed={phases.length > 0 && selectedPhase === index} aria-label={phases.length ? `Sélectionner ${phase}, position ${index + 1}` : `Insérer ${phase}`} onClick={() => { if (phases.length) setSelectedPhase(index); else { handleAddPhase(phase); setSelectedPhase(0) } }}><span className="machine-pad-art" aria-hidden="true"><i className="machine-pad-frame" /><i className="machine-pad-cap" /></span><span className="machine-phase-label">{phase}</span></button>)}</div>
      </section>

      <section className="machine-panel machine-macros" aria-label="Macros">
        <h2 className="machine-silkscreen">MACROS</h2>
        <div className="machine-knob-bank">
          <MachineKnob id="radio-bpm" label="Tempo" value={bpm} min={60} max={220} display={`${bpm} BPM`} onChange={setBpm} accent="orange" />
          <MachineKnob id="radio-energy" label="Energy" value={energy} min={0} max={100} display={`${energy} %`} onChange={setEnergy} />
          <MachineKnob id="radio-texture" label="Texture" value={texture} min={0} max={100} display={`${texture} %`} onChange={setTexture} accent="pink" />
          <MachineKnob id="radio-drift" label="Drift" value={drift} min={0} max={100} display={`${drift} %`} onChange={setDrift} accent="cyan" />
          <MachineKnob id="radio-duration" label="Durée" value={durationSeconds} min={minimumRadioProgramSeconds} max={maximumRadioProgramSeconds} step={5} display={formatClock(durationSeconds)} onChange={setDurationSeconds} accent="red" />
          <MachineKnob id="radio-lora" label="Influence" value={quantizedModelSelected ? 25 : loraStrength} min={0} max={100} display={quantizedModelSelected ? '25 % FIXE' : `${loraStrength} %`} disabled={quantizedModelSelected} onChange={setLoraStrength} />
        </div>
      </section>

      <section className="machine-panel machine-equalizer" aria-label="Égaliseur">
        <h2 className="machine-silkscreen">EQUALIZER <span>SORTIE</span></h2>
        <div className="machine-eq-top">
          <div className="machine-screen machine-eq-screen">
            <div className="machine-screen-head"><span>EQ · 3 BANDES</span><b>{dspEnabled ? 'ACTIVE' : 'BYPASS'}</b></div>
            <svg viewBox="0 0 420 170" preserveAspectRatio="none" role="img" aria-label="Réponse des filtres audio">
              <defs><pattern id="eq-grid-pattern" x="34" y="12" width="24" height="28" patternUnits="userSpaceOnUse"><path d="M24 0H0V28" className="eq-grid" fill="none" /></pattern></defs>
              <rect x="34" y="12" width="372" height="140" fill="url(#eq-grid-pattern)" className="eq-plot-border" />
              {[12, 6, 0, -6, -12].map((value, index) => <text key={value} x="27" y={19 + index * 31} textAnchor="end" className="eq-axis">{value > 0 ? '+' : ''}{value}</text>)}
              {['20', '100', '1k', '10k', '20k Hz'].map((value, index) => <text key={value} x={34 + index * 93} y="167" textAnchor={index === 4 ? 'end' : index === 0 ? 'start' : 'middle'} className="eq-axis">{value}</text>)}
              <path className="eq-zero" d="M34 82H406" />
              <path className="eq-curve" d={eqResponse.map((db, index) => `${index ? 'L' : 'M'}${34 + index / (eqResponse.length - 1) * 372},${82 - clamp(db, -14, 14) * 5}`).join(' ')} />
            </svg>
          </div>
          <div className="machine-stereo-meter" aria-label="Niveaux de sortie stéréo">
            {[{ label: 'L', peak: dspMeter.leftPeakDb ?? -60 }, { label: 'R', peak: dspMeter.rightPeakDb ?? -60 }].map((channel) => <div key={channel.label} className="machine-meter-channel"><div role="meter" aria-label={`Sortie ${channel.label}`} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={clamp(channel.peak, -60, 0)}>{Array.from({ length: 16 }, (_, index) => <i key={index} className={`${channel.peak > -60 + index * 3.75 ? 'is-lit' : ''} ${index > 13 ? 'is-red' : index > 10 ? 'is-amber' : ''}`} />)}</div><span>{channel.label}</span></div>)}
            <div className="machine-meter-scale"><span>0</span><span>−6</span><span>−12</span><span>−24</span><span>−48</span></div>
          </div>
        </div>
        <div className="machine-eq-controls">
          <MachineKnob id="machine-low" label="LOW" value={lowGainDb} min={-12} max={12} step={.5} display={`${lowGainDb > 0 ? '+' : ''}${lowGainDb.toFixed(1)} dB`} onChange={setLowGainDb} accent="orange" />
          <MachineKnob id="machine-mid" label="MID" value={midGainDb} min={-12} max={12} step={.5} display={`${midGainDb > 0 ? '+' : ''}${midGainDb.toFixed(1)} dB`} onChange={setMidGainDb} />
          <MachineKnob id="machine-high" label="HIGH" value={highGainDb} min={-12} max={12} step={.5} display={`${highGainDb > 0 ? '+' : ''}${highGainDb.toFixed(1)} dB`} onChange={setHighGainDb} accent="cyan" />
          <MachineKnob id="machine-preamp" label="PREAMP" value={preampDb} min={-12} max={12} step={.5} display={`${preampDb.toFixed(1)} dB`} onChange={setPreampDb} accent="pink" />
          <MachineKnob id="machine-volume" label="VOLUME" value={volume} min={0} max={100} display={`${volume} %`} onChange={setVolume} accent="orange" />
        </div>
        <div className="machine-dsp-strip">
          <button type="button" className={`machine-switch ${dspEnabled ? 'is-on' : ''}`} aria-pressed={dspEnabled} onClick={() => setDspEnabled(!dspEnabled)}><span>DSP</span><i aria-hidden="true" /><b className="machine-screen">{dspEnabled ? 'ON' : 'OFF'}</b></button>
          <MachineKnob id="machine-filter" label="FILTER" value={noiseFilter} min={0} max={100} display={`${noiseFilter} %`} onChange={setNoiseFilter} />
          <button type="button" className={`machine-switch ${limiterEnabled ? 'is-on' : ''}`} aria-pressed={limiterEnabled} onClick={() => setLimiterEnabled(!limiterEnabled)}><span>LIMITER</span><i aria-hidden="true" /><b className="machine-screen">{limiterEnabled ? 'ON' : 'OFF'}</b></button>
          <MachineKnob id="machine-ceiling" label="PLAFOND" value={limiterCeilingDb} min={-6} max={-.3} step={.1} display={`${limiterCeilingDb.toFixed(1)} dB`} onChange={setLimiterCeilingDb} />
        </div>
      </section>

      <section className="machine-panel machine-generation" aria-label="Génération">
        <h2 className="machine-silkscreen">GÉNÉRATION</h2>
        <div>
          <MachineKnob id="machine-steps" label="STEPS" value={steps} min={1} max={24} display={String(steps)} onChange={setSteps} />
          <MachineKnob id="machine-cfg" label="CFG" value={cfg} min={0} max={5} step={.1} display={cfg.toFixed(1)} onChange={setCfg} />
          <MachineKnob id="machine-apg" label="APG" value={apg} min={0} max={1} step={.05} display={apg.toFixed(2)} onChange={setApg} />
          <label className="machine-seed">SEED<input className="machine-screen" type="number" min="0" max="2147483647" placeholder="AUTO" value={seedInput} onChange={(event) => setSeedInput(event.currentTarget.value)} /></label>
        </div>
        <MachineKey type="button" className="machine-key machine-new-direction" disabled={generating || continuationGenerating} onClick={() => void generateNext(true)} aria-label="Repartir de cette direction ↗">NOUVELLE DIRECTION ↗</MachineKey>
      </section>

      <TrackReadout next track={nextQueueTrack} status={continuationTrack ? 'READY' : continuationGenerating ? `CALCUL ${generationProgress}%` : 'À PRÉPARER'} progress={continuationTrack ? 100 : continuationGenerating ? generationProgress : 0} />

      <section className="machine-panel machine-transport" aria-label="Transport">
        <h2 className="machine-silkscreen">TRANSPORT</h2>
        <div className="machine-transport-row">
          <MachineKey type="button" className="machine-key is-square" disabled={!currentTrack} onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setPosition(0) } }} aria-label="Revenir au début">⏮</MachineKey>
          <MachineKey type="button" className={`machine-key is-square is-play ${playing ? 'is-active' : ''}`} disabled={playing || generating || modelImportState === 'uploading'} onClick={() => currentTrack ? void togglePlayback() : startListening()} aria-label={currentTrack ? 'Lancer la radio' : setupNeeded ? 'Configurer la radio' : 'Démarrer la radio'}>▶</MachineKey>
          <MachineKey type="button" className={`machine-key is-square is-pause ${currentTrack && !playing ? 'is-active' : ''}`} disabled={!playing} onClick={() => audioRef.current?.pause()} aria-label="Mettre la radio en pause">Ⅱ</MachineKey>
          <MachineKey type="button" className="machine-key is-square" disabled={!continuationTrack} onClick={() => { if (continuationTrack) activateContinuation(continuationTrack) }} aria-label="Lire le morceau suivant">⏭</MachineKey>
          <MachineKey type="button" className="machine-key is-square" disabled={!currentTrack} onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPosition(0) } }} aria-label="Arrêter">■</MachineKey>
        </div>
      </section>

      <div className="machine-panel machine-timeline">
        <div className="machine-screen"><span>{formatClock(position)} / {currentTrack ? formatClock(currentTrackDuration) : '--:--'}</span><span>{currentTrack ? `−${formatClock(Math.max(0, currentTrackDuration - position))}` : 'STANDBY'}</span></div>
        <div className="machine-fader-track"><input type="range" disabled={!currentTrack} min="0" max={currentTrackDuration} step="0.1" value={Math.min(position, currentTrackDuration)} onChange={handleSeek} aria-label="Position dans le programme" /></div>
      </div>
      <div className="machine-panel machine-generate-panel"><MachineKey type="submit" className="machine-key machine-generate" disabled={generating || continuationGenerating}><span aria-hidden="true">✦</span> GÉNÉRER {currentTrack ? 'LA SUITE' : 'LE MORCEAU'}</MachineKey></div>
      <div className="machine-status machine-screen" role="status" aria-live="polite">{error ? <span id="radio-error" role="alert">{error}</span> : engineMessage && runtimeReady !== true ? engineMessage : status}</div>
    </form>
    <audio ref={audioRef} className="radio-audio" src={currentTrack?.audioUrl} preload="auto" aria-label={currentTrack ? `Lecture de ${currentTrack.title}` : 'Lecteur Stable Audio 3'} onPlay={() => { setPlaying(true); void dspRef.current?.resume() }} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Le WAV généré ne peut pas être décodé par le navigateur.'); setStatus('Lecture impossible · le moteur prépare un WAV compatible navigateur.') }} onTimeUpdate={handleAudioTimeUpdate} onLoadedMetadata={() => { if (audioRef.current?.duration && Number.isFinite(audioRef.current.duration)) setPosition(Math.min(audioRef.current.currentTime, audioRef.current.duration)) }} onEnded={handleAudioEnded} />
    <RadioDialog open={tagModalOpen} onClose={() => setTagModalOpen(false)} title="Explorer les sons" wide>
<p className="radio-catalog-description">Choisis les sons à ajouter à ta direction. Épingle ceux que tu veux retrouver dans chaque morceau.</p>
          <div className="radio-modal-controls">
            <input
              aria-label="Rechercher un son"
              type="search"
              className="radio-modal-search"
              placeholder="Filtrer les tags (ex: techno, kick, drone, acid, reverb…)"
              value={modalSearch}
              onChange={(e) => setModalSearch(e.currentTarget.value)}
              autoFocus
            />
            {modalSearch && <button type="button" className="radio-clear-search" onClick={() => { setModalSearch(''); document.querySelector<HTMLInputElement>('.radio-modal-search')?.focus() }}>Effacer la recherche</button>}
            <div className="radio-modal-tabs" role="group" aria-label="Catégories de sons">
              <button
                type="button"
                
                aria-pressed={modalCategory === 'all'}
                className={`radio-modal-tab ${modalCategory === 'all' ? 'is-active' : ''}`}
                onClick={() => setModalCategory('all')}
              >
                Tous ({STABLE_AUDIO_TAGS.length + TRACK_PHASES.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as TagCategory[]).map((cat) => {
                const count = cat === 'phases'
                  ? TRACK_PHASES.length
                  : STABLE_AUDIO_TAGS.filter((t) => t.category === cat).length
                return (
                  <button
                    key={cat}
                    type="button"
                    
                    aria-pressed={modalCategory === cat}
                    className={`radio-modal-tab ${modalCategory === cat ? 'is-active' : ''}`}
                    onClick={() => setModalCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          <div className="radio-modal-body">
            {(modalCategory === 'all' || modalCategory === 'phases') && (
              <div className="radio-modal-section">
                <div className="radio-modal-section-title">
                  <span>Phases de structure</span>
                  <small>Clique pour ajouter à la frise chronologique</small>
                </div>
                <div className="radio-modal-phase-grid">
                  {filteredPhases.map((phase) => {
                    const countInPhases = phases.filter((p) => p.toLowerCase() === phase.label.toLowerCase()).length
                    const isPhaseFixed = fixedTags.some((token) => token.toLowerCase() === phase.label.toLowerCase())
                    return (
                      <div
                        key={phase.id}
                        role="button"
                        tabIndex={0}
                        className={`radio-modal-phase-card is-phases ${countInPhases > 0 ? 'is-in-timeline' : ''}`}
                        onClick={() => handleAddPhase(phase.label)}
                        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleAddPhase(phase.label) } }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/phase-palette', phase.label)
                          e.dataTransfer.setData('text/tag', phase.label)
                          e.dataTransfer.setData('text/plain', phase.label)
                        }}
                      >
                        <div className="radio-modal-phase-top">
                          <span className="radio-modal-phase-code">{phase.shortCode}</span>
                          <strong className="radio-modal-phase-name">{phase.label}</strong>
                          <span className="radio-modal-phase-energy">⚡ {phase.defaultEnergy}%</span>
                          <button
                            type="button"
                            className={`radio-modal-pin-btn ${isPhaseFixed ? 'is-pinned' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFixedTag(phase.label)
                            }}
                            title={isPhaseFixed ? 'Retirer des tags fixes' : 'Verrouiller dans les tags fixes'}
                            aria-label={isPhaseFixed ? 'Détacher des tags fixes' : 'Épingler aux tags fixes'}
                          >
                            📌
                          </button>
                        </div>
                        <p className="radio-modal-phase-desc">{phase.description}</p>
                        <div className="radio-modal-phase-action">
                          {countInPhases > 0 ? `Présente (${countInPhases}×) · ＋ Ajouter encore` : '＋ Ajouter à la frise'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(modalCategory === 'all' || modalCategory !== 'phases') && (
              <div className="radio-modal-section">
                {modalCategory === 'all' && <div className="radio-modal-section-title"><span>Tags sonores & textures</span></div>}
                <div className="radio-modal-tag-grid">
                  {filteredTags.map((tag) => {
                    const isSelected = keywordTokens.some(
                      (token) => token.toLowerCase() === tag.label.toLowerCase(),
                    )
                    const isFixed = fixedTags.some(
                      (token) => token.toLowerCase() === tag.label.toLowerCase(),
                    )
                    return (
                      <div
                        key={tag.id}
                        role="button"
                        tabIndex={0}
                        className={`radio-modal-tag-item is-${tag.category} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleToggleTag(tag.label)}
                        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleToggleTag(tag.label) } }}
                        aria-pressed={isSelected}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'copy'
                          e.dataTransfer.setData('text/tag', tag.label)
                          e.dataTransfer.setData('text/plain', tag.label)
                        }}
                      >
                        <div className="radio-modal-tag-head">
                          <span className="radio-modal-tag-category">{CATEGORY_LABELS[tag.category]}</span>
                          <div className="radio-modal-tag-actions">
                            <button
                              type="button"
                              className={`radio-modal-pin-btn ${isFixed ? 'is-pinned' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleFixedTag(tag.label)
                              }}
                              title={isFixed ? 'Retirer des tags fixes' : 'Verrouiller dans les tags fixes'}
                              aria-label={isFixed ? 'Détacher des tags fixes' : 'Épingler aux tags fixes'}
                            >
                              📌
                            </button>
                            <span className="radio-modal-tag-status">{isSelected ? '✓ ACTIF' : '＋'}</span>
                          </div>
                        </div>
                        <strong className="radio-modal-tag-label">{tag.label}</strong>
                        {tag.description && <small className="radio-modal-tag-desc">{tag.description}</small>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {((modalCategory === 'phases' && filteredPhases.length === 0) || (modalCategory === 'all' && filteredTags.length === 0 && filteredPhases.length === 0) || (modalCategory !== 'all' && modalCategory !== 'phases' && filteredTags.length === 0)) && (
              <div className="radio-modal-empty">
                Aucun tag trouvé pour « {modalSearch} ».
              </div>
            )}
          </div>

          <details className="radio-catalog-note"><summary>À propos de ces suggestions</summary><p>{STABLE_AUDIO_TAG_CATALOG_NOTE}</p></details>
          <div className="radio-modal-footer">
            <div className="radio-modal-footer-stats">
              <span><b>{keywordTokens.length}</b> tags actifs</span>
              <span>·</span>
              <span><b>{fixedTags.length}</b> tags fixes</span>
              <span>·</span>
              <span><b>{phases.length}</b> phases dans la frise</span>
            </div>
            <button
              type="button"
              className="radio-modal-done-btn"
              onClick={() => setTagModalOpen(false)}
            >
              Valider & fermer
            </button>
          </div>
    </RadioDialog>
  </section></div>
}
