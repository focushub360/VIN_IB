import axios from 'axios';

export const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://vin-ib.onrender.com' : 'http://localhost:3000');
export const API_URL = `${BASE_URL.replace(/\/$/, '')}/api`;

const api = axios.create({
    baseURL: API_URL
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
