import React, { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback, useDeferredValue } from 'react';
import * as XLSX from 'xlsx';
import {
    UploadCloud,
    FileSpreadsheet,
    AlertTriangle,
    CheckCircle2,
    Download,
    Search,
    SlidersHorizontal,
    Layers,
    ArrowRight,
    ArrowLeft,
    Crosshair,
    Maximize2,
    Minimize2,
    Filter,
    Sparkles,
    Database,
    FolderOpen,
    RefreshCw,
    Save
} from 'lucide-react';
import { NPS_CELL_OPTIONS } from './npsCellOptions';
import { QC_FOLLOWUP_OPTIONS } from './shared/QcDropdownTree';
import { WeightageModal } from './WeightageModal';
import { POSITIVE_DRIVER_VALUES, applyServiceWeightsToRows } from './weightageHelpers';
import type { WeightagePayload } from './weightageHelpers';
import { getExcelColumnLetter } from './guineaSchema';
import {
    getRegions,
    getCountries,
    getIbVersions,
    getCommonUploads,
    getUploadData,
    updateUploadData
} from './api';
import type {
    RegionItem,
    CountryItem,
    IbVersionItem,
    CommonUploadItem
} from './api';



// =============================================================
// L2 Complaint group -> contiguous follow-up column block (EP..OJ)
// =============================================================
const L2_RANGE: Record<string, { start: string; end: string }> = {
    'Brake issues': { start: 'EP', end: 'EX' },
    'Cable issues': { start: 'EY', end: 'FD' },
    'Chain issue': { start: 'FE', end: 'FE' },
    'Chain case issue': { start: 'FF', end: 'FF' },
    'Clutch issues': { start: 'FG', end: 'FK' },
    'Electrical issues': { start: 'FL', end: 'FY' },
    'Engine issues': { start: 'FZ', end: 'GG' },
    'Gear issues': { start: 'GH', end: 'GO' },
    'Handle Bar issues': { start: 'GP', end: 'HQ' },
    'Kicker issues': { start: 'HR', end: 'HS' },
    'Low Mileage': { start: 'HT', end: 'HX' },
    'Low Speed': { start: 'HY', end: 'HZ' },
    'Muffler issues': { start: 'IA', end: 'IE' },
    'Starting trouble': { start: 'IF', end: 'II' },
    'Suspension issues': { start: 'IJ', end: 'JD' },
    'Vehicle noise': { start: 'JE', end: 'JW' },
    'Vibration': { start: 'JX', end: 'KN' },
    'Mirror issues': { start: 'KO', end: 'KS' },
    'Wheel/Tyre issues': { start: 'KT', end: 'MG' },
    'Battery issues': { start: 'MH', end: 'MK' },
    'Jerking issues': { start: 'ML', end: 'MO' },
    'Part not available': { start: 'MP', end: 'MQ' },
    'Pick-up problem': { start: 'MR', end: 'NB' },
    'Running off': { start: 'NC', end: 'NI' },
    'Throttle/Accelerator issue': { start: 'NJ', end: 'NJ' },
    'Vehicle body parts issue': { start: 'NK', end: 'NW' },
    'Fuel related issue': { start: 'NX', end: 'NY' },
    'Low Boot space': { start: 'NZ', end: 'NZ' },
    'Seat issue': { start: 'OA', end: 'OB' },
    'Vehicle Pulling problem': { start: 'OC', end: 'OD' },
    'Roof top (soft top) issue': { start: 'OE', end: 'OG' },
    'Wiper problem': { start: 'OH', end: 'OI' },
    'Faster issue': { start: 'OJ', end: 'OJ' }
};

const colLetterToIndex = (letter: string): number => {
    let n = 0;
    for (let i = 0; i < letter.length; i++) {
        n = n * 26 + (letter.charCodeAt(i) - 64);
    }
    return n - 1;
};

const colIndexToLetter = (idx: number): string => {
    let s = '';
    let n = idx + 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
};


const normalizeL2 = (v: string): string =>
    String(v).replace(/\s*\d+\s*$/, '').trim().toLowerCase();

const L2_NAME_LOOKUP: Record<string, string> = {};
Object.keys(L2_RANGE).forEach(k => {
    L2_NAME_LOOKUP[normalizeL2(k)] = k;
});

const RANGE_LETTERS: Record<string, Set<string>> = {};
Object.entries(L2_RANGE).forEach(([l2, { start, end }]) => {
    const s = colLetterToIndex(start);
    const e = colLetterToIndex(end);
    const set = new Set<string>();
    for (let i = s; i <= e; i++) set.add(colIndexToLetter(i));
    RANGE_LETTERS[l2] = set;
});

// Precompute a normalized lookup map for QC_FOLLOWUP_OPTIONS:
// This turns an O(N) regex search per cell into an instant O(1) map lookup!
const NORMALIZED_FOLLOWUP_MAP = new Map<string, string[]>();
Object.entries(QC_FOLLOWUP_OPTIONS).forEach(([key, opts]) => {
    NORMALIZED_FOLLOWUP_MAP.set(key.toLowerCase().replace(/\s+/g, ' ').trim(), opts);
});

const findFollowupOptions = (colName: string): string[] | undefined => {
    if (QC_FOLLOWUP_OPTIONS[colName]) return QC_FOLLOWUP_OPTIONS[colName];
    const norm = colName.toLowerCase().replace(/\s+/g, ' ').trim();
    return NORMALIZED_FOLLOWUP_MAP.get(norm);
};

export interface QcIssue {
    l2ColumnName: string;
    l2Value: string;
    followUpRangeLabel: string;
    followUpColNames: string[];
}

export interface QcScanResult {
    issues: QcIssue[];
    ok: boolean;
}

// Precomputed scan context to avoid rebuilding maps on every single row
interface QcScanContext {
    l2Cols: string[];
    l2FollowUpMap: Record<string, string[]>;
}

function buildQcScanContext(columnNames: string[]): QcScanContext {
    const idxToName: Record<string, string> = {};
    columnNames.forEach((name, i) => {
        idxToName[colIndexToLetter(i)] = name;
    });

    const l2Cols = columnNames.filter(c => /complaint group \(l2\)/i.test(c));

    const l2FollowUpMap: Record<string, string[]> = {};
    Object.entries(RANGE_LETTERS).forEach(([l2Key, letters]) => {
        const cols: string[] = [];
        letters.forEach(letter => {
            const nm = idxToName[letter];
            if (nm) cols.push(nm);
        });
        l2FollowUpMap[l2Key] = cols;
    });

    return { l2Cols, l2FollowUpMap };
}

function scanRowQcWithContext(
    row: Record<string, any>,
    ctx: QcScanContext
): QcScanResult {
    const issues: QcIssue[] = [];

    for (const l2Col of ctx.l2Cols) {
        const rawVal = row[l2Col];
        const val = String(rawVal ?? '').trim();
        if (!val) continue;
        if (/^submit form\.+$/i.test(val)) continue;

        const l2Key = L2_NAME_LOOKUP[normalizeL2(val)];
        if (!l2Key) {
            issues.push({
                l2ColumnName: l2Col,
                l2Value: val,
                followUpRangeLabel: '(unknown)',
                followUpColNames: []
            });
            continue;
        }

        const followUpColNames = ctx.l2FollowUpMap[l2Key] || [];
        const anyFilled = followUpColNames.some(c => {
            const v = row[c];
            return v !== undefined && v !== null && String(v).trim() !== '';
        });

        if (!anyFilled && followUpColNames.length > 0) {
            const { start, end } = L2_RANGE[l2Key];
            issues.push({
                l2ColumnName: l2Col,
                l2Value: val,
                followUpRangeLabel: `${start}..${end}`,
                followUpColNames
            });
        }
    }

    return { issues, ok: issues.length === 0 };
}

