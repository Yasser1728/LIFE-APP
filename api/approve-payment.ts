import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId } = req.body;
    const PI_API_KEY = process.env.PI_API_KEY;

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid paymentId' });
    }

    if (!PI_API_KEY) {
      console.error('PI_API_KEY environment variable is not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 1. Send approval request to Pi Network
    await axios.post(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {},
      {
        headers: { Authorization: `Key ${PI_API_KEY}` }
      }
    );

    // NOTE: Save payment state to your database here

    return res.status(200).json({ message: 'Payment approved successfully' });
  } catch (error: any) {
    console.error('Approve Error:', error.response?.data || error.message);
    const status = error.response?.status ?? 500;
    return res.status(status).json({ error: 'Failed to approve payment' });
  }
}
