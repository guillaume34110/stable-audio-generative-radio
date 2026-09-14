export type TagCategory = 'prompt' | 'style' | 'instruments' | 'rhythm' | 'mood' | 'production' | 'phases'

export type AudioTag = {
  id: string
  label: string
  category: TagCategory
  description?: string
}

export type TrackPhase = {
  id: string
  label: string
  shortCode: string
  defaultEnergy: number // 0 to 100
  description: string
}

export const CATEGORY_LABELS: Record<TagCategory, string> = {
  prompt: 'Prompt & marqueurs SA3',
  style: 'Styles & Genres',
  instruments: 'Instruments & Synthèse',
  rhythm: 'Rythmique & Drums',
  mood: 'Ambiance & Mood',
  production: 'Production & Mix',
  phases: 'Structure interne On Us',
}

export const STABLE_AUDIO_TAG_CATALOG_NOTE = 'Stable Audio 3 ne possède pas de dictionnaire fermé : ce catalogue garde uniquement des formulations de prompt documentées par le guide SA3, présentes dans le vocabulaire du modèle Berlin ou nécessaires à sa recette de techno. Ce sont des suggestions, pas des commandes garanties ; le champ reste libre et illimité.'

export const TRACK_PHASES: readonly TrackPhase[] = [
  {
    id: 'intro',
    label: 'Intro',
    shortCode: 'INT',
    defaultEnergy: 25,
    description: 'Ouverture atmosphérique, montée progressive et kick filtré',
  },
  {
    id: 'build-up',
    label: 'Build-Up',
    shortCode: 'BLD',
    defaultEnergy: 65,
    description: 'Tension croissante, roulements de percussions et montées de filtres',
  },
  {
    id: 'drop',
    label: 'Drop',
    shortCode: 'DRP',
    defaultEnergy: 95,
    description: 'Impact maximal, sub-bass explosive et groove complet',
  },
  {
    id: 'main-groove',
    label: 'Main Groove',
    shortCode: 'GRV',
    defaultEnergy: 85,
    description: 'Régularité hypnotique, percussions tranchantes et motif principal',
  },
  {
    id: 'breakdown',
    label: 'Breakdown',
    shortCode: 'BRK',
    defaultEnergy: 35,
    description: 'Retrait rythmique, focus mélodique/pads et respiration suspendue',
  },
  {
    id: 'bridge',
    label: 'Bridge',
    shortCode: 'BRG',
    defaultEnergy: 55,
    description: 'Transition harmonique, contre-temps ou nouveau motif rythmique',
  },
  {
    id: 'second-drop',
    label: 'Second Drop',
    shortCode: 'DR2',
    defaultEnergy: 98,
    description: 'Réinjection du beat avec intensité décuplée et couches saturées',
  },
  {
    id: 'climax',
    label: 'Climax',
    shortCode: 'CLX',
    defaultEnergy: 100,
    description: 'Sommet d’énergie du morceau, synths débridés et saturation analogique',
  },
  {
    id: 'outro',
    label: 'Outro',
    shortCode: 'OUT',
    defaultEnergy: 30,
    description: 'Déconstruction progressive, couches isolées et transition de fin',
  },
] as const

export const DEFAULT_PHASE_SEQUENCE: readonly string[] = [
  'Intro',
  'Build-Up',
  'Drop',
  'Breakdown',
  'Climax',
  'Outro',
]

