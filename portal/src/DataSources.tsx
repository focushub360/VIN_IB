import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    UploadCloud,
    FileSpreadsheet,
    Database,
    CheckCircle2,
    Clock,
    Trash2,
    RefreshCw,
    Search,
    SlidersHorizontal,
    ArrowRight,
    ExternalLink,
    AlertTriangle,
    Layers,
    Globe
} from 'lucide-react';
import {
    getRegions,
    getCountries,
    getIbVersions,
    getCommonUploads,
    uploadCommonFile,
    deleteCommonUpload
} from './api';
import type {
    RegionItem,
    CountryItem,
    IbVersionItem,
    CommonUploadItem
} from './api';

interface DataSourcesProps {
    onSelectFileForTab?: (tabName: 'QC Data Check' | 'AI Data Entry', fileId: number) => void;
}

const DataSources: React.FC<DataSourcesProps> = ({ onSelectFileForTab }) => {
    // Dropdowns options
    const [regions, setRegions] = useState<RegionItem[]>([]);
    const [countries, setCountries] = useState<CountryItem[]>([]);
    const [ibVersions, setIbVersions] = useState<IbVersionItem[]>([]);

    // Form inputs
    const [selectedRegionId, setSelectedRegionId] = useState<string>('');
    const [selectedCountryName, setSelectedCountryName] = useState<string>('');
    const [selectedIbVersionName, setSelectedIbVersionName] = useState<string>('');
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);

    // Upload & Table state
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadError, setUploadError] = useState<string>('');
    const [uploadSuccess, setUploadSuccess] = useState<string>('');
    const [commonFiles, setCommonFiles] = useState<CommonUploadItem[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
    const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load of master dropdowns and uploads list
    useEffect(() => {
        loadMasterData();
        loadCommonFiles();
    }, []);

    // When region changes, update countries
    useEffect(() => {
        if (!selectedRegionId) {
            setCountries([]);
            setSelectedCountryName('');
            return;
        }
        getCountries(selectedRegionId)
            .then(data => {
                setCountries(data);
                if (data.length > 0) {
                    setSelectedCountryName(data[0].name);
                } else {
                    setSelectedCountryName('');
                }
            })
            .catch(err => console.error('Error fetching countries:', err));
    }, [selectedRegionId]);

    const loadMasterData = async () => {
        try {
            const [regData, verData] = await Promise.all([
                getRegions(),
                getIbVersions()
            ]);
            setRegions(regData);
            setIbVersions(verData);

            if (regData.length > 0) {
                setSelectedRegionId(String(regData[0].id));
            }
            if (verData.length > 0) {
                // Default to IB 3.0 Guinea if available, else first
                const defaultVer = verData.find(v => v.name.includes('IB 3.0')) || verData[0];
                setSelectedIbVersionName(defaultVer.name);
            }
        } catch (err) {
            console.error('Failed to load master dropdowns:', err);
        }
    };

    const loadCommonFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const list = await getCommonUploads();
            setCommonFiles(list);
            if (list.length > 0 && selectedFileId === null) {
                setSelectedFileId(list[0].id);
            }
        } catch (err) {
            console.error('Failed to load common uploads:', err);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const handleFileSelected = (file: File) => {
        setFileToUpload(file);
        setUploadError('');
        setUploadSuccess('');
    };

    const handleUploadAndProcess = async () => {
        if (!fileToUpload) {
            setUploadError('Please choose an Excel file to upload.');
            return;
        }

        setIsUploading(true);
        setUploadError('');
        setUploadSuccess('');

        try {
            // Read and parse Excel file in browser using XLSX
            const buffer = await fileToUpload.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const dataArrays = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

            if (dataArrays.length === 0) {
                throw new Error('The chosen Excel sheet is completely empty.');
            }

            // Find longest row for headers
            let maxLen = 0;
            let headerIdx = 0;
            for (let i = 0; i < Math.min(10, dataArrays.length); i++) {
                const count = (dataArrays[i] || []).filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
                if (count > maxLen) {
                    maxLen = count;
                    headerIdx = i;
                }
            }

            const rawHeaders = dataArrays[headerIdx] || [];
            const cols = rawHeaders.map((h, i) => {
                const s = h !== undefined && h !== null ? String(h).trim() : '';
                return s || `Column_${i + 1}`;
            });

            const seen: Record<string, number> = {};
            const uniqueCols = cols.map(c => {
                if (seen[c] === undefined) { seen[c] = 1; return c; }
                seen[c] += 1;
                return `${c}_${seen[c]}`;
            });

            const parsedRows = dataArrays.slice(headerIdx + 1)
                .filter(arr => arr && arr.some((v: any) => v !== '' && v !== null && v !== undefined))
                .map(arr => {
                    const obj: Record<string, any> = {};
                    uniqueCols.forEach((c, i) => {
                        const v = arr[i];
                        obj[c] = v === undefined || v === null ? '' : v;
                    });
                    return obj;
                });

            // Find current region name
            const currentReg = regions.find(r => String(r.id) === String(selectedRegionId));
            const regionName = currentReg ? currentReg.name : 'Africa';

            const formData = new FormData();
            formData.append('file', fileToUpload);
            formData.append('file_name', fileToUpload.name);
            formData.append('region_name', regionName);
            formData.append('country_name', selectedCountryName || 'General');
            formData.append('ib_version_name', selectedIbVersionName || 'IB 3.0 (449-Col Guinea)');
            formData.append('is_common', 'true');
            formData.append('total_records', String(parsedRows.length));
            formData.append('columns', JSON.stringify(uniqueCols));
            formData.append('rows', JSON.stringify(parsedRows));

            const res = await uploadCommonFile(formData);

            setUploadSuccess(`Successfully uploaded "${fileToUpload.name}" with ${parsedRows.length} records into Common Repository!`);
            setFileToUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Refresh uploads list & select newly uploaded file
            await loadCommonFiles();
            if (res.file && res.file.id) {
                setSelectedFileId(res.file.id);
            }
        } catch (err: any) {
            console.error('Upload & process error:', err);
            setUploadError(err.message || 'Failed to process and upload Excel file.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteUpload = async (id: number, name: string) => {
        if (!window.confirm(`Are you sure you want to remove "${name}" from the common repository?`)) {
            return;
        }
        try {
            await deleteCommonUpload(id);
            setCommonFiles(prev => prev.filter(f => f.id !== id));
            if (selectedFileId === id) {
                setSelectedFileId(null);
            }
        } catch (err: any) {
            alert('Failed to delete file: ' + (err.message || 'Server error'));
        }
    };

    const filteredFiles = commonFiles.filter(f => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            f.file_name.toLowerCase().includes(q) ||
            f.region_name.toLowerCase().includes(q) ||
            f.country_name.toLowerCase().includes(q) ||
            f.ib_version_name.toLowerCase().includes(q)
        );
    });

    const activeSelectedFile = commonFiles.find(f => f.id === selectedFileId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            {/* Header Banner */}
            <div className="glass-panel" style={{ padding: '16px 24px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                        }}>
                            <Database size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text)' }}>
                                    Common Data Sources Repository
                                </h3>
                                <span className="modern-badge modern-badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                    Central Storage
                                </span>
                            </div>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '12.5px', margin: '3px 0 0 0' }}>
                                Upload survey Excel files <strong>once</strong> here. Both <strong>QC Data Check</strong> and <strong>AI Data Entry</strong> seamlessly pull from this repository.
                            </p>
                        </div>
                    </div>

                    <button
                        className="modern-btn modern-btn-secondary"
                        onClick={loadCommonFiles}
                        disabled={isLoadingFiles}
                        style={{ padding: '7px 14px', fontSize: '12.5px' }}
                    >
                        <RefreshCw size={13} className={isLoadingFiles ? 'animate-spin' : ''} />
                        Refresh List
                    </button>
                </div>
            </div>

            {/* Upload Form Card */}
            <div className="glass-panel" style={{ padding: '20px 24px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <UploadCloud size={18} color="#2563eb" />
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Upload New Survey File
                    </h4>
                </div>

                {/* Dropdowns Configuration Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                    marginBottom: '16px'
                }}>
                    {/* Region */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                            Region <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                            value={selectedRegionId}
                            onChange={e => setSelectedRegionId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '13px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            {regions.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Country */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                            Country <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                            value={selectedCountryName}
                            onChange={e => setSelectedCountryName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '13px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            {countries.length === 0 ? (
                                <option value="General">General / All Countries</option>
                            ) : (
                                countries.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* IB Version */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                            IB Version <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                            value={selectedIbVersionName}
                            onChange={e => setSelectedIbVersionName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '13px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            {ibVersions.map(v => (
                                <option key={v.id} value={v.name}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Drag & Drop File Zone */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelected(f);
                    }}
                    style={{ display: 'none' }}
                />

                <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                        e.preventDefault();
                        setIsDragging(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleFileSelected(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        padding: '24px 20px',
                        borderRadius: '12px',
                        border: isDragging ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
                        background: isDragging ? '#eff6ff' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        marginBottom: '16px'
                    }}
                >
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <FileSpreadsheet size={22} />
                    </div>

                    {fileToUpload ? (
                        <div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                Selected: {fileToUpload.name}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                ({(fileToUpload.size / 1024).toFixed(1)} KB) — Click to change file
                            </span>
                        </div>
                    ) : (
                        <div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                Drag and drop Excel (.xlsx, .xls, .csv) file here, or click to browse
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                Preserves all 449 columns, headers, and metadata
                            </span>
                        </div>
                    )}
                </div>

                {/* Alerts */}
                {uploadError && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '14px'
                    }}>
                        <AlertTriangle size={15} />
                        {uploadError}
                    </div>
                )}

                {uploadSuccess && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#16a34a',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '14px'
                    }}>
                        <CheckCircle2 size={15} />
                        {uploadSuccess}
                    </div>
                )}

                {/* Submit Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    {fileToUpload && (
                        <button
                            type="button"
                            className="modern-btn modern-btn-outline"
                            onClick={() => {
                                setFileToUpload(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            disabled={isUploading}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        className="modern-btn modern-btn-primary"
                        onClick={handleUploadAndProcess}
                        disabled={!fileToUpload || isUploading}
                        style={{ padding: '8px 20px', fontSize: '13px', minWidth: '160px' }}
                    >
                        {isUploading ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                Processing Excel...
                            </>
                        ) : (
                            <>
                                <UploadCloud size={15} />
                                Upload &amp; Process
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Common Uploads Table Card */}
            <div className="glass-panel" style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                background: '#ffffff',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
                {/* Table Action Bar */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={16} color="#2563eb" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Available Common Files ({commonFiles.length})
                        </span>
                        {activeSelectedFile && (
                            <span style={{
                                fontSize: '11.5px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 600
                            }}>
                                Active: {activeSelectedFile.file_name}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search common files..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    padding: '5px 10px 5px 28px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12px',
                                    width: '200px',
                                    outline: 'none',
                                    background: '#ffffff'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Table Contents */}
                <div style={{ overflowX: 'auto', width: '100%', maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f1f5f9' }}>
                            <tr>
                                <th style={{ width: '45px', textAlign: 'center', padding: '10px 8px' }}>Select</th>
                                <th style={{ textAlign: 'left', padding: '10px 14px' }}>File Name</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Region</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Country</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px' }}>IB Version</th>
                                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Total Records</th>
                                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Uploaded At</th>
                                <th style={{ textAlign: 'right', padding: '10px 16px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingFiles ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                                        <RefreshCw size={18} className="animate-spin" style={{ display: 'inline-block', marginBottom: '6px' }} />
                                        <div>Loading common uploads repository...</div>
                                    </td>
                                </tr>
                            ) : filteredFiles.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                        <FileSpreadsheet size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No common files found</div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                            Use the form above to upload an Excel file to the shared repository.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredFiles.map(file => {
                                    const isSelected = selectedFileId === file.id;
                                    const dateStr = file.created_at ? new Date(file.created_at).toLocaleString() : '—';
                                    return (
                                        <tr
                                            key={file.id}
                                            onClick={() => setSelectedFileId(file.id)}
                                            style={{
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'inherit',
                                                borderBottom: '1px solid #e2e8f0',
                                                transition: 'background 0.15s ease'
                                            }}
                                        >
                                            <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                                <input
                                                    type="radio"
                                                    name="selectedCommonFile"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedFileId(file.id)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileSpreadsheet size={15} color="#2563eb" />
                                                    <span>{file.file_name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#334155' }}>
                                                {file.region_name || 'General'}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#334155' }}>
                                                {file.country_name || 'General'}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: '#f1f5f9',
                                                    border: '1px solid #cbd5e1',
                                                    fontWeight: 600,
                                                    color: '#475569'
                                                }}>
                                                    {file.ib_version_name || 'IB 1.0'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                                                <span className="modern-stat-chip total" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                                    {file.total_records} rows
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                                                <span className="modern-badge modern-badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                    <CheckCircle2 size={11} /> {file.status || 'Ready'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                                                {dateStr}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                    {onSelectFileForTab && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="modern-btn modern-btn-outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSelectFileForTab('QC Data Check', file.id);
                                                                }}
                                                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                                                title="Load this file into QC Data Check"
                                                            >
                                                                QC Check <ArrowRight size={11} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="modern-btn modern-btn-secondary"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSelectFileForTab('AI Data Entry', file.id);
                                                                }}
                                                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                                                title="Load this file into AI Data Entry"
                                                            >
                                                                AI Entry <ArrowRight size={11} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteUpload(file.id, file.file_name);
                                                        }}
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            color: '#94a3b8',
                                                            padding: '4px'
                                                        }}
                                                        onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
                                                        onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
                                                        title="Delete this file"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Status Bar */}
                <div style={{
                    padding: '10px 20px',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#64748b'
                }}>
                    <span>
                        Showing {filteredFiles.length} of {commonFiles.length} common uploads
                    </span>
                    {activeSelectedFile && onSelectFileForTab && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                Selected: {activeSelectedFile.file_name}
                            </span>
                            <button
                                className="modern-btn modern-btn-primary"
                                onClick={() => onSelectFileForTab('QC Data Check', activeSelectedFile.id)}
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                                Open in QC Data Check
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataSources;
