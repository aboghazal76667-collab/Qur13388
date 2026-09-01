import React, { useMemo } from 'react';
import { PixelRatio } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { colorHex, getThreadColor, threadHex } from '@dd/data/colors';
import { getPattern } from '@dd/data/embroidery';
import { getFabric } from '@dd/data/fabrics';
import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { getOmaniStyle } from '@dd/domain/omaniStyles';
import { withAlpha } from '@dd/engine/color';
import {
  materialFor,
  shadingRamp,
  threadMaterial,
  type ThreadMaterial,
} from '@dd/visual/materials';
import { defaultPhysical } from '@dd/visual/embroideryScale';
import { CANVAS, STITCH, mmPerPoint, regionToViewBox, viewBox, type MmRegion } from '@dd/visual/units';
import { SHOW_GEOMETRY_GUIDES } from '@dd/visual/debug';
import {
  bodyOutlinePath,
  buildFrame,
  cuffBand,
  centreFrontX,
  facing,
  measurementsFromProfile,
  necklinePath,
  projectedHalfWidth,
  sleevePath,
  type ViewAngle,
} from '@dd/visual/garmentGeometry';
import { patternPhysical, patternZones } from '@dd/visual/patternPhysical';
import { EmbroideryBand } from './EmbroideryBand';
import { Furakha, type FurakhaLength } from './Furakha';
import { DrapeFolds, EdgeThickness, Weave } from './fabricRender';
import type { RenderQuality } from '@dd/visual/quality';
import { resolveQuality } from '@dd/visual/quality';

/**
 * DishdashaVisualEngineV2.
 *
 * Layers, each independently changeable:
 *
 *   GARMENT GEOMETRY  parametric, from measurements + Omani style profile
 *   FABRIC MATERIAL   weave / drape / sheen / thickness
 *   FABRIC COLOUR     dye, shaded by the material
 *   EMBROIDERY        millimetre-scaled bands per garment zone
 *   THREAD COLOURS    independent channels, each a thread material
 *   FURAKHA           hangs under gravity
 *   LIGHTING          one key direction, consistent across every angle
 *   CAMERA            continuous view angle
 *
 * NOT a 3D renderer. See docs/VISUAL_ENGINE_V2.md for what it actually is.
 */
let uid = 0;

export type EngineProps = {
  config: DesignConfig;
  width: number;
  height: number;
  /** 0 = front, 90 = side, 180 = back. Continuous. */
  angle?: ViewAngle;
  measurement?: MeasurementProfile | null;
  /** Crop, in millimetres, for detail inspection. */
  region?: MmRegion | null;
  quality?: RenderQuality;
  showGround?: boolean;
  background?: string | null;
};

