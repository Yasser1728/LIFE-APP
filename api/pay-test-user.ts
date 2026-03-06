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
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const PI_BASE_URL = 'https://api.minepi.com/v2';

/** Milliseconds to wait between blockchain confirmation poll attempts. */
const POLL_INTERVAL_MS = 3_000;
/** Maximum number of poll attempts before returning a 202 Accepted. */
const MAX_POLL_ATTEMPTS = 10;

/** In-memory store — resets on cold start. Best-effort guard within a
 *  single function instance; the Pi Network API enforces payment state
 *  machine on its side. */
const paymentStore = new Map<string, { status: string; network: string; uid?: string; txid?: string }>();

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

  // Validate network
  if (network !== 'pi_testnet' && network !== 'pi_mainnet') {
    return res
      .status(400)
      .json({ error: `Invalid network "${network}". Must be "pi_testnet" or "pi_mainnet".` });
  }

  const apiKey =
    network === 'pi_mainnet'
      ? process.env.PI_API_KEY_MAINNET
      : process.env.PI_API_KEY_TESTNET;

  if (!apiKey) {
    console.error(`[pay-test-user] Missing API key for ${network}`);
    return res.status(500).json({ error: `API key not configured for ${network}` });
  }

  const headers = { Authorization: `Key ${apiKey}` };

  try {
    // ── Step 1: Create the App-to-User payment ────────────────────────────
    const createRes = await axios.post(
      `${PI_BASE_URL}/payments`,
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
    if (paymentStore.has(paymentId)) {
      return res.status(409).json({
        error: 'Payment already processed (double-spend prevention)',
        paymentId,
      });
    }
    paymentStore.set(paymentId, { status: 'pending', network, uid });

    // ── Step 2: Approve the payment ───────────────────────────────────────
    await axios.post(
      `${PI_BASE_URL}/payments/${paymentId}/approve`,
      {},
      { headers }
    );
    paymentStore.set(paymentId, { status: 'approved', network, uid });

    // ── Step 3: Poll for blockchain confirmation (txid) ───────────────────
    // Pi Network submits the transaction to the blockchain asynchronously.
    // We poll the payment status until a txid appears.
    let txid: string | null = null;
    for (let _attempt = 0; _attempt < MAX_POLL_ATTEMPTS; _attempt++) {
      const statusRes = await axios.get(
        `${PI_BASE_URL}/payments/${paymentId}`,
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
      `${PI_BASE_URL}/payments/${paymentId}/complete`,
      { txid },
      { headers }
    );
    paymentStore.set(paymentId, { status: 'completed', network, uid, txid });

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
