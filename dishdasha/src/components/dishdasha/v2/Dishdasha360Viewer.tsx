import React from 'react';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import type { RenderQuality } from '@dd/visual/quality';
import { GarmentViewer } from '@dd/components/dishdasha/GarmentViewer';

/**
 * Dishdasha360Viewer.
 *
 * V3 turns this into a thin alias over GarmentViewer, which owns renderer
 * selection. Every existing caller — the studio stage, the review step,
 * compare — keeps working unchanged and now routes through the adapter, so
 * registering a professional GLB switches them all at once.
 *
 * Today the adapter selects the V2 vector engine, because no professional
 * asset is registered. Rotation is therefore still parametric 2.5D, not a
 * real mesh. See docs/REAL_3D_RENDERER_DECISION.md.
 */
export const Dishdasha360Viewer: React.FC<{
  config: DesignConfig;
  width: number;
  height: number;
  measurement?: MeasurementProfile | null;
  quality?: RenderQuality;
  initialAngle?: number;
  onAngleChange?: (angle: number) => void;
  showSnapControls?: boolean;
  background?: string | null;
}> = ({
  config,
  width,
  height,
  measurement = null,
  initialAngle = 0,
  onAngleChange,
  showSnapControls = true,
}) => (
  <GarmentViewer
    config={config}
    measurement={measurement}
    width={width}
    height={height}
    angle={initialAngle}
    interactive
    showViewControls={showSnapControls}
    onAngleChange={onAngleChange}
  />
);
