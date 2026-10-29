import axios from 'axios';

export const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'http://localhost:3001' : 'http://localhost:3001');
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

// Common Upload & Reference interfaces
export interface RegionItem {
    id: number;
    name: string;
}

export interface CountryItem {
    id: number;
    name: string;
    region_id: number;
    region_name: string;
}

export interface IbVersionItem {
    id: number;
    name: string;
}

export interface CommonUploadItem {
    id: number;
    file_name: string;
    region_name: string;
    country_name: string;
    ib_version_name: string;
    total_records: number;
    status: string;
    is_common: boolean;
    created_at: string;
}

export interface UploadDataResponse {
    id: number;
    file_name: string;
    region_name: string;
    country_name: string;
    ib_version_name: string;
    total_records: number;
    columns: string[];
    rows: Record<string, any>[];
}

// Runtime stubs to protect against pure type imports treated as value imports by Babel
export const RegionItem = {};
export const CountryItem = {};
export const IbVersionItem = {};
export const CommonUploadItem = {};
export const UploadDataResponse = {};

// Master Data APIs
export const getRegions = async (): Promise<RegionItem[]> => {
    const res = await api.get('/regions');
    return res.data;
};

export const getCountries = async (regionId?: number | string, regionName?: string): Promise<CountryItem[]> => {
    const params: Record<string, any> = {};
    if (regionId) params.region_id = regionId;
    if (regionName) params.region_name = regionName;
    const res = await api.get('/countries', { params });
    return res.data;
};

export const getIbVersions = async (): Promise<IbVersionItem[]> => {
    const res = await api.get('/ib-versions');
    return res.data;
};

// Common Uploads APIs
export const getCommonUploads = async (): Promise<CommonUploadItem[]> => {
    const res = await api.get('/uploads/common');
    return res.data;
};

export const getUploadData = async (fileId: number | string): Promise<UploadDataResponse> => {
    const res = await api.get(`/uploads/${fileId}/data`);
    return res.data;
};

export const updateUploadData = async (
    fileId: number | string,
    payload: { rows?: any[]; edits?: Array<{ rowIndex: number; column: string; value: any; columnLetter?: string }> }
): Promise<{ success: boolean; message: string; file_id: number | string; total_records: number }> => {
    const res = await api.put(`/uploads/${fileId}/data`, payload);
    return res.data;
};

export const uploadCommonFile = async (data: FormData | Record<string, any>): Promise<{ success: boolean; file: CommonUploadItem }> => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const res = await api.post('/uploads', data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
    });
    return res.data;
};

export const deleteCommonUpload = async (fileId: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/uploads/${fileId}`);
    return res.data;
};

// Reference Document APIs
export const saveReference = async (payload: {
    name: string;
    region_name?: string;
    country_name?: string;
    ib_version_name?: string;
    columns: string[];
    rows: any[];
}): Promise<{ success: boolean; id: number; name: string; total_records: number }> => {
    const res = await api.post('/references', payload);
    return res.data;
};

export const getReferences = async (): Promise<any[]> => {
    const res = await api.get('/references');
    return res.data;
};

export default api;
