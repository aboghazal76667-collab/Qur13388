import { uuid } from '@dd/utils/id';
import type {
  CreateSessionInput,
  PaymentOutcome,
  PaymentProvider,
  PaymentSession,
} from './types';

/**
 * MOCK PAYMENT PROVIDER — the default while MOCK_PAYMENT_MODE is on.
 *
 * No money moves. Both outcomes are reachable on purpose so the failure path
 * (retry, order not created, nothing charged) is demonstrable, not theoretical.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly isSimulated = true;
  readonly supports = { card: true, applePay: false, googlePay: false };

  private sessions = new Map<string, PaymentSession>();

  async createSession(input: CreateSessionInput): Promise<PaymentSession> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const session: PaymentSession = {
      id: `mock_${uuid()}`,
      provider: this.name,
      redirectUrl: null,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      isSimulated: true,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async confirm(
    sessionId: string,
    simulate: 'success' | 'failure' = 'success',
  ): Promise<PaymentOutcome> {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { status: 'failed', providerRef: null, message: 'session not found' };
    }
    if (simulate === 'failure') {
      session.status = 'failed';
      return {
        status: 'failed',
        providerRef: null,
        message: 'Simulated decline — nothing was charged.',
      };
    }
    session.status = 'paid';
    return { status: 'paid', providerRef: `sim_${sessionId.slice(-8)}` };
  }
}
