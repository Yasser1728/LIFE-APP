import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const PI_BASE_URL = 'https://api.minepi.com/v2';

/** In-memory store — resets on cold start. Best-effort guard within a
 *  single function instance; the Pi Network API enforces payment state
 *  machine on its side (approved → completed). */
const paymentStore = new Map<string, { status: string; network: string; txid?: string }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId, txid, network = 'pi_testnet' } = req.body ?? {};

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid paymentId' });
    }

    if (!txid || typeof txid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid txid' });
    }

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
      console.error(`[complete-payment] Missing API key for ${network}`);
      return res.status(500).json({ error: `API key not configured for ${network}` });
    }

    // Double-spend guard: block if already completed within this instance.
    // Note: the Pi Network API also enforces the approved→completed state
    // transition server-side and will reject invalid attempts.
    const existing = paymentStore.get(paymentId);
    if (existing?.status === 'completed') {
      return res
        .status(409)
        .json({ error: 'Payment already completed (double-spend prevention)' });
    }

    // Send completion request to Pi Network using the txid
    await axios.post(
      `${PI_BASE_URL}/payments/${paymentId}/complete`,
      { txid },
      { headers: { Authorization: `Key ${apiKey}` } }
    );

    paymentStore.set(paymentId, { status: 'completed', network, txid });
    console.log(`[complete-payment] Payment ${paymentId} completed. txid=${txid}`);

    return res.status(200).json({ message: 'Payment completed successfully' });
  } catch (error: any) {
    console.error('Complete Error:', error.response?.data || error.message);
    const status = error.response?.status ?? 500;
    return res.status(status).json({ error: 'Failed to complete payment' });
  }
}