interface FlashTarget {
    rowIdx: number;
    colName: string;
    token: number;
    kind: 'badge' | 'l2' | 'followup';
}

function findParentL2(
    qc: QcScanResult,
    clickedCol: string
): QcIssue | null {
    for (const issue of qc.issues) {
        if (issue.followUpColNames.includes(clickedCol)) return issue;
    }
    return null;
}

interface ColumnMeta {
    isL2GroupCol: boolean;
    cellOpts?: string[];
    isDropdown: boolean;
}

// =============================================================
// COMPACT LAZY SELECT: Ultra-fast native <select>
// Only mounts full option list when active/focused!
// Reduces DOM nodes from 225,000 down to 1,500!
// =============================================================
const CompactLazySelect: React.FC<{
    value: string;
    options: string[];
    onChange: (newVal: string) => void;
}> = React.memo(({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <select
            value={value}
            onMouseDown={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onChange={(e) => {
                onChange(e.target.value);
                setIsOpen(false);
            }}
            className="qc-compact-select"
            style={{
                maxWidth: '220px',
                minWidth: '110px',
                width: 'auto',
                padding: '3px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: value ? '#ffffff' : '#fff7ed',
                color: '#0f172a',
                cursor: 'pointer',
                outline: 'none',
                textAlign: 'left'
            }}
        >
            {!isOpen ? (
                <option value={value}>{value || '— Select —'}</option>
            ) : (
                <>
                    <option value="">— Select —</option>
                    {value && !options.includes(value) && (
                        <option value={value}>{value} (custom)</option>
                    )}
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </>
            )}
        </select>
    );
});

// =============================================================
// MEMOIZED ROW COMPONENT: Keeps rendering 60 FPS!
// Only re-renders when this row's data or flashing state changes.
// =============================================================
interface TableRowProps {
    globalIdx: number;
    row: Record<string, any>;
    qc: QcScanResult;
    visibleColumns: string[];
    columnMetaMap: Map<string, ColumnMeta>;
    missingSet: Set<string>;
    l2Set: Set<string>;
    flashingCol: string | null;
    isFlashTargetThisRow: boolean;
    flashTargetKind?: 'badge' | 'l2' | 'followup';
    onUpdateCell: (globalIdx: number, colName: string, value: string) => void;
    onJumpToFirstFailingL2: (globalIdx: number) => void;
    onJumpBackToBadge: (globalIdx: number) => void;
    onJumpToFirstFollowUp: (globalIdx: number, col: string) => void;
    onJumpBackToL2: (globalIdx: number, col: string) => void;
}

const QcTableRow = React.memo<TableRowProps>(({
    globalIdx,
    row,
    qc,
    visibleColumns,
    columnMetaMap,
    missingSet,
    l2Set,
    flashingCol,
    isFlashTargetThisRow,
    flashTargetKind,
    onUpdateCell,
    onJumpToFirstFailingL2,
    onJumpBackToBadge,
    onJumpToFirstFollowUp,
    onJumpBackToL2
}) => {
    const badgeFlashing = flashingCol === '__BADGE__';

    return (
        <tr style={{ background: globalIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
            {/* Sticky Row Index */}
            <td style={{
                position: 'sticky',
                left: 0,
                zIndex: 15,
                background: globalIdx % 2 === 0 ? '#f1f5f9' : '#e2e8f0',
                color: '#334155',
                fontWeight: 700,
                textAlign: 'center',
                padding: '6px 10px',
                borderRight: '2px solid #cbd5e1',
                borderBottom: '1px solid #e2e8f0',
                width: '50px',
                minWidth: '50px'
            }}>
                {globalIdx + 1}
            </td>

            {/* QC Status Badge */}
            <td
                id={`qc-cell-${globalIdx}-__BADGE__`}
                className={badgeFlashing ? 'qc-flash-cell' : ''}
                style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    width: '110px',
                    minWidth: '110px'
                }}
            >
                {qc.ok ? (
                    <span className="modern-badge modern-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> PASS
                    </span>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <button
                            type="button"
                            className="modern-badge modern-badge-warning qc-fail-badge"
                            onClick={() => onJumpToFirstFailingL2(globalIdx)}
                            title={
                                'Click to jump to first failing L2.\n\n' +
                                qc.issues.map(i =>
                                    `${i.l2ColumnName} = "${i.l2Value}" → missing ${i.followUpRangeLabel}`
                                ).join('\n')
                            }
                            style={{
                                border: '1px solid #fde68a',
                                background: '#fef3c7',
                                color: '#b45309',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '11.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <AlertTriangle size={12} />
                            FAIL ({qc.issues.length})
                            <ArrowRight size={11} />
                        </button>
                        {isFlashTargetThisRow && flashTargetKind !== 'badge' && (
                            <button
                                type="button"
                                onClick={() => onJumpBackToBadge(globalIdx)}
                                title="Back to FAIL badge"
                                style={{
                                    border: '1px dashed #94a3b8',
                                    background: 'transparent',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    cursor: 'pointer'
                                }}
                            >
                                <ArrowLeft size={10} /> Back
                            </button>
                        )}
                    </div>
                )}
            </td>

            {/* Data Columns */}
            {visibleColumns.map((col, j) => {
                const meta = columnMetaMap.get(col);
                const isL2 = l2Set.has(col);
                const isMissing = missingSet.has(col);
                const isFlashing = flashingCol === col;
                const cellVal = row[col];
                const strVal = cellVal === undefined || cellVal === null ? '' : String(cellVal);

                const isDropdownCell = !!meta?.isDropdown;
                const cellOpts = meta?.cellOpts;

                let bg = '#ffffff';
                let border = '1px solid #e2e8f0';
                if (isL2) {
                    bg = '#fed7aa';
                    border = '2px solid #c2410c';
                } else if (isMissing) {
                    bg = '#fecaca';
                    border = '1px solid #b91c1c';
                }

                const cellId = `qc-cell-${globalIdx}-${col}`;
                const titleSuffix = isL2
                    ? '\n\n▸ Click arrow or cell to jump to first follow-up column'
                    : isMissing
                        ? '\n\n◂ Click arrow or cell to jump back to L2 Complaint group'
                        : '';

                return (
                    <td
                        key={j}
                        id={cellId}
                        className={[isFlashing ? 'qc-flash-cell' : '', isL2 ? 'qc-clickable-l2' : isMissing ? 'qc-clickable-followup' : ''].filter(Boolean).join(' ')}
                        style={{
                            padding: isDropdownCell ? '2px 4px' : '6px 8px',
                            background: bg,
                            border,
                            borderBottom: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '12px',
                            color: '#0f172a',
                            verticalAlign: 'middle',
                            width: '210px',
                            minWidth: '210px'
                        }}
                        title={(strVal || '—') + titleSuffix}
                    >
                        {isDropdownCell && cellOpts ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '4px' }}>
                                {/* Backward Arrow on Follow-up cells */}
                                {isMissing && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onJumpBackToL2(globalIdx, col);
                                        }}
                                        className="qc-jump-btn"
                                        title="Click to jump back to Complaint Group (L2)"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '3px 5px',
                                            borderRadius: '4px',
                                            border: '1.5px solid #b91c1c',
                                            background: '#fee2e2',
                                            color: '#b91c1c',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        <ArrowLeft size={12} strokeWidth={2.5} />
                                    </button>
                                )}

                                <CompactLazySelect
                                    value={strVal}
                                    options={cellOpts}
                                    onChange={(newVal) => onUpdateCell(globalIdx, col, newVal)}
                                />

                                {/* Frontward Arrow on L2 Complaint cells */}
                                {isL2 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onJumpToFirstFollowUp(globalIdx, col);
                                        }}
                                        className="qc-jump-btn"
                                        title="Click to jump forward to first follow-up column"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '3px 5px',
                                            borderRadius: '4px',
                                            border: '1.5px solid #c2410c',
                                            background: '#ffedd5',
                                            color: '#c2410c',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        <ArrowRight size={12} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isL2 || isMissing ? 'space-between' : 'flex-start', gap: '4px', width: '100%' }}>
                                {/* Backward Arrow on Follow-up non-dropdown cells */}
                                {isMissing && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onJumpBackToL2(globalIdx, col);
                                        }}
                                        className="qc-jump-btn"
                                        title="Click to jump back to Complaint Group (L2)"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            border: '1.5px solid #b91c1c',
                                            background: '#fee2e2',
                                            color: '#b91c1c',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        <ArrowLeft size={11} strokeWidth={2.5} />
                                    </button>
                                )}

                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {strVal || '—'}
                                </span>

                                {/* Frontward Arrow on L2 non-dropdown cells */}
                                {isL2 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onJumpToFirstFollowUp(globalIdx, col);
                                        }}
                                        className="qc-jump-btn"
                                        title="Click to jump forward to first follow-up column"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            border: '1.5px solid #c2410c',
                                            background: '#ffedd5',
                                            color: '#c2410c',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        <ArrowRight size={11} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        )}
                    </td>
                );
            })}
        </tr>
    );
});



