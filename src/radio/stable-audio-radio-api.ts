import { localEngineToken, localEngineUrl } from './local-engine-client'

export type StableAudioRadioAdapter = {
  id: string
  filename: string
  size_bytes: number
  created_at: string
  format: 'safetensors'
  base_model: string
}

export type StableAudioRadioModelVariantId = 'fp16' | 'int8' | 'int4' | 'int2' | 'int1'

export type StableAudioRadioModelVariant = {
  id: StableAudioRadioModelVariantId
  label: string
  description: string
  available: boolean
  bits: number | null
  size_bytes: number | null
  merged_sft: boolean
  lora_strength: number | null
}

export type StableAudioRadioCatalog = {
  engine: string
  runtime_ready: boolean
  sfts: StableAudioRadioAdapter[]
  model_variants: StableAudioRadioModelVariant[]
}

export type StableAudioRadioRequest = {
  sft_id: string | null
  model_variant: StableAudioRadioModelVariantId
  prompt: string
  bpm: number
  drift: number
  energy: number
  texture: number
  evolution: 'slow' | 'fluid' | 'wild'
  duration_seconds: number
  steps?: number
  seed?: number
  lora_strength: number
  cfg?: number
  apg?: number
  negative_prompt?: string
  continuation_from_generation_id?: string | null
}

export type StableAudioRadioJob = {
  generation_id: string
  id?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  message?: string
  audio_url?: string
  duration_seconds?: number
  bpm?: number
}

const radioApiBaseUrl = (import.meta.env.VITE_RADIO_API_URL ?? '').replace(/\/$/, '')

const radioApiUrl = (path: string): string => `${radioApiBaseUrl}${path}`

export const LOCAL_RADIO_PAIRING_ERROR = 'Le moteur local doit être appairé pour charger et générer un modèle Stable Audio 3.'
export const LOCAL_RADIO_NETWORK_ERROR = 'Connexion au moteur Stable Audio bloquée. Autorise l’accès au réseau local pour ce site, puis réessaie.'

const normalizeModelCopy = (copy: string): string => copy
  .replace(/\bBerlin SFT\b/g, 'modèle Berlin')
  .replace(/\bSFT\b/g, 'modèle')

const stableAudioRadioResponse = async (path: string, init?: RequestInit): Promise<Response> => {
  const token = localEngineToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('X-Onus-Token', token)

  const request: RequestInit & { targetAddressSpace?: 'loopback' } = {
    ...init,
    headers,
    credentials: token ? 'same-origin' : 'include',
  }
  if (token) request.targetAddressSpace = 'loopback'

  try {
    return await fetch(token ? localEngineUrl(path) : radioApiUrl(path), request)
  } catch {
    throw new Error(LOCAL_RADIO_NETWORK_ERROR)
  }
}

const stableAudioRadioApi = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await stableAudioRadioResponse(path, init)
  if (!response.ok) {
    if (response.status === 401) throw new Error(LOCAL_RADIO_PAIRING_ERROR)
    const raw = await response.text().catch(() => '')
    let detail: unknown = raw
    try {
      const parsed: unknown = JSON.parse(raw)
      detail = typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? (parsed as { detail?: unknown }).detail ?? raw
        : raw
    } catch { /* plain-text server error */ }
    const message = normalizeModelCopy(typeof detail === 'string' ? detail : JSON.stringify(detail))
    throw new Error(message || `Stable Audio 3 failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) throw new Error('The local API did not return JSON.')
  return response.json() as Promise<T>
}

export const listStableAudioRadioSfts = async (): Promise<StableAudioRadioCatalog> => {
  const response = await stableAudioRadioApi<Partial<StableAudioRadioCatalog>>('/api/stable-audio/radio/sfts')
  return {
    engine: response.engine ?? 'stable-audio-3-medium-mlx',
    runtime_ready: response.runtime_ready === true,
    sfts: Array.isArray(response.sfts) ? response.sfts : [],
    model_variants: Array.isArray(response.model_variants)
      ? response.model_variants.map((variant) => ({
        ...variant,
        label: normalizeModelCopy(variant.label),
        description: normalizeModelCopy(variant.description),
      }))
      : [],
  }
}

export const uploadStableAudioRadioSft = async (file: File): Promise<StableAudioRadioAdapter> => {
  const body = new FormData()
  body.append('file', file)
  const response = await stableAudioRadioApi<{ sft: StableAudioRadioAdapter }>('/api/stable-audio/radio/sfts', {
    method: 'POST',
    body,
  })
  return response.sft
}

export const createStableAudioRadioGeneration = async (request: StableAudioRadioRequest): Promise<StableAudioRadioJob> => (
  stableAudioRadioApi<StableAudioRadioJob>('/api/stable-audio/radio/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
)

export const stableAudioRadioJob = async (generationId: string): Promise<StableAudioRadioJob> => (
  stableAudioRadioApi<StableAudioRadioJob>(`/api/stable-audio/radio/generations/${encodeURIComponent(generationId)}`)
)

export const waitForStableAudioRadioGeneration = async (
  generationId: string,
  onUpdate?: (job: StableAudioRadioJob) => void,
): Promise<StableAudioRadioJob> => {
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    const job = await stableAudioRadioJob(generationId)
    onUpdate?.(job)
    if (job.status === 'completed') return job
    if (job.status === 'failed') throw new Error(normalizeModelCopy(job.message || 'Stable Audio 3 generation failed.'))
    await new Promise<void>((resolve) => window.setTimeout(resolve, 900))
  }
  throw new Error('Stable Audio 3 generation timed out.')
}

export const stableAudioRadioAudioBlob = async (generationId: string): Promise<Blob> => {
  const response = await stableAudioRadioResponse(`/api/stable-audio/radio/generations/${encodeURIComponent(generationId)}/audio`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Could not fetch generated audio (${response.status}).`)
  }
  return response.blob()
}
