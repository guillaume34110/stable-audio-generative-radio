import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, STABLE_AUDIO_TAGS, getTagCategory } from './stable-audio-tags'

describe('Stable Audio 3 prompt catalog', () => {
  it('keeps documented music markers distinct from the curated vocabulary', () => {
    const ids = STABLE_AUDIO_TAGS.map((tag) => tag.id)
    const labels = STABLE_AUDIO_TAGS.map((tag) => tag.label)

    expect(new Set(ids).size).toBe(ids.length)
    expect(getTagCategory('TrackType: Music')).toBe('prompt')
    expect(getTagCategory('VocalType: Instrumental')).toBe('prompt')
    expect(getTagCategory('Genre: Techno')).toBe('prompt')
    expect(CATEGORY_LABELS.prompt).toContain('SA3')
    expect(labels).not.toContain('Glitch FX')
    expect(labels).not.toContain('Vocal Drone')
    expect(labels).not.toContain('Clean Mix')
    expect(labels).not.toContain('Club Sound System')
    expect(STABLE_AUDIO_TAGS.every((tag) => !/\b\d+\s*BPM\b/i.test(`${tag.label} ${tag.description ?? ''}`))).toBe(true)
  })
})
