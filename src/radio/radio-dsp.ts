export type RadioDspSettings = {
  preampDb: number
  dspEnabled: boolean
  noiseFilter: number
  dspAmount: number
  limiterEnabled: boolean
  limiterCeilingDb: number
  lowGainDb?: number
  midGainDb?: number
  highGainDb?: number
  volume?: number
}

export type RadioDspMeter = {
  leftPeakDb?: number
  rightPeakDb?: number
  inputPeakDb: number
  outputPeakDb: number
  gainReductionDb: number
}

export type RadioDspController = {
  setSettings: (settings: RadioDspSettings) => void
  resume: () => Promise<void>
  readMeter: () => RadioDspMeter
  readFrequencyResponse: () => number[]
  dispose: () => void
}

export const defaultRadioDspSettings: RadioDspSettings = {
  preampDb: 0,
  dspEnabled: true,
  noiseFilter: 32,
  dspAmount: 54,
  limiterEnabled: true,
  limiterCeilingDb: -1,
  lowGainDb: 1.5,
  midGainDb: -0.5,
  highGainDb: 2,
  volume: 78,
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

const dbToGain = (decibels: number): number => 10 ** (decibels / 20)

const gainToDb = (gain: number): number => 20 * Math.log10(Math.max(0.000001, gain))

const peakDb = (analyser: AnalyserNode): number => {
  const samples = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(samples)
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return gainToDb(peak)
}

type AudioContextConstructor = new () => AudioContext

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  if (typeof window === 'undefined') return null
  const browserWindow = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextConstructor }
  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null
}

const sanitizeSettings = (settings: RadioDspSettings): RadioDspSettings => ({
  preampDb: clamp(Number(settings.preampDb) || 0, -12, 12),
  dspEnabled: settings.dspEnabled,
  noiseFilter: clamp(Number(settings.noiseFilter) || 0, 0, 100),
  dspAmount: clamp(Number(settings.dspAmount) || 0, 0, 100),
  limiterEnabled: settings.limiterEnabled,
  limiterCeilingDb: clamp(Number(settings.limiterCeilingDb) || -1, -6, -0.3),
  lowGainDb: clamp(settings.lowGainDb ?? 1.5, -12, 12),
  midGainDb: clamp(settings.midGainDb ?? -0.5, -12, 12),
  highGainDb: clamp(settings.highGainDb ?? 2, -12, 12),
  volume: clamp(settings.volume ?? 78, 0, 100),
})

