// ============================================================
// shared/positiveDrivers.ts
// Positive driver mapping for the Guinea NPS survey.
//
// POSITIVE_DRIVER_L2_TO_L3 keys are the EXACT "Positive driver
// group (L2)" column names AU..BM from the 449-column Guinea
// schema (character-for-character, including typos such as
// "Roof top (soft top)", "Comformable Seat", "Good look , style").
//
// mapPositiveDrivers() maps a customer's 3a)1..5
// "why will you recommend your vehicle?" verbatims to the
// "Sub driver (L3)" option of each group whose keyword(s) the
// verbatim mentions. 3b (dissatisfaction) never feeds this map.
// ============================================================

export const POSITIVE_DRIVER_L2_TO_L3: Record<string, string[]> = {
    "Brake": [
        "Good Braking performance",
        "Reliable braking",
        "Effective brakes",
        "Good stopping power"
    ],
    "Electrical": [
        "Headlight Power is good",
        "Battery life is more",
        "Speedometer features",
        "Good headlight visibility",
        "Functional horn",
        "Bright headlights"
    ],
    "Engine": [
        "Durable Engine",
        "Smooth engine pickup",
        "Powerful engine",
        "Good power pickup",
        "Smooth gear shifting",
        "Top-class engine reliability",
        "Acceptable engine pickup"
    ],
    "Load": [
        "Good to carry heavy load",
        "High load capacity",
        "Carries heavy luggage",
        "Load capacity is good"
    ],
    "Maintenance": [
        "Low maintenance cost",
        "Easy maintenance",
        "Reasonable service cost",
        "Low service cost"
    ],
    "Mileage": [
        "Good mileage",
        "Superb mileage",
        "Excellent fuel efficiency",
        "Best-in-class fuel economy",
        "Decent daily mileage",
        "Fair mileage",
        "Acceptable fuel economy",
        "Great fuel economy"
    ],
    "Mirror": [
        "Good rear view mirror",
        "Wide rearview mirror",
        "Clear rear view"
    ],
    "Vehicle": [
        "Good speed",
        "Good performance",
        "Good built quality",
        "Smooth riding",
        "Strong chassis",
        "Stable chassis",
        "Nimble handling",
        "High ground clearance",
        "Excellent handling",
        "Comfortable ride"
    ],
    "Seat": [
        "Comformable Seat",
        "Comfortable seating",
        "Adequate seating room",
        "Moderate comfort",
        "Ergonomic riding posture",
        "Good seat cushion"
    ],
    "Sound": [
        "Less noise",
        "Quiet running",
        "Good exhaust note",
        "Smooth and quiet",
        "No annoying sound"
    ],
    "Roof top (soft top)": [
        "Durable roof top",
        "Waterproof roof top",
        "Good roof top",
        "Easy to clean roof top",
        "Roof top protection is good"
    ],
    "Spare parts": [
        "Spare parts are cheaper",
        "Accessible spare parts",
        "Spare parts easy to find",
        "Good availability of spare parts"
    ],
    "Style": [
        "Good look , style",
        "Stylish mirror",
        "Attractive design",
        "Modern design",
        "New model look",
        "Different color options",
        "Nice color"
    ],
    "Suspension": [
        "Strong suspension",
        "Good suspension",
        "Good ride quality",
        "Smooth on rough roads",
        "Suspension absorbs bumps well"
    ],
    "Tyre": [
        "Good Grip",
        "Good tyre grip",
        "Durable tyres",
        "Good traction",
        "Tyres are long lasting"
    ],
    "Vehicle price": [
        "Excellent resale value",
        "Reasonable price",
        "Affordable price",
        "Competitive price",
        "Value for money"
    ],
    "Income": [
        "Good for income generation",
        "Helps earn income",
        "Good earnings",
        "Best for business use",
        "Earns well on trips"
    ],
    "Windshield": [
        "Clear windshield",
        "Windshield protects from dust",
        "Good windshield",
        "Strong windshield"
    ],
    "Brand image": [
        "Trusted brand",
        "Good brand reputation",
        "Known brand",
        "Famous brand",
        "Popular brand"
    ]
};

