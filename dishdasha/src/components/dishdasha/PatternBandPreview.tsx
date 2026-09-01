import React from 'react';
import Svg, { Rect } from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';
import { getPattern } from '@dd/data/embroidery';
import { patternPhysical } from '@dd/visual/patternPhysical';
import { defaultPhysical } from '@dd/visual/embroideryScale';
import { threadMaterial } from '@dd/visual/materials';
import { getThreadColor } from '@dd/data/colors';
import { EmbroideryBand } from './v2/EmbroideryBand';

/**
 * Catalogue swatch for a pattern.
 *
 * Drawn by the SAME band renderer the garment uses, at the same millimetre
 * scale, so what a customer picks in the catalogue is what lands on the shaq.
 * V1 drew catalogue previews with a separate oversized tile, which is part of
 * why the on-garment result was a surprise.
 */
export const PatternBandPreview: React.FC<{
  motif: MotifKey;
  c1: string;
  c2: string;
  c3: string;
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  /** Pattern id, so the swatch uses the pattern's real physical profile. */
  patternId?: string;
  metallic?: [boolean, boolean, boolean];
}> = ({
  motif,
  c1,
  c2,
  c3,
  width = 44,
  height = 76,
  orientation = 'vertical',
  patternId,
  metallic = [false, false, false],
}) => {
  const pattern = patternId ? getPattern(patternId) : undefined;
  const physical = pattern ? patternPhysical(pattern) : defaultPhysical(2, 3);

  // The swatch is a window onto a real shaq band: show it at life size in
  // millimetres so the density the customer sees is the density they get.
  const viewW = orientation === 'vertical' ? physical.width * 1.9 : physical.repeat * 3.2;
  const viewH = orientation === 'vertical' ? physical.repeat * 3.6 : physical.width * 1.9;

  const threads: [ReturnType<typeof threadMaterial>, ReturnType<typeof threadMaterial>, ReturnType<typeof threadMaterial>] = [
    threadMaterial(c1, metallic[0]),
    threadMaterial(c2, metallic[1]),
    threadMaterial(c3, metallic[2]),
  ];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${viewW} ${viewH}`}>
      <Rect x={0} y={0} width={viewW} height={viewH} fill="transparent" />
      <EmbroideryBand
        motif={motif}
        zone="SHAQ"
        physical={physical}
        x={orientation === 'vertical' ? (viewW - physical.width) / 2 : 0}
        y={orientation === 'vertical' ? 0 : (viewH - physical.width) / 2}
        length={orientation === 'vertical' ? viewH : viewW}
        orientation={orientation}
        threads={threads}
      />
    </Svg>
  );
};
