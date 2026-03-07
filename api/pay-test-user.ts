import { NextResponse } from 'next/server';
const PiNetwork = require('@pinetwork-js/api-backend');

// ============================================================
// CONFIG - Can be moved to a separate config file
// ============================================================
const IS_MAINNET = process.env.PI_NETWORK === 'mainnet';

const PAYMENT_CONFIG = {
  amount: 0.1,
  memo: "A2U Testnet Completion",
  metadata: { type: "checklist_10_10" },
  network: IS_MAINNET ? 'mainnet' : 'pi_testnet',
};

// Known Pi Network API errors
const PI_ERROR_MESSAGES = {
  user_not_found: 'User not found on the Pi Network.',
  insufficient_funds: 'Wallet has insufficient funds.',
  payment_already_exists: 'This payment has already been processed.',
  invalid_uid: 'Invalid user identifier.',
  network_error: 'Network error, please try again.',
};

// ============================================================
// RATE LIMITER - In-memory (replace with Upstash in Production)
// ============================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 3;       // 3 requests per UID

function isRateLimited(uid) {
  const now = Date.now();
  const record = rateLimitMap.get(uid);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, startTime: now });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  record.count += 1;
  return false;
}

// ============================================================
// INIT PI SDK - Once on module load
// ============================================================
let pi;
try {
  if (!process.env.PI_APP_WALLET_SEED) {
    throw new Error('PI_APP_WALLET_SEED is missing from .env');
  }
  if (IS_MAINNET && !process.env.PI_API_KEY_MAINNET) {
    throw new Error('PI_API_KEY_MAINNET is missing from .env');
  }
  if (!IS_MAINNET && !process.env.PI_API_KEY_TESTNET) {
    throw new Error('PI_API_KEY_TESTNET is missing from .env');
  }

  pi = new PiNetwork(
    IS_MAINNET ? process.env.PI_API_KEY_MAINNET : process.env.PI_API_KEY_TESTNET,
    process.env.PI_APP_WALLET_SEED,
    IS_MAINNET ? 'mainnet' : 'pi_testnet'
  );

  console.log(`[Pi SDK] Initialized on ${PAYMENT_CONFIG.network}`);
} catch (initError) {
  console.error('[Pi SDK] Initialization failed:', initError.message);
}

// ============================================================
// HELPER - Resolve a friendly error message
// ============================================================
function resolveErrorMessage(error) {
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
async function logTransaction({ uid, paymentId, txid, status, error }) {
  // Example: await db.transactions.create({ uid, paymentId, txid, status, error, createdAt: new Date() });
  console.log('[Transaction Log]', {
    uid,
    paymentId: paymentId || null,
    txid: txid || null,
    status,
    error: error || null,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(req) {
  // 1. Check SDK initialization
  if (!pi) {
    return NextResponse.json(
      { error: 'server_error', message: 'Pi SDK is not initialized.' },
      { status: 500 }
    );
  }

  // 2. Parse request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Invalid request. Please send valid JSON.' },
      { status: 400 }
    );
  }

  const { uid } = body;

  // 3. Validate UID
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    console.error('[Backend] Error: UID is missing or invalid.');
    return NextResponse.json(
      { error: 'invalid_uid', message: 'User UID is required.' },
      { status: 400 }
    );
  }

  const sanitizedUid = uid.trim();

  // 4. Rate limiting
  if (isRateLimited(sanitizedUid)) {
    console.warn(`[Backend] Rate limit exceeded for UID: ${sanitizedUid}`);
    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please wait a minute and try again.',
      },
      { status: 429 }
    );
  }

  let paymentId = null;

  try {
    console.log(`[Backend] Initiating A2U payment for UID: ${sanitizedUid}`);

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
    const txid = await pi.submitPayment(paymentId);
    if (!txid) throw new Error('Payment submission failed. No TXID received.');
    console.log(`[Backend] Payment submitted to blockchain. TXID: ${txid}`);

    // 7. Complete payment on Pi servers
    await pi.completePayment(paymentId, txid);
    console.log(`[Backend] Payment completed successfully. TXID: ${txid}`);

    // 8. Log successful transaction
    await logTransaction({ uid: sanitizedUid, paymentId, txid, status: 'completed' });

    return NextResponse.json(
      {
        success: true,
        txid,
        paymentId,
        message: 'Payment completed successfully.',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`[Backend] Error processing payment for UID ${sanitizedUid}:`, error.message);

    // Log failed transaction
    await logTransaction({
      uid: sanitizedUid,
      paymentId,
      txid: null,
      status: 'failed',
      error: error.message,
    });

    const friendlyMessage = resolveErrorMessage(error);

    return NextResponse.json(
      {
        error: 'payment_failed',
        message: friendlyMessage,
        ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
      },
      { status: 500 }
    );
  }
}
