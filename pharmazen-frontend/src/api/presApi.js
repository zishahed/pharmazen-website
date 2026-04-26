import axiosClient from './axiosClient';

export const uploadPrescription = async (formData) => {
  return axiosClient.post('/prescriptions', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const getUserPrescriptions = () => {
  return axiosClient.get('/prescriptions');
};