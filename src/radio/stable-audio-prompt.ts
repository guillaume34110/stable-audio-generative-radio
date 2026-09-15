// SA3 accepts free text. Do not tokenize, sample, reorder or rewrite the
// description: optional TrackType / Format / Genre fields belong to the user.
// Tempo is already sent separately to the local engine in the `bpm` field.
export const buildStableAudioPrompt = (direction: string, phases: readonly string[] = []): string => {
  if (phases.length === 0) return direction
  return `${direction}\nThe arrangement moves through ${phases.join(', then ')}.`
}
