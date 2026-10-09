import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import './Login.css';

const Login: React.FC = () => {
    const [selectedRole, setSelectedRole] = useState('super_admin'); // Visual only
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/login', { username, password });
            const { token, role } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('role', role);

            // Redirect based on returned role
            if (role === 'super_admin') navigate('/admin');
            else if (role === 'tenant' || role === 'sub_tenant') navigate('/tenant');
            else setError('Access denied: Mobile users cannot login here.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                    <img 
                        src="/assets/focus_logo.png" 
                        alt="Focus Engineering Logo" 
                        style={{ height: "56px", objectFit: "contain" }} 
                    />
                </div>
                <h1>VIN_IB Inspector</h1>
                <p>Secure Portal Login</p>

                <div className="role-toggles">
                    <button
                        className={`role-btn ${selectedRole === 'super_admin' ? 'active' : ''}`}
                        onClick={() => setSelectedRole('super_admin')}
                    >
                        Admin
                    </button>
                    <button
                        className={`role-btn ${selectedRole === 'tenant' ? 'active' : ''}`}
                        onClick={() => setSelectedRole('tenant')}
                    >
                        Tenant
                    </button>
                    <button
                        className={`role-btn ${selectedRole === 'sub_tenant' ? 'active' : ''}`}
                        onClick={() => setSelectedRole('sub_tenant')}
                    >
                        Sub-Tenant
                    </button>
                </div>

                {error && <div className="error">{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="input-wrapper">
                        <input
                            type="text"
                            placeholder={selectedRole === 'super_admin' ? 'Admin Username' : selectedRole === 'tenant' ? 'Tenant Username' : 'Sub-Tenant Username'}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            className="eye-icon"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label="Toggle password visibility"
                        >
                            {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            )}
                        </button>
                    </div>
                    <button type="submit" className="submit-btn">
                        Sign In as {selectedRole.replace('_', ' ')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
