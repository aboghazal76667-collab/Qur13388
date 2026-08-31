import React, { useMemo } from 'react';
import { ClipPath, Defs, G, Rect } from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';
import { Motif, TILE, type MotifColors } from './motifs';

let bandSeq = 0;
const nextClipId = () => `band_clip_${(bandSeq += 1)}`;

/**
 * Tiles a motif along an embroidery band (placket, collar edge, cuff).
 *
 * The band scales the tile to its own width so a pattern reads at the same
 * visual density whether it is on a 20px cuff in the thumbnail or a 200px
 * placket in the zoomed detail view.
 */
export const MotifBand: React.FC<
  {
    motif: MotifKey;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Vertical bands run down the placket; horizontal ones across cuffs. */
    orientation?: 'vertical' | 'horizontal';
    weight?: number;
    opacity?: number;
  } & MotifColors
> = ({
  motif,
  x,
  y,
  width,
  height,
  orientation = 'vertical',
  weight = 1,
  opacity = 1,
  c1,
  c2,
  c3,
}) => {
  const clipId = useMemo(() => nextClipId(), []);

  if (motif === 'none' || width <= 0 || height <= 0) return null;

  const crossAxis = orientation === 'vertical' ? width : height;
  const mainAxis = orientation === 'vertical' ? height : width;
  const scale = crossAxis / TILE;
  const step = TILE * scale;
  const count = Math.max(1, Math.ceil(mainAxis / step) + 1);

  return (
    <G opacity={opacity}>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={x} y={y} width={width} height={height} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        {Array.from({ length: count }, (_, i) => {
          const offset = i * step;
          const tx = orientation === 'vertical' ? x : x + offset;
          const ty = orientation === 'vertical' ? y + offset : y;
          return (
            <G key={i} transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              <Motif motif={motif} c1={c1} c2={c2} c3={c3} weight={weight / scale} />
            </G>
          );
        })}
      </G>
    </G>
  );
};
