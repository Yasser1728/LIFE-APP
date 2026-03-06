import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const PI_BASE_URL = 'https://api.minepi.com/v2';

/** In-memory store — resets on cold start. Best-effort guard within a
 *  single function instance; the Pi Network API enforces payment state
 *  machine on its side (approved → completed). */
const paymentStore = new Map<string, { status: string; network: string }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId, network = 'pi_testnet' } = req.body ?? {};

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid paymentId' });
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
      console.error(`[approve-payment] Missing API key for ${network}`);
      return res.status(500).json({ error: `API key not configured for ${network}` });
    }

    // Guard against double-approving the same payment
    if (paymentStore.has(paymentId)) {
      return res
        .status(409)
        .json({ error: 'Payment already tracked (double-spend prevention)' });
    }

    paymentStore.set(paymentId, { status: 'pending', network });

    // Send approval request to Pi Network
    await axios.post(
      `${PI_BASE_URL}/payments/${paymentId}/approve`,
      {},
      { headers: { Authorization: `Key ${apiKey}` } }
    );

    paymentStore.set(paymentId, { status: 'approved', network });

    return res.status(200).json({ message: 'Payment approved successfully' });
  } catch (error: any) {
    console.error('Approve Error:', error.response?.data || error.message);
    const status = error.response?.status ?? 500;
    return res.status(status).json({ error: 'Failed to approve payment' });
  }
}
