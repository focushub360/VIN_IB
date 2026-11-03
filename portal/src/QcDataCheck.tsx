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
import type { ExistingCounts } from './WeightageModal';

import {
    L2_GROUPS,
    POSITIVE_DRIVERS,
    SERVICE_POSITIVE_GROUPS,
    SERVICE_NEGATIVE_GROUPS
} from './weightageHelpers';
import type { WeightagePayload } from './weightageHelpers';
import {
    WORKSHOP_POSITIVE_L2_TO_COL,
    WORKSHOP_POSITIVE_L2_TO_L3,
    WORKSHOP_NEGATIVE_L2_TO_COL,
    WORKSHOP_NEGATIVE_L2_TO_L3,
    findWorkshopDriverForVerbatim,
    findWorkshopDriverForPhrase,
    pickWorkshopVerbatimForDriver,
    pickWorkshopNegVerbatimForDriver,
    findWorkshopNegDriverForText,
    WORKSHOP_NEGATIVE_VERBATIMS_BY_DRIVER
} from './shared/workshopDrivers';
import { getExcelColumnLetter } from './guineaSchema';
import {
    getRegions,
    getCountries,
    getIbVersions,
    getCommonUploads,
    getUploadData,
    updateUploadData,
    getCustomMasterData
} from './api';
import type {
    RegionItem,
    CountryItem,
    IbVersionItem,
    CommonUploadItem
} from './api';
import {
    EXCELLENT_POOLS,
    MAYBE_POSITIVE_POOLS,
    MAYBE_DISSATISFACTION_POOLS,
    DETRACTOR_POOLS
} from './verbatimPools';
import { NEGATIVE_TREE, ISSUE_COLUMN_RANGE_MAPPING } from './shared/negativeDetractors';
import {
    POSITIVE_DRIVER_L2_TO_L3,
    findDriverForVerbatim,
    pickVerbatimForDriver
} from './positiveDrivers';

/**
 * Maps an L2 complaint group name → the matching positive driver key used in
 * POSITIVE_DRIVER_L2_TO_L3. Returns null when there is no topic-relevant
 * positive driver for this L2 (caller falls back to rating pool).
 */
const L2_TO_POSITIVE_DRIVER: Record<string, string> = {
    'Brake issues': 'Brake',
    'Electrical issues': 'Electrical',
    'Engine issues': 'Engine',
    'Low Mileage': 'Mileage',
    'Low Speed': 'Vehicle',
    'Muffler issues': 'Sound',
    'Suspension issues': 'Suspension',
    'Vehicle noise': 'Sound',
    'Vibration': 'Suspension',
    'Mirror issues': 'Mirror',
    'Wheel/Tyre issues': 'Tyre',
    'Battery issues': 'Electrical',
    'Jerking issues': 'Engine',
    'Part not available': 'Spare parts',
    'Pick-up problem': 'Engine',
    'Running off': 'Engine',
    'Throttle/Accelerator issue': 'Engine',
    'Vehicle body parts issue': 'Vehicle',
    'Fuel related issue': 'Mileage',
    'Seat issue': 'Seat',
    'Vehicle Pulling problem': 'Vehicle',
    'Roof top (soft top) issue': 'Roof top (soft top)'
};

