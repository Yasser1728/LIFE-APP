import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// ============================================================
// CONFIG
// ============================================================
const PI_BASE_URL = 'https://api.minepi.com/v2';
const IS_MAINNET = process.env.PI_NETWORK === 'mainnet';
const NETWORK = IS_MAINNET ? 'pi_mainnet' : 'pi_testnet';

// ============================================================
// KNOWN PI ERROR MESSAGES
// ============================================================
const PI_ERROR_MESSAGES: Record<string, string> = {
  payment_not_found: 'Payment not found on the Pi Network.',
  payment_already_completed: 'This payment has already been completed.',
  invalid_txid: 'The provided transaction ID is invalid.',
  unauthorized: 'API key is invalid or unauthorized.',
  network_error: 'Network error, please try again.',
};

// ============================================================
// RATE LIMITER - In-memory (replace with Upstash in Production)
// ============================================================
const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;       // 5 requests per paymentId

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, startTime: now });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) return true;

  record.count += 1;
  return false;
}

// ============================================================
// IN-MEMORY DOUBLE-SPEND GUARD
// Note: resets on cold start. Pi Network API also enforces
// the approved → completed state machine on its side.
// Replace with a DB check in Production for full protection.
// ============================================================
const paymentStore = new Map<string, { status: string; txid: string }>();

// ============================================================
// HELPER - Resolve a friendly error message
// ============================================================
function resolveErrorMessage(error: any): string {
  const piError = error.response?.data?.error_code || error.response?.data?.message || '';
  const errorKey = Object.keys(PI_ERROR_MESSAGES).find(
    (key) =>
      piError?.toLowerCase().includes(key.toLowerCase()) ||
      error?.message?.toLowerCase().includes(key.toLowerCase())
  );
  return errorKey
    ? PI_ERROR_MESSAGES[errorKey]
    : error.response?.data?.message || error.message || 'An unexpected error occurred.';
}

// ============================================================
// HELPER - Log transaction (replace with DB call in Production)
// ============================================================
function logTransaction(data: {
  paymentId: string;
  txid: string;
  status: string;
  error?: string;
}): void {
  // Example: await db.transactions.upsert({ paymentId: data.paymentId, ...data });
  console.log('[Transaction Log]', {
    ...data,
    network: NETWORK,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// VALIDATE API KEY ON STARTUP
// ============================================================
const API_KEY = IS_MAINNET ? process.env.PI_API_KEY_MAINNET : process.env.PI_API_KEY_TESTNET;

if (!API_KEY) {
  console.error(
    `[complete-payment] Missing ${IS_MAINNET ? 'PI_API_KEY_MAINNET' : 'PI_API_KEY_TESTNET'} in .env`
  );
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. API key guard
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured for this network.' });
  }

  // 3. Parse & validate body
  const { paymentId, txid } = req.body ?? {};

  if (!paymentId || typeof paymentId !== 'string' || paymentId.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid paymentId.' });
  }

  if (!txid || typeof txid !== 'string' || txid.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid txid.' });
  }

  const sanitizedPaymentId = paymentId.trim();
  const sanitizedTxid = txid.trim();

  // 4. Rate limiting
  if (isRateLimited(sanitizedPaymentId)) {
    console.warn(`[complete-payment] Rate limit exceeded for paymentId: ${sanitizedPaymentId}`);
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute and try again.',
    });
  }

  // 5. Double-spend guard (in-memory)
  const existing = paymentStore.get(sanitizedPaymentId);
  if (existing?.status === 'completed') {
    console.warn(`[complete-payment] Double-spend attempt for paymentId: ${sanitizedPaymentId}`);
    return res.status(409).json({
      error: 'Payment already completed (double-spend prevention).',
      txid: existing.txid,
    });
  }

  try {
    console.log(`[complete-payment] Completing paymentId: ${sanitizedPaymentId} | txid: ${sanitizedTxid}`);

    // 6. Send completion request to Pi Network
    await axios.post(
      `${PI_BASE_URL}/payments/${sanitizedPaymentId}/complete`,
      { txid: sanitizedTxid },
      { headers: { Authorization: `Key ${API_KEY}` } }
    );

    // 7. Update store & log
    paymentStore.set(sanitizedPaymentId, { status: 'completed', txid: sanitizedTxid });
    logTransaction({ paymentId: sanitizedPaymentId, txid: sanitizedTxid, status: 'completed' });

    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully.',
      txid: sanitizedTxid,
    });

  } catch (error: any) {
    const statusCode = error.response?.status ?? 500;
    const friendlyMessage = resolveErrorMessage(error);

    console.error('[complete-payment] Error:', error.response?.data || error.message);
    logTransaction({
      paymentId: sanitizedPaymentId,
      txid: sanitizedTxid,
      status: 'failed',
      error: error.message,
    });

    return res.status(statusCode).json({
      error: 'Failed to complete payment.',
      message: friendlyMessage,
      ...(process.env.NODE_ENV === 'development' && { debug: error.response?.data || error.message }),
    });
  }
}
