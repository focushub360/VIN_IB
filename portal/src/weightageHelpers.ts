import {
    WORKSHOP_POSITIVE_L2_TO_L3,
    WORKSHOP_POSITIVE_L2_TO_COL,
    WORKSHOP_NEGATIVE_L2_TO_L3,
    WORKSHOP_NEGATIVE_L2_TO_COL
} from './shared/workshopDrivers';

export const L2_GROUPS = [
    'Brake issues', 'Cable issues', 'Chain issue', 'Chain case issue', 'Clutch issues',
    'Electrical issues', 'Engine issues', 'Gear issues', 'Handle Bar issues', 'Kicker issues',
    'Low Mileage', 'Low Speed', 'Muffler issues', 'Starting trouble', 'Suspension issues',
    'Vehicle noise', 'Vibration', 'Mirror issues', 'Wheel/Tyre issues', 'Battery issues',
    'Jerking issues', 'Part not available', 'Pick-up problem', 'Running off',
    'Throttle/Accelerator issue', 'Vehicle body parts issue', 'Fuel related issue',
    'Low Boot space', 'Seat issue', 'Vehicle Pulling problem', 'Roof top (soft top) issue',
    'Wiper problem', 'Faster issue'
];

export const POSITIVE_DRIVERS = [
    'Brake', 'Electrical', 'Engine', 'Load', 'Maintenance', 'Mileage', 'Mirror',
    'Vehicle', 'Seat', 'Sound', 'Roof top (soft top)', 'Spare parts', 'Style',
    'Suspension', 'Tyre', 'Vehicle price', 'Income', 'Windshield', 'Brand image'
];

export const POSITIVE_DRIVER_VALUES: Record<string, string[]> = {
    'Brake': ['Good Braking performance', 'Reliable braking', 'Effective brakes'],
    'Electrical': ['Battery life is more', 'Speedometer features', 'Headlight Power is good'],
    'Engine': ['Durable Engine', 'Smooth engine pickup', 'Top-class engine reliability'],
    'Load': ['Good to carry heavy load', 'High load capacity'],
    'Maintenance': ['Low maintenance cost', 'Easy maintenance', 'Reasonable service cost'],
    'Mileage': ['Good mileage', 'Superb mileage', 'Excellent fuel efficiency', 'Decent daily mileage'],
    'Mirror': ['Good rear view mirror', 'Wide rearview mirror', 'Clear rear view'],
    'Vehicle': ['Good speed', 'Good performance', 'Smooth riding', 'Strong chassis'],
    'Seat': ['Comformable Seat', 'Comfortable seating', 'Ergonomic riding posture'],
    'Sound': ['Less noise', 'Quiet running', 'Smooth and quiet'],
    'Roof top (soft top)': ['Durable roof top', 'Waterproof roof top'],
    'Spare parts': ['Spare parts are cheaper', 'Accessible spare parts', 'Spare parts easy to find'],
    'Style': ['Good look , style', 'Attractive design', 'Modern design', 'Stylish mirror'],
    'Suspension': ['Strong suspension', 'Good suspension', 'Good ride quality'],
    'Tyre': ['Good Grip', 'Durable tyres', 'Good traction'],
    'Vehicle price': ['Reasonable price', 'Value for money', 'Affordable price'],
    'Income': ['Good for income generation', 'Helps earn income', 'Best for business use'],
    'Windshield': ['Clear windshield', 'Windshield protects from dust'],
    'Brand image': ['Trusted brand', 'Good brand reputation', 'Popular brand']
};

export const SERVICE_POSITIVE_GROUPS = Object.keys(WORKSHOP_POSITIVE_L2_TO_COL);
export const SERVICE_NEGATIVE_GROUPS = Object.keys(WORKSHOP_NEGATIVE_L2_TO_COL);

export interface WeightagePayload {
    category: 'product' | 'service';
    mode: 'add' | 'decrease';
    l2Weights: Record<string, number>;
    positiveWeights: Record<string, number>;
    servicePositiveWeights: Record<string, number>;
    serviceNegativeWeights: Record<string, number>;
    autoFillRemaining: boolean;
}

