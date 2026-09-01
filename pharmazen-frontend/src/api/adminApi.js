import axios from 'axios';

const API_BASE_URL = 'https://pharmazen-backend-lvsf48cys-shahed3.vercel.app/api';

export const registerStaff = async (staffData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/admin/register-staff`,
      staffData,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Staff registration failed' };
  }
};

export const getDashboardStats = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/stats`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch dashboard stats' };
  }
};

export const getMedicineById = async (id) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/medicines/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch medicine' };
  }
};

export const createMedicine = async (medicineData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/medicines`,
      medicineData,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to create medicine' };
  }
};

export const updateMedicine = async (id, medicineData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/medicines/${id}`,
      medicineData,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update medicine' };
  }
};

export const deleteMedicine = async (id) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/medicines/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete medicine' };
  }
};

export const updateStock = async (id, stockQuantity) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/medicines/${id}/stock`,
      { stockQuantity },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update stock' };
  }
};

export const getAllOrders = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/orders`, {
      withCredentials: true,
      params,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch orders' };
  }
};

export const getAllUsers = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/users`, {
      withCredentials: true,
      params,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch users' };
  }
};

export const updateOrderStatus = async (id, status) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/admin/orders/${id}/status`,
      { status },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update order status' };
  }
};

export const updateUserRole = async (id, role) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/admin/users/${id}/role`,
      { role },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update user role' };
  }
};

export const getSalesAnalytics = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/sales`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch sales analytics' };
  }
};
