import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
    ScanLine, 
    ShieldCheck, 
    ClipboardList, 
    BarChart3, 
    Download, 
    UploadCloud, 
    Play, 
    Pause, 
    FileSpreadsheet, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    Clock, 
    MapPin, 
    Search, 
    SlidersHorizontal, 
    LogOut,
    Sparkles,
    Check,
    Layers
} from 'lucide-react';
import { API_URL } from './api';
import './Dashboard.css';
import NpsAnalyzer from './NpsAnalyzer';

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

    // Download Sample Excel Template for VIN Inspector
    const handleDownloadVinTemplate = () => {
        const templateData = [
            {
                "Expected VIN": "MBLJAU021TG805557",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdHeroXtreme/view?usp=sharing",
                "Vehicle Model": "Hero Xtreme 160R",
                "Customer Name": "Ramesh Kumar"
            },
            {
                "Expected VIN": "MD625AF91TIAF7903",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdTVSRaider/view?usp=sharing",
                "Vehicle Model": "TVS Raider 125",
                "Customer Name": "Sanelpana Perera"
            },
            {
                "Expected VIN": "ME4JC483KKT012345",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdHondaActiva/view?usp=sharing",
                "Vehicle Model": "Honda Activa 6G",
                "Customer Name": "Sunil Silva"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VIN_Validation");
        XLSX.writeFile(wb, "VIN_Inspector_Template.xlsx");
    };

    // Load rich sample dataset for instant interactive test in VIN Inspector
    const handleLoadSampleVinData = () => {
        setFileName("Sample_Automotive_Inspection_Batch.xlsx");
        setOriginalColumns(["Expected VIN", "Google Drive Image Link", "Vehicle Model", "Customer Name"]);
        const sampleRows: ProcessedRow[] = [
            {
                "Expected VIN": "MBLJAU021TG805557",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdHeroXtreme/view?usp=sharing",
                "Vehicle Model": "Hero Xtreme 160R",
                "Customer Name": "Ramesh Kumar",
                extractedVin: "MBLJAU021TG805557",
                geoLocation: {
                    latitude: "6.939443",
                    longitude: "79.851817",
                    location: "Sameera's Lane, Colombo, Western Province, Sri Lanka",
                    dateTime: "01/10/2026 10:28 AM"
                },
                isMatch: "Match",
                status: "Complete"
            },
            {
                "Expected VIN": "MD625AF91TIAF7903",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdTVSRaider/view?usp=sharing",
                "Vehicle Model": "TVS Raider 125",
                "Customer Name": "Sanelpana Perera",
                extractedVin: "MD625AF91TIAF7903",
                geoLocation: {
                    latitude: "6.939356",
                    longitude: "79.852095",
                    location: "Colombo, Western Province, Sri Lanka",
                    dateTime: "01/10/2026 10:27 AM"
                },
                isMatch: "Match",
                status: "Complete"
            },
            {
                "Expected VIN": "ME4JC483KKT012345",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdHondaActiva/view?usp=sharing",
                "Vehicle Model": "Honda Activa 6G",
                "Customer Name": "Sunil Silva",
                extractedVin: "ME4JC483KKT012399",
                geoLocation: {
                    latitude: "6.927079",
                    longitude: "79.861244",
                    location: "Kollupitiya, Colombo, Sri Lanka",
                    dateTime: "01/10/2026 11:15 AM"
                },
                isMatch: "Mismatch",
                status: "Complete"
            },
            {
                "Expected VIN": "MAT623048N3J91823",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdNexon/view?usp=sharing",
                "Vehicle Model": "Tata Nexon EV",
                "Customer Name": "Ananya Iyer",
                extractedVin: "MAT623048N3J91823",
                geoLocation: {
                    latitude: "12.9716",
                    longitude: "77.5946",
                    location: "Prerana Motors Bangalore, Karnataka",
                    dateTime: "02/10/2026 09:40 AM"
                },
                isMatch: "Match",
                status: "Complete"
            },
            {
                "Expected VIN": "MA3FBA12S00192834",
                "Google Drive Image Link": "https://drive.google.com/file/d/1ExampleDriveFileIdHarrier/view?usp=sharing",
                "Vehicle Model": "Tata Harrier XZ+",
                "Customer Name": "Rajesh Sharma",
                extractedVin: "MA3FBA12S00192834",
                geoLocation: {
                    latitude: "18.5204",
                    longitude: "73.8567",
                    location: "Autovista Pune, Maharashtra",
                    dateTime: "02/10/2026 14:15 PM"
                },
                isMatch: "Match",
                status: "Complete"
            }
        ];
        setExcelData(sampleRows);
        setProgress(100);
    };

    // Download Sample Excel Template for Validator Matrix
    const handleDownloadValidatorTemplate = () => {
        const templateData = [
            {
                "Record #": 1,
                "VIN": "MD625AF91T1AF7903",
                "Vehicle Model": "TVS Raider",
                "Plant Code": "Hosur (Plant 1)",
                "Dealer Code": "DLR-2041",
                "Status": "Active",
                "Remarks": "Chassis Inspection Passed"
            },
            {
                "Record #": 2,
                "VIN": "MBLJAU021TG805557",
                "Vehicle Model": "Hero Xtreme",
                "Plant Code": "Dharuhera",
                "Dealer Code": "DLR-1088",
                "Status": "Active",
                "Remarks": "Assembly Verified"
            },
            {
                "Record #": 3,
                "VIN": "ME4JC483KKT012345",
                "Vehicle Model": "Honda Activa",
                "Plant Code": "Narsapura",
                "Dealer Code": "DLR-3052",
                "Status": "Active",
                "Remarks": "Pre-delivery Inspection Complete"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Validation_Matrix");
        XLSX.writeFile(wb, "Validation_Matrix_Template.xlsx");
    };

    // Download Sample Excel Template for Questionnaire Validation
    const handleDownloadQuestTemplate = () => {
        const templateData = [
            {
                "Complaint group (L2)": "Brake System",
                "Sub Complaint (L3)": "Front brake noise",
                "Brake": "Moring time only",
                "Engine": "Normal",
                "Electrical": "OK",
                "Transmission": "Smooth",
                "Suspension": "Standard"
            },
            {
                "Complaint group (L2)": "Electrical System",
                "Sub Complaint (L3)": "Headlight flickering",
                "Brake": "OK",
                "Engine": "Normal",
                "Electrical": "Intermittent loose wiring",
                "Transmission": "Smooth",
                "Suspension": "Standard"
            },
            {
                "Complaint group (L2)": "Engine / Powertrain",
                "Sub Complaint (L3)": "Cold start hesitation",
                "Brake": "OK",
                "Engine": "Choke valve sticking",
                "Electrical": "OK",
                "Transmission": "Smooth",
                "Suspension": "Standard"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Questionnaire_Hierarchy");
        XLSX.writeFile(wb, "Questionnaire_TGW_Template.xlsx");
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
        <div className="dashboard-layout">
            
            {/* Glossy Modern Header */}
            <header className="glossy-header">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div className="brand-badge">
                        <ScanLine size={22} color="#ffffff" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
                                AutoVIN Intelligence
                            </h2>
                            <span className="live-indicator">
                                <span className="live-dot" />
                                Engine v2.4 Active
                            </span>
                        </div>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>
                            Automotive Chassis Inspection &middot; Geofence Verification &middot; NPS Intelligence
                        </span>
                    </div>
                </div>
                <button 
                    onClick={handleLogout} 
                    className="modern-btn"
                    style={{ 
                        background: '#fef2f2', 
                        border: '1px solid rgba(254, 202, 202, 0.8)', 
                        color: '#dc2626', 
                        padding: '8px 16px', 
                        fontSize: '13px',
                        borderRadius: '10px',
                        boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                >
                    <LogOut size={15} />
                    Logout
                </button>
            </header>

            {/* Navigation Tabs - Modern Segmented Floating Pill Bar */}
            <div className="glass-tabs-nav-bar">
                <div className="glass-tabs-container">
                    {[
                        { name: 'VIN Inspector', icon: <ScanLine size={16} /> },
                        { name: 'Validator', icon: <ShieldCheck size={16} /> },
                        { name: 'Questionnaire Validation', icon: <ClipboardList size={16} /> },
                        { name: 'NPS Analyzer', icon: <BarChart3 size={16} /> }
                    ].map(({ name, icon }) => (
                        <button
                            key={name}
                            onClick={() => setActiveTab(name)}
                            className={`glass-tab-btn ${activeTab === name ? 'active' : ''}`}
                        >
                            {icon}
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            <main style={{ padding: '28px 36px', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                
                {activeTab === 'VIN Inspector' && (
                    <>
                        {/* Upload Dropzone Card */}
                        <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div className="dropzone-icon-box">
                                        <ScanLine size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                            Upload Validation Spreadsheet
                                        </h3>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                            Columns required: <strong>Expected VIN</strong> &amp; <strong>Google Drive Image Link</strong>
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label className="modern-btn modern-btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
                                        <UploadCloud size={16} />
                                        Browse File
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleFileUpload}
                                            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <button
                                        onClick={handleDownloadVinTemplate}
                                        className="modern-btn modern-btn-outline"
                                        title="Download sample Excel template with Expected VIN and Google Drive Image columns"
                                    >
                                        <Download size={15} />
                                        Download Template
                                    </button>
                                    <button
                                        onClick={handleLoadSampleVinData}
                                        className="modern-btn modern-btn-secondary"
                                        title="Load sample inspection records to test immediately"
                                    >
                                        <Sparkles size={15} color="#8b5cf6" />
                                        Load Sample Data
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature Insights Grid (Neat & Clean Empty State Showcase) */}
                        {excelData.length === 0 && (
                            <div className="feature-showcase-grid">
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                                        <ScanLine size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        AI Chassis Metal OCR
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Reads embossed metal VINs directly from inspection photos, automatically correcting for dust, angle, and harsh lighting.
                                    </p>
                                </div>

                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                        <MapPin size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        GPS Geofencing &amp; Audit
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Extracts camera EXIF coordinates and watermark stamps to guarantee the vehicle was examined at authorized dealership grounds.
                                    </p>
                                </div>

                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Automated Validation
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Instant character-by-character comparison highlighting mismatches, tampering, or clerical discrepancies with 1-click Excel export.
                                    </p>
                                </div>
                            </div>
                        )}

                {/* Data Table Section */}
                {excelData.length > 0 && (
                    <div className="glass-panel" style={{ 
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        
                        {/* Action Bar */}
                        <div style={{ 
                            padding: '20px 28px', 
                            borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
                            background: '#f8fafc',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            flexWrap: 'wrap', 
                            gap: '16px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FileSpreadsheet size={18} color="#2563eb" />
                                        <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>{fileName}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                        <span className="modern-stat-chip total">
                                            <Layers size={13} /> {excelData.length} Total
                                        </span>
                                        <span className="modern-stat-chip match">
                                            <CheckCircle2 size={13} /> {matchCount} Match
                                        </span>
                                        <span className="modern-stat-chip mismatch">
                                            <XCircle size={13} /> {mismatchCount} Mismatch
                                        </span>
                                        <span className="modern-stat-chip done">
                                            <Check size={13} /> {completedCount}/{excelData.length} Done
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Progress Bar */}
                                <div style={{ width: '220px', marginLeft: '10px' }}>
                                    <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${progress}%`, 
                                            background: 'linear-gradient(90deg, #3b82f6, #2563eb)', 
                                            height: '100%', 
                                            transition: 'width 0.3s ease',
                                            borderRadius: '999px'
                                        }}></div>
                                    </div>
                                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: '4px', display: 'block', textAlign: 'right' }}>{progress}% Complete</span>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {!isProcessing || isPaused ? (
                                    <button 
                                        onClick={processImages} 
                                        className="modern-btn modern-btn-primary"
                                    >
                                        <Play size={15} />
                                        {progress > 0 && progress < 100 ? 'Resume' : 'Start Validation'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={togglePause} 
                                        className="modern-btn"
                                        style={{ background: '#f59e0b', color: '#fff', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)' }}
                                    >
                                        <Pause size={15} />
                                        Pause
                                    </button>
                                )}
                                
                                <button 
                                    onClick={handleExport}
                                    disabled={completedCount === 0}
                                    className="modern-btn modern-btn-success"
                                    style={{ opacity: completedCount === 0 ? 0.5 : 1, cursor: completedCount === 0 ? 'not-allowed' : 'pointer' }}
                                >
                                    <Download size={15} />
                                    Export Excel
                                </button>
                            </div>
                        </div>
                        
                        {/* Table */}
                        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>#</th>
                                        {originalColumns.map((col) => (
                                            <th key={col}>{col}</th>
                                        ))}
                                        <th>Extracted VIN</th>
                                        <th>Geo Location</th>
                                        <th>Match Status</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelData.map((row, index) => {
                                        const geo = row.geoLocation;
                                        return (
                                            <tr key={index}>
                                                <td style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{index + 1}</td>
                                                {originalColumns.map((col) => {
                                                    const value = row[col];
                                                    const isValidDrive = isDriveLink(value);
                                                    return (
                                                        <td key={col} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {isValidDrive ? (
                                                                <a href={value as string} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                    <ScanLine size={14} /> Drive Image
                                                                </a>
                                                            ) : (
                                                                <span className="vin-chip">{value}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                
                                                {/* Extracted VIN */}
                                                <td>
                                                    {(() => {
                                                        const isUnclear = !row.extractedVin || ['-', 'N/A', 'No text found', 'No VIN detected', 'Error API', 'Error Fetch'].includes(row.extractedVin);
                                                        if (isUnclear) {
                                                            return (
                                                                <span className="modern-badge modern-badge-danger">
                                                                    <XCircle size={12} /> Not Clear
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="vin-chip" style={{ color: '#0284c7', background: '#f0f9ff', borderColor: '#bae6fd' }}>
                                                                {row.extractedVin}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Geo Location */}
                                                <td style={{ minWidth: '220px' }}>
                                                    {geo && (geo.latitude || geo.location || geo.dateTime) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                                                            {geo.latitude && geo.longitude && (
                                                                <span style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <MapPin size={13} /> {geo.latitude}, {geo.longitude}
                                                                </span>
                                                            )}
                                                            {geo.dateTime && (
                                                                <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <Clock size={13} /> {geo.dateTime}
                                                                </span>
                                                            )}
                                                            {geo.location && (
                                                                <span style={{ color: 'var(--color-text)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={geo.location}>
                                                                    🗺️ {geo.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-dim)' }}>—</span>
                                                    )}
                                                </td>

                                                {/* Match */}
                                                <td>
                                                    {row.isMatch === 'Match' ? (
                                                        <span className="modern-badge modern-badge-success">
                                                            <CheckCircle2 size={12} /> MATCH
                                                        </span>
                                                    ) : row.isMatch === 'Mismatch' ? (
                                                        <span className="modern-badge modern-badge-danger">
                                                            <XCircle size={12} /> MISMATCH
                                                        </span>
                                                    ) : (
                                                        <span className="modern-badge modern-badge-warning">
                                                            {row.isMatch || '—'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    {row.status === 'Processing' && <span style={{ color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} /> Reading...</span>}
                                                    {row.status === 'Complete' && <span style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={14} /> Done</span>}
                                                    {row.status === 'Error' && <span style={{ color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={14} /> Error</span>}
                                                    {row.status === 'Pending' && <span style={{ color: 'var(--color-text-dim)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} /> Pending</span>}
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
                        {/* Upload Dropzone Card */}
                        <div className="glass-panel" style={{ padding: '24px 28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div className="dropzone-icon-box">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                            Upload Validation Matrix Excel
                                        </h3>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                            Upload Excel matrix with VIN, Plant, and Date columns for decoding &amp; verification.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label className="modern-btn modern-btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
                                        <UploadCloud size={16} />
                                        Browse Matrix
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleValidatorFileUpload}
                                            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <button
                                        onClick={handleDownloadValidatorTemplate}
                                        className="modern-btn modern-btn-outline"
                                        title="Download sample Excel template for Validation Matrix with VIN, Plant, and Date columns"
                                    >
                                        <Download size={15} />
                                        Download Template
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature Insights Grid (When Empty) */}
                        {valData.length === 0 && !valIsLoading && (
                            <div className="feature-showcase-grid">
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Matrix Standard Validation
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Cross-analyzes plant production batches against master dealership allocation files.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                        <Layers size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Dynamic Column Filter
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Customize which metadata fields are visible and export precisely configured reports.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
                                        <Download size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Full Audit Trail Export
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Generate compliant spreadsheets ready for enterprise accounting and warranty auditing.
                                    </p>
                                </div>
                            </div>
                        )}

                        {valIsLoading && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
                                <h3 style={{ margin: 0, fontWeight: 600 }}>Parsing Matrix...</h3>
                            </div>
                        )}

                        {valData.length > 0 && !valIsLoading && (
                            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid rgba(226, 232, 240, 0.9)', background: '#f8fafc', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileSpreadsheet size={18} color="#2563eb" />
                                            <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>Parsed Validation Matrix</h4>
                                            <span className="modern-stat-chip total">{valData.length} records</span>
                                        </div>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '12.5px', margin: '4px 0 0 0' }}>All rows and decoded VIN attributes successfully verified.</p>
                                    </div>
                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                                                    fontSize: '13px',
                                                    fontFamily: 'var(--font-body)',
                                                    width: '230px',
                                                    outline: 'none',
                                                    transition: 'all 0.2s',
                                                    color: 'var(--color-text)'
                                                }}
                                            />
                                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        </div>

                                        <button 
                                            onClick={handleValDownload}
                                            className="modern-btn modern-btn-success"
                                        >
                                            <Download size={15} />
                                            Export Excel
                                        </button>
                                        
                                        {/* Column Filter Toggle */}
                                        <div style={{ position: 'relative' }}>
                                            <button 
                                                onClick={() => setShowValColumnFilter(!showValColumnFilter)}
                                                className="modern-btn modern-btn-secondary"
                                            >
                                                <SlidersHorizontal size={14} />
                                                Select Columns
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
                        {/* Upload Dropzone Card */}
                        <div className="glass-panel" style={{ padding: '24px 28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div className="dropzone-icon-box">
                                        <ClipboardList size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                            Upload Questionnaire (NPS TGW) Excel
                                        </h3>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                            Upload questionnaire mapping file to visualize category hierarchy and auto-validate rules.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label className="modern-btn modern-btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
                                        <UploadCloud size={16} />
                                        Browse Questionnaire
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleQuestFileUpload}
                                            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <button
                                        onClick={handleDownloadQuestTemplate}
                                        className="modern-btn modern-btn-outline"
                                        title="Download sample Excel template with Complaint Group L2, Sub Complaint L3, and Category columns"
                                    >
                                        <Download size={15} />
                                        Download Template
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature Insights Grid (When Empty) */}
                        {questData.length === 0 && !questIsLoading && (
                            <div className="feature-showcase-grid">
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                                        <ClipboardList size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        TGW Bucket Hierarchy
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Structure customer feedback across L2 complaint groups and L3 sub-complaint categories.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Acceptance Logic Verification
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Auto-evaluates question matrix combinations to tag rows as Accepted or highlight missing values.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
                                        <FileSpreadsheet size={20} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Instant Clean Export
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                        Export validated buckets directly into executive reports and dealer audit logs.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {questError && (
                            <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <AlertTriangle size={24} color="#dc2626" />
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>Format Mismatch</h4>
                                    <p style={{ margin: 0, fontSize: '13px' }}>{questError}</p>
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        {questIsLoading && (
                            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⏳</div>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--color-text)' }}>Parsing Excel File...</h3>
                                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '13px' }}>Processing rows and analyzing structure.</p>
                            </div>
                        )}

                        {/* Extracted Data Table */}
                        {!questIsLoading && questData.length > 0 && (
                            <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'relative', zIndex: 100, padding: '20px 28px', borderBottom: '1px solid rgba(226, 232, 240, 0.9)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileSpreadsheet size={18} color="#2563eb" />
                                            <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>Parsed Questionnaire Matrix</h4>
                                            <span className="modern-stat-chip total">{questData.length} records</span>
                                        </div>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '12.5px', margin: '4px 0 0 0' }}>All rows and components successfully extracted.</p>
                                    </div>
                                    
                                    {/* Column Filter Toggle */}
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            onClick={() => setShowColumnFilter(!showColumnFilter)}
                                            className="modern-btn modern-btn-secondary"
                                        >
                                            <SlidersHorizontal size={14} />
                                            Select Columns
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

                {activeTab === 'NPS Analyzer' && (
                    <NpsAnalyzer />
                )}

            </main>
        </div>
    );
};

export default AdminDashboard;
