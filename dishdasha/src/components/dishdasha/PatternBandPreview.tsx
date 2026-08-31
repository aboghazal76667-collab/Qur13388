import React from 'react';
import Svg from 'react-native-svg';

import type { MotifKey } from '@dd/domain/types';
import { MotifBand } from './MotifBand';

/**
 * Standalone motif swatch — the pattern shown at real density in catalogues
 * and channel pickers, so a customer picks by looking at the stitching rather
 * than at a name.
 */
export const PatternBandPreview: React.FC<{
  motif: MotifKey;
  c1: string;
  c2: string;
  c3: string;
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
}> = ({ motif, c1, c2, c3, width = 44, height = 76, orientation = 'vertical' }) => (
  <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <MotifBand
      motif={motif}
      x={0}
      y={0}
      width={width}
      height={height}
      orientation={orientation}
      c1={c1}
      c2={c2}
      c3={c3}
    />
  </Svg>
);
