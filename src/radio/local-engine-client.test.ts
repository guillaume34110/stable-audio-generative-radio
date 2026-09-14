import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureLocalEnginePairing,
  detectLocalEngine,
  getLocalEnginePairUrl,
  localEngineUrl,
  requestLocalEngineAccess,
} from './local-engine-client'

describe('local engine client', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  it('captures the fragment token and removes it from the address bar', () => {
    window.history.replaceState(null, '', '/#onus-engine=private-token')

    expect(captureLocalEnginePairing()).toBe('private-token')
    expect(window.location.hash).toBe('')
    expect(localEngineUrl('/api/stable-audio/radio/sfts')).toBe(
      'http://127.0.0.1:17846/api/stable-audio/radio/sfts',
    )
  })

  it('pairs back to the page that initiated the request', () => {
    window.history.replaceState(null, '', '/generative-radio.html')

    expect(getLocalEnginePairUrl()).toContain(
      encodeURIComponent(`${window.location.origin}/generative-radio.html`),
    )
  })

  it('keeps same-origin API paths before pairing', () => {
    expect(localEngineUrl('/api/health')).toBe('/api/health')
  })

  it('detects a running but unpaired engine', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(detectLocalEngine()).resolves.toEqual({ state: 'unpaired' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:17846/api/local-engine/health',
      expect.objectContaining({ cache: 'no-store', mode: 'cors', targetAddressSpace: 'loopback' }),
    )
  })

  it('reports a paired engine as connected after a user-authorized probe', async () => {
    window.localStorage.setItem('onus-local-engine-token', 'paired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.18' }),
    }))

    await expect(requestLocalEngineAccess()).resolves.toEqual({ state: 'connected', version: '1.0.18' })
  })

  it('reports a paired engine that stopped responding', async () => {
    window.localStorage.setItem('onus-local-engine-token', 'paired')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    await expect(detectLocalEngine()).resolves.toEqual({ state: 'stopped' })
  })

  it('preserves compatibility details when the engine is degraded', async () => {
    window.localStorage.setItem('onus-local-engine-token', 'paired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'degraded',
        version: '1.0.18',
        separator_version: '0.30.2',
        expected_separator_version: '0.44.5',
      }),
    }))

    await expect(detectLocalEngine()).resolves.toEqual({
      state: 'incompatible',
      version: '1.0.18',
      separatorVersion: '0.30.2',
      expectedSeparatorVersion: '0.44.5',
    })
  })
})