export const DishdashaVisualEngineV2: React.FC<EngineProps> = ({
  config,
  width,
  height,
  angle = 0,
  measurement = null,
  region = null,
  quality = 'AUTO',
  showGround = true,
  background = null,
}) => {
  const id = useMemo(() => (uid += 1), []);
  const clipBody = `v2body_${id}`;
  const gradBody = `v2grad_${id}`;
  const gradSheen = `v2sheen_${id}`;

  const style = getOmaniStyle('om_standard');
  const fabric = getFabric(config.fabricId);
  const pattern = getPattern(config.embroideryPatternId);

  const baseHex = colorHex(config.baseColorId);
  const material = materialFor(fabric?.texture);
  const ramp = useMemo(() => shadingRamp(baseHex, material), [baseHex, material]);

  const frame = useMemo(
    () => buildFrame(measurementsFromProfile(measurement), style),
    [measurement, style],
  );

  const threads = useMemo<[ThreadMaterial, ThreadMaterial, ThreadMaterial]>(() => {
    const at = (i: number) => {
      const tid = config.threadColorIds[i] ?? config.threadColorIds[0] ?? 'th_white';
      const t = getThreadColor(tid);
      return threadMaterial(t?.hex ?? threadHex(tid), t?.metallic ?? false);
    };
    return [at(0), at(1), at(2)];
  }, [config.threadColorIds]);

  const furakhaThread = useMemo(() => {
    const t = getThreadColor(config.furakhaColorId);
    return threadMaterial(t?.hex ?? threadHex(config.furakhaColorId), t?.metallic ?? false);
  }, [config.furakhaColorId]);

  const viewWidthMm = region ? region.w : CANVAS.width;
  const mmPerPt = mmPerPoint(width, viewWidthMm);
  const q = resolveQuality(quality, width, region !== null, PixelRatio.get());
  const fine = mmPerPt > 0.55 || q === 'LIGHT';

  const cx = CANVAS.centreX;
  const zones = pattern ? patternZones(pattern) : [];
  const physical = pattern ? patternPhysical(pattern) : defaultPhysical(2, 0);

  const cuffOption = config.componentOptions.cuff ?? 'cuff_plain';
  const furakhaOption = (config.componentOptions.furakha_length ?? 'furakha_medium')
    .replace('furakha_', '') as FurakhaLength;

  // Section used for centre-front features (shaq, neckline, furakha).
  const chest = frame.chest;
  const frontFacing = facing(chest, 0, angle);
  const shaqX = cx + centreFrontX(chest, angle);
  const backFacing = facing(chest, 180, angle);

  const bodyPath = bodyOutlinePath(frame, angle);
  const hemHalf = projectedHalfWidth(frame.hem, angle);

  // Depth ordering: the sleeve on the far side of the body is drawn first.
  const rad = (angle * Math.PI) / 180;
  const rightIsNear = Math.sin(rad) <= 0;
  const sleeveOrder: ('left' | 'right')[] = rightIsNear ? ['right', 'left'] : ['left', 'right'];

  const renderSleeve = (side: 'left' | 'right', near: boolean) => {
    const d = sleevePath(frame, side, angle);
    const band = cuffBand(frame, side, angle);
    const zone = side === 'left' ? 'CUFF_LEFT' : 'CUFF_RIGHT';
    const showCuffEmbroidery =
      cuffOption === 'cuff_embroidered' && pattern && zones.includes(zone as never);
    return (
      <G key={side}>
        <Path d={d} fill={near ? ramp.base : ramp.shadow} />
        <Path d={d} fill="none" stroke={ramp.deepShadow} strokeWidth={STITCH.seam} opacity={0.35} />
        {/* Cuff finish: a turned-back hem, not a shirt cuff. */}
        <Rect
          x={band.x}
          y={band.y}
          width={band.w}
          height={band.h}
          fill={withAlpha(ramp.light, 0.35)}
          stroke={withAlpha(ramp.shadow, 0.5)}
          strokeWidth={STITCH.hairline}
        />
        {showCuffEmbroidery && pattern ? (
          <EmbroideryBand
            motif={pattern.motif}
            zone={zone as never}
            physical={physical}
            x={band.x}
            y={band.y + band.h * 0.2}
            length={band.w}
            orientation="horizontal"
            threads={threads}
            facing={near ? 1 : 0.55}
            fine={fine}
          />
        ) : null}
      </G>
    );
  };

  return (
    <Svg width={width} height={height} viewBox={region ? regionToViewBox(region) : viewBox()}>
      <Defs>
        {/* Key light from the upper left, constant at every camera angle. */}
        <LinearGradient id={gradBody} x1="0" y1="0" x2="1" y2="0.25">
          <Stop offset="0" stopColor={ramp.shadow} />
          <Stop offset="0.22" stopColor={ramp.light} />
          <Stop offset="0.58" stopColor={ramp.base} />
          <Stop offset="1" stopColor={ramp.deepShadow} />
        </LinearGradient>
        <LinearGradient id={gradSheen} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={ramp.specular} stopOpacity={ramp.specularStrength} />
          <Stop offset="0.45" stopColor={ramp.specular} stopOpacity={0} />
          <Stop offset="1" stopColor={ramp.specular} stopOpacity={ramp.specularStrength * 0.55} />
        </LinearGradient>
        <ClipPath id={clipBody}>
          <Path d={bodyPath} />
        </ClipPath>
      </Defs>

      {background ? <Rect x={0} y={0} width={CANVAS.width} height={CANVAS.height} fill={background} /> : null}

      {showGround ? (
        <Ellipse
          cx={cx}
          cy={frame.hemY + 26}
          rx={hemHalf * 1.02}
          ry={26}
          fill={withAlpha('#241F19', 0.14)}
        />
      ) : null}

      {/* far sleeve */}
      {renderSleeve(sleeveOrder[0], false)}

      {/* body */}
      <G>
        <Path d={bodyPath} fill={`url(#${gradBody})`} />
        <G clipPath={`url(#${clipBody})`}>
          {q !== 'LIGHT' ? (
            <Weave
              material={material}
              ramp={ramp}
              x={cx - frame.hem.halfWidth}
              y={frame.shoulder.y}
              width={frame.hem.halfWidth * 2}
              height={frame.hemY - frame.shoulder.y}
              mmPerPt={mmPerPt}
            />
          ) : null}
          <DrapeFolds
            material={material}
            ramp={ramp}
            centreX={cx}
            topY={frame.shoulder.y}
            hemY={frame.hemY}
            halfWidth={projectedHalfWidth(frame.chest, angle)}
            theta={angle}
          />
          <Rect x={0} y={0} width={CANVAS.width} height={CANVAS.height} fill={`url(#${gradSheen})`} />
        </G>
        <EdgeThickness d={bodyPath} material={material} ramp={ramp} />
      </G>

      {/* back embroidery, only when the tailor enables it and we are seeing the back */}
      {pattern && zones.includes('BACK') && backFacing > 0.2 ? (
        <EmbroideryBand
          motif={pattern.motif}
          zone="BACK"
          physical={physical}
          x={cx + centreFrontX(chest, angle + 180) - 8}
          y={frame.shoulder.y + 120}
          length={260}
          threads={threads}
          facing={backFacing}
          fine={fine}
        />
      ) : null}

      {/* neckline opening — collarless */}
      <G>
        <Path d={necklinePath(frame, angle)} fill={withAlpha(ramp.deepShadow, 0.72)} />
        <Path
          d={necklinePath(frame, angle)}
          fill="none"
          stroke={ramp.shadow}
          strokeWidth={style.necklineProfile.boundEdgeWidth * 0.5}
        />
      </G>

      {/* shaq: the front slit and its embroidery, both sides */}
      {frontFacing > 0.08 ? (
        <G>
          <Path
            d={`M ${shaqX} ${frame.shaq.top} L ${shaqX} ${frame.shaq.bottom}`}
            stroke={withAlpha(ramp.deepShadow, 0.8)}
            strokeWidth={frame.shaq.openingWidth * Math.max(0.2, frontFacing)}
            strokeLinecap="round"
          />
          {pattern && zones.includes('SHAQ') ? (
            <G>
              <EmbroideryBand
                motif={pattern.motif}
                zone="SHAQ"
                physical={physical}
                x={shaqX + frame.shaq.openingWidth * 0.6}
                y={frame.shaq.top}
                length={frame.shaq.bottom - frame.shaq.top}
                threads={threads}
                facing={frontFacing}
                fine={fine}
              />
              <EmbroideryBand
                motif={pattern.motif}
                zone="SHAQ"
                physical={physical}
                x={shaqX - frame.shaq.openingWidth * 0.6 - frame.shaq.bandWidth * Math.max(0.18, frontFacing)}
                y={frame.shaq.top}
                length={frame.shaq.bottom - frame.shaq.top}
                threads={threads}
                facing={frontFacing}
                fine={fine}
              />
            </G>
          ) : null}
        </G>
      ) : null}

      {/* neckline embroidery follows the bound edge */}
      {pattern && zones.includes('NECKLINE') && frontFacing > 0.08 ? (
        <EmbroideryBand
          motif={pattern.motif}
          zone="NECKLINE"
          physical={physical}
          x={shaqX - frame.neck.halfWidth * Math.max(0.2, frontFacing)}
          y={frame.shoulder.y + frame.neck.frontDrop * 0.62}
          length={frame.neck.halfWidth * 2 * Math.max(0.2, frontFacing)}
          orientation="horizontal"
          threads={threads}
          facing={frontFacing}
          fine={fine}
        />
      ) : null}

      {/* near sleeve */}
      {renderSleeve(sleeveOrder[1], true)}

      {/* Furakha — hangs from the neckline under gravity. It sits on the
          CHEST, so once the front turns away the body occludes it; drawing it
          on top at every angle would show a tassel through the garment's back. */}
      {frontFacing > 0 ? (
        <Furakha
          profile={style.furakhaProfile}
          length={furakhaOption}
          anchorX={shaqX}
          anchorY={frame.shoulder.y + frame.neck.frontDrop * style.furakhaProfile.attachmentDrop}
          thread={furakhaThread}
          secondary={threads[1]}
          theta={angle}
          fine={fine}
        />
      ) : null}

      {SHOW_GEOMETRY_GUIDES ? (
        <G opacity={0.7}>
          <Path d={`M ${cx} 0 L ${cx} ${CANVAS.height}`} stroke="#09F" strokeWidth={0.8} />
          <Path d={`M 0 ${frame.shoulder.y} L ${CANVAS.width} ${frame.shoulder.y}`} stroke="#09F" strokeWidth={0.8} />
          <Path d={`M 0 ${frame.hemY} L ${CANVAS.width} ${frame.hemY}`} stroke="#09F" strokeWidth={0.8} />
        </G>
      ) : null}
    </Svg>
  );
};
