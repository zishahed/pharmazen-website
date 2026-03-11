import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Register a new staff member (pharmacist or admin)
 */
export const registerStaff = async (staffData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/admin/register-staff`,
      staffData,
      {
        withCredentials: true, // Send cookies with request
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Staff registration failed' };
  }
};
