import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
    API_URL,
    getRegions,
    getCountries,
    getIbVersions,
    getCommonUploads,
    getUploadData,
    uploadCommonFile,
    updateUploadData
} from './api';
import type {
    RegionItem,
    CountryItem,
    IbVersionItem,
    CommonUploadItem
} from './api';
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
    RotateCcw,
    FolderOpen,
    RefreshCw,
    Database,
    X,
    FileText,
    Check,
    Save
} from 'lucide-react';

import {
    GUINEA_COLUMNS_449,
    getExcelColumnLetter,
    orderColumns
} from './guineaSchema';
import { SAMPLE_EXTRACTED_PDF_ROWS } from './sampleGuineaData';
import { POSITIVE_DRIVER_L2_TO_L3, mapPositiveDrivers } from './shared/positiveDrivers';
import { mapNegativeDetractors } from './shared/negativeDetractors';
import { mapWorkshopDrivers } from './shared/workshopDrivers';
import { NPS_CELL_OPTIONS } from './npsCellOptions';

const DESIRED_COLUMN_ORDER = GUINEA_COLUMNS_449;
// ============================================================
// Page 2 / Page 3 auto-fill pools (mirror of server.js)
// ============================================================
const WORKSHOP_3A_POOLS = [
    [
        "Resolving the reported issues in First Time Right",   // Resolution of Problem
        "Skilled technicians available in workshop",            // Skilled Manpower
        "Quick job card opening"                                // Waiting Time
    ],
    [
        "Service adviser listened attentively",                 // Service Adviser Behavior
        "Reasonable cost with clear explanation",               // Cost & Explanation
        "Pick up & drop facility available"                     // Workshop Facilities
    ],
    [
        "Comfortable customer lounge with AC",                  // Customer Lounge Amenities
        "Easy warranty process",                                // Warranty Policy
        "Proper washing done"                                   // Washing Quality
    ]
];

const WORKSHOP_3B_POOLS = [
    [
        "More waiting at job card opening",                     // Waiting Time
        "Invoice not explained properly",                       // Cost & Explanation
        "Vehicle not washed properly"                           // Washing Quality
    ],
    [
        "Service adviser was not listening",                    // Service Adviser Behavior
        "Warranty not given in warranty period",                // Warranty Policy
        "Pick up & drop facility not available"                 // Workshop Facilities
    ],
    [
        "Repetition of issues since last service",              // Resolution of Problem
        "Sunday opening not available",                         // Operating Hours
        "Comfortable seating not available in lounge"           // Customer Lounge Amenities
    ]
];

const WORKSHOP_4_POOLS = [
    [
        "Technicians not skilled enough",                       // Skilled Manpower
        "Spare parts not available at workshop",                // Parts availability
        "Delivery not on promised time"                         // Waiting Time
    ],
    [
        "Issues not resolved even after repeated visits",       // Resolution of Problem
        "Overcharging compared to invoice",                     // Cost & Explanation
        "Service adviser behaved rudely"                        // Service Adviser Behavior
    ],
    [
        "Polishing not done after wash",                        // Washing Quality
        "Asked money for warranty replacement",                 // Warranty Policy
        "Express service not available"                         // Workshop Facilities
    ]
];

const A5_SHARED_SET: string[] = ['Yes', 'No', 'OK', 'Not OK'];

function workshopPools(index: number) {
    const v = Math.abs(index) % 3;
    return { a: WORKSHOP_3A_POOLS[v], b: WORKSHOP_3B_POOLS[v], c: WORKSHOP_4_POOLS[v] };
}

function buildA5Fields(row: Record<string, any> = {}): Record<string, string> {
    const pick = () => A5_SHARED_SET[Math.floor(Math.random() * A5_SHARED_SET.length)];
    const orPick = (k: string) => row[k] || pick();
    return {
        'a) Have you received Service reminder call': orPick('process_reminder_call'),
        'b) Appointment given': orPick('process_appointment_given'),
        'c) Vehicle test drive taken while making job cards to understand the complaints': orPick('process_test_drive_jobcard'),
        'd) Customer lounge Facilities': orPick('process_customer_lounge'),
        'e) Staff behaviour': orPick('process_staff_behavior'),
        'f) All complaints reported are resolved': orPick('process_complaints_resolved'),
        'g) Fairness of charges': orPick('process_fairness_charges'),
        'h) Explanation of Work done': orPick('process_explanation_work'),
        'i) Washing quality': orPick('process_washing_quality'),
        'j) Test drive offered before billing': orPick('process_test_drive_before_billing')
    };
}

function buildA6ToA11Fields(row: Record<string, any> = {}): Record<string, string | number> {
    const yesNo = () => (Math.random() < 0.5 ? 'Yes' : 'No');
    const a6 = row['post_service_vps_satisfied'] || yesNo();
    let a7: string, a8: string;
    if (a6 === 'Yes') {
        a7 = row['post_service_issues_facing'] || yesNo();
        a8 = row['post_service_reported_advisor'] || yesNo();
    } else {
        a7 = '—';
        a8 = '—';
    }
    const a9 = row['post_service_first_time_right'] || yesNo();
    const a10 = row['post_service_delivery_promised_time'] || yesNo();
    const a11Raw = row['workshop_overall_rating_A11'];
    const a11 = (a11Raw != null && !isNaN(Number(a11Raw)))
        ? Number(a11Raw)
        : [8, 9, 10][Math.floor(Math.random() * 3)];
    return {
        'A6. Are you satisfied with Vehicle Performance after service? (VPS)': a6,
        'A7. Currently are you facing any issues / complaints in vehicle? No of customer not satisfied with vehicle performance after service': a7,
        'A8. Have you reported this issue to the Service advisor during Job card making during your last Visit?': a8,
        'A9. Fixing problems First Time Right': a9,
        'A10. Delivery as per promised time': a10,
        'A11. Overall, how satisfied are you with your experience at our workshop/dealership for servicing your vehicle? (Please rate your satisfaction on a scale of “0 to 10”)': a11
    };
}

/**
 * Generates or maps all Section A fields according to the NPS rating:
 * - 9-10 (Promoters): "Yes", rating, Q2-3 filled, 3a)1..5 with very excellent non-repeating varied contents (3 diverse pools)
 * - 7-8 (Passive): "May be", rating, Q2-2 filled, 3a)1..5 with moderate positive points, 3b.1..5 with content-based "maybe" areas of dissatisfaction / improvements (3 diverse pools)
 * - 0-6 (Detractors): "No", rating, Q2-1 filled, 4)1..5 with non-recommend defect reasons (3 diverse pools), complaint pictures link
 */
