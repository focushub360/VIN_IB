
// Use your computer's local IP address so physical devices can connect
// Current Local IP: 10.236.242.185
const DEV_URL = 'http://10.236.242.185:3000/api';

export const API_URL = DEV_URL;

export const uploadInspection = async (token: string, data: any) => {
    const formData = new FormData();

    formData.append('vin', data.vin);
    formData.append('gpsData', JSON.stringify(data.gpsData));
    formData.append('mechanicId', data.mechanicId.toString());

    if (data.vinImage) {
        formData.append('vinImage', {
            uri: data.vinImage,
            name: 'vin.jpg',
            type: 'image/jpeg'
        } as any);
    }
    if (data.gpsImage) {
        formData.append('gpsImage', {
            uri: data.gpsImage,
            name: 'gps.jpg',
            type: 'image/jpeg'
        } as any);
    }
    if (data.faultImage) {
        formData.append('faultImage', {
            uri: data.faultImage,
            name: 'fault.jpg',
            type: 'image/jpeg'
        } as any);
    }

    const res = await fetch(`${API_URL}/inspections`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
        },
        body: formData
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Upload failed');
    }
    return res.json();
};

export const loginMechanic = async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
};

export const getInspections = async (token: string) => {
    const res = await fetch(`${API_URL}/inspections`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch inspections');
    return json;
};
