import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { API_URL } from './api';
import './Dashboard.css';

interface GeoLocationData {
    latitude?: string;
    longitude?: string;
    dateTime?: string;
    location?: string;
    watermarkText?: string;
}

interface ProcessedRow {
    [key: string]: any;
    extractedVin?: string;
    geoLocation?: GeoLocationData | null;
    isMatch?: string;
    status?: 'Pending' | 'Processing' | 'Complete' | 'Error';
}

const AdminDashboard: React.FC = () => {
    const [excelData, setExcelData] = useState<ProcessedRow[]>([]);
    const [originalColumns, setOriginalColumns] = useState<string[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [activeTab, setActiveTab] = useState('VIN Inspector');

    const [questData, setQuestData] = useState<any[]>([]);
    const [questColumns, setQuestColumns] = useState<string[]>([]);
    const [questVisibleCols, setQuestVisibleCols] = useState<Record<string, boolean>>({});
    const [showColumnFilter, setShowColumnFilter] = useState(false);
    const [questIsLoading, setQuestIsLoading] = useState(false);
    const [questError, setQuestError] = useState<string>('');
    const [questCurrentPage, setQuestCurrentPage] = useState(1);
    const [editingCell, setEditingCell] = useState<{rowIndex: number, colName: string} | null>(null);

    const [valData, setValData] = useState<any[]>([]);
    const [valColumns, setValColumns] = useState<string[]>([]);
    const [valVisibleCols, setValVisibleCols] = useState<Record<string, boolean>>({});
    const [showValColumnFilter, setShowValColumnFilter] = useState(false);
    const [valIsLoading, setValIsLoading] = useState(false);
    const [valCurrentPage, setValCurrentPage] = useState(1);
    const [valSearchText, setValSearchText] = useState('');

    const handleValDownload = () => {
        const filteredData = valData.filter(row => 
            Object.values(row).some(val => 
                String(val).toLowerCase().includes(valSearchText.toLowerCase())
            )
        );

        // Map data to only include visible columns
        const exportData = filteredData.map(row => {
            const exp: any = {};
            valColumns.forEach(c => {
                if (valVisibleCols[c]) {
                    exp[c] = row[c];
                }
            });
            return exp;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Parsed Matrix");
        XLSX.writeFile(wb, "Validator_Export.xlsx");
    };
    
    /*
    const BRAKE_HIERARCHY: any = {
        "Front brake noise": { L4: ["Moring time only", "All time brake noise"], L5: null },
        "Front brake poor": { L4: ["Lever touching accelerator", "Lever play loose", "Stopping distance is high", "Brake shoe quick wear", "Disc pad quick wear"], L5: null },
        "Front Brake tight": { L4: ["Lever play tight", "hard to apply brake"], L5: null },
        "Rear brake noise": { L4: ["Moring time only", "All time brake noise"], L5: null },
        "Rear brake poor": { L4: ["Pedal not return", "Lever play loose", "Stopping distance is high", "Brake shoe quick wear", "Disc pad quick wear"], L5: null },
        "Rear brake tight": { L4: ["Lever play tight", "hard to apply brake"], L5: null },
        "ABS Not working": { L4: ["Front", "Rear"], L5: ["Yes", "No"] },
        "Hand brake poor": { L4: ["Hand brake slippage", "not working"], L5: null },
        "Brake poor": { L4: ["Pedal not return", "Stopping distance is high", "too soft or spongy brake"], L5: ["Yes", "No"] }
    };
    */

    const validateRowData = (rowObj: any, columns: string[], startIndex: number = 0) => {
        let isAccepted = false;
        let missingCol = '';
        let isRejected = false;

        const brakeKey = columns.find(c => c.toLowerCase().trim() === 'brake') || 'Brake';
        
        const cleanCell = (v: any) => v === undefined || v === null ? '' : String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const brakeVal = cleanCell(rowObj[brakeKey]);

        // Ensure we only validate if the cell actually has visible text
        if (brakeVal !== '') {
            isAccepted = true;
        }

        // If Brake is empty, check if ANY other category is filled so we can mark it as Accepted
        if (!isAccepted && !isRejected) {
            for (let i = startIndex; i < columns.length; i++) {
                const val = cleanCell(rowObj[columns[i]]);
                if (val !== '') {
                    isAccepted = true;
                    break;
                }
            }
        }

        return {
            Accepted: isAccepted && !isRejected ? '✅ Accepted' : '',
            Rejected: isRejected ? missingCol : ''
        };
    };

    const isPausedRef = useRef(false);
    const stopProcessingRef = useRef(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const isDriveLink = (value: any): boolean => {
        if (typeof value !== 'string') return false;
        return value.includes('drive.google.com');
    };

    const handleQuestFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setQuestIsLoading(true);
        setQuestError('');
        setQuestData([]);
        setQuestCurrentPage(1);
        
        // Use a short timeout to let the UI render the loading state before parsing blocks the thread
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            
            const dataArrays: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (dataArrays && dataArrays.length > 0) {
                // Find the row with the most columns to treat as the header
                let maxLen = 0;
                let headerIndex = 0;
                for (let i = 0; i < Math.min(15, dataArrays.length); i++) {
                    const rowArr = dataArrays[i] || [];
                    const nonBlankCount = rowArr.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').length;
                    if (nonBlankCount > maxLen) {
                        maxLen = nonBlankCount;
                        headerIndex = i;
                    }
                }
                
                const headers = dataArrays[headerIndex] || [];
                // Generate safe column names
                const cols = headers.map((h: any, idx: number) => {
                    const str = h !== undefined && h !== null ? String(h).trim() : '';
                    return str ? str : `Column_${idx + 1}`;
                });
                
                // If there are duplicate column names, append index to make them unique
                const uniqueCols = cols.map((col, idx) => {
                    if (cols.indexOf(col) !== idx) return `${col}_${idx}`;
                    return col;
                });
                
                // Format Validation: Ensure this is actually the Questionnaire mapping file
                const isCorrectFormat = uniqueCols.some(col => 
                    col.toLowerCase().includes('complaint') || 
                    col.toLowerCase().includes('probing') || 
                    col.toLowerCase().includes('l2') || 
                    col.toLowerCase().includes('l3')
                );

                if (!isCorrectFormat) {
                    setQuestError("Invalid File Format: Please upload the correct NPS TGW Buckets questionnaire template. The file must contain columns like 'Complaint group (L2)' or 'Sub Complaint (L3)'.");
                    setQuestIsLoading(false);
                    return;
                }

                const rows = dataArrays.slice(headerIndex + 1).map(row => {
                    const rowObj: any = {};
                    uniqueCols.forEach((col: string, idx: number) => {
                        const val = row[idx];
                        rowObj[col] = val !== undefined && val !== null ? String(val) : '';
                    });
                    return rowObj;
                });
                
                // Find where the TGW matrix starts to insert the Status columns
                const lowerCols = uniqueCols.map(c => c.toLowerCase().trim());
                let originalSplitIndex = lowerCols.findIndex(c => c === 'brake' || c === 'electrical' || c === 'engine');
                
                if (originalSplitIndex !== -1) {
                    uniqueCols.splice(originalSplitIndex, 0, 'Accepted', 'Rejected');
                } else {
                    uniqueCols.unshift('Accepted', 'Rejected');
                }
                
                // Run validation to populate Status columns
                rows.forEach(r => {
                    const matrixStart = originalSplitIndex !== -1 ? originalSplitIndex + 2 : 2;
                    const v = validateRowData(r, uniqueCols, matrixStart);
                    r['Accepted'] = v.Accepted;
                    r['Rejected'] = v.Rejected;
                });

                setQuestColumns([...uniqueCols]);
                
                const colVisInit: Record<string, boolean> = {};
                const newSplitIndex = uniqueCols.indexOf('Accepted');
                
                uniqueCols.forEach((c, idx) => { 
                    if (newSplitIndex !== -1) {
                        // Uncheck everything before the status columns, check everything from status columns onwards
                        colVisInit[c] = idx >= newSplitIndex;
                    } else {
                        colVisInit[c] = true;
                    }
                });
                
                setQuestVisibleCols(colVisInit);
                
                // Filter out rows that are entirely blank (ignoring the synthetic columns)
                const filteredRows = rows.filter(r => uniqueCols.some(col => col !== 'Accepted' && col !== 'Rejected' && String(r[col]).trim() !== ''));
                setQuestData(filteredRows);
            }
            setQuestIsLoading(false);
        };
        reader.readAsBinaryString(file);
        }, 50);
    };

    const handleValidatorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setValIsLoading(true);

        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                const dataArrays = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
                
                if (dataArrays.length > 0) {
                    const headers = dataArrays[0] || [];
                    const cols = headers.map((h, idx) => {
                        const str = h !== undefined && h !== null ? String(h).trim() : '';
                        return str ? str : `Column_${idx + 1}`;
                    });
                    
                    const uniqueCols = cols.map((col, idx) => {
                        if (cols.indexOf(col) !== idx) return `${col}_${idx}`;
                        return col;
                    });

                    let finalCols = [...uniqueCols];
                    
                    // Check if there are any columns that look like a VIN column
                    const vinCols = uniqueCols.filter(c => {
                        const lower = c.toLowerCase();
                        return lower.includes('vin') && !lower.includes('picture') && !lower.includes('image') && !lower.includes('upload');
                    });

                    if (vinCols.length > 0) {
                        const vinColName = vinCols[0];
                        const vinIdx = finalCols.indexOf(vinColName);
                        // Inject the new extracted columns right after the VIN column
                        finalCols.splice(vinIdx + 1, 0, 'Extracted Year', 'Extracted Plant', 'Extracted Month');
                    }

                    const YEAR_CODE_MAP: Record<string, string> = {
                        '1': '2001', '2': '2002', '3': '2003', '4': '2004', '5': '2005',
                        '6': '2006', '7': '2007', '8': '2008', '9': '2009', 'A': '2010',
                        'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014', 'F': '2015',
                        'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019', 'L': '2020',
                        'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024', 'S': '2025',
                        'T': '2026', 'U': '2027', 'V': '2028', 'W': '2029', 'X': '2030'
                    };

                    const MONTH_CODE_MAP: Record<string, string> = {
                        'A': 'January', 'B': 'February', 'C': 'March', 'D': 'April',
                        'E': 'May', 'F': 'June', 'G': 'July', 'H': 'August',
                        'K': 'September', 'L': 'October', 'N': 'November', 'P': 'December'
                    };

                    const PLANT_CODE_MAP: Record<string, string> = {
                        '1': 'Hosur', '2': 'Mysore', '3': 'HP', '4': '3W Hosur'
                    };

                    const rows = dataArrays.slice(1).map(row => {
                        const rowObj: any = {};
                        uniqueCols.forEach((col: string, idx: number) => {
                            const val = row[idx];
                            rowObj[col] = val !== undefined && val !== null ? String(val).trim() : '';
                        });
                        
                        if (vinCols.length > 0) {
                            const vin = rowObj[vinCols[0]];
                            if (vin && vin.length >= 12) {
                                const yCode = vin.charAt(9);
                                const pCode = vin.charAt(10);
                                const mCode = vin.charAt(11);
                                
                                rowObj['Extracted Year'] = YEAR_CODE_MAP[yCode] ? `${yCode} (${YEAR_CODE_MAP[yCode]})` : yCode;
                                rowObj['Extracted Plant'] = PLANT_CODE_MAP[pCode] ? `${pCode} (${PLANT_CODE_MAP[pCode]})` : pCode;
                                rowObj['Extracted Month'] = MONTH_CODE_MAP[mCode] ? `${mCode} (${MONTH_CODE_MAP[mCode]})` : mCode;
                            } else {
                                rowObj['Extracted Year'] = '-';
                                rowObj['Extracted Plant'] = '-';
                                rowObj['Extracted Month'] = '-';
                            }
                        }
                        return rowObj;
                    });
                    
                    setValColumns(finalCols);
                    
                    const colVisInit: Record<string, boolean> = {};

                    if (vinCols.length > 0) {
                        finalCols.forEach(c => {
                            colVisInit[c] = vinCols.includes(c) || c.startsWith('Extracted ');
                        });
                    } else {
                        finalCols.forEach(c => colVisInit[c] = true);
                    }
                    
                    setValVisibleCols(colVisInit);
                    
                    const filteredRows = rows.filter(r => uniqueCols.some(col => String(r[col]).trim() !== ''));
                    setValData(filteredRows);
                }
                setValIsLoading(false);
            };
            reader.readAsBinaryString(file);
        }, 50);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsProcessing(false);
        setIsPaused(false);
        setProgress(0);
        stopProcessingRef.current = true; 

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            
            const data = XLSX.utils.sheet_to_json(ws) as ProcessedRow[];
            
            if (data.length > 0) {
                setOriginalColumns(Object.keys(data[0]));
            } else {
                setOriginalColumns([]);
            }

            const initializedData = data.map(row => ({
                ...row,
                extractedVin: '-',
                geoLocation: null,
                isMatch: '-',
                status: 'Pending' as const
            }));
            
            setExcelData(initializedData);
        };
        reader.readAsBinaryString(file);
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const processImages = async () => {
        if (isPaused) {
            isPausedRef.current = false;
            setIsPaused(false);
            return;
        }

        setIsProcessing(true);
        setIsPaused(false);
        isPausedRef.current = false;
        stopProcessingRef.current = false;

        const CONCURRENCY_LIMIT = 3;
        let activeTasks = 0;
        const tasks: Promise<void>[] = [];
        let completedOrSkipped = 0;

        const updateGlobalProgress = () => {
            setProgress(Math.round((completedOrSkipped / excelData.length) * 100));
        };

        for (let i = 0; i < excelData.length; i++) {
            if (stopProcessingRef.current) break;

            while (isPausedRef.current) {
                if (stopProcessingRef.current) break;
                await sleep(500);
            }
            if (stopProcessingRef.current) break;

            if (excelData[i].status === 'Complete' || excelData[i].status === 'Error') {
                completedOrSkipped++;
                updateGlobalProgress();
                continue;
            }

            // Wait if we hit the concurrency limit
            while (activeTasks >= CONCURRENCY_LIMIT) {
                await sleep(100);
            }
            if (stopProcessingRef.current) break;

            activeTasks++;

            const task = (async (index) => {
                const vinCol = originalColumns[0];
                const linkCol = originalColumns[1];
                
                setExcelData(prev => {
                    const updated = [...prev];
                    updated[index] = { ...updated[index], status: 'Processing' };
                    return updated;
                });

                const row = excelData[index];
                const expectedVin = row[vinCol] as string;
                const driveLink = row[linkCol] as string;

                if (!expectedVin || !isDriveLink(driveLink)) {
                    setExcelData(prev => {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], extractedVin: 'N/A', isMatch: 'N/A', status: 'Complete' };
                        return updated;
                    });
                    completedOrSkipped++;
                    updateGlobalProgress();
                    activeTasks--;
                    return;
                }

                try {
                    const response = await fetch(`${API_URL}/validate-vin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ driveLink, expectedVin })
                    });
                    const result = await response.json();
                    
                    setExcelData(prev => {
                        const updated = [...prev];
                        if (response.ok) {
                            updated[index] = { 
                                ...updated[index], 
                                extractedVin: result.extractedVin || 'No text found',
                                geoLocation: result.geoLocation || null,
                                isMatch: result.isMatch ? 'Match' : 'Mismatch', 
                                status: 'Complete' 
                            };
                        } else {
                            updated[index] = { ...updated[index], extractedVin: 'Error API', isMatch: 'Error', status: 'Error' };
                        }
                        return updated;
                    });
                } catch (err) {
                    setExcelData(prev => {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], extractedVin: 'Error Fetch', isMatch: 'Error', status: 'Error' };
                        return updated;
                    });
                }

                completedOrSkipped++;
                updateGlobalProgress();
                activeTasks--;
            })(i);

            tasks.push(task);
        }
        
        // Wait for all remaining tasks to finish
        await Promise.all(tasks);
        
        setIsProcessing(false);
        setIsPaused(false);
    };

    const togglePause = () => {
        isPausedRef.current = !isPausedRef.current;
        setIsPaused(isPausedRef.current);
    };

    const handleExport = () => {
        const exportRows = excelData.map(row => {
            const rowOutput: any = {};
            originalColumns.forEach(col => {
                rowOutput[col] = row[col];
            });
            rowOutput['Extracted VIN'] = row.extractedVin || '';
            rowOutput['Match Status'] = row.isMatch || '';
            rowOutput['Latitude'] = row.geoLocation?.latitude || '';
            rowOutput['Longitude'] = row.geoLocation?.longitude || '';
            rowOutput['Date & Time'] = row.geoLocation?.dateTime || '';
            rowOutput['Location Address'] = row.geoLocation?.location || (row.geoLocation?.watermarkText || '');
            return rowOutput;
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Validated_VINs");
        XLSX.writeFile(wb, `Validated_${fileName || 'data.xlsx'}`);
    };

    const completedCount = excelData.filter(r => r.status === 'Complete').length;
    const matchCount = excelData.filter(r => r.isMatch === 'Match').length;
    const mismatchCount = excelData.filter(r => r.isMatch === 'Mismatch').length;

    return (
        <div style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: "var(--font-body)" }}>
            
            {/* Header */}
            <header style={{ 
                background: 'var(--color-surface)', 
                padding: '14px 32px', 
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-text)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img src="/assets/focus_logo.png" alt="Focus Engineering" style={{ height: "42px", width: "auto", objectFit: "contain" }} />
                    <div>
                        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text)", fontFamily: "var(--font-display)" }}>Advanced Validation Platform</h2>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 500, letterSpacing: "0.02em" }}>Chassis &middot; Geo-Location &middot; Questionnaire</span>
                    </div>
                </div>
                <button 
                    onClick={handleLogout} 
                    style={{ 
                        background: 'var(--color-danger-bg)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        color: '#f87171', 
                        padding: '8px 18px', 
                        borderRadius: 'var(--radius-sm)', 
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-danger-bg)'}
                >
                    Logout
                </button>
            </header>

            {/* Navigation Tabs */}
            <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0 32px', display: 'flex', gap: '4px' }}>
                {['VIN Inspector', 'Validator', 'Questionnaire Validation'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '14px 20px',
                            background: activeTab === tab ? 'var(--color-primary-glow)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: activeTab === tab ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                            fontSize: '13px',
                            fontWeight: activeTab === tab ? 700 : 500,
                            fontFamily: 'var(--font-body)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            outline: 'none',
                            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                            letterSpacing: '0.01em'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <main style={{ padding: '24px 32px', width: '100%', boxSizing: 'border-box', margin: '0' }}>
                
                {activeTab === 'VIN Inspector' && (
                    <>
                        {/* Upload Card */}
                <div style={{ 
                    background: 'var(--color-surface)', 
                    padding: '20px 24px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-md)',
                    marginBottom: '24px',
                    width: 'fit-content',
                    maxWidth: '100%'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                📁 Upload Validation Excel
                            </h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                Excel with Column 1 = Expected VIN, Column 2 = Google Drive Image Link
                            </p>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                            style={{ 
                                padding: '10px 16px', 
                                border: '2px dashed var(--color-border-light)', 
                                borderRadius: '8px', 
                                background: 'var(--color-surface-2)', 
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                maxWidth: '300px',
                                transition: 'border-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        />
                    </div>
                </div>

                {/* Data Table Section */}
                {excelData.length > 0 && (
                    <div style={{ 
                        background: 'var(--color-surface)', 
                        borderRadius: '12px', 
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        
                        {/* Action Bar */}
                        <div style={{ 
                            padding: '20px 24px', 
                            borderBottom: '1px solid var(--color-border)',
                            background: 'var(--color-surface-2)',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            flexWrap: 'wrap', 
                            gap: '16px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>{fileName}</span>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', background: '#e2e8f0', padding: '4px 10px', borderRadius: '6px' }}>
                                            {excelData.length} total
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '4px 10px', borderRadius: '6px' }}>
                                            ✓ {matchCount} match
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '4px 10px', borderRadius: '6px' }}>
                                            ✗ {mismatchCount} mismatch
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', background: '#dbeafe', padding: '4px 10px', borderRadius: '6px' }}>
                                            {completedCount}/{excelData.length} done
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Progress Bar */}
                                <div style={{ width: '220px', marginLeft: '10px' }}>
                                    <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${progress}%`, 
                                            background: 'linear-gradient(90deg, #3b82f6, #2563eb)', 
                                            height: '100%', 
                                            transition: 'width 0.3s ease',
                                            borderRadius: '8px'
                                        }}></div>
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: '4px', display: 'block', textAlign: 'right' }}>{progress}% Complete</span>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {!isProcessing || isPaused ? (
                                    <button 
                                        onClick={processImages} 
                                        style={{ 
                                            padding: '10px 20px', 
                                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '8px', 
                                            cursor: 'pointer', 
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                                            transition: 'transform 0.1s'
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {progress > 0 && progress < 100 ? '▶ Resume' : '🚀 Start Validation'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={togglePause} 
                                        style={{ 
                                            padding: '10px 20px', 
                                            background: '#f59e0b', 
                                            color: '#fff', 
                                            border: 'none', 
                                            borderRadius: '8px', 
                                            cursor: 'pointer', 
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
                                        }}
                                    >
                                        ⏸ Pause
                                    </button>
                                )}
                                
                                <button 
                                    onClick={handleExport}
                                    style={{ 
                                        padding: '10px 20px', 
                                        background: '#10b981', 
                                        color: '#ffffff', 
                                        border: 'none', 
                                        borderRadius: '8px', 
                                        cursor: 'pointer', 
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                    }}
                                >
                                    📥 Export Excel
                                </button>
                            </div>
                        </div>
                        
                        {/* Table */}
                        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                            <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ background: 'var(--color-surface-2)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--color-surface-2)', zIndex: 12 }}>#</th>
                                        {originalColumns.map((col, i) => {
                                            const isSticky = i === 0;
                                            return (
                                                <th key={col} style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: isSticky ? 'sticky' : 'static', left: isSticky ? '50px' : 'auto', background: isSticky ? '#f1f5f9' : 'transparent', zIndex: isSticky ? 11 : 'auto', boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none' }}>
                                                    {col}
                                                </th>
                                            );
                                        })}
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Extracted VIN</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Geo Location</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Match</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelData.map((row, index) => {
                                        const geo = row.geoLocation;
                                        return (
                                            <tr key={index} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8fafc'}>
                                                <td style={{ padding: '12px 20px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 500, position: 'sticky', left: 0, background: 'inherit', zIndex: 2 }}>{index + 1}</td>
                                                {originalColumns.map((col, colIndex) => {
                                                    const value = row[col];
                                                    const isValidDrive = isDriveLink(value);
                                                    const isSticky = colIndex === 0;
                                                    return (
                                                        <td key={col} style={{ padding: '12px 20px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: isSticky ? 'sticky' : 'static', left: isSticky ? '50px' : 'auto', background: 'inherit', zIndex: isSticky ? 2 : 'auto', boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.02)' : 'none' }}>
                                                            {isValidDrive ? (
                                                                <a href={value as string} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                                    Drive Image
                                                                </a>
                                                            ) : (
                                                                <span style={{ fontWeight: 600, color: 'var(--color-text)', fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>{value}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                
                                                {/* Extracted VIN */}
                                                <td style={{ padding: '12px 20px' }}>
                                                    {(() => {
                                                        const isUnclear = !row.extractedVin || ['-', 'N/A', 'No text found', 'No VIN detected', 'Error API', 'Error Fetch'].includes(row.extractedVin);
                                                        if (isUnclear) {
                                                            return (
                                                                <span style={{ 
                                                                    padding: '4px 10px', 
                                                                    borderRadius: '6px', 
                                                                    fontSize: '12px',
                                                                    fontWeight: 700,
                                                                    background: 'var(--color-danger-bg)',
                                                                    color: 'var(--color-danger)',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    Not Clear
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span style={{ 
                                                                fontFamily: "'JetBrains Mono', monospace", 
                                                                fontWeight: 700, 
                                                                fontSize: '14px', 
                                                                color: '#0ea5e9',
                                                                background: '#f0f9ff',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                {row.extractedVin}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Geo Location */}
                                                <td style={{ padding: '12px 20px', minWidth: '220px' }}>
                                                    {geo && (geo.latitude || geo.location || geo.dateTime) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                                                            {geo.latitude && geo.longitude && (
                                                                <span style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    📍 {geo.latitude}, {geo.longitude}
                                                                </span>
                                                            )}
                                                            {geo.dateTime && (
                                                                <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    🕒 {geo.dateTime}
                                                                </span>
                                                            )}
                                                            {geo.location && (
                                                                <span style={{ color: 'var(--color-text)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }} title={geo.location}>
                                                                    🗺️ {geo.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : geo?.watermarkText ? (
                                                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{geo.watermarkText.substring(0, 60)}...</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-dim)' }}>—</span>
                                                    )}
                                                </td>

                                                {/* Match */}
                                                <td style={{ padding: '12px 20px' }}>
                                                    <span style={{ 
                                                        padding: '4px 10px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        background: row.isMatch === 'Match' ? '#d1fae5' : row.isMatch === 'Mismatch' ? '#fee2e2' : '#f1f5f9',
                                                        color: row.isMatch === 'Match' ? '#059669' : row.isMatch === 'Mismatch' ? '#dc2626' : '#64748b',
                                                        display: 'inline-block'
                                                    }}>
                                                        {row.isMatch === 'Match' ? '✓ MATCH' : row.isMatch === 'Mismatch' ? '✗ MISMATCH' : row.isMatch}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600 }}>
                                                    {row.status === 'Processing' && <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>⚙ Reading...</span>}
                                                    {row.status === 'Complete' && <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ Done</span>}
                                                    {row.status === 'Error' && <span style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠ Error</span>}
                                                    {row.status === 'Pending' && <span style={{ color: 'var(--color-text-dim)' }}>⏳ Pending</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
                )}

                {activeTab === 'Validator' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Upload Card */}
                        <div style={{ 
                            background: 'var(--color-surface)', 
                            padding: '20px 24px', 
                            borderRadius: '12px', 
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-md)',
                            width: 'fit-content',
                            maxWidth: '100%'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                        🛡️ Upload Validation Matrix Excel
                                    </h3>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                        Upload a generic Excel file to view it in the validator matrix format.
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleValidatorFileUpload}
                                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                    style={{ 
                                        padding: '10px 16px', 
                                        border: '2px dashed var(--color-border-light)', 
                                        borderRadius: '8px', 
                                        background: 'var(--color-surface-2)', 
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        maxWidth: '300px',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        {valIsLoading && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
                                <h3 style={{ margin: 0, fontWeight: 600 }}>Parsing Matrix...</h3>
                            </div>
                        )}

                        {valData.length > 0 && !valIsLoading && (
                            <div style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
                                    <div>
                                        <h4 style={{ margin: 0, color: 'var(--color-text)' }}>Parsed Validation Matrix ({valData.length} records)</h4>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>All rows and components successfully extracted.</p>
                                    </div>
                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Search all columns..." 
                                                value={valSearchText}
                                                onChange={e => { setValSearchText(e.target.value); setValCurrentPage(1); }}
                                                style={{
                                                    padding: '10px 14px 10px 36px',
                                                    border: '1px solid var(--color-border-light)',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    fontFamily: 'Inter, Poppins, sans-serif',
                                                    width: '240px',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                    color: 'var(--color-text)'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#3b82f6';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = '#cbd5e1';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            />
                                            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>

                                        <button 
                                            onClick={handleValDownload}
                                            style={{
                                                padding: '10px 16px', background: '#10b981', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#ffffff', display: 'flex', gap: '8px', alignItems: 'center', fontFamily: 'Inter, Poppins, sans-serif', transition: 'background-color 0.2s, transform 0.1s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Export Excel
                                        </button>
                                        
                                        {/* Column Filter Toggle */}
                                        <div style={{ position: 'relative' }}>
                                            <button 
                                                onClick={() => setShowValColumnFilter(!showValColumnFilter)}
                                                style={{
                                                    padding: '10px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', gap: '8px', alignItems: 'center', fontFamily: 'Inter, Poppins, sans-serif', transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                            >
                                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                Columns
                                            </button>
                                            
                                            {showValColumnFilter && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', padding: '16px', width: '320px', zIndex: 50, maxHeight: '350px', overflowY: 'auto'
                                                }}>
                                                    <h5 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>Visible Columns</h5>
                                                    {valColumns.map(col => (
                                                        <div key={col} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                            <input 
                                                                id={`val-col-chk-${col}`}
                                                                type="checkbox" 
                                                                checked={valVisibleCols[col]} 
                                                                onChange={() => setValVisibleCols(prev => ({ ...prev, [col]: !prev[col] }))}
                                                                style={{ marginTop: '2px', marginRight: '8px', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                                                            />
                                                            <label htmlFor={`val-col-chk-${col}`} style={{ color: 'var(--color-text)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', margin: 0, padding: 0 }}>
                                                                {col}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 450px)', width: '100%', WebkitOverflowScrolling: 'touch', willChange: 'transform' }}>
                                    <table style={{ width: 'max-content', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                        <thead style={{ background: 'var(--color-surface-2)', position: 'sticky', top: 0, zIndex: 10 }}>
                                            <tr>
                                                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', width: '50px' }}>#</th>
                                                {valColumns.map((col, idx) => (
                                                    valVisibleCols[col] ? (
                                                        <th key={idx} style={{ 
                                                            padding: '6px 12px', 
                                                            textAlign: 'left', 
                                                            color: col.startsWith('Extracted') ? '#047857' : '#334155', 
                                                            background: col.startsWith('Extracted') ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                                                            border: '1px solid var(--color-border-light)', 
                                                            width: col.startsWith('Extracted') ? '120px' : '200px', 
                                                            overflow: 'hidden', 
                                                            textOverflow: 'ellipsis' 
                                                        }}>
                                                            {col}
                                                        </th>
                                                    ) : null
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const filteredData = valData.filter(row => 
                                                    Object.values(row).some(val => 
                                                        String(val).toLowerCase().includes(valSearchText.toLowerCase())
                                                    )
                                                );
                                                return filteredData.slice((valCurrentPage - 1) * 50, valCurrentPage * 50).map((row, i) => (
                                                    <tr key={(valCurrentPage - 1) * 50 + i} style={{ borderBottom: '1px solid var(--color-border-light)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                                                        <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}>{(valCurrentPage - 1) * 50 + i + 1}</td>
                                                        {valColumns.map((col, j) => (
                                                            valVisibleCols[col] ? (
                                                                <td key={j} style={{ 
                                                                    padding: '6px 12px', 
                                                                    color: col.startsWith('Extracted') ? '#065f46' : '#1e293b', 
                                                                    background: col.startsWith('Extracted') ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
                                                                    fontWeight: col.startsWith('Extracted') ? 600 : 400,
                                                                    whiteSpace: 'nowrap', 
                                                                    overflow: 'hidden', 
                                                                    textOverflow: 'ellipsis', 
                                                                    border: '1px solid var(--color-border-light)' 
                                                                }}>
                                                                    {row[col]}
                                                                </td>
                                                            ) : null
                                                        ))}
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                        {(() => {
                                            const filteredData = valData.filter(row => 
                                                Object.values(row).some(val => 
                                                    String(val).toLowerCase().includes(valSearchText.toLowerCase())
                                                )
                                            );
                                            return `Showing ${(valCurrentPage - 1) * 50 + 1} to ${Math.min(valCurrentPage * 50, filteredData.length)} of ${filteredData.length} records`;
                                        })()}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            disabled={valCurrentPage === 1} 
                                            onClick={() => setValCurrentPage(p => Math.max(1, p - 1))}
                                            style={{ padding: '6px 16px', background: valCurrentPage === 1 ? '#f1f5f9' : '#ffffff', color: valCurrentPage === 1 ? '#94a3b8' : '#0f172a', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: valCurrentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            disabled={(() => {
                                                const filteredData = valData.filter(row => 
                                                    Object.values(row).some(val => 
                                                        String(val).toLowerCase().includes(valSearchText.toLowerCase())
                                                    )
                                                );
                                                return valCurrentPage * 50 >= filteredData.length;
                                            })()}
                                            onClick={() => setValCurrentPage(p => p + 1)}
                                            style={{ padding: '6px 16px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Questionnaire Validation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Upload Card */}
                        <div style={{ 
                            background: 'var(--color-surface)', 
                            padding: '20px 24px', 
                            borderRadius: '12px', 
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-md)',
                            width: 'fit-content',
                            maxWidth: '100%'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                                        📋 Upload Questionnaire (NPS TGW) Excel
                                    </h3>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                        Upload the questionnaire mapping file to visualize the hierarchy and validate structure.
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleQuestFileUpload}
                                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                    style={{ 
                                        padding: '10px 16px', 
                                        border: '2px dashed var(--color-border-light)', 
                                        borderRadius: '8px', 
                                        background: 'var(--color-surface-2)', 
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        maxWidth: '300px',
                                        transition: 'border-color 0.2s'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Error State */}
                        {questError && (
                            <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>⚠️</span>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>Format Mismatch</h4>
                                    <p style={{ margin: 0, fontSize: '13px' }}>{questError}</p>
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        {questIsLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⏳</div>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--color-text)' }}>Parsing Excel File...</h3>
                                <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Processing rows and analyzing structure.</p>
                            </div>
                        )}

                        {/* Extracted Data Table */}
                        {!questIsLoading && questData.length > 0 && (
                            <div style={{ 
                                background: 'var(--color-surface)', 
                                borderRadius: '12px', 
                                border: '1px solid var(--color-border)',
                                boxShadow: 'var(--shadow-md)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={{ position: 'relative', zIndex: 100, padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                                    <div>
                                        <h4 style={{ margin: 0, color: 'var(--color-text)' }}>Parsed Questionnaire Matrix ({questData.length} records)</h4>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>All rows and components successfully extracted.</p>
                                    </div>
                                    
                                    {/* Column Filter Toggle */}
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            onClick={() => setShowColumnFilter(!showColumnFilter)}
                                            style={{
                                                padding: '8px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', gap: '8px', alignItems: 'center'
                                            }}
                                        >
                                            ⚙️ Select Columns
                                        </button>
                                        
                                        {showColumnFilter && (
                                            <div style={{
                                                position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', padding: '16px', width: '320px', zIndex: 50, maxHeight: '350px', overflowY: 'auto'
                                            }}>
                                                <h5 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>Visible Columns</h5>
                                                {questColumns.map(col => (
                                                    <div key={col} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                        <input 
                                                            id={`col-chk-${col}`}
                                                            type="checkbox" 
                                                            checked={questVisibleCols[col]} 
                                                            onChange={() => setQuestVisibleCols(prev => ({ ...prev, [col]: !prev[col] }))}
                                                            style={{ marginTop: '2px', marginRight: '8px', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                                                        />
                                                        <label htmlFor={`col-chk-${col}`} style={{ color: 'var(--color-text)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', margin: 0, padding: 0 }}>
                                                            {col}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 450px)', width: '100%', WebkitOverflowScrolling: 'touch', willChange: 'transform' }}>
                                    <table style={{ width: 'max-content', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                        <thead style={{ background: 'var(--color-surface-2)', position: 'sticky', top: 0, zIndex: 10 }}>
                                            <tr>
                                                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', width: '50px' }}>#</th>
                                                {questColumns.map((col, idx) => (
                                                    questVisibleCols[col] ? (
                                                        <th key={idx} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', width: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {col}
                                                        </th>
                                                    ) : null
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {questData.slice((questCurrentPage - 1) * 50, questCurrentPage * 50).map((row, i) => (
                                                <tr key={(questCurrentPage - 1) * 50 + i} style={{ borderBottom: '1px solid var(--color-border-light)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                                                    <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}>{(questCurrentPage - 1) * 50 + i + 1}</td>
                                                    {questColumns.map((col, j) => {
                                                        const globalRowIdx = (questCurrentPage - 1) * 50 + i;
                                                        const isEditing = editingCell?.rowIndex === globalRowIdx && editingCell?.colName === col;
                                                        return questVisibleCols[col] ? (
                                                            <td key={j} id={`cell-${globalRowIdx}-${col.replace(/\s+/g, '-')}`} style={{ padding: '6px 12px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid var(--color-border-light)' }}>
                                                                {isEditing ? (
                                                                    <select 
                                                                        autoFocus
                                                                        value={row[col]}
                                                                        onChange={(e) => {
                                                                            const newData = [...questData];
                                                                            newData[globalRowIdx][col] = e.target.value;
                                                                            const matrixStart = questColumns.indexOf('Accepted') + 2;
                                                                            const v = validateRowData(newData[globalRowIdx], questColumns, matrixStart);
                                                                            newData[globalRowIdx]['Accepted'] = v.Accepted;
                                                                            newData[globalRowIdx]['Rejected'] = v.Rejected;
                                                                            setQuestData(newData);
                                                                        }}
                                                                        onBlur={() => setEditingCell(null)}
                                                                        style={{ width: '100%', padding: '2px 4px', border: '2px solid #2563eb', borderRadius: '2px', fontFamily: 'Calibri, Arial, sans-serif' }}
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        <option value="Noise Issue">Noise Issue</option>
                                                                        <option value="Vibration">Vibration</option>
                                                                        <option value="Poor Performance">Poor Performance</option>
                                                                        <option value="N/A">N/A</option>
                                                                    </select>
                                                                ) : col === 'Rejected' && row[col] ? (
                                                                    <button 
                                                                        title={`Missing: ${row[col]}`}
                                                                        onClick={() => {
                                                                            setEditingCell({ rowIndex: globalRowIdx, colName: row[col] });
                                                                            setTimeout(() => {
                                                                                const el = document.getElementById(`cell-${globalRowIdx}-${row[col].replace(/\s+/g, '-')}`);
                                                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                                                            }, 50);
                                                                        }}
                                                                        style={{ padding: '6px 12px', background: 'var(--color-danger-bg)', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                    >
                                                                        Rejected <span style={{ fontSize: '14px' }}>ℹ️</span>
                                                                    </button>
                                                                ) : col === 'Accepted' && row[col] ? (
                                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>{row[col]}</span>
                                                                ) : (
                                                                    row[col]
                                                                )}
                                                            </td>
                                                        ) : null
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                        Showing {(questCurrentPage - 1) * 50 + 1} to {Math.min(questCurrentPage * 50, questData.length)} of {questData.length} records
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            disabled={questCurrentPage === 1} 
                                            onClick={() => setQuestCurrentPage(p => Math.max(1, p - 1))}
                                            style={{ padding: '6px 16px', background: questCurrentPage === 1 ? '#f1f5f9' : '#ffffff', color: questCurrentPage === 1 ? '#94a3b8' : '#0f172a', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: questCurrentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            disabled={questCurrentPage === Math.ceil(questData.length / 50) || questData.length === 0} 
                                            onClick={() => setQuestCurrentPage(p => Math.min(Math.ceil(questData.length / 50), p + 1))}
                                            style={{ padding: '6px 16px', background: (questCurrentPage === Math.ceil(questData.length / 50) || questData.length === 0) ? '#f1f5f9' : '#ffffff', color: (questCurrentPage === Math.ceil(questData.length / 50) || questData.length === 0) ? '#94a3b8' : '#0f172a', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: (questCurrentPage === Math.ceil(questData.length / 50) || questData.length === 0) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </main>
        </div>
    );
};

export default AdminDashboard;
