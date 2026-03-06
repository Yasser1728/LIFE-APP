/**
 * POST /api/pay-test-user
 *
 * App-to-User payment endpoint.
 * Sends 0.1 Test-Pi (or Mainnet Pi) from the app wallet to a specific user.
 * This endpoint fulfils the "10 unique wallet transactions" requirement on
 * the Pi Testnet by initiating, approving, and completing a server-side
 * payment to a given Pi user UID.
 *
 * Request body:
 *   {
 *     uid     : string  — Pi user UID to receive the payment
 *     network : string  — 'pi_testnet' (default) | 'pi_mainnet'
 *   }
 *
 * Security: all sensitive keys are read from environment variables only.
 * The app wallet seed phrase is read from PI_APP_WALLET_SEED and is never
 * exposed in API responses.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { getPiConfig, getAuthHeaders } from './utils/pi-config';
import {
  hasPayment,
  savePayment,
  updatePaymentStatus,
} from './utils/payment-db';

/** Milliseconds to wait between blockchain confirmation poll attempts. */
const POLL_INTERVAL_MS = 3_000;
/** Maximum number of poll attempts before returning a 202 Accepted. */
const MAX_POLL_ATTEMPTS = 10;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { uid, network = 'pi_testnet' } = req.body ?? {};

  // Validate uid
  if (!uid || typeof uid !== 'string') {
    return res
      .status(400)
      .json({ error: 'Missing or invalid uid (Pi user identifier)' });
  }

  // Resolve network config — returns 500 if the env var is missing
  let config;
  try {
    config = getPiConfig(network);
  } catch (err: any) {
    console.error('Pi config error:', err.message);
    return res.status(500).json({ error: err.message });
  }

  const { apiKey, baseUrl } = config;
  const headers = getAuthHeaders(apiKey);

  try {
    // ── Step 1: Create the App-to-User payment ────────────────────────────
    const createRes = await axios.post(
      `${baseUrl}/payments`,
      {
        amount: 0.1,
        memo: 'LIFE-APP reward payment',
        metadata: { source: 'pay-test-user', purpose: '10-wallet-goal' },
        uid,
      },
      { headers }
    );

    const paymentId: string = createRes.data?.identifier;
    if (!paymentId) {
      throw new Error('Pi API did not return a paymentId');
    }

    // ── Double-spend guard ────────────────────────────────────────────────
    if (hasPayment(paymentId)) {
      return res.status(409).json({
        error: 'Payment already processed (double-spend prevention)',
        paymentId,
      });
    }
    savePayment(paymentId, network, uid);

    // ── Step 2: Approve the payment ───────────────────────────────────────
    await axios.post(
      `${baseUrl}/payments/${paymentId}/approve`,
      {},
      { headers }
    );
    updatePaymentStatus(paymentId, 'approved');

    // ── Step 3: Poll for blockchain confirmation (txid) ───────────────────
    // Pi Network submits the transaction to the blockchain asynchronously.
    // We poll the payment status until a txid appears.
    let txid: string | null = null;
    for (let _attempt = 0; _attempt < MAX_POLL_ATTEMPTS; _attempt++) {
      const statusRes = await axios.get(
        `${baseUrl}/payments/${paymentId}`,
        { headers }
      );
      if (statusRes.data?.transaction?.txid) {
        txid = statusRes.data.transaction.txid as string;
        break;
      }
      // Wait before the next poll (skip delay after the last attempt)
      if (_attempt < MAX_POLL_ATTEMPTS - 1) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS)
        );
      }
    }

    // If the transaction hasn't landed yet, respond with 202 Accepted.
    // The frontend (or a webhook) can call /api/complete-payment later.
    if (!txid) {
      return res.status(202).json({
        message:
          'Payment approved and submitted. Awaiting blockchain confirmation.',
        paymentId,
      });
    }

    // ── Step 4: Complete the payment ──────────────────────────────────────
    await axios.post(
      `${baseUrl}/payments/${paymentId}/complete`,
      { txid },
      { headers }
    );
    updatePaymentStatus(paymentId, 'completed', txid);

    console.log(
      `[pay-test-user] Payment ${paymentId} completed. txid=${txid}`
    );

    return res.status(200).json({
      message: 'App-to-User payment completed successfully',
      paymentId,
      txid,
    });
  } catch (error: any) {
    const piError = error.response?.data;
    const httpStatus = error.response?.status ?? 500;

    console.error(
      '[pay-test-user] Error:',
      piError ?? error.message
    );

    // Surface Pi API error codes (e.g. 401 Unauthorized, 400 Bad Request)
    // without leaking sensitive server-side details.
    return res.status(httpStatus).json({
      error: 'Payment failed',
      detail:
        piError?.error_message ??
        piError?.message ??
        error.message,
    });
  }
}