function pickPositiveForL2(l2: string): string {
    const key = L2_TO_POSITIVE_DRIVER[l2];
    if (!key) return '';
    const pool = POSITIVE_DRIVER_L2_TO_L3[key];
    if (!Array.isArray(pool) || pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
}

const POSITIVE_DRIVER_COLUMNS: Record<string, string> = {
    'Brake': 'Brake',
    'Electrical': 'Electrical',
    'Engine': 'Engine',
    'Load': 'Load',
    'Maintenance': 'Maintenance',
    'Mileage': 'Mileage',
    'Mirror': 'Mirror',
    'Vehicle': 'Vehicle',
    'Seat': 'Seat',
    'Sound': 'Sound',
    'Roof top (soft top)': 'Roof top (soft top)',
    'Spare parts': 'Spare parts',
    'Style': 'Style',
    'Suspension': 'Suspension',
    'Tyre': 'Tyre',
    'Vehicle price': 'Vehicle price',
    'Income': 'Income',
    'Windshield': 'Windshield',
    'Brand image': 'Brand image'
};

const PHRASE_TO_DRIVER = new Map<string, string>();
Object.entries(POSITIVE_DRIVER_L2_TO_L3).forEach(([driver, phrases]) => {
    (phrases || []).forEach(p => {
        PHRASE_TO_DRIVER.set(String(p).trim().toLowerCase(), driver);
    });
});

function findDriverForPhrase(phrase: string): string | null {
    if (!phrase) return null;
    return PHRASE_TO_DRIVER.get(String(phrase).trim().toLowerCase()) || null;
}

// =============================================================
// EXACT VERBATIM COLUMN FAMILIES
// =============================================================
// AB..AE — product positive (capped at 4, 3a)5 stays empty always)
const PROD_POS_COLS = [
    '3a)1 why will you recommend your vehicle?',
    '3a)2 why will you recommend your vehicle?',
    '3a)3 why will you recommend your vehicle?',
    '3a)4 why will you recommend your vehicle?'
];
const PROD_POS_COL_5 = '3a)5 why will you recommend your vehicle?';

// AG..AK — product negative (dissatisfaction)
const PROD_NEG_COLS = [
    '3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
    '3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
    '3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
    '3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
    '3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'
];

// AN..AR — product "why will you NOT recommend your vehicle"
const PROD_WHY_NOT_COLS = [
    '4)1 why will you not recommend your vehicle?',
    '4)2 why will you not recommend your vehicle?',
    '4)3 why will you not recommend your vehicle?',
    '4)4 why will you not recommend your vehicle?',
    '4)5 why will you not recommend your vehicle?'
];

// BW..BY — workshop positive
const WORK_POS_COLS = [
    '3a)1 Which experience you like the most to recommend Workshop / Dealer?',
    '3a)2 Which experience you like the most to recommend Workshop / Dealer?',
    '3a)3 Which experience you like the most to recommend Workshop / Dealer?'
];

// BZ..CB — workshop soft negative
const WORK_SOFT_NEG_COLS = [
    '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
    '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
    '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'
];

// CC..CE — workshop hard negative
const WORK_HARD_NEG_COLS = [
    '4)1 What are the main reasons for you have not recommend Workshop / Dealer?',
    '4)2 What are the main reasons for you have not recommend Workshop / Dealer?',
    '4)3 What are the main reasons for you have not recommend Workshop / Dealer?'
];

const COL_PRODUCT_REC_W = '1. Will you recommend your vehicle to your friends / relatives / family members?';

const COL_PRODUCT_NPS = '2. On a scale of 0 to 10, how likely are you to recommend your vehicle to your friends and relatives? (9 & 10 means “Yes Always recommend”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”)';

const COL_WS_NPS_A2 = 'A2. We have a rating scale from 0 to 10 to understand this better. (9 & 10 means “you will definitely recommend workshop / Dealers to service their vehicle”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”) You can choose';

const COL_WS_NPS_A11 = 'A11. Overall, how satisfied are you with your experience at our workshop/dealership for servicing your vehicle? (Please rate your satisfaction on a scale of “0 to 10”)';

const COL_WS_A1 = 'A1. Will you recommend / tell / advise your friends or family members for servicing their vehicle at Authorized Service workshop / Authorized Dealer?';

// The duplicated "A1" and "A2" columns — the sheet uses one of these depending
// on the region/excel export. Read both, prefer BS (A2) if it's 0-10, then BR (A1).
const COL_WS_A2 =
    'A2. We have a rating scale from 0 to 10 to understand this better. (9 & 10 means “you will definitely recommend workshop / Dealers to service their vehicle”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”) You can choose any score between 0 and 10. So which score would you like to give?';

// Some exports also carry a name-variation of A1 with "_2" suffix.
const COL_WS_A1_DUP =
    'A1. Will you recommend / tell / advise your friends or family members for servicing their vehicle at Authorized Service workshop / Authorized Dealer?_2';

const COL_WS_REC = COL_WS_A1;

function getWorkshopTier(
    row: Record<string, any>
): 'positive' | 'negative' | null {
    // Prefer A2 if it parses as a number 0-10
    let a2Raw = row[COL_WS_A2];
    if (a2Raw === undefined || a2Raw === null || String(a2Raw).trim() === '') {
        a2Raw = row[COL_WS_NPS_A2];
    }
    if (a2Raw === undefined || a2Raw === null || String(a2Raw).trim() === '') {
        const foundKey = Object.keys(row).find(k => /^A2\.\s*we have a rating scale/i.test(k));
        if (foundKey) a2Raw = row[foundKey];
    }

    if (a2Raw !== undefined && a2Raw !== null && String(a2Raw).trim() !== '') {
        // Could be a number or a string like "Yes" / "May be" / "No"
        const asNum = Number(a2Raw);
        if (!isNaN(asNum) && asNum >= 0 && asNum <= 10) {
            return asNum >= 7 ? 'positive' : 'negative';
        }
        const asStr = String(a2Raw).trim().toLowerCase();
        if (asStr === 'yes') return 'positive';
        if (asStr === 'may be' || asStr === 'maybe' || asStr === 'may be ') return 'positive';
        if (asStr === 'no') return 'negative';
    }

    // Fall back to A1 (check both the base name and the _2 variant)
    const a1Candidates = [row[COL_WS_A1], row[COL_WS_A1_DUP]];
    for (const raw of a1Candidates) {
        if (raw === undefined || raw === null) continue;
        const s = String(raw).trim().toLowerCase();
        if (!s) continue;
        if (s === 'yes' || s === 'may be' || s === 'maybe') return 'positive';
        if (s === 'no') return 'negative';
    }
    const foundA1Key = Object.keys(row).find(k => /^A1\.\s*will you recommend/i.test(k));
    if (foundA1Key) {
        const s = String(row[foundA1Key] || '').trim().toLowerCase();
        if (s === 'yes' || s === 'may be' || s === 'maybe') return 'positive';
        if (s === 'no') return 'negative';
    }

    // Unknown — skip the row
    return null;
}

type ProductRating = 'promoter' | 'passive' | 'detractor';

function readProductRating(row: Record<string, any>): ProductRating {
    let raw = row[COL_PRODUCT_REC_W];
    if (raw === undefined || raw === null) {
        const foundKey = Object.keys(row).find(k => /^1\.\s*will you recommend your vehicle/i.test(k));
        if (foundKey) raw = row[foundKey];
    }
    const val = String(raw || '').trim().toLowerCase();
    if (val.startsWith('yes')) return 'promoter';
    if (val.startsWith('may') || val.includes('maybe')) return 'passive';
    if (val.startsWith('no')) return 'detractor';

    // Fallback: check numeric rating if present
    const num = readProductNps(row);
    if (num >= 9) return 'promoter';
    if (num >= 7) return 'passive';
    return 'detractor';
}

function readProductTier(row: Record<string, any>): 'promoter' | 'passive' | 'detractor' | null {
    return readProductRating(row);
}

type WorkshopRating = 'yes' | 'no';

function readWorkshopRating(row: Record<string, any>): WorkshopRating {
    let raw = row[COL_WS_REC];
    if (raw === undefined || raw === null) {
        const foundKey = Object.keys(row).find(k => /^A1\.\s*will you recommend/i.test(k));
        if (foundKey) raw = row[foundKey];
    }
    const val = String(raw || '').trim().toLowerCase();
    if (val.startsWith('no')) return 'no';
    if (val.startsWith('yes')) return 'yes';

    // Fallback: check numeric A2/A11 or default 'yes'
    const n = readWorkshopNps(row);
    return n <= 6 ? 'no' : 'yes';
}

function readProductNps(row: Record<string, any>): number {
    const raw =
        row[COL_PRODUCT_NPS]
        ?? row['2. Likely to recommend vehicle (0-10)']
        ?? row['nps_score'];
    const n = Number(raw);
    return (!isNaN(n) && n >= 0 && n <= 10) ? n : 9; // default promoter
}

function readWorkshopNps(row: Record<string, any>): number {
    const a2 = Number(row[COL_WS_NPS_A2]);
    if (!isNaN(a2) && a2 >= 0 && a2 <= 10) return a2;

    const a11 = Number(row[COL_WS_NPS_A11]);
    if (!isNaN(a11) && a11 >= 0 && a11 <= 10) return a11;

    const rec = String(row[COL_WS_REC] || '').trim().toLowerCase();
    if (rec === 'yes') return 9;
    if (rec === 'no') return 6;
    return 9; // default promoter for workshop too
}

function ensureAutoVerbatimSet(row: Record<string, any>): Set<string> {
    if (!(row.__autoVerbatim instanceof Set)) {
        row.__autoVerbatim = new Set<string>();
    }
    return row.__autoVerbatim;
}

function isEmptyCell(v: any): boolean {
    if (v === undefined || v === null) return true;
    const s = String(v).trim();
    return s === '' || /^submit form\.+$/i.test(s);
}

function fillIfEmpty(row: Record<string, any>, col: string, phrase: string): void {
    if (!col || !phrase) return;
    if (!isEmptyCell(row[col])) return;
    row[col] = phrase;
    ensureAutoVerbatimSet(row).add(col);
}

function clearIfAutoFilled(row: Record<string, any>, col: string): void {
    const set = ensureAutoVerbatimSet(row);
    if (!set.has(col)) return;
    row[col] = '';
    set.delete(col);
}

// Flatten a Record<string, string[]> or string[][] into a single string[] pool
function flattenPool(map: Record<string, string[]> | string[][]): string[] {
    const out: string[] = [];
    for (const arr of Object.values(map)) {
        if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
}

// Pick N DISTINCT random phrases from the pool
function pickDistinct(pool: string[], count: number): string[] {
    if (pool.length === 0) return [];
    const copy = [...pool].sort(() => Math.random() - 0.5);
    const unique = Array.from(new Set(copy));
    return unique.slice(0, count);
}

// For Service Negative: Map column name back to the L3 phrase pool
const WORKSHOP_NEG_COL_TO_L3: Record<string, string[]> = {};
Object.entries(WORKSHOP_NEGATIVE_L2_TO_COL).forEach(([l2Name, colName]) => {
    if (colName && WORKSHOP_NEGATIVE_L2_TO_L3[l2Name]) {
        WORKSHOP_NEG_COL_TO_L3[colName] = WORKSHOP_NEGATIVE_L2_TO_L3[l2Name];
    }
});

// For Service Positive: Map column name back to the L3 phrase pool
const WORKSHOP_POS_COL_TO_L3: Record<string, string[]> = {};
Object.entries(WORKSHOP_POSITIVE_L2_TO_COL).forEach(([l2Name, colName]) => {
    if (colName && WORKSHOP_POSITIVE_L2_TO_L3[l2Name]) {
        WORKSHOP_POS_COL_TO_L3[colName] = WORKSHOP_POSITIVE_L2_TO_L3[l2Name];
    }
});

// Map Positive Driver columns (AU..BM) back to their L3 pool
const PROD_POS_COL_TO_L3: Record<string, string[]> = {};
Object.entries(POSITIVE_DRIVER_L2_TO_L3).forEach(([l2Name, l3List]) => {
    // In product, the column name IS the L2 name (e.g. 'Brake')
    PROD_POS_COL_TO_L3[l2Name] = l3List;
});

function fillWorkshopVerbatims(
    row: Record<string, any>,
    addedPositive: boolean,
    addedNegative: boolean
): void {
    const tier = getWorkshopTier(row);
    if (tier === null) return;

    // Helper: Find which driver columns actually have values in this row
    const getFilledDrivers = (driverMap: Record<string, string>) => {
        const filled: { col: string; phrase: string }[] = [];
        for (const [l2, colName] of Object.entries(driverMap)) {
            if (!isEmptyCell(row[colName])) {
                filled.push({ col: colName, phrase: String(row[colName]) });
            }
        }
        return filled;
    };

    // 1. Positive Input (Fill 3a from POSITIVE driver columns)
    if (addedPositive && !addedNegative && tier === 'positive') {
        const filledPosDrivers = getFilledDrivers(WORKSHOP_POSITIVE_L2_TO_COL);
        const empty3a = WORK_POS_COLS.filter(c => isEmptyCell(row[c]));

        for (let i = 0; i < empty3a.length && i < filledPosDrivers.length; i++) {
            row[empty3a[i]] = filledPosDrivers[i].phrase;
            ensureAutoVerbatimSet(row).add(empty3a[i]);
        }
    }

    // 2. Negative Input (Fill 3b OR 4a from NEGATIVE driver columns)
    if (addedNegative && !addedPositive) {
        const filledNegDrivers = getFilledDrivers(WORKSHOP_NEGATIVE_L2_TO_COL);

        if (tier === 'positive') {
            // Yes/Maybe -> Fill 3b ONLY
            const empty3b = WORK_SOFT_NEG_COLS.filter(c => isEmptyCell(row[c]));
            for (let i = 0; i < empty3b.length && i < filledNegDrivers.length; i++) {
                row[empty3b[i]] = filledNegDrivers[i].phrase;
                ensureAutoVerbatimSet(row).add(empty3b[i]);
            }
        } else if (tier === 'negative') {
            // No -> Fill 4a ONLY
            const empty4a = WORK_HARD_NEG_COLS.filter(c => isEmptyCell(row[c]));
            for (let i = 0; i < empty4a.length && i < filledNegDrivers.length; i++) {
                row[empty4a[i]] = filledNegDrivers[i].phrase;
                ensureAutoVerbatimSet(row).add(empty4a[i]);
            }
        }
    }

    // 3. Safety Cleanup (same as before)
    if (tier === 'positive') {
        for (const col of WORK_HARD_NEG_COLS) {
            if (ensureAutoVerbatimSet(row).has(col)) {
                row[col] = '';
                ensureAutoVerbatimSet(row).delete(col);
            }
        }
    } else if (tier === 'negative') {
        for (const col of [...WORK_POS_COLS, ...WORK_SOFT_NEG_COLS]) {
            if (ensureAutoVerbatimSet(row).has(col)) {
                row[col] = '';
                ensureAutoVerbatimSet(row).delete(col);
            }
        }
    }
}

function fillProductVerbatims(
    row: Record<string, any>,
    addedPositive: boolean,
    addedNegative: boolean,
    l2SlotCols?: string[]
): void {
    const productTier = readProductTier(row);
    if (productTier === null) return;

    const getFilledDrivers = (colList: string[], isPositive: boolean) => {
        const filled: { col: string; phrase: string }[] = [];
        for (const col of colList) {
            if (!isEmptyCell(row[col])) {
                filled.push({ col, phrase: String(row[col]) });
            }
        }
        return filled;
    };

    // 1. Positive Input (Fill 3a from Positive Driver columns AU..BM)
    if (addedPositive && !addedNegative && (productTier === 'promoter' || productTier === 'passive')) {
        const posDriverCols = Object.keys(POSITIVE_DRIVER_L2_TO_L3);
        const filledPos = getFilledDrivers(posDriverCols, true);
        const empty3a = PROD_POS_COLS.filter(c => isEmptyCell(row[c]));

        for (let i = 0; i < empty3a.length && i < filledPos.length; i++) {
            row[empty3a[i]] = filledPos[i].phrase;
            ensureAutoVerbatimSet(row).add(empty3a[i]);
        }
    }

    // 2. Negative Input (Fill 3b / 4a from L2 slots)
    if (addedNegative && !addedPositive) {
        // To get the phrase for 3b, we look at which L2s are present
        const filledL2s: string[] = [];
        if (l2SlotCols && l2SlotCols.length > 0) {
            for (const c of l2SlotCols) {
                if (!isEmptyCell(row[c])) {
                    filledL2s.push(String(row[c]).trim());
                }
            }
        } else {
            for (const v of Object.values(row)) {
                if (typeof v === 'string' && L2_GROUPS.includes(v.trim())) {
                    filledL2s.push(v.trim());
                }
            }
        }

        // Get 1 phrase per filled L2
        const negPhrases: string[] = [];
        const usedSet = new Set<string>();
        for (const l2 of filledL2s) {
            const phrase = pickPhraseForL2(l2, usedSet);
            if (phrase) {
                negPhrases.push(phrase);
                usedSet.add(phrase.toLowerCase());
            } else {
                const pool = productTier === 'detractor' ? flattenPool(DETRACTOR_POOLS) : flattenPool(MAYBE_DISSATISFACTION_POOLS);
                if (pool.length > 0) {
                    const p = pool[Math.floor(Math.random() * pool.length)];
                    negPhrases.push(p);
                    usedSet.add(p.toLowerCase());
                }
            }
        }

        if (productTier === 'promoter' || productTier === 'passive') {
            const empty3b = PROD_NEG_COLS.filter(c => isEmptyCell(row[c]));
            for (let i = 0; i < empty3b.length && i < negPhrases.length; i++) {
                row[empty3b[i]] = negPhrases[i];
                ensureAutoVerbatimSet(row).add(empty3b[i]);
            }
        } else if (productTier === 'detractor') {
            const empty3b = PROD_NEG_COLS.filter(c => isEmptyCell(row[c]));
            const empty4a = PROD_WHY_NOT_COLS.filter(c => isEmptyCell(row[c]));

            for (let i = 0; i < empty3b.length && i < negPhrases.length; i++) {
                row[empty3b[i]] = negPhrases[i];
                ensureAutoVerbatimSet(row).add(empty3b[i]);
            }
            for (let i = 0; i < empty4a.length && i < negPhrases.length; i++) {
                row[empty4a[i]] = negPhrases[i];
                ensureAutoVerbatimSet(row).add(empty4a[i]);
            }
        }
    }

    // 3. Safety Cleanup (same as before)
    if (productTier === 'promoter' || productTier === 'passive') {
        for (const col of PROD_WHY_NOT_COLS) {
            if (ensureAutoVerbatimSet(row).has(col)) {
                row[col] = '';
                ensureAutoVerbatimSet(row).delete(col);
            }
        }
    } else if (productTier === 'detractor') {
        for (const col of PROD_POS_COLS) {
            if (ensureAutoVerbatimSet(row).has(col)) {
                row[col] = '';
                ensureAutoVerbatimSet(row).delete(col);
            }
        }
    }
}

/**
 * Returns true if a phrase reads as a descriptive complaint / improvement
 * sentence, false if it looks like an enum answer, a number, a short code,
 * or a position token. This keeps 3b / 4) / 3a cells semantically clean.
 */
function isDescriptivePhrase(raw: any): boolean {
    if (raw === undefined || raw === null) return false;
    const s = String(raw).trim();
    if (s.length < 6) return false;
    if (/^\d+$/.test(s)) return false;
    if (/^[\d\s.,/+-]+$/.test(s)) return false;

    const lower = s.toLowerCase();

    const REJECT_EXACT = new Set([
        'yes', 'no', 'ok', 'not ok', 'front', 'rear', 'left', 'right',
        'lh side', 'rh side', 'both side', 'lh', 'rh', 'both',
        'daily', 'weekly', 'monthly',
        'once in a week', 'once in 2 week', '4 times a week',
        '3 times a week', '2 times a week',
        'idling', 'constant speed', 'idling speed', 'while running',
        'cold condition', 'hot condition',
        'morning time', 'moring time', 'morning time only', 'moring time only',
        'during long parking',
        'not starting after driving few km',
        'front portion', 'middle portion', 'rear portion',
        'front lh side', 'front rh side', 'front both side',
        'rear lh side', 'rear rh side', 'rear both side',
        'rough road', 'plain road', 'gradient road',
        'exide', 'amron', 'amco', 'tata green',
        'n-1', '1-2', '2-3', '3-4', '4-5', '5-4', '1-n', '2-1',
        '3-2', '4-3', '5-4', 'all gears',
        'less than 1month', '1-3 months', '3-6 months', 'more than 6 months',
        'all time brake noise'
    ]);
    if (REJECT_EXACT.has(lower)) return false;

    if (/morn?ing\s*time/i.test(lower)) return false;

    if (/^(less than|more than|morethan|lessthan)?\s*\d+\s*(kmph|km|kms|km\/l|hours?|months?|days?|kg)$/i.test(lower)) return false;
    if (/^\d+\s*-\s*\d+\s*(kmph|km|kms|months?|hours?|kg)$/i.test(lower)) return false;
    if (/^less\s*than\s*\d+\s*(kmph|km|kms|kg)$/i.test(lower)) return false;

    const WHEN_ONLY = /^(morning|morning time|all time|during|while|after|before|idling|constant)\s*(time|condition|speed|running|parking|brake|drive)?\s*(only)?$/i;
    if (WHEN_ONLY.test(lower)) return false;

    const SIDE_ONLY = /^(front|rear|lh|rh|left|right|both)\s*(side|portion|both)?$/i;
    if (SIDE_ONLY.test(lower)) return false;

    if (!/[a-z]{4,}/i.test(lower)) return false;
    return true;
}

function pickDescriptive(arr: any): string {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    const cleaned = arr
        .map(x => (x == null ? '' : String(x).trim()))
        .filter(x => x.length > 0 && isDescriptivePhrase(x));
    const pool = cleaned.length > 0 ? cleaned : arr.map(x => String(x || '').trim()).filter(Boolean);
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Curated defect vocabulary enhancements for L2 groups where NEGATIVE_TREE has
 * very short or single-value options (e.g. Cable issues, Chain issue).
 */
const EXTRA_L2_DEFECT_PHRASES: Record<string, string[]> = {
    'Cable issues': [
        'Clutch cable breakage',
        'Clutch cable less life',
        'Clutch cable tight',
        'Clutch cable loose',
        'Clutch cable hard to pull',
        'Brake cable breakage',
        'Brake cable less life',
        'Brake cable tight',
        'Brake cable loose',
        'Speedo cable breakage',
        'Speedometer cable broken',
        'Speedo cable not working',
        'Cable breakage',
        'Cable friction sticky'
    ],
    'Chain issue': [
        'Chain noise',
        'Chain loose',
        'Chain Tight',
        'Chain slipping',
        'Chain sprocket wear',
        'Drive chain noise',
        'Chain dry needs lubrication',
        'Chain slack issue',
        'Chain case noise',
        'Chain case damage'
    ],
    'Brake issues': [
        'Front brake noise',
        'Front brake poor',
        'Front brake tight',
        'Rear brake noise',
        'Rear brake poor',
        'Rear brake tight',
        'Hand brake poor',
        'Hand brake slippage',
        'hard to apply brake',
        'Stopping distance is high',
        'Brake shoe quick wear',
        'Disc pad quick wear',
        'Pedal not return',
        'Pedal play loose',
        'too soft or spongy brake',
        'Lever touching accelerator',
        'Lever play loose',
        'Lever play tight'
    ]
};

/**
 * Picks ONE phrase for the given L2, ensuring wide defect variety across rows:
 *   1) Collects item keys, item keywords, combinations, options, and curated phrases from L2's tree
 *   2) Filters with isDescriptivePhrase to remove enum/speed/time tokens
 *   3) Prefers phrases not already used in this row (via usedSet)
 *   4) Falls back gracefully to L2 name if empty
 */
function pickPhraseForL2(l2: string, usedSet?: Set<string>): string {
    const node: any = (NEGATIVE_TREE as any)[l2];

    const allOptions: string[] = [];
    const push = (val?: any) => {
        if (!val) return;
        if (Array.isArray(val)) {
            for (const s of val) push(s);
            return;
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.length > 0) allOptions.push(trimmed);
        }
    };

    // Add extra curated defect phrases for this L2 if defined
    if (EXTRA_L2_DEFECT_PHRASES[l2]) {
        push(EXTRA_L2_DEFECT_PHRASES[l2]);
    }

    if (node) {
        if (node.type === 'named' && node.items) {
            for (const [itemKey, item] of Object.entries<any>(node.items)) {
                push(itemKey);
                push(item?.keywords);
                push(item?.options);
                push(item?.L4?.options);
                push(item?.L5?.options);
                push(item?.L6?.options);

                // Combine itemKey with L4 options if generic (e.g. "Clutch cable - Cable breakage")
                if (Array.isArray(item?.L4?.options)) {
                    for (const opt of item.L4.options) {
                        if (typeof opt === 'string' && opt.trim().length > 0) {
                            const trimmedOpt = opt.trim();
                            if (/morn?ing\s*time/i.test(trimmedOpt)) continue;
                            if (!trimmedOpt.toLowerCase().includes(itemKey.toLowerCase())) {
                                push(`${itemKey} ${trimmedOpt}`);
                            }
                        }
                    }
                }
            }
        } else if ((node.type === 'single' || node.type === 'split') && Array.isArray(node.options)) {
            push(node.keywords);
            push(node.options);
            push(node.L4?.options);
            push(node.L5?.options);
            push(node.L6?.options);
        }
    }

    if (allOptions.length === 0) {
        return l2;
    }

    // Filter to descriptive phrases
    const descriptive = Array.from(new Set(allOptions.filter(isDescriptivePhrase)));

    const pool = descriptive.length > 0 ? descriptive : Array.from(new Set(allOptions));

    // Prefer a phrase not used in this row
    if (usedSet && usedSet.size > 0) {
        const fresh = pool.filter(p => !usedSet.has(p.toLowerCase()));
        if (fresh.length > 0) {
            return fresh[Math.floor(Math.random() * fresh.length)];
        }
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

function countFilledDrivers(row: Record<string, any>, driverMap: Record<string, string>): number {
    let count = 0;
    for (const col of Object.values(driverMap)) {
        if (!isEmptyCell(row[col])) count++;
    }
    return count;
}

function countFilledVerbatims(row: Record<string, any>, verbatimCols: string[]): number {
    let count = 0;
    for (const col of verbatimCols) {
        if (!isEmptyCell(row[col])) count++;
    }
    return count;
}

function fillColumnsVertically(
    rows: Record<string, any>[],
    columnsToFill: string[],
    requestedCount: number,
    phraseGenerator: (row: Record<string, any>, colName: string, usedInCol: Set<string>) => string | null,
    isRowEligible: (row: Record<string, any>) => boolean,
    onCellFilled?: (row: Record<string, any>, rIdx: number, colName: string, phrase: string) => void
): number {
    let fillsDone = 0;
    const usedPhrasesPerCol = new Map<string, Set<string>>();

    for (let ci = 0; ci < columnsToFill.length; ci++) {
        if (fillsDone >= requestedCount) break;

        const col = columnsToFill[ci];
        const usedInCol = new Set<string>();
        for (let r = 0; r < rows.length; r++) {
            const v = rows[r][col];
            if (!isEmptyCell(v)) {
                usedInCol.add(String(v).trim());
                usedInCol.add(String(v).trim().toLowerCase());
            }
        }
        usedPhrasesPerCol.set(col, usedInCol);

        for (let r = 0; r < rows.length; r++) {
            if (fillsDone >= requestedCount) break;

            const row = rows[r];
            if (!isRowEligible(row)) continue;
            if (!isEmptyCell(row[col])) continue; // Don't overwrite existing

            // Prevent gaps: if filling a sequence of columns (ci > 0), require previous column to be filled
            if (ci > 0 && isEmptyCell(row[columnsToFill[ci - 1]])) {
                continue;
            }

            // Generate the phrase based on the row's context
            const phrase = phraseGenerator(row, col, usedInCol);
            if (phrase) {
                row[col] = phrase;
                ensureAutoVerbatimSet(row).add(col);
                usedInCol.add(phrase.trim());
                usedInCol.add(phrase.trim().toLowerCase());
                fillsDone++;
                if (onCellFilled) {
                    onCellFilled(row, r, col, phrase);
                }
            }
        }
    }
    return fillsDone;
}

function pickWsNegForRow(
    row: Record<string, any>,
    verbCols: string[],
    usedInCol: Set<string>
): string | null {
    const lower = (s: any) => String(s || '').trim().toLowerCase();
    const usedInRow = new Set(verbCols.map(c => lower(row[c])).filter(Boolean));

    // negative drivers that already have a verbatim in this row
    const covered = new Set<string>();
    for (const c of verbCols) {
        if (isEmptyCell(row[c])) continue;
        const d = findWorkshopNegDriverForText(String(row[c]));
        if (d) covered.add(d);
    }

    for (const [l2, driverCol] of Object.entries(WORKSHOP_NEGATIVE_L2_TO_COL)) {
        if (isEmptyCell(row[driverCol]) || covered.has(l2)) continue;
        const v = pickWorkshopNegVerbatimForDriver(l2, usedInRow, usedInCol);
        if (v) return v;
    }
    return null;
}

function applyServiceVerbatimsColumnFirst(
    newRows: Record<string, any>[],
    addedPosByRow: Set<number>,
    addedNegByRow: Set<number>
): void {
    // 1. Positive Verbatims (3a)1..3)
    fillColumnsVertically(
        newRows,
        WORK_POS_COLS,
        999999,
        (row, col, usedInCol) => {
            const lower = (s: any) => String(s || '').trim().toLowerCase();
            const usedInRow = new Set(WORK_POS_COLS.map(c => lower(row[c])).filter(Boolean));

            // drivers that already have a 3a phrase
            const covered = new Set<string>();
            for (const c of WORK_POS_COLS) {
                if (isEmptyCell(row[c])) continue;
                const d = findWorkshopDriverForVerbatim(String(row[c])) || findWorkshopDriverForPhrase(String(row[c]));
                if (d) covered.add(d);
            }

            // next filled driver column with no 3a phrase yet
            for (const [l2, driverCol] of Object.entries(WORKSHOP_POSITIVE_L2_TO_COL)) {
                if (isEmptyCell(row[driverCol]) || covered.has(l2)) continue;
                const v = pickWorkshopVerbatimForDriver(l2, usedInRow, usedInCol);
                if (v) return v;
            }
            return null;
        },
        (row) => {
            if (getWorkshopTier(row) !== 'positive') return false;
            const rIdx = row.__idx;
            if (!addedPosByRow.has(rIdx)) return false;
            const numPosDrivers = countFilledDrivers(row, WORKSHOP_POSITIVE_L2_TO_COL);
            const filled3a = countFilledVerbatims(row, WORK_POS_COLS);
            return filled3a < numPosDrivers && filled3a < 3;
        }
    );

    // 2. Soft Negative Verbatims (3b)1..3) on Positive tier rows
    fillColumnsVertically(
        newRows,
        WORK_SOFT_NEG_COLS,
        999999,
        (row, col, usedInCol) => pickWsNegForRow(row, WORK_SOFT_NEG_COLS, usedInCol),
        (row) => {
            if (getWorkshopTier(row) !== 'positive') return false;
            const rIdx = row.__idx;
            if (!addedNegByRow.has(rIdx)) return false;
            const numNegDrivers = countFilledDrivers(row, WORKSHOP_NEGATIVE_L2_TO_COL);
            const filled3b = countFilledVerbatims(row, WORK_SOFT_NEG_COLS);
            return filled3b < numNegDrivers && filled3b < 3;
        }
    );

    // 3. Hard Negative Verbatims (4)1..3) on Negative tier rows
    fillColumnsVertically(
        newRows,
        WORK_HARD_NEG_COLS,
        999999,
        (row, col, usedInCol) => pickWsNegForRow(row, WORK_HARD_NEG_COLS, usedInCol),
        (row) => {
            if (getWorkshopTier(row) !== 'negative') return false;
            const rIdx = row.__idx;
            if (!addedNegByRow.has(rIdx)) return false;
            const numNegDrivers = countFilledDrivers(row, WORKSHOP_NEGATIVE_L2_TO_COL);
            const filled4a = countFilledVerbatims(row, WORK_HARD_NEG_COLS);
            return filled4a < numNegDrivers && filled4a < 3;
        }
    );
}

function applyProductVerbatimsColumnFirst(
    newRows: Record<string, any>[],
    addedPosByRow: Set<number>,
    addedL2sByRow: Map<number, string[]>,
    l2SlotCols: string[]
): void {
    // 1. Positive Product Verbatims (3a)1..4)
    fillColumnsVertically(
        newRows,
        PROD_POS_COLS,
        999999,
        (row, col, usedInCol) => {
            const lower = (s: any) => String(s || '').trim().toLowerCase();
            const usedInRow = new Set(PROD_POS_COLS.map(c => lower(row[c])).filter(Boolean));

            // drivers that already have a 3a phrase in this row
            const covered = new Set<string>();
            for (const c of PROD_POS_COLS) {
                if (isEmptyCell(row[c])) continue;
                const d = findDriverForVerbatim(String(row[c])) || findDriverForPhrase(String(row[c]));
                if (d) covered.add(d);
            }

            // next filled driver with no 3a phrase yet
            for (const driverCol of Object.values(POSITIVE_DRIVER_COLUMNS)) {
                if (isEmptyCell(row[driverCol]) || covered.has(driverCol)) continue;
                const v = pickVerbatimForDriver(driverCol, usedInRow, usedInCol);
                if (v) return v;
            }
            return null;
        },
        (row) => {
            const tier = readProductTier(row);
            if (tier === 'detractor') return false;
            const rIdx = row.__idx;
            if (!addedPosByRow.has(rIdx)) return false;
            const numPosDrivers = countFilledDrivers(row, POSITIVE_DRIVER_COLUMNS);
            const filled3a = countFilledVerbatims(row, PROD_POS_COLS);
            return filled3a < numPosDrivers && filled3a < 4;
        }
    );

    // 2. Negative Product Verbatims (3b.1..5) for Promoter / Passive
    fillColumnsVertically(
        newRows,
        PROD_NEG_COLS,
        999999,
        (row, col, usedInCol) => {
            const usedInRow = new Set(PROD_NEG_COLS.map(c => String(row[c] || '').trim().toLowerCase()));
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            for (const l2 of addedL2s) {
                const phrase = pickPhraseForL2(l2, usedInCol);
                if (phrase && !usedInRow.has(phrase.toLowerCase())) {
                    return phrase;
                }
            }
            const pool = flattenPool(MAYBE_DISSATISFACTION_POOLS);
            const available = pool.filter(p => !usedInCol.has(p) && !usedInCol.has(p.trim().toLowerCase()) && !usedInRow.has(p.trim().toLowerCase()));
            return available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
        },
        (row) => {
            const tier = readProductTier(row);
            if (tier !== 'promoter' && tier !== 'passive') return false;
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            if (addedL2s.length === 0) return false;
            const filled3b = countFilledVerbatims(row, PROD_NEG_COLS);
            return filled3b < addedL2s.length && filled3b < 5;
        }
    );

    // 3. Negative Product Verbatims (3b.1..5 and 4)1..5) for Detractor
    fillColumnsVertically(
        newRows,
        PROD_NEG_COLS,
        999999,
        (row, col, usedInCol) => {
            const usedInRow = new Set(PROD_NEG_COLS.map(c => String(row[c] || '').trim().toLowerCase()));
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            for (const l2 of addedL2s) {
                const phrase = pickPhraseForL2(l2, usedInCol);
                if (phrase && !usedInRow.has(phrase.toLowerCase())) {
                    return phrase;
                }
            }
            const pool = flattenPool(DETRACTOR_POOLS);
            const available = pool.filter(p => !usedInCol.has(p) && !usedInCol.has(p.trim().toLowerCase()) && !usedInRow.has(p.trim().toLowerCase()));
            return available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
        },
        (row) => {
            const tier = readProductTier(row);
            if (tier !== 'detractor') return false;
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            if (addedL2s.length === 0) return false;
            const filled3b = countFilledVerbatims(row, PROD_NEG_COLS);
            return filled3b < addedL2s.length && filled3b < 5;
        }
    );

    fillColumnsVertically(
        newRows,
        PROD_WHY_NOT_COLS,
        999999,
        (row, col, usedInCol) => {
            const usedInRow = new Set(PROD_WHY_NOT_COLS.map(c => String(row[c] || '').trim().toLowerCase()));
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            for (const l2 of addedL2s) {
                const phrase = pickPhraseForL2(l2, usedInCol);
                if (phrase && !usedInRow.has(phrase.toLowerCase())) {
                    return phrase;
                }
            }
            const pool = flattenPool(DETRACTOR_POOLS);
            const available = pool.filter(p => !usedInCol.has(p) && !usedInCol.has(p.trim().toLowerCase()) && !usedInRow.has(p.trim().toLowerCase()));
            return available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
        },
        (row) => {
            const tier = readProductTier(row);
            if (tier !== 'detractor') return false;
            const rIdx = row.__idx;
            const addedL2s = addedL2sByRow.get(rIdx) || [];
            if (addedL2s.length === 0) return false;
            const filled4a = countFilledVerbatims(row, PROD_WHY_NOT_COLS);
            return filled4a < addedL2s.length && filled4a < 5;
        }
    );

    // 4. Safety Cleanup for Product
    for (let r = 0; r < newRows.length; r++) {
        const row = newRows[r];
        const autoSet = ensureAutoVerbatimSet(row);
        const tier = readProductTier(row);
        if (tier === 'promoter' || tier === 'passive') {
            for (const col of PROD_WHY_NOT_COLS) {
                if (autoSet.has(col)) {
                    row[col] = '';
                    autoSet.delete(col);
                }
            }
        } else if (tier === 'detractor') {
            for (const col of [...PROD_POS_COLS, PROD_POS_COL_5]) {
                if (autoSet.has(col)) {
                    row[col] = '';
                    autoSet.delete(col);
                }
            }
        }
    }
}



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

/**
 * Returns the allowed follow-up column names for an L2:
 *   - Looks up ISSUE_COLUMN_RANGE_MAPPING with trim + case-insensitive matching
 *   - Excludes the LAST 3 columns of that range (or keeps at least 1 for short ranges)
 *   - Maps each letter through idxToName so we get real column names
 * Returns [] if the L2 has no mapping.
 */
function getL2FollowUpColumns(
    l2: string,
    idxToName: Record<string, string>
): string[] {
    if (!l2) return [];
    const cleanL2 = String(l2).trim();

    // Exact trim+case-insensitive match first
    let matchedKey = Object.keys(ISSUE_COLUMN_RANGE_MAPPING).find(
        k => k.trim().toLowerCase() === cleanL2.toLowerCase()
    );
    // Fallback: loose substring match
    if (!matchedKey) {
        matchedKey = Object.keys(ISSUE_COLUMN_RANGE_MAPPING).find(
            k => cleanL2.toLowerCase().includes(k.trim().toLowerCase()) ||
                k.trim().toLowerCase().includes(cleanL2.toLowerCase())
        );
    }
    if (!matchedKey) return [];

    const range = (ISSUE_COLUMN_RANGE_MAPPING as any)[matchedKey];
    const startIdx = colLetterToIndex(range.start);
    const endIdx = colLetterToIndex(range.end);

    const all: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
        const letter = colIndexToLetter(i);
        const name = idxToName[letter];
        if (name) all.push(name);
    }

    // Exclude the last 3 columns, but always keep at least 1 for short ranges
    const keepCount = all.length > 3 ? all.length - 3 : Math.min(1, all.length);
    return all.slice(0, keepCount);
}

/**
 * Fills exactly ONE empty follow-up cell for the given L2:
 *   1. Compute allowed columns via getL2FollowUpColumns (last 3 excluded, min 1)
 *   2. Filter to empty columns only
 *   3. Shuffle the empty-column list, then for each, try to pick a valid
 *      non-empty option from QC_FOLLOWUP_OPTIONS[col] or findFollowupOptions()
 *   4. Fill the first successful (column, option) pair
 *   5. Return true if a fill happened, false otherwise
 * Never overwrites pre-existing values. Records filled cell in __autoVerbatim.
 */
function fillOneRandomFollowUpForL2(
    row: Record<string, any>,
    l2: string,
    idxToName: Record<string, string>
): boolean {
    if (!l2) return false;

    const allowed = getL2FollowUpColumns(l2, idxToName);
    if (allowed.length === 0) {
        console.warn(`[FollowUp] No range mapping found for L2: "${String(l2).trim()}"`);
        return false;
    }

    // Empty columns only
    const emptyCols = allowed.filter(c => isEmptyCell(row[c]));
    if (emptyCols.length === 0) return false;

    // Shuffle empty columns so we try them in random order
    const shuffled = [...emptyCols].sort(() => Math.random() - 0.5);

    for (const col of shuffled) {
        const opts = QC_FOLLOWUP_OPTIONS[col] || findFollowupOptions(col);
        if (!Array.isArray(opts) || opts.length === 0) continue;

        // Filter to non-empty string options
        const validOpts = opts.filter(
            o => typeof o === 'string' && o.trim().length > 0
        );
        if (validOpts.length === 0) continue;

        const chosen = validOpts[Math.floor(Math.random() * validOpts.length)];
        row[col] = chosen;
        ensureAutoVerbatimSet(row).add(col);
        return true;
    }

    return false;
}

export interface QcIssue {
    l2ColumnName: string;
    l2Value: string;
    followUpRangeLabel: string;
    followUpColNames: string[];
    isNoL2?: boolean;
}

export interface QcScanResult {
    issues: QcIssue[];
    ok: boolean;
    noL2?: boolean;
    missingGroups: Array<'positive' | 'l2' | 'servicePositive' | 'serviceNegative'>;
    groupFillCounts: {
        positive: number;
        l2: number;
        servicePositive: number;
        serviceNegative: number;
    };
}

export interface QcGroupColumns {
    positive: string[];
    l2: string[];
    servicePositive: string[];
    serviceNegative: string[];
}

export function buildQcGroupColumns(columnNames: string[]): QcGroupColumns {
    const idxToName: Record<string, string> = {};
    columnNames.forEach((name, i) => {
        idxToName[colIndexToLetter(i)] = name;
    });

    const getColsInRange = (startCol: string, endCol: string): string[] => {
        const start = colLetterToIndex(startCol);
        const end = colLetterToIndex(endCol);
        const cols: string[] = [];
        for (let i = start; i <= end; i++) {
            const nm = idxToName[colIndexToLetter(i)];
            if (nm) cols.push(nm);
        }
        return cols;
    };

    let l2 = getColsInRange('DF', 'EM');
    if (l2.length === 0) {
        l2 = columnNames.filter(c => /complaint group \(l2\)/i.test(c));
    }

    return {
        positive: getColsInRange('AU', 'BM'),
        l2,
        servicePositive: getColsInRange('OK', 'OW'),
        serviceNegative: getColsInRange('OX', 'PL')
    };
}

const QC_GROUP_META: Array<{
    key: 'positive' | 'l2' | 'servicePositive' | 'serviceNegative';
    label: string;
    rangeLabel: string;
}> = [
        { key: 'positive', label: 'Positive Drivers', rangeLabel: 'AU..BM' },
        { key: 'l2', label: 'Complaint Groups (L2)', rangeLabel: 'DF..EM' },
        { key: 'servicePositive', label: 'Service Positive', rangeLabel: 'OK..OW' },
        { key: 'serviceNegative', label: 'Service Negative', rangeLabel: 'OX..PL' }
    ];

function isQcCellFilled(val: any): boolean {
    if (val === undefined || val === null) return false;
    const s = String(val).trim();
    if (!s) return false;
    if (/^submit form\.+$/i.test(s)) return false;
    return true;
}

// Precomputed scan context to avoid rebuilding maps on every single row
interface QcScanContext {
    l2Cols: string[];
    l2FollowUpMap: Record<string, string[]>;
    groupColumns: QcGroupColumns;
}

function buildQcScanContext(columnNames: string[]): QcScanContext {
    const idxToName: Record<string, string> = {};
    columnNames.forEach((name, i) => {
        idxToName[colIndexToLetter(i)] = name;
    });

    const groupColumns = buildQcGroupColumns(columnNames);

    let l2Cols = columnNames.filter(c => /complaint group \(l2\)/i.test(c));
    if (l2Cols.length === 0) {
        l2Cols = groupColumns.l2;
    }

    const l2FollowUpMap: Record<string, string[]> = {};
    Object.entries(RANGE_LETTERS).forEach(([l2Key, letters]) => {
        const cols: string[] = [];
        letters.forEach(letter => {
            const nm = idxToName[letter];
            if (nm) cols.push(nm);
        });
        l2FollowUpMap[l2Key] = cols;
    });

    return { l2Cols, l2FollowUpMap, groupColumns };
}

function scanRowQcWithContext(
    row: Record<string, any>,
    ctx: QcScanContext
): QcScanResult {
    const issues: QcIssue[] = [];
    let hasAnyL2 = false;

    for (const l2Col of ctx.l2Cols) {
        const rawVal = row[l2Col];
        const val = String(rawVal ?? '').trim();
        if (!val) continue;
        if (/^submit form\.+$/i.test(val)) continue;

        hasAnyL2 = true;

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

    // Rows with no Complaint Group (L2) at all fail too
    if (!hasAnyL2 && ctx.l2Cols.length > 0) {
        issues.push({
            l2ColumnName: ctx.l2Cols[0],
            l2Value: '',
            followUpRangeLabel: 'L2 Required',
            followUpColNames: [],
            isNoL2: true
        });
    }

    const groupFillCounts = {
        positive: 0,
        l2: 0,
        servicePositive: 0,
        serviceNegative: 0
    };

    if (ctx.groupColumns) {
        for (const c of ctx.groupColumns.positive) {
            if (isQcCellFilled(row[c])) groupFillCounts.positive++;
        }
        for (const c of ctx.groupColumns.l2) {
            if (isQcCellFilled(row[c])) groupFillCounts.l2++;
        }
        for (const c of ctx.groupColumns.servicePositive) {
            if (isQcCellFilled(row[c])) groupFillCounts.servicePositive++;
        }
        for (const c of ctx.groupColumns.serviceNegative) {
            if (isQcCellFilled(row[c])) groupFillCounts.serviceNegative++;
        }
    }

    const missingGroups: Array<'positive' | 'l2' | 'servicePositive' | 'serviceNegative'> = [];
    if (groupFillCounts.positive === 0) missingGroups.push('positive');
    if (groupFillCounts.l2 === 0) missingGroups.push('l2');
    if (groupFillCounts.servicePositive === 0) missingGroups.push('servicePositive');
    if (groupFillCounts.serviceNegative === 0) missingGroups.push('serviceNegative');

    return {
        issues,
        ok: issues.length === 0,
        noL2: !hasAnyL2 && ctx.l2Cols.length > 0,
        missingGroups,
        groupFillCounts
    };
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
    onJumpToGroup: (globalIdx: number, group: 'positive' | 'l2' | 'servicePositive' | 'serviceNegative') => void;
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
    onJumpBackToL2,
    onJumpToGroup
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    {qc.ok ? (
                        <span className="modern-badge modern-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> PASS
                        </span>
                    ) : qc.noL2 ? (
                        <button
                            type="button"
                            className="modern-badge qc-fail-badge"
                            onClick={() => onJumpToFirstFailingL2(globalIdx)}
                            title="Click to jump to Complaint Group (L2) cell.\n\nNo Complaint Group (L2) found in any L2 column for this row."
                            style={{
                                border: '1px solid #fb923c',
                                background: '#ffedd5',
                                color: '#c2410c',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '11.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(234, 88, 12, 0.15)'
                            }}
                        >
                            <AlertTriangle size={12} />
                            FAIL (No L2)
                            <ArrowRight size={11} />
                        </button>
                    ) : (
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
                    )}

                    {/* 4 Category Indicator Dots */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        {QC_GROUP_META.map(meta => {
                            const count = qc.groupFillCounts ? qc.groupFillCounts[meta.key] : 0;
                            const isFilled = count > 0;
                            const color = isFilled ? '#16a34a' : '#dc2626';
                            const title = isFilled
                                ? `${meta.label} (${meta.rangeLabel}): ${count} ${count === 1 ? 'cell' : 'cells'} filled`
                                : `${meta.label} (${meta.rangeLabel}): empty`;

                            return (
                                <span
                                    key={meta.key}
                                    title={title}
                                    className={`qc-indicator-dot ${!isFilled ? 'clickable' : ''}`}
                                    onClick={!isFilled ? () => onJumpToGroup(globalIdx, meta.key) : undefined}
                                    style={{
                                        backgroundColor: color,
                                        cursor: !isFilled ? 'pointer' : 'default'
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Back Button (only when row is being navigated) */}
                    {!qc.ok && isFlashTargetThisRow && flashTargetKind !== 'badge' && (
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
            </td>

            {/* Data Columns */}
            {visibleColumns.map((col, j) => {
                const meta = columnMetaMap.get(col);
                const isL2 = l2Set.has(col);
                const isNoL2Cell = !!qc.noL2 && isL2;
                const isMissing = missingSet.has(col);
                const isFlashing = flashingCol === col;
                const cellVal = row[col];
                const strVal = cellVal === undefined || cellVal === null ? '' : String(cellVal);

                const isDropdownCell = !!meta?.isDropdown;
                const cellOpts = meta?.cellOpts;

                let bg = '#ffffff';
                let border = '1px solid #e2e8f0';
                if (isNoL2Cell) {
                    bg = '#fff7ed';
                    border = '2px dashed #ea580c';
                } else if (isL2) {
                    bg = '#fed7aa';
                    border = '2px solid #c2410c';
                } else if (isMissing) {
                    bg = '#fecaca';
                    border = '1px solid #b91c1c';
                }

                const cellId = `qc-cell-${globalIdx}-${col}`;
                const titleSuffix = isNoL2Cell
                    ? '\n\n▸ Missing Complaint Group (L2) — select a group'
                    : isL2
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

                                {/* Frontward Arrow on L2 Complaint cells (when L2 is present) */}
                                {isL2 && !isNoL2Cell && (
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



function computeExistingCounts(rows: Record<string, any>[], columns: string[]): ExistingCounts {
    const idxToName: Record<string, string> = {};
    columns.forEach((n, i) => { idxToName[colIndexToLetter(i)] = n; });

    const DF = colLetterToIndex('DF');
    const EM = colLetterToIndex('EM');
    const l2SlotCols: string[] = [];
    for (let i = DF; i <= EM; i++) {
        const nm = idxToName[colIndexToLetter(i)];
        if (nm) l2SlotCols.push(nm);
    }

    const isEmpty = (v: any) =>
        v === undefined || v === null ||
        String(v).trim() === '' ||
        /^submit form\.+$/i.test(String(v));

    const l2: Record<string, number> = {};
    L2_GROUPS.forEach(g => { l2[g] = 0; });
    for (const r of rows) {
        for (const c of l2SlotCols) {
            const v = r[c];
            if (isEmpty(v)) continue;
            const key = String(v).trim();
            const match = L2_GROUPS.find(g => g.toLowerCase() === key.toLowerCase());
            if (match) l2[match]++;
        }
    }

    const positive: Record<string, number> = {};
    POSITIVE_DRIVERS.forEach(d => {
        positive[d] = columns.includes(d)
            ? rows.reduce((acc, r) => acc + (isEmpty(r[d]) ? 0 : 1), 0)
            : 0;
    });

    const servicePositive: Record<string, number> = {};
    SERVICE_POSITIVE_GROUPS.forEach(name => {
        const col = WORKSHOP_POSITIVE_L2_TO_COL[name];
        const targetCol = columns.find(c => c === col) || col;
        servicePositive[name] = targetCol
            ? rows.reduce((acc, r) => acc + (isEmpty(r[targetCol]) ? 0 : 1), 0)
            : 0;
    });

    const serviceNegative: Record<string, number> = {};
    SERVICE_NEGATIVE_GROUPS.forEach(name => {
        const col = WORKSHOP_NEGATIVE_L2_TO_COL[name];
        const targetCol = columns.find(c => c === col) || col;
        serviceNegative[name] = targetCol
            ? rows.reduce((acc, r) => acc + (isEmpty(r[targetCol]) ? 0 : 1), 0)
            : 0;
    });

    return { l2, positive, servicePositive, serviceNegative };
}

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
    const scanContextRef = useRef<QcScanContext>({
        l2Cols: [],
        l2FollowUpMap: {},
        groupColumns: { positive: [], l2: [], servicePositive: [], serviceNegative: [] }
    });
    const groupColsRef = useRef<QcGroupColumns>({
        positive: [],
        l2: [],
        servicePositive: [],
        serviceNegative: []
    });
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const [showWeightModal, setShowWeightModal] = useState(false);
    const [existingCounts, setExistingCounts] = useState<ExistingCounts>({
        l2: {},
        positive: {},
        servicePositive: {},
        serviceNegative: {}
    });

    const handleOpenWeightModal = () => {
        const counts = computeExistingCounts(rows, columns);
        setExistingCounts(counts);
        setShowWeightModal(true);
    };

    // Common Data Sources & Dependent Filter State
    const [regions, setRegions] = useState<RegionItem[]>([]);
    const [countries, setCountries] = useState<CountryItem[]>([]);
    const [ibVersions, setIbVersions] = useState<IbVersionItem[]>([]);
    const [commonFiles, setCommonFiles] = useState<CommonUploadItem[]>([]);
    const [isLoadingFileList, setIsLoadingFileList] = useState<boolean>(false);

    const [filterRegion, setFilterRegion] = useState<string>('all');
    const [filterCountry, setFilterCountry] = useState<string>('all');
    const [filterIbVersion, setFilterIbVersion] = useState<string>('all');
    const [filterBrandModel, setFilterBrandModel] = useState<string>('all');
    const [brandModels, setBrandModels] = useState<string[]>([]);
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

        Promise.all([getRegions(), getIbVersions(), getCommonUploads(), getCustomMasterData()])
            .then(([regs, vers, files, customData]) => {
                if (!isMounted) return;
                setRegions(regs);
                setIbVersions(vers);
                setCommonFiles(files);
                if (customData && customData.brandModels) {
                    setBrandModels(customData.brandModels);
                }

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

    // Filter available common files based on Region, Country, IB Version, Brand & Model
    const filteredCommonFiles = useMemo(() => {
        return commonFiles.filter(f => {
            if (filterRegion !== 'all' && f.region_name.toLowerCase() !== filterRegion.toLowerCase()) return false;
            if (filterCountry !== 'all' && f.country_name.toLowerCase() !== filterCountry.toLowerCase()) return false;
            if (filterIbVersion !== 'all' && f.ib_version_name.toLowerCase() !== filterIbVersion.toLowerCase()) return false;
            if (filterBrandModel !== 'all' && (f.brand_model_name || 'General').toLowerCase() !== filterBrandModel.toLowerCase()) return false;
            return true;
        });
    }, [commonFiles, filterRegion, filterCountry, filterIbVersion, filterBrandModel]);

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
            groupColsRef.current = ctx.groupColumns;

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
                groupColsRef.current = ctx.groupColumns;

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

    const jumpToGroup = useCallback((rowIdx: number, groupKey: 'positive' | 'l2' | 'servicePositive' | 'serviceNegative') => {
        const cols = groupColsRef.current[groupKey] || scanContextRef.current?.groupColumns?.[groupKey] || [];
        if (!cols || cols.length === 0) return;
        const targetCol = cols[0];
        setVisibleCols(prev => {
            if (!prev[targetCol]) {
                return { ...prev, [targetCol]: true };
            }
            return prev;
        });
        setFlashTarget({
            rowIdx,
            colName: targetCol,
            token: Date.now(),
            kind: 'followup'
        });
    }, []);

    const handleExportQcReport = () => {
        if (rows.length === 0 || filteredIndices.length === 0) return;

        const exportCols = visibleColumns.length > 0 ? visibleColumns : columns;

        const report = filteredIndices.map((globalIdx) => {
            const row = rows[globalIdx] || {};
            const qc = scanResults[globalIdx];

            const exportRow: Record<string, any> = {
                '#': globalIdx + 1,
                'QC Status': qc?.ok ? 'PASS' : qc?.noL2 ? 'FAIL (No L2)' : 'FAIL',
                'QC Issues': qc?.noL2
                    ? 'No Complaint Group (L2) provided'
                    : (qc?.issues || [])
                        .map(is => `${is.l2ColumnName} = "${is.l2Value}" [expects ${is.followUpRangeLabel}]`)
                        .join(' | ')
            };

            exportCols.forEach(col => {
                const cellVal = row[col];
                exportRow[col] = cellVal !== undefined && cellVal !== null ? cellVal : '';
            });

            return exportRow;
        });

        const ws = XLSX.utils.json_to_sheet(report);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QC Data');
        const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Report';
        XLSX.writeFile(wb, `QC_Data_Check_${cleanName}.xlsx`);
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
        const ctx = scanContextRef.current && scanContextRef.current.l2Cols.length > 0
            ? scanContextRef.current
            : buildQcScanContext(columnNames);
        return scanRowQcWithContext(row, ctx);
    }

    const applyWeights = (payload: WeightagePayload) => {
        const totalRows = rows.length;
        if (totalRows === 0) return;

        const mode = payload.mode; // 'add' | 'decrease'
        const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

        const isEmpty = (v: any) =>
            v === undefined || v === null ||
            String(v).trim() === '' ||
            /^submit form\.+$/i.test(String(v));

        const idxToName: Record<string, string> = {};
        columns.forEach((n, i) => { idxToName[colIndexToLetter(i)] = n; });

        const DF = colLetterToIndex('DF');
        const EM = colLetterToIndex('EM');
        const l2SlotCols: string[] = [];
        for (let i = DF; i <= EM; i++) {
            const nm = idxToName[colIndexToLetter(i)];
            if (nm) l2SlotCols.push(nm);
        }

        const newRows: Record<string, any>[] = rows.map((r, i) => ({
            ...r,
            __idx: i,
            __autoVerbatim: new Set<string>(
                r.__autoVerbatim instanceof Set
                    ? Array.from(r.__autoVerbatim)
                    : (Array.isArray(r.__autoVerbatim) ? r.__autoVerbatim : [])
            )
        }));

        const addedL2sByRow = new Map<number, string[]>();   // ordered, no dupes

        const markL2Added = (r: number, l2Name: string) => {
            if (!addedL2sByRow.has(r)) addedL2sByRow.set(r, []);
            const arr = addedL2sByRow.get(r)!;
            if (!arr.includes(l2Name)) arr.push(l2Name);
        };

        // ── SERVICE BRANCH ────────────────────────────────────────────
        if (payload.category === 'service') {
            const addedPositiveByRow = new Set<number>();
            const addedNegativeByRow = new Set<number>();

            if (mode === 'add') {
                // ── SERVICE DRIVERS (shuffled drivers AND shuffled rows, max 3 per row) ──
                {
                    const MAX_DRIVERS_PER_ROW = 3;
                    type Item = { kind: 'pos' | 'neg'; name: string };
                    const queue: Item[] = [];

                    for (const [name, raw] of Object.entries(payload.servicePositiveWeights || {})) {
                        const cnt = Math.floor(Number(raw) || 0);
                        const col = WORKSHOP_POSITIVE_L2_TO_COL[name];
                        if (cnt <= 0 || !col || !columns.includes(col)) continue;
                        if (!(WORKSHOP_POSITIVE_L2_TO_L3[name] || []).length) continue;
                        for (let i = 0; i < cnt; i++) queue.push({ kind: 'pos', name });
                    }
                    for (const [name, raw] of Object.entries(payload.serviceNegativeWeights || {})) {
                        const cnt = Math.floor(Number(raw) || 0);
                        const col = WORKSHOP_NEGATIVE_L2_TO_COL[name];
                        if (cnt <= 0 || !col || !columns.includes(col)) continue;
                        if (!(WORKSHOP_NEGATIVE_L2_TO_L3[name] || []).length) continue;
                        for (let i = 0; i < cnt; i++) queue.push({ kind: 'neg', name });
                    }

                    const shuffle = <T,>(arr: T[]) => {
                        for (let i = arr.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [arr[i], arr[j]] = [arr[j], arr[i]];
                        }
                    };
                    shuffle(queue);

                    const n = newRows.length;
                    const tier: ('positive' | 'negative' | null)[] = new Array(n);
                    const used: number[] = new Array(n);
                    for (let r = 0; r < n; r++) {
                        tier[r] = getWorkshopTier(newRows[r]);
                        used[r] = countFilledDrivers(newRows[r], WORKSHOP_POSITIVE_L2_TO_COL)
                            + countFilledDrivers(newRows[r], WORKSHOP_NEGATIVE_L2_TO_COL);
                    }

                    // Random row order. Each pass visits every row once, then reshuffles
                    let rowOrder: number[] = [];
                    let ptr = 0;
                    const refill = () => {
                        rowOrder = Array.from({ length: n }, (_, i) => i);
                        shuffle(rowOrder);
                        ptr = 0;
                    };
                    refill();

                    let notPlaced = 0;
                    for (const item of queue) {
                        const col = item.kind === 'pos'
                            ? WORKSHOP_POSITIVE_L2_TO_COL[item.name]
                            : WORKSHOP_NEGATIVE_L2_TO_COL[item.name];
                        const oppositeCol = item.kind === 'pos'
                            ? WORKSHOP_NEGATIVE_L2_TO_COL[item.name]
                            : WORKSHOP_POSITIVE_L2_TO_COL[item.name];
                        const pool = item.kind === 'pos'
                            ? WORKSHOP_POSITIVE_L2_TO_L3[item.name]
                            : WORKSHOP_NEGATIVE_L2_TO_L3[item.name];

                        let placed = false;
                        for (let step = 0; step < n; step++) {
                            if (ptr >= n) refill();
                            const r = rowOrder[ptr++];

                            if (tier[r] === null) continue;
                            if (item.kind === 'pos' && tier[r] !== 'positive') continue;
                            if (used[r] >= MAX_DRIVERS_PER_ROW) continue;

                            const row = newRows[r];
                            if (!isEmptyCell(row[col])) continue;                       // already has this driver
                            if (oppositeCol && !isEmptyCell(row[oppositeCol])) continue; // don't praise and complain about the same L2

                            row[col] = pool[Math.floor(Math.random() * pool.length)];
                            ensureAutoVerbatimSet(row).add(col);
                            used[r]++;
                            (item.kind === 'pos' ? addedPositiveByRow : addedNegativeByRow).add(r);
                            placed = true;
                            break;
                        }
                        if (!placed) notPlaced++;
                    }
                    if (notPlaced > 0) {
                        console.warn(`[Service fill] ${notPlaced} requested fills could not be placed.`);
                    }
                }
                // Auto-fill remaining (only in Add mode)
                if (payload.autoFillRemaining) {
                    const posKeys = Object.keys(WORKSHOP_POSITIVE_L2_TO_COL);
                    const negKeys = Object.keys(WORKSHOP_NEGATIVE_L2_TO_COL);
                    const hasConfiguredPos = Object.entries(payload.servicePositiveWeights || {})
                        .some(([, v]) => (Number(v) || 0) > 0);
                    const hasConfiguredNeg = Object.entries(payload.serviceNegativeWeights || {})
                        .some(([, v]) => (Number(v) || 0) > 0);
                    const fillPos = hasConfiguredPos || !hasConfiguredNeg;
                    const fillNeg = hasConfiguredNeg || !hasConfiguredPos;

                    newRows.forEach((r, rowIdx) => {
                        let driverColsFilled = 0;
                        for (const c of Object.values(WORKSHOP_POSITIVE_L2_TO_COL)) {
                            if (!isEmptyCell(r[c])) driverColsFilled++;
                        }
                        for (const c of Object.values(WORKSHOP_NEGATIVE_L2_TO_COL)) {
                            if (!isEmptyCell(r[c])) driverColsFilled++;
                        }
                        if (driverColsFilled >= 3) return;

                        if (fillPos && getWorkshopTier(r) === 'positive') {
                            const randomL2 = pick(posKeys);
                            const col = WORKSHOP_POSITIVE_L2_TO_COL[randomL2];
                            const targetCol = columns.find(c => c === col) || col;
                            const l3List = WORKSHOP_POSITIVE_L2_TO_L3[randomL2] || [];
                            if (targetCol && l3List.length > 0 && isEmptyCell(r[targetCol])) {
                                r[targetCol] = pick(l3List);
                                ensureAutoVerbatimSet(r).add(targetCol);
                                addedPositiveByRow.add(rowIdx);
                            }
                        }
                        if (fillNeg && getWorkshopTier(r) !== null) {
                            const randomL2 = pick(negKeys);
                            const col = WORKSHOP_NEGATIVE_L2_TO_COL[randomL2];
                            const targetCol = columns.find(c => c === col) || col;
                            const l3List = WORKSHOP_NEGATIVE_L2_TO_L3[randomL2] || [];
                            if (targetCol && l3List.length > 0 && isEmptyCell(r[targetCol])) {
                                r[targetCol] = pick(l3List);
                                ensureAutoVerbatimSet(r).add(targetCol);
                                addedNegativeByRow.add(rowIdx);
                            }
                        }
                    });
                }

                // Run the column-first verbatim fill for ALL rows at once
                applyServiceVerbatimsColumnFirst(newRows, addedPositiveByRow, addedNegativeByRow);
            } else {
                // decrease
                const decreaseDriverColumn = (targetCol: string, entered: number) => {
                    if (!targetCol || entered <= 0) return;
                    let existing = 0;
                    for (let i = 0; i < totalRows; i++) {
                        if (!isEmpty(newRows[i][targetCol])) existing++;
                    }
                    let toRemove = Math.min(entered, existing);
                    if (toRemove <= 0) return;
                    for (let i = 0; i < totalRows && toRemove > 0; i++) {
                        const row = newRows[i];
                        const set = ensureAutoVerbatimSet(row);
                        if (!isEmpty(row[targetCol]) && set.has(targetCol)) {
                            row[targetCol] = '';
                            set.delete(targetCol);
                            toRemove--;
                        }
                    }
                };

                for (const [l2Name, enteredRaw] of Object.entries(payload.servicePositiveWeights || {})) {
                    const entered = Math.floor(Number(enteredRaw) || 0);
                    const colName = WORKSHOP_POSITIVE_L2_TO_COL[l2Name];
                    if (!colName) continue;
                    const targetCol = columns.find(c => c === colName) || colName;
                    decreaseDriverColumn(targetCol, entered);
                }

                for (const [l2Name, enteredRaw] of Object.entries(payload.serviceNegativeWeights || {})) {
                    const entered = Math.floor(Number(enteredRaw) || 0);
                    const colName = WORKSHOP_NEGATIVE_L2_TO_COL[l2Name];
                    if (!colName) continue;
                    const targetCol = columns.find(c => c === colName) || colName;
                    decreaseDriverColumn(targetCol, entered);
                }
            }

            // SAFETY: enforce what was added on cells WE auto-filled
            for (let r = 0; r < newRows.length; r++) {
                const row = newRows[r];
                const autoSet = ensureAutoVerbatimSet(row);
                const tier = getWorkshopTier(row);

                const hasPos = addedPositiveByRow.has(r);
                const hasNeg = addedNegativeByRow.has(r);

                // Positive only -> fill ONLY 3a. No 3b, no 4a.
                if (hasPos && !hasNeg) {
                    for (const col of [...WORK_SOFT_NEG_COLS, ...WORK_HARD_NEG_COLS]) {
                        if (autoSet.has(col)) {
                            row[col] = '';
                            autoSet.delete(col);
                        }
                    }
                }

                // Negative only -> 3a is always empty.
                if (hasNeg && !hasPos) {
                    for (const col of WORK_POS_COLS) {
                        if (autoSet.has(col)) {
                            row[col] = '';
                            autoSet.delete(col);
                        }
                    }
                }

                // Tier enforcement: Yes/Maybe rows: 4a is always empty. No rows: 3a and 3b are always empty.
                if (tier === 'positive') {
                    for (const col of WORK_HARD_NEG_COLS) {
                        if (autoSet.has(col)) {
                            row[col] = '';
                            autoSet.delete(col);
                        }
                    }
                } else if (tier === 'negative') {
                    for (const col of [...WORK_POS_COLS, ...WORK_SOFT_NEG_COLS]) {
                        if (autoSet.has(col)) {
                            row[col] = '';
                            autoSet.delete(col);
                        }
                    }
                }

                // If row got neither, clear all auto-filled
                if (!hasPos && !hasNeg) {
                    for (const col of [...WORK_POS_COLS, ...WORK_SOFT_NEG_COLS, ...WORK_HARD_NEG_COLS]) {
                        if (autoSet.has(col)) {
                            row[col] = '';
                            autoSet.delete(col);
                        }
                    }
                }
            }
        } else {
            // ── PRODUCT BRANCH (L2 + Positive Drivers) ────────────────────
            const getRowL2State = (r: Record<string, any>) => {
                const set = new Set<string>();
                let count = 0;
                for (const c of l2SlotCols) {
                    const v = r[c];
                    if (!isEmpty(v)) {
                        count++;
                        set.add(String(v).trim().toLowerCase());
                    }
                }
                return { filledL2Values: set, filledSlotCount: count };
            };

            const addedProdPosByRow = new Set<number>();

            if (mode === 'add') {
                // ── PRODUCT L2 FILL (Sequential First Slot, Random Remaining) ────
                for (const [l2Name, enteredRaw] of Object.entries(payload.l2Weights || {})) {
                    const requested = Math.floor(Number(enteredRaw) || 0);
                    if (requested <= 0 || !L2_GROUPS.includes(l2Name)) continue;

                    const allL2Cols = l2SlotCols;
                    const firstSlot = allL2Cols[0]; // DF
                    let fillsDone = 0;

                    // Pass 1: Fill the FIRST slot (DF) sequentially row-by-row
                    for (let r = 0; r < newRows.length; r++) {
                        if (fillsDone >= requested) break;
                        const row = newRows[r];

                        let alreadyHasThisL2 = false;
                        let currentL2Count = 0;
                        for (const c of allL2Cols) {
                            if (!isEmptyCell(row[c])) {
                                currentL2Count++;
                                if (String(row[c]).toLowerCase() === l2Name.toLowerCase()) alreadyHasThisL2 = true;
                            }
                        }

                        if (!alreadyHasThisL2 && currentL2Count < 4 && isEmptyCell(row[firstSlot])) {
                            row[firstSlot] = l2Name;
                            ensureAutoVerbatimSet(row).add(firstSlot);
                            fillOneRandomFollowUpForL2(row, l2Name, idxToName);
                            markL2Added(r, l2Name);
                            fillsDone++;
                        }
                    }

                    // Pass 2: Remaining fills — pick a random empty slot from DG..EM
                    if (fillsDone < requested) {
                        const remainingSlots = allL2Cols.slice(1); // DG..EM

                        for (let r = 0; r < newRows.length; r++) {
                            if (fillsDone >= requested) break;
                            const row = newRows[r];

                            let alreadyHasThisL2 = false;
                            let currentL2Count = 0;
                            for (const c of allL2Cols) {
                                if (!isEmptyCell(row[c])) {
                                    currentL2Count++;
                                    if (String(row[c]).toLowerCase() === l2Name.toLowerCase()) alreadyHasThisL2 = true;
                                }
                            }

                            if (alreadyHasThisL2 || currentL2Count >= 4) continue;

                            const emptySlots = remainingSlots.filter(c => isEmptyCell(row[c]));
                            if (emptySlots.length === 0) continue;

                            const targetCol = emptySlots[Math.floor(Math.random() * emptySlots.length)];
                            row[targetCol] = l2Name;
                            ensureAutoVerbatimSet(row).add(targetCol);
                            fillOneRandomFollowUpForL2(row, l2Name, idxToName);
                            markL2Added(r, l2Name);
                            fillsDone++;
                        }
                    }
                }

                // ── Auto-fill remaining (Add mode only) ──────────────────────
                if (payload.autoFillRemaining) {
                    for (let r = 0; r < totalRows; r++) {
                        const state = getRowL2State(newRows[r]);
                        if (state.filledSlotCount > 0) continue; // row already has ≥1 L2

                        const emptySlots = l2SlotCols.slice(0, 4).filter(c => isEmpty(newRows[r][c]));
                        if (emptySlots.length === 0) continue;

                        const randomL2 = pick(L2_GROUPS);
                        const targetCol = emptySlots[0];
                        newRows[r][targetCol] = randomL2;
                        fillOneRandomFollowUpForL2(newRows[r], randomL2, idxToName);
                        markL2Added(r, randomL2);
                    }
                }

                // ── PRODUCT POSITIVE DRIVERS (row-by-row, max 4 per row) ──────────
                {
                    const MAX_DRIVERS_PER_ROW = 4;

                    const queue: string[] = [];
                    for (const [driverName, enteredRaw] of Object.entries(payload.positiveWeights || {})) {
                        const requested = Math.floor(Number(enteredRaw) || 0);
                        const col = POSITIVE_DRIVER_COLUMNS[driverName];
                        if (requested <= 0 || !col || !columns.includes(col)) continue;
                        if (!(POSITIVE_DRIVER_L2_TO_L3[driverName] || []).length) continue;
                        for (let i = 0; i < requested; i++) queue.push(driverName);
                    }

                    // Fisher–Yates shuffle
                    for (let i = queue.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [queue[i], queue[j]] = [queue[j], queue[i]];
                    }

                    const n = newRows.length;
                    const eligible: boolean[] = new Array(n);
                    const driverCount: number[] = new Array(n);
                    const filled3a: number[] = new Array(n);
                    for (let r = 0; r < n; r++) {
                        eligible[r] = readProductRating(newRows[r]) !== 'detractor';
                        driverCount[r] = countFilledDrivers(newRows[r], POSITIVE_DRIVER_COLUMNS);
                        filled3a[r] = countFilledVerbatims(newRows[r], PROD_POS_COLS);
                    }

                    let cursor = 0;
                    for (const driverName of queue) {
                        const col = POSITIVE_DRIVER_COLUMNS[driverName];
                        const pool = POSITIVE_DRIVER_L2_TO_L3[driverName];

                        for (let step = 0; step < n; step++) {
                            const r = (cursor + step) % n;
                            if (!eligible[r]) continue;
                            if (driverCount[r] >= MAX_DRIVERS_PER_ROW) continue;
                            if (filled3a[r] !== driverCount[r]) continue;      // keep driver count == 3a count

                            const row = newRows[r];
                            if (!isEmptyCell(row[col])) continue;

                            const empty3a = PROD_POS_COLS.filter(c => isEmptyCell(row[c]));
                            if (empty3a.length === 0) continue;

                            const usedInRow = new Set(
                                PROD_POS_COLS.map(c => String(row[c] || '').trim().toLowerCase()).filter(Boolean)
                            );
                            const verbatim = pickVerbatimForDriver(driverName, usedInRow);
                            if (!verbatim) continue;

                            // AU..BM cell: standard L3 phrase
                            row[col] = pool[Math.floor(Math.random() * pool.length)];
                            ensureAutoVerbatimSet(row).add(col);

                            // 3a cell: matching phrase from the new pool
                            row[empty3a[0]] = verbatim;
                            ensureAutoVerbatimSet(row).add(empty3a[0]);

                            driverCount[r]++;
                            filled3a[r]++;
                            cursor = (r + 1) % n;
                            break;
                        }
                    }
                }
                // ── Column-First Product Verbatim Fill ─────────────────────────
                applyProductVerbatimsColumnFirst(newRows, addedProdPosByRow, addedL2sByRow, l2SlotCols);
            } else {
                // DECREASE: remove min(entered, existing) cells, rightmost-first
                for (const [l2Name, enteredRaw] of Object.entries(payload.l2Weights || {})) {
                    const entered = Math.floor(Number(enteredRaw) || 0);
                    if (!L2_GROUPS.includes(l2Name)) continue;
                    const normalized = l2Name.trim().toLowerCase();

                    let existing = 0;
                    for (let r = 0; r < totalRows; r++) {
                        for (const c of l2SlotCols) {
                            const v = newRows[r][c];
                            if (!isEmpty(v) && String(v).trim().toLowerCase() === normalized) {
                                existing++;
                            }
                        }
                    }

                    let toRemove = Math.min(entered, existing);
                    if (toRemove <= 0) continue;

                    for (let r = 0; r < totalRows && toRemove > 0; r++) {
                        // Scan rightmost → leftmost across full DF..EM range
                        for (let si = l2SlotCols.length - 1; si >= 0 && toRemove > 0; si--) {
                            const c = l2SlotCols[si];
                            const v = newRows[r][c];
                            if (!isEmpty(v) && String(v).trim().toLowerCase() === normalized) {
                                newRows[r][c] = '';

                                // Clear only auto-filled follow-ups for this L2
                                const followUpCols = getL2FollowUpColumns(l2Name, idxToName);
                                for (const col of followUpCols) {
                                    const set = ensureAutoVerbatimSet(newRows[r]);
                                    if (set.has(col)) {
                                        newRows[r][col] = '';
                                        set.delete(col);
                                    }
                                }

                                // Optional safety: if row has no L2 left, clear all auto-filled follow-ups
                                const stillHasL2 = l2SlotCols.some(slotCol => !isEmptyCell(newRows[r][slotCol]));
                                if (!stillHasL2) {
                                    for (const l2Name2 of Object.keys(ISSUE_COLUMN_RANGE_MAPPING)) {
                                        const cols2 = getL2FollowUpColumns(l2Name2, idxToName);
                                        for (const col of cols2) {
                                            const set = ensureAutoVerbatimSet(newRows[r]);
                                            if (set.has(col)) {
                                                newRows[r][col] = '';
                                                set.delete(col);
                                            }
                                        }
                                    }
                                }

                                toRemove--;
                                break; // only 1 removal per row-pass
                            }
                        }
                    }
                }

                // Decrease mode: remove up to entered auto-filled AU..BM cells
                for (const [driverName, enteredRaw] of Object.entries(payload.positiveWeights || {})) {
                    const entered = Math.floor(Number(enteredRaw) || 0);
                    if (entered <= 0) continue;
                    const targetCol = POSITIVE_DRIVER_COLUMNS[driverName];
                    if (!targetCol || !columns.includes(targetCol)) continue;

                    let existing = 0;
                    for (let i = 0; i < newRows.length; i++) {
                        if (!isEmptyCell(newRows[i][targetCol])) existing++;
                    }
                    let toRemove = Math.min(entered, existing);
                    if (toRemove <= 0) continue;

                    for (let i = 0; i < newRows.length && toRemove > 0; i++) {
                        const row = newRows[i];
                        const set = ensureAutoVerbatimSet(row);
                        if (!isEmptyCell(row[targetCol]) && set.has(targetCol)) {
                            row[targetCol] = '';
                            set.delete(targetCol);
                            toRemove--;
                        }
                    }
                }
            }
        } // end product branch

        // ── RATING-BASED VERBATIM CLEANUP (Decrease mode only) ──────────
        if (mode === 'decrease') {
            for (let r = 0; r < newRows.length; r++) {
                const row = newRows[r];

                let hasL2 = false;
                for (const c of l2SlotCols) {
                    if (!isEmpty(row[c])) { hasL2 = true; break; }
                }

                let hasDriver = false;
                for (const d of POSITIVE_DRIVERS) {
                    if (!isEmpty(row[d])) { hasDriver = true; break; }
                }

                let hasSvcPos = false;
                for (const sp of SERVICE_POSITIVE_GROUPS) {
                    const c = WORKSHOP_POSITIVE_L2_TO_COL[sp];
                    const targetCol = columns.find(col => col === c) || c;
                    if (targetCol && !isEmpty(row[targetCol])) { hasSvcPos = true; break; }
                }

                let hasSvcNeg = false;
                for (const sn of SERVICE_NEGATIVE_GROUPS) {
                    const c = WORKSHOP_NEGATIVE_L2_TO_COL[sn];
                    const targetCol = columns.find(col => col === c) || c;
                    if (targetCol && !isEmpty(row[targetCol])) { hasSvcNeg = true; break; }
                }

                // Clear only auto-filled cells, and only when their trigger is gone
                if (!hasL2) {
                    PROD_NEG_COLS.forEach(col => clearIfAutoFilled(row, col));
                    PROD_WHY_NOT_COLS.forEach(col => clearIfAutoFilled(row, col));
                }
                if (!hasDriver) {
                    [...PROD_POS_COLS, PROD_POS_COL_5].forEach(col => clearIfAutoFilled(row, col));
                }
                if (!hasSvcPos) {
                    WORK_POS_COLS.forEach(col => clearIfAutoFilled(row, col));
                    WORK_SOFT_NEG_COLS.forEach(col => clearIfAutoFilled(row, col));
                }
                if (!hasSvcNeg) {
                    WORK_HARD_NEG_COLS.forEach(col => clearIfAutoFilled(row, col));
                }
            }
        }

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
                .qc-indicator-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                    flex-shrink: 0;
                    transition: transform 0.12s ease;
                }
                .qc-indicator-dot.clickable {
                    cursor: pointer;
                }
                .qc-indicator-dot.clickable:hover {
                    transform: scale(1.3);
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

                        {/* Brand & Model */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Brand &amp; Model
                            </label>
                            <select
                                value={filterBrandModel}
                                onChange={e => setFilterBrandModel(e.target.value)}
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
                                <option value="all">All Brands &amp; Models</option>
                                {brandModels.map(bm => (
                                    <option key={bm} value={bm}>{bm}</option>
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
                                            background: '#ffffff',
                                            color: 'black'
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
                                    onClick={handleOpenWeightModal}
                                    title="Auto-fill via count weights (Add / Decrease)"
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
                                                onJumpToGroup={jumpToGroup}
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
                    totalRows={rows.length}
                    existingCounts={existingCounts}
                />
            )}
        </div>
    );
};


export default QcDataCheck;