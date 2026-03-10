import axiosClient from './axiosClient';

/**
 * Get medicines with filters and pagination
 * @param {Object} params - Query parameters
 * @returns {Promise} - Axios response
 */
export const getMedicines = (params) => {
  return axiosClient.get('/medicines', { params });
};

/**
 * Get maximum medicine price
 * @returns {Promise} - Axios response
 */
export const getMaxPrice = () => {
  return axiosClient.get('/medicines/max-price');
};

/**
 * Get filter options (generic names and companies)
 * @returns {Promise} - Axios response
 */
export const getFilterOptions = () => {
  return axiosClient.get('/medicines/filters');
};

/**
 * Get all categories
 * @returns {Promise} - Axios response
 */
export const getCategories = () => {
  return axiosClient.get('/categories');
};
