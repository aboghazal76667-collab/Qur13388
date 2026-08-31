import { ENV } from '@dd/config/env';
import { MockPaymentProvider } from './mock';
import { ThawaniPaymentProvider } from './thawani';
import type { PaymentProvider } from './types';

/** Single place a payment provider is chosen. */
export const paymentProvider: PaymentProvider =
  ENV.MOCK_PAYMENT_MODE || !ENV.API_BASE_URL
    ? new MockPaymentProvider()
    : new ThawaniPaymentProvider(ENV.API_BASE_URL);

export * from './types';
