import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { getPiConfig, getAuthHeaders } from './utils/pi-config';
import { getPayment, updatePaymentStatus } from './utils/payment-db';

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

    // Resolve API key based on the requested network
    let config;
    try {
      config = getPiConfig(network);
    } catch (err: any) {
      console.error('Pi config error:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const { apiKey, baseUrl } = config;

    // Verify the payment was previously approved (exists in the DB)
    const record = getPayment(paymentId);
    if (!record) {
      return res
        .status(404)
        .json({ error: 'Payment not found — approve it first' });
    }
    if (record.status === 'completed') {
      return res
        .status(409)
        .json({ error: 'Payment already completed (double-spend prevention)' });
    }
    if (record.status !== 'approved') {
      return res
        .status(409)
        .json({ error: 'Payment must be approved before it can be completed' });
    }

    // 1. Send completion request to Pi Network using the txid
    await axios.post(
      `${baseUrl}/payments/${paymentId}/complete`,
      { txid },
      { headers: getAuthHeaders(apiKey) }
    );

    // 2. Mark payment as completed in the database and deliver product/service
    updatePaymentStatus(paymentId, 'completed', txid);
    console.log(`Payment ${paymentId} completed. Deliver product here!`);

    return res.status(200).json({ message: 'Payment completed successfully' });
  } catch (error: any) {
    console.error('Complete Error:', error.response?.data || error.message);
    const status = error.response?.status ?? 500;
    return res.status(status).json({ error: 'Failed to complete payment' });
  }
}
