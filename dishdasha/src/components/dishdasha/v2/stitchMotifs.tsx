import React from 'react';
import { G, Line, Path, Circle } from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';
import type { ThreadMaterial } from '@dd/visual/materials';
import { threadHighlight } from '@dd/visual/materials';

/**
 * STITCH-LEVEL MOTIFS.
 *
 * The difference from V1 is not the shapes — it is the scale and the drawing
 * model. V1 drew a 40-unit tile that landed ~160 mm tall on the garment, so
 * the motifs read as printed graphics. These are authored in a **10 mm × 10 mm
 * cell** and drawn as thread: a shaded core stroke with a finer highlight
 * along it, so each line has the rounded body of a real stitch rather than
 * being a flat vector path.
 *
 * All artwork is original geometric construction for this project.
 */

/** Motifs are authored in a 10 mm square and scaled to the zone's band. */
export const CELL_MM = 10;

type StitchProps = {
  c1: ThreadMaterial;
  c2: ThreadMaterial;
  c3: ThreadMaterial;
  /** Stitch line weight in millimetres. */
  weight: number;
  /** Below ~0.35 mm/pt the highlight pass is invisible; skip it. */
  fine: boolean;
};

/**
 * One thread run: a shaded core with a highlight riding on top. Two strokes
 * instead of one is what makes stitching read as material rather than ink.
 */
const Thread: React.FC<{
  d: string;
  thread: ThreadMaterial;
  weight: number;
  fine: boolean;
  cap?: 'round' | 'butt';
}> = ({ d, thread, weight, fine, cap = 'round' }) => (
  <G>
    <Path
      d={d}
      stroke={thread.baseColour}
      strokeWidth={weight}
      fill="none"
      strokeLinecap={cap}
      strokeLinejoin="round"
    />
    {fine ? null : (
      <Path
        d={d}
        stroke={threadHighlight(thread)}
        strokeWidth={weight * 0.34}
        fill="none"
        strokeLinecap={cap}
        strokeLinejoin="round"
        opacity={0.55 + thread.highlightResponse * 0.35}
      />
    )}
  </G>
);

/** A satin-stitch knot: a short dense run rather than a filled dot. */
const Knot: React.FC<{ x: number; y: number; r: number; thread: ThreadMaterial }> = ({
  x,
  y,
  r,
  thread,
}) => (
  <G>
    <Circle cx={x} cy={y} r={r} fill={thread.baseColour} />
    <Circle cx={x - r * 0.28} cy={y - r * 0.28} r={r * 0.4} fill={threadHighlight(thread)} opacity={0.7} />
  </G>
);

