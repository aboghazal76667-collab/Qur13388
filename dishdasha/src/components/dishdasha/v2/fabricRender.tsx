import React from 'react';
import { G, Line, Path, Rect } from 'react-native-svg';

import { withAlpha } from '@dd/engine/color';
import type { FabricMaterial, ShadingRamp } from '@dd/visual/materials';
import { drapeProfile } from '@dd/visual/materials';
import type { Mm } from '@dd/visual/units';

/**
 * FABRIC RENDERING — weave, drape and thickness at millimetre scale.
 *
 * The weave is drawn at the material's real yarn pitch (0.3–1.0 mm), so it
 * reads as texture rather than as stripes. Below a threshold it is dropped
 * entirely: yarn finer than a pixel costs render time and shows nothing.
 *
 * EXPERIMENTAL — an approximation of textile response, not measured data.
 */
export const Weave: React.FC<{
  material: FabricMaterial;
  ramp: ShadingRamp;
  x: Mm;
  y: Mm;
  width: Mm;
  height: Mm;
  /** Millimetres represented by one on-screen point. */
  mmPerPt: number;
}> = ({ material, ramp, x, y, width, height, mmPerPt }) => {
  // Draw the weave only when a yarn is at least a third of a pixel wide;
  // otherwise it is invisible detail that still costs a path each.
  const pitch = Math.max(material.weavePitch, mmPerPt * 1.6);
  if (pitch > height / 4) return null;

  const rows = Math.min(260, Math.floor(height / pitch));
  const cols = Math.min(140, Math.floor(width / pitch));
  const opacity = 0.10 + material.roughness * 0.22;

  switch (material.weave) {
    case 'sateen':
      // Long floats: almost no visible structure, mostly lustre.
      return (
        <G opacity={opacity * 0.5}>
          {Array.from({ length: Math.min(90, rows) }, (_, i) => (
            <Line
              key={i}
              x1={x}
              y1={y + i * (height / Math.min(90, rows))}
              x2={x + width}
              y2={y + i * (height / Math.min(90, rows))}
              stroke={ramp.light}
              strokeWidth={pitch * 0.55}
            />
          ))}
        </G>
      );

    case 'twill':
      return (
        <G opacity={opacity}>
          {Array.from({ length: Math.min(200, rows + cols) }, (_, i) => {
            const off = i * pitch * 2.2;
            return (
              <Line
                key={i}
                x1={x - height + off}
                y1={y + height}
                x2={x + off}
                y2={y}
                stroke={ramp.shadow}
                strokeWidth={pitch * 0.42}
              />
            );
          })}
        </G>
      );

    case 'slub':
      // Linen's thick-and-thin yarn: broken runs of uneven weight.
      return (
        <G opacity={opacity}>
          {Array.from({ length: Math.min(150, rows) }, (_, i) => {
            const yy = y + i * (height / Math.min(150, rows));
            const phase = ((i * 37) % 100) / 100;
            return (
              <G key={i}>
                <Line x1={x + phase * width * 0.2} y1={yy} x2={x + width * 0.46} y2={yy} stroke={ramp.shadow} strokeWidth={pitch * (0.4 + phase * 0.5)} />
                <Line x1={x + width * 0.54} y1={yy} x2={x + width - phase * width * 0.18} y2={yy} stroke={ramp.shadow} strokeWidth={pitch * 0.4} />
              </G>
            );
          })}
        </G>
      );

    case 'crepe':
      return (
        <G opacity={opacity * 0.8}>
          {Array.from({ length: Math.min(120, rows) }, (_, i) => {
            const yy = y + i * (height / Math.min(120, rows));
            return (
              <Path
                key={i}
                d={`M ${x} ${yy} q ${width * 0.25} ${pitch * 1.2} ${width * 0.5} 0 q ${width * 0.25} ${-pitch * 1.2} ${width * 0.5} 0`}
                stroke={ramp.shadow}
                strokeWidth={pitch * 0.36}
                fill="none"
              />
            );
          })}
        </G>
      );

    case 'wool':
      return (
        <G opacity={opacity}>
          {Array.from({ length: Math.min(160, rows + cols) }, (_, i) => {
            const off = i * pitch * 2.6;
            return (
              <G key={i}>
                <Line x1={x - height + off} y1={y + height} x2={x + off} y2={y} stroke={ramp.shadow} strokeWidth={pitch * 0.5} />
                <Line x1={x + off} y1={y + height} x2={x + off + height} y2={y} stroke={ramp.light} strokeWidth={pitch * 0.32} />
              </G>
            );
          })}
        </G>
      );

    case 'plain':
    default:
      return (
        <G opacity={opacity}>
          {Array.from({ length: Math.min(180, rows) }, (_, i) => (
            <Line key={`h${i}`} x1={x} y1={y + i * (height / Math.min(180, rows))} x2={x + width} y2={y + i * (height / Math.min(180, rows))} stroke={ramp.shadow} strokeWidth={pitch * 0.34} />
          ))}
          {Array.from({ length: Math.min(110, cols) }, (_, i) => (
            <Line key={`v${i}`} x1={x + i * (width / Math.min(110, cols))} y1={y} x2={x + i * (width / Math.min(110, cols))} y2={y + height} stroke={ramp.shadow} strokeWidth={pitch * 0.30} />
          ))}
        </G>
      );
  }
};

/**
 * Drape folds. Count and softness come from the material, and the folds shift
 * with the camera so the garment reads as a turning solid rather than a
 * repainted flat shape.
 */
export const DrapeFolds: React.FC<{
  material: FabricMaterial;
  ramp: ShadingRamp;
  centreX: Mm;
  topY: Mm;
  hemY: Mm;
  halfWidth: Mm;
  theta: number;
}> = ({ material, ramp, centreX, topY, hemY, halfWidth, theta }) => {
  const { foldCount, foldSoftness, foldContrast } = drapeProfile(material);
  const rad = (theta * Math.PI) / 180;

  return (
    <G>
      {Array.from({ length: foldCount }, (_, i) => {
        const t = (i + 0.5) / foldCount;
        // Folds bunch toward the silhouette edges, as cloth does on a body.
        const across = Math.cos(Math.PI * t) * halfWidth * 0.82;
        // Sliding with the camera is what sells the rotation.
        const shift = Math.sin(rad) * halfWidth * 0.22;
        const x = centreX + across + shift;
        const isShadow = i % 2 === 0;
        const start = topY + (hemY - topY) * 0.18;
        return (
          <Path
            key={i}
            d={`M ${x} ${start} C ${x - halfWidth * 0.05} ${(start + hemY) / 2} ${x + halfWidth * 0.06} ${hemY - (hemY - start) * 0.2} ${x + across * 0.16} ${hemY}`}
            stroke={isShadow ? ramp.deepShadow : ramp.light}
            strokeWidth={halfWidth * (isShadow ? 0.10 : 0.14) * foldSoftness}
            fill="none"
            opacity={foldContrast * (isShadow ? 1 : 0.75)}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
};

/** Cut edges read as thickness, which is most of what makes cloth look solid. */
export const EdgeThickness: React.FC<{
  d: string;
  material: FabricMaterial;
  ramp: ShadingRamp;
}> = ({ d, material, ramp }) => (
  <G>
    <Path d={d} fill="none" stroke={ramp.deepShadow} strokeWidth={material.thickness * 2.2} opacity={0.32} />
    <Path d={d} fill="none" stroke={withAlpha(ramp.shadow, 0.55)} strokeWidth={material.thickness} />
  </G>
);
