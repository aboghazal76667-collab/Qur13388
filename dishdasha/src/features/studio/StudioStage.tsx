import React from 'react';
import { View } from 'react-native';

import type { DesignConfig, MeasurementProfile } from '@dd/domain/types';
import { Dishdasha360Viewer } from '@dd/components/dishdasha/v2/Dishdasha360Viewer';
import { DishdashaVisualEngineV2 } from '@dd/components/dishdasha/v2/DishdashaVisualEngineV2';
import { GarmentDetailViewer, type DetailTarget } from '@dd/components/dishdasha/v2/GarmentDetailViewer';
import { theme } from '@dd/theme/tokens';

/**
 * THE STAGE — the garment, and nothing else.
 *
 * One decision at a time: the stage follows the step the customer is on. On a
 * thread-colour step it zooms to the shaq, on furakha to the tassel, on review
 * it hands over the full rotatable garment. The customer never hunts for the
 * thing they are changing.
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
        width={Math.min(width, height * 0.72)}
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
      <DishdashaVisualEngineV2
        config={config}
        measurement={measurement}
        width={height * 0.66}
        height={height}
      />
    )}
  </View>
);
