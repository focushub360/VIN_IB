import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { API_URL } from './api';
import {
    BarChart3,
    Download,
    Sparkles,
    Search,
    SlidersHorizontal,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    UploadCloud,
    Square,
    Layers,
    RotateCcw
} from 'lucide-react';

import {
    GUINEA_COLUMNS_449,
    getExcelColumnLetter,
    orderColumns
} from './guineaSchema';
import { SAMPLE_EXTRACTED_PDF_ROWS } from './sampleGuineaData';

const DESIRED_COLUMN_ORDER = GUINEA_COLUMNS_449;

interface BatchProgress {
    isActive: boolean;
    current: number;
    total: number;
    percent: number;
    label: string;
    stopped: boolean;
}

interface LiveStats {
    processed: number;
    promoters: number;
    passives: number;
    detractors: number;
    netNps: number;
    matchRate: number;
}

const NpsAnalyzer: React.FC = () => {
    const [data, setData] = useState<any[]>(() => {
        try {
            const saved = sessionStorage.getItem('fe_vin_nps_data');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [columns, setColumns] = useState<string[]>(() => {
        try {
            const saved = sessionStorage.getItem('fe_vin_nps_cols');
            return saved ? JSON.parse(saved) : GUINEA_COLUMNS_449;
        } catch {
            return GUINEA_COLUMNS_449;
        }
    });
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
        try {
            const saved = sessionStorage.getItem('fe_vin_nps_vis_cols');
            if (saved) return JSON.parse(saved);
        } catch {}
        const init: Record<string, boolean> = {};
        GUINEA_COLUMNS_449.forEach(c => { init[c] = true; });
        return init;
    });
    const [showColumnFilter, setShowColumnFilter] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchText, setSearchText] = useState('');
    const [fileName, setFileName] = useState<string>(() => {
        try {
            return sessionStorage.getItem('fe_vin_nps_filename') || '';
        } catch {
            return '';
        }
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dossierMode, setDossierMode] = useState<'file' | 'dossier-4' | 'page'>('file');
    const [isUploadExpanded, setIsUploadExpanded] = useState<boolean>(false);

    // Live Streaming Progress State
    const [progress, setProgress] = useState<BatchProgress>({
        isActive: false,
        current: 0,
        total: 0,
        percent: 0,
        label: '',
        stopped: false
    });

    const [liveStats, setLiveStats] = useState<LiveStats>(() => {
        try {
            const saved = sessionStorage.getItem('fe_vin_nps_stats');
            return saved ? JSON.parse(saved) : {
                processed: 0,
                promoters: 0,
                passives: 0,
                detractors: 0,
                netNps: 0,
                matchRate: 100
            };
        } catch {
            return {
                processed: 0,
                promoters: 0,
                passives: 0,
                detractors: 0,
                netNps: 0,
                matchRate: 100
            };
        }
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const isSyncingScrollRef = useRef<boolean>(false);
    const [tableScrollWidth, setTableScrollWidth] = useState<number>(100000);

    const updateScrollSync = () => {
        if (!tableContainerRef.current || isSyncingScrollRef.current) return;
        isSyncingScrollRef.current = true;
        const { scrollLeft, scrollWidth } = tableContainerRef.current;
        if (topScrollRef.current) {
            topScrollRef.current.scrollLeft = scrollLeft;
        }
        if (Math.abs(tableScrollWidth - scrollWidth) > 50) {
            setTableScrollWidth(scrollWidth);
        }
        requestAnimationFrame(() => {
            isSyncingScrollRef.current = false;
        });
    };

    const handleTopScroll = () => {
        if (!tableContainerRef.current || !topScrollRef.current || isSyncingScrollRef.current) return;
        isSyncingScrollRef.current = true;
        tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        requestAnimationFrame(() => {
            isSyncingScrollRef.current = false;
        });
    };

    const scrollHorizontal = (amount: number) => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const updateWidth = () => {
            if (tableContainerRef.current) {
                const width = tableContainerRef.current.scrollWidth;
                setTableScrollWidth(width);
                if (topScrollRef.current) {
                    topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
                }
            }
        };
        const timer = setTimeout(updateWidth, 100);
        return () => clearTimeout(timer);
    }, [data, columns, visibleCols]);

    // Automatically persist analyzed data to sessionStorage so switching tabs or page reloads never lose progress
    useEffect(() => {
        try {
            if (data.length > 0) {
                sessionStorage.setItem('fe_vin_nps_data', JSON.stringify(data));
                sessionStorage.setItem('fe_vin_nps_cols', JSON.stringify(columns));
                sessionStorage.setItem('fe_vin_nps_vis_cols', JSON.stringify(visibleCols));
                sessionStorage.setItem('fe_vin_nps_filename', fileName);
                sessionStorage.setItem('fe_vin_nps_stats', JSON.stringify(liveStats));
            } else {
                sessionStorage.removeItem('fe_vin_nps_data');
                sessionStorage.removeItem('fe_vin_nps_cols');
                sessionStorage.removeItem('fe_vin_nps_vis_cols');
                sessionStorage.removeItem('fe_vin_nps_filename');
                sessionStorage.removeItem('fe_vin_nps_stats');
            }
        } catch (e) {
            console.warn('sessionStorage write error', e);
        }
    }, [data, columns, visibleCols, fileName, liveStats]);

    // Stop / Halt active analysis
    const handleStopAnalysis = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setProgress(prev => ({
            ...prev,
            isActive: false,
            stopped: true,
            label: `Analysis paused by user (${data.length} records preserved)`
        }));
    };

    // Clear current analysis
    const handleClear = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        try {
            sessionStorage.removeItem('fe_vin_nps_data');
            sessionStorage.removeItem('fe_vin_nps_cols');
            sessionStorage.removeItem('fe_vin_nps_vis_cols');
            sessionStorage.removeItem('fe_vin_nps_filename');
            sessionStorage.removeItem('fe_vin_nps_stats');
        } catch (e) {
            console.warn('sessionStorage remove error', e);
        }
        setData([]);
        setColumns(GUINEA_COLUMNS_449);
        const initVis: Record<string, boolean> = {};
        GUINEA_COLUMNS_449.forEach(c => { initVis[c] = true; });
        setVisibleCols(initVis);
        setIsLoading(false);
        setError('');
        setFileName('');
        setIsUploadExpanded(false);
        setProgress({
            isActive: false,
            current: 0,
            total: 0,
            percent: 0,
            label: '',
            stopped: false
        });
        setLiveStats({
            processed: 0,
            promoters: 0,
            passives: 0,
            detractors: 0,
            netNps: 0,
            matchRate: 100
        });
    };

    // Real-Time Batch Streaming Processor (handles single PDF with 100 pages, multiple PDFs, or ZIP)
    const processFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files).filter(f => {
            const name = f.name.toLowerCase();
            return name.endsWith('.pdf') || name.endsWith('.zip');
        });

        if (fileList.length === 0) {
            setError('Please upload valid PDF (.pdf) or ZIP archive (.zip) documents.');
            return;
        }

        // Abort any ongoing run
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError('');
        setData([]);
        setColumns([]);
        setCurrentPage(1);
        setFileName(fileList.length === 1 ? fileList[0].name : `${fileList.length} files selected (Batch)`);

        setProgress({
            isActive: true,
            current: 0,
            total: 0,
            percent: 0,
            label: `Preparing ${fileList.length} file(s) for extraction...`,
            stopped: false
        });

        setLiveStats({
            processed: 0,
            promoters: 0,
            passives: 0,
            detractors: 0,
            netNps: 0,
            matchRate: 100
        });

        const formData = new FormData();
        fileList.forEach(file => {
            formData.append('files', file);
        });
        formData.append('mode', dossierMode);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/analyze-pdf-stream`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: formData,
                signal: controller.signal
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server returned status ${response.status}: ${text || 'Analysis failed'}`);
            }

            if (!response.body) {
                throw new Error('Readable stream not supported by server');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            let initializedCols = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const evtBlock of events) {
                    if (!evtBlock.trim()) continue;
                    const lines = evtBlock.split('\n');
                    let eventType = '';
                    let dataStr = '';

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            dataStr += line.slice(6);
                        }
                    }

                    if (!dataStr) continue;

                    try {
                        const payload = JSON.parse(dataStr);

                        if (eventType === 'init') {
                            setProgress(prev => ({
                                ...prev,
                                total: payload.total,
                                label: `Detected ${payload.total} records. Beginning analysis 1-by-1...`
                            }));
                        } else if (eventType === 'record') {
                            const newRow = payload.row;
                            setData(prev => {
                                const updated = [...prev, newRow];
                                if (!initializedCols && newRow) {
                                    setColumns(GUINEA_COLUMNS_449);
                                    const colVisInit: Record<string, boolean> = {};
                                    GUINEA_COLUMNS_449.forEach(c => { colVisInit[c] = true; });
                                    setVisibleCols(colVisInit);
                                    initializedCols = true;
                                }
                                return updated;
                            });

                            setProgress({
                                isActive: true,
                                current: payload.index,
                                total: payload.total,
                                percent: Math.round((payload.index / payload.total) * 100),
                                label: `Analyzing Record ${payload.index} of ${payload.total}: ${payload.label || ''}`,
                                stopped: false
                            });

                            if (payload.stats) {
                                setLiveStats(payload.stats);
                            }
                        } else if (eventType === 'done') {
                            setProgress(prev => ({
                                ...prev,
                                isActive: false,
                                current: payload.processed,
                                total: payload.total,
                                percent: 100,
                                label: `Completed! Successfully extracted all ${payload.processed} records.`,
                                stopped: false
                            }));
                            setColumns(GUINEA_COLUMNS_449);
                            const colVisInit: Record<string, boolean> = {};
                            GUINEA_COLUMNS_449.forEach((c: string) => { colVisInit[c] = true; });
                            setVisibleCols(colVisInit);
                            if (payload.stats) {
                                setLiveStats(payload.stats);
                            }
                            setIsLoading(false);
                        } else if (eventType === 'error') {
                            setError(payload.error || 'Batch analysis error occurred.');
                            setIsLoading(false);
                        }
                    } catch (parseErr) {
                        console.warn('Could not parse SSE chunk JSON:', parseErr);
                    }
                }
            }

            setIsLoading(false);
            setProgress(prev => ({ ...prev, isActive: false }));
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Batch stream aborted by user');
                return;
            }
            console.error('Batch stream failed:', err);
            setError(err.message || 'Analysis encountered a network error.');
            setIsLoading(false);
            setProgress(prev => ({ ...prev, isActive: false, label: 'Analysis failed' }));
        } finally {
            abortControllerRef.current = null;
        }
    };

    // Quick Sample Loader (10 Records)
    const handleLoadSample = () => {
        setIsLoading(true);
        setError('');
        setTimeout(() => {
            setColumns(GUINEA_COLUMNS_449);
            setData(SAMPLE_EXTRACTED_PDF_ROWS);
            const colVisInit: Record<string, boolean> = {};
            GUINEA_COLUMNS_449.forEach(c => { colVisInit[c] = true; });
            setVisibleCols(colVisInit);
            setFileName('GUINEA_RAW_DATA.xlsx');
            setIsLoading(false);
            setCurrentPage(1);
            setLiveStats({
                processed: 10,
                promoters: 5,
                passives: 2,
                detractors: 3,
                netNps: 20,
                matchRate: 100
            });
            setProgress({
                isActive: false,
                current: 10,
                total: 10,
                percent: 100,
                label: 'Sample demo batch loaded (10 records)',
                stopped: false
            });
        }, 300);
    };

    // 100 Records Demo Simulator (Simulates the live 1-by-1 streaming for 100 records)
    const handleSimulate100Records = () => {
        if (isLoading) return;
        setIsLoading(true);
        setError('');
        setData([]);
        setCurrentPage(1);
        setFileName('Simulated_100_Surveys_Batch.pdf');

        const totalSim = 100;
        const models = ['Xtreme 160R', 'Raider 125', 'Harrier XZ+', 'Safari Dark Edition', 'Curvv EV', 'Punch.ev', 'Glamour', 'Apache RTR', 'Pulsar N160', 'Shine 125'];
        const brands = ['Hero', 'TVS', 'Tata', 'Honda', 'Bajaj'];
        const locations = ['Colombo', 'Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kandy'];

        setColumns(GUINEA_COLUMNS_449);
        const colVisInit: Record<string, boolean> = {};
        GUINEA_COLUMNS_449.forEach(c => { colVisInit[c] = true; });
        setVisibleCols(colVisInit);

        setProgress({
            isActive: true,
            current: 0,
            total: totalSim,
            percent: 0,
            label: 'Starting simulated 1-by-1 analysis of 100 records...',
            stopped: false
        });

        let currentIdx = 0;
        let pCount = 0;
        let passCount = 0;
        let dCount = 0;

        const surveyLocations = ['Conakry', 'Sangaredi', 'Kankan', 'Kindia', 'Boké'];
        const surveyors = ['Moussa', 'Tènè Diarra'];
        const vehicleModels = ['TVS HLX 125', 'Bajaj CT 125', 'TVS Star HLX', 'Yamaha Crux'];
        const userNames = ['Oury diallo', 'Ousmane sangare', 'Djiré Sy', 'Baba Yara', 'Badjan diabate', 'Badrissa toukara', 'Jean paul doucoure', 'Samba si', 'Bouba Sow'];
        const professions = ['Driver', 'Business', 'Teacher', 'Mechanician', 'Doctor', 'Trader'];

        const interval = setInterval(() => {
            currentIdx++;
            const score = currentIdx % 5 === 0 ? 4 : currentIdx % 4 === 0 ? 8 : currentIdx % 3 === 0 ? 9 : 10;
            const sentiment = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
            if (sentiment === 'Promoter') pCount++;
            else if (sentiment === 'Passive') passCount++;
            else dCount++;

            const model = vehicleModels[currentIdx % vehicleModels.length];
            const loc = surveyLocations[currentIdx % surveyLocations.length];
            const surveyor = surveyors[currentIdx % surveyors.length];
            const uName = userNames[currentIdx % userNames.length];
            const prof = professions[currentIdx % professions.length];
            const isMatch = currentIdx % 15 !== 0;

            const simRow = {
                '#': currentIdx,
                'Timestamp': `19-08-2026 19:${String(currentIdx % 60).padStart(2, '0')}`,
                'SURVEY DATE': `19-Aug-26`,
                'SURVEYOR NAME': surveyor,
                'SURVEY LOCATION': loc,
                'BRAND & MODEL (Qualifying Question)': model,
                'VIN No. (Qualifying Question)': `MD625AF48S1A${String(30000 + currentIdx)}`,
                'VIN Match Status': isMatch ? '✅ Match' : '❌ Mismatch',
                'Please take a picture of the VIN no. and upload it here. (Qualifying Question)': `https://drive.google.com/open?id=1SampleDriveFile${currentIdx}`,
                'ODOMETER READING (Kms)': `${(12000 + currentIdx * 820) % 75000}`,
                'MODE OF PURCHASE': currentIdx % 3 === 0 ? 'Secondhand' : 'New',
                'DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER': '29-Mar-26',
                'USER NAME': `${uName} #${currentIdx}`,
                'USER AGE (YEARS) (enter only a full number between 18 to 60)': 20 + (currentIdx % 25),
                'USER AGE GROUP': currentIdx % 2 === 0 ? '20-30' : '30-40',
                'USER PROFESSION': prof,
                'MOBILE NUMBER': `6${String(20000000 + currentIdx * 4921).substring(0, 8)}`,
                'ALTERNATE MOBILE NUMBER': '—',
                'OWNERSHIP (OWN / HIRED)': currentIdx % 4 === 0 ? 'Rented' : 'Own',
                'FOR WHAT PURPOSE DO YOU USE THE VEHICLE?': currentIdx % 2 === 0 ? 'Passenger taxi' : 'Personal use',
                'MODEL YEAR OF YOUR VEHICLE': 2025,
                'HOW LONG HAVE YOU BEEN USING THIS VEHICLE?': '3-6 months ( from Feb - 2026 to Apr - 2026)',
                'PREVIOUS VEHICLE USED Brand & Model': currentIdx % 2 === 0 ? 'Jakarta' : 'Yamaha',
                'HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)': 2,
                '1. Will you recommend your vehicle to your friends / relatives / family members?': score >= 7 ? 'Yes' : 'No',
                '2. Likely to recommend vehicle (0-10)': score,
                'GPS Watermark Location': `${loc}, Guinea`,
                'GPS Coordinates': `9.6412, -13.5784`
            };

            setData(prev => [...prev, simRow]);

            const netNps = Math.round(((pCount - dCount) / currentIdx) * 100);
            setLiveStats({
                processed: currentIdx,
                promoters: pCount,
                passives: passCount,
                detractors: dCount,
                netNps,
                matchRate: Math.round(((currentIdx - Math.floor(currentIdx / 15)) / currentIdx) * 100)
            });

            setProgress({
                isActive: true,
                current: currentIdx,
                total: totalSim,
                percent: Math.round((currentIdx / totalSim) * 100),
                label: `Analyzing Record ${currentIdx} of ${totalSim}: ${simRow['Document Source']}`,
                stopped: false
            });

            if (currentIdx >= totalSim) {
                clearInterval(interval);
                setIsLoading(false);
                setProgress({
                    isActive: false,
                    current: totalSim,
                    total: totalSim,
                    percent: 100,
                    label: `Finished! Successfully extracted all ${totalSim} records one-by-one.`,
                    stopped: false
                });
            }
        }, 55);
    };

    // Download parsed matrix as Excel (.xlsx)
    const handleDownloadExcel = () => {
        if (data.length === 0) return;

        const filtered = data.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchText.toLowerCase())
            )
        );

        const activeOrderedCols = orderColumns(columns).filter(c => visibleCols[c] !== false);

        const exportData = filtered.map(row => {
            const exp: any = {};
            activeOrderedCols.forEach(c => {
                exp[c] = row[c] !== undefined ? row[c] : '';
            });
            return exp;
        });

        const ws = XLSX.utils.json_to_sheet(exportData, { header: activeOrderedCols });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RAW DATA');
        const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Data';
        XLSX.writeFile(wb, `RAW_DATA_${cleanName}.xlsx`);
    };

    // Download Sample Excel Template with full 449-column schema (RAW DATA)
    const handleDownloadTemplate = () => {
        const templateRow: Record<string, any> = {};
        GUINEA_COLUMNS_449.forEach(col => {
            templateRow[col] = '';
        });
        if (SAMPLE_EXTRACTED_PDF_ROWS && SAMPLE_EXTRACTED_PDF_ROWS[0]) {
            const { '#': _, ...sampleVals } = SAMPLE_EXTRACTED_PDF_ROWS[0];
            Object.assign(templateRow, sampleVals);
        }
        const ws = XLSX.utils.json_to_sheet([templateRow], { header: GUINEA_COLUMNS_449 });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "RAW DATA");
        XLSX.writeFile(wb, "GUINEA_RAW_DATA_TEMPLATE.xlsx");
    };

    // Filtered Rows based on search
    const filteredData = data.filter(row =>
        Object.values(row).some(val =>
            String(val).toLowerCase().includes(searchText.toLowerCase())
        )
    );

    const pageSize = 50;
    const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: data.length > 0 ? '12px' : '20px', width: '100%' }}>
            {/* Always mounted hidden file input for 100% reliable click triggering */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.zip"
                onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) processFiles(files);
                    (e.target as HTMLInputElement).value = '';
                }}
                style={{ display: 'none' }}
            />

            {/* Main AI Data Entry: Compact Header when data is loaded, Full Dropzone when empty or expanded */}
            {data.length > 0 && !isUploadExpanded ? (
                <div
                    className="glass-panel animate-fade-in"
                    style={{
                        padding: '10px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                        }}>
                            <Sparkles size={18} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text)' }}>
                                AI Data Entry & Document Parser
                            </span>
                            <span className="modern-badge modern-badge-success" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                                AI OCR v2.4
                            </span>
                            {fileName && (
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#2563eb',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    maxWidth: '320px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }} title={fileName}>
                                    📄 {fileName}
                                </span>
                            )}
                            <span className="mode-pill-btn active" style={{ padding: '3px 10px', fontSize: '11px', cursor: 'default' }}>
                                {dossierMode === 'file' ? '📁 1 Record / File' : dossierMode === 'dossier-4' ? '📑 4 Pages / Dossier' : '📄 1 Record / Page'}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            className="modern-btn modern-btn-primary"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                            title="Upload new PDF or ZIP documents"
                        >
                            <UploadCloud size={14} /> + Upload Files
                        </button>
                        <button
                            className="modern-btn modern-btn-outline"
                            onClick={handleDownloadTemplate}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            title="Download standard 449-column template"
                        >
                            <Download size={13} /> Template
                        </button>
                        <button
                            className="modern-btn modern-btn-outline"
                            onClick={() => setIsUploadExpanded(true)}
                            style={{ padding: '6px 12px', fontSize: '12px', color: '#475569' }}
                            title="Expand full upload dropzone and layout selector"
                        >
                            <ChevronDown size={14} /> Upload Area
                        </button>
                    </div>
                </div>
            ) : (
                /* Full Dropzone card (when empty OR user clicked to expand) */
                <div
                    className="glass-panel"
                    style={{
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', paddingBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                            }}>
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--color-text)' }}>
                                        AI Data Entry & Document Parser
                                    </h3>
                                    <span className="modern-badge modern-badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                        AI OCR v2.4
                                    </span>
                                </div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '12.5px', margin: '2px 0 0 0' }}>
                                    Autonomous extraction for multi-page surveys, customer feedback forms, and vehicle dossiers.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                Document Layout:
                            </span>
                            <div className="mode-pill-group">
                                <button
                                    type="button"
                                    className={`mode-pill-btn ${dossierMode === 'file' ? 'active' : ''}`}
                                    onClick={() => setDossierMode('file')}
                                >
                                    📁 1 Record / PDF File (Default)
                                </button>
                                <button
                                    type="button"
                                    className={`mode-pill-btn ${dossierMode === 'dossier-4' ? 'active' : ''}`}
                                    onClick={() => setDossierMode('dossier-4')}
                                >
                                    📑 4 Pages / Dossier
                                </button>
                                <button
                                    type="button"
                                    className={`mode-pill-btn ${dossierMode === 'page' ? 'active' : ''}`}
                                    onClick={() => setDossierMode('page')}
                                >
                                    📄 1 Record / Page
                                </button>
                            </div>

                            {data.length > 0 && (
                                <button
                                    className="modern-btn modern-btn-outline"
                                    onClick={() => setIsUploadExpanded(false)}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                    title="Collapse upload dropzone"
                                >
                                    <ChevronUp size={14} /> Collapse
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Interactive Drop Area */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const files = e.dataTransfer.files;
                            if (files && files.length > 0) processFiles(files);
                        }}
                        style={{
                            padding: '24px 20px',
                            borderRadius: '14px',
                            border: isDragging ? '2px dashed #2563eb' : '2px dashed rgba(59, 130, 246, 0.35)',
                            background: isDragging
                                ? 'rgba(239, 246, 255, 0.95)'
                                : 'linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.5) 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: '10px',
                            cursor: 'default'
                        }}
                    >
                        <div className="dropzone-icon-box" style={{ width: '44px', height: '44px', borderRadius: '12px' }}>
                            <UploadCloud size={22} />
                        </div>

                        <div>
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                                Drag & drop your PDF or ZIP files here, or click to browse
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                Handles multi-page master PDFs, individual scans, or ZIP archives
                            </div>
                        </div>

                        <button
                            type="button"
                            className="modern-btn modern-btn-primary"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ cursor: 'pointer', margin: '2px 0 0 0', padding: '9px 20px', fontSize: '13px', borderRadius: '8px' }}
                        >
                            <UploadCloud size={16} />
                            Browse PDF / ZIP File(s)
                        </button>
                    </div>

                    {/* Quick Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                            Quick demo & template options:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                className="modern-btn modern-btn-outline"
                                onClick={handleDownloadTemplate}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                                <Download size={13} /> Download Template
                            </button>
                            <button
                                className="modern-btn modern-btn-secondary"
                                onClick={handleLoadSample}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                                <Sparkles size={13} color="#8b5cf6" /> Load 10 Samples
                            </button>
                            <button
                                className="modern-btn modern-btn-outline"
                                onClick={handleSimulate100Records}
                                disabled={isLoading}
                                style={{ borderColor: '#6366f1', color: '#4f46e5', padding: '6px 12px', fontSize: '12px' }}
                            >
                                <Layers size={13} /> 100 Records Demo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="glass-panel" style={{
                    padding: '14px 18px',
                    background: 'rgba(254, 242, 242, 0.9)',
                    borderColor: 'rgba(254, 202, 202, 0.95)',
                    color: 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <AlertTriangle size={22} color="#dc2626" />
                    <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '13.5px', fontWeight: 700 }}>Analysis Alert</h4>
                        <p style={{ margin: 0, fontSize: '12.5px' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Real-time Batch Progress Dashboard - Compact Single-Line Bar */}
            {(progress.isActive || data.length > 0 || progress.stopped) && (
                <div className="batch-progress-card animate-fade-in" style={{ padding: '12px 18px', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {progress.isActive ? (
                                <span className="pulse-dot" />
                            ) : progress.stopped ? (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                            ) : (
                                <CheckCircle2 size={17} color="#059669" />
                            )}
                            <div>
                                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {progress.isActive
                                        ? `Analyzing Batch Records: ${progress.current} of ${progress.total || '...'}`
                                        : progress.stopped
                                        ? `Analysis Paused: ${data.length} records preserved`
                                        : `Batch Complete: ${data.length} record${data.length === 1 ? '' : 's'} extracted`}
                                </span>
                                {progress.label && (
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                        ({progress.label})
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Inline Compact KPIs */}
                            {data.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                        Total: <strong style={{ color: '#0f172a' }}>{data.length}</strong>
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#f0fdf4', color: '#15803d', padding: '3px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>
                                        Positive (9-10): <strong>{liveStats.promoters}</strong> ({data.length > 0 ? Math.round((liveStats.promoters / data.length) * 100) : 0}%)
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                        Neutral (7-8): <strong>{liveStats.passives}</strong>
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                                        Issues (0-6): <strong>{liveStats.detractors}</strong>
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                        Net NPS: <strong>{liveStats.netNps > 0 ? `+${liveStats.netNps}` : liveStats.netNps}</strong>
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                                        VIN Match: <strong>{liveStats.matchRate}%</strong>
                                    </span>
                                </div>
                            )}

                            {progress.isActive && (
                                <button
                                    className="modern-btn modern-btn-danger"
                                    onClick={handleStopAnalysis}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                    title="Stop analysis now"
                                >
                                    <Square size={12} /> Stop
                                </button>
                            )}

                            {data.length > 0 && (
                                <>
                                    <button
                                        className="modern-btn modern-btn-success"
                                        onClick={handleDownloadExcel}
                                        style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: 700 }}
                                        title="Download Excel spreadsheet"
                                    >
                                        <Download size={13} /> Export Excel ({data.length})
                                    </button>
                                    <button
                                        className="modern-btn modern-btn-outline"
                                        onClick={handleClear}
                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                        title="Clear all extracted records"
                                    >
                                        <RotateCcw size={12} /> Clear
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar (Visible while active or paused) */}
                    {(progress.isActive || (progress.total > 0 && progress.percent < 100)) && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                <span>Progress: {progress.current} / {progress.total} Document Records</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <div className="batch-progress-bar-bg" style={{ height: '7px' }}>
                                <div
                                    className="batch-progress-bar-fill"
                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Feature Insights Grid (Shown when no data has been loaded yet) */}
            {data.length === 0 && !isLoading && (
                <div className="feature-showcase-grid">
                    <div className="feature-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="feature-card-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                                <Layers size={20} />
                            </div>
                            <span className="modern-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '10.5px' }}>
                                High Capacity
                            </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            100+ PDF Batch Extraction
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Drop a single master PDF containing 100 survey pages, a ZIP archive, or multiple selected PDFs. Analyzes each record sequentially.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="feature-card-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
                                <Sparkles size={20} />
                            </div>
                            <span className="modern-badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', fontSize: '10.5px' }}>
                                Automated OCR
                            </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            Intelligent Field Recognition
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Automatically parses Customer details, Form VIN, Stamped Chassis VIN, NPS Scores, sentiments, and GPS metadata.
                        </p>
                    </div>

                    <div className="feature-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="feature-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                <FileSpreadsheet size={20} />
                            </div>
                            <span className="modern-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '10.5px' }}>
                                Instant XLSX
                            </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            Live Streaming & Clean Export
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Rows appear live as each page is parsed. Filter columns, search records, and export a production-ready Excel spreadsheet in 1 click.
                        </p>
                    </div>
                </div>
            )}

            {/* Extracted Data Matrix Table Card - Full Width & Height, Large Easy to Identify */}
            {data.length > 0 && (
                <div
                    className="glass-panel"
                    style={{
                        padding: 0,
                        overflow: 'hidden',
                        width: '100%',
                        border: '1px solid #cbd5e1',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)'
                    }}
                >
                    {/* Top Action Bar */}
                    <div style={{
                        position: 'relative',
                        zIndex: 40,
                        padding: '12px 18px',
                        borderBottom: '2px solid #e2e8f0',
                        background: '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                background: 'linear-gradient(135deg, #107c41 0%, #15803d 100%)',
                                color: '#ffffff',
                                padding: '5px 12px',
                                borderRadius: '7px',
                                fontWeight: 800,
                                fontSize: '12.5px',
                                boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)'
                            }}>
                                <FileSpreadsheet size={15} />
                                RAW DATA MATRIX
                            </div>
                            <span style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#475569',
                                background: '#f1f5f9',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0'
                            }}>
                                Columns A – QG ({columns.length} Total)
                            </span>
                            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                                Showing {filteredData.length} of {data.length} record{data.length === 1 ? '' : 's'}
                            </span>
                            {progress.isActive && (
                                <span className="modern-badge modern-badge-warning" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                    Streaming Live...
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Search Input */}
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={14}
                                    style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Search across all 449 columns..."
                                    value={searchText}
                                    onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                                    style={{
                                        padding: '7px 12px 7px 32px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        fontSize: '12.5px',
                                        background: '#ffffff',
                                        width: '240px',
                                        outline: 'none',
                                        color: '#0f172a'
                                    }}
                                />
                            </div>

                            {/* Select Columns Filter Toggle */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="modern-btn modern-btn-outline"
                                    onClick={() => setShowColumnFilter(!showColumnFilter)}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                >
                                    <SlidersHorizontal size={13} /> Select Columns ({orderColumns(columns).filter(c => visibleCols[c] !== false).length})
                                </button>

                                {showColumnFilter && (
                                    <div className="glass-panel" style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 8px)',
                                        right: 0,
                                        padding: '16px',
                                        width: '280px',
                                        zIndex: 50,
                                        maxHeight: '350px',
                                        overflowY: 'auto'
                                    }}>
                                        <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-text)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                                            Visible Columns
                                        </h5>
                                        {columns.map((col, idx) => {
                                            const letter = getExcelColumnLetter(col, idx);
                                            return (
                                                <div key={col} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                                                    <input
                                                        id={`nps-col-${col}`}
                                                        type="checkbox"
                                                        checked={visibleCols[col] !== false}
                                                        onChange={() => setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }))}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <label htmlFor={`nps-col-${col}`} style={{ fontSize: '12px', color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                        <span className="excel-col-badge" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                                            {letter}
                                                        </span>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={col}>
                                                            {col}
                                                        </span>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Side Scroll Quick Navigation Buttons */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                padding: '3px 8px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1'
                            }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', marginRight: '3px' }}>
                                    Scroll:
                                </span>
                                <button
                                    type="button"
                                    className="modern-btn"
                                    onClick={() => { if (tableContainerRef.current) tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' }); }}
                                    title="Scroll to Column A (Beginning)"
                                    style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                    <ChevronsLeft size={14} /> First
                                </button>
                                <button
                                    type="button"
                                    className="modern-btn"
                                    onClick={() => scrollHorizontal(-350)}
                                    title="Click to Scroll Left"
                                    style={{ padding: '4px 11px', fontSize: '12px', height: '28px', background: '#2563eb', color: '#ffffff', border: '1px solid #1d4ed8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 3px rgba(37,99,235,0.2)' }}
                                >
                                    <ChevronLeft size={16} /> Left
                                </button>
                                <button
                                    type="button"
                                    className="modern-btn"
                                    onClick={() => scrollHorizontal(350)}
                                    title="Click to Scroll Right"
                                    style={{ padding: '4px 11px', fontSize: '12px', height: '28px', background: '#2563eb', color: '#ffffff', border: '1px solid #1d4ed8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 3px rgba(37,99,235,0.2)' }}
                                >
                                    Right <ChevronRight size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="modern-btn"
                                    onClick={() => { if (tableContainerRef.current) tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' }); }}
                                    title="Scroll to Column QG (End)"
                                    style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                    End <ChevronsRight size={14} />
                                </button>
                            </div>

                            {/* Download as Excel */}
                            <button
                                className="modern-btn modern-btn-success"
                                onClick={handleDownloadExcel}
                                style={{
                                    padding: '7px 16px',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    background: '#107c41',
                                    boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)'
                                }}
                            >
                                <Download size={14} /> Download Excel (.xlsx)
                            </button>
                        </div>
                    </div>

                    {/* Top Synchronized Horizontal Scrollbar with Clickable Arrow Buttons */}
                    <div
                        style={{
                            background: '#f1f5f9',
                            borderBottom: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => scrollHorizontal(-350)}
                            title="Click Left Arrow to Scroll Left"
                            style={{
                                background: '#ffffff',
                                border: '1px solid #94a3b8',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#1e293b',
                                height: '22px',
                                fontWeight: 700,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div
                            ref={topScrollRef}
                            onScroll={handleTopScroll}
                            className="matrix-table-container"
                            style={{
                                flex: 1,
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                height: '14px',
                                lineHeight: 0
                            }}
                        >
                            <div style={{ width: `${Math.max(tableScrollWidth, 100000)}px`, height: '1px' }} />
                        </div>

                        <button
                            type="button"
                            onClick={() => scrollHorizontal(350)}
                            title="Click Right Arrow to Scroll Right"
                            style={{
                                background: '#ffffff',
                                border: '1px solid #94a3b8',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#1e293b',
                                height: '22px',
                                fontWeight: 700,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Table View Container with Floating Side Arrows & Keyboard Arrow Listener */}
                    <div style={{ position: 'relative', width: '100%' }}>
                        {/* Floating Left Arrow Button */}
                        <button
                            type="button"
                            onClick={() => scrollHorizontal(-350)}
                            title="Click or press ← to scroll left"
                            style={{
                                position: 'absolute',
                                left: '74px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 45,
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: '#ffffff',
                                border: '2px solid rgba(255, 255, 255, 0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1.12)'; e.currentTarget.style.background = '#2563eb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'; }}
                        >
                            <ChevronLeft size={20} />
                        </button>

                        {/* Floating Right Arrow Button */}
                        <button
                            type="button"
                            onClick={() => scrollHorizontal(350)}
                            title="Click or press → to scroll right"
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 45,
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: '#ffffff',
                                border: '2px solid rgba(255, 255, 255, 0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1.12)'; e.currentTarget.style.background = '#2563eb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'; }}
                        >
                            <ChevronRight size={20} />
                        </button>

                        {/* Scrollable Matrix Table */}
                        <div 
                            ref={tableContainerRef}
                            tabIndex={0}
                            onScroll={updateScrollSync}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    scrollHorizontal(350);
                                } else if (e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    scrollHorizontal(-350);
                                }
                            }}
                            className="matrix-table-container"
                            style={{
                                overflowX: 'auto',
                                overflowY: 'auto',
                                maxHeight: 'calc(100vh - 350px)',
                                minHeight: data.length <= 2 ? '140px' : '300px',
                                width: '100%',
                                WebkitOverflowScrolling: 'touch',
                                background: '#ffffff',
                                outline: 'none'
                            }}
                        >
                        <table className="excel-matrix-table">
                            <thead>
                                <tr style={{ position: 'sticky', top: 0, zIndex: 30, minHeight: '105px' }}>
                                    {/* Sticky row index header */}
                                    <th style={{
                                        position: 'sticky',
                                        left: 0,
                                        top: 0,
                                        zIndex: 40,
                                        width: '65px',
                                        minWidth: '65px',
                                        padding: 0,
                                        background: '#2e1065',
                                        color: '#f8fafc',
                                        borderRight: '2px solid #7c3aed',
                                        borderBottom: '2px solid #4c1d95',
                                        boxShadow: '3px 0 6px rgba(0, 0, 0, 0.15)',
                                        boxSizing: 'border-box',
                                        verticalAlign: 'top'
                                    }}>
                                        {/* Excel corner block */}
                                        <div style={{
                                            background: '#cbd5e1',
                                            color: '#475569',
                                            textAlign: 'center',
                                            padding: '5px 0',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            borderBottom: '1px solid #94a3b8',
                                            height: '28px',
                                            boxSizing: 'border-box',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            ◢
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#f8fafc',
                                            fontSize: '13px',
                                            fontWeight: 800,
                                            minHeight: '75px',
                                            boxSizing: 'border-box'
                                        }}>
                                            #
                                        </div>
                                    </th>
                                    {columns.map((col, idx) => {
                                        if (visibleCols[col] === false) return null;
                                        const letter = getExcelColumnLetter(col, idx);
                                        return (
                                            <th
                                                key={idx}
                                                style={{
                                                    position: 'sticky',
                                                    top: 0,
                                                    zIndex: 30,
                                                    background: '#2e1065',
                                                    borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                                                    borderBottom: '2px solid #4c1d95',
                                                    padding: 0,
                                                    minWidth: col.length > 50 ? '300px' : col.length > 25 ? '240px' : '200px',
                                                    maxWidth: '380px',
                                                    verticalAlign: 'top',
                                                    userSelect: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                {/* Big Excel Alphabet Letter Bar (Above Question) */}
                                                <div style={{
                                                    background: '#e2e8f0',
                                                    color: '#0f172a',
                                                    textAlign: 'center',
                                                    padding: '5px 0',
                                                    fontSize: '14px',
                                                    fontWeight: 800,
                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                    borderBottom: '1px solid #cbd5e1',
                                                    letterSpacing: '0.08em',
                                                    height: '28px',
                                                    boxSizing: 'border-box',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)'
                                                }}>
                                                    {letter}
                                                </div>

                                                {/* Question Content Below */}
                                                <div 
                                                    title={col}
                                                    style={{
                                                        padding: '10px 14px',
                                                        color: '#ffffff',
                                                        fontSize: '12.5px',
                                                        fontWeight: 700,
                                                        lineHeight: 1.35,
                                                        whiteSpace: 'normal',
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'break-word',
                                                        minHeight: '75px',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    {col}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '14px' }}>
                                            No records match your search filter.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((row, i) => {
                                        const globalIdx = (currentPage - 1) * pageSize + i + 1;
                                        const isEven = i % 2 === 0;
                                        return (
                                            <tr key={i} style={{ background: isEven ? '#ffffff' : '#f8fafc' }} className="excel-matrix-row">
                                                {/* Sticky left Row Index column */}
                                                <td style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 20,
                                                    background: isEven ? '#f1f5f9' : '#e2e8f0',
                                                    color: '#334155',
                                                    fontWeight: 800,
                                                    fontSize: '12.5px',
                                                    textAlign: 'center',
                                                    padding: '9px 8px',
                                                    borderRight: '2px solid #cbd5e1',
                                                    borderBottom: '1px solid #cbd5e1',
                                                    boxShadow: '3px 0 6px rgba(0, 0, 0, 0.05)',
                                                    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                                                }}>
                                                    {globalIdx}
                                                </td>
                                                {columns.map((col, j) => {
                                                    if (visibleCols[col] === false) return null;
                                                    const cellVal = row[col];
                                                    const strVal = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';

                                                    const isSentimentCol = col.toLowerCase().includes('sentiment');
                                                    const isScoreCol = col.toLowerCase().includes('score') || col.toLowerCase().includes('rating');
                                                    const isMatchCol = col.toLowerCase().includes('match status');
                                                    const isVinCol = (col.toLowerCase().includes('vin') || col.toLowerCase().includes('chassis')) && !isMatchCol;

                                                    return (
                                                        <td
                                                            key={j}
                                                            style={{
                                                                padding: '9px 14px',
                                                                fontSize: '13px',
                                                                color: '#0f172a',
                                                                borderRight: '1px solid #e2e8f0',
                                                                borderBottom: '1px solid #e2e8f0',
                                                                whiteSpace: col.toLowerCase().includes('feedback') ? 'normal' : 'nowrap',
                                                                maxWidth: col.toLowerCase().includes('feedback') ? '350px' : '260px',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                            title={strVal}
                                                        >
                                                            {isMatchCol && strVal ? (() => {
                                                                const isMatch = strVal.toLowerCase().includes('match') && !strVal.toLowerCase().includes('mismatch') && !strVal.toLowerCase().includes('unmatch');
                                                                const labelText = isMatch ? 'Match' : strVal.toLowerCase().includes('unmatch') ? 'Unmatched' : 'Mismatch';
                                                                return (
                                                                    <span
                                                                        className={`modern-badge ${isMatch ? 'modern-badge-success' : 'modern-badge-danger'}`}
                                                                        style={{ gap: '6px' }}
                                                                    >
                                                                        {isMatch ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                                                        {labelText}
                                                                    </span>
                                                                );
                                                            })() : isSentimentCol && strVal ? (
                                                                <span
                                                                    className={`modern-badge ${strVal.toLowerCase().includes('promoter') ? 'modern-badge-success' : strVal.toLowerCase().includes('passive') ? 'modern-badge-warning' : 'modern-badge-danger'}`}
                                                                >
                                                                    {strVal}
                                                                </span>
                                                            ) : isScoreCol && strVal !== '' && !isNaN(Number(strVal)) ? (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    borderRadius: '50%',
                                                                    fontWeight: 700,
                                                                    fontSize: '12px',
                                                                    background: Number(strVal) >= 9 ? 'rgba(34, 197, 94, 0.15)' : Number(strVal) >= 7 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                                    color: Number(strVal) >= 9 ? '#15803d' : Number(strVal) >= 7 ? '#b45309' : '#b91c1c',
                                                                    border: `1px solid ${Number(strVal) >= 9 ? 'rgba(34, 197, 94, 0.3)' : Number(strVal) >= 7 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                                                }}>
                                                                    {strVal}
                                                                </span>
                                                            ) : isVinCol && strVal ? (
                                                                <span className="vin-chip">
                                                                    {strVal}
                                                                </span>
                                                            ) : strVal && (strVal.startsWith('http://') || strVal.startsWith('https://')) ? (
                                                                <a
                                                                    href={strVal}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                                                >
                                                                    View Photo ↗
                                                                </a>
                                                            ) : (
                                                                strVal || '—'
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                    {/* Pagination Footer */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 20px',
                        background: '#f8fafc',
                        borderTop: '2px solid #e2e8f0',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ color: '#64748b', fontSize: '12.5px', fontWeight: 500 }}>
                            Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="modern-btn modern-btn-outline"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 12px', fontSize: '12px' }}
                            >
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                className="modern-btn modern-btn-outline"
                                disabled={currentPage === totalPages || filteredData.length === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{ opacity: (currentPage === totalPages || filteredData.length === 0) ? 0.5 : 1, cursor: (currentPage === totalPages || filteredData.length === 0) ? 'not-allowed' : 'pointer', padding: '6px 12px', fontSize: '12px' }}
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NpsAnalyzer;
