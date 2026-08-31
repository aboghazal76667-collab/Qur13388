import React from 'react';
import { Circle, G, Line, Path } from 'react-native-svg';

import type { FabricTexture } from '@dd/domain/types';
import { darken, lighten } from '@dd/engine/color';

/**
 * FABRIC TEXTURE SIMULATION.
 *
 * A flat RGB fill does not communicate cloth. These overlays approximate the
 * weave, slub and hand of each fabric family with fine vector strokes derived
 * from the garment colour itself, so a linen and a sateen in the same colour
 * still look like different materials.
 *
 * This is a simulation, not photography. The production path is a merchant
 * photographing a real bolt under standardised lighting; the resulting digital
 * swatch would replace these overlays through the same component API.
 */
type TextureProps = {
  texture: FabricTexture;
  baseHex: string;
  /** Region the texture covers, in the figure's own coordinate space. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Zoomed views get finer, denser lines. */
  detail?: number;
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const FabricTextureOverlay: React.FC<TextureProps> = ({
  texture,
  baseHex,
  x,
  y,
  width,
  height,
  detail = 1,
}) => {
  const dark = darken(baseHex, 7);
  const light = lighten(baseHex, 8);

  switch (texture) {
    case 'poplin': {
      const step = 5 / detail;
      return (
        <G opacity={0.35}>
          {range(Math.ceil(height / step)).map((i) => (
            <Line
              key={i}
              x1={x}
              y1={y + i * step}
              x2={x + width}
              y2={y + i * step}
              stroke={dark}
              strokeWidth={0.35}
            />
          ))}
        </G>
      );
    }

    case 'plain_weave': {
      const step = 7 / detail;
      return (
        <G opacity={0.28}>
          {range(Math.ceil(height / step)).map((i) => (
            <Line key={`h${i}`} x1={x} y1={y + i * step} x2={x + width} y2={y + i * step} stroke={dark} strokeWidth={0.3} />
          ))}
          {range(Math.ceil(width / step)).map((i) => (
            <Line key={`v${i}`} x1={x + i * step} y1={y} x2={x + i * step} y2={y + height} stroke={dark} strokeWidth={0.3} />
          ))}
        </G>
      );
    }

    case 'fine_twill': {
      const step = 6 / detail;
      const count = Math.ceil((width + height) / step);
      return (
        <G opacity={0.3}>
          {range(count).map((i) => (
            <Line
              key={i}
              x1={x - height + i * step}
              y1={y + height}
              x2={x + i * step}
              y2={y}
              stroke={dark}
              strokeWidth={0.45}
            />
          ))}
        </G>
      );
    }

    case 'wool_blend': {
      const step = 8 / detail;
      const count = Math.ceil((width + height) / step);
      return (
        <G opacity={0.34}>
          {range(count).map((i) => (
            <Line key={`a${i}`} x1={x - height + i * step} y1={y + height} x2={x + i * step} y2={y} stroke={dark} strokeWidth={0.6} />
          ))}
          {range(count).map((i) => (
            <Line key={`b${i}`} x1={x + i * step} y1={y + height} x2={x + height + i * step - height} y2={y} stroke={light} strokeWidth={0.4} />
          ))}
        </G>
      );
    }

    case 'linen_slub': {
      // Irregular dashes: linen's characteristic thick-and-thin yarn.
      const rows = Math.ceil(height / (6 / detail));
      return (
        <G opacity={0.4}>
          {range(rows).map((i) => {
            const yy = y + i * (6 / detail);
            const phase = (i * 37) % 100;
            return (
              <G key={i}>
                <Line x1={x + (phase / 100) * width * 0.3} y1={yy} x2={x + width * 0.45} y2={yy} stroke={dark} strokeWidth={0.5} />
                <Line x1={x + width * 0.55} y1={yy} x2={x + width - (phase / 100) * width * 0.25} y2={yy} stroke={dark} strokeWidth={0.4} />
              </G>
            );
          })}
        </G>
      );
    }

    case 'crepe': {
      // Fine stipple, laid out deterministically so it never flickers on rerender.
      const cols = Math.ceil(width / (7 / detail));
      const rows = Math.ceil(height / (7 / detail));
      return (
        <G opacity={0.26}>
          {range(rows).map((r) =>
            range(cols).map((c) => {
              const jitter = ((r * 31 + c * 17) % 5) - 2;
              return (
                <Circle
                  key={`${r}-${c}`}
                  cx={x + c * (7 / detail) + jitter}
                  cy={y + r * (7 / detail) + ((c * 13) % 4) - 2}
                  r={0.5}
                  fill={dark}
                />
              );
            }),
          )}
        </G>
      );
    }

    case 'sateen':
    default: {
      // Sateen shows almost no weave — the character is the sheen, applied
      // separately as a gradient. A few soft bands suggest the long floats.
      const step = 14 / detail;
      return (
        <G opacity={0.18}>
          {range(Math.ceil(height / step)).map((i) => (
            <Line key={i} x1={x} y1={y + i * step} x2={x + width} y2={y + i * step} stroke={light} strokeWidth={1.4} />
          ))}
        </G>
      );
    }
  }
};

/** Soft drape folds. Denser in the realistic preview than in the configurator. */
export const DrapeFolds: React.FC<{
  baseHex: string;
  paths: string[];
  intensity: number;
}> = ({ baseHex, paths, intensity }) => (
  <G>
    {paths.map((d, i) => (
      <Path
        key={i}
        d={d}
        stroke={i % 2 === 0 ? darken(baseHex, 9) : lighten(baseHex, 10)}
        strokeWidth={i % 2 === 0 ? 2.2 : 3.2}
        fill="none"
        opacity={intensity * (i % 2 === 0 ? 0.28 : 0.22)}
        strokeLinecap="round"
      />
    ))}
  </G>
);
