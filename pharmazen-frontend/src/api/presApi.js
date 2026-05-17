import axiosClient from './axiosClient';

export const uploadPrescription = async (formData) => {
  return axiosClient.post('/prescriptions', formData);
};

export const getUserPrescriptions = () => {
  return axiosClient.get('/prescriptions');
};

export const getPendingPrescriptions = () => {
  return axiosClient.get('/prescriptions/pending');
};

export const getPrescriptionById = (id) => {
  return axiosClient.get(`/prescriptions/${id}`);
};

export const reviewPrescription = (id, data) => {
  return axiosClient.put(`/prescriptions/${id}/review`, data);
};