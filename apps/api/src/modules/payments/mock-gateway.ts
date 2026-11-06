/**
 * Mock Payment Gateway — durable per key, survives process restart because
 * results are persisted in-DB (in a real system). For tests we use in-memory
 * store but the interface matches a durable backing.
 */

export type GatewayResult = 'SUCCESS' | 'DECLINE' | 'TIMEOUT';

export interface GatewayResponse {
  result: GatewayResult;
  transactionId: string | null;
}

// Simulated outcomes can be programmed for tests via MOCK_PAYMENT_OUTCOME env var
function getOutcome(): GatewayResult {
  const env = process.env.MOCK_PAYMENT_OUTCOME;
  if (env === 'DECLINE') return 'DECLINE';
  if (env === 'TIMEOUT') return 'TIMEOUT';
  return 'SUCCESS';
}

// In-memory durable store (per process; replace with DB table for multi-instance)
const durableResults = new Map<string, GatewayResponse>();

export async function chargeOnce(idempotencyKey: string, _amount: bigint): Promise<GatewayResponse> {
  const cached = durableResults.get(idempotencyKey);
  if (cached) return cached; // idempotent re-delivery

  const outcome = getOutcome();
  if (outcome === 'TIMEOUT') {
    // Do NOT store — caller must treat as unresolved
    throw new Error('GATEWAY_TIMEOUT');
  }

  const response: GatewayResponse = {
    result: outcome,
    transactionId: outcome === 'SUCCESS' ? `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : null,
  };
  durableResults.set(idempotencyKey, response);
  return response;
}

export async function lookupResult(idempotencyKey: string): Promise<GatewayResponse | null> {
  return durableResults.get(idempotencyKey) ?? null;
}

/** Only for tests — clear the durable store */
export function __clearForTests(): void {
  durableResults.clear();
}
