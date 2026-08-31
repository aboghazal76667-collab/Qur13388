import type {
  CreateSessionInput,
  PaymentOutcome,
  PaymentProvider,
  PaymentSession,
} from './types';

/**
 * THAWANI ADAPTER — production shape, NOT yet connected.
 *
 * Thawani is the common Omani gateway. Two rules this adapter exists to
 * enforce:
 *
 *  1. The secret key never reaches this file. Session creation goes to our own
 *     server (`/payments/thawani/session`), which holds the key and calls
 *     Thawani. Putting `THAWANI_SECRET_KEY` in an EXPO_PUBLIC_ variable would
 *     ship it inside the app bundle — never do that.
 *  2. Payment status is decided by the webhook our server receives from
 *     Thawani. `confirm` only reads back what the server already verified, so
 *     a tampered client cannot mark an order paid.
 *
 * Apple Pay / Google Pay availability depends on the merchant account and the
 * gateway's hosted checkout; `supports` is reported by the server per merchant.
 */
export class ThawaniPaymentProvider implements PaymentProvider {
  readonly name = 'thawani';
  readonly isSimulated = false;
  readonly supports = { card: true, applePay: true, googlePay: true };

  constructor(private readonly apiBaseUrl: string) {}

  async createSession(input: CreateSessionInput): Promise<PaymentSession> {
    const response = await fetch(`${this.apiBaseUrl}/payments/thawani/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`payment session failed (${response.status})`);
    const data = (await response.json()) as {
      sessionId: string;
      redirectUrl: string;
    };
    return {
      id: data.sessionId,
      provider: this.name,
      redirectUrl: data.redirectUrl,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      isSimulated: false,
    };
  }

  async confirm(sessionId: string): Promise<PaymentOutcome> {
    const response = await fetch(
      `${this.apiBaseUrl}/payments/thawani/status?session=${encodeURIComponent(sessionId)}`,
    );
    if (!response.ok) throw new Error(`payment status failed (${response.status})`);
    const data = (await response.json()) as {
      status: PaymentOutcome['status'];
      providerRef: string | null;
    };
    return { status: data.status, providerRef: data.providerRef };
  }
}
