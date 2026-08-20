/**
 * The 3D provider contract.
 *
 * Re-exported from the app source rather than copied, deliberately: the phone
 * and the server must agree on the shape of a job, a result and a cost, and a
 * duplicated interface is one that drifts. Only the server ever *implements*
 * this — the app only ever uses the types.
 */
export * from '../../../src/services/threeD/provider';