function getSectionAFields(row: Record<string, any> = {}, index: number = 0, nps: number = 9): Record<string, any> {
    const rawScore = typeof nps === 'number' ? nps : parseInt(String(nps), 10);
    const score = (!isNaN(rawScore) && rawScore >= 0 && rawScore <= 10) ? rawScore : 9;
    const variant = Math.abs(index) % 3; // 3 distinct pool variations across records

    // 3 distinct pool variations for 9-10 (Promoters - reasons to recommend)
    const excellentPools = [
        [
            "Excellent fuel efficiency",
            "Smooth engine pickup",
            "Comfortable seating",
            "Strong suspension",
            "Low maintenance cost"
        ],
        [
            "High load capacity",
            "Reliable braking",
            "Superb mileage",
            "Stylish modern design",
            "Effortless gear shifting"
        ],
        [
            "Top-class engine reliability",
            "Ergonomic riding posture",
            "Best-in-class fuel economy",
            "High ground clearance",
            "Excellent resale value"
        ]
    ];

    // 3 distinct pool variations for 7-8 (Passive - "May be" / moderate positive points)
    const maybePositivePools = [
        [
            "Decent daily mileage",
            "Acceptable engine pickup",
            "Adequate seating room",
            "Good headlight visibility",
            "Reasonable service cost"
        ],
        [
            "Fair mileage",
            "Stable chassis",
            "Nimble handling",
            "Functional horn",
            "Accessible spare parts"
        ],
        [
            "Satisfactory power",
            "Moderate comfort",
            "Reliable braking",
            "Sufficient ground clearance",
            "Acceptable fuel economy"
        ]
    ];

    // 3 distinct pool variations for 7-8 (Passive - Areas of dissatisfaction / improvements)
    const maybeDissatisfactionPools = [
        [
            "Hard seat cushion",
            "Stiff rear suspension",
            "Dimmer headlight",
            "Stiff gear shifting",
            "Engine vibration at high speed"
        ],
        [
            "Brake lever free play",
            "Mileage drop in traffic",
            "Stiff side stand",
            "Speedometer fluctuation",
            "Hot exhaust guard"
        ],
        [
            "Hard handlebar grips",
            "Vibrating rearview mirrors",
            "Stiff turn signal switch",
            "Frequent clutch cable lube",
            "Worn foot peg rubber"
        ]
    ];

    // 3 distinct pool variations for <= 6 (Detractors - Reasons for not recommending)
    const detractorPools = [
        [
            "Frequent engine stalling",
            "Heavy clutch and gear sticking",
            "Engine oil leak",
            "Abnormal engine knocking",
            "Very poor mileage"
        ],
        [
            "Battery discharging",
            "Headlamp and indicator failures",
            "Severe handlebar vibration",
            "Weak front brake",
            "Back-pain seat"
        ],
        [
            "Premature chassis rusting",
            "Costly spare parts",
            "Leaking rear shock absorber",
            "Faulty speedometer and fuel gauge",
            "Unresolved workshop issues"
        ]
    ];

    const existing3a = Array.isArray(row['3a_reasons_to_recommend']) ? row['3a_reasons_to_recommend'] : [];
    const existing3b = Array.isArray(row['3b_areas_dissatisfaction']) ? row['3b_areas_dissatisfaction'] : [];
    const existing4 = Array.isArray(row['4_reasons_not_recommend']) ? row['4_reasons_not_recommend'] : [];

    const sectionA: Record<string, any> = {};

    const colQ1 = '1. Will you recommend your vehicle to your friends / relatives / family members?';
    const colQ2 = '2. On a scale of 0 to 10, how likely are you to recommend your vehicle to your friends and relatives? (9 & 10 means “Yes Always recommend”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”)';
    const colQ2_1 = 'Q2-1. REASON FOR NOT RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]';
    const colQ2_2 = 'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating 7 (less likely) or 8 (more likely)] below: [May be]';
    const colQ2_3 = 'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating 9 (Will recommend) or 10 (definitely/gladly recommend)] below: [Yes]';

    const col3a = [
        '3a)1 why will you recommend your vehicle?',
        '3a)2 why will you recommend your vehicle?',
        '3a)3 why will you recommend your vehicle?',
        '3a)4 why will you recommend your vehicle?',
        '3a)5 why will you recommend your vehicle?'
    ];

    const col3b = [
        '3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'
    ];

    const colUpload1 = 'Upload complaint pictures';
    const colUpload2 = 'Upload complaint pictures 1';

    const col4 = [
        '4)1 why will you not recommend your vehicle?',
        '4)2 why will you not recommend your vehicle?',
        '4)3 why will you not recommend your vehicle?',
        '4)4 why will you not recommend your vehicle?',
        '4)5 why will you not recommend your vehicle?'
    ];

    if (score >= 9) {
        // 9 & 10: "Yes Always recommend" - Promoter
        sectionA[colQ1] = row[colQ1] || 'Yes';
        sectionA[colQ2] = row[colQ2] || 'Yes';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = '';
        sectionA[colQ2_2] = '';
        sectionA[colQ2_3] = score;

        const pool = excellentPools[variant];
        col3a.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3a[idx] || pool[idx];
        });

        // 3b.1–5 — ALSO filled for Promoters (matches backend behaviour)
        const disPoolPromo = maybeDissatisfactionPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || disPoolPromo[idx];
        });
        sectionA['\r\n3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'] = sectionA[col3b[2]];

        sectionA[colUpload1] = '';
        sectionA[colUpload2] = '';

        col4.forEach(col => {
            sectionA[col] = '';
        });
    } else if (score >= 7) {
        // 7 & 8: "May be recommend" - Passive
        sectionA[colQ1] = row[colQ1] || 'May be';
        sectionA[colQ2] = row[colQ2] || 'May be';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = '';
        sectionA[colQ2_2] = score;
        sectionA[colQ2_3] = '';

        const posPool = maybePositivePools[variant];
        col3a.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3a[idx] || posPool[idx];
        });

        const disPool = maybeDissatisfactionPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || disPool[idx];
        });
        sectionA['\r\n3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'] = sectionA[col3b[2]];

        sectionA[colUpload1] = '—';
        sectionA[colUpload2] = '—';

        col4.forEach(col => {
            sectionA[col] = '';
        });
    } else {
        // 6 and below: "No, definitely not recommend" - Detractor
        sectionA[colQ1] = row[colQ1] || 'No';
        sectionA[colQ2] = row[colQ2] || 'No';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = score;
        sectionA[colQ2_2] = '';
        sectionA[colQ2_3] = '';

        col3a.forEach(col => {
            sectionA[col] = '';
        });

        const detPool = detractorPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || detPool[idx];
        });
        sectionA['\r\n3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'] = sectionA[col3b[2]];

        sectionA[colUpload1] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_A`;
        sectionA[colUpload2] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_B`;

        col4.forEach((col, idx) => {
            sectionA[col] = row[col] || existing4[idx] || detPool[idx];
        });

        sectionA[colUpload1] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_A`;
        sectionA[colUpload2] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_B`;

        col4.forEach((col, idx) => {
            sectionA[col] = row[col] || existing4[idx] || detPool[idx];
        });
    }

    return sectionA;
}

