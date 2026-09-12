export type TagCategory = 'style' | 'instruments' | 'rhythm' | 'mood' | 'production' | 'phases'

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
  style: 'Styles & Genres',
  instruments: 'Instruments & Synthèse',
  rhythm: 'Rythmique & Drums',
  mood: 'Ambiance & Mood',
  production: 'Production & Mix',
  phases: 'Phases & Structure',
}

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
  // --- STYLES & GENRES ---
  { id: 'minimal-techno', label: 'Minimal Techno', category: 'style', description: 'Techno dépouillée, focus sur le micro-groove et le rumble' },
  { id: 'berlin-techno', label: 'Berlin Techno', category: 'style', description: 'Ambiance warehouse industrielle, kick lourd et reverbs d’usine' },
  { id: 'industrial-techno', label: 'Industrial Techno', category: 'style', description: 'Sonorités métalliques dures, distorsion et kick caverneux' },
  { id: 'acid-techno', label: 'Acid Techno', category: 'style', description: 'Lignes de basse 303 résonantes et filtres modulés agressifs' },
  { id: 'dub-techno', label: 'Dub Techno', category: 'style', description: 'Accords spatiaux plongés dans le tape delay et reverb infinie' },
  { id: 'hard-techno', label: 'Hard Techno', category: 'style', description: 'Haute vélocité, kicks saturés et percussion abrasive' },
  { id: 'melodic-techno', label: 'Melodic Techno', category: 'style', description: 'Progressions d’accords dramatiques, arpèges amples et basses rondes' },
  { id: 'peak-time-techno', label: 'Peak Time Techno', category: 'style', description: 'Énergie maximale pour club, transitions percutantes' },
  { id: 'deep-house', label: 'Deep House', category: 'style', description: 'Chaleur feutrée, accords jazzy et basses profondes et rondes' },
  { id: 'tech-house', label: 'Tech House', category: 'style', description: 'Groove bondissant, percussions sèches et roulements de toms' },
  { id: 'progressive-house', label: 'Progressive House', category: 'style', description: 'Montées épiques, couches synthétiques et dynamique continue' },
  { id: 'dark-ambient', label: 'Dark Ambient', category: 'style', description: 'Drones ténébreux, textures obscures et nappes enveloppantes' },
  { id: 'ambient-drone', label: 'Ambient Drone', category: 'style', description: 'Drones continus sans percussion, méditation sonore' },
  { id: 'idm', label: 'IDM', category: 'style', description: 'Électronique intelligente, micro-glitch et rythmes déstructurés' },
  { id: 'downtempo', label: 'Downtempo', category: 'style', description: 'Tempo ralenti, textures veloutées et basse chaleureuse' },
  { id: 'drum-and-bass', label: 'Drum & Bass', category: 'style', description: '174 BPM, roulements syncopés et reece bass glissante' },
  { id: 'jungle', label: 'Jungle', category: 'style', description: 'Amen breaks hachés, samples de reggae et sub 808' },
  { id: 'breakbeat', label: 'Breakbeat', category: 'style', description: 'Rythmiques syncopées, kicks décalés et caisses claires tranchantes' },
  { id: 'electro', label: 'Electro', category: 'style', description: 'Vocoder, drum machines 808 syncopées et synthés robotiques' },
  { id: 'synthwave', label: 'Synthwave', category: 'style', description: 'Esthétique rétro années 80, pads amples et arpeggiators analogiques' },
  { id: 'darkwave', label: 'Darkwave', category: 'style', description: 'Synthés post-punk sombres, lignes de basse froides et reverb gothique' },
  { id: 'cyberpunk', label: 'Cyberpunk', category: 'style', description: 'Dystopie futuriste, saturation industrielle et néon sombre' },

  // --- INSTRUMENTS & SYNTHÈSE ---
  { id: 'sub-bass', label: 'Sub Bass', category: 'instruments', description: 'Basse sub-harmonique pure sous 60Hz' },
  { id: 'acid-303', label: 'Acid 303 Bassline', category: 'instruments', description: 'Basse Roland TB-303 avec slide et résonance modulée' },
  { id: '808-sub', label: '808 Sub', category: 'instruments', description: 'Sub basse 808 profonde et soutenue' },
  { id: 'reece-bass', label: 'Reece Bass', category: 'instruments', description: 'Ondes en dents de scie désaccordées et chorus menaçant' },
  { id: 'modular-lead', label: 'Modular Synth Lead', category: 'instruments', description: 'Lead synthétique modulaire aux harmoniques vivantes' },
  { id: 'fm-synth', label: 'FM Synth', category: 'instruments', description: 'Timbres cristallins et percutants de modulation de fréquence' },
  { id: 'analog-pad', label: 'Analog Pad', category: 'instruments', description: 'Nappe chaude et soyeuse de synthétiseur analogique' },
  { id: 'warm-strings', label: 'Warm Strings', category: 'instruments', description: 'Cordes synthétiques denses et enveloppantes' },
  { id: 'chord-stab', label: 'Chord Stab', category: 'instruments', description: 'Accords coupés nets, typiques techno de Détroit' },
  { id: 'dub-chords', label: 'Dub Chords', category: 'instruments', description: 'Accords mineurs filtrés et envoyés dans de longs delays' },
  { id: 'pluck-synth', label: 'Pluck Synth', category: 'instruments', description: 'Sons courts et piquants à l’enveloppe d’amplitude rapide' },
  { id: 'resonant-filter', label: 'Resonant Filter Sweep', category: 'instruments', description: 'Balayage de filtre passe-bas résonant' },
  { id: 'atmospheric-drone', label: 'Atmospheric Drone', category: 'instruments', description: 'Bourdon sonore texturé servant d’arrière-plan' },
  { id: 'vocal-drone', label: 'Vocal Drone', category: 'instruments', description: 'Textures vocales continues sans paroles intelligibles' },
  { id: 'glitch-fx', label: 'Glitch FX', category: 'instruments', description: 'Micro-coupures, bégaiements audio et bruits numériques' },
  { id: 'riser-fx', label: 'Riser FX', category: 'instruments', description: 'Montée en fréquence de tension pour transitions' },

  // --- RYTHMIQUE & DRUMS ---
  { id: 'punchy-kick', label: 'Punchy 909 Kick', category: 'rhythm', description: 'Kick Roland TR-909 avec transitoire nette et attaque solide' },
  { id: 'rumble-kick', label: 'Rumble Kick', category: 'rhythm', description: 'Kick techno accompagné de sa queue de réverbération sub compressée' },
  { id: 'distorted-kick', label: 'Distorted Kick', category: 'rhythm', description: 'Grosse caisse saturée avec harmoniques médiums percutantes' },
  { id: 'crisp-hihats', label: 'Crisp Hi-Hats', category: 'rhythm', description: 'Charlestons précis, brillants et micro-timés' },
  { id: 'open-hat', label: 'Open Hi-Hat', category: 'rhythm', description: 'Charleston ouvert sur le contre-temps' },
  { id: 'sizzling-shaker', label: 'Sizzling Shaker', category: 'rhythm', description: 'Shaker fluide donnant du mouvement et de la dynamique' },
  { id: 'clap-reverb', label: 'Clap Reverb', category: 'rhythm', description: 'Clap claquant avec queue de réverbération spatiale' },
  { id: 'rimshot', label: 'Rimshot', category: 'rhythm', description: 'Coup de baguette sec sur le cercle, son clair et direct' },
  { id: 'metallic-percussion', label: 'Metallic Percussion', category: 'rhythm', description: 'Tôles frottées, coups d’acier et résonances d’atelier' },
  { id: 'tom-groove', label: 'Tom Groove', category: 'rhythm', description: 'Toms accordés créant une pulsation mélodique basse' },
  { id: 'polyrhythm', label: 'Polyrhythm', category: 'rhythm', description: 'Superposition de métriques 3/4 et 4/4 pour complexité accrue' },
  { id: 'syncopated-groove', label: 'Syncopated Groove', category: 'rhythm', description: 'Décalage des accents pour une sensation de balancement irrésistible' },

  // --- AMBIANCE & MOOD ---
  { id: 'hypnotic', label: 'Hypnotic', category: 'mood', description: 'Caractère répétitif créant un état de transe' },
  { id: 'dark-menacing', label: 'Dark & Menacing', category: 'mood', description: 'Ambiance sombre, tension lourde et mystérieuse' },
  { id: 'atmospheric', label: 'Atmospheric', category: 'mood', description: 'Sensation d’immersion dans un espace vaste' },
  { id: 'driving', label: 'Driving', category: 'mood', description: 'Poussée en avant continue, groove moteur' },
  { id: 'deep-submerged', label: 'Deep & Submerged', category: 'mood', description: 'Sensation subaquatique, aigus atténués et sub enveloppant' },
  { id: 'raw-gritty', label: 'Raw & Gritty', category: 'mood', description: 'Grain texturé, rugosité analogique sans polissage excessif' },
  { id: 'warehouse-vibe', label: 'Warehouse Vibe', category: 'mood', description: 'Résonance de hangar en béton et acoustique brute' },
  { id: 'nocturnal', label: 'Nocturnal', category: 'mood', description: 'Évocation de virées nocturnes urbaines et mystère' },
  { id: 'ethereal', label: 'Ethereal', category: 'mood', description: 'Légèreté aérienne, apesanteur et sensation d’infini' },
  { id: 'euphoric', label: 'Euphoric', category: 'mood', description: 'Exaltation mélodique et libération d’énergie' },

  // --- PRODUCTION & MIX ---
  { id: 'analog-warmth', label: 'Analog Warmth', category: 'production', description: 'Rondeur et harmoniques paires d’un circuit analogique' },
  { id: 'tape-saturation', label: 'Tape Saturation', category: 'production', description: 'Compression naturelle et compression douce des crêtes sur bande' },
  { id: 'sidechain-pumping', label: 'Sidechain Pumping', category: 'production', description: 'Effet de pompe rythmique déclenché par le kick' },
  { id: 'stereo-width', label: 'Stereo Width', category: 'production', description: 'Largeur stéréophonique immersive et panoramiques maîtrisés' },
  { id: 'spatial-reverb', label: 'Spatial Reverb', category: 'production', description: 'Profondeur 3D et acoustique de cathédrale ou caverne' },
  { id: 'heavy-sub', label: 'Heavy Sub Low-End', category: 'production', description: 'Basses fréquences puissantes, propres et sans distorsion boueuse' },
  { id: 'clean-mix', label: 'Clean Mix', category: 'production', description: 'Séparation chirurgicale des instruments et absence de parasitage' },
  { id: 'club-system', label: 'Club Sound System', category: 'production', description: 'Étalonnage calibré pour restitution sur soundsystem puissant' },
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

  // Keyword heuristic matching for user free-form tags
  if (/(techno|house|ambient|electro|dnb|drum & bass|jungle|breakbeat|idm|synthwave|darkwave|cyberpunk|downtempo|trance|disco|dub|rock|metal|garage)/i.test(normalized)) return 'style'
  if (/(bass|synth|lead|pad|string|pluck|drone|fm|303|808|modular|vocal|guitar|piano|organ|horn|flute|brass)/i.test(normalized)) return 'instruments'
  if (/(kick|hat|snare|clap|percussion|drum|groove|beat|shaker|tom|polyrhythm|syncopated|rimshot|roll)/i.test(normalized)) return 'rhythm'
  if (/(dark|hypnotic|driving|submerged|raw|warehouse|nocturnal|ethereal|euphoric|mood|vibe|chill|deep|aggressive|tension)/i.test(normalized)) return 'mood'
  if (/(saturation|tape|analog|reverb|delay|mix|sub|compression|stereo|sidechain|clean|mastering|spatial|warmth|filtering)/i.test(normalized)) return 'production'

  return 'custom'
}

