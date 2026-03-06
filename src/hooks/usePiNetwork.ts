import { useState } from 'react';
import axios from 'axios';

export const usePiNetwork = () => {
  const [user, setUser] = useState<any>(null);

  const authenticate = async () => {
    try {
      const scopes = ['payments', 'username'];
      const onIncompletePaymentFound = async (payment: any) => {
        console.log('Incomplete payment found:', payment);
        // Call the Vercel API directly
        await axios.post('/api/complete-payment', {
          paymentId: payment.identifier,
          txid: payment.transaction.txid
        });
      };

      const authResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
      setUser(authResult.user);
      return authResult.user;
    } catch (error) {
      console.error('Authentication Error:', error);
      throw error;
    }
  };

  const createPayment = async (amount: number, memo: string) => {
    try {
      const paymentData = {
        amount,
        memo,
        metadata: { productId: 'test-product-1' }
      };

      const paymentCallbacks = {
        onReadyForServerApproval: async (paymentId: string) => {
          await axios.post('/api/approve-payment', { paymentId });
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          await axios.post('/api/complete-payment', { paymentId, txid });
        },
        onCancel: (paymentId: string) => {
          console.log('Payment cancelled:', paymentId);
        },
        onError: (error: any, payment: any) => {
          console.error('Payment Error:', error, payment);
        }
      };

      await window.Pi.createPayment(paymentData, paymentCallbacks);
    } catch (error) {
      console.error('Create Payment Error:', error);
    }
  };

  return { user, authenticate, createPayment };
};
