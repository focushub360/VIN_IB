import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import api, { BASE_URL } from './api';
import './Dashboard.css';

interface Mechanic {
    id: number;
    username: string;
    plain_password?: string;
}

interface User {
    username: string;
}

interface Inspection {
    id: number;
    vin: string;
    vinImage: string;
    gpsImage: string;
    faultImage: string;
    gpsData: { lat: number, long: number, time: string };
    mechanicId: number;
    User?: User;
    createdAt: string;
}

interface SubTenant {
    id: number;
    username: string;
}

const PasswordCell = ({ password }: { password?: string }) => {
    const [visible, setVisible] = useState(false);

    return (
        <div
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: '100px' }}
        >
            <span style={{ fontFamily: 'monospace' }}>
                {visible
                    ? (password || <span style={{ fontSize: '0.8em', color: '#f59e0b' }}>Update to View</span>)
                    : '******'}
            </span>
            <span style={{ fontSize: '1.2em', opacity: 0.7 }}>👁️</span>
        </div>
    );
};

const TenantDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState('feed'); // feed, analytics, subtenant
    const [mechanics, setMechanics] = useState<Mechanic[]>([]);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [subTenants, setSubTenants] = useState<SubTenant[]>([]);

    // Forms
    const [newMech, setNewMech] = useState({ username: '', password: '' });
    const [newSub, setNewSub] = useState({
        username: '',
        password: '',
        viewMechanic: true,
        viewVin: true,
        viewLocation: true,
        viewTimestamp: true
    });

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            const [mechRes, inspRes] = await Promise.all([
                api.get('/mechanics'),
                api.get('/inspections')
            ]);
            setMechanics(mechRes.data);
            setInspections(inspRes.data);

            if (activeTab === 'analytics') {
                const res = await api.get('/analytics');
                setAnalytics(res.data);
            }
            if (activeTab === 'subtenant') {
                const res = await api.get('/subtenants');
                setSubTenants(res.data);
            }

        } catch (e) {
            console.error(e);
        }
    };

    const handleCreateMech = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/mechanics', newMech);
            setNewMech({ username: '', password: '' });
            fetchData();
        } catch (e) {
            alert('Failed to create mechanic');
        }
    };

    const handleDeleteMech = async (id: number) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await api.delete(`/mechanics/${id}`);
            fetchData();
        } catch (e) {
            alert('Failed to delete mechanic');
        }
    };

    const handleUpdateMech = async (id: number, password: string) => {
        try {
            await api.put(`/mechanics/${id}`, { password });
            fetchData();
        } catch (e) {
            alert('Failed to update mechanic');
        }
    };

    const handleCreateSub = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                username: newSub.username,
                password: newSub.password,
                permissions: {
                    viewMechanic: newSub.viewMechanic,
                    viewVin: newSub.viewVin,
                    viewLocation: newSub.viewLocation,
                    viewTimestamp: newSub.viewTimestamp
                }
            };
            await api.post('/subtenants', payload);
            setNewSub({ ...newSub, username: '', password: '' });
            fetchData();
        } catch (e) {
            alert('Failed to create sub-tenant');
        }
    };


    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const getImgUrl = (path: string) => path ? `${BASE_URL}/${path.replace(/\\/g, '/')}` : '';

    return (
        <div className="dashboard-layout">
            <header className="navbar tenant-nav">
                <h2>Tenant Portal</h2>
                <div className="nav-tabs">
                    <button className={activeTab === 'feed' ? 'active' : ''} onClick={() => setActiveTab('feed')}>Inspections</button>
                    <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>Analytics</button>
                    <button className={activeTab === 'subtenant' ? 'active' : ''} onClick={() => setActiveTab('subtenant')}>Sub-Tenants</button>
                </div>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
            </header>

            <main className="content">
                {activeTab === 'feed' && (
                    <div className="grid-layout">
                        {/* Mechanics Management */}
                        <div className="card">
                            <h3>Manage Mechanics</h3>
                            <form className="inline-form" onSubmit={handleCreateMech}>
                                <div className="form-group">
                                    <label>Username</label>
                                    <input placeholder="Username" value={newMech.username} onChange={e => setNewMech({ ...newMech, username: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Password</label>
                                    <input type="text" placeholder="Password" value={newMech.password} onChange={e => setNewMech({ ...newMech, password: e.target.value })} />
                                </div>
                                <button type="submit">Add</button>
                            </form>
                            <table className="data-table mt-4">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Username</th>
                                        <th>Password</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mechanics.map(m => (
                                        <tr key={m.id}>
                                            <td>{m.id}</td>
                                            <td>{m.username}</td>
                                            <td>
                                                <PasswordCell password={m.plain_password} />
                                            </td>
                                            <td>
                                                <button onClick={() => handleDeleteMech(m.id)} style={{ marginRight: '5px', backgroundColor: '#ef4444' }}>Del</button>
                                                <button onClick={() => {
                                                    const newPass = prompt('Enter new password for ' + m.username);
                                                    if (newPass) handleUpdateMech(m.id, newPass);
                                                }} style={{ backgroundColor: '#f59e0b' }}>Upd</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Feed */}
                        <div className="card span-2">
                            <h3>Inspection Feed</h3>
                            <div className="inspection-grid">
                                {inspections.length === 0 && <p className="text-gray">No inspections found.</p>}
                                {inspections.map(insp => (
                                    <div key={insp.id} className="inspection-item box-shadow">
                                        <div className="insp-header-row">
                                            <div className="vin-badge">VIN: {insp.vin}</div>
                                            <div className="timestamp">{new Date(insp.createdAt).toLocaleString()}</div>
                                        </div>
                                        <div className="insp-sub-header">
                                            <p><strong>Mechanic:</strong> {insp.User?.username || `ID: ${insp.mechanicId}`}</p>
                                            {insp.gpsData && (
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${insp.gpsData.lat},${insp.gpsData.long}`} target="_blank" rel="noreferrer" className="map-link">
                                                    📍 View Location
                                                </a>
                                            )}
                                        </div>
                                        <div className="insp-images-grid">
                                            <div className="img-box"><div className="img-label">VIN</div>{insp.vinImage ? <img src={getImgUrl(insp.vinImage)} /> : <div className="no-img">No Image</div>}</div>
                                            <div className="img-box"><div className="img-label">GPS</div>{insp.gpsImage ? <img src={getImgUrl(insp.gpsImage)} /> : <div className="no-img">No Image</div>}</div>
                                            <div className="img-box"><div className="img-label">Fault</div>{insp.faultImage ? <img src={getImgUrl(insp.faultImage)} /> : <div className="no-img">No Image</div>}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="card">
                        <h3>Mechanic Performance (Volume & Integrity)</h3>
                        <div style={{ height: 500, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analytics}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" />
                                    <PolarRadiusAxis />
                                    <Radar name="Volume" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                    <Radar name="Integrity" dataKey="B" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'subtenant' && (
                    <div className="grid-layout">
                        <div className="card">
                            <h3>Create Sub-Tenant & Assign Permissions</h3>
                            <form onSubmit={handleCreateSub}>
                                <div className="form-group mb-4">
                                    <label>Username</label>
                                    <input value={newSub.username} onChange={e => setNewSub({ ...newSub, username: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div className="form-group mb-4">
                                    <label>Password</label>
                                    <input value={newSub.password} type="text" onChange={e => setNewSub({ ...newSub, password: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <h4>Access Control</h4>
                                <div className="checkbox-group">
                                    <label><input type="checkbox" checked={newSub.viewMechanic} onChange={e => setNewSub({ ...newSub, viewMechanic: e.target.checked })} /> View Mechanic Name</label>
                                    <label><input type="checkbox" checked={newSub.viewVin} onChange={e => setNewSub({ ...newSub, viewVin: e.target.checked })} /> View VIN Number</label>
                                    <label><input type="checkbox" checked={newSub.viewLocation} onChange={e => setNewSub({ ...newSub, viewLocation: e.target.checked })} /> View Map Location</label>
                                    <label><input type="checkbox" checked={newSub.viewTimestamp} onChange={e => setNewSub({ ...newSub, viewTimestamp: e.target.checked })} /> View Timestamps</label>
                                </div>
                                <button type="submit" className="mt-4">Create Sub-Tenant</button>
                            </form>
                        </div>

                        <div className="card">
                            <h3>Existing Sub-Tenants</h3>
                            <table className="data-table">
                                <thead><tr><th>ID</th><th>Username</th></tr></thead>
                                <tbody>
                                    {subTenants.map(s => (
                                        <tr key={s.id}>
                                            <td>{s.id}</td>
                                            <td>{s.username}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TenantDashboard;
