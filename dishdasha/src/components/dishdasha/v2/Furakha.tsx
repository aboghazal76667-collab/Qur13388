import React from 'react';
import { Circle, G, Line, Path } from 'react-native-svg';

import type { ThreadMaterial } from '@dd/visual/materials';
import { threadHighlight, threadShade } from '@dd/visual/materials';
import type { FurakhaProfile } from '@dd/domain/omaniStyles';
import type { Mm } from '@dd/visual/units';

/**
 * FURAKHA ENGINE.
 *
 * The tassel that hangs from the neckline — a defining feature of the Omani
 * dishdasha, and in V1 a five-pixel icon. Here it is built at real scale from
 * the style profile (90/150/210 mm cords) and hangs under gravity: it stays
 * vertical whatever the camera angle and swings a little as the garment turns,
 * because a hanging cord does not rotate with the cloth it is attached to.
 */
export type FurakhaLength = 'short' | 'medium' | 'long' | 'none';

export const Furakha: React.FC<{
  profile: FurakhaProfile;
  length: FurakhaLength;
  /** Attachment point in garment millimetre space. */
  anchorX: Mm;
  anchorY: Mm;
  thread: ThreadMaterial;
  secondary?: ThreadMaterial;
  /** Camera angle, used only for the swing and the depth cue. */
  theta?: number;
  fine?: boolean;
}> = ({ profile, length, anchorX, anchorY, thread, secondary, theta = 0, fine = false }) => {
  if (length === 'none') return null;

  const cord = profile.cordLengths[length];
  const rad = (theta * Math.PI) / 180;
  // A hanging cord swings slightly across the body as the garment turns; it
  // never tilts with the fabric.
  const swing = Math.sin(rad) * cord * 0.10;
  const tipX = anchorX + swing;
  const tipY = anchorY + cord;
  const accent = secondary ?? thread;

  return (
    <G>
      {/* Cord: shaded core plus highlight, like every other thread run. */}
      <Path
        d={`M ${anchorX} ${anchorY} Q ${anchorX + swing * 0.4} ${anchorY + cord * 0.55} ${tipX} ${tipY}`}
        stroke={threadShade(thread)}
        strokeWidth={profile.cordThickness}
        fill="none"
        strokeLinecap="round"
      />
      {fine ? null : (
        <Path
          d={`M ${anchorX} ${anchorY} Q ${anchorX + swing * 0.4} ${anchorY + cord * 0.55} ${tipX} ${tipY}`}
          stroke={threadHighlight(thread)}
          strokeWidth={profile.cordThickness * 0.32}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      )}

      {/* Wrapped head. */}
      <Circle cx={tipX} cy={tipY} r={profile.tasselHeadRadius} fill={thread.baseColour} />
      <Circle
        cx={tipX - profile.tasselHeadRadius * 0.3}
        cy={tipY - profile.tasselHeadRadius * 0.3}
        r={profile.tasselHeadRadius * 0.44}
        fill={threadHighlight(thread)}
        opacity={0.6}
      />
      {fine ? null : (
        <>
          <Line
            x1={tipX - profile.tasselHeadRadius}
            y1={tipY - profile.tasselHeadRadius * 0.25}
            x2={tipX + profile.tasselHeadRadius}
            y2={tipY - profile.tasselHeadRadius * 0.25}
            stroke={accent.baseColour}
            strokeWidth={0.9}
            opacity={0.8}
          />
          <Line
            x1={tipX - profile.tasselHeadRadius}
            y1={tipY + profile.tasselHeadRadius * 0.3}
            x2={tipX + profile.tasselHeadRadius}
            y2={tipY + profile.tasselHeadRadius * 0.3}
            stroke={accent.baseColour}
            strokeWidth={0.9}
            opacity={0.8}
          />
        </>
      )}

      {/* Skirt: individual falls, splayed and of uneven length like real thread. */}
      <G>
        {Array.from({ length: fine ? 7 : 13 }, (_, i) => {
          const n = fine ? 7 : 13;
          const t = i / (n - 1) - 0.5;
          const spread = profile.tasselHeadRadius * 1.5;
          const fall = profile.skirtLength * (0.78 + 0.22 * Math.cos(t * Math.PI));
          const x0 = tipX + t * profile.tasselHeadRadius * 1.1;
          const x1 = tipX + t * spread;
          return (
            <Path
              key={i}
              d={`M ${x0} ${tipY + profile.tasselHeadRadius * 0.6} Q ${x1} ${tipY + fall * 0.6} ${x1} ${tipY + fall}`}
              stroke={i % 3 === 2 ? accent.baseColour : thread.baseColour}
              strokeWidth={profile.cordThickness * 0.42}
              fill="none"
              strokeLinecap="round"
              opacity={0.92}
            />
          );
        })}
      </G>
    </G>
  );
};
