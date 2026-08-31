import type {
  MeasurementEstimate,
  MeasurementEstimationService,
  ProviderInfo,
} from '@dd/services/ai/types';

/**
 * MeasurementProvider — the seam for future camera-based body measurement.
 *
 * It is deliberately reported as UNAVAILABLE. Presenting an AI body
 * measurement as production-ready would put a customer in a badly fitting
 * garment he paid for, so today the platform uses manual entry and
 * tailor-verified profiles only. The interface exists so a validated provider
 * can be dropped in without reworking the measurement screens.
 */
export class UnavailableMeasurementEstimation implements MeasurementEstimationService {
  readonly info: ProviderInfo = {
    name: 'none',
    model: 'not-implemented',
    isLive: false,
  };

  readonly available = false;

  async estimate(): Promise<MeasurementEstimate> {
    throw new Error(
      'Camera body measurement is not available. Use manual entry or a tailor-verified profile.',
    );
  }
}

export const measurementEstimationService: MeasurementEstimationService =
  new UnavailableMeasurementEstimation();
