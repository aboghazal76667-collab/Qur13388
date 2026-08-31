import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import type { MeasurementField } from '@dd/domain/types';
import { theme } from '@dd/theme/tokens';

/**
 * Visual measurement instructions.
 *
 * A simple front-facing body with the relevant span highlighted. Text alone
 * produces wrong measurements — "sleeve length" means different things to
 * different people — so every field gets a picture.
 */
const BODY = {
  head: { cx: 60, cy: 22, r: 12 },
  torso: 'M40 38 L80 38 L86 62 L84 108 L36 108 L34 62 Z',
  leftArm: 'M40 38 L26 46 L20 100',
  rightArm: 'M80 38 L94 46 L100 100',
  legs: 'M42 108 L40 160 M78 108 L80 160',
};

export const MeasurementDiagram: React.FC<{
  illustration: MeasurementField['illustration'];
  width?: number;
  height?: number;
}> = ({ illustration, width = 120, height = 170 }) => {
  const accent = theme.color.accent;
  const faint = theme.color.borderStrong;

  const highlight = () => {
    switch (illustration) {
      case 'length':
        return <Line x1={60} y1={38} x2={60} y2={155} stroke={accent} strokeWidth={3} strokeDasharray="5 3" />;
      case 'shoulder':
        return <Line x1={40} y1={40} x2={80} y2={40} stroke={accent} strokeWidth={3.5} />;
      case 'chest':
        return <Path d="M36 62 C48 70 72 70 84 62" stroke={accent} strokeWidth={3.5} fill="none" />;
      case 'waist':
        return <Path d="M35 84 C48 92 72 92 85 84" stroke={accent} strokeWidth={3.5} fill="none" />;
      case 'hip':
        return <Path d="M36 104 C48 112 72 112 84 104" stroke={accent} strokeWidth={3.5} fill="none" />;
      case 'sleeve':
        return <Path d="M80 40 L94 47 L100 99" stroke={accent} strokeWidth={3.5} fill="none" />;
      case 'neck':
        return <Circle cx={60} cy={34} r={9} stroke={accent} strokeWidth={3} fill="none" />;
      case 'armhole':
        return <Path d="M80 40 C90 50 88 62 80 66" stroke={accent} strokeWidth={3.5} fill="none" />;
      case 'cuff':
        return <Line x1={94} y1={98} x2={106} y2={101} stroke={accent} strokeWidth={4} />;
      case 'bottom':
        return <Line x1={30} y1={155} x2={90} y2={155} stroke={accent} strokeWidth={3.5} />;
      default:
        return <Rect x={44} y={60} width={32} height={30} stroke={accent} strokeWidth={2.5} fill="none" />;
    }
  };

  return (
    <Svg width={width} height={height} viewBox="0 0 120 170">
      <G opacity={0.5}>
        <Circle {...BODY.head} stroke={faint} strokeWidth={2} fill="none" />
        <Path d={BODY.torso} stroke={faint} strokeWidth={2} fill="none" />
        <Path d={BODY.leftArm} stroke={faint} strokeWidth={2} fill="none" />
        <Path d={BODY.rightArm} stroke={faint} strokeWidth={2} fill="none" />
        <Path d={BODY.legs} stroke={faint} strokeWidth={2} fill="none" />
      </G>
      {highlight()}
    </Svg>
  );
};