// Generic positive adjectives / quantifiers that are too common to
// discriminate between groups (a verbatim mentioning "good" or "strong"
// should not light up every group that happens to use that word).
const KEYWORD_STOPWORDS = new Set([
    'good', 'great', 'best', 'better', 'nice', 'excellent', 'superb',
    'outstanding', 'exceptional', 'wonderful', 'fantastic', 'amazing',
    'fabulous', 'premium', 'perfect', 'top', 'high', 'low', 'higher',
    'lower', 'strong', 'stronger', 'smooth', 'reliable', 'decent',
    'adequate', 'acceptable', 'reasonable', 'functional', 'stable',
    'nimble', 'moderate', 'sufficient', 'easy', 'very', 'more', 'most',
    'less', 'new', 'old', 'really', 'also', 'durable', 'effective',
    'fair', 'fine', 'well', 'quite', 'pretty', 'much'
]);

function extractKeywords(phrase: string): string[] {
    const words = String(phrase).toLowerCase().split(/[^a-z0-9]+/);
    const keywords: string[] = [];
    for (const word of words) {
        if (word.length > 3 && !KEYWORD_STOPWORDS.has(word)) {
            keywords.push(word);
        }
    }
    return keywords;
}

let _keywordIndexCache: Record<string, { l3: string; keywords: string[] }[]> | null = null;
function keywordIndex(): Record<string, { l3: string; keywords: string[] }[]> {
    if (_keywordIndexCache) return _keywordIndexCache;
    const index: Record<string, { l3: string; keywords: string[] }[]> = {};
    for (const [l2, l3s] of Object.entries(POSITIVE_DRIVER_L2_TO_L3)) {
        index[l2] = l3s.map(l3 => ({ l3, keywords: extractKeywords(l3) }));
    }
    _keywordIndexCache = index;
    return _keywordIndexCache;
}

/**
 * Map customer 3a "why will you recommend your vehicle?" verbatims to the
 * "Positive driver group (L2)" AU..BM columns.
 *
 * Per L2 group, scan 3a)1..5 verbatims in order and write the FIRST L3
 * phrase whose keyword (word length > 3, punctuation stripped) appears in
 * the verbatim. First match wins - a cell is never overwritten.
 * If `existing[l2]` is truthy, the group is skipped so previously
 * AI-filled AU..BM cells are preserved.
 *
 * @param verbatims 3a)1..5 verbatim strings (falsy values are skipped)
 * @param existing optional row whose truthy L2 values win
 * @returns L2 -> exact L3 dictionary string
 */
export function mapPositiveDrivers(
    verbatims: (string | undefined | null)[] = [],
    existing: Record<string, any> = {}
): Record<string, string> {
    const result: Record<string, string> = {};
    const index = keywordIndex();
    for (const [l2, l3Entries] of Object.entries(index)) {
        if (existing && existing[l2]) continue; // keep an already-filled cell
        if (!Array.isArray(verbatims)) continue;
        for (const verbatim of verbatims) {
            if (!verbatim || typeof verbatim !== 'string') continue;
            const haystack = ` ${verbatim.toLowerCase()} `;
            let matchedL3: string | null = null;
            for (const entry of l3Entries) {
                for (const keyword of entry.keywords) {
                    const singular = (keyword.endsWith('s') && keyword.length > 4 && !keyword.endsWith('ss'))
                        ? keyword.slice(0, -1)
                        : keyword;
                    if (haystack.includes(keyword) || haystack.includes(singular)) {
                        matchedL3 = entry.l3;
                        break;
                    }
                }
                if (matchedL3) break;
            }
            if (matchedL3) {
                result[l2] = matchedL3;
                break; // only the first matching 3a verbatim counts
            }
        }
    }
    return result;
}

export default { POSITIVE_DRIVER_L2_TO_L3, mapPositiveDrivers };
