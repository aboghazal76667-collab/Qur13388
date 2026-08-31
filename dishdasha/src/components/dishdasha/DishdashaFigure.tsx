import React, { useMemo } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { colorHex, threadHex } from '@dd/data/colors';
import { getPattern } from '@dd/data/embroidery';
import { getFabric } from '@dd/data/fabrics';
import type { DesignConfig, FabricTexture } from '@dd/domain/types';
import { darken, lighten, mix, withAlpha } from '@dd/engine/color';
import {
  FURAKHA_LENGTHS,
  GEO,
  VIEW,
  detailScaleFor,
  viewBoxFor,
  type ZoomTarget,
} from './geometry';
import { MotifBand } from './MotifBand';
import { DrapeFolds, FabricTextureOverlay } from './textures';

/**
 * LAYER 1 — THE INSTANT CONFIGURATOR.
 *
 * A layered vector garment: silhouette, fabric colour, weave texture, sheen,
 * collar, placket embroidery, cuffs, furakha and shading are separate layers
 * over a shared geometry. Changing a colour repaints one layer, so the preview
 * updates on the same frame as the tap — no image regeneration, no network,
 * no cost.
 *
 * Replacing these vector layers with photographed/vectorised workshop assets
 * later means swapping the layer contents, not the architecture.
 */
let instanceSeq = 0;

export type DishdashaFigureProps = {
  config: DesignConfig;
  width: number;
  height: number;
  zoom?: ZoomTarget;
  /** Layer 2 look: deeper shading, folds, vignette and a ground shadow. */
  realistic?: boolean;
  /** Hides the background so the figure can sit on any surface. */
  transparentBackground?: boolean;
};

const SHEEN_OPACITY: Record<'matte' | 'soft' | 'satin', number> = {
  matte: 0.05,
  soft: 0.1,
  satin: 0.2,
};

