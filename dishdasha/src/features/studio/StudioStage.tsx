import React from 'react';
import { View } from 'react-native';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { GarmentViewer } from '@dd/components/dishdasha/GarmentViewer';
import { Dishdasha360Viewer } from '@dd/components/dishdasha/v2/Dishdasha360Viewer';
import { GarmentDetailViewer, type DetailTarget } from '@dd/components/dishdasha/v2/GarmentDetailViewer';
import { theme } from '@dd/theme/tokens';

/**
 * THE STAGE — the garment, and nothing else.
 *
 * One decision at a time: the stage follows the step the customer is on. On a
 * thread-colour step it zooms to the shaq, on furakha to the tassel, on review
 * it hands over the full rotatable garment. The customer never hunts for the
 * thing they are changing.
 *
 * 'full' and 'rotate' both go through GarmentViewer, so the renderer adapter —
 * not this component — decides whether a real mesh or the vector engine draws
 * the garment. 'detail' stays on the V2 engine deliberately: it is a
 * millimetre-accurate crop of the vector garment, and the current prototype
 * asset has no separated zones for it to crop to.
 */
export type StageMode =
  | { kind: 'full' }
  | { kind: 'rotate' }
  | { kind: 'detail'; target: DetailTarget };

export const StudioStage: React.FC<{
  config: DesignConfig;
  measurement: MeasurementProfile | null;
  mode: StageMode;
  width: number;
  height: number;
}> = ({ config, measurement, mode, width, height }) => (
  <View
    style={{
      height,
      backgroundColor: theme.color.bgSunken,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {mode.kind === 'rotate' ? (
      <Dishdasha360Viewer
        config={config}
        measurement={measurement}
        width={width}
        height={height - 34}
      />
    ) : mode.kind === 'detail' ? (
      <GarmentDetailViewer
        config={config}
        measurement={measurement}
        width={Math.min(width - 32, height - 46)}
        height={height - 46}
        target={mode.target}
      />
    ) : (
      /* Full stage width: the 3D renderer frames on height, and GarmentViewer
         already narrows the width itself before handing it to the V2 engine.
         No view-control row here — the customer is deciding a fabric or a
         colour on this step, and 'rotate' is the step that owns the view
         buttons. The garment still turns to the drag. */
      <GarmentViewer
        config={config}
        measurement={measurement}
        width={width}
        height={height}
        showViewControls={false}
      />
    )}
  </View>
);
