import React, { useState } from 'react';
import { X, Sparkles, CheckSquare, Square } from 'lucide-react';
import {
    WORKSHOP_POSITIVE_L2_TO_COL,
    WORKSHOP_NEGATIVE_L2_TO_COL
} from './shared/workshopDrivers';
import {
    L2_GROUPS,
    POSITIVE_DRIVERS,
    SERVICE_POSITIVE_GROUPS,
    SERVICE_NEGATIVE_GROUPS
} from './weightageHelpers';
import type { WeightagePayload } from './weightageHelpers';

interface Props {
    onClose: () => void;
    onApply: (payload: WeightagePayload) => void;
}

export const WeightageModal: React.FC<Props> = ({ onClose, onApply }) => {
    const [category, setCategory] = useState<'none' | 'service' | 'product'>('none');
    const [l2Weights, setL2Weights] = useState<Record<string, number>>({});
    const [positiveWeights, setPositiveWeights] = useState<Record<string, number>>({});
    const [servicePositiveWeights, setServicePositiveWeights] = useState<Record<string, number>>({});
    const [serviceNegativeWeights, setServiceNegativeWeights] = useState<Record<string, number>>({});
    const [autoFillRemaining, setAutoFillRemaining] = useState(true);

    const toggleL2 = (name: string) => {
        setL2Weights(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const togglePos = (name: string) => {
        setPositiveWeights(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const toggleServicePos = (name: string) => {
        setServicePositiveWeights(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const toggleServiceNeg = (name: string) => {
        setServiceNegativeWeights(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const totalL2 = Object.values(l2Weights).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalPos = Object.values(positiveWeights).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalServicePos = Object.values(servicePositiveWeights).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalServiceNeg = Object.values(serviceNegativeWeights).reduce((a, b) => a + (Number(b) || 0), 0);

    const handleApply = () => {
        onApply({
            category: category === 'none' ? 'product' : category,
            l2Weights,
            positiveWeights,
            servicePositiveWeights,
            serviceNegativeWeights,
            autoFillRemaining
        });
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '960px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles size={20} color="#7c3aed" />
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                            {category === 'none'
                                ? 'Auto-Fill Weights'
                                : category === 'service'
                                    ? 'Auto-Fill Weights — Service (OK..OW / OX..PL)'
                                    : 'Auto-Fill Weights — Product (L2 + Drivers)'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px'
                    }}>
                        <X size={20} color="#64748b" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {category === 'none' && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <p style={{ marginTop: 0, color: '#475569', fontSize: '14px' }}>Choose a category to configure weightage:</p>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
                                <button
                                    onClick={() => setCategory('service')}
                                    className="modern-btn modern-btn-primary"
                                    style={{ padding: '20px 40px', fontSize: '16px' }}
                                >
                                    Service (OK..OW / OX..PL)
                                </button>
                                <button
                                    onClick={() => setCategory('product')}
                                    className="modern-btn modern-btn-primary"
                                    style={{ padding: '20px 40px', fontSize: '16px' }}
                                >
                                    Product (L2 + Drivers)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Product Category Configuration */}
                    {category === 'product' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* L2 Complaint Groups */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155', fontWeight: 700 }}>
                                    Complaint Groups (L2)
                                </h4>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {L2_GROUPS.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => toggleL2(name)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                                {l2Weights[name] !== undefined
                                                    ? <CheckSquare size={16} color="#2563eb" />
                                                    : <Square size={16} color="#94a3b8" />}
                                            </button>
                                            <span style={{ flex: 1, fontSize: '13px', color: '#1e293b' }}>{name}</span>
                                            {l2Weights[name] !== undefined && (
                                                <input
                                                    type="number" min="0" max="100"
                                                    value={l2Weights[name] || ''}
                                                    onChange={e => setL2Weights(p => ({ ...p, [name]: Number(e.target.value) }))}
                                                    style={{ width: '60px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', color: '#074b9eff' }}
                                                    placeholder="%"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: totalL2 > 100 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                    Total L2: {totalL2}% {totalL2 > 100 && '⚠'}
                                </div>
                            </div>

                            {/* Positive Drivers */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155', fontWeight: 700 }}>
                                    Positive Drivers (AU..BM)
                                </h4>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {POSITIVE_DRIVERS.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => togglePos(name)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                                {positiveWeights[name] !== undefined
                                                    ? <CheckSquare size={16} color="#2563eb" />
                                                    : <Square size={16} color="#94a3b8" />}
                                            </button>
                                            <span style={{ flex: 1, fontSize: '13px', color: '#1e293b' }}>{name}</span>
                                            {positiveWeights[name] !== undefined && (
                                                <input
                                                    type="number" min="0" max="100"
                                                    value={positiveWeights[name] || ''}
                                                    onChange={e => setPositiveWeights(p => ({ ...p, [name]: Number(e.target.value) }))}
                                                    style={{ width: '60px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                                                    placeholder="%"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: totalPos > 100 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                    Total Pos: {totalPos}% {totalPos > 100 && '⚠'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Service Category Configuration */}
                    {category === 'service' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Service Positive Drivers (OK..OW) */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 700 }}>
                                        Service Positive (OK..OW)
                                    </h4>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        {Object.keys(servicePositiveWeights).length} selected
                                    </span>
                                </div>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {SERVICE_POSITIVE_GROUPS.map(name => {
                                        const colName = WORKSHOP_POSITIVE_L2_TO_COL[name];
                                        return (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleServicePos(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {servicePositiveWeights[name] !== undefined
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                                                        {name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={colName}>
                                                        ↳ {colName}
                                                    </div>
                                                </div>
                                                {servicePositiveWeights[name] !== undefined && (
                                                    <input
                                                        type="number" min="0" max="100"
                                                        value={servicePositiveWeights[name] || ''}
                                                        onChange={e => setServicePositiveWeights(p => ({ ...p, [name]: Number(e.target.value) }))}
                                                        style={{ width: '60px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                                                        placeholder="%"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: totalServicePos > 100 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                    Total Positive: {totalServicePos}% {totalServicePos > 100 && '⚠'}
                                </div>
                            </div>

                            {/* Service Negative Detractors (OX..PL) */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 700 }}>
                                        Service Negative (OX..PL)
                                    </h4>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        {Object.keys(serviceNegativeWeights).length} selected
                                    </span>
                                </div>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {SERVICE_NEGATIVE_GROUPS.map(name => {
                                        const colName = WORKSHOP_NEGATIVE_L2_TO_COL[name];
                                        return (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleServiceNeg(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {serviceNegativeWeights[name] !== undefined
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                                                        {name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={colName}>
                                                        ↳ {colName}
                                                    </div>
                                                </div>
                                                {serviceNegativeWeights[name] !== undefined && (
                                                    <input
                                                        type="number" min="0" max="100"
                                                        value={serviceNegativeWeights[name] || ''}
                                                        onChange={e => setServiceNegativeWeights(p => ({ ...p, [name]: Number(e.target.value) }))}
                                                        style={{ width: '60px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                                                        placeholder="%"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: totalServiceNeg > 100 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                    Total Negative: {totalServiceNeg}% {totalServiceNeg > 100 && '⚠'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {category !== 'none' && (
                    <div style={{
                        padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={autoFillRemaining}
                                onChange={e => setAutoFillRemaining(e.target.checked)}
                            />
                            {category === 'product' ? (
                                <>Auto-fill remaining <strong>{Math.max(0, 100 - totalL2)}%</strong> rows with random L2 & follow-ups</>
                            ) : (
                                <>Auto-fill remaining unassigned rows with random Service drivers</>
                            )}
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" className="modern-btn modern-btn-outline" onClick={() => setCategory('none')}>Back</button>
                            <button type="button" className="modern-btn modern-btn-primary" onClick={handleApply}>
                                <Sparkles size={14} /> Apply & Fill
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeightageModal;
