import type { CSSProperties, ReactElement } from 'react'

const segmentShapes = {
  a: '5,2 23,2 26,5 23,8 5,8 2,5',
  b: '24,9 27,6 27,21 24,24 21,21 21,12',
  c: '24,27 27,24 27,39 24,42 21,39 21,30',
  d: '5,40 23,40 26,43 23,46 5,46 2,43',
  e: '1,24 4,27 7,30 7,39 4,42 1,39',
  f: '1,6 4,9 7,12 7,21 4,24 1,21',
  g: '5,21 23,21 26,24 23,27 5,27 2,24',
} as const

const litSegments: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g',
}

type SevenSegmentProps = {
  value: number | string | null
  digits: number
  decimals?: number
  signed?: boolean
  clock?: boolean
  pad?: boolean
  className?: string
}

/** A fixed bank of LED digits; punctuation and polarity have their own components. */
export const SevenSegment = ({ value, digits, decimals = 0, signed = false, clock = false, pad = false, className = '' }: SevenSegmentProps): ReactElement => {
  const text = value === null ? (clock ? '--:--' : '—') : typeof value === 'number' ? value.toFixed(decimals) : value
  const negative = text.startsWith('-') && /\d/.test(text)
  const empty = value === null || /^(?:-+:?)+$/.test(text)
  const raw = empty ? '-'.repeat(digits) : clock ? text.split(':').map((part) => part.padStart(2, '0')).join('') : text.replace(/^[+-]/, '').replace('.', '')
  const characters = raw.length > digits ? '-'.repeat(digits) : raw.padStart(digits, pad ? '0' : ' ')
  const punctuationWidth = clock ? 12 : decimals ? 8 : 0
  const signWidth = signed ? 16 : 0
  const width = digits * 34 + punctuationWidth + signWidth
  const punctuationIndex = clock ? digits - 2 : digits - decimals

  return <span className={`seven-segment ${className}`} data-value={text} data-digits={digits} style={{ '--segment-aspect': width / 54 } as CSSProperties}>
    <span className="machine-sr-only">{text}</span>
    <svg viewBox={`0 0 ${width} 54`} aria-hidden="true" focusable="false">
      {signed && <g className="seven-segment-polarity" transform="translate(0 3)">
        <rect x="-1" y="-2" width="15" height="51" rx="2" className="segment-well" />
        <path className={`segment ${!empty && text ? 'is-lit' : ''}`} d="M1 22H13V26H1Z" />
        <path className={`segment ${!empty && text && !negative ? 'is-lit' : ''}`} d="M5 18H9V30H5Z" />
      </g>}
      {Array.from(characters).map((character, index) => {
        const x = signWidth + index * 34 + (index >= punctuationIndex ? punctuationWidth : 0)
        return <g key={index} transform={`translate(${x} 3)`} className="seven-segment-digit">
          <rect x="-1" y="-2" width="31" height="51" rx="2" className="segment-well" />
          {Object.entries(segmentShapes).map(([name, points]) => <polygon key={name} points={points} className={`segment ${litSegments[character]?.includes(name) ? 'is-lit' : ''}`} />)}
        </g>
      })}
      {punctuationWidth > 0 && <g transform={`translate(${signWidth + punctuationIndex * 34 - 2} 3)`}>
        {clock ? <><circle cx="4" cy="15" r="2.5" className="segment is-lit" /><circle cx="4" cy="32" r="2.5" className="segment is-lit" /></> : <circle cx="3" cy="43" r="2.5" className="segment is-lit" />}
      </g>}
    </svg>
  </span>
}
