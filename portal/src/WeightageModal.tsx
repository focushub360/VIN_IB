import React, { useState } from 'react';
import { X, Sparkles, CheckSquare, Square, PlusCircle, MinusCircle } from 'lucide-react';
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

export interface ExistingCounts {
    l2: Record<string, number>;
    positive: Record<string, number>;
    servicePositive: Record<string, number>;
    serviceNegative: Record<string, number>;
}

interface Props {
    onClose: () => void;
    onApply: (payload: WeightagePayload) => void;
    totalRows: number;
    existingCounts: ExistingCounts;
}

export const WeightageModal: React.FC<Props> = ({
    onClose,
    onApply,
    totalRows = 0,
    existingCounts
}) => {
    const [mode, setMode] = useState<'add' | 'decrease'>('add');
    const [category, setCategory] = useState<'none' | 'service' | 'product'>('none');
    const [l2Counts, setL2Counts] = useState<Record<string, number>>({});
    const [positiveCounts, setPositiveCounts] = useState<Record<string, number>>({});
    const [servicePositiveCounts, setServicePositiveCounts] = useState<Record<string, number>>({});
    const [serviceNegativeCounts, setServiceNegativeCounts] = useState<Record<string, number>>({});
    const [autoFillRemaining, setAutoFillRemaining] = useState(false);

    const toggleL2 = (name: string) => {
        setL2Counts(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const togglePos = (name: string) => {
        setPositiveCounts(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const toggleServicePos = (name: string) => {
        setServicePositiveCounts(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const toggleServiceNeg = (name: string) => {
        setServiceNegativeCounts(prev => {
            const n = { ...prev };
            if (n[name] !== undefined) delete n[name];
            else n[name] = 0;
            return n;
        });
    };

    const computePanelTotals = (counts: Record<string, number>, existingMap: Record<string, number> = {}) => {
        let addTotal = 0;
        let removeTotal = 0;
        if (mode === 'add') {
            Object.values(counts).forEach(enteredRaw => {
                addTotal += Math.max(0, Math.floor(Number(enteredRaw) || 0));
            });
        } else {
            Object.entries(counts).forEach(([k, enteredRaw]) => {
                const entered = Math.max(0, Math.floor(Number(enteredRaw) || 0));
                const existing = existingMap[k] || 0;
                const toRemove = Math.min(entered, existing);
                removeTotal += toRemove;
            });
        }
        const netChange = addTotal - removeTotal;
        return { addTotal, removeTotal, netChange };
    };

    const handleApply = () => {
        onApply({
            category: category === 'none' ? 'product' : category,
            mode,
            l2Weights: l2Counts,
            positiveWeights: positiveCounts,
            servicePositiveWeights: servicePositiveCounts,
            serviceNegativeWeights: serviceNegativeCounts,
            autoFillRemaining: mode === 'add' && autoFillRemaining
        });
        onClose();
    };

    const countInputStyle: React.CSSProperties = {
        width: '74px',
        padding: '3px 6px',
        border: '1px solid #cbd5e1',
        borderRadius: '5px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#0f172a',
        textAlign: 'right'
    };

    const renderPanelFooter = (counts: Record<string, number>, existingMap: Record<string, number>) => {
        const { addTotal, removeTotal, netChange } = computePanelTotals(counts, existingMap);
        return (
            <div style={{
                marginTop: '12px',
                padding: '10px 12px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                    <span>Add total:</span>
                    <strong>{addTotal} cell(s)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                    <span>Remove total:</span>
                    <strong>{removeTotal} cell(s)</strong>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#0f172a',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '4px',
                    fontWeight: 700
                }}>
                    <span>Net change:</span>
                    <span>{netChange > 0 ? `+${netChange}` : netChange} cell(s)</span>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '1000px',
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#ffffff'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles size={20} color="#7c3aed" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                                {category === 'none'
                                    ? 'Auto-Fill Weights by Count'
                                    : category === 'service'
                                        ? 'Auto-Fill Weights — Service (OK..OW / OX..PL)'
                                        : 'Auto-Fill Weights — Product (L2 + Drivers)'}
                            </h3>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {totalRows} sheet row(s) loaded
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px'
                    }}>
                        <X size={20} color="#64748b" />
                    </button>
                </div>

                {/* Global Mode Segmented Control Bar */}
                <div style={{
                    padding: '10px 24px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                            Global Mode:
                        </span>
                        <div style={{
                            display: 'inline-flex',
                            background: '#e2e8f0',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '2px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setMode('add')}
                                style={{
                                    padding: '5px 16px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: mode === 'add' ? '#16a34a' : 'transparent',
                                    color: mode === 'add' ? '#ffffff' : '#475569',
                                    boxShadow: mode === 'add' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <PlusCircle size={13} />
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('decrease')}
                                style={{
                                    padding: '5px 16px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: mode === 'decrease' ? '#dc2626' : 'transparent',
                                    color: mode === 'decrease' ? '#ffffff' : '#475569',
                                    boxShadow: mode === 'decrease' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <MinusCircle size={13} />
                                Decrease
                            </button>
                        </div>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {mode === 'add' ? (
                            <span>
                                <strong>Add mode:</strong> delta = entered, target = existing + entered. Random empty slot (DF..EM), max 4 per row, no dupes.
                            </span>
                        ) : (
                            <span>
                                <strong>Decrease mode:</strong> toRemove = min(entered, existing), target = existing – toRemove. Clears rightmost slot first + follow-ups.
                            </span>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {category === 'none' && (
                        <div style={{ textAlign: 'center', padding: '24px 20px' }}>
                            <p style={{ marginTop: 0, color: '#334155', fontSize: '14.5px', fontWeight: 600 }}>
                                Choose a category to configure {mode === 'add' ? 'Add' : 'Decrease'} count-based weights:
                            </p>
                            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '-4px', maxWidth: '640px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                                {mode === 'add'
                                    ? 'Enter counts to ADD into available empty cells. L2 Complaint groups are placed into random empty slots (DF..EM) with follow-ups filled.'
                                    : 'Enter count to DELETE. Clears cells rightmost-first (capped at existing count) and corresponding follow-ups are cleared.'}
                            </p>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
                                <button
                                    onClick={() => setCategory('service')}
                                    className="modern-btn modern-btn-primary"
                                    style={{ padding: '18px 36px', fontSize: '15px' }}
                                >
                                    Service (OK..OW / OX..PL)
                                </button>
                                <button
                                    onClick={() => setCategory('product')}
                                    className="modern-btn modern-btn-primary"
                                    style={{ padding: '18px 36px', fontSize: '15px' }}
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
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>
                                        Complaint Groups (L2: DF..EM)
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                                        {mode === 'add'
                                            ? 'Enter count to ADD (placed in random empty slot DF..EM, max 4/row, no dupes).'
                                            : 'Enter count to DELETE (clears rightmost slot EM..DF first + follow-ups).'}
                                    </p>
                                </div>

                                <div style={{ maxHeight: '380px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                    {L2_GROUPS.map(name => {
                                        const isChecked = l2Counts[name] !== undefined;
                                        const existing = existingCounts.l2?.[name] || 0;
                                        const entered = isChecked ? Math.max(0, Math.floor(Number(l2Counts[name]) || 0)) : 0;
                                        const previewTarget = mode === 'add'
                                            ? existing + entered
                                            : existing - Math.min(entered, existing);

                                        return (
                                            <div
                                                key={name}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '6px',
                                                    padding: '4px 6px',
                                                    borderRadius: '6px',
                                                    background: isChecked ? '#ffffff' : 'transparent',
                                                    border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleL2(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {isChecked
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: isChecked ? 600 : 400 }}>
                                                        {name}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                                        (existing: {existing})
                                                    </span>
                                                    {isChecked && (
                                                        <span style={{
                                                            fontSize: '11px',
                                                            marginLeft: '6px',
                                                            fontWeight: 700,
                                                            color: mode === 'add' ? '#16a34a' : '#dc2626'
                                                        }}>
                                                            → {previewTarget}
                                                        </span>
                                                    )}
                                                </div>
                                                {isChecked && (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={l2Counts[name] === 0 ? '' : l2Counts[name]}
                                                        onChange={e => setL2Counts(p => ({
                                                            ...p,
                                                            [name]: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                        }))}
                                                        style={countInputStyle}
                                                        placeholder={mode === 'add' ? 'add' : 'delete'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {renderPanelFooter(l2Counts, existingCounts.l2 || {})}
                            </div>

                            {/* Positive Drivers (AU..BM) */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>
                                        Positive Drivers (AU..BM)
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                                        {mode === 'add'
                                            ? 'Enter count to ADD (fills empty rows top-to-bottom).'
                                            : 'Enter count to DELETE (clears filled rows top-to-bottom).'}
                                    </p>
                                </div>

                                <div style={{ maxHeight: '380px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                    {POSITIVE_DRIVERS.map(name => {
                                        const isChecked = positiveCounts[name] !== undefined;
                                        const existing = existingCounts.positive?.[name] || 0;
                                        const entered = isChecked ? Math.max(0, Math.floor(Number(positiveCounts[name]) || 0)) : 0;
                                        const previewTarget = mode === 'add'
                                            ? existing + entered
                                            : existing - Math.min(entered, existing);

                                        return (
                                            <div
                                                key={name}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '6px',
                                                    padding: '4px 6px',
                                                    borderRadius: '6px',
                                                    background: isChecked ? '#ffffff' : 'transparent',
                                                    border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => togglePos(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {isChecked
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: isChecked ? 600 : 400 }}>
                                                        {name}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                                        (existing: {existing})
                                                    </span>
                                                    {isChecked && (
                                                        <span style={{
                                                            fontSize: '11px',
                                                            marginLeft: '6px',
                                                            fontWeight: 700,
                                                            color: mode === 'add' ? '#16a34a' : '#dc2626'
                                                        }}>
                                                            → {previewTarget}
                                                        </span>
                                                    )}
                                                </div>
                                                {isChecked && (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={positiveCounts[name] === 0 ? '' : positiveCounts[name]}
                                                        onChange={e => setPositiveCounts(p => ({
                                                            ...p,
                                                            [name]: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                        }))}
                                                        style={countInputStyle}
                                                        placeholder={mode === 'add' ? 'add' : 'delete'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {renderPanelFooter(positiveCounts, existingCounts.positive || {})}
                            </div>
                        </div>
                    )}

                    {/* Service Category Configuration */}
                    {category === 'service' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Service Positive Drivers */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>
                                        Service Positive (OK..OW)
                                    </h4>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        {Object.keys(servicePositiveCounts).length} selected
                                    </span>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>
                                    {mode === 'add'
                                        ? 'Enter count to ADD (fills empty cells top-to-bottom).'
                                        : 'Enter count to DELETE (clears filled cells top-to-bottom).'}
                                </p>

                                <div style={{ maxHeight: '380px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                    {SERVICE_POSITIVE_GROUPS.map(name => {
                                        const colName = WORKSHOP_POSITIVE_L2_TO_COL[name];
                                        const isChecked = servicePositiveCounts[name] !== undefined;
                                        const existing = existingCounts.servicePositive?.[name] || 0;
                                        const entered = isChecked ? Math.max(0, Math.floor(Number(servicePositiveCounts[name]) || 0)) : 0;
                                        const previewTarget = mode === 'add'
                                            ? existing + entered
                                            : existing - Math.min(entered, existing);

                                        return (
                                            <div
                                                key={name}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '6px',
                                                    padding: '4px 6px',
                                                    borderRadius: '6px',
                                                    background: isChecked ? '#ffffff' : 'transparent',
                                                    border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleServicePos(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {isChecked
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: isChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                                                            {name}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                                            (existing: {existing})
                                                        </span>
                                                        {isChecked && (
                                                            <span style={{
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                color: mode === 'add' ? '#16a34a' : '#dc2626'
                                                            }}>
                                                                → {previewTarget}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '10.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={colName}>
                                                        ↳ {colName}
                                                    </div>
                                                </div>
                                                {isChecked && (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={servicePositiveCounts[name] === 0 ? '' : servicePositiveCounts[name]}
                                                        onChange={e => setServicePositiveCounts(p => ({
                                                            ...p,
                                                            [name]: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                        }))}
                                                        style={countInputStyle}
                                                        placeholder={mode === 'add' ? 'add' : 'delete'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {renderPanelFooter(servicePositiveCounts, existingCounts.servicePositive || {})}
                            </div>

                            {/* Service Negative Detractors */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>
                                        Service Negative (OX..PL)
                                    </h4>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        {Object.keys(serviceNegativeCounts).length} selected
                                    </span>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>
                                    {mode === 'add'
                                        ? 'Enter count to ADD (fills empty cells top-to-bottom).'
                                        : 'Enter count to DELETE (clears filled cells top-to-bottom).'}
                                </p>

                                <div style={{ maxHeight: '380px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                    {SERVICE_NEGATIVE_GROUPS.map(name => {
                                        const colName = WORKSHOP_NEGATIVE_L2_TO_COL[name];
                                        const isChecked = serviceNegativeCounts[name] !== undefined;
                                        const existing = existingCounts.serviceNegative?.[name] || 0;
                                        const entered = isChecked ? Math.max(0, Math.floor(Number(serviceNegativeCounts[name]) || 0)) : 0;
                                        const previewTarget = mode === 'add'
                                            ? existing + entered
                                            : existing - Math.min(entered, existing);

                                        return (
                                            <div
                                                key={name}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '6px',
                                                    padding: '4px 6px',
                                                    borderRadius: '6px',
                                                    background: isChecked ? '#ffffff' : 'transparent',
                                                    border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleServiceNeg(name)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    {isChecked
                                                        ? <CheckSquare size={16} color="#2563eb" />
                                                        : <Square size={16} color="#94a3b8" />}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: isChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                                                            {name}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                                            (existing: {existing})
                                                        </span>
                                                        {isChecked && (
                                                            <span style={{
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                color: mode === 'add' ? '#16a34a' : '#dc2626'
                                                            }}>
                                                                → {previewTarget}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '10.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={colName}>
                                                        ↳ {colName}
                                                    </div>
                                                </div>
                                                {isChecked && (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={serviceNegativeCounts[name] === 0 ? '' : serviceNegativeCounts[name]}
                                                        onChange={e => setServiceNegativeCounts(p => ({
                                                            ...p,
                                                            [name]: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                        }))}
                                                        style={countInputStyle}
                                                        placeholder={mode === 'add' ? 'add' : 'delete'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {renderPanelFooter(serviceNegativeCounts, existingCounts.serviceNegative || {})}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {category !== 'none' && (
                    <div style={{
                        padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
                    }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            cursor: mode === 'add' ? 'pointer' : 'not-allowed',
                            opacity: mode === 'add' ? 1 : 0.4
                        }}>
                            <input
                                type="checkbox"
                                disabled={mode === 'decrease'}
                                checked={mode === 'add' && autoFillRemaining}
                                onChange={e => setAutoFillRemaining(e.target.checked)}
                            />
                            <span>
                                {category === 'product'
                                    ? 'Also auto-fill remaining empty L2 rows with random L2s'
                                    : 'Also auto-fill remaining unassigned rows with random Service drivers'}
                                {mode === 'decrease' && ' (Disabled in Decrease mode)'}
                            </span>
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                className="modern-btn modern-btn-outline"
                                onClick={() => setCategory('none')}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="modern-btn modern-btn-primary"
                                onClick={handleApply}
                            >
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