// ============================================================
// NEW COUNT-BASED FILLER (used for Service Positive & Negative)
// ============================================================
export function applyServiceWeightsToRows(
    rows: Record<string, any>[],
    columns: string[],
    payload: {
        servicePositiveWeights?: Record<string, number>;
        serviceNegativeWeights?: Record<string, number>;
        autoFillRemaining?: boolean;
    }
): Record<string, any>[] {
    const totalRows = rows.length;
    if (totalRows === 0) return [];

    const newRows = rows.map(r => ({ ...r }));
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

    const findCol = (targetName: string): string | undefined => {
        return columns.find(c => c === targetName) ||
            columns.find(c => c.trim().toLowerCase() === targetName.trim().toLowerCase());
    };

    const isFilled = (val: any) => val !== undefined && val !== null && String(val).trim() !== '';

    // Fills a single driver column for `requestedCount` rows, subtracting existing filled count.
    // Column-wise top-to-bottom, skip rows where this specific column already has a value.
    const fillDriverColumn = (
        targetCol: string,
        requestedCount: number,
        l3List: string[]
    ) => {
        if (!targetCol || l3List.length === 0 || requestedCount <= 0) return;

        // Count existing
        let existing = 0;
        for (let i = 0; i < totalRows; i++) {
            if (isFilled(newRows[i][targetCol])) existing++;
        }
        let toFill = requestedCount - existing;
        if (toFill <= 0) return;

        // Fill top-to-bottom
        for (let i = 0; i < totalRows && toFill > 0; i++) {
            if (!isFilled(newRows[i][targetCol])) {
                newRows[i][targetCol] = pick(l3List);
                toFill--;
            }
        }
    };

    // 1. Service Positive (OK..OW)
    for (const [l2Name, count] of Object.entries(payload.servicePositiveWeights || {})) {
        const numCount = Math.floor(Number(count) || 0);
        if (numCount <= 0) continue;
        const colName = WORKSHOP_POSITIVE_L2_TO_COL[l2Name];
        if (!colName) continue;
        const targetCol = findCol(colName) || colName;
        const l3List = WORKSHOP_POSITIVE_L2_TO_L3[l2Name] || [];
        fillDriverColumn(targetCol, numCount, l3List);
    }

    // 2. Service Negative (OX..PL)
    for (const [l2Name, count] of Object.entries(payload.serviceNegativeWeights || {})) {
        const numCount = Math.floor(Number(count) || 0);
        if (numCount <= 0) continue;
        const colName = WORKSHOP_NEGATIVE_L2_TO_COL[l2Name];
        if (!colName) continue;
        const targetCol = findCol(colName) || colName;
        const l3List = WORKSHOP_NEGATIVE_L2_TO_L3[l2Name] || [];
        fillDriverColumn(targetCol, numCount, l3List);
    }

    // 3. Optionally auto-fill remaining rows with random drivers
    if (payload.autoFillRemaining) {
        const posKeys = Object.keys(WORKSHOP_POSITIVE_L2_TO_COL);
        const negKeys = Object.keys(WORKSHOP_NEGATIVE_L2_TO_COL);
        const hasConfiguredPos = Object.keys(payload.servicePositiveWeights || {}).some(k => (payload.servicePositiveWeights?.[k] || 0) > 0);
        const hasConfiguredNeg = Object.keys(payload.serviceNegativeWeights || {}).some(k => (payload.serviceNegativeWeights?.[k] || 0) > 0);
        const fillPos = hasConfiguredPos || !hasConfiguredNeg;
        const fillNeg = hasConfiguredNeg || !hasConfiguredPos;

        newRows.forEach(r => {
            if (fillPos) {
                const randomL2 = pick(posKeys);
                const col = WORKSHOP_POSITIVE_L2_TO_COL[randomL2];
                const targetCol = col ? (findCol(col) || col) : undefined;
                const l3List = WORKSHOP_POSITIVE_L2_TO_L3[randomL2] || [];
                if (targetCol && l3List.length > 0 && !isFilled(r[targetCol])) {
                    r[targetCol] = pick(l3List);
                }
            }
            if (fillNeg) {
                const randomL2 = pick(negKeys);
                const col = WORKSHOP_NEGATIVE_L2_TO_COL[randomL2];
                const targetCol = col ? (findCol(col) || col) : undefined;
                const l3List = WORKSHOP_NEGATIVE_L2_TO_L3[randomL2] || [];
                if (targetCol && l3List.length > 0 && !isFilled(r[targetCol])) {
                    r[targetCol] = pick(l3List);
                }
            }
        });
    }

    return newRows;
}