import React, { useState, useRef } from 'react';
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
    UploadCloud,
    Square,
    Layers,
    RotateCcw
} from 'lucide-react';

// Sample 10 pre-extracted rows
const SAMPLE_EXTRACTED_PDF_ROWS = [
    { '#': 1, 'Document Source': 'Survey_Batch_001.pdf', 'Customer Name': 'Rajesh Sharma', 'Mobile': '0772161819', 'Location': 'Colombo / Pune', 'Date': '2026-09-12', 'Brand': 'Hero', 'Vehicle Model': 'Xtreme 160R', 'Form VIN': 'MBLJAU021TG805557', 'Stamped Metal VIN': 'MBLJAU021TG805557', 'VIN Match Status': '✅ Match', 'Odometer Reading': '18,400 km', 'Dealer / Workshop': 'Central Hub', 'Product NPS Score': 10, 'Product Sentiment': 'Promoter', 'Product Feedback': 'Exceptional driving comfort and highway stability. Loved the quick pickup!', 'Service NPS Score': 10, 'Service Sentiment': 'Promoter', 'Service Feedback': 'First free service was completed within 90 minutes.', 'GPS Watermark Location': 'Colombo, Sri Lanka', 'GPS Coordinates': '6.9394, 79.8518', 'GPS Timestamp': '12/09/2026 10:28 AM' },
    { '#': 2, 'Document Source': 'Survey_Batch_002.pdf', 'Customer Name': 'Ananya Iyer', 'Mobile': '0717201142', 'Location': 'Bangalore', 'Date': '2026-09-14', 'Brand': 'TVS', 'Vehicle Model': 'Raider 125', 'Form VIN': 'MD625AF91TIAF7903', 'Stamped Metal VIN': 'MD625AF91TIAF7903', 'VIN Match Status': '✅ Match', 'Odometer Reading': '24,210 km', 'Dealer / Workshop': 'Prerana Motors', 'Product NPS Score': 9, 'Product Sentiment': 'Promoter', 'Product Feedback': 'Instant torque, silent ride, and high fuel economy.', 'Service NPS Score': 9, 'Service Sentiment': 'Promoter', 'Service Feedback': 'Prompt handling and courteous floor manager.', 'GPS Watermark Location': 'Bangalore, India', 'GPS Coordinates': '12.9716, 77.5946', 'GPS Timestamp': '14/09/2026 11:15 AM' },
    { '#': 3, 'Document Source': 'Survey_Batch_003.pdf', 'Customer Name': 'Vikram Singh', 'Mobile': '0754891230', 'Location': 'Delhi', 'Date': '2026-09-15', 'Brand': 'Tata', 'Vehicle Model': 'Safari Dark Edition', 'Form VIN': 'MB4G09182K9L38192', 'Stamped Metal VIN': 'MB4G09182K9L38192', 'VIN Match Status': '✅ Match', 'Odometer Reading': '41,500 km', 'Dealer / Workshop': 'Arya Tata Delhi', 'Product NPS Score': 4, 'Product Sentiment': 'Detractor', 'Product Feedback': 'Loud squeaking noise from front brake pads during cold starts.', 'Service NPS Score': 4, 'Service Sentiment': 'Detractor', 'Service Feedback': 'Brake cleaning took over 4 hours with no advance notice.', 'GPS Watermark Location': 'Connaught Place, Delhi', 'GPS Coordinates': '28.6315, 77.2167', 'GPS Timestamp': '15/09/2026 03:20 PM' },
    { '#': 4, 'Document Source': 'Survey_Batch_004.pdf', 'Customer Name': 'Pooja Verma', 'Mobile': '0729182740', 'Location': 'Mumbai', 'Date': '2026-09-16', 'Brand': 'Tata', 'Vehicle Model': 'Curvv EV', 'Form VIN': 'MZ8918274L1902834', 'Stamped Metal VIN': 'MZ8918274L1902834', 'VIN Match Status': '✅ Match', 'Odometer Reading': '8,300 km', 'Dealer / Workshop': 'Parihar Wheels', 'Product NPS Score': 5, 'Product Sentiment': 'Detractor', 'Product Feedback': 'Center touchscreen freezes occasionally when wireless CarPlay is active.', 'Service NPS Score': 6, 'Service Sentiment': 'Detractor', 'Service Feedback': 'Software update did not resolve the screen reboot issue.', 'GPS Watermark Location': 'Andheri West, Mumbai', 'GPS Coordinates': '19.1136, 72.8697', 'GPS Timestamp': '16/09/2026 09:40 AM' },
    { '#': 5, 'Document Source': 'Survey_Batch_005.pdf', 'Customer Name': 'Karthik Nair', 'Mobile': '0789182341', 'Location': 'Kochi', 'Date': '2026-09-17', 'Brand': 'Hero', 'Vehicle Model': 'Glamour 125', 'Form VIN': 'MA3J91823M0192837', 'Stamped Metal VIN': 'MA3J91823M0192837', 'VIN Match Status': '✅ Match', 'Odometer Reading': '31,100 km', 'Dealer / Workshop': 'KHT Kochi', 'Product NPS Score': 8, 'Product Sentiment': 'Passive', 'Product Feedback': 'Engine is smooth, but headlight intensity in heavy rain feels dim.', 'Service NPS Score': 8, 'Service Sentiment': 'Passive', 'Service Feedback': 'Routine oil change executed smoothly.', 'GPS Watermark Location': 'Ernakulam, Kochi', 'GPS Coordinates': '9.9816, 76.2999', 'GPS Timestamp': '17/09/2026 04:10 PM' },
    { '#': 6, 'Document Source': 'Survey_Batch_006.pdf', 'Customer Name': 'Amitabh Sen', 'Mobile': '0761928374', 'Location': 'Kolkata', 'Date': '2026-09-18', 'Brand': 'TVS', 'Vehicle Model': 'Apache RTR 160', 'Form VIN': 'MAT918274L0192831', 'Stamped Metal VIN': 'MAT918274L0192831', 'VIN Match Status': '✅ Match', 'Odometer Reading': '12,900 km', 'Dealer / Workshop': 'Dulichand Kolkata', 'Product NPS Score': 9, 'Product Sentiment': 'Promoter', 'Product Feedback': 'Aggressive styling and best-in-class exhaust note. Highly satisfied!', 'Service NPS Score': 9, 'Service Sentiment': 'Promoter', 'Service Feedback': 'Polite service advisor and clean washing bay.', 'GPS Watermark Location': 'Salt Lake, Kolkata', 'GPS Coordinates': '22.5867, 88.4178', 'GPS Timestamp': '18/09/2026 02:05 PM' },
    { '#': 7, 'Document Source': 'Survey_Batch_007.pdf', 'Customer Name': 'Sneha Patel', 'Mobile': '0771928471', 'Location': 'Ahmedabad', 'Date': '2026-09-19', 'Brand': 'Tata', 'Vehicle Model': 'Harrier Fearless', 'Form VIN': 'MB5G91823K1029384', 'Stamped Metal VIN': 'MB5G91823K1029384', 'VIN Match Status': '✅ Match', 'Odometer Reading': '19,700 km', 'Dealer / Workshop': 'Cargo Motors', 'Product NPS Score': 3, 'Product Sentiment': 'Detractor', 'Product Feedback': 'Front parking sensor gave false alert beep in light monsoon rain.', 'Service NPS Score': 4, 'Service Sentiment': 'Detractor', 'Service Feedback': 'Part was not available in regional warehouse.', 'GPS Watermark Location': 'SG Highway, Ahmedabad', 'GPS Coordinates': '23.0338, 72.5850', 'GPS Timestamp': '19/09/2026 12:45 PM' },
    { '#': 8, 'Document Source': 'Survey_Batch_008.pdf', 'Customer Name': 'Deepak Rao', 'Mobile': '0738192038', 'Location': 'Chennai', 'Date': '2026-09-20', 'Brand': 'Honda', 'Vehicle Model': 'Shine 125', 'Form VIN': 'MA3FB9182L0192834', 'Stamped Metal VIN': 'MA3FB9182L0192834', 'VIN Match Status': '✅ Match', 'Odometer Reading': '55,300 km', 'Dealer / Workshop': 'Tafesa Chennai', 'Product NPS Score': 10, 'Product Sentiment': 'Promoter', 'Product Feedback': 'Legendary reliability and buttery smooth gearbox shift.', 'Service NPS Score': 10, 'Service Sentiment': 'Promoter', 'Service Feedback': 'Delivered 30 minutes ahead of scheduled promise time.', 'GPS Watermark Location': 'Anna Nagar, Chennai', 'GPS Coordinates': '13.0850, 80.2101', 'GPS Timestamp': '20/09/2026 11:30 AM' },
    { '#': 9, 'Document Source': 'Survey_Batch_009.pdf', 'Customer Name': 'Meera Deshmukh', 'Mobile': '0719283746', 'Location': 'Pune', 'Date': '2026-09-22', 'Brand': 'Bajaj', 'Vehicle Model': 'Pulsar N160', 'Form VIN': 'MAT019283K9182734', 'Stamped Metal VIN': 'MAT019283K9182734', 'VIN Match Status': '✅ Match', 'Odometer Reading': '22,400 km', 'Dealer / Workshop': 'Garve Pune', 'Product NPS Score': 2, 'Product Sentiment': 'Detractor', 'Product Feedback': 'Rear brake feels spongy and vehicle wobbles slightly above 75 km/h.', 'Service NPS Score': 3, 'Service Sentiment': 'Detractor', 'Service Feedback': 'Mechanic could not diagnose wheel balance issue.', 'GPS Watermark Location': 'Kothrud, Pune', 'GPS Coordinates': '18.5074, 73.8077', 'GPS Timestamp': '22/09/2026 05:15 PM' },
    { '#': 10, 'Document Source': 'Survey_Batch_010.pdf', 'Customer Name': 'Divya Reddy', 'Mobile': '0791827463', 'Location': 'Hyderabad', 'Date': '2026-09-24', 'Brand': 'Hero', 'Vehicle Model': 'Passion Xtec', 'Form VIN': 'MAT910293N0192845', 'Stamped Metal VIN': 'MAT910293N0192845', 'VIN Match Status': '✅ Match', 'Odometer Reading': '14,800 km', 'Dealer / Workshop': 'Venkataramana Hyd', 'Product NPS Score': 10, 'Product Sentiment': 'Promoter', 'Product Feedback': 'Consistently getting 65+ km/l real-world mileage. Bluetooth caller ID works great.', 'Service NPS Score': 10, 'Service Sentiment': 'Promoter', 'Service Feedback': 'Courteous staff and transparent billing explanation.', 'GPS Watermark Location': 'Banjara Hills, Hyderabad', 'GPS Coordinates': '17.4156, 78.4350', 'GPS Timestamp': '24/09/2026 01:50 PM' }
];

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
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({});
    const [showColumnFilter, setShowColumnFilter] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchText, setSearchText] = useState('');
    const [fileName, setFileName] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [dossierMode, setDossierMode] = useState<'page' | 'dossier-4'>('page');

    // Live Streaming Progress State
    const [progress, setProgress] = useState<BatchProgress>({
        isActive: false,
        current: 0,
        total: 0,
        percent: 0,
        label: '',
        stopped: false
    });

    const [liveStats, setLiveStats] = useState<LiveStats>({
        processed: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        netNps: 0,
        matchRate: 100
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

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
        setData([]);
        setColumns([]);
        setVisibleCols({});
        setIsLoading(false);
        setError('');
        setFileName('');
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
                                    const cols = Object.keys(newRow).filter(c => c !== '#');
                                    setColumns(cols);
                                    const colVisInit: Record<string, boolean> = {};
                                    cols.forEach(c => { colVisInit[c] = true; });
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
                            if (payload.columns && payload.columns.length > 0) {
                                setColumns(payload.columns);
                                const colVisInit: Record<string, boolean> = {};
                                payload.columns.forEach((c: string) => { colVisInit[c] = true; });
                                setVisibleCols(colVisInit);
                            }
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
            const cols = Object.keys(SAMPLE_EXTRACTED_PDF_ROWS[0]).filter(c => c !== '#');
            setColumns(cols);
            setData(SAMPLE_EXTRACTED_PDF_ROWS);
            const colVisInit: Record<string, boolean> = {};
            cols.forEach(c => { colVisInit[c] = true; });
            setVisibleCols(colVisInit);
            setFileName('Sample_Automotive_NPS_Report.pdf');
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

        const baseCols = Object.keys(SAMPLE_EXTRACTED_PDF_ROWS[0]).filter(c => c !== '#');
        setColumns(baseCols);
        const colVisInit: Record<string, boolean> = {};
        baseCols.forEach(c => { colVisInit[c] = true; });
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

        const interval = setInterval(() => {
            currentIdx++;
            const score = currentIdx % 5 === 0 ? 4 : currentIdx % 4 === 0 ? 8 : currentIdx % 3 === 0 ? 9 : 10;
            const sentiment = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
            if (sentiment === 'Promoter') pCount++;
            else if (sentiment === 'Passive') passCount++;
            else dCount++;

            const brand = brands[currentIdx % brands.length];
            const model = models[currentIdx % models.length];
            const loc = locations[currentIdx % locations.length];

            const simRow = {
                '#': currentIdx,
                'Document Source': `Batch_Doc_${String(currentIdx).padStart(3, '0')}.pdf (Page ${currentIdx})`,
                'Customer Name': `Customer ${currentIdx} (${['Silva', 'Sharma', 'Perera', 'Patel', 'Reddy', 'Singh'][currentIdx % 6]})`,
                'Mobile': `07${String(10000000 + currentIdx * 3829).substring(0, 8)}`,
                'Location': loc,
                'Date': `2026-10-${String((currentIdx % 28) + 1).padStart(2, '0')}`,
                'Brand': brand,
                'Vehicle Model': model,
                'Form VIN': `MD6${String(currentIdx * 92837).padEnd(14, '0')}`,
                'Stamped Metal VIN': currentIdx % 15 === 0 ? `MD6DIFFERENT${currentIdx}` : `MD6${String(currentIdx * 92837).padEnd(14, '0')}`,
                'VIN Match Status': currentIdx % 15 === 0 ? '❌ Mismatch' : '✅ Match',
                'Odometer Reading': `${(10000 + currentIdx * 750) % 65000} km`,
                'Dealer / Workshop': `${loc} Service Center`,
                'Product NPS Score': score,
                'Product Sentiment': sentiment,
                'Product Feedback': sentiment === 'Promoter' ? 'Smooth engine, exceptional handling, and stylish look.' : sentiment === 'Passive' ? 'Decent mileage, spare parts took a week to arrive.' : 'Front suspension noise on rough roads, needs tightening.',
                'Service NPS Score': score,
                'Service Sentiment': sentiment,
                'Service Feedback': sentiment === 'Promoter' ? 'Fast turnaround, friendly washing staff.' : 'Delay in billing counter queue.',
                'GPS Watermark Location': `${loc}, Western Province`,
                'GPS Coordinates': `6.${930000 + currentIdx * 100}, 79.${850000 + currentIdx * 100}`,
                'GPS Timestamp': `2026-10-07 10:${String(currentIdx % 60).padStart(2, '0')} AM`
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

        const exportData = filtered.map(row => {
            const exp: any = {};
            columns.forEach(c => {
                if (visibleCols[c]) {
                    exp[c] = row[c];
                }
            });
            return exp;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NPS Matrix');
        const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'NPS_Data';
        XLSX.writeFile(wb, `${cleanName}_Export.xlsx`);
    };

    // Download Sample Excel Template for NPS Analysis Matrix
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                "Customer Name": "Ramesh Kumar",
                "Mobile": "0772161819",
                "Location": "Colombo",
                "Date": "01/10/2026",
                "Brand": "Hero",
                "Vehicle Model": "Xtreme 160R",
                "Form VIN": "MBLJAU021TG805557",
                "Stamped Metal VIN": "MBLJAU021TG805557",
                "VIN Match Status": "✅ Match",
                "Odometer Reading": "49,000",
                "Dealer / Workshop": "Union Place",
                "Product NPS Score": 10,
                "Product Sentiment": "Promoter",
                "Product Feedback": "Best Look, Best Mileage",
                "Service NPS Score": 10,
                "Service Sentiment": "Promoter",
                "Service Feedback": "Best Service, Good Staffs",
                "GPS Watermark Location": "Sameera's Lane, Colombo, Western Province, Sri Lanka",
                "GPS Coordinates": "6.939443, 79.851817",
                "GPS Timestamp": "Thursday, 01/10/2026 10:28 AM GMT+05:30"
            },
            {
                "Customer Name": "Sanelpana Perera",
                "Mobile": "0717201142",
                "Location": "Colombo",
                "Date": "01.10.2026",
                "Brand": "TVS",
                "Vehicle Model": "Raider 125",
                "Form VIN": "MD625AF91TIAF7903",
                "Stamped Metal VIN": "MD625AF91TIAF7903",
                "VIN Match Status": "✅ Match",
                "Odometer Reading": "24,210",
                "Dealer / Workshop": "Ragama",
                "Product NPS Score": 8,
                "Product Sentiment": "Passive",
                "Product Feedback": "Need More Features; Parts Price High",
                "Service NPS Score": 5,
                "Service Sentiment": "Detractor",
                "Service Feedback": "Bad oiling, Bad Staff",
                "GPS Watermark Location": "Colombo, Western Province, Sri Lanka",
                "GPS Coordinates": "6.939356, 79.852095",
                "GPS Timestamp": "01/10/2026 10:27 AM"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NPS_Matrix");
        XLSX.writeFile(wb, "NPS_Analysis_Matrix_Template.xlsx");
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Upload Dropzone Card */}
            <div
                className="glass-panel"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) processFiles(files);
                }}
                style={{
                    padding: '28px 32px',
                    border: isDragging ? '2px dashed #2563eb' : '2px dashed rgba(59, 130, 246, 0.4)',
                    background: isDragging
                        ? 'rgba(239, 246, 255, 0.9)'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.85) 100%)',
                    transition: 'all 0.25s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                        <div className="dropzone-icon-box" style={{ width: '56px', height: '56px', borderRadius: '16px' }}>
                            <UploadCloud size={28} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text)' }}>
                                    Upload NPS / Survey Document(s)
                                </h3>
                                <span className="modern-badge modern-badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                    Batch 1-by-1 AI Parser
                                </span>
                                <span className="modern-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '11px' }}>
                                    Handles 100+ PDFs under Single File
                                </span>
                            </div>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                                Drop a single PDF with 100+ pages, multiple selected PDFs, or a ZIP archive. Analyzed <strong>one by one</strong> in real-time.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Dossier Mode Selector */}
                        <div className="mode-pill-group" title="Select extraction partitioning strategy">
                            <button
                                type="button"
                                className={`mode-pill-btn ${dossierMode === 'page' ? 'active' : ''}`}
                                onClick={() => setDossierMode('page')}
                            >
                                1 Record / Page (100+ Surveys)
                            </button>
                            <button
                                type="button"
                                className={`mode-pill-btn ${dossierMode === 'dossier-4' ? 'active' : ''}`}
                                onClick={() => setDossierMode('dossier-4')}
                            >
                                4 Pages / Dossier
                            </button>
                        </div>

                        {/* File Browse Button */}
                        <label className="modern-btn modern-btn-primary" style={{ cursor: 'pointer', margin: 0, padding: '11px 20px', fontSize: '13.5px' }}>
                            <UploadCloud size={17} />
                            Browse PDF / ZIP File(s)
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
                        </label>

                        {/* Download Template */}
                        <button
                            className="modern-btn modern-btn-outline"
                            onClick={handleDownloadTemplate}
                            title="Download sample Excel template for NPS Analysis matrix"
                        >
                            <Download size={14} /> Template
                        </button>

                        {/* Load Sample Data (10 Records) */}
                        <button
                            className="modern-btn modern-btn-secondary"
                            onClick={handleLoadSample}
                            title="Load pre-extracted 10 sample survey records"
                        >
                            <Sparkles size={14} color="#8b5cf6" /> 10 Samples
                        </button>

                        {/* Simulate 100 Records One-By-One */}
                        <button
                            className="modern-btn modern-btn-outline"
                            onClick={handleSimulate100Records}
                            disabled={isLoading}
                            title="Simulate live 1-by-1 analysis of 100 survey records"
                            style={{ borderColor: '#6366f1', color: '#4f46e5' }}
                        >
                            <Layers size={14} /> 100 Records Demo
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="glass-panel" style={{
                    padding: '16px 20px',
                    background: 'rgba(254, 242, 242, 0.9)',
                    borderColor: 'rgba(254, 202, 202, 0.95)',
                    color: 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <AlertTriangle size={24} color="#dc2626" />
                    <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 700 }}>Analysis Alert</h4>
                        <p style={{ margin: 0, fontSize: '13px' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Real-time Batch Progress Dashboard */}
            {(progress.isActive || data.length > 0 || progress.stopped) && (
                <div className="batch-progress-card animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {progress.isActive ? (
                                <span className="pulse-dot" />
                            ) : progress.stopped ? (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                            ) : (
                                <CheckCircle2 size={18} color="#059669" />
                            )}
                            <div>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {progress.isActive
                                        ? `Analyzing Batch Records: ${progress.current} of ${progress.total || '...'}`
                                        : progress.stopped
                                        ? `Analysis Paused: ${data.length} records preserved`
                                        : `Batch Complete: ${data.length} records extracted`}
                                </h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                                    {progress.label || `Extracted from ${fileName}`}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {progress.isActive && (
                                <button
                                    className="modern-btn modern-btn-danger"
                                    onClick={handleStopAnalysis}
                                    style={{ padding: '8px 16px', fontSize: '12.5px' }}
                                    title="Stop analysis now and keep all gathered records"
                                >
                                    <Square size={13} /> Stop / Pause
                                </button>
                            )}

                            {data.length > 0 && (
                                <>
                                    <button
                                        className="modern-btn modern-btn-success"
                                        onClick={handleDownloadExcel}
                                        style={{ padding: '8px 16px', fontSize: '12.5px' }}
                                        title="Download all processed records as clean Excel file"
                                    >
                                        <Download size={13} /> Export Excel ({data.length})
                                    </button>

                                    <button
                                        className="modern-btn modern-btn-outline"
                                        onClick={handleClear}
                                        style={{ padding: '8px 14px', fontSize: '12.5px' }}
                                        title="Clear all extracted records and start new batch"
                                    >
                                        <RotateCcw size={13} /> Clear
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar (Visible while active or stopped) */}
                    {(progress.isActive || (progress.total > 0 && progress.percent < 100)) && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                <span>Progress: {progress.current} / {progress.total} Document Records</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <div className="batch-progress-bar-bg">
                                <div
                                    className="batch-progress-bar-fill"
                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Live KPI Statistics Cards */}
                    {data.length > 0 && (
                        <div className="batch-kpi-grid">
                            <div className="batch-kpi-card">
                                <span className="batch-kpi-label">Total Records</span>
                                <span className="batch-kpi-value">{data.length}</span>
                                <span className="batch-kpi-sub" style={{ color: '#64748b' }}>
                                    {progress.isActive ? `of ${progress.total}` : '100% Extracted'}
                                </span>
                            </div>

                            <div className="batch-kpi-card" style={{ borderColor: 'rgba(34, 197, 94, 0.4)' }}>
                                <span className="batch-kpi-label" style={{ color: '#15803d' }}>Promoters (9-10)</span>
                                <span className="batch-kpi-value" style={{ color: '#15803d' }}>{liveStats.promoters}</span>
                                <span className="batch-kpi-sub" style={{ color: '#16a34a' }}>
                                    {data.length > 0 ? `${Math.round((liveStats.promoters / data.length) * 100)}%` : '0%'}
                                </span>
                            </div>

                            <div className="batch-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                                <span className="batch-kpi-label" style={{ color: '#b45309' }}>Passives (7-8)</span>
                                <span className="batch-kpi-value" style={{ color: '#b45309' }}>{liveStats.passives}</span>
                                <span className="batch-kpi-sub" style={{ color: '#d97706' }}>
                                    {data.length > 0 ? `${Math.round((liveStats.passives / data.length) * 100)}%` : '0%'}
                                </span>
                            </div>

                            <div className="batch-kpi-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                                <span className="batch-kpi-label" style={{ color: '#b91c1c' }}>Detractors (0-6)</span>
                                <span className="batch-kpi-value" style={{ color: '#b91c1c' }}>{liveStats.detractors}</span>
                                <span className="batch-kpi-sub" style={{ color: '#dc2626' }}>
                                    {data.length > 0 ? `${Math.round((liveStats.detractors / data.length) * 100)}%` : '0%'}
                                </span>
                            </div>

                            <div className="batch-kpi-card" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.08) 100%)', borderColor: 'rgba(99, 102, 241, 0.4)' }}>
                                <span className="batch-kpi-label" style={{ color: '#4338ca' }}>Net NPS Score</span>
                                <span className="batch-kpi-value" style={{ color: liveStats.netNps >= 0 ? '#1e40af' : '#b91c1c' }}>
                                    {liveStats.netNps > 0 ? `+${liveStats.netNps}` : liveStats.netNps}
                                </span>
                                <span className="batch-kpi-sub" style={{ color: '#4f46e5' }}>
                                    {liveStats.netNps >= 50 ? '🌟 World Class' : liveStats.netNps >= 20 ? '👍 Strong' : '⚠️ Action Req.'}
                                </span>
                            </div>

                            <div className="batch-kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                                <span className="batch-kpi-label" style={{ color: '#047857' }}>VIN Match Rate</span>
                                <span className="batch-kpi-value" style={{ color: '#047857' }}>{liveStats.matchRate}%</span>
                                <span className="batch-kpi-sub" style={{ color: '#059669' }}>Form vs Chassis</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Feature Insights Grid (Shown when no data has been loaded yet) */}
            {data.length === 0 && !isLoading && (
                <div className="feature-showcase-grid">
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                            <Layers size={20} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            100+ PDF Batch Extraction
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Drop a single master PDF containing 100 survey pages, a ZIP archive, or multiple selected PDFs. Analyzes each record sequentially.
                        </p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                            <BarChart3 size={20} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            Live Real-Time Streaming
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Rows appear in the table immediately as each PDF is parsed. Dynamic metrics compute Promoters, Passives, and Net NPS live.
                        </p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
                            <Download size={20} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            One-Click Clean XLSX
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                            Pause or stop anytime, search and filter columns, and export all gathered records directly into a clean Excel spreadsheet.
                        </p>
                    </div>
                </div>
            )}

            {/* Extracted Data Matrix Table Card (Shown whenever data is available, even while streaming!) */}
            {data.length > 0 && (
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Top Action Bar */}
                    <div style={{
                        position: 'relative',
                        zIndex: 100,
                        padding: '18px 24px',
                        borderBottom: '1px solid var(--color-border)',
                        background: 'var(--color-surface-2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '14px'
                    }}>
                        <div>
                            <h4 style={{ margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
                                <FileSpreadsheet size={18} color="#2563eb" />
                                Parsed NPS Matrix ({data.length} records)
                                {progress.isActive && (
                                    <span className="modern-badge modern-badge-warning" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                        Streaming Live...
                                    </span>
                                )}
                            </h4>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                                Source: <strong style={{ color: 'var(--color-text)' }}>{fileName}</strong> &middot; Ready to download as Excel.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Search Input */}
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={15}
                                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Search all columns..."
                                    value={searchText}
                                    onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                                    style={{
                                        padding: '9px 14px 9px 36px',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                        background: 'var(--color-surface)',
                                        width: '230px',
                                        outline: 'none',
                                        color: 'var(--color-text)',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}
                                />
                            </div>

                            {/* Select Columns Filter Toggle */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="modern-btn modern-btn-outline"
                                    onClick={() => setShowColumnFilter(!showColumnFilter)}
                                >
                                    <SlidersHorizontal size={14} /> Select Columns
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
                                        {columns.map(col => (
                                            <div key={col} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                                <input
                                                    id={`nps-col-${col}`}
                                                    type="checkbox"
                                                    checked={visibleCols[col] !== false}
                                                    onChange={() => setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }))}
                                                    style={{ marginRight: '8px', cursor: 'pointer' }}
                                                />
                                                <label htmlFor={`nps-col-${col}`} style={{ fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                                                    {col}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Download as Excel */}
                            <button
                                className="modern-btn modern-btn-success"
                                onClick={handleDownloadExcel}
                            >
                                <Download size={14} /> Download Excel (.xlsx)
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div style={{
                        overflowX: 'auto',
                        overflowY: 'auto',
                        maxHeight: 'calc(100vh - 420px)',
                        width: '100%',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        <table className="modern-table" style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>#</th>
                                    {columns.map((col, idx) => (
                                        visibleCols[col] !== false ? (
                                            <th
                                                key={idx}
                                                style={{
                                                    minWidth: col.toLowerCase().includes('feedback') ? '300px' : col.toLowerCase().includes('source') ? '220px' : '160px',
                                                    maxWidth: col.toLowerCase().includes('feedback') ? '400px' : '260px'
                                                }}
                                            >
                                                {col}
                                            </th>
                                        ) : null
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                                            No records match your search filter.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((row, i) => {
                                        const globalIdx = (currentPage - 1) * pageSize + i + 1;
                                        return (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
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
                                                                whiteSpace: col.toLowerCase().includes('feedback') ? 'normal' : 'nowrap',
                                                                maxWidth: col.toLowerCase().includes('feedback') ? '350px' : '250px',
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

                    {/* Pagination Footer */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 24px',
                        background: 'var(--color-surface-2)',
                        borderTop: '1px solid var(--color-border)',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                            Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="modern-btn modern-btn-outline"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                            >
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                className="modern-btn modern-btn-outline"
                                disabled={currentPage === totalPages || filteredData.length === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{ opacity: (currentPage === totalPages || filteredData.length === 0) ? 0.5 : 1, cursor: (currentPage === totalPages || filteredData.length === 0) ? 'not-allowed' : 'pointer' }}
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
