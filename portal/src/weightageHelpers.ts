import {
    WORKSHOP_POSITIVE_L2_TO_L3,
    WORKSHOP_POSITIVE_L2_TO_COL,
    WORKSHOP_NEGATIVE_L2_TO_L3,
    WORKSHOP_NEGATIVE_L2_TO_COL
} from './shared/workshopDrivers';

// The 34 L2 groups (from L2_RANGE)
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

// The 19 Positive Driver columns (AU..BM)
export const POSITIVE_DRIVERS = [
    'Brake', 'Electrical', 'Engine', 'Load', 'Maintenance', 'Mileage', 'Mirror',
    'Vehicle', 'Seat', 'Sound', 'Roof top (soft top)', 'Spare parts', 'Style',
    'Suspension', 'Tyre', 'Vehicle price', 'Income', 'Windshield', 'Brand image'
];

// Options to randomly pick from when auto-filling a positive driver column
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

// Service Driver groups from shared/workshopDrivers
export const SERVICE_POSITIVE_GROUPS = Object.keys(WORKSHOP_POSITIVE_L2_TO_COL);
export const SERVICE_NEGATIVE_GROUPS = Object.keys(WORKSHOP_NEGATIVE_L2_TO_COL);

export interface WeightagePayload {
    category: 'product' | 'service';
    l2Weights: Record<string, number>;
    positiveWeights: Record<string, number>;
    servicePositiveWeights: Record<string, number>;
    serviceNegativeWeights: Record<string, number>;
    autoFillRemaining: boolean;
}

/**
 * Service Auto-Fill: populates Service Positive (OK..OW) and Service Negative (OX..PL)
 * with realistic values weighted by user percentages.
 */
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
    const shuffle = <T,>(a: T[]) => a.map(v => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

    const findCol = (targetName: string): string | undefined => {
        return columns.find(c => c === targetName) ||
               columns.find(c => c.trim().toLowerCase() === targetName.trim().toLowerCase());
    };

    const assignedPos = new Set<number>();
    const assignedNeg = new Set<number>();

    // 1. Service Positive Weights (OK..OW)
    for (const [l2Name, pct] of Object.entries(payload.servicePositiveWeights || {})) {
        const numPct = Number(pct) || 0;
        if (numPct <= 0) continue;
        const colName = WORKSHOP_POSITIVE_L2_TO_COL[l2Name];
        if (!colName) continue;
        const targetCol = findCol(colName) || colName;
        const l3List = WORKSHOP_POSITIVE_L2_TO_L3[l2Name] || [];
        if (l3List.length === 0) continue;

        const count = Math.min(Math.round((numPct / 100) * totalRows), totalRows);
        const available = shuffle(
            Array.from({ length: totalRows }, (_, i) => i).filter(i => !assignedPos.has(i))
        ).slice(0, count);

        available.forEach(i => {
            newRows[i][targetCol] = pick(l3List);
            assignedPos.add(i);
        });
    }

    // 2. Service Negative Weights (OX..PL)
    for (const [l2Name, pct] of Object.entries(payload.serviceNegativeWeights || {})) {
        const numPct = Number(pct) || 0;
        if (numPct <= 0) continue;
        const colName = WORKSHOP_NEGATIVE_L2_TO_COL[l2Name];
        if (!colName) continue;
        const targetCol = findCol(colName) || colName;
        const l3List = WORKSHOP_NEGATIVE_L2_TO_L3[l2Name] || [];
        if (l3List.length === 0) continue;

        const count = Math.min(Math.round((numPct / 100) * totalRows), totalRows);
        const available = shuffle(
            Array.from({ length: totalRows }, (_, i) => i).filter(i => !assignedNeg.has(i))
        ).slice(0, count);

        available.forEach(i => {
            newRows[i][targetCol] = pick(l3List);
            assignedNeg.add(i);
        });
    }

    // 3. Auto-fill remaining unassigned rows with realistic values
    if (payload.autoFillRemaining) {
        const posKeys = Object.keys(WORKSHOP_POSITIVE_L2_TO_COL);
        const negKeys = Object.keys(WORKSHOP_NEGATIVE_L2_TO_COL);

        const hasConfiguredPos = Object.keys(payload.servicePositiveWeights || {}).some(k => (payload.servicePositiveWeights?.[k] || 0) > 0);
        const hasConfiguredNeg = Object.keys(payload.serviceNegativeWeights || {}).some(k => (payload.serviceNegativeWeights?.[k] || 0) > 0);
        const fillPos = hasConfiguredPos || !hasConfiguredNeg;
        const fillNeg = hasConfiguredNeg || !hasConfiguredPos;

        newRows.forEach((r, i) => {
            if (fillPos && !assignedPos.has(i)) {
                const randomL2 = pick(posKeys);
                const col = WORKSHOP_POSITIVE_L2_TO_COL[randomL2];
                const targetCol = col ? (findCol(col) || col) : undefined;
                const l3List = WORKSHOP_POSITIVE_L2_TO_L3[randomL2] || [];
                if (targetCol && l3List.length > 0) {
                    r[targetCol] = pick(l3List);
                }
            }
            if (fillNeg && !assignedNeg.has(i)) {
                const randomL2 = pick(negKeys);
                const col = WORKSHOP_NEGATIVE_L2_TO_COL[randomL2];
                const targetCol = col ? (findCol(col) || col) : undefined;
                const l3List = WORKSHOP_NEGATIVE_L2_TO_L3[randomL2] || [];
                if (targetCol && l3List.length > 0) {
                    r[targetCol] = pick(l3List);
                }
            }
        });
    }

    return newRows;
}

