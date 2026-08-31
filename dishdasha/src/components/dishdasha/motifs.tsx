import React from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';

/**
 * EMBROIDERY MOTIF LIBRARY.
 *
 * Every motif is drawn inside a 40×40 tile and takes up to three thread
 * colours as separate elements. That separation is the whole point: recolouring
 * channel 2 repaints only the elements bound to `c2`, exactly like changing
 * one spool on a real embroidery head — no re-render of the other threads and
 * no whole-pattern recolour.
 *
 * These are original geometric constructions drawn for this project. They are
 * placeholders for photographed/vectorised workshop patterns, not copies of
 * any proprietary catalogue.
 */
export const TILE = 40;

export type MotifColors = {
  c1: string;
  c2: string;
  c3: string;
};

type MotifProps = MotifColors & {
  /** Stroke weight multiplier — thicker for zoomed detail views. */
  weight?: number;
};

const renderers: Record<MotifKey, (p: MotifProps) => React.ReactElement | null> = {
  none: () => null,

  chain_diamond: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path
        d="M20 3 L35 20 L20 37 L5 20 Z"
        stroke={c1}
        strokeWidth={2.1 * weight}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M20 11 L28 20 L20 29 L12 20 Z"
        stroke={c2}
        strokeWidth={1.5 * weight}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1={20} y1={37} x2={20} y2={43} stroke={c1} strokeWidth={1.6 * weight} />
    </G>
  ),

  twin_cord: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path
        d="M13 0 C19 10 7 14 13 20 C19 30 7 34 13 40"
        stroke={c1}
        strokeWidth={2.3 * weight}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M27 0 C21 10 33 14 27 20 C21 30 33 34 27 40"
        stroke={c2}
        strokeWidth={2.3 * weight}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  ),

  palm_frond: ({ c1, c2, c3, weight = 1 }) => (
    <G>
      <Line x1={20} y1={0} x2={20} y2={40} stroke={c1} strokeWidth={2 * weight} />
      {[6, 14, 22, 30].map((y) => (
        <G key={y}>
          <Path d={`M20 ${y} L8 ${y - 5}`} stroke={c2} strokeWidth={1.5 * weight} strokeLinecap="round" />
          <Path d={`M20 ${y} L32 ${y - 5}`} stroke={c2} strokeWidth={1.5 * weight} strokeLinecap="round" />
          <Circle cx={8} cy={y - 5} r={1.4 * weight} fill={c3} />
          <Circle cx={32} cy={y - 5} r={1.4 * weight} fill={c3} />
        </G>
      ))}
    </G>
  ),

  lattice: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path d="M0 0 L40 40 M40 0 L0 40" stroke={c1} strokeWidth={1.9 * weight} fill="none" />
      <Rect x={16} y={16} width={8} height={8} stroke={c2} strokeWidth={1.5 * weight} fill="none" />
      <Circle cx={0} cy={20} r={1.6 * weight} fill={c2} />
      <Circle cx={40} cy={20} r={1.6 * weight} fill={c2} />
    </G>
  ),

  wave_rope: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path
        d="M11 0 C24 8 -2 12 11 20 C24 28 -2 32 11 40"
        stroke={c1}
        strokeWidth={2.4 * weight}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M29 0 C16 8 42 12 29 20 C16 28 42 32 29 40"
        stroke={c2}
        strokeWidth={1.7 * weight}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  ),

  star_knot: ({ c1, c2, c3, weight = 1 }) => (
    <G>
      <Path
        d="M20 2 L24 15 L37 20 L24 25 L20 38 L16 25 L3 20 L16 15 Z"
        stroke={c1}
        strokeWidth={1.9 * weight}
        fill="none"
        strokeLinejoin="round"
      />
      <Rect
        x={13}
        y={13}
        width={14}
        height={14}
        stroke={c2}
        strokeWidth={1.4 * weight}
        fill="none"
        transform="rotate(45 20 20)"
      />
      <Circle cx={20} cy={20} r={2.4 * weight} fill={c3} />
    </G>
  ),

  arch_row: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path
        d="M4 34 L4 20 A16 16 0 0 1 36 20 L36 34"
        stroke={c1}
        strokeWidth={2.1 * weight}
        fill="none"
      />
      <Line x1={2} y1={37} x2={38} y2={37} stroke={c2} strokeWidth={2 * weight} strokeLinecap="round" />
    </G>
  ),

  fine_pinstripe: ({ c1, weight = 1 }) => (
    <G>
      <Line x1={15} y1={-1} x2={15} y2={41} stroke={c1} strokeWidth={1.5 * weight} />
      <Line x1={25} y1={-1} x2={25} y2={41} stroke={c1} strokeWidth={1.5 * weight} />
    </G>
  ),

  rope_braid: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path d="M6 0 A12 12 0 0 1 34 0" stroke={c1} strokeWidth={2.2 * weight} fill="none" />
      <Path d="M6 20 A12 12 0 0 1 34 20" stroke={c1} strokeWidth={2.2 * weight} fill="none" />
      <Path d="M34 10 A12 12 0 0 1 6 10" stroke={c2} strokeWidth={2.2 * weight} fill="none" />
      <Path d="M34 30 A12 12 0 0 1 6 30" stroke={c2} strokeWidth={2.2 * weight} fill="none" />
    </G>
  ),

  trellis: ({ c1, c2, c3, weight = 1 }) => (
    <G>
      <Path
        d="M20 1 L39 20 L20 39 L1 20 Z"
        stroke={c1}
        strokeWidth={1.8 * weight}
        fill="none"
      />
      <Path d="M20 1 L20 39 M1 20 L39 20" stroke={c2} strokeWidth={1.2 * weight} />
      <Circle cx={20} cy={20} r={2.6 * weight} stroke={c3} strokeWidth={1.3 * weight} fill="none" />
    </G>
  ),

  crescent_row: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path
        d="M28 8 A14 14 0 1 0 28 32 A11 11 0 1 1 28 8 Z"
        stroke={c1}
        strokeWidth={1.8 * weight}
        fill="none"
      />
      <Circle cx={32} cy={20} r={2.2 * weight} fill={c2} />
    </G>
  ),

  zigzag_band: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path d="M4 0 L20 10 L4 20 L20 30 L4 40" stroke={c1} strokeWidth={2 * weight} fill="none" />
      <Path d="M36 0 L20 10 L36 20 L20 30 L36 40" stroke={c2} strokeWidth={2 * weight} fill="none" />
    </G>
  ),

  floret_chain: ({ c1, c2, c3, weight = 1 }) => (
    <G>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <Circle
          key={angle}
          cx={20 + Math.cos((angle * Math.PI) / 180) * 8}
          cy={20 + Math.sin((angle * Math.PI) / 180) * 8}
          r={4}
          stroke={c1}
          strokeWidth={1.4 * weight}
          fill="none"
        />
      ))}
      <Circle cx={20} cy={20} r={3} fill={c2} />
      <Line x1={20} y1={32} x2={20} y2={48} stroke={c3} strokeWidth={1.5 * weight} />
    </G>
  ),

  double_arch: ({ c1, c2, weight = 1 }) => (
    <G>
      <Path d="M3 38 L3 22 A17 17 0 0 1 37 22 L37 38" stroke={c1} strokeWidth={2.2 * weight} fill="none" />
      <Path d="M10 38 L10 24 A10 10 0 0 1 30 24 L30 38" stroke={c2} strokeWidth={1.6 * weight} fill="none" />
    </G>
  ),

  square_kufic: ({ c1, c2, c3, weight = 1 }) => (
    <G>
      <Path
        d="M4 4 L4 28 L16 28 L16 12 L28 12 L28 36 L36 36"
        stroke={c1}
        strokeWidth={2.2 * weight}
        fill="none"
        strokeLinejoin="miter"
      />
      <Path
        d="M36 4 L24 4 L24 20 L12 20 L12 36"
        stroke={c2}
        strokeWidth={1.8 * weight}
        fill="none"
        strokeLinejoin="miter"
      />
      <Rect x={32} y={20} width={4} height={4} fill={c3} />
    </G>
  ),
};

export const Motif: React.FC<{ motif: MotifKey } & MotifProps> = ({ motif, ...colors }) => {
  const render = renderers[motif] ?? renderers.none;
  return render(colors);
};

export const hasMotif = (motif: MotifKey): boolean => motif !== 'none';