// ============================================================
// Auto-fill Detection Engine:
// Distinguishes AI-parsed survey fields from Auto-filled / derived cells.
// AI-parsed values -> normal white (default)
// Auto-filled values -> light ash / gray background (#e2e8f0 / E2E8F0)
// ============================================================
const ALL_AUTO_FILL_POOL_STRINGS = new Set<string>([
    ...WORKSHOP_3A_POOLS.flat(),
    ...WORKSHOP_3B_POOLS.flat(),
    ...WORKSHOP_4_POOLS.flat(),
    // Promoters (9-10) Pools
    "Excellent fuel efficiency", "Smooth engine pickup", "Comfortable seating", "Strong suspension", "Low maintenance cost",
    "High load capacity", "Reliable braking", "Superb mileage", "Stylish modern design", "Effortless gear shifting",
    "Top-class engine reliability", "Ergonomic riding posture", "Best-in-class fuel economy", "High ground clearance", "Excellent resale value",
    // Passives (7-8) Positive Pools
    "Decent daily mileage", "Acceptable engine pickup", "Adequate seating room", "Good headlight visibility", "Reasonable service cost",
    "Fair mileage", "Stable chassis", "Nimble handling", "Functional horn", "Accessible spare parts",
    "Satisfactory power", "Moderate comfort", "Sufficient ground clearance", "Acceptable fuel economy",
    // Passives (7-8) Dissatisfaction Pools
    "Hard seat cushion", "Stiff rear suspension", "Dimmer headlight", "Stiff gear shifting", "Engine vibration at high speed",
    "Brake lever free play", "Mileage drop in traffic", "Stiff side stand", "Speedometer fluctuation", "Hot exhaust guard",
    "Hard handlebar grips", "Vibrating rearview mirrors", "Stiff turn signal switch", "Frequent clutch cable lube", "Worn foot peg rubber",
    // Detractors (0-6) Pools
    "Frequent engine stalling", "Heavy clutch and gear sticking", "Engine oil leak", "Abnormal engine knocking", "Very poor mileage",
    "Battery discharging", "Headlamp and indicator failures", "Severe handlebar vibration", "Weak front brake", "Back-pain seat",
    "Premature chassis rusting", "Costly spare parts", "Leaking rear shock absorber", "Faulty speedometer and fuel gauge", "Unresolved workshop issues",
    // B-Track pools
    "Far location", "Long waiting time", "High charges", "No pickup & drop", "Limited service hours", "Unclear billing", "Poor communication", "No online booking", "Less service bays",
    // C-Track pools
    "Genuine quality parts", "Easy availability", "Reasonable price", "Long lasting", "Good performance",
    "Trusted brand", "Wide dealer network", "Consistent quality", "Fair pricing", "Ready stock at dealer",
    "Reliable spare parts", "Quick replacement", "Value for money", "Original TVS parts", "Minimal failure rate"
]);

// 19 Product Positive driver categories auto-mapped via NLP (not directly on survey sheet)
const PRODUCT_POSITIVE_DRIVER_COLS = new Set<string>([
    "Brake", "Electrical", "Engine", "Load", "Maintenance",
    "Mileage", "Mirror", "Vehicle", "Seat", "Sound",
    "Roof top (soft top)", "Spare parts", "Style", "Suspension",
    "Tyre", "Vehicle price", "Income", "Windshield", "Brand image"
]);

export function isAutoFilledCell(colName: string, cellVal: any, row?: Record<string, any>): boolean {
    if (cellVal === undefined || cellVal === null || cellVal === '' || cellVal === '—') {
        return false;
    }

    // 1. Explicitly recorded auto-filled keys on row object (if present)
    if (row && (row as any).__autoFilledKeys) {
        const autoKeys = (row as any).__autoFilledKeys;
        if (autoKeys instanceof Set && autoKeys.has(colName)) return true;
        if (Array.isArray(autoKeys) && autoKeys.includes(colName)) return true;
    }

    const trimmedVal = typeof cellVal === 'string' ? cellVal.trim() : String(cellVal);

    // 2. Check if the value comes directly from any auto-fill pool
    if (ALL_AUTO_FILL_POOL_STRINGS.has(trimmedVal)) {
        return true;
    }

    // 3. Positive driver categories mapped via NLP (Brake, Electrical, Engine, etc.)
    if (PRODUCT_POSITIVE_DRIVER_COLS.has(colName)) {
        return true;
    }

    // 4. Page 2 A5 Service process questions (a through j)
    if (/^[a-j]\)\s+/i.test(colName)) {
        return true;
    }

    // 5. Page 3 A6 through A11 Post-Service Satisfaction & VPS
    if (/^A[6-9]\.\s+/i.test(colName) || /^A1[01]\.\s+/i.test(colName)) {
        return true;
    }

    // 6. B-track reasons & quality score
    if (/^B[1-3]\.\s+/i.test(colName)) {
        return true;
    }

    // 7. C-track TVS Genuine Spare Parts
    if (/^(1-)?C[1-5](\.|\s+)/i.test(colName) || colName.toLowerCase().includes('tvs genuine spare parts')) {
        return true;
    }

    // 8. L2 Complaint groups
    if (colName.includes('Complaint group (L2)')) {
        return true;
    }

    // 9. Defect probing questions & follow-ups (EP through OJ columns)
    const lowerCol = colName.toLowerCase();
    if (
        lowerCol.includes('drum overheating') ||
        lowerCol.includes('brake bite') ||
        lowerCol.includes('brake noise') ||
        lowerCol.includes('brake lever free play') ||
        lowerCol.includes('cable broken') ||
        lowerCol.includes('chain noise') ||
        lowerCol.includes('chain case') ||
        lowerCol.includes('gear shifting') ||
        lowerCol.includes('neutral') ||
        lowerCol.includes('engine noise') ||
        lowerCol.includes('engine heat') ||
        lowerCol.includes('engine oil leak') ||
        lowerCol.includes('handle bar vibration') ||
        lowerCol.includes('stand problem') ||
        lowerCol.includes('tsl (indicator)') ||
        lowerCol.includes('head light') ||
        lowerCol.includes('speedometer') ||
        lowerCol.includes('horn issues') ||
        lowerCol.includes('clutch hard')
    ) {
        return true;
    }

    // 10. Workshop Drivers (L2/L3 positive & negative mappings)
    const workshopPositiveL2s = [
        "Resolution of Problem", "Parts availability", "Skilled Manpower", "Washing Quality",
        "Service Adviser Behavior", "Cost & Explanation", "Warranty Policy", "Waiting Time",
        "Customer Lounge Amenities", "Operating Hours", "Workshop Facilities"
    ];
    if (workshopPositiveL2s.some(l2 => colName === l2 || colName.startsWith(`${l2} `))) {
        return true;
    }

    return false;
}

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

interface NpsAnalyzerProps {
    onNavigateToDataSources?: () => void;
}

function calculateStatsFromRows(rows: any[]): LiveStats {
    if (!rows || rows.length === 0) {
        return { processed: 0, promoters: 0, passives: 0, detractors: 0, netNps: 0, matchRate: 100 };
    }
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    rows.forEach(r => {
        const scoreVal = r['2. Likely to recommend vehicle (0-10)'] ?? r['Q2'] ?? r['Likely to recommend vehicle (0-10)'];
        const score = Number(scoreVal);
        if (!isNaN(score)) {
            if (score >= 9) promoters++;
            else if (score >= 7) passives++;
            else detractors++;
        } else {
            passives++;
        }
    });
    const total = rows.length;
    const netNps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    return {
        processed: total,
        promoters,
        passives,
        detractors,
        netNps,
        matchRate: 100
    };
}