export const createRadioDsp = (
  mediaElement: HTMLMediaElement,
  initialSettings: RadioDspSettings = defaultRadioDspSettings,
): RadioDspController => {
  const AudioContextClass = getAudioContextConstructor()
  if (!AudioContextClass) throw new Error('Le navigateur ne fournit pas de DSP Web Audio.')

  const context = new AudioContextClass()
  const source = context.createMediaElementSource(mediaElement)
  const preamp = context.createGain()
  const noiseHighpass = context.createBiquadFilter()
  const noiseLowpass = context.createBiquadFilter()
  const body = context.createBiquadFilter()
  const clarity = context.createBiquadFilter()
  const air = context.createBiquadFilter()
  const inputMeter = context.createAnalyser()
  const intelligentTrim = context.createGain()
  const limiter = context.createDynamicsCompressor()
  const outputMeter = context.createAnalyser()
  const output = context.createGain()
  const splitter = context.createChannelSplitter(2)
  const leftMeter = context.createAnalyser()
  const rightMeter = context.createAnalyser()
  leftMeter.fftSize = 256
  rightMeter.fftSize = 256

  preamp.gain.value = 1
  intelligentTrim.gain.value = 1
  output.gain.value = 1

  noiseHighpass.type = 'highpass'
  noiseHighpass.Q.value = 0.7
  noiseLowpass.type = 'lowpass'
  noiseLowpass.Q.value = 0.7
  body.type = 'peaking'
  body.frequency.value = 60
  body.Q.value = 1.1
  clarity.type = 'peaking'
  clarity.frequency.value = 2200
  clarity.Q.value = 0.9
  air.type = 'highshelf'
  air.frequency.value = 8500
  inputMeter.fftSize = 256
  outputMeter.fftSize = 256

  source.connect(preamp)
  preamp.connect(noiseHighpass)
  noiseHighpass.connect(noiseLowpass)
  noiseLowpass.connect(body)
  body.connect(clarity)
  clarity.connect(air)
  air.connect(inputMeter)
  inputMeter.connect(intelligentTrim)
  intelligentTrim.connect(limiter)
  limiter.connect(outputMeter)
  outputMeter.connect(output)
  output.connect(context.destination)
  output.connect(splitter)
  splitter.connect(leftMeter, 0)
  splitter.connect(rightMeter, 1)

  let settings = sanitizeSettings(initialSettings)
  let disposed = false

  const applySettings = (): void => {
    if (disposed) return
    const now = context.currentTime
    const dsp = settings.dspEnabled
    const maxFilterFrequency = Math.min(22_050, context.sampleRate * 0.49)
    const noiseAmount = settings.noiseFilter / 100
    const dspAmount = settings.dspAmount / 100

    preamp.gain.setTargetAtTime(dbToGain(settings.preampDb), now, 0.018)
    noiseHighpass.frequency.setTargetAtTime(dsp ? 28 + noiseAmount * 12 : 8, now, 0.045)
    noiseLowpass.frequency.setTargetAtTime(dsp ? 17_000 - noiseAmount * 3_500 : maxFilterFrequency, now, 0.045)
    body.gain.setTargetAtTime(dsp ? (settings.lowGainDb ?? 0) + dspAmount * 3.6 : 0, now, 0.08)
    clarity.gain.setTargetAtTime(dsp ? (settings.midGainDb ?? 0) + dspAmount * 2.2 : 0, now, 0.08)
    air.gain.setTargetAtTime(dsp ? (settings.highGainDb ?? 0) - dspAmount * 3.2 : 0, now, 0.08)
    intelligentTrim.gain.setTargetAtTime(settings.limiterEnabled ? intelligentTrim.gain.value : 1, now, 0.08)
    limiter.threshold.setTargetAtTime(settings.limiterEnabled ? settings.limiterCeilingDb : 0, now, 0.08)
    limiter.knee.setTargetAtTime(settings.limiterEnabled ? 4 : 0, now, 0.08)
    limiter.ratio.setTargetAtTime(settings.limiterEnabled ? 20 : 1, now, 0.08)
    limiter.attack.setTargetAtTime(settings.limiterEnabled ? 0.016 : 0.01, now, 0.08)
    limiter.release.setTargetAtTime(settings.limiterEnabled ? 0.14 : 0.2, now, 0.08)
    output.gain.setTargetAtTime((settings.volume ?? 78) / 100 * (settings.limiterEnabled ? dbToGain(-0.15) : 1), now, 0.08)
  }

  const updateIntelligentTrim = (inputPeakDb: number): void => {
    if (disposed || !settings.limiterEnabled) return
    const targetPeakDb = settings.limiterCeilingDb - 0.35
    const desiredGain = inputPeakDb > targetPeakDb
      ? clamp(dbToGain(targetPeakDb - inputPeakDb), 0.18, 1)
      : 1
    const now = context.currentTime
    const timeConstant = desiredGain < intelligentTrim.gain.value ? 0.035 : 0.45
    intelligentTrim.gain.setTargetAtTime(desiredGain, now, timeConstant)
  }

  const setSettings = (nextSettings: RadioDspSettings): void => {
    settings = sanitizeSettings(nextSettings)
    applySettings()
  }

  const readMeter = (): RadioDspMeter => {
    if (disposed) return { inputPeakDb: -60, outputPeakDb: -60, gainReductionDb: 0 }
    const inputPeakDb = peakDb(inputMeter)
    updateIntelligentTrim(inputPeakDb)
    const outputPeakDb = peakDb(outputMeter)
    const gainReductionDb = settings.limiterEnabled ? Math.min(0, Number(limiter.reduction) || 0) : 0
    return { inputPeakDb, outputPeakDb, gainReductionDb, leftPeakDb: peakDb(leftMeter), rightPeakDb: peakDb(rightMeter) }
  }

  const resume = async (): Promise<void> => {
    if (!disposed && context.state === 'suspended') await context.resume()
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    source.disconnect()
    preamp.disconnect()
    noiseHighpass.disconnect()
    noiseLowpass.disconnect()
    body.disconnect()
    clarity.disconnect()
    air.disconnect()
    inputMeter.disconnect()
    intelligentTrim.disconnect()
    limiter.disconnect()
    outputMeter.disconnect()
    output.disconnect()
    splitter.disconnect()
    leftMeter.disconnect()
    rightMeter.disconnect()
    if (context.state !== 'closed') void context.close()
  }

  applySettings()
  const readFrequencyResponse = (): number[] => {
    const frequencies = Float32Array.from({ length: 96 }, (_, index) => 20 * 1000 ** (index / 95))
    const magnitude = new Float32Array(96)
    const phase = new Float32Array(96)
    const response = new Array<number>(96).fill(0)
    for (const filter of [noiseHighpass, noiseLowpass, body, clarity, air]) {
      filter.getFrequencyResponse(frequencies, magnitude, phase)
      for (let index = 0; index < response.length; index += 1) response[index] += gainToDb(magnitude[index] ?? 1)
    }
    return response
  }

  return { setSettings, resume, readMeter, readFrequencyResponse, dispose }
}
