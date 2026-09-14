export type LocalEngineState = 'checking' | 'connected' | 'incompatible' | 'missing' | 'stopped' | 'unpaired'

export type LocalEngineStatus = {
  state: LocalEngineState
  version?: string
  separatorVersion?: string
  expectedSeparatorVersion?: string
}

export const LOCAL_ENGINE_ORIGIN = 'http://127.0.0.1:17846'

const TOKEN_KEY = 'onus-local-engine-token'

/**
 * The local engine sends the pairing token back in the URL fragment so it is
 * never included in an HTTP request. Store it once, then remove the fragment
 * from the address bar.
 */
export const captureLocalEnginePairing = (): string | null => {
  if (typeof window === 'undefined') return null
  const match = window.location.hash.match(/(?:^#|&)onus-engine=([^&]+)/)
  if (match?.[1]) {
    const token = decodeURIComponent(match[1])
    window.localStorage.setItem(TOKEN_KEY, token)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    return token
  }
  return window.localStorage.getItem(TOKEN_KEY)
}

export const localEngineToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export const getLocalEnginePairUrl = (): string => {
  if (typeof window === 'undefined') return `${LOCAL_ENGINE_ORIGIN}/api/local-engine/pair`
  const redirectUri = `${window.location.origin}${window.location.pathname}`
  return `${LOCAL_ENGINE_ORIGIN}/api/local-engine/pair?redirect_uri=${encodeURIComponent(redirectUri)}`
}

export const localEngineUrl = (path: string): string => (
  localEngineToken() ? `${LOCAL_ENGINE_ORIGIN}${path}` : path
)

type LocalEngineHealth = {
  status?: string
  version?: string
  separator_version?: string
  expected_separator_version?: string
}

const probeLocalEngine = async (): Promise<LocalEngineStatus> => {
  try {
    const response = await fetch(`${LOCAL_ENGINE_ORIGIN}/api/local-engine/health`, {
      mode: 'cors',
      cache: 'no-store',
      targetAddressSpace: 'loopback',
    } as RequestInit & { targetAddressSpace: 'loopback' })
    if (!response.ok) return { state: 'missing' }
    const health = await response.json() as LocalEngineHealth
    return {
      state: health.status === 'degraded' ? 'incompatible' : localEngineToken() ? 'connected' : 'unpaired',
      version: health.version,
      separatorVersion: health.separator_version,
      expectedSeparatorVersion: health.expected_separator_version,
    }
  } catch {
    return { state: localEngineToken() ? 'stopped' : 'missing' }
  }
}

export const detectLocalEngine = (): Promise<LocalEngineStatus> => probeLocalEngine()

// Keep this request directly attached to a user click so Chromium can show
// the Local Network Access permission prompt for the loopback address.
export const requestLocalEngineAccess = (): Promise<LocalEngineStatus> => probeLocalEngine()