interface QcDataCheckProps {
    onNavigateToDataSources?: () => void;
}

// =============================================================
// MAIN COMPONENT
// =============================================================
const QcDataCheck: React.FC<QcDataCheckProps> = ({ onNavigateToDataSources }) => {
    const [fileName, setFileName] = useState<string>('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, any>[]>([]);
    const [scanResults, setScanResults] = useState<QcScanResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({});
    const [showColumnFilter, setShowColumnFilter] = useState(false);
    const [columnSearchQuery, setColumnSearchQuery] = useState('');

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'fail' | 'pass'>('all');
    const [focusQcColsOnly, setFocusQcColsOnly] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(25);

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [flashTarget, setFlashTarget] = useState<FlashTarget | null>(null);



    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanContextRef = useRef<QcScanContext>({ l2Cols: [], l2FollowUpMap: {} });
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const [showWeightModal, setShowWeightModal] = useState(false);

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

    // Persistence / Dirty State
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [pendingEditsCount, setPendingEditsCount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
    const pendingEditsRef = useRef<Map<string, { rowIndex: number; column: string; value: any; columnLetter?: string }>>(new Map());

    // Precompute Column Metadata Map whenever columns list updates
    const columnMetaMap = useMemo(() => {
        const map = new Map<string, ColumnMeta>();
        for (const col of columns) {
            const isL2GroupCol = /complaint group \(l2\)/i.test(col);
            let cellOpts: string[] | undefined = undefined;
            if (isL2GroupCol) {
                cellOpts = Object.keys(L2_RANGE);
            } else {
                cellOpts = NPS_CELL_OPTIONS[col] || findFollowupOptions(col);
            }
            map.set(col, {
                isL2GroupCol,
                cellOpts,
                isDropdown: Array.isArray(cellOpts) && cellOpts.length > 0
            });
        }
        return map;
    }, [columns]);

    // Quick list of all QC relevant column names (L2 columns + EP..OJ follow-ups)
    const qcRelevantColsSet = useMemo(() => {
        const set = new Set<string>();
        const ctx = scanContextRef.current;
        ctx.l2Cols.forEach(c => set.add(c));
        Object.values(ctx.l2FollowUpMap).forEach(cols => {
            cols.forEach(c => set.add(c));
        });
        return set;
    }, [columns]);

    // Fast visible columns list:
    const visibleColumns = useMemo(() => {
        return columns.filter(col => {
            if (focusQcColsOnly && !qcRelevantColsSet.has(col)) return false;
            return visibleCols[col] !== false;
        });
    }, [columns, visibleCols, focusQcColsOnly, qcRelevantColsSet]);

    // Update single cell value with instant re-scan and dirty tracking
    const updateCellValue = useCallback((globalRowIdx: number, colName: string, newValue: string) => {
        setRows(prevRows => {
            if (globalRowIdx < 0 || globalRowIdx >= prevRows.length) return prevRows;
            const updatedRow = { ...prevRows[globalRowIdx], [colName]: newValue };
            const nextRows = prevRows.slice();
            nextRows[globalRowIdx] = updatedRow;

            // Re-scan only this row with precomputed context
            const newScan = scanRowQcWithContext(updatedRow, scanContextRef.current);
            setScanResults(prevScans => {
                const nextScans = prevScans.slice();
                nextScans[globalRowIdx] = newScan;
                return nextScans;
            });

            // Track unsaved edit for MongoDB / SurveyResponse persistence
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

            return nextRows;
        });
    }, []);

    // Save changes back to database (PUT /api/uploads/:id/data -> updates SurveyResponse & UploadedFile)
    const handleSaveChanges = async () => {
        if (!selectedFileId || !hasUnsavedChanges || isSaving) return;
        setIsSaving(true);
        setError('');
        setSaveSuccessMsg('');

        try {
            const edits = Array.from(pendingEditsRef.current.values());
            await updateUploadData(selectedFileId, {
                rows,
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

    // Fullscreen Escape key listener
    useEffect(() => {
        if (!isFullScreen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFullScreen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isFullScreen]);

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
                const storedId = sessionStorage.getItem('activeFile_QC');
                let targetId = storedId;
                if (!targetId && files.length > 0) {
                    targetId = String(files[0].id);
                }

                if (targetId) {
                    setSelectedFileId(targetId);
                    loadFileData(targetId);
                }
            })
            .catch(err => console.error('Failed to load common data sources for QC:', err))
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

    // Load file from Common Repository (GET /api/uploads/:id/data)
    const loadFileData = async (fileIdToLoad: number | string) => {
        if (!fileIdToLoad) return;
        setIsLoading(true);
        setError('');

        try {
            const data = await getUploadData(fileIdToLoad);
            const loadedCols = data.columns || [];
            const loadedRows = data.rows || [];

            if (loadedRows.length === 0) {
                setError(`File "${data.file_name}" does not contain any data rows.`);
                setIsLoading(false);
                return;
            }

            // Build context ONCE for all rows
            const ctx = buildQcScanContext(loadedCols);
            scanContextRef.current = ctx;

            const scans = loadedRows.map(r => scanRowQcWithContext(r, ctx));

            setColumns(loadedCols);
            setRows(loadedRows);
            setScanResults(scans);
            setFileName(data.file_name);
            setCurrentPage(1);
            setFlashTarget(null);

            const visInit: Record<string, boolean> = {};
            loadedCols.forEach(c => { visInit[c] = true; });
            setVisibleCols(visInit);

            sessionStorage.setItem('activeFile_QC', String(fileIdToLoad));
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

    // Parse Excel File
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        setError('');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const dataArrays = XLSX.utils.sheet_to_json(ws, {
                    header: 1,
                    defval: ''
                }) as any[][];

                if (dataArrays.length === 0) {
                    setError('The Excel file is empty.');
                    setIsLoading(false);
                    return;
                }

                let maxLen = 0;
                let headerIdx = 0;
                for (let i = 0; i < Math.min(10, dataArrays.length); i++) {
                    const n = (dataArrays[i] || []).filter(
                        c => c !== undefined && c !== null && String(c).trim() !== ''
                    ).length;
                    if (n > maxLen) { maxLen = n; headerIdx = i; }
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

                // Build context ONCE for all rows
                const ctx = buildQcScanContext(uniqueCols);
                scanContextRef.current = ctx;

                const scans = parsedRows.map(r => scanRowQcWithContext(r, ctx));

                setColumns(uniqueCols);
                setRows(parsedRows);
                setScanResults(scans);
                setFileName(file.name);
                setCurrentPage(1);
                setFlashTarget(null);

                const visInit: Record<string, boolean> = {};
                uniqueCols.forEach(c => { visInit[c] = true; });
                setVisibleCols(visInit);

                setIsLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to parse Excel file');
                setIsLoading(false);
            }
        };
        reader.readAsBinaryString(file);
        (e.target as HTMLInputElement).value = '';
    };

    // Calculate Summary Stats
    const summary = useMemo(() => {
        let okRows = 0;
        let failRows = 0;
        let totalIssues = 0;
        for (let i = 0; i < scanResults.length; i++) {
            const r = scanResults[i];
            if (r.ok) {
                okRows++;
            } else {
                failRows++;
                totalIssues += r.issues.length;
            }
        }
        return { okRows, failRows, totalIssues };
    }, [scanResults]);

    // Deferred search to keep typing 100% fluid
    const deferredSearch = useDeferredValue(searchText);

    // Filtered Indices: fast search + status filter
    const filteredIndices = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        const out: number[] = [];

        for (let i = 0; i < rows.length; i++) {
            const qc = scanResults[i];
            if (!qc) continue;

            if (statusFilter === 'fail' && qc.ok) continue;
            if (statusFilter === 'pass' && !qc.ok) continue;

            if (!q) {
                out.push(i);
                continue;
            }

            // Quick check in L2 issues first
            const hitIssue = qc.issues.some(is => is.l2Value.toLowerCase().includes(q));
            if (hitIssue) {
                out.push(i);
                continue;
            }

            // Check row values
            const row = rows[i];
            let hitVal = false;
            for (const key in row) {
                const val = row[key];
                if (val && String(val).toLowerCase().includes(q)) {
                    hitVal = true;
                    break;
                }
            }
            if (hitVal) out.push(i);
        }

        return out;
    }, [rows, scanResults, deferredSearch, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredIndices.length / pageSize));

    // Visible indices for the current page
    const pageIndices = useMemo(() => {
        return filteredIndices.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize
        );
    }, [filteredIndices, currentPage, pageSize]);

    const handleNextPage = () => {
        setCurrentPage(p => Math.min(totalPages, p + 1));
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    };

    const handlePrevPage = () => {
        setCurrentPage(p => Math.max(1, p - 1));
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    };

    const handleFirstPage = () => {
        setCurrentPage(1);
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    };

    const handleLastPage = () => {
        setCurrentPage(totalPages);
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    };

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    // Precompute missing & L2 sets ONLY for current page rows
    const { pageMissingSets, pageL2Sets } = useMemo(() => {
        const missingMap: Record<number, Set<string>> = {};
        const l2Map: Record<number, Set<string>> = {};

        pageIndices.forEach(rIdx => {
            const qc = scanResults[rIdx];
            if (!qc || qc.ok) {
                missingMap[rIdx] = new Set<string>();
                l2Map[rIdx] = new Set<string>();
                return;
            }
            const missing = new Set<string>();
            const l2 = new Set<string>();
            qc.issues.forEach(is => {
                l2.add(is.l2ColumnName);
                is.followUpColNames.forEach(c => missing.add(c));
            });
            missingMap[rIdx] = missing;
            l2Map[rIdx] = l2;
        });

        return { pageMissingSets: missingMap, pageL2Sets: l2Map };
    }, [pageIndices, scanResults]);

    // Bidirectional Navigation Scroll & Flash
    useEffect(() => {
        if (!flashTarget) return;
        const { rowIdx, colName } = flashTarget;

        const targetPage = Math.floor(
            filteredIndices.indexOf(rowIdx) / pageSize
        ) + 1;

        if (targetPage > 0 && targetPage !== currentPage) {
            setCurrentPage(targetPage);
            setTimeout(() => {
                const el = document.getElementById(`qc-cell-${rowIdx}-${colName}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }, 100);
            return;
        }

        const timer = setTimeout(() => {
            const el = document.getElementById(`qc-cell-${rowIdx}-${colName}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [flashTarget, currentPage, filteredIndices, pageSize]);

    const jumpToFirstFailingL2 = useCallback((rowIdx: number) => {
        const qc = scanResults[rowIdx];
        if (!qc || qc.issues.length === 0) return;
        setFlashTarget({
            rowIdx,
            colName: qc.issues[0].l2ColumnName,
            token: Date.now(),
            kind: 'l2'
        });
    }, [scanResults]);

    const jumpToFirstFollowUp = useCallback((rowIdx: number, l2ColName: string) => {
        const qc = scanResults[rowIdx];
        if (!qc) return;
        const issue = qc.issues.find(i => i.l2ColumnName === l2ColName);
        if (!issue || issue.followUpColNames.length === 0) return;
        setFlashTarget({
            rowIdx,
            colName: issue.followUpColNames[0],
            token: Date.now(),
            kind: 'followup'
        });
    }, [scanResults]);

    const jumpBackToL2 = useCallback((rowIdx: number, followUpColName: string) => {
        const qc = scanResults[rowIdx];
        if (!qc) return;
        const parent = findParentL2(qc, followUpColName);
        if (!parent) return;
        setFlashTarget({
            rowIdx,
            colName: parent.l2ColumnName,
            token: Date.now(),
            kind: 'l2'
        });
    }, [scanResults]);

    const jumpBackToBadge = useCallback((rowIdx: number) => {
        setFlashTarget({
            rowIdx,
            colName: '__BADGE__',
            token: Date.now(),
            kind: 'badge'
        });
    }, []);

    const handleExportQcReport = () => {
        if (rows.length === 0) return;
        const report = rows.map((row, i) => {
            const qc = scanResults[i];
            return {
                'Row #': i + 1,
                'QC Status': qc?.ok ? 'PASS' : 'FAIL',
                'Issues Found': qc?.issues?.length || 0,
                'L2 Groups Without Follow-up': (qc?.issues || [])
                    .map(is => `${is.l2ColumnName} = "${is.l2Value}" [expects ${is.followUpRangeLabel}]`)
                    .join(' | ')
            };
        });
        const ws = XLSX.utils.json_to_sheet(report);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QC Report');
        XLSX.writeFile(wb, 'QC_Data_Check_Report.xlsx');
    };

    // Shell style matching AdminDashboard layout
    const shellStyle: React.CSSProperties = isFullScreen
        ? {
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: '#f8fafc',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflow: 'hidden'
        }
        : {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        };

    function scanRowQc(row: Record<string, any>, columnNames: string[]): QcScanResult {
        const idxToName: Record<string, string> = {};
        columnNames.forEach((name, i) => {
            idxToName[colIndexToLetter(i)] = name;
        });

        const l2Cols = columnNames.filter(c => /complaint group \(l2\)/i.test(c));
        const issues: QcIssue[] = [];

        for (const l2Col of l2Cols) {
            const rawVal = row[l2Col];
            const val = String(rawVal ?? '').trim();
            if (!val) continue;
            if (/^submit form\.+$/i.test(val)) continue;

            const l2Key = L2_NAME_LOOKUP[normalizeL2(val)];
            if (!l2Key) {
                issues.push({
                    l2ColumnName: l2Col,
                    l2Value: val,
                    followUpRangeLabel: '(unknown)',
                    followUpColNames: []
                });
                continue;
            }

            const rangeSet = RANGE_LETTERS[l2Key];
            const followUpColNames: string[] = [];
            for (const letter of rangeSet) {
                const nm = idxToName[letter];
                if (nm) followUpColNames.push(nm);
            }

            const anyFilled = followUpColNames.some(c => {
                const v = row[c];
                return v !== undefined && v !== null && String(v).trim() !== '';
            });

            if (!anyFilled && followUpColNames.length > 0) {
                const { start, end } = L2_RANGE[l2Key];
                issues.push({
                    l2ColumnName: l2Col,
                    l2Value: val,
                    followUpRangeLabel: `${start}..${end}`,
                    followUpColNames
                });
            }
        }

        return { issues, ok: issues.length === 0 };
    }

    const applyWeights = (payload: WeightagePayload) => {
        const totalRows = rows.length;
        if (totalRows === 0) return;

        if (payload.category === 'service') {
            const newRows = applyServiceWeightsToRows(rows, columns, payload);
            const newScans = newRows.map(r => scanRowQc(r, columns));
            setRows(newRows);
            setScanResults(newScans);
            setHasUnsavedChanges(true);
            return;
        }

        const { l2Weights = {}, positiveWeights = {}, autoFillRemaining } = payload;
        const newRows = rows.map(r => ({ ...r }));

        const shuffle = <T,>(a: T[]) => a.map(v => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
        const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

        // Build letter → column name map once
        const idxToName: Record<string, string> = {};
        columns.forEach((n, i) => { idxToName[colIndexToLetter(i)] = n; });

        // Identify all L2 columns (DF..EM / Complaint group (L2))
        const dfIdx = colLetterToIndex('DF');
        const emIdx = colLetterToIndex('EM');
        const l2Cols = columns.filter((c, i) => {
            return (i >= dfIdx && i <= emIdx) || /complaint group \(l2\)/i.test(c);
        });

        const isL2SlotEmpty = (val: any): boolean => {
            if (val === undefined || val === null) return true;
            const str = String(val).trim();
            return str === '' || /^submit form\.+$/i.test(str);
        };

        // Helper: fill an L2's follow-up columns in a row so it bypasses QC FAIL check
        const fillFollowUps = (rowObj: Record<string, any>, l2Name: string) => {
            const range = L2_RANGE[l2Name];
            if (!range) return;

            const s = colLetterToIndex(range.start);
            const e = colLetterToIndex(range.end);
            for (let k = s; k <= e; k++) {
                const nm = idxToName[colIndexToLetter(k)];
                if (nm && isL2SlotEmpty(rowObj[nm])) {
                    const opts = QC_FOLLOWUP_OPTIONS[nm];
                    rowObj[nm] = opts && opts.length > 0 ? pick(opts) : 'Yes';
                }
            }
        };

        // 1. Gather all available (empty) L2 slots across ALL rows
        type Slot = { rowIdx: number; colName: string };
        let emptySlots: Slot[] = [];
        for (let r = 0; r < totalRows; r++) {
            for (const col of l2Cols) {
                if (isL2SlotEmpty(newRows[r][col])) {
                    emptySlots.push({ rowIdx: r, colName: col });
                }
            }
        }

        // 2. Fill L2 weights across available empty L2 slots
        for (const [l2Name, pct] of Object.entries(l2Weights)) {
            const numPct = Number(pct) || 0;
            if (numPct <= 0 || emptySlots.length === 0) continue;
            const count = Math.min(Math.round((numPct / 100) * totalRows), emptySlots.length);
            if (count <= 0) continue;

            // Prefer empty slots in rows that don't already have this exact L2
            const eligible = emptySlots.filter(s => {
                return !l2Cols.some(c => String(newRows[s.rowIdx][c] || '').trim().toLowerCase() === l2Name.trim().toLowerCase());
            });
            const pool = eligible.length >= count ? eligible : emptySlots;
            const chosen = shuffle(pool).slice(0, count);

            chosen.forEach(slot => {
                newRows[slot.rowIdx][slot.colName] = l2Name;
                fillFollowUps(newRows[slot.rowIdx], l2Name);
            });

            const chosenSet = new Set(chosen.map(s => `${s.rowIdx}:${s.colName}`));
            emptySlots = emptySlots.filter(s => !chosenSet.has(`${s.rowIdx}:${s.colName}`));
        }

        // 3. Positive Driver weights (AU..BM)
        for (const [colName, pct] of Object.entries(positiveWeights)) {
            if (!columns.includes(colName)) continue;
            const numPct = Number(pct) || 0;
            if (numPct <= 0) continue;
            const count = Math.round((numPct / 100) * totalRows);
            const values = POSITIVE_DRIVER_VALUES[colName] || ['Yes', 'Good', 'Excellent'];
            const available = shuffle(
                Array.from({ length: totalRows }, (_, i) => i)
            ).slice(0, count);
            available.forEach(i => {
                newRows[i][colName] = pick(values);
            });
        }

        // 4. Auto-fill remaining empty L2 slots with random L2s
        if (autoFillRemaining && emptySlots.length > 0) {
            const l2Names = Object.keys(L2_RANGE);
            const totalFilledL2 = Object.values(l2Weights).reduce((a, b) => a + (Number(b) || 0), 0);
            const remainingPct = Math.max(0, 100 - totalFilledL2);
            let remainingCount = Math.min(Math.round((remainingPct / 100) * totalRows), emptySlots.length);

            // If remainingCount is 0 but there are rows with no L2 at all, ensure they receive an L2
            const rowsWithoutL2 = Array.from({ length: totalRows }, (_, i) => i).filter(rIdx => {
                return !l2Cols.some(c => !isL2SlotEmpty(newRows[rIdx][c]));
            });
            if (remainingCount === 0 && rowsWithoutL2.length > 0) {
                remainingCount = Math.min(rowsWithoutL2.length, emptySlots.length);
            }

            while (remainingCount > 0 && emptySlots.length > 0) {
                const randomL2 = pick(l2Names);
                // Prefer empty slots in rows that don't have any L2 yet
                const zeroL2Slots = emptySlots.filter(s => {
                    return !l2Cols.some(c => !isL2SlotEmpty(newRows[s.rowIdx][c]));
                });
                const pool = zeroL2Slots.length > 0 ? zeroL2Slots : emptySlots;
                const chosenSlot = pick(shuffle(pool));

                newRows[chosenSlot.rowIdx][chosenSlot.colName] = randomL2;
                fillFollowUps(newRows[chosenSlot.rowIdx], randomL2);

                emptySlots = emptySlots.filter(s => !(s.rowIdx === chosenSlot.rowIdx && s.colName === chosenSlot.colName));
                remainingCount--;
            }
        }

        // 5. Rescan using the top-level scanRowQc (guaranteed in scope)
        const newScans = newRows.map(r => scanRowQc(r, columns));

        setRows(newRows);
        setScanResults(newScans);
        setHasUnsavedChanges(true);
    };

    const tableCardRef = useRef<HTMLDivElement>(null);
    const [cardHeight, setCardHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (isFullScreen) return;

        const update = () => {
            const el = tableCardRef.current;
            if (!el) return;
            // Distance from the top of the document to the card, so it works even if the page is scrolled
            const docTop = el.getBoundingClientRect().top + window.scrollY;
            const available = window.innerHeight - docTop - 16; // 16px bottom breathing room
            setCardHeight(Math.max(400, available));
        };

        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [
        isFullScreen,
        rows.length,
        isLoading,
        error,
        saveSuccessMsg,
        filteredCommonFiles.length
    ]);

    return (
        <div style={shellStyle}>
            <style>{`
                @keyframes qcFlash {
                    0%   { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.95); background-color: #fef08a; }
                    25%  { box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.7); background-color: #fde047; }
                    50%  { box-shadow: 0 0 0 8px rgba(250, 204, 21, 0.35); background-color: #facc15; }
                    100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); background-color: inherit; }
                }
                .qc-flash-cell {
                    animation: qcFlash 1.2s ease-out 1;
                    outline: 3px solid #eab308;
                    outline-offset: -3px;
                    z-index: 12;
                    position: relative;
                }
                .qc-clickable-l2 {
                    cursor: pointer;
                    transition: transform 0.1s ease, filter 0.15s ease;
                }
                .qc-clickable-l2:hover {
                    filter: brightness(0.92) saturate(1.3);
                    transform: scale(1.02);
                }
                .qc-clickable-followup {
                    cursor: pointer;
                    transition: filter 0.15s ease;
                }
                .qc-clickable-followup:hover {
                    filter: brightness(0.9) saturate(1.4);
                    box-shadow: inset 0 0 0 2px #7f1d1d;
                }
                .qc-fail-badge {
                    cursor: pointer;
                    user-select: none;
                    transition: transform 0.1s ease, box-shadow 0.15s ease;
                }
                .qc-fail-badge:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
                }
                .qc-compact-select:focus {
                    border-color: #2563eb !important;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
                }
                .qc-jump-btn {
                    transition: transform 0.12s ease, box-shadow 0.12s ease;
                }
                .qc-jump-btn:hover {
                    transform: scale(1.12);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                }
                .qc-page-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: 12.5px;
                    font-weight: 500;
                    border: 1px solid #cbd5e1;
                    background: #ffffff;
                    color: #0f172a;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    user-select: none;
                }
                .qc-page-btn:not(:disabled):hover {
                    background: #f1f5f9;
                    border-color: #94a3b8;
                    color: #0284c7;
                }
                .qc-page-btn:not(:disabled):active {
                    transform: translateY(1px);
                }
                .qc-page-btn:disabled {
                    background: #f1f5f9 !important;
                    color: #94a3b8 !important;
                    border-color: #e2e8f0 !important;
                    cursor: not-allowed !important;
                    opacity: 0.65;
                }
            `}</style>

            {/* Common Repository Filter Bar - Replaces Direct Upload */}
            {!isFullScreen && (
                <div className="glass-panel" style={{ padding: '14px 20px', flexShrink: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                            }}>
                                <Filter size={18} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                        QC Data Check — File Selector
                                    </h3>
                                    {fileName && (
                                        <span style={{
                                            fontSize: '11.5px',
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
                                    Select from common uploaded repository files to run quality control validation.
                                </p>
                            </div>
                        </div>

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
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: hasUnsavedChanges ? 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' : '#f1f5f9',
                                    color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
                                    border: hasUnsavedChanges ? 'none' : '1px solid #e2e8f0',
                                    cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed',
                                    boxShadow: hasUnsavedChanges ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                                title={hasUnsavedChanges ? `Save ${pendingEditsCount} unsaved cell edits to MongoDB database` : 'No unsaved edits'}
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={13} />
                                        Save Changes {hasUnsavedChanges && `(${pendingEditsCount})`}
                                    </>
                                )}
                            </button>

                            {onNavigateToDataSources && (
                                <button
                                    type="button"
                                    className="modern-btn modern-btn-outline"
                                    onClick={onNavigateToDataSources}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                    title="Go to Data Sources tab to upload or manage common files"
                                >
                                    <Database size={13} /> Manage Data Sources
                                </button>
                            )}
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
            )}

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

            {error && (
                <div className="glass-panel" style={{
                    padding: '12px 16px',
                    background: 'rgba(254, 242, 242, 0.95)',
                    borderColor: 'rgba(254, 202, 202, 0.95)',
                    color: 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0
                }}>
                    <AlertTriangle size={18} color="#dc2626" />
                    <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 700 }}>
                            Upload Error
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px' }}>{error}</p>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Parsing Excel & Scanning QC Rules…</h3>
                </div>
            )}

            {!isLoading && rows.length === 0 && !error && (
                <div className="feature-showcase-grid" style={{ flexShrink: 0 }}>
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                            <FileSpreadsheet size={18} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Full 449-Column Parsing
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                            Reads your entire survey export — preserving all columns with high-performance instant caching.
                        </p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Bidirectional L2 Navigation
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                            Click FAIL badge to jump to L2, jump to follow-up column, or click back to return.
                        </p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                            <CheckCircle2 size={18} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Compact Dropdowns & Export
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                            Inline editable dropdowns centered with no extra whitespace, and one-click report export.
                        </p>
                    </div>
                </div>
            )}

            {!isLoading && rows.length > 0 && (
                <>
                    {/* Summary Chips - Hidden in Full View */}
                    {!isFullScreen && (
                        <div className="glass-panel" style={{ padding: '8px 16px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span className="modern-stat-chip total" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                                    <FileSpreadsheet size={12} /> {rows.length} Total Rows
                                </span>
                                <span className="modern-stat-chip match" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                                    <CheckCircle2 size={12} /> {summary.okRows} Pass
                                </span>
                                <span className="modern-stat-chip mismatch" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                                    <AlertTriangle size={12} /> {summary.failRows} Fail
                                </span>
                                <span className="modern-stat-chip done" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                                    <Layers size={12} /> {summary.totalIssues} Missing Follow-ups
                                </span>

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                                        📄 {fileName}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table Card with fixed height and flex-contained scrolling */}
                    <div
                        ref={tableCardRef}
                        className="glass-panel"
                        style={{
                            overflow: 'hidden',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '12px',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                            height: isFullScreen ? '100%' : (cardHeight ?? 'calc(100vh - 420px)'),
                            minHeight: '400px'
                        }}
                    >
                        {/* Top Controls Toolbar */}
                        <div style={{
                            padding: '10px 18px',
                            borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            flexShrink: 0
                        }}>
                            {/* Legend and Navigation Breadcrumbs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    padding: '3px 7px',
                                    fontSize: '11px'
                                }}>
                                    <span style={{
                                        width: '10px', height: '10px',
                                        background: '#fed7aa',
                                        border: '1.5px solid #c2410c',
                                        borderRadius: '3px',
                                        display: 'inline-block'
                                    }} />
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>L2 Selected</span>
                                </span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    padding: '3px 7px',
                                    fontSize: '11px'
                                }}>
                                    <span style={{
                                        width: '10px', height: '10px',
                                        background: '#fecaca',
                                        border: '1.5px solid #b91c1c',
                                        borderRadius: '3px',
                                        display: 'inline-block'
                                    }} />
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>Follow-up Empty</span>
                                </span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    color: '#64748b',
                                    fontStyle: 'italic',
                                    marginLeft: '4px'
                                }}>
                                    <Crosshair size={11} />
                                    <strong>FAIL</strong>
                                    <ArrowRight size={9} />
                                    <strong>L2</strong>
                                    <ArrowRight size={9} />
                                    <strong>Follow-up</strong>
                                    &nbsp;·&nbsp;
                                    <strong>Follow-up</strong>
                                    <ArrowLeft size={9} />
                                    <strong>L2</strong>
                                </span>

                                {/* Quick Filter Pills: All / Fail / Pass */}
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: '#e2e8f0',
                                    borderRadius: '6px',
                                    padding: '2px',
                                    marginLeft: '6px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                                        style={{
                                            border: 'none',
                                            background: statusFilter === 'all' ? '#ffffff' : 'transparent',
                                            color: statusFilter === 'all' ? '#0f172a' : '#64748b',
                                            fontWeight: statusFilter === 'all' ? 700 : 500,
                                            borderRadius: '5px',
                                            padding: '2px 7px',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        All ({rows.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setStatusFilter('fail'); setCurrentPage(1); }}
                                        style={{
                                            border: 'none',
                                            background: statusFilter === 'fail' ? '#fef3c7' : 'transparent',
                                            color: statusFilter === 'fail' ? '#b45309' : '#64748b',
                                            fontWeight: statusFilter === 'fail' ? 700 : 500,
                                            borderRadius: '5px',
                                            padding: '2px 7px',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Fail Only ({summary.failRows})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setStatusFilter('pass'); setCurrentPage(1); }}
                                        style={{
                                            border: 'none',
                                            background: statusFilter === 'pass' ? '#dcfce7' : 'transparent',
                                            color: statusFilter === 'pass' ? '#15803d' : '#64748b',
                                            fontWeight: statusFilter === 'pass' ? 700 : 500,
                                            borderRadius: '5px',
                                            padding: '2px 7px',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Pass Only ({summary.okRows})
                                    </button>
                                </div>
                            </div>

                            {/* Right Actions: Search, Focus QC Cols, Select Columns, Full View, Export */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Search */}
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{
                                        position: 'absolute', left: '8px',
                                        top: '50%', transform: 'translateY(-50%)',
                                        color: '#94a3b8'
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search rows…"
                                        value={searchText}
                                        onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                                        style={{
                                            padding: '5px 8px 5px 26px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '5px',
                                            fontSize: '11.5px',
                                            width: '160px',
                                            outline: 'none',
                                            background: '#ffffff'
                                        }}
                                    />
                                </div>

                                {/* Focus QC Columns Only Button */}
                                <button
                                    type="button"
                                    onClick={() => setFocusQcColsOnly(v => !v)}
                                    className={focusQcColsOnly ? 'modern-btn modern-btn-primary' : 'modern-btn modern-btn-outline'}
                                    style={{ padding: '5px 8px', fontSize: '11px' }}
                                    title="Show only L2 Complaint groups and follow-up columns for faster review"
                                >
                                    <Filter size={12} />
                                    {focusQcColsOnly ? 'QC View Active' : 'Focus QC Cols'}
                                </button>

                                {/* Full View Button */}
                                <button
                                    className={isFullScreen ? 'modern-btn modern-btn-primary' : 'modern-btn modern-btn-outline'}
                                    onClick={() => setIsFullScreen(v => !v)}
                                    style={{ padding: '5px 8px', fontSize: '11px' }}
                                    title={isFullScreen ? 'Exit Full View (Esc)' : 'Expand to Full View'}
                                >
                                    {isFullScreen ? (
                                        <><Minimize2 size={12} /> Exit Full View</>
                                    ) : (
                                        <><Maximize2 size={12} /> Full View</>
                                    )}
                                </button>

                                {/* Save Changes in Table Bar */}
                                <button
                                    type="button"
                                    onClick={handleSaveChanges}
                                    disabled={!hasUnsavedChanges || isSaving || !selectedFileId}
                                    className={hasUnsavedChanges ? 'modern-btn modern-btn-primary' : 'modern-btn modern-btn-outline'}
                                    style={{
                                        padding: '5px 10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: hasUnsavedChanges ? '#16a34a' : undefined,
                                        borderColor: hasUnsavedChanges ? '#15803d' : undefined,
                                        color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
                                        cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed'
                                    }}
                                    title={hasUnsavedChanges ? `Save ${pendingEditsCount} unsaved cell edits to MongoDB database` : 'No unsaved edits'}
                                >
                                    {isSaving ? (
                                        <><RefreshCw size={11} className="animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save size={11} /> Save Changes {hasUnsavedChanges && `(${pendingEditsCount})`}</>
                                    )}
                                </button>
                                <button
                                    className="modern-btn modern-btn-secondary"
                                    onClick={() => setShowWeightModal(true)}
                                    title="Auto-fill via weightage %"
                                >
                                    <Sparkles size={14} /> Auto-Fill Weights
                                </button>

                                {/* Select Columns Dropdown */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        className="modern-btn modern-btn-secondary"
                                        onClick={() => setShowColumnFilter(v => !v)}
                                        style={{ padding: '5px 8px', fontSize: '11px' }}
                                    >
                                        <SlidersHorizontal size={12} />
                                        Columns ({visibleColumns.length})
                                    </button>
                                    {showColumnFilter && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 6px)',
                                            right: 0,
                                            background: '#fff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                            padding: '12px',
                                            width: '300px',
                                            zIndex: 60,
                                            maxHeight: '360px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    className="modern-btn modern-btn-secondary"
                                                    onClick={() => {
                                                        const v: Record<string, boolean> = {};
                                                        columns.forEach(c => { v[c] = true; });
                                                        setVisibleCols(v);
                                                    }}
                                                    style={{ padding: '3px 8px', fontSize: '11px', flex: 1 }}
                                                >
                                                    Show All
                                                </button>
                                                <button
                                                    className="modern-btn modern-btn-outline"
                                                    onClick={() => {
                                                        const v: Record<string, boolean> = {};
                                                        columns.forEach(c => { v[c] = false; });
                                                        setVisibleCols(v);
                                                    }}
                                                    style={{ padding: '3px 8px', fontSize: '11px', flex: 1 }}
                                                >
                                                    Hide All
                                                </button>
                                            </div>

                                            <input
                                                type="text"
                                                placeholder="Filter column names…"
                                                value={columnSearchQuery}
                                                onChange={e => setColumnSearchQuery(e.target.value)}
                                                style={{
                                                    padding: '5px 8px',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '5px',
                                                    fontSize: '11.5px',
                                                    outline: 'none'
                                                }}
                                            />

                                            <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
                                                {columns
                                                    .filter(c => !columnSearchQuery || c.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                                                    .map(col => (
                                                        <div key={col} style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '8px',
                                                            marginBottom: '5px'
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={visibleCols[col] !== false}
                                                                onChange={() => setVisibleCols(p => ({
                                                                    ...p,
                                                                    [col]: !p[col]
                                                                }))}
                                                                style={{ marginTop: '2px', cursor: 'pointer' }}
                                                            />
                                                            <label style={{
                                                                fontSize: '11.5px',
                                                                cursor: 'pointer',
                                                                lineHeight: 1.3,
                                                                color: '#334155'
                                                            }}>
                                                                {col}
                                                            </label>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Export QC Report Button */}
                                <button
                                    className="modern-btn modern-btn-success"
                                    onClick={handleExportQcReport}
                                    style={{ padding: '5px 10px', fontSize: '11px' }}
                                >
                                    <Download size={12} /> Export
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Table Viewport - flex: 1 with minHeight: 0 and height: 0 prevents table from pushing pagination off-screen */}
                        <div
                            ref={tableScrollRef}
                            style={{
                                flex: '1 1 0%',
                                minHeight: 0,
                                height: 0,
                                width: '100%',
                                overflowX: 'auto',
                                overflowY: 'auto',
                                background: '#ffffff',
                                WebkitOverflowScrolling: 'touch',
                                willChange: 'transform'
                            }}
                        >
                            <table className="modern-table" style={{
                                width: 'max-content',
                                minWidth: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '12px',
                                tableLayout: 'fixed'
                            }}>
                                <thead>
                                    <tr>
                                        {/* Sticky Row Number Header */}
                                        <th style={{
                                            position: 'sticky',
                                            top: 0,
                                            left: 0,
                                            zIndex: 25,
                                            background: '#1e293b',
                                            color: '#fff',
                                            padding: '8px 10px',
                                            width: '50px',
                                            minWidth: '50px',
                                            borderRight: '2px solid #475569'
                                        }}>
                                            #
                                        </th>

                                        {/* Sticky QC Status Header */}
                                        <th style={{
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 20,
                                            background: '#1e293b',
                                            color: '#fff',
                                            padding: '8px 10px',
                                            width: '110px',
                                            minWidth: '110px'
                                        }}>
                                            QC Status
                                        </th>

                                        {/* Dynamic Data Headers */}
                                        {visibleColumns.map((col, idx) => (
                                            <th key={idx} style={{
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 20,
                                                background: '#1e293b',
                                                color: '#fff',
                                                padding: '8px 10px',
                                                width: '210px',
                                                minWidth: '210px',
                                                textAlign: 'left',
                                                fontWeight: 700,
                                                fontSize: '11.5px',
                                                borderRight: '1px solid #334155',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }} title={col}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageIndices.map((globalIdx) => {
                                        const row = rows[globalIdx];
                                        const qc = scanResults[globalIdx];
                                        if (!row || !qc) return null;

                                        const flashingCol = flashTarget && flashTarget.rowIdx === globalIdx
                                            ? flashTarget.colName
                                            : null;

                                        return (
                                            <QcTableRow
                                                key={globalIdx}
                                                globalIdx={globalIdx}
                                                row={row}
                                                qc={qc}
                                                visibleColumns={visibleColumns}
                                                columnMetaMap={columnMetaMap}
                                                missingSet={pageMissingSets[globalIdx] || new Set()}
                                                l2Set={pageL2Sets[globalIdx] || new Set()}
                                                flashingCol={flashingCol}
                                                isFlashTargetThisRow={flashTarget?.rowIdx === globalIdx}
                                                flashTargetKind={flashTarget?.kind}
                                                onUpdateCell={updateCellValue}
                                                onJumpToFirstFailingL2={jumpToFirstFailingL2}
                                                onJumpBackToBadge={jumpBackToBadge}
                                                onJumpToFirstFollowUp={jumpToFirstFollowUp}
                                                onJumpBackToL2={jumpBackToL2}
                                            />
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar matching AdminDashboard.tsx style */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 20px',
                                background: 'var(--color-surface-2, #f8fafc)',
                                borderTop: '1px solid var(--color-border, #e2e8f0)',
                                borderBottomLeftRadius: '12px',
                                borderBottomRightRadius: '12px',
                                flexWrap: 'wrap',
                                gap: '10px',
                                flexShrink: 0
                            }}
                        >
                            <div style={{ color: '#64748b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>
                                    Showing {filteredIndices.length === 0
                                        ? 0
                                        : (currentPage - 1) * pageSize + 1} to{' '}
                                    {Math.min(currentPage * pageSize, filteredIndices.length)} of{' '}
                                    {filteredIndices.length} rows
                                </span>

                                <span style={{ color: '#cbd5e1' }}>|</span>

                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#475569' }}>
                                    Rows per page:
                                    <select
                                        value={pageSize}
                                        onChange={e => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        style={{
                                            padding: '3px 8px',
                                            borderRadius: '5px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '12px',
                                            background: '#ffffff',
                                            color: '#0f172a',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="qc-page-btn"
                                    disabled={currentPage <= 1}
                                    onClick={handleFirstPage}
                                    style={{ padding: '6px 12px' }}
                                    title="First page"
                                >
                                    «
                                </button>
                                <button
                                    type="button"
                                    className="qc-page-btn"
                                    disabled={currentPage <= 1}
                                    onClick={handlePrevPage}
                                    title="Previous page"
                                >
                                    <ArrowLeft size={13} strokeWidth={2.5} /> Previous
                                </button>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: '#0f172a'
                                }}>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    className="qc-page-btn"
                                    disabled={currentPage >= totalPages || filteredIndices.length === 0}
                                    onClick={handleNextPage}
                                    title="Next page"
                                >
                                    Next <ArrowRight size={13} strokeWidth={2.5} />
                                </button>
                                <button
                                    type="button"
                                    className="qc-page-btn"
                                    disabled={currentPage >= totalPages || filteredIndices.length === 0}
                                    onClick={handleLastPage}
                                    style={{ padding: '6px 12px' }}
                                    title="Last page"
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {showWeightModal && (
                <WeightageModal
                    onClose={() => setShowWeightModal(false)}
                    onApply={applyWeights}
                />
            )}
        </div>
    );
};

export default QcDataCheck;