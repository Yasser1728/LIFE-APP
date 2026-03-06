import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { getPiConfig, getAuthHeaders } from './utils/pi-config';
import { savePayment, updatePaymentStatus, hasPayment } from './utils/payment-db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId, network = 'pi_testnet' } = req.body ?? {};

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid paymentId' });
    }

    // Resolve API key based on the requested network
    let config;
    try {
      config = getPiConfig(network);
    } catch (err: any) {
      console.error('Pi config error:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const { apiKey, baseUrl } = config;

    // Guard against double-approving the same payment
    if (hasPayment(paymentId)) {
      return res
        .status(409)
        .json({ error: 'Payment already tracked (double-spend prevention)' });
    }
    savePayment(paymentId, network);

    // 1. Send approval request to Pi Network
    await axios.post(
      `${baseUrl}/payments/${paymentId}/approve`,
      {},
      { headers: getAuthHeaders(apiKey) }
    );

    // 2. Mark payment as approved in the database
    updatePaymentStatus(paymentId, 'approved');

    return res.status(200).json({ message: 'Payment approved successfully' });
  } catch (error: any) {
    console.error('Approve Error:', error.response?.data || error.message);
    const status = error.response?.status ?? 500;
    return res.status(status).json({ error: 'Failed to approve payment' });
  }
}
