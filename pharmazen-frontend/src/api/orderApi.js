import axiosClient from './axiosClient';

export const orderApi = {
  createOrder: async () => {
    const response = await axiosClient.post('/orders');
    return response.data;
  },

  getOrders: async () => {
    const response = await axiosClient.get('/orders');
    return response.data;
  },

  getOrderById: async (orderId) => {
    const response = await axiosClient.get(`/orders/${orderId}`);
    return response.data;
  },

  cancelOrder: async (orderId) => {
    const response = await axiosClient.put(`/orders/${orderId}/cancel`);
    return response.data;
  },
};
