import React, { useMemo } from 'react';
import { ClipPath, Defs, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';
import type { EmbroideryZoneId } from '@dd/domain/omaniStyles';
import type { ThreadMaterial } from '@dd/visual/materials';
import { SHOW_PHYSICAL_EMBROIDERY_SCALE } from '@dd/visual/debug';
import {
  repeatsAlong,
  scaleForZone,
  type EmbroideryPhysical,
} from '@dd/visual/embroideryScale';
import type { Mm } from '@dd/visual/units';
import { CELL_MM, StitchMotif } from './stitchMotifs';

let seq = 0;
const nextId = () => `emb_${(seq += 1)}`;

/**
 * EMBROIDERY BAND — millimetre-accurate placement.
 *
 * The band's width comes from the ZONE, and the motif is scaled to fit it.
 * V1 did the reverse — sized the band around the artwork — which is how an
 * 18 mm shaq band became 130 mm. Doing it in this direction means the worst
 * case is a slightly squeezed motif, never a garment covered in a poster.
 */
export const EmbroideryBand: React.FC<{
  motif: MotifKey;
  zone: EmbroideryZoneId;
  physical: EmbroideryPhysical;
  /** Band start, in millimetres, in garment space. */
  x: Mm;
  y: Mm;
  /** Length of the run. Width comes from the zone. */
  length: Mm;
  orientation?: 'vertical' | 'horizontal';
  threads: [ThreadMaterial, ThreadMaterial, ThreadMaterial];
  /** Foreshortening as the band turns away from the camera, 0..1. */
  facing?: number;
  /** True when the view is too small for the highlight pass to be visible. */
  fine?: boolean;
  opacity?: number;
}> = ({
  motif,
  zone,
  physical,
  x,
  y,
  length,
  orientation = 'vertical',
  threads,
  facing = 1,
  fine = false,
  opacity = 1,
}) => {
  const clipId = useMemo(() => nextId(), []);
  if (motif === 'none' || length <= 0 || facing <= 0.05) return null;

  const { scale, bandWidth, repeat } = scaleForZone(physical, zone);
  // Turning away compresses the band across its width, never along its run —
  // exactly how a stripe on a cylinder behaves.
  const drawnWidth = bandWidth * Math.max(0.18, facing);
  const count = repeatsAlong(length, repeat);
  // The motif cell is authored at 10 mm; this maps it onto the physical band.
  const cellScale = (bandWidth / CELL_MM) * scale * Math.max(0.18, facing);
  const step = repeat;

  const bandW = orientation === 'vertical' ? drawnWidth : length;
  const bandH = orientation === 'vertical' ? length : drawnWidth;

  return (
    <G opacity={opacity}>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={x} y={y} width={bandW} height={bandH} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        {Array.from({ length: count }, (_, i) => {
          const along = i * step;
          const tx = orientation === 'vertical' ? x : x + along;
          const ty = orientation === 'vertical' ? y + along : y;
          return (
            <G key={i} transform={`translate(${tx}, ${ty}) scale(${cellScale})`}>
              <StitchMotif
                motif={motif}
                c1={threads[0]}
                c2={threads[1]}
                c3={threads[2]}
                // Stitch weight is physical; dividing by the cell scale keeps it
                // constant in millimetres however the motif is fitted.
                weight={physical.stitchWeight / cellScale}
                fine={fine}
              />
            </G>
          );
        })}
      </G>

      {SHOW_PHYSICAL_EMBROIDERY_SCALE ? (
        <G opacity={0.9}>
          <Rect x={x} y={y} width={bandW} height={bandH} fill="none" stroke="#E11" strokeWidth={0.4} />
          {Array.from({ length: Math.floor(length / 10) + 1 }, (_, i) =>
            orientation === 'vertical' ? (
              <Line key={i} x1={x - 3} y1={y + i * 10} x2={x} y2={y + i * 10} stroke="#E11" strokeWidth={0.3} />
            ) : (
              <Line key={i} x1={x + i * 10} y1={y - 3} x2={x + i * 10} y2={y} stroke="#E11" strokeWidth={0.3} />
            ),
          )}
          <SvgText x={x} y={y - 5} fontSize={7} fill="#E11">
            {`${bandWidth.toFixed(0)}mm w · ${repeat.toFixed(0)}mm rpt`}
          </SvgText>
        </G>
      ) : null}
    </G>
  );
};
