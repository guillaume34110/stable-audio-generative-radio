import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRadioDsp, defaultRadioDspSettings } from './radio-dsp'

class MockAudioParam {
  value = 0
  readonly setTargetAtTime = vi.fn((value: number) => { this.value = value })
}

class MockAudioNode {
  readonly gain = new MockAudioParam()
  readonly threshold = new MockAudioParam()
  readonly knee = new MockAudioParam()
  readonly ratio = new MockAudioParam()
  readonly attack = new MockAudioParam()
  readonly release = new MockAudioParam()
  readonly frequency = new MockAudioParam()
  readonly Q = new MockAudioParam()
  readonly reduction = 0
  fftSize = 256
  type = ''
  readonly connect = vi.fn(<T>(destination: T): T => destination)
  readonly disconnect = vi.fn()
  readonly getFloatTimeDomainData = vi.fn((samples: Float32Array) => samples.fill(0))
  readonly getFrequencyResponse = vi.fn((_frequencies: Float32Array, magnitude: Float32Array, phase: Float32Array) => { magnitude.fill(1); phase.fill(0) })
}

class MockAudioContext {
  static latest: MockAudioContext | null = null
  readonly sampleRate = 44_100
  readonly state: AudioContextState = 'running'
  readonly destination = new MockAudioNode()
  readonly source = new MockAudioNode()
  readonly gains: MockAudioNode[] = []
  readonly filters: MockAudioNode[] = []
  readonly analysers: MockAudioNode[] = []
  readonly compressors: MockAudioNode[] = []
  readonly resume = vi.fn().mockResolvedValue(undefined)
  readonly close = vi.fn().mockResolvedValue(undefined)

  constructor() { MockAudioContext.latest = this }

  readonly createMediaElementSource = vi.fn(() => this.source as unknown as MediaElementAudioSourceNode)
  readonly createChannelSplitter = vi.fn(() => new MockAudioNode() as unknown as ChannelSplitterNode)
  readonly createGain = vi.fn(() => {
    const node = new MockAudioNode()
    this.gains.push(node)
    return node as unknown as GainNode
  })
  readonly createBiquadFilter = vi.fn(() => {
    const node = new MockAudioNode()
    this.filters.push(node)
    return node as unknown as BiquadFilterNode
  })
  readonly createAnalyser = vi.fn(() => {
    const node = new MockAudioNode()
    this.analysers.push(node)
    return node as unknown as AnalyserNode
  })
  readonly createDynamicsCompressor = vi.fn(() => {
    const node = new MockAudioNode()
    this.compressors.push(node)
    return node as unknown as DynamicsCompressorNode
  })
  get currentTime(): number { return 0 }
}

describe('radio DSP monitoring chain', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    MockAudioContext.latest = null
  })

  it('routes the media element through preamp, cleanup DSP and intelligent limiter', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const controller = createRadioDsp(document.createElement('audio'))
    const context = MockAudioContext.latest!

    expect(context.source.connect).toHaveBeenCalledWith(context.gains[0])
    expect(context.gains).toHaveLength(3)
    expect(context.filters).toHaveLength(5)
    expect(context.analysers).toHaveLength(4)
    expect(context.compressors).toHaveLength(1)
    expect(context.compressors[0]!.threshold.value).toBe(-1)
    expect(context.compressors[0]!.ratio.value).toBe(20)

    controller.setSettings({ ...defaultRadioDspSettings, preampDb: 6, limiterEnabled: false })
    expect(context.gains[0]!.gain.value).toBeCloseTo(10 ** (6 / 20), 6)
    expect(context.compressors[0]!.ratio.value).toBe(1)
    expect(context.compressors[0]!.threshold.value).toBe(0)
    controller.setSettings({ ...defaultRadioDspSettings, dspAmount: 0, lowGainDb: 4, midGainDb: -3, highGainDb: 6, volume: 0 })
    expect(context.filters.slice(2).map((filter) => filter.gain.value)).toEqual([4, -3, 6])
    expect(context.gains[2]!.gain.value).toBe(0)
    expect(controller.readFrequencyResponse()).toEqual(new Array(96).fill(0))
    context.analysers[2]!.getFloatTimeDomainData.mockImplementation((samples) => samples.fill(.5))
    context.analysers[3]!.getFloatTimeDomainData.mockImplementation((samples) => samples.fill(.1))
    const stereo = controller.readMeter()
    expect(stereo.leftPeakDb).toBeCloseTo(-6.02, 2)
    expect(stereo.rightPeakDb).toBeCloseTo(-20, 2)
  })

  it('adapts the limiter input trim when a loud peak approaches the ceiling', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const controller = createRadioDsp(document.createElement('audio'))
    const context = MockAudioContext.latest!
    context.analysers[0]!.getFloatTimeDomainData.mockImplementation((samples: Float32Array) => samples.fill(.98))

    const meter = controller.readMeter()

    expect(meter.inputPeakDb).toBeGreaterThan(-1)
    expect(context.gains[1]!.gain.value).toBeLessThan(1)
    expect(meter.gainReductionDb).toBe(0)
  })

  it('disconnects the chain and closes its private context', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const controller = createRadioDsp(document.createElement('audio'))
    const context = MockAudioContext.latest!

    controller.dispose()
    controller.dispose()

    expect(context.source.disconnect).toHaveBeenCalledOnce()
    expect(context.close).toHaveBeenCalledOnce()
    expect(controller.readMeter()).toEqual({ inputPeakDb: -60, outputPeakDb: -60, gainReductionDb: 0 })
  })
})
