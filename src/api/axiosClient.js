import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_URL || 'https://wecare-wecare-backend.n1logh.easypanel.host/api/v1';
const baseURL = rawBaseURL.startsWith('http://89.116.236.138')
  ? rawBaseURL.replace(/^http:\/\/89\.116\.236\.138:5000/, 'https://wecare-wecare-backend.n1logh.easypanel.host')
  : rawBaseURL;

const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject JWT token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clinic_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // When payload is FormData, remove Content-Type to allow browser/Axios to set multipart boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers && typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle response format and 401 unauthenticated
axiosClient.interceptors.response.use(
  (response) => {
    // Backend format: { success, data, message }
    return response.data;
  },
  (error) => {
    const { response } = error;
    if (response && response.status === 401) {
      localStorage.removeItem('clinic_token');
      localStorage.removeItem('clinic_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const message = response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
