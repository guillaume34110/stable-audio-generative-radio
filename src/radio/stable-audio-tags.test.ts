import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, STABLE_AUDIO_TAGS, STABLE_AUDIO_TAG_CATALOG_NOTE, TRACK_PHASES } from './stable-audio-tags'

describe('Stable Audio 3 suggestions', () => {
  it('offers documented optional fields and vocabulary independent of a custom model', () => {
    const ids = STABLE_AUDIO_TAGS.map((tag) => tag.id)
    const labels = STABLE_AUDIO_TAGS.map((tag) => tag.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
    expect(STABLE_AUDIO_TAGS.filter((tag) => tag.category === 'prompt').map((tag) => tag.label)).toEqual([
      'TrackType: Music', 'TrackType: Instrument', 'TrackType: SFX', 'Format: Duo', 'Genre: Jazz',
    ])
    expect(CATEGORY_LABELS.prompt).toContain('SA3')
    expect(labels).toEqual(expect.arrayContaining(['Jazz', 'Rock', 'Classical', 'Hip-Hop', 'Bossa Nova', 'Indian Classical', 'Techno', 'Piano', 'Koto', 'Oud', 'Tabla', 'Wordless Choir', 'Rain']))
    expect(JSON.stringify(STABLE_AUDIO_TAGS) + STABLE_AUDIO_TAG_CATALOG_NOTE).not.toMatch(/Berlin|SFT|annotations|recette locale/i)
    expect(STABLE_AUDIO_TAGS.every((tag) => !/\b\d+\s*BPM\b/i.test(`${tag.label} ${tag.description ?? ''}`))).toBe(true)
  })

  it('supports instrumental arrangements beyond electronic build and drop sections', () => {
    expect(TRACK_PHASES.map((phase) => phase.label)).toEqual(expect.arrayContaining(['Intro', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Interlude', 'Outro']))
    expect(new Set(TRACK_PHASES.map((phase) => phase.id)).size).toBe(TRACK_PHASES.length)
  })
})
