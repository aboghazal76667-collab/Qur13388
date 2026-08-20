import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { seedUnit } from '@/services/threeD/mockSimulator';
import { Text } from '@/ui';

/**
 * Drag-to-rotate figurine preview.
 *
 * When a real provider is connected the result screen shows the provider's own
 * render. Until then this draws an actual turntable: a parametric figure whose
 * silhouette, shading and cast shadow are all recomputed from the viewing
 * angle, so dragging genuinely rotates a form rather than sliding a picture.
 *
 * It is labelled a demo everywhere it appears. A preview that pretended to be
 * a likeness of the parent's child would be the one thing this product must
 * never do.
 */

export interface FigurinePreviewProps {
  /** Stable per job, so the same memory always shows the same figure. */
  seed: string;
  size?: number;
  /** Rendered instead of the interactive turntable when a real render exists. */
  children?: React.ReactNode;
}

const TAU = Math.PI * 2;

interface Proportions {
  headRadius: number;
  bodyWidth: number;
  bodyHeight: number;
  legLength: number;
  armLength: number;
  shoulderY: number;
}

function proportionsFor(seed: string): Proportions {
  // A young child's head is roughly a quarter of their height, and the limbs
  // are short and soft. Adult proportions here would read as a mannequin.
  return {
    headRadius: 25 + seedUnit(seed, 'head') * 4,
    bodyWidth: 38 + seedUnit(seed, 'torso') * 7,
    bodyHeight: 46 + seedUnit(seed, 'height') * 7,
    legLength: 34 + seedUnit(seed, 'legs') * 7,
    armLength: 30 + seedUnit(seed, 'arms') * 5,
    shoulderY: 74,
  };
}