const NpsAnalyzer: React.FC<NpsAnalyzerProps> = ({ onNavigateToDataSources }) => {
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
        } catch { }
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

    // Common Data Sources & Dependent Filter State
    const [regions, setRegions] = useState<RegionItem[]>([]);
    const [countries, setCountries] = useState<CountryItem[]>([]);
    const [ibVersions, setIbVersions] = useState<IbVersionItem[]>([]);
    const [commonFiles, setCommonFiles] = useState<CommonUploadItem[]>([]);
    const [isLoadingFileList, setIsLoadingFileList] = useState<boolean>(false);

    const [filterRegion, setFilterRegion] = useState<string>('all');
    const [filterCountry, setFilterCountry] = useState<string>('all');
    const [filterIbVersion, setFilterIbVersion] = useState<string>('all');
    const [selectedFileId, setSelectedFileId] = useState<string>('');

    // Modal state for "Parse New PDF → Save as Common Upload"
    const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
    const [modalFiles, setModalFiles] = useState<File[]>([]);
    const [modalRegion, setModalRegion] = useState<string>('Middle East');
    const [modalCountry, setModalCountry] = useState<string>('Guinea');
    const [modalIbVersion, setModalIbVersion] = useState<string>('v2.4');
    const [modalDossierMode, setModalDossierMode] = useState<'file' | 'dossier-4' | 'page'>('file');
    const [modalIsProcessing, setModalIsProcessing] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string>('');
    const [modalSuccessMsg, setModalSuccessMsg] = useState<string>('');
    const modalFileInputRef = useRef<HTMLInputElement>(null);

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

    // Persistence / Dirty State
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [pendingEditsCount, setPendingEditsCount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
    const pendingEditsRef = useRef<Map<string, { rowIndex: number; column: string; value: any; columnLetter?: string }>>(new Map());


    // Load file from Common Repository (GET /api/uploads/:id/data)
    const loadFileData = async (fileIdToLoad: number | string) => {
        if (!fileIdToLoad) return;
        setIsLoading(true);
        setError('');

        try {
            const result = await getUploadData(fileIdToLoad);
            const loadedCols = result.columns && result.columns.length > 0 ? result.columns : GUINEA_COLUMNS_449;
            const loadedRows = result.rows || [];

            if (loadedRows.length === 0) {
                setError(`File "${result.file_name}" does not contain any data rows.`);
                setIsLoading(false);
                return;
            }

            setColumns(loadedCols);
            setData(loadedRows);
            setFileName(result.file_name);
            setCurrentPage(1);

            const visInit: Record<string, boolean> = {};
            loadedCols.forEach((c: string) => { visInit[c] = true; });
            setVisibleCols(visInit);

            setLiveStats(calculateStatsFromRows(loadedRows));

            sessionStorage.setItem('activeFile_NPS', String(fileIdToLoad));
            setSelectedFileId(String(fileIdToLoad));

            setHasUnsavedChanges(false);
            pendingEditsRef.current.clear();
            setPendingEditsCount(0);
            setSaveSuccessMsg('');
        } catch (err: any) {
            console.error('Error loading common file data:', err);
            setError(err.response?.data?.error || err.message || 'Failed to load file data from repository.');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial load: Fetch master dropdowns & common uploaded files
    useEffect(() => {
        let isMounted = true;
        setIsLoadingFileList(true);

        Promise.all([getRegions(), getIbVersions(), getCommonUploads()])
            .then(([regs, vers, files]) => {
                if (!isMounted) return;
                setRegions(regs);
                setIbVersions(vers);
                setCommonFiles(files);

                // Check if an active file was previously selected or stored in sessionStorage
                const storedId = sessionStorage.getItem('activeFile_NPS');
                let targetId = storedId;
                if (!targetId && files.length > 0) {
                    targetId = String(files[0].id);
                }

                if (targetId) {
                    setSelectedFileId(targetId);
                    loadFileData(targetId);
                }
            })
            .catch(err => console.error('Failed to load common data sources for AI Data Entry:', err))
            .finally(() => {
                if (isMounted) setIsLoadingFileList(false);
            });

        return () => { isMounted = false; };
    }, []);

    // Dependent Countries: Update when filterRegion changes
    useEffect(() => {
        if (!filterRegion || filterRegion === 'all') {
            getCountries()
                .then(data => setCountries(data))
                .catch(err => console.error('Error fetching countries:', err));
        } else {
            const matchReg = regions.find(r => r.name.toLowerCase() === filterRegion.toLowerCase());
            getCountries(matchReg ? matchReg.id : undefined, filterRegion)
                .then(data => setCountries(data))
                .catch(err => console.error('Error fetching countries:', err));
        }
    }, [filterRegion, regions]);

    // Filter available common files based on Region, Country, IB Version
    const filteredCommonFiles = useMemo(() => {
        return commonFiles.filter(f => {
            if (filterRegion !== 'all' && f.region_name.toLowerCase() !== filterRegion.toLowerCase()) return false;
            if (filterCountry !== 'all' && f.country_name.toLowerCase() !== filterCountry.toLowerCase()) return false;
            if (filterIbVersion !== 'all' && f.ib_version_name.toLowerCase() !== filterIbVersion.toLowerCase()) return false;
            return true;
        });
    }, [commonFiles, filterRegion, filterCountry, filterIbVersion]);

    // Auto-select first matching file when filter changes if current selection is not in list
    useEffect(() => {
        if (filteredCommonFiles.length > 0) {
            const currentMatch = filteredCommonFiles.find(f => String(f.id) === String(selectedFileId));
            if (!currentMatch) {
                setSelectedFileId(String(filteredCommonFiles[0].id));
            }
        } else {
            setSelectedFileId('');
        }
    }, [filteredCommonFiles]);

    // Modal filtered countries
    const modalFilteredCountries = useMemo(() => {
        if (!modalRegion) return countries;
        const matchReg = regions.find(r => r.name.toLowerCase() === modalRegion.toLowerCase());
        if (!matchReg) return countries;
        return countries.filter(c => c.region_id === matchReg.id || c.region === matchReg.name);
    }, [modalRegion, countries, regions]);

    // Modal extraction handler: runs SSE stream, then posts to /api/uploads
    const handleProcessPdfModal = async () => {
        if (modalFiles.length === 0) {
            setModalError('Please select at least one PDF or ZIP document.');
            return;
        }

        setModalIsProcessing(true);
        setModalError('');
        setModalSuccessMsg('');

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const formData = new FormData();
        modalFiles.forEach(file => {
            formData.append('files', file);
        });
        formData.append('mode', modalDossierMode);

        const extractedRows: any[] = [];
        let extractedCols: string[] = GUINEA_COLUMNS_449;

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
                        if (eventType === 'record') {
                            extractedRows.push(payload.row);
                            setProgress({
                                isActive: true,
                                current: payload.index,
                                total: payload.total,
                                percent: Math.round((payload.index / payload.total) * 100),
                                label: `Extracting record ${payload.index} of ${payload.total}...`,
                                stopped: false
                            });
                            if (payload.stats) setLiveStats(payload.stats);
                        } else if (eventType === 'done') {
                            if (payload.stats) setLiveStats(payload.stats);
                        } else if (eventType === 'error') {
                            throw new Error(payload.error || 'Batch analysis error occurred.');
                        }
                    } catch (parseErr: any) {
                        console.warn('SSE parse error:', parseErr);
                    }
                }
            }

            if (extractedRows.length === 0) {
                throw new Error('No records were extracted from the uploaded document(s).');
            }

            // Save to Common Repository via POST /api/uploads
            const uploadPayload = new FormData();
            const uploadFileName = modalFiles.length === 1
                ? modalFiles[0].name.replace(/\.[^/.]+$/, "") + "_Extracted.xlsx"
                : `Batch_Extraction_${modalFiles.length}_Files.xlsx`;

            uploadPayload.append('file_name', uploadFileName);
            uploadPayload.append('region_name', modalRegion);
            uploadPayload.append('country_name', modalCountry);
            uploadPayload.append('ib_version_name', modalIbVersion);
            uploadPayload.append('total_records', String(extractedRows.length));
            uploadPayload.append('columns', JSON.stringify(extractedCols));
            uploadPayload.append('rows', JSON.stringify(extractedRows));
            uploadPayload.append('is_common', 'true');
            uploadPayload.append('status', 'Completed');

            const saveResult = await uploadCommonFile(uploadPayload);

            // Update UI state with new data
            setData(extractedRows);
            setColumns(extractedCols);
            setFileName(uploadFileName);
            const visInit: Record<string, boolean> = {};
            extractedCols.forEach(c => { visInit[c] = true; });
            setVisibleCols(visInit);

            // Refresh common files
            const updatedFiles = await getCommonUploads();
            setCommonFiles(updatedFiles);

            if (saveResult && saveResult.id) {
                setSelectedFileId(String(saveResult.id));
                sessionStorage.setItem('activeFile_NPS', String(saveResult.id));
            }

            setModalSuccessMsg(`Successfully extracted ${extractedRows.length} records and saved as Common Repository file "${uploadFileName}"!`);
            setTimeout(() => {
                setShowPdfModal(false);
                setModalFiles([]);
                setModalSuccessMsg('');
            }, 1800);

        } catch (err: any) {
            console.error('Modal PDF extraction error:', err);
            setModalError(err.message || 'Failed to extract and save PDF.');
        } finally {
            setModalIsProcessing(false);
            setProgress(prev => ({ ...prev, isActive: false }));
        }
    };

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

    const updateCellValue = React.useCallback((globalRowIdx: number, colName: string, newValue: string) => {
        setData(prev => {
            if (globalRowIdx < 0 || globalRowIdx >= prev.length) return prev;
            const next = prev.slice();
            next[globalRowIdx] = { ...next[globalRowIdx], [colName]: newValue };

            // Recompute stats on cell edit
            setLiveStats(calculateStatsFromRows(next));

            // Track edit for MongoDB / SurveyResponse persistence
            const colLetter = getExcelColumnLetter(colName);
            pendingEditsRef.current.set(`${globalRowIdx}_${colName}`, {
                rowIndex: globalRowIdx,
                column: colName,
                value: newValue,
                columnLetter: colLetter
            });
            setHasUnsavedChanges(true);
            setPendingEditsCount(pendingEditsRef.current.size);
            setSaveSuccessMsg('');

            return next;
        });
    }, []);

    // Save changes back to database (PUT /api/uploads/:id/data -> updates SurveyResponse & full_data)
    const handleSaveChanges = async () => {
        if (!selectedFileId || !hasUnsavedChanges || isSaving) return;
        setIsSaving(true);
        setError('');
        setSaveSuccessMsg('');

        try {
            const edits = Array.from(pendingEditsRef.current.values());
            await updateUploadData(selectedFileId, {
                rows: data,
                edits
            });

            setHasUnsavedChanges(false);
            pendingEditsRef.current.clear();
            setPendingEditsCount(0);
            setSaveSuccessMsg('All edits saved to database successfully!');
            setTimeout(() => setSaveSuccessMsg(''), 4000);
        } catch (err: any) {
            console.error('Failed to save changes to database:', err);
            setError(err.response?.data?.error || err.message || 'Failed to save changes to database.');
        } finally {
            setIsSaving(false);
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
            const mappedSamples = SAMPLE_EXTRACTED_PDF_ROWS.map((r: any, idx: number) => {
                const positiveMap = mapPositiveDrivers([
                    r['3a)1 why will you recommend your vehicle?'],
                    r['3a)2 why will you recommend your vehicle?'],
                    r['3a)3 why will you recommend your vehicle?'],
                    r['3a)4 why will you recommend your vehicle?'],
                    r['3a)5 why will you recommend your vehicle?']
                ]);
                const negMap = mapNegativeDetractors(
                    [
                        r['3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        r['3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        r['3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        r['3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        r['3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?']
                    ],
                    [
                        r['4)1 why will you not recommend your vehicle?'],
                        r['4)2 why will you not recommend your vehicle?'],
                        r['4)3 why will you not recommend your vehicle?'],
                        r['4)4 why will you not recommend your vehicle?'],
                        r['4)5 why will you not recommend your vehicle?']
                    ],
                    {},
                    idx
                );
                const wsDrivers = mapWorkshopDrivers(
                    {
                        '3a)1 Which experience you like the most to recommend Workshop / Dealer?': r['3a)1 Which experience you like the most to recommend Workshop / Dealer?'],
                        '3a)2 Which experience you like the most to recommend Workshop / Dealer?': r['3a)2 Which experience you like the most to recommend Workshop / Dealer?'],
                        '3a)3 Which experience you like the most to recommend Workshop / Dealer?': r['3a)3 Which experience you like the most to recommend Workshop / Dealer?'],
                        '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': r['3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'],
                        '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': r['3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'],
                        '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': r['3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'],
                        '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': r['4)1 What are the main reasons for you have not recommend Workshop / Dealer?'],
                        '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': r['4)2 What are the main reasons for you have not recommend Workshop / Dealer?'],
                        '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': r['4)3 What are the main reasons for you have not recommend Workshop / Dealer?']
                    },
                    idx,
                    {},
                    {}
                );
                const autoKeys = [
                    ...Object.keys(positiveMap),
                    ...Object.keys(negMap.l2Slots),
                    ...Object.keys(negMap.l3Values),
                    ...Object.keys(negMap.followups),
                    ...Object.keys(wsDrivers.positive),
                    ...Object.keys(wsDrivers.negative)
                ];
                return orderColumns({
                    ...r,
                    ...positiveMap,
                    ...negMap.l2Slots,
                    ...negMap.l3Values,
                    ...negMap.followups,
                    ...wsDrivers.positive,
                    ...wsDrivers.negative,
                    __autoFilledKeys: autoKeys
                });
            });
            setColumns(GUINEA_COLUMNS_449);
            setData(mappedSamples);
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
            const wsNps = score; // reuse same score as workshop NPS for demo variety
            const wPools = workshopPools(currentIdx - 1);
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

            const base449: Record<string, any> = {};
            for (const c of GUINEA_COLUMNS_449) {
                base449[c] = '';
            }
            const secA = getSectionAFields({}, currentIdx - 1, score);
            const negMap = mapNegativeDetractors(
                [
                    secA['3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                    secA['3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                    secA['3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                    secA['3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                    secA['3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?']
                ],
                [
                    secA['4)1 why will you not recommend your vehicle?'],
                    secA['4)2 why will you not recommend your vehicle?'],
                    secA['4)3 why will you not recommend your vehicle?'],
                    secA['4)4 why will you not recommend your vehicle?'],
                    secA['4)5 why will you not recommend your vehicle?']
                ],
                {},
                currentIdx
            );
            const positiveMap = mapPositiveDrivers([
                secA['3a)1 why will you recommend your vehicle?'],
                secA['3a)2 why will you recommend your vehicle?'],
                secA['3a)3 why will you recommend your vehicle?'],
                secA['3a)4 why will you recommend your vehicle?'],
                secA['3a)5 why will you recommend your vehicle?']
            ]);

            const wsDrivers = mapWorkshopDrivers(
                {
                    '3a)1 Which experience you like the most to recommend Workshop / Dealer?': secA['3a)1 Which experience you like the most to recommend Workshop / Dealer?'] || (wsNps >= 7 ? wPools.a[0] : ''),
                    '3a)2 Which experience you like the most to recommend Workshop / Dealer?': secA['3a)2 Which experience you like the most to recommend Workshop / Dealer?'] || (wsNps >= 7 ? wPools.a[1] : ''),
                    '3a)3 Which experience you like the most to recommend Workshop / Dealer?': secA['3a)3 Which experience you like the most to recommend Workshop / Dealer?'] || (wsNps >= 7 ? wPools.a[2] : ''),
                    '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': secA['3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'] || (wsNps >= 7 ? wPools.b[0] : ''),
                    '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': secA['3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'] || (wsNps >= 7 ? wPools.b[1] : ''),
                    '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': secA['3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'] || (wsNps >= 7 ? wPools.b[2] : ''),
                    '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': secA['4)1 What are the main reasons for you have not recommend Workshop / Dealer?'] || (wsNps < 7 ? wPools.c[0] : ''),
                    '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': secA['4)2 What are the main reasons for you have not recommend Workshop / Dealer?'] || (wsNps < 7 ? wPools.c[1] : ''),
                    '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': secA['4)3 What are the main reasons for you have not recommend Workshop / Dealer?'] || (wsNps < 7 ? wPools.c[2] : '')
                },
                currentIdx - 1,
                {},
                {}
            );

            const simRow = orderColumns({
                '#': currentIdx,
                ...base449,
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
                ...secA,
                ...negMap.l2Slots,
                ...negMap.l3Values,
                ...negMap.followups,
                ...positiveMap,
                // Page 2 Workshop A-section (3a)1–3, 3b)1–3, 4)1–3
                ...(wsNps >= 9 ? {
                    'Q2-4. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating from 9 (will recommend) to 10 (definitely/gladly recommend)] below: [Yes]': wsNps,
                    '3a)1 Which experience you like the most to recommend Workshop / Dealer?': wPools.a[0],
                    '3a)2 Which experience you like the most to recommend Workshop / Dealer?': wPools.a[1],
                    '3a)3 Which experience you like the most to recommend Workshop / Dealer?': wPools.a[2]
                } : wsNps >= 7 ? {
                    'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating from 7 (less likely recommend) to 8 (more likely recommend)] below: [May be]': wsNps,
                    '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': wPools.b[0],
                    '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': wPools.b[1],
                    '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': wPools.b[2]
                } : {
                    'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]': wsNps,
                    '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': wPools.c[0],
                    '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': wPools.c[1],
                    '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': wPools.c[2]
                }),
                ...wsDrivers.positive,
                ...wsDrivers.negative,
                // Page 2 A5 a–j + Page 3 A6–A11 (simulator has no AI row, so all random)
                ...buildA5Fields({}),
                ...buildA6ToA11Fields({}),
                'GPS Watermark Location': `${loc}, Guinea`,
                'GPS Coordinates': `9.6412, -13.5784`,
                __autoFilledKeys: [
                    ...Object.keys(positiveMap),
                    ...Object.keys(negMap.l2Slots),
                    ...Object.keys(negMap.l3Values),
                    ...Object.keys(negMap.followups),
                    ...Object.keys(wsDrivers.positive),
                    ...Object.keys(wsDrivers.negative),
                    ...Object.keys(buildA5Fields({})),
                    ...Object.keys(buildA6ToA11Fields({})),
                    '3a)1 Which experience you like the most to recommend Workshop / Dealer?',
                    '3a)2 Which experience you like the most to recommend Workshop / Dealer?',
                    '3a)3 Which experience you like the most to recommend Workshop / Dealer?',
                    '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
                    '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
                    '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
                    '4)1 What are the main reasons for you have not recommend Workshop / Dealer?',
                    '4)2 What are the main reasons for you have not recommend Workshop / Dealer?',
                    '4)3 What are the main reasons for you have not recommend Workshop / Dealer?'
                ]
            });

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
            activeOrderedCols.forEach((c, cIdx) => {
                const letter = getExcelColumnLetter(c, cIdx);
                const cellVal = (row[c] !== undefined && row[c] !== '')
                    ? row[c]
                    : (letter && row[letter] !== undefined ? row[letter] : '');
                exp[c] = cellVal;
            });
            return exp;
        });

        const ws = XLSX.utils.json_to_sheet(exportData, { header: activeOrderedCols });

        // Set column widths based on content
        ws['!cols'] = activeOrderedCols.map(col => ({
            wch: Math.min(Math.max(col.length + 3, 14), 45)
        }));

        // Set frozen header row
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Style header row (Row 0 in 0-indexed API)
        activeOrderedCols.forEach((colName, cIdx) => {
            const cellRef = XLSX.utils.encode_cell({ c: cIdx, r: 0 });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    fill: {
                        patternType: "solid",
                        fgColor: { rgb: "1E293B" } // Dark slate header
                    },
                    font: {
                        name: "Calibri",
                        sz: 11,
                        bold: true,
                        color: { rgb: "FFFFFF" }
                    },
                    alignment: {
                        vertical: "center",
                        horizontal: "center",
                        wrapText: false
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "475569" } },
                        bottom: { style: "medium", color: { rgb: "0F172A" } },
                        left: { style: "thin", color: { rgb: "334155" } },
                        right: { style: "thin", color: { rgb: "334155" } }
                    }
                };
            }
        });

        // Style each data cell:
        // AI-parsed values -> normal white (default) (#FFFFFF)
        // Auto-filled values -> light ash / gray background (#E2E8F0)
        filtered.forEach((row, rIdx) => {
            activeOrderedCols.forEach((colName, cIdx) => {
                const cellRef = XLSX.utils.encode_cell({ c: cIdx, r: rIdx + 1 });
                const letter = getExcelColumnLetter(colName, cIdx);
                const cellVal = (row[colName] !== undefined && row[colName] !== '')
                    ? row[colName]
                    : (letter && row[letter] !== undefined ? row[letter] : '');

                const isAuto = isAutoFilledCell(colName, cellVal, row);

                if (!ws[cellRef]) {
                    ws[cellRef] = { t: 's', v: '' };
                }

                ws[cellRef].s = {
                    fill: {
                        patternType: "solid",
                        fgColor: { rgb: isAuto ? "E2E8F0" : "FFFFFF" }
                    },
                    font: {
                        name: "Calibri",
                        sz: 11,
                        color: { rgb: isAuto ? "334155" : "0F172A" }
                    },
                    alignment: {
                        vertical: "center"
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "CBD5E1" } },
                        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                        left: { style: "thin", color: { rgb: "CBD5E1" } },
                        right: { style: "thin", color: { rgb: "CBD5E1" } }
                    }
                };
            });
        });

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

    // Filtered Rows based on search & stable global row index mapping
    const filteredIndices: number[] = [];
    data.forEach((row, i) => {
        const hit = Object.values(row).some(v => String(v).toLowerCase().includes(searchText.toLowerCase()));
        if (hit) filteredIndices.push(i);
    });
    const pageSize = 50;
    const pageStart = (currentPage - 1) * pageSize;
    const paginatedIndices = filteredIndices.slice(pageStart, pageStart + pageSize);
    const totalPages = Math.ceil(filteredIndices.length / pageSize) || 1;
    const filteredData = filteredIndices.map(idx => data[idx]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: data.length > 0 ? '12px' : '20px', width: '100%' }}>
            {/* Top Filter Bar for Common Repository */}
            <div
                className="glass-panel"
                style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    flexShrink: 0
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                        }}>
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--color-text)' }}>
                                    AI Data Entry & Survey Inspector
                                </h3>
                                <span className="modern-badge modern-badge-success" style={{ fontSize: '11px', padding: '1px 8px' }}>
                                    Common Repository
                                </span>
                                {fileName && (
                                    <span style={{
                                        fontSize: '12px',
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        border: '1px solid #bbf7d0',
                                        padding: '1px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 600
                                    }}>
                                        Active File: {fileName}
                                    </span>
                                )}
                            </div>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: '2px 0 0 0' }}>
                                Select from common uploaded repository files to view and inspect customer feedback & NPS records.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {saveSuccessMsg && (
                            <span style={{
                                fontSize: '11.5px',
                                color: '#16a34a',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600
                            }}>
                                <CheckCircle2 size={12} /> {saveSuccessMsg}
                            </span>
                        )}

                        <button
                            type="button"
                            className="modern-btn"
                            onClick={handleSaveChanges}
                            disabled={!hasUnsavedChanges || isSaving || !selectedFileId}
                            style={{
                                padding: '7px 15px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                background: hasUnsavedChanges ? 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' : '#f1f5f9',
                                color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
                                border: hasUnsavedChanges ? 'none' : '1px solid #e2e8f0',
                                cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed',
                                boxShadow: hasUnsavedChanges ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                            title={hasUnsavedChanges ? `Save ${pendingEditsCount} unsaved cell edits to MongoDB database` : 'No unsaved edits'}
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    Save Changes {hasUnsavedChanges && `(${pendingEditsCount})`}
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            className="modern-btn modern-btn-primary"
                            onClick={() => setShowPdfModal(true)}
                            style={{ padding: '7px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', border: 'none' }}
                            title="Extract a new PDF / ZIP and add it directly to the common repository"
                        >
                            <Sparkles size={14} /> Parse New PDF → Save as Common Upload
                        </button>
                        {onNavigateToDataSources && (
                            <button
                                type="button"
                                className="modern-btn modern-btn-outline"
                                onClick={onNavigateToDataSources}
                                style={{ padding: '7px 12px', fontSize: '12px' }}
                                title="Go to Data Sources tab to upload or manage common files"
                            >
                                <Database size={13} /> Manage Data Sources
                            </button>
                        )}
                    </div>
                </div>

                </div>
                {/* Dependent Dropdowns Filter Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    alignItems: 'flex-end'
                }}>
                    {/* Region */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Region
                        </label>
                        <select
                            value={filterRegion}
                            onChange={e => {
                                setFilterRegion(e.target.value);
                                setFilterCountry('all');
                            }}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="all">All Regions</option>
                            {regions.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Country (dependent on Region) */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Country
                        </label>
                        <select
                            value={filterCountry}
                            onChange={e => setFilterCountry(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="all">All Countries</option>
                            {countries.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* IB Version */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            IB Version
                        </label>
                        <select
                            value={filterIbVersion}
                            onChange={e => setFilterIbVersion(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="all">All Versions</option>
                            {ibVersions.map(v => (
                                <option key={v.id} value={v.name}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* File Selection */}
                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Select File ({filteredCommonFiles.length})
                        </label>
                        <select
                            value={selectedFileId}
                            onChange={e => setSelectedFileId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="">-- Choose Uploaded File --</option>
                            {filteredCommonFiles.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.file_name} ({f.total_records} rows · {f.region_name} · {f.country_name})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Load Button */}
                    <div>
                        <button
                            type="button"
                            className="modern-btn modern-btn-primary"
                            onClick={() => loadFileData(selectedFileId)}
                            disabled={!selectedFileId || isLoading}
                            style={{ padding: '7px 16px', fontSize: '12.5px', width: '100%' }}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <FolderOpen size={14} />
                                    Load File
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Empty State when no common files exist in repository */}
            {!isLoading && commonFiles.length === 0 && !isLoadingFileList && (
                <div className="glass-panel" style={{
                    padding: '36px 24px',
                    textAlign: 'center',
                    borderRadius: '12px',
                    background: '#ffffff',
                    flexShrink: 0
                }}>
                    <Database size={36} color="#94a3b8" style={{ marginBottom: '10px' }} />
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                        No common files uploaded yet
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                        Go to the Data Sources tab to upload an Excel file.
                    </p>
                    {onNavigateToDataSources && (
                        <button
                            type="button"
                            className="modern-btn modern-btn-primary"
                            onClick={onNavigateToDataSources}
                            style={{ padding: '8px 18px', fontSize: '13px' }}
                        >
                            <Database size={15} /> Go to Data Sources
                        </button>
                    )}
                </div>
            )}

            {/* Modal: Parse New PDF -> Save as Common Upload */}
            {showPdfModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '20px'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '640px',
                        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        maxHeight: '90vh'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '18px 24px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff'
                                }}>
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        Parse New PDF → Save as Common Upload
                                    </h3>
                                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                        Extract surveys via AI pipeline and store directly in common repository
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!modalIsProcessing) setShowPdfModal(false);
                                }}
                                disabled={modalIsProcessing}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: modalIsProcessing ? 'not-allowed' : 'pointer',
                                    color: '#94a3b8',
                                    padding: '4px'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {modalError && (
                                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertTriangle size={16} />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            {modalSuccessMsg && (
                                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle2 size={16} />
                                    <span>{modalSuccessMsg}</span>
                                </div>
                            )}

                            {/* Hidden file input */}
                            <input
                                ref={modalFileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.zip"
                                onChange={e => {
                                    if (e.target.files) {
                                        setModalFiles(Array.from(e.target.files));
                                    }
                                }}
                                style={{ display: 'none' }}
                            />

                            {/* Dropzone */}
                            <div
                                onClick={() => {
                                    if (!modalIsProcessing) modalFileInputRef.current?.click();
                                }}
                                style={{
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    background: modalFiles.length > 0 ? '#f0fdf4' : '#f8fafc',
                                    cursor: modalIsProcessing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <UploadCloud size={32} color={modalFiles.length > 0 ? '#16a34a' : '#64748b'} style={{ marginBottom: '8px' }} />
                                {modalFiles.length > 0 ? (
                                    <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#15803d' }}>
                                            {modalFiles.length === 1 ? modalFiles[0].name : `${modalFiles.length} files selected`}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px' }}>
                                            Click to change document(s)
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>
                                            Click to browse PDF or ZIP survey files
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                            Supports single or multi-page customer feedback documents
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Metadata Dropdowns */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Region
                                    </label>
                                    <select
                                        value={modalRegion}
                                        onChange={e => setModalRegion(e.target.value)}
                                        disabled={modalIsProcessing}
                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                    >
                                        {regions.map(r => (
                                            <option key={r.id} value={r.name}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Country
                                    </label>
                                    <select
                                        value={modalCountry}
                                        onChange={e => setModalCountry(e.target.value)}
                                        disabled={modalIsProcessing}
                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                    >
                                        {modalFilteredCountries.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        IB Version
                                    </label>
                                    <select
                                        value={modalIbVersion}
                                        onChange={e => setModalIbVersion(e.target.value)}
                                        disabled={modalIsProcessing}
                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                    >
                                        {ibVersions.map(v => (
                                            <option key={v.id} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Dossier Mode */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                    Document Layout Mode
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[
                                        { key: 'file', label: '📁 1 Record / File' },
                                        { key: 'dossier-4', label: '📑 4 Pages / Dossier' },
                                        { key: 'page', label: '📄 1 Record / Page' }
                                    ].map(mode => (
                                        <button
                                            key={mode.key}
                                            type="button"
                                            disabled={modalIsProcessing}
                                            onClick={() => setModalDossierMode(mode.key as any)}
                                            style={{
                                                flex: 1,
                                                padding: '7px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                border: modalDossierMode === mode.key ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                                background: modalDossierMode === mode.key ? '#eff6ff' : '#ffffff',
                                                color: modalDossierMode === mode.key ? '#1d4ed8' : '#64748b',
                                                cursor: modalIsProcessing ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Processing Progress Bar */}
                            {modalIsProcessing && (
                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', fontWeight: 600, marginBottom: '6px' }}>
                                        <span>{progress.label || 'Processing documents...'}</span>
                                        <span>{progress.percent}%</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${progress.percent}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #7c3aed)', transition: 'width 0.2s' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '14px 24px',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            background: '#f8fafc'
                        }}>
                            <button
                                type="button"
                                className="modern-btn modern-btn-outline"
                                onClick={() => setShowPdfModal(false)}
                                disabled={modalIsProcessing}
                                style={{ padding: '7px 14px', fontSize: '12.5px' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="modern-btn modern-btn-primary"
                                onClick={handleProcessPdfModal}
                                disabled={modalIsProcessing || modalFiles.length === 0}
                                style={{
                                    padding: '7px 18px',
                                    fontSize: '12.5px',
                                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                {modalIsProcessing ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Extracting & Saving...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={13} />
                                        Extract & Save as Common File
                                    </>
                                )}
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
                            {/* Visual Legend for AI-parsed vs Auto-filled */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '12px',
                                background: '#ffffff',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}>
                                <span style={{ fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    Legend:
                                </span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '13px', height: '13px', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: '3px', display: 'inline-block' }}></span>
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>AI-Parsed (White)</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '13px', height: '13px', background: '#e2e8f0', border: '1.5px solid #94a3b8', borderRadius: '3px', display: 'inline-block' }}></span>
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>Auto-Filled (Light Ash)</span>
                                </div>
                            </div>

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

                                {/* Save Changes Button in Table Header */}
                                <button
                                    type="button"
                                    onClick={handleSaveChanges}
                                    disabled={!hasUnsavedChanges || isSaving || !selectedFileId}
                                    className={hasUnsavedChanges ? 'modern-btn modern-btn-primary' : 'modern-btn modern-btn-outline'}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        background: hasUnsavedChanges ? '#16a34a' : undefined,
                                        borderColor: hasUnsavedChanges ? '#15803d' : undefined,
                                        color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
                                        cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed'
                                    }}
                                    title={hasUnsavedChanges ? `Save ${pendingEditsCount} unsaved cell edits to MongoDB database` : 'No unsaved edits'}
                                >
                                    {isSaving ? (
                                        <><RefreshCw size={12} className="animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save size={13} /> Save Changes {hasUnsavedChanges && `(${pendingEditsCount})`}</>
                                    )}
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
                                                        title={NPS_CELL_OPTIONS[col]?.join('\n') || col}
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
                                                        <div>{col}</div>
                                                        {NPS_CELL_OPTIONS[col] && (
                                                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#7c3aed', padding: '2px 6px', margin: '4px 8px 6px', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.12)', display: 'inline-block' }}>
                                                                ▼ {NPS_CELL_OPTIONS[col].length} options
                                                            </div>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedIndices.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '14px' }}>
                                                No records match your search filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedIndices.map((globalRowIdx, i) => {
                                            const row = data[globalRowIdx];
                                            if (!row) return null;
                                            const isEven = i % 2 === 0;
                                            return (
                                                <tr key={globalRowIdx} style={{ background: isEven ? '#ffffff' : '#f8fafc' }} className="excel-matrix-row">
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
                                                        {globalRowIdx + 1}
                                                    </td>
                                                    {columns.map((col, j) => {
                                                        if (visibleCols[col] === false) return null;
                                                        const letter = getExcelColumnLetter(col, j);
                                                        const cellVal = (row[col] !== undefined && row[col] !== '')
                                                            ? row[col]
                                                            : (letter && row[letter] !== undefined ? row[letter] : '');
                                                        const strVal = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';

                                                        const cellOpts = NPS_CELL_OPTIONS[col];
                                                        const isDropdownCell = Array.isArray(cellOpts) && cellOpts.length > 0;

                                                        const isSentimentCol = col.toLowerCase().includes('sentiment');
                                                        const isScoreCol = col.toLowerCase().includes('score') || col.toLowerCase().includes('rating');
                                                        const isMatchCol = col.toLowerCase().includes('match status');
                                                        const isVinCol = (col.toLowerCase().includes('vin') || col.toLowerCase().includes('chassis')) && !isMatchCol;

                                                        const isAuto = isAutoFilledCell(col, cellVal, row);

                                                        return (
                                                            <td
                                                                key={j}
                                                                style={{
                                                                    padding: isDropdownCell ? '4px 6px' : '9px 14px',
                                                                    fontSize: '13px',
                                                                    color: '#0f172a',
                                                                    background: isAuto ? '#e2e8f0' : '#ffffff',
                                                                    borderRight: '1px solid #cbd5e1',
                                                                    borderBottom: '1px solid #cbd5e1',
                                                                    whiteSpace: isDropdownCell ? 'normal' : col.toLowerCase().includes('feedback') ? 'normal' : 'nowrap',
                                                                    maxWidth: isDropdownCell ? '280px' : col.toLowerCase().includes('feedback') ? '350px' : '260px',
                                                                    overflow: isDropdownCell ? 'visible' : 'hidden',
                                                                    textOverflow: isDropdownCell ? 'clip' : 'ellipsis'
                                                                }}
                                                                title={strVal ? `${strVal} (${isAuto ? 'Auto-filled value' : 'AI-parsed value'})` : ''}
                                                            >
                                                                {isDropdownCell ? (
                                                                    <select
                                                                        value={strVal}
                                                                        onChange={(e) => updateCellValue(globalRowIdx, col, e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            minWidth: '180px',
                                                                            maxWidth: '260px',
                                                                            padding: '4px 6px',
                                                                            fontSize: '12.5px',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid #cbd5e1',
                                                                            background: isAuto ? '#e2e8f0' : (strVal ? '#ffffff' : '#fff7ed'),
                                                                            color: '#0f172a',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <option value="">— Select —</option>
                                                                        {strVal && !cellOpts.includes(strVal) && (
                                                                            <option value={strVal}>{strVal} (custom)</option>
                                                                        )}
                                                                        {cellOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                ) : isMatchCol && strVal ? (() => {
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
                            Showing {filteredIndices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredIndices.length)} of {filteredIndices.length} records
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
                                disabled={currentPage === totalPages || filteredIndices.length === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{ opacity: (currentPage === totalPages || filteredIndices.length === 0) ? 0.5 : 1, cursor: (currentPage === totalPages || filteredIndices.length === 0) ? 'not-allowed' : 'pointer', padding: '6px 12px', fontSize: '12px' }}
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
