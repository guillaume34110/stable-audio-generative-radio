import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listStableAudioRadioSfts,
  LOCAL_RADIO_NETWORK_ERROR,
  LOCAL_RADIO_PAIRING_ERROR,
} from './stable-audio-radio-api'

describe('stable audio radio API transport', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends paired requests directly to the local engine', async () => {
    window.localStorage.setItem('onus-local-engine-token', 'paired-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runtime_ready: true,
      sfts: [],
      model_variants: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await listStableAudioRadioSfts()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:17846/api/stable-audio/radio/sfts',
      expect.objectContaining({ credentials: 'same-origin', targetAddressSpace: 'loopback' }),
    )
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(request.headers).get('X-Onus-Token')).toBe('paired-token')
  })

  it('turns an unauthorized engine response into a pairing instruction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Onus pairing required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })))

    await expect(listStableAudioRadioSfts()).rejects.toThrow(LOCAL_RADIO_PAIRING_ERROR)
  })

  it('reports a blocked loopback request with an actionable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('blocked')))

    await expect(listStableAudioRadioSfts()).rejects.toThrow(LOCAL_RADIO_NETWORK_ERROR)
  })
})