export function FigurinePreview({ seed, size = 260, children }: FigurinePreviewProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [angle, setAngle] = useState(0.35);
  const angleRef = useRef(0.35);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 2,
        onPanResponderMove: (_event, gesture) => {
          // One full turn per ~2.5 screen widths of drag: fast enough to feel
          // responsive, slow enough to stop on a face.
          const next = (angleRef.current + gesture.dx / 900) % TAU;
          setAngle(next);
        },
        onPanResponderRelease: () => {
          angleRef.current = angle;
        },
        onPanResponderTerminate: () => {
          angleRef.current = angle;
        },
      }),
    [angle],
  );

  const p = proportionsFor(seed);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Foreshortening: the figure narrows as it turns away from the viewer, and
  // the light stays fixed in world space so the shading sweeps across it.
  const widthScale = 0.55 + 0.45 * Math.abs(cos);
  const lightSweep = (cos + 1) / 2;

  const cx = 100;
  const groundY = 176;

  const torsoTop = p.shoulderY;
  const torsoBottom = torsoTop + p.bodyHeight;
  const halfWidth = (p.bodyWidth / 2) * widthScale;
  const hipHalf = halfWidth * 0.86;
  const headCx = cx + sin * 3;
  const headCy = torsoTop - p.headRadius * 0.75;

  const torsoPath = [
    `M ${cx - halfWidth} ${torsoTop}`,
    `C ${cx - halfWidth * 1.12} ${torsoTop + p.bodyHeight * 0.4}, ${cx - hipHalf * 1.05} ${torsoBottom - 8}, ${cx - hipHalf} ${torsoBottom}`,
    `L ${cx + hipHalf} ${torsoBottom}`,
    `C ${cx + hipHalf * 1.05} ${torsoBottom - 8}, ${cx + halfWidth * 1.12} ${torsoTop + p.bodyHeight * 0.4}, ${cx + halfWidth} ${torsoTop}`,
    `C ${cx + halfWidth * 0.6} ${torsoTop - 7}, ${cx - halfWidth * 0.6} ${torsoTop - 7}, ${cx - halfWidth} ${torsoTop}`,
    'Z',
  ].join(' ');

  // Arms swing forward and back with rotation, which is the strongest cue
  // that the thing is turning rather than squashing.
  const armSwing = sin * 9;
  const leftArm = `M ${cx - halfWidth * 0.92} ${torsoTop + 6} q ${-8 - armSwing} ${p.armLength * 0.5} ${-3 - armSwing} ${p.armLength}`;
  const rightArm = `M ${cx + halfWidth * 0.92} ${torsoTop + 6} q ${8 - armSwing} ${p.armLength * 0.5} ${3 - armSwing} ${p.armLength}`;

  // Legs stop a little short of the plinth; the feet close the gap, which is
  // what stops the figure reading as standing on stilts.
  const legGap = hipHalf * 0.42;
  const footY = groundY - 4;
  const leftLeg = `M ${cx - legGap} ${torsoBottom - 4} L ${cx - legGap - sin * 3} ${footY}`;
  const rightLeg = `M ${cx + legGap} ${torsoBottom - 4} L ${cx + legGap - sin * 3} ${footY}`;

  const strokeWidth = Math.max(13, p.bodyWidth * 0.34) * (0.72 + 0.28 * widthScale);

  return (
    <View style={{ gap: theme.spacing.md, alignItems: 'center' }}>
      <View
        {...(children ? {} : responder.panHandlers)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t.threeD.preview}
        accessibilityHint={children ? undefined : t.threeD.previewHint}
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.backgroundAlt,
          overflow: 'hidden',
        }}
      >
        {children ?? (
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id="stage" cx="50%" cy="42%" r="72%">
                <Stop offset="0%" stopColor={theme.colors.surface} stopOpacity="1" />
                <Stop offset="100%" stopColor={theme.colors.backgroundAlt} stopOpacity="1" />
              </RadialGradient>
              <LinearGradient id="clay" x1={`${100 - lightSweep * 100}%`} y1="0%" x2={`${200 - lightSweep * 100}%`} y2="100%">
                <Stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0.95" />
                <Stop offset="55%" stopColor={theme.colors.primary} stopOpacity="1" />
                <Stop offset="100%" stopColor={theme.colors.primaryPressed} stopOpacity="1" />
              </LinearGradient>
            </Defs>

            <Rect x="0" y="0" width="200" height="200" fill="url(#stage)" />

            {/* Contact shadow — it shifts with the light, grounding the figure. */}
            <Ellipse
              cx={cx + (0.5 - lightSweep) * 14}
              cy={groundY + 6}
              rx={34 * (0.8 + 0.2 * widthScale)}
              ry={7}
              fill={theme.colors.text}
              opacity={0.16}
            />

            {/* Plinth. Every figurine we print stands on one. */}
            <Ellipse cx={cx} cy={groundY + 2} rx="42" ry="9" fill={theme.colors.borderStrong} opacity={0.55} />
            <Ellipse cx={cx} cy={groundY - 1} rx="42" ry="9" fill={theme.colors.border} />

            <G>
              <Path d={leftLeg} stroke="url(#clay)" strokeWidth={strokeWidth * 0.72} strokeLinecap="round" fill="none" />
              <Path d={rightLeg} stroke="url(#clay)" strokeWidth={strokeWidth * 0.72} strokeLinecap="round" fill="none" />
              <Ellipse
                cx={cx - legGap - sin * 4}
                cy={footY + 3}
                rx={strokeWidth * 0.52 * widthScale + 3}
                ry={strokeWidth * 0.3}
                fill="url(#clay)"
              />
              <Ellipse
                cx={cx + legGap - sin * 4}
                cy={footY + 3}
                rx={strokeWidth * 0.52 * widthScale + 3}
                ry={strokeWidth * 0.3}
                fill="url(#clay)"
              />
              <Path d={leftArm} stroke="url(#clay)" strokeWidth={strokeWidth * 0.5} strokeLinecap="round" fill="none" />
              <Path d={rightArm} stroke="url(#clay)" strokeWidth={strokeWidth * 0.5} strokeLinecap="round" fill="none" />
              <Path d={torsoPath} fill="url(#clay)" />
              <Ellipse
                cx={headCx}
                cy={headCy}
                rx={p.headRadius * (0.72 + 0.28 * widthScale)}
                ry={p.headRadius}
                fill="url(#clay)"
              />
              {/* Specular highlight, fixed in world space. */}
              <Ellipse
                cx={headCx - (lightSweep - 0.5) * p.headRadius * 1.1}
                cy={headCy - p.headRadius * 0.35}
                rx={p.headRadius * 0.3 * widthScale}
                ry={p.headRadius * 0.22}
                fill={theme.colors.surface}
                opacity={0.28}
              />
            </G>
          </Svg>
        )}
      </View>

      {children ? null : (
        <Text variant="caption" color="textFaint" align="center" autoAlign={false}>
          {t.threeD.previewHint}
        </Text>
      )}
    </View>
  );
}
