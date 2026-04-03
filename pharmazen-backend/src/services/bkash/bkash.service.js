const axios = require('axios');
const crypto = require('crypto');

const BKASH_BASE_URL = process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;
const IS_MOCK = process.env.BKASH_MOCK === 'true' || !BKASH_APP_KEY || BKASH_APP_KEY === 'your_bkash_app_key';

let mockToken = null;
let mockTokenExpiry = null;

const generateMockToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  mockToken = `mock_${token}`;
  mockTokenExpiry = Date.now() + 60 * 60 * 1000;
  return mockToken;
};

const isTokenValid = () => {
  return mockToken && mockTokenExpiry && Date.now() < mockTokenExpiry;
};

const getMockPaymentId = () => {
  return `mock_payment_${crypto.randomBytes(8).toString('hex')}`;
};

const getMockTransactionId = () => {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mockGrantToken = async () => {
  await sleep(200);
  return {
    id_token: generateMockToken(),
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: crypto.randomBytes(32).toString('hex'),
  };
};

const mockCreatePayment = async (amount, merchantInvoiceNumber, intent = 'sale') => {
  await sleep(300);
  const paymentId = getMockPaymentId();
  return {
    payment_id: paymentId,
    payment_type: 'Checkout',
    status: 'Created',
    status_message: 'Payment created successfully',
    amount: amount,
    merchantInvoiceNumber: merchantInvoiceNumber,
    intent: intent,
    currency: 'BDT',
    method: 'bKash',
    gatewayPageURL: `bkash://payment?paymentId=${paymentId}`,
    correlationId: crypto.randomBytes(16).toString('hex'),
    createdTime: new Date().toISOString(),
  };
};

const mockExecutePayment = async (paymentId) => {
  await sleep(500);
  if (!paymentId || paymentId.startsWith('mock_') === false && paymentId.length < 20) {
    return {
      status: 'failure',
      statusMessage: 'Invalid payment ID',
    };
  }
  return {
    payment_id: paymentId,
    trx_id: getMockTransactionId(),
    transactionStatus: 'Completed',
    amount: '0',
    currency: 'BDT',
    paymentExecutionID: crypto.randomBytes(16).toString('hex'),
    paymentExecuteTime: new Date().toISOString(),
    intent: 'sale',
    merchantInvoiceNumber: `INV${Date.now()}`,
  };
};

const mockQueryPayment = async (paymentId) => {
  await sleep(200);
  return {
    payment_id: paymentId,
    state: 'Completed',
    amount: '0',
    currency: 'BDT',
    intent: 'sale',
    merchantInvoiceNumber: `INV${Date.now()}`,
    trx_id: getMockTransactionId(),
    transactionStatus: 'Completed',
    paymentExecuteTime: new Date().toISOString(),
  };
};

const mockCallback = async (paymentId) => {
  await sleep(200);
  return {
    payment_id: paymentId,
    status: 'success',
    transactionStatus: 'Completed',
    trx_id: getMockTransactionId(),
  };
};

const realGrantToken = async () => {
  const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
    app_key: BKASH_APP_KEY,
    app_secret: BKASH_APP_SECRET,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'username': BKASH_USERNAME,
      'password': BKASH_PASSWORD,
    },
  });
  return response.data;
};

const realCreatePayment = async (token, amount, merchantInvoiceNumber, intent = 'sale') => {
  const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/create`, {
    mode: '0011',
    amount: amount,
    currency: 'BDT',
    intent: intent,
    merchantInvoiceNumber: merchantInvoiceNumber,
    callbackURL: process.env.BKASH_CALLBACK_URL,
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-APP-Key': BKASH_APP_KEY,
    },
  });
  return response.data;
};

const realExecutePayment = async (token, paymentId) => {
  const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/execute`, {
    payment_id: paymentId,
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-APP-Key': BKASH_APP_KEY,
    },
  });
  return response.data;
};

const realQueryPayment = async (token, paymentId) => {
  const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/payment/status`, {
    payment_id: paymentId,
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-APP-Key': BKASH_APP_KEY,
    },
  });
  return response.data;
};

let cachedToken = null;
let tokenExpiry = null;

const getAccessToken = async () => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const tokenData = IS_MOCK ? await mockGrantToken() : await realGrantToken();
  cachedToken = tokenData.id_token;
  tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
  return cachedToken;
};

const grantToken = async () => {
  if (IS_MOCK) {
    console.log('[Mock bKash] Granting token...');
    return await mockGrantToken();
  }
  return await realGrantToken();
};

const createPayment = async (amount, merchantInvoiceNumber) => {
  if (IS_MOCK) {
    console.log(`[Mock bKash] Creating payment: ${amount} BDT, Invoice: ${merchantInvoiceNumber}`);
    return await mockCreatePayment(amount, merchantInvoiceNumber);
  }

  const token = await getAccessToken();
  return await realCreatePayment(token, amount, merchantInvoiceNumber);
};

const executePayment = async (paymentId) => {
  if (IS_MOCK) {
    console.log(`[Mock bKash] Executing payment: ${paymentId}`);
    return await mockExecutePayment(paymentId);
  }

  const token = await getAccessToken();
  return await realExecutePayment(token, paymentId);
};

const queryPayment = async (paymentId) => {
  if (IS_MOCK) {
    console.log(`[Mock bKash] Querying payment: ${paymentId}`);
    return await mockQueryPayment(paymentId);
  }

  const token = await getAccessToken();
  return await realQueryPayment(token, paymentId);
};

const handleCallback = async (paymentId) => {
  if (IS_MOCK) {
    console.log(`[Mock bKash] Handling callback for: ${paymentId}`);
    return await mockCallback(paymentId);
  }

  return await queryPayment(paymentId);
};

module.exports = {
  grantToken,
  createPayment,
  executePayment,
  queryPayment,
  handleCallback,
  getAccessToken,
  IS_MOCK,
};
