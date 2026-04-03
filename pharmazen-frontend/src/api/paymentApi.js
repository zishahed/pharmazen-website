import axiosClient from './axiosClient';

export const paymentApi = {
  createPayment: async (orderId, amount) => {
    const response = await axiosClient.post('/payments/create', { orderId, amount });
    return response.data;
  },

  executePayment: async (paymentId) => {
    const response = await axiosClient.post('/payments/execute', { paymentId });
    return response.data;
  },

  queryPayment: async (paymentId) => {
    const response = await axiosClient.get(`/payments/query/${paymentId}`);
    return response.data;
  },

  getPaymentStatus: async (orderId) => {
    const response = await axiosClient.get(`/payments/status/${orderId}`);
    return response.data;
  },
};