const renderers: Record<MotifKey, (p: StitchProps) => React.ReactElement | null> = {
  none: () => null,

  chain_diamond: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M5 0.6 L9 5 L5 9.4 L1 5 Z" thread={c1} weight={weight} fine={fine} />
      <Thread d="M5 3 L7 5 L5 7 L3 5 Z" thread={c2} weight={weight * 0.7} fine={fine} />
    </G>
  ),

  twin_cord: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M3.4 0 C4.8 2.5 2 2.5 3.4 5 C4.8 7.5 2 7.5 3.4 10" thread={c1} weight={weight} fine={fine} />
      <Thread d="M6.6 0 C5.2 2.5 8 2.5 6.6 5 C5.2 7.5 8 7.5 6.6 10" thread={c2} weight={weight} fine={fine} />
    </G>
  ),

  palm_frond: ({ c1, c2, c3, weight, fine }) => (
    <G>
      <Thread d="M5 0 L5 10" thread={c1} weight={weight} fine={fine} />
      {[1.6, 3.7, 5.8, 7.9].map((y) => (
        <G key={y}>
          <Thread d={`M5 ${y} L2.2 ${y - 1.1}`} thread={c2} weight={weight * 0.75} fine={fine} />
          <Thread d={`M5 ${y} L7.8 ${y - 1.1}`} thread={c2} weight={weight * 0.75} fine={fine} />
          {fine ? null : (
            <>
              <Knot x={2.2} y={y - 1.1} r={weight * 0.5} thread={c3} />
              <Knot x={7.8} y={y - 1.1} r={weight * 0.5} thread={c3} />
            </>
          )}
        </G>
      ))}
    </G>
  ),

  lattice: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M0 0 L10 10 M10 0 L0 10" thread={c1} weight={weight} fine={fine} />
      <Thread d="M3.6 3.6 L6.4 3.6 L6.4 6.4 L3.6 6.4 Z" thread={c2} weight={weight * 0.7} fine={fine} />
    </G>
  ),

  wave_rope: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M2.8 0 C5.8 2 0.4 3 2.8 5 C5.8 7 0.4 8 2.8 10" thread={c1} weight={weight} fine={fine} />
      <Thread d="M7.2 0 C4.2 2 9.6 3 7.2 5 C4.2 7 9.6 8 7.2 10" thread={c2} weight={weight * 0.78} fine={fine} />
    </G>
  ),

  star_knot: ({ c1, c2, c3, weight, fine }) => (
    <G>
      <Thread d="M5 0.4 L6 3.8 L9.4 5 L6 6.2 L5 9.6 L4 6.2 L0.6 5 L4 3.8 Z" thread={c1} weight={weight} fine={fine} />
      <Thread d="M5 2.4 L7.6 5 L5 7.6 L2.4 5 Z" thread={c2} weight={weight * 0.65} fine={fine} />
      {fine ? null : <Knot x={5} y={5} r={weight * 0.72} thread={c3} />}
    </G>
  ),

  arch_row: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M1 8.6 L1 5 A4 4 0 0 1 9 5 L9 8.6" thread={c1} weight={weight} fine={fine} />
      <Thread d="M0.5 9.4 L9.5 9.4" thread={c2} weight={weight * 0.8} fine={fine} />
    </G>
  ),

  fine_pinstripe: ({ c1, weight, fine }) => (
    <G>
      <Thread d="M3.7 -0.2 L3.7 10.2" thread={c1} weight={weight * 0.8} fine={fine} cap="butt" />
      <Thread d="M6.3 -0.2 L6.3 10.2" thread={c1} weight={weight * 0.8} fine={fine} cap="butt" />
    </G>
  ),

  rope_braid: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M1.5 0 A3 3 0 0 1 8.5 0" thread={c1} weight={weight} fine={fine} />
      <Thread d="M1.5 5 A3 3 0 0 1 8.5 5" thread={c1} weight={weight} fine={fine} />
      <Thread d="M8.5 2.5 A3 3 0 0 1 1.5 2.5" thread={c2} weight={weight} fine={fine} />
      <Thread d="M8.5 7.5 A3 3 0 0 1 1.5 7.5" thread={c2} weight={weight} fine={fine} />
    </G>
  ),

  trellis: ({ c1, c2, c3, weight, fine }) => (
    <G>
      <Thread d="M5 0.2 L9.8 5 L5 9.8 L0.2 5 Z" thread={c1} weight={weight} fine={fine} />
      <Thread d="M5 0.2 L5 9.8 M0.2 5 L9.8 5" thread={c2} weight={weight * 0.55} fine={fine} />
      {fine ? null : <Knot x={5} y={5} r={weight * 0.62} thread={c3} />}
    </G>
  ),

  crescent_row: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M7 2 A3.5 3.5 0 1 0 7 8 A2.7 2.7 0 1 1 7 2 Z" thread={c1} weight={weight * 0.85} fine={fine} />
      {fine ? null : <Knot x={8.2} y={5} r={weight * 0.6} thread={c2} />}
    </G>
  ),

  zigzag_band: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M1 0 L5 2.5 L1 5 L5 7.5 L1 10" thread={c1} weight={weight} fine={fine} />
      <Thread d="M9 0 L5 2.5 L9 5 L5 7.5 L9 10" thread={c2} weight={weight} fine={fine} />
    </G>
  ),

  floret_chain: ({ c1, c2, c3, weight, fine }) => (
    <G>
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const x = 5 + Math.cos((a * Math.PI) / 180) * 2;
        const y = 5 + Math.sin((a * Math.PI) / 180) * 2;
        return (
          <Thread
            key={a}
            d={`M${x} ${y - 1} A1 1 0 1 1 ${x} ${y + 1} A1 1 0 1 1 ${x} ${y - 1}`}
            thread={c1}
            weight={weight * 0.6}
            fine={fine}
          />
        );
      })}
      {fine ? null : <Knot x={5} y={5} r={weight * 0.7} thread={c2} />}
      <Thread d="M5 8 L5 12" thread={c3} weight={weight * 0.6} fine={fine} />
    </G>
  ),

  double_arch: ({ c1, c2, weight, fine }) => (
    <G>
      <Thread d="M0.8 9.6 L0.8 5.4 A4.2 4.2 0 0 1 9.2 5.4 L9.2 9.6" thread={c1} weight={weight} fine={fine} />
      <Thread d="M2.6 9.6 L2.6 6 A2.4 2.4 0 0 1 7.4 6 L7.4 9.6" thread={c2} weight={weight * 0.72} fine={fine} />
    </G>
  ),

  square_kufic: ({ c1, c2, c3, weight, fine }) => (
    <G>
      <Path
        d="M1 1 L1 7 L4 7 L4 3 L7 3 L7 9 L9 9"
        stroke={c1.baseColour}
        strokeWidth={weight}
        fill="none"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
      {fine ? null : (
        <Path
          d="M1 1 L1 7 L4 7 L4 3 L7 3 L7 9 L9 9"
          stroke={threadHighlight(c1)}
          strokeWidth={weight * 0.32}
          fill="none"
          strokeLinejoin="miter"
        />
      )}
      <Thread d="M9 1 L6 1 L6 5 L3 5 L3 9" thread={c2} weight={weight * 0.78} fine={fine} cap="butt" />
      {fine ? null : <Knot x={8} y={5.5} r={weight * 0.55} thread={c3} />}
    </G>
  ),
};

export const StitchMotif: React.FC<{ motif: MotifKey } & StitchProps> = ({ motif, ...rest }) => {
  const render = renderers[motif] ?? renderers.none;
  return render(rest);
};

export const motifHasArtwork = (motif: MotifKey): boolean => motif !== 'none';
