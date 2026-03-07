import type { VercelRequest, VercelResponse } from '@vercel/node';
const PiNetwork = require('@pinetwork-js/api-backend');

// ============================================================
// CONFIG
// ============================================================
const IS_MAINNET = process.env.PI_NETWORK === 'mainnet';

const PAYMENT_CONFIG = {
  amount: 0.1,
  memo: IS_MAINNET ? 'A2U Mainnet Reward' : 'A2U Testnet Completion',
  metadata: { type: 'checklist_10_10' },
  network: IS_MAINNET ? 'mainnet' : 'pi_testnet',
};

// ============================================================
// KNOWN PI ERROR MESSAGES
// ============================================================
const PI_ERROR_MESSAGES: Record<string, string> = {
  user_not_found: 'User not found on the Pi Network.',
  insufficient_funds: 'Wallet has insufficient funds.',
  payment_already_exists: 'This payment has already been processed.',
  invalid_uid: 'Invalid user identifier.',
  network_error: 'Network error, please try again.',
};

// ============================================================
// RATE LIMITER - In-memory (replace with Upstash in Production)
// ============================================================
const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 3;       // 3 requests per UID

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(uid);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, startTime: now });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) return true;

  record.count += 1;
  return false;
}

// ============================================================
// INIT PI SDK - Once on module load
// ============================================================
let pi: any;
try {
  // Select correct API key
  const apiKey = IS_MAINNET
    ? process.env.PI_API_KEY_MAINNET
    : process.env.PI_API_KEY_TESTNET;

  // Select correct wallet seed
  const walletSeed = IS_MAINNET
    ? process.env.PI_APP_WALLET_SEED_MAINNET
    : process.env.PI_APP_WALLET_SEED_TESTNET;

  if (!apiKey) {
    throw new Error(
      IS_MAINNET
        ? 'PI_API_KEY_MAINNET is missing from .env'
        : 'PI_API_KEY_TESTNET is missing from .env'
    );
  }

  if (!walletSeed) {
    throw new Error(
      IS_MAINNET
        ? 'PI_APP_WALLET_SEED_MAINNET is missing from .env'
        : 'PI_APP_WALLET_SEED_TESTNET is missing from .env'
    );
  }

  pi = new PiNetwork(
    apiKey,
    walletSeed,
    IS_MAINNET ? 'mainnet' : 'pi_testnet'
  );

  console.log(`[Pi SDK] Initialized on ${PAYMENT_CONFIG.network}`);
} catch (initError: any) {
  console.error('[Pi SDK] Initialization failed:', initError.message);
}

// ============================================================
// HELPER - Resolve a friendly error message
// ============================================================
function resolveErrorMessage(error: any): string {
  const errorKey = Object.keys(PI_ERROR_MESSAGES).find(
    (key) =>
      error?.code === key ||
      error?.message?.toLowerCase().includes(key.toLowerCase())
  );
  return errorKey
    ? PI_ERROR_MESSAGES[errorKey]
    : error?.message || 'An unexpected error occurred.';
}

// ============================================================
// HELPER - Log transaction (replace with DB call in Production)
// ============================================================
async function logTransaction(data: {
  uid: string;
  paymentId: string | null;
  txid: string | null;
  status: string;
  error?: string;
}): Promise<void> {
  // Example: await db.transactions.create({ ...data, createdAt: new Date() });
  console.log('[Transaction Log]', {
    ...data,
    network: PAYMENT_CONFIG.network,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. SDK guard
  if (!pi) {
    return res.status(500).json({ error: 'Pi SDK is not initialized.' });
  }

  // 3. Validate UID
  const { uid } = req.body ?? {};

  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    console.error('[Backend] Error: UID is missing or invalid.');
    return res.status(400).json({ error: 'invalid_uid', message: 'User UID is required.' });
  }

  const sanitizedUid = uid.trim();

  // 4. Rate limiting
  if (isRateLimited(sanitizedUid)) {
    console.warn(`[Backend] Rate limit exceeded for UID: ${sanitizedUid}`);
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  let paymentId: string | null = null;

  try {
    console.log(`[Backend] Initiating A2U payment for UID: ${sanitizedUid} on ${PAYMENT_CONFIG.network}`);

    // 5. Create the payment
    paymentId = await pi.createPayment({
      amount: PAYMENT_CONFIG.amount,
      memo: PAYMENT_CONFIG.memo,
      metadata: PAYMENT_CONFIG.metadata,
      uid: sanitizedUid,
    });

    if (!paymentId) throw new Error('Payment creation failed. No paymentId received.');
    console.log(`[Backend] Payment created. PaymentID: ${paymentId}`);

    // 6. Submit to blockchain
    const txid: string = await pi.submitPayment(paymentId);
    if (!txid) throw new Error('Payment submission failed. No TXID received.');
    console.log(`[Backend] Payment submitted to blockchain. TXID: ${txid}`);

    // 7. Complete payment on Pi servers
    await pi.completePayment(paymentId, txid);
    console.log(`[Backend] Payment completed successfully. TXID: ${txid}`);

    // 8. Log successful transaction
    await logTransaction({ uid: sanitizedUid, paymentId, txid, status: 'completed' });

    return res.status(200).json({
      success: true,
      txid,
      paymentId,
      message: 'Payment completed successfully.',
    });

  } catch (error: any) {
    console.error(`[Backend] Error for UID ${sanitizedUid}:`, error.message);

    await logTransaction({
      uid: sanitizedUid,
      paymentId,
      txid: null,
      status: 'failed',
      error: error.message,
    });

    return res.status(500).json({
      error: 'payment_failed',
      message: resolveErrorMessage(error),
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
}
