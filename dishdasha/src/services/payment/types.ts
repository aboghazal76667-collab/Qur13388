import type { Payment, PaymentStatus } from '@dd/domain/types';

/**
 * PAYMENT ABSTRACTION.
 *
 * Hard rules encoded by this interface:
 *  1. The client never holds a merchant secret. `createSession` is expected to
 *     be fulfilled by our server in production.
 *  2. The client's word is not proof of payment. `confirm` reflects what the
 *     provider (via webhook) told the server — an order is marked paid by the
 *     backend, never by a success screen.
 */
export type PaymentSession = {
  id: string;
  provider: string;
  /** Hosted checkout URL in production; absent for the simulated provider. */
  redirectUrl: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  isSimulated: boolean;
};

export type CreateSessionInput = {
  orderDraftId: string;
  amount: number;
  currency: string;
  customerRef: string;
  /** Line labels only — no measurement or personal data goes to the PSP. */
  description: string;
};

export type PaymentOutcome = {
  status: PaymentStatus;
  providerRef: string | null;
  message?: string;
};

export interface PaymentProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  /** Provider capabilities, used to decide which buttons to show. */
  readonly supports: {
    card: boolean;
    applePay: boolean;
    googlePay: boolean;
  };
  createSession(input: CreateSessionInput): Promise<PaymentSession>;
  /**
   * Confirms a session. In production this asks OUR server, which only
   * answers "paid" once the provider's webhook has been verified.
   */
  confirm(sessionId: string, simulate?: 'success' | 'failure'): Promise<PaymentOutcome>;
}

export const paymentFromOutcome = (
  orderId: string,
  session: PaymentSession,
  outcome: PaymentOutcome,
  createdAt: string,
): Payment => ({
  id: session.id,
  orderId,
  provider: session.provider,
  providerRef: outcome.providerRef,
  amount: session.amount,
  currency: session.currency,
  status: outcome.status,
  isSimulated: session.isSimulated,
  createdAt,
  updatedAt: new Date().toISOString(),
});