export const STABLE_AUDIO_TAGS: readonly AudioTag[] = [
  // Stable Audio 3 documents un prompt libre structuré par type, genre,
  // instruments, énergie et BPM. Aucun tag ci-dessous ne prétend verrouiller
  // un réglage de mixage ou le tempo : ce sont des indications musicales.
  { id: 'track-type-music', label: 'TrackType: Music', category: 'prompt', description: 'Marqueur de type explicitement montré dans le guide Stable Audio 3.' },
  { id: 'vocal-type-instrumental', label: 'VocalType: Instrumental', category: 'prompt', description: 'Marqueur de type utile pour demander une piste instrumentale.' },
  { id: 'genre-techno', label: 'Genre: Techno', category: 'prompt', description: 'Format Genre: documenté par SA3, avec une valeur présente dans les annotations du modèle Berlin.' },
  { id: 'genre-minimal-techno', label: 'Genre: Minimal Techno', category: 'prompt', description: 'Même format documenté, appliqué au style minimal du modèle Berlin.' },
  { id: 'instruments-drums', label: 'Instruments: Drums', category: 'prompt', description: 'Format Instruments: documenté par SA3 pour décrire la famille rythmique.' },
  { id: 'instruments-bass', label: 'Instruments: Bass', category: 'prompt', description: 'Format Instruments: documenté par SA3 pour décrire la basse.' },

  // --- STYLES & GENRES OBSERVÉS DANS LE MODÈLE / SA3 ---
  { id: 'techno', label: 'Techno', category: 'style', description: 'Genre dominant des annotations du modèle Berlin.' },
  { id: 'minimal-techno', label: 'Minimal Techno', category: 'style', description: 'Groove minimal avec variations fines et espace autour du kick.' },
  { id: 'berlin-techno', label: 'Berlin Techno', category: 'style', description: 'Référence locale : quatre temps, hats discrets et basse lisible.' },
  { id: 'deep-techno', label: 'Deep Techno', category: 'style', description: 'Techno profonde et retenue, présente dans le vocabulaire du modèle.' },
  { id: 'industrial-techno', label: 'Industrial Techno', category: 'style', description: 'Texture métallique et énergie brute de la recette Berlin.' },
  { id: 'acid-techno', label: 'Acid Techno', category: 'style', description: 'Techno centrée sur une ligne acid et un mouvement de filtre.' },
  { id: 'dub-techno', label: 'Dub Techno', category: 'style', description: 'Accords dub, espace, delay et reverb : des éléments de prompt concrets.' },
  { id: 'hard-techno', label: 'Hard Techno', category: 'style', description: 'Techno plus dense et plus énergique, observée dans le modèle.' },
  { id: 'house', label: 'House', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'deep-house', label: 'Deep House', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'tech-house', label: 'Tech House', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'microhouse', label: 'Microhouse', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'melodic-house', label: 'Melodic House', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'progressive-house', label: 'Progressive House', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'neo-trance', label: 'Neo Trance', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'peak-time', label: 'Peak Time', category: 'style', description: 'Indication d’énergie présente dans les annotations du modèle Berlin.' },
  { id: 'electro', label: 'Electro', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin.' },
  { id: 'idm', label: 'IDM', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin ; à utiliser pour une rythmique plus complexe.' },
  { id: 'ambient', label: 'Ambient', category: 'style', description: 'Genre présent dans les annotations du modèle Berlin ; apporte surtout de l’espace.' },
  { id: 'experimental', label: 'Experimental', category: 'style', description: 'Indication présente dans les annotations du modèle Berlin.' },
  { id: 'breakbeat', label: 'Breakbeat', category: 'style', description: 'Rythmique cassée ; à choisir volontairement car elle sort du quatre-au-sol.' },

  // --- INSTRUMENTS & SYNTHÈSE ---
  { id: 'bass', label: 'Bass', category: 'instruments', description: 'Élément central du vocabulaire musical et de la recette Berlin.' },
  { id: 'sub-bass', label: 'Sub Bass', category: 'instruments', description: 'Fondation grave ; à garder lisible sous le kick.' },
  { id: 'acid-303', label: 'Acid 303 Bassline', category: 'instruments', description: 'Ligne acid avec résonance et mouvement de filtre.' },
  { id: '808-sub', label: '808 Sub', category: 'instruments', description: 'Sub grave court et identifiable, utile comme variation de basse.' },
  { id: 'fm-bass', label: 'FM Bass', category: 'instruments', description: 'Basse harmonique de synthèse FM pour changer le timbre sans changer le rôle.' },
  { id: 'reece-bass', label: 'Reese Bass', category: 'instruments', description: 'Basse désaccordée et large, à doser pour ne pas masquer le kick.' },
  { id: 'analog-pad', label: 'Analog Pad', category: 'instruments', description: 'Nappe de synthétiseur analogique pour soutenir l’espace.' },
  { id: 'chord-stab', label: 'Chord Stab', category: 'instruments', description: 'Accord court et percussif, facile à faire varier dans le groove.' },
  { id: 'dub-chords', label: 'Dub Chords', category: 'instruments', description: 'Accords filtrés avec delay et reverb.' },
  { id: 'atmospheric-drone', label: 'Atmospheric Drone', category: 'instruments', description: 'Texture continue d’arrière-plan, sans en faire une nouvelle mélodie.' },

  // --- RYTHMIQUE & DRUMS ---
  { id: 'four-to-the-floor', label: 'Four-to-the-floor Kick', category: 'rhythm', description: 'Kick sur chaque temps : invariant de la recette Berlin.' },
  { id: 'punchy-kick', label: 'Punchy Kick', category: 'rhythm', description: 'Kick net et perceptible, sans promesse de modèle de machine précis.' },
  { id: 'rumble-kick', label: 'Rumble Kick', category: 'rhythm', description: 'Kick techno avec une queue grave contrôlée.' },
  { id: 'clean-kick', label: 'Clean Kick', category: 'rhythm', description: 'Kick lisible au-dessus de la basse.' },
  { id: 'closed-hihats', label: 'Closed Hi-Hats', category: 'rhythm', description: 'Charlestons fermés et discrets.' },
  { id: 'open-hat', label: 'Open Hi-Hat', category: 'rhythm', description: 'Charleston ouvert sur le contretemps.' },
  { id: 'shaker', label: 'Shaker', category: 'rhythm', description: 'Petite percussion continue pour donner du mouvement.' },
  { id: 'clap', label: 'Clap', category: 'rhythm', description: 'Accent de caisse claire simple et identifiable.' },
  { id: 'rimshot', label: 'Rimshot', category: 'rhythm', description: 'Accent sec de percussion.' },
  { id: 'metallic-percussion', label: 'Metallic Percussion', category: 'rhythm', description: 'Percussion métallique, cohérente avec la texture industrielle Berlin.' },
  { id: 'tom-groove', label: 'Tom Groove', category: 'rhythm', description: 'Toms utilisés comme ponctuation grave du groove.' },
  { id: 'rolling-groove', label: 'Rolling Groove', category: 'rhythm', description: 'Pulsation roulante pour maintenir le mouvement sans changer le BPM.' },
  { id: 'syncopated-groove', label: 'Syncopated Groove', category: 'rhythm', description: 'Accents décalés, indication musicale et non réglage de tempo.' },
  { id: 'dense-rhythm', label: 'Dense Rhythm', category: 'rhythm', description: 'Densité rythmique présente dans les annotations du modèle Berlin.' },
  { id: 'sparse-rhythm', label: 'Sparse Rhythm', category: 'rhythm', description: 'Densité rythmique présente dans les annotations du modèle Berlin.' },
  { id: 'moderate-density-rhythm', label: 'Moderate-density Rhythm', category: 'rhythm', description: 'Densité rythmique présente dans les annotations du modèle Berlin.' },

  // --- AMBIANCE & MOOD ---
  { id: 'hypnotic', label: 'Hypnotic', category: 'mood', description: 'Répétition stable avec petites variations de détail.' },
  { id: 'dark', label: 'Dark', category: 'mood', description: 'Humeur sombre présente dans le vocabulaire local.' },
  { id: 'atmospheric', label: 'Atmospheric', category: 'mood', description: 'Espace et texture autour du groove.' },
  { id: 'driving', label: 'Driving', category: 'mood', description: 'Poussée en avant présente dans les annotations du modèle Berlin.' },
  { id: 'deep', label: 'Deep', category: 'mood', description: 'Humeur profonde sans demander un changement de tempo.' },
  { id: 'raw', label: 'Raw', category: 'mood', description: 'Texture brute et moins polie.' },
  { id: 'warehouse', label: 'Warehouse', category: 'mood', description: 'Espace industriel de hangar.' },
  { id: 'nocturnal', label: 'Nocturnal', category: 'mood', description: 'Humeur nocturne et urbaine.' },
  { id: 'tension', label: 'Tension', category: 'mood', description: 'Énergie contenue pour faire évoluer le morceau progressivement.' },
  { id: 'emotive', label: 'Emotive', category: 'mood', description: 'Indication d’expression présente dans les annotations du modèle Berlin.' },

  // --- TECHNIQUES / EFFETS DE PROMPT (PAS LE DSP DE SORTIE) ---
  { id: 'analog-warmth', label: 'Analog Warmth', category: 'production', description: 'Couleur analogique demandée dans le prompt.' },
  { id: 'tape-saturation', label: 'Tape Saturation', category: 'production', description: 'Saturation douce de type bande demandée dans le prompt.' },
  { id: 'sidechain-pumping', label: 'Sidechain Pumping', category: 'production', description: 'Pompage rythmique lié au kick demandé dans le prompt.' },
  { id: 'spatial-reverb', label: 'Spatial Reverb', category: 'production', description: 'Reverb spatiale demandée dans le prompt.' },
  { id: 'tape-delay', label: 'Tape Delay', category: 'production', description: 'Delay de type bande, cohérent avec le vocabulaire dub.' },
  { id: 'resonant-filter', label: 'Resonant Filter Movement', category: 'production', description: 'Mouvement de filtre résonant demandé dans le prompt.' },
]

export const formatPhasesPrompt = (phases: readonly string[]): string => {
  if (!phases || phases.length === 0) return ''
  return `arrangement: ${phases.join(' -> ')}`
}

export const getTagCategory = (tagText: string): TagCategory | 'custom' => {
  const normalized = tagText.trim().toLowerCase()
  if (!normalized) return 'custom'

  const foundTag = STABLE_AUDIO_TAGS.find(
    (t) => t.label.toLowerCase() === normalized || t.id.toLowerCase() === normalized,
  )
  if (foundTag) return foundTag.category

  const foundPhase = TRACK_PHASES.find(
    (p) => p.label.toLowerCase() === normalized || p.shortCode.toLowerCase() === normalized || p.id.toLowerCase() === normalized,
  )
  if (foundPhase) return 'phases'

  if (/(tracktype|vocaltype|genre:|instruments:|format:)/i.test(normalized)) return 'prompt'

  // Keyword heuristic matching for user free-form tags
  if (/(techno|house|ambient|electro|dnb|drum & bass|jungle|breakbeat|idm|synthwave|darkwave|cyberpunk|downtempo|trance|disco|dub|rock|metal|garage)/i.test(normalized)) return 'style'
  if (/(bass|synth|lead|pad|string|pluck|drone|fm|303|808|modular|vocal|guitar|piano|organ|horn|flute|brass)/i.test(normalized)) return 'instruments'
  if (/(kick|hat|snare|clap|percussion|drum|groove|beat|shaker|tom|polyrhythm|syncopated|rimshot|roll)/i.test(normalized)) return 'rhythm'
  if (/(dark|hypnotic|driving|submerged|raw|warehouse|nocturnal|ethereal|euphoric|mood|vibe|chill|deep|aggressive|tension)/i.test(normalized)) return 'mood'
  if (/(saturation|tape|analog|reverb|delay|mix|sub|compression|stereo|sidechain|clean|mastering|spatial|warmth|filtering)/i.test(normalized)) return 'production'

  return 'custom'
}