export const DishdashaFigure: React.FC<DishdashaFigureProps> = ({
  config,
  width,
  height,
  zoom = 'full',
  realistic = false,
  transparentBackground = false,
}) => {
  const uid = useMemo(() => (instanceSeq += 1), []);
  const bodyClip = `body_clip_${uid}`;
  const bodyGrad = `body_grad_${uid}`;
  const sheenGrad = `sheen_grad_${uid}`;
  const bgGrad = `bg_grad_${uid}`;

  const fabric = getFabric(config.fabricId);
  const pattern = getPattern(config.embroideryPatternId);

  const base = colorHex(config.baseColorId);
  const texture: FabricTexture = fabric?.texture ?? 'plain_weave';
  const sheen = fabric?.sheen ?? 'matte';

  // Thread channels. Missing channels fall back to the previous one so a
  // one-thread pattern still renders with a sensible secondary tone.
  const c1 = threadHex(config.threadColorIds[0] ?? 'th_white');
  const c2 = threadHex(config.threadColorIds[1] ?? config.threadColorIds[0] ?? 'th_white');
  const c3 = threadHex(config.threadColorIds[2] ?? config.threadColorIds[0] ?? 'th_white');
  const furakha = threadHex(config.furakhaColorId);

  const detail = detailScaleFor(zoom);
  const foldIntensity = realistic ? 1 : 0.55;

  const collarOption = config.componentOptions.collar ?? 'collar_round_classic';
  const cuffOption = config.componentOptions.cuff ?? 'cuff_plain';
  const pocketOption = config.componentOptions.pocket ?? 'pocket_single';
  const furakhaLength = FURAKHA_LENGTHS[config.componentOptions.furakha_length ?? 'furakha_medium'] ?? 62;

  const shadowTone = darken(base, 12);
  const highlightTone = lighten(base, 10);

  return (
    <Svg width={width} height={height} viewBox={viewBoxFor(zoom)}>
      <Defs>
        <LinearGradient id={bodyGrad} x1="0" y1="0" x2="1" y2="0.4">
          <Stop offset="0" stopColor={darken(base, 5)} />
          <Stop offset="0.35" stopColor={lighten(base, realistic ? 5 : 3)} />
          <Stop offset="0.72" stopColor={base} />
          <Stop offset="1" stopColor={darken(base, realistic ? 11 : 7)} />
        </LinearGradient>
        <LinearGradient id={sheenGrad} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={SHEEN_OPACITY[sheen]} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={SHEEN_OPACITY[sheen] * 0.6} />
        </LinearGradient>
        <LinearGradient id={bgGrad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#EFE9DE" />
        </LinearGradient>
        <ClipPath id={bodyClip}>
          <Path d={GEO.body} />
        </ClipPath>
      </Defs>

      {!transparentBackground && (
        <Rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill={realistic ? `url(#${bgGrad})` : 'transparent'} />
      )}

      {realistic && (
        <Ellipse cx={150} cy={441} rx={92} ry={10} fill={withAlpha('#241F19', 0.13)} />
      )}

      {/* ── sleeves (behind the body so the shoulder seam reads correctly) ── */}
      <G>
        <Path d={GEO.leftSleeve} fill={darken(base, 4)} />
        <Path d={GEO.rightSleeve} fill={darken(base, 6)} />
        <Path d={GEO.leftSleeve} stroke={shadowTone} strokeWidth={0.8} fill="none" opacity={0.5} />
        <Path d={GEO.rightSleeve} stroke={shadowTone} strokeWidth={0.8} fill="none" opacity={0.5} />
      </G>

      {/* ── body: colour, weave, sheen, folds ── */}
      <G>
        <Path d={GEO.body} fill={`url(#${bodyGrad})`} />
        <G clipPath={`url(#${bodyClip})`}>
          <FabricTextureOverlay
            texture={texture}
            baseHex={base}
            x={70}
            y={60}
            width={160}
            height={380}
            detail={detail > 1 ? Math.min(3, detail) : 1}
          />
          <DrapeFolds baseHex={base} paths={[...GEO.folds]} intensity={foldIntensity} />
          <Rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill={`url(#${sheenGrad})`} />
        </G>
        <Path d={GEO.body} stroke={shadowTone} strokeWidth={0.9} fill="none" opacity={0.55} />
      </G>

      {/* ── neck opening shadow ── */}
      <Path d={GEO.neckOpening} fill={withAlpha(darken(base, 45), 0.55)} />

      {/* ── pocket ── */}
      {pocketOption !== 'pocket_none' && (
        <Rect
          x={GEO.pocket.x}
          y={GEO.pocket.y}
          width={GEO.pocket.width}
          height={GEO.pocket.height}
          rx={2}
          fill="none"
          stroke={pocketOption === 'pocket_hidden' ? withAlpha(shadowTone, 0.35) : shadowTone}
          strokeWidth={pocketOption === 'pocket_hidden' ? 0.7 : 1.1}
          strokeDasharray={pocketOption === 'pocket_hidden' ? '3 3' : undefined}
        />
      )}

      {/* ── placket embroidery: the main event ── */}
      {pattern && pattern.motif !== 'none' && (
        <G>
          <Rect
            x={GEO.placket.x}
            y={GEO.placket.y}
            width={GEO.placket.width}
            height={GEO.placket.height}
            fill={withAlpha(highlightTone, 0.5)}
          />
          <MotifBand
            motif={pattern.motif}
            x={GEO.placket.x}
            y={GEO.placket.y}
            width={GEO.placket.width}
            height={GEO.placket.height}
            orientation="vertical"
            c1={c1}
            c2={c2}
            c3={c3}
            weight={1}
          />
          <Line
            x1={GEO.placket.x}
            y1={GEO.placket.y}
            x2={GEO.placket.x}
            y2={GEO.placket.y + GEO.placket.height}
            stroke={withAlpha(shadowTone, 0.5)}
            strokeWidth={0.7}
          />
          <Line
            x1={GEO.placket.x + GEO.placket.width}
            y1={GEO.placket.y}
            x2={GEO.placket.x + GEO.placket.width}
            y2={GEO.placket.y + GEO.placket.height}
            stroke={withAlpha(shadowTone, 0.5)}
            strokeWidth={0.7}
          />
        </G>
      )}

      {/* ── chest side bands, only for three-thread patterns ── */}
      {pattern && pattern.channelCount === 3 && (
        <G opacity={0.9}>
          <MotifBand
            motif={pattern.motif}
            {...GEO.chestLeft}
            orientation="vertical"
            c1={c3}
            c2={c2}
            c3={c1}
          />
          <MotifBand
            motif={pattern.motif}
            {...GEO.chestRight}
            orientation="vertical"
            c1={c3}
            c2={c2}
            c3={c1}
          />
        </G>
      )}

      {/* ── collar ── */}
      <G>
        <Path
          d={GEO.neckline}
          stroke={c1}
          strokeWidth={collarOption === 'collar_band_low' ? 5 : 7}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={GEO.neckline}
          stroke={c2}
          strokeWidth={1.8}
          fill="none"
          strokeDasharray="3 2.4"
          strokeLinecap="round"
        />
        {collarOption === 'collar_round_piped' && (
          <Path
            d={GEO.neckline}
            stroke={mix(c1, '#FFFFFF', 0.45)}
            strokeWidth={10}
            fill="none"
            opacity={0.35}
            strokeLinecap="round"
          />
        )}
      </G>

      {/* ── cuffs ── */}
      <G>
        <Path d={GEO.leftCuff} fill={withAlpha(highlightTone, 0.6)} stroke={shadowTone} strokeWidth={0.7} />
        <Path d={GEO.rightCuff} fill={withAlpha(highlightTone, 0.6)} stroke={shadowTone} strokeWidth={0.7} />
        {cuffOption === 'cuff_stitched' && (
          <G>
            <Line x1={48} y1={236} x2={82} y2={244} stroke={c1} strokeWidth={1.2} strokeDasharray="2.5 2" />
            <Line x1={252} y1={236} x2={218} y2={244} stroke={c1} strokeWidth={1.2} strokeDasharray="2.5 2" />
          </G>
        )}
        {cuffOption === 'cuff_embroidered' && pattern && pattern.motif !== 'none' && (
          <G>
            <MotifBand
              motif={pattern.motif}
              {...GEO.cuffBandLeft}
              orientation="horizontal"
              c1={c1}
              c2={c2}
              c3={c3}
            />
            <MotifBand
              motif={pattern.motif}
              {...GEO.cuffBandRight}
              orientation="horizontal"
              c1={c1}
              c2={c2}
              c3={c3}
            />
          </G>
        )}
      </G>

      {/* ── furakha (tassel) ── */}
      {furakhaLength > 0 && (
        <G>
          <Line
            x1={GEO.furakhaAnchor.x}
            y1={GEO.furakhaAnchor.y}
            x2={GEO.furakhaAnchor.x}
            y2={GEO.furakhaAnchor.y + furakhaLength}
            stroke={furakha}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Circle
            cx={GEO.furakhaAnchor.x}
            cy={GEO.furakhaAnchor.y + furakhaLength + 3}
            r={4.2}
            fill={furakha}
          />
          {[-4, -2, 0, 2, 4].map((dx) => (
            <Line
              key={dx}
              x1={GEO.furakhaAnchor.x + dx * 0.6}
              y1={GEO.furakhaAnchor.y + furakhaLength + 6}
              x2={GEO.furakhaAnchor.x + dx}
              y2={GEO.furakhaAnchor.y + furakhaLength + 16}
              stroke={furakha}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
          <Circle
            cx={GEO.furakhaAnchor.x}
            cy={GEO.furakhaAnchor.y + furakhaLength + 3}
            r={4.2}
            fill={withAlpha('#FFFFFF', 0.25)}
          />
        </G>
      )}

      {realistic && (
        <G clipPath={`url(#${bodyClip})`} opacity={0.4}>
          <Path
            d="M76 432 L102 160 L106 72 L128 70 L128 432 Z"
            fill={withAlpha(shadowTone, 0.28)}
          />
          <Path d="M172 70 L194 72 L198 160 L224 432 L188 432 Z" fill={withAlpha(shadowTone, 0.18)} />
        </G>
      )}
    </Svg>
  );
};

/** Compact silhouette for cards, lists and comparison thumbnails. */
export const DishdashaThumb: React.FC<{
  config: DesignConfig;
  size?: number;
}> = ({ config, size = 96 }) => (
  <DishdashaFigure config={config} width={size} height={size * (VIEW.height / VIEW.width)} transparentBackground />
);
