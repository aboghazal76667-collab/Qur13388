import React from 'react';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { DishdashaVisualEngineV2 } from './v2/DishdashaVisualEngineV2';
import { regionFor, type DetailTarget } from './v2/GarmentDetailViewer';
import type { ZoomTarget } from './geometry';

/**
 * V1 COMPATIBILITY ADAPTER.
 *
 * Every screen already asks for a garment through this component, so pointing
 * it at DishdashaVisualEngineV2 upgrades the whole app — home, cart, orders,
 * the tailor's ticket, compare — in one place, with no call-site churn and no
 * risk of two different-looking garments coexisting.
 *
 * The V1 prop shape is preserved and mapped onto the new engine. New screens
 * should use the engine (or Dishdasha360Viewer) directly.
 */
const ZOOM_TO_TARGET: Record<Exclude<ZoomTarget, 'full'>, DetailTarget> = {
  neck: 'neckline',
  chest: 'shaq',
  sleeve: 'cuff',
  furakha: 'furakha',
};

export type DishdashaFigureProps = {
  config: DesignConfig;
  width: number;
  height: number;
  zoom?: ZoomTarget;
  /** Maps to the high-quality render plus a ground shadow. */
  realistic?: boolean;
  transparentBackground?: boolean;
  measurement?: MeasurementProfile | null;
  angle?: number;
};

export const DishdashaFigure: React.FC<DishdashaFigureProps> = ({
  config,
  width,
  height,
  zoom = 'full',
  realistic = false,
  transparentBackground = false,
  measurement = null,
  angle = 0,
}) => (
  <DishdashaVisualEngineV2
    config={config}
    width={width}
    height={height}
    angle={angle}
    measurement={measurement}
    region={zoom === 'full' ? null : regionFor(ZOOM_TO_TARGET[zoom], config, measurement)}
    quality={realistic ? 'HIGH' : 'AUTO'}
    showGround={realistic}
    background={transparentBackground ? null : null}
  />
);

/** Compact silhouette for cards, lists and comparison thumbnails. */
export const DishdashaThumb: React.FC<{ config: DesignConfig; size?: number }> = ({
  config,
  size = 96,
}) => <DishdashaFigure config={config} width={size} height={size * 1.15} transparentBackground />;
