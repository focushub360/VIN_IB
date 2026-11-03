export const WORKSHOP_POSITIVE_L2_TO_L3: Record<string, string[]> = {
  "Resolution of Problem": [
    "Resolving the reported issues in First Time Right",
    "Faster Resolution of issues",
    "Based on Past Experience"
  ],
  "Parts availability": ["Parts availability"],
  "Skilled Manpower": [
    "Works Manager",
    "Service Advisors",
    "Technicians",
    "Customer Care Executive"
  ],
  "Washing Quality": [
    "Proper Washing Done",
    "Proper Polishing Done",
    "Satisfied with Dry Wash"
  ],
  "Service Adviser Behavior": [
    "Well, Behaved",
    "Listened Attentively",
    "Politeness",
    "Groomed , Dressed Well"
  ],
  "Cost & Explanation": [
    "Reasonable Cost",
    "Jobs are explained",
    "Invoice Given & Explained"
  ],
  "Warranty Policy": [
    "Beyond Period Warranty Given",
    "Ease of Warranty Process",
    "Battery Warranty Given",
    "Tyre Warranty Given"
  ],
  "Waiting Time": [
    "Quick Job Card Opening",
    "Quick Delivery Process",
    "Quick Billing Process",
    "Delivered on Promised Time",
    "Quick Service Done"
  ],
  "Customer Lounge Amenities": [
    "Free Tea and Coffee Vending Machine",
    "Air-Conditioned Customer Lounge",
    "Television with Entertainment Channels",
    "High-Speed Free Wi-Fi Access",
    "Access to Magazines and Newspapers",
    "Comfortable and Spacious Seating"
  ],
  "Operating Hours": [
    "Sunday Opening",
    "After 7.00 PM Availability",
    "Before 09:00 AM Workshop Opening"
  ],
  "Workshop Facilities": [
    "Pick up & Drop",
    "Express Service",
    "Annual Maintenance Contract",
    "Roadside Assistance",
    "Live Streaming",
    "Paper Less Workshop",
    "Work in Progress Updates",
    "Refreshment at Lounge",
    "What's App Updates",
    "Clear Communication"
  ]
};
export const WORKSHOP_POSITIVE_VERBATIMS_BY_DRIVER: Record<string, string[]> = {
  "Resolution of Problem": [
    "Issues fixed in the first visit",
    "Problem solved quickly",
    "Complaints resolved properly",
    "Fixed right the first time"
  ],
  "Parts availability": [
    "Spare parts available at workshop",
    "Genuine parts always in stock",
    "No waiting for parts"
  ],
  "Skilled Manpower": [
    "Skilled technicians available in workshop",
    "Knowledgeable service staff",
    "Experienced mechanics",
    "Staff understand the vehicle well"
  ],
  "Washing Quality": [
    "Vehicle washed nicely",
    "Returned clean and shiny",
    "Good wash and polish finish"
  ],
  "Service Adviser Behavior": [
    "Service adviser listened attentively",
    "Adviser was polite and helpful",
    "Staff behaviour is friendly",
    "Adviser was well presented"
  ],
  "Cost & Explanation": [
    "Reasonable cost with clear explanation",
    "Charges are fair",
    "Bill explained clearly",
    "Work details shared properly"
  ],
  "Warranty Policy": [
    "Easy warranty process",
    "Warranty claim accepted without fuss",
    "Battery and tyre warranty honoured",
    "Warranty support is good"
  ],
  "Waiting Time": [
    "Job card opened quickly",
    "Vehicle delivered on time",
    "Billing done fast",
    "Service completed quickly"
  ],
  "Customer Lounge Amenities": [
    "Comfortable customer lounge with AC",
    "Clean and comfortable waiting area",
    "Refreshments and TV in lounge",
    "Good wifi in the lounge"
  ],
  "Operating Hours": [
    "Workshop open on Sundays",
    "Open late in the evening",
    "Early morning opening is helpful"
  ],
  "Workshop Facilities": [
    "Pick up & drop facility available",
    "Express service available",
    "Regular updates on WhatsApp",
    "Roadside assistance available",
    "Clear communication throughout"
  ]
};

export const WS_VERBATIM_TO_DRIVER = new Map<string, string>();
Object.entries(WORKSHOP_POSITIVE_VERBATIMS_BY_DRIVER).forEach(([l2, list]) =>
  list.forEach(p => WS_VERBATIM_TO_DRIVER.set(p.trim().toLowerCase(), l2)));

const WS_L3_TO_DRIVER = new Map<string, string>();
Object.entries(WORKSHOP_POSITIVE_L2_TO_L3).forEach(([l2, list]) =>
  list.forEach(p => WS_L3_TO_DRIVER.set(p.trim().toLowerCase(), l2)));

export function findWorkshopDriverForVerbatim(phrase: string): string | null {
  return WS_VERBATIM_TO_DRIVER.get(String(phrase || '').trim().toLowerCase()) || null;
}
// for old rows whose 3a text is a plain L3 phrase
export function findWorkshopDriverForPhrase(phrase: string): string | null {
  return WS_L3_TO_DRIVER.get(String(phrase || '').trim().toLowerCase()) || null;
}

export function pickWorkshopVerbatimForDriver(
  l2: string,
  usedInRow: Set<string>,
  usedInCol?: Set<string>
): string | null {
  const pool = WORKSHOP_POSITIVE_VERBATIMS_BY_DRIVER[l2] || [];
  if (pool.length === 0) return null;
  const lower = (s: string) => s.trim().toLowerCase();
  const fresh = pool.filter(p => !usedInRow.has(lower(p)) && !(usedInCol && usedInCol.has(lower(p))));
  const notInRow = pool.filter(p => !usedInRow.has(lower(p)));
  const choices = fresh.length ? fresh : notInRow;
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
}

export const WORKSHOP_POSITIVE_L2_TO_COL: Record<string, string> = {
  "Resolution of Problem": "Resolution of Problem is good",
  "Parts availability": "Parts availability & quality",
  "Skilled Manpower": "Skilled Manpower is available in workshop",
  "Washing Quality": "Washing Quality (Applicable only for Asia)",
  "Service Adviser Behavior": "Happy with Service Adviser Behaviour",
  "Cost & Explanation": "Cost & Explanation was good",
  "Warranty Policy": "Warranty Policy is good",
  "Waiting Time": "Waiting Time was adequate",
  "Customer Lounge Amenities": "Satisfied with Customer Lounge Amenities",
  "Operating Hours": "Extension of Operating Hours is very supportive",
  "Workshop Facilities": "Workshop Facilities"
};

export const WORKSHOP_NEGATIVE_L2_TO_L3: Record<string, string[]> = {
  "Resolution of Problem": [
    "Repetition of Issues since Last Service",
    "Repetition of issues since Purchase",
    "Facing New issues post Service",
    "Not resolving the said issues",
    "Based on Past Experience"
  ],
  "Parts availability": ["Part not available"],
  "Skilled Manpower": [
    "Works Manager",
    "Service Advisors",
    "Technicians",
    "Customer Care Executive"
  ],
  "Washing Quality": [
    "Polishing not done",
    "Not washed properly",
    "Not at all washed",
    "Not satisfied with Dry Wash"
  ],
  "Service Adviser Behavior": [
    "Behaving Rudely",
    "Not Listening",
    "Not giving proper Justification",
    "Not Groomed , Dressed Well"
  ],
  "Cost & Explanation": [
    "Over Charging",
    "More Additional Jobs Done",
    "Parts Costs are High",
    "Invoice Not Explained",
    "Invoice Not Given"
  ],
  "Warranty Policy": [
    "Warranty Not given in Warranty Period",
    "Asked Money for Warranty Replacement",
    "Battery Warranty Denied",
    "Tyre Warranty Denied"
  ],
  "Waiting Time": [
    "More waiting at Job Card opening",
    "More Waiting for Delivery Process",
    "More Waiting at Billing Process",
    "Not delivered on Promised Time",
    "High Time took for Service"
  ],
  "Customer Lounge Amenities": [
    "Free Tea and Coffee Vending Machine",
    "Air-Conditioned Customer Lounge",
    "Television with Entertainment Channels",
    "High-Speed Free Wi-Fi Access",
    "Access to Magazines and Newspapers",
    "Comfortable and Spacious Seating"
  ],
  "Operating Hours": [
    "Sunday Opening",
    "After 7.00 PM Availability",
    "Before 09:00 AM Workshop Opening"
  ],
  "Workshop Facilities": [
    "Pick up & Drop",
    "Express Service",
    "Annual Maintenance Contract",
    "Roadside Assistance",
    "Live Streaming",
    "Paper Less Workshop",
    "Work in Progress Updates",
    "Refreshment at Lounge",
    "What's App Updates",
    "Clear Communication"
  ]
};

export const WORKSHOP_NEGATIVE_L2_TO_COL: Record<string, string> = {
  "Resolution of Problem": "Complaints not resolved",
  "Parts availability": "Parts availability issues Give names of three parts which were not available, with details.",
  "Skilled Manpower": "Improve Skilled Manpower",
  "Washing Quality": "Washing Quality (Applicable only for Asia)46",
  "Service Adviser Behavior": "Service Adviser Behaviour issues",
  "Cost & Explanation": "Not satisfied with Cost & Explanation",
  "Warranty Policy": "Warranty Policy issues",
  "Waiting Time": "Waiting Time is more",
  "Customer Lounge Amenities": "Improve Customer Lounge Amenities",
  "Operating Hours": "Extent the Operating Hours",
  "Workshop Facilities": "Improve Workshop Facilities"
};

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function keywordMatch(phraseLower: string, l3: string): boolean {
  const kw = String(l3).toLowerCase()
    .replace(/[(),&]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  if (kw.length === 0) return false;
  return kw.every(k => phraseLower.includes(k));
}

/**
 * @param row         fully-assembled row (must already contain 3a/3b/4 keys)
 * @param index       row index for deterministic random
 * @param aiPos       optional AI object: { [L2Name]: "L3 phrase" }
 * @param aiNeg       optional AI object: { [L2Name]: "L3 phrase" }
 * @returns {{ positive: Record<string,string>, negative: Record<string,string> }}
 *          where keys are REAL Excel column names from OK..OW / OX..PL
 */
export function mapWorkshopDrivers(
  row: Record<string, any>,
  index: number,
  aiPos?: Record<string, string>,
  aiNeg?: Record<string, string>
): { positive: Record<string, string>; negative: Record<string, string> } {
  const rng = mulberry32(index == null ? 42 : index + 1);
  const pos: Record<string, string> = {};
  const neg: Record<string, string> = {};

  const get = (keys: string[]) => {
    const out: string[] = [];
    for (const k of keys) {
      const v = row && row[k];
      if (v) out.push(String(v).toLowerCase());
    }
    return out;
  };

  const v3a = get([
    '3a)1 Which experience you like the most to recommend Workshop / Dealer?',
    '3a)2 Which experience you like the most to recommend Workshop / Dealer?',
    '3a)3 Which experience you like the most to recommend Workshop / Dealer?'
  ]);

  const v3b = get([
    '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
    '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?',
    '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?'
  ]);

  const v4 = get([
    '4)1 What are the main reasons for you have not recommend Workshop / Dealer?',
    '4)2 What are the main reasons for you have not recommend Workshop / Dealer?',
    '4)3 What are the main reasons for you have not recommend Workshop / Dealer?'
  ]);

  const negText = [...v3b, ...v4];

  // ── Positive: 3a → OK..OW ────────────────────────────────────────
  for (const [l2, l3List] of Object.entries(WORKSHOP_POSITIVE_L2_TO_L3)) {
    const col = WORKSHOP_POSITIVE_L2_TO_COL[l2];
    if (!col) continue;

    // Priority 1: AI
    if (aiPos && aiPos[l2]) { pos[col] = aiPos[l2]; continue; }

    // Priority 2: keyword match
    let hit: string | null = null;
    for (const phrase of v3a) {
      for (const l3 of l3List) {
        if (keywordMatch(phrase, l3)) { hit = l3; break; }
      }
      if (hit) break;
    }
    if (hit) { pos[col] = hit; continue; }

    // Priority 3: random only if 3a has at least one value
    if (v3a.length > 0) {
      pos[col] = l3List[Math.floor(rng() * l3List.length)];
    }
  }

  // ── Negative: 3b + 4 → OX..PL ────────────────────────────────────
  for (const [l2, l3List] of Object.entries(WORKSHOP_NEGATIVE_L2_TO_L3)) {
    const col = WORKSHOP_NEGATIVE_L2_TO_COL[l2];
    if (!col) continue;

    if (aiNeg && aiNeg[l2]) { neg[col] = aiNeg[l2]; continue; }

    let hit: string | null = null;
    for (const phrase of negText) {
      for (const l3 of l3List) {
        if (keywordMatch(phrase, l3)) { hit = l3; break; }
      }
      if (hit) break;
    }
    if (hit) { neg[col] = hit; continue; }

    if (negText.length > 0) {
      neg[col] = l3List[Math.floor(rng() * l3List.length)];
    }
  }

  return { positive: pos, negative: neg };
}

export default {
  WORKSHOP_POSITIVE_L2_TO_L3,
  WORKSHOP_POSITIVE_L2_TO_COL,
  WORKSHOP_NEGATIVE_L2_TO_L3,
  WORKSHOP_NEGATIVE_L2_TO_COL,
  mapWorkshopDrivers,
  mulberry32
};

export const WORKSHOP_NEGATIVE_VERBATIMS_BY_DRIVER: Record<string, string[]> = {
  "Resolution of Problem": [
    "Issues not resolved even after repeated visits",
    "Same problem keeps coming back",
    "New problems after service",
    "Complaint was ignored"
  ],
  "Parts availability": [
    "Spare parts not available at workshop",
    "Had to wait days for parts",
    "Genuine parts out of stock"
  ],
  "Skilled Manpower": [
    "Technicians not skilled enough",
    "Staff lack knowledge",
    "Mechanics could not find the fault",
    "Inexperienced service staff"
  ],
  "Washing Quality": [
    "Vehicle not washed properly",
    "Polishing not done after wash",
    "Returned dirty after service"
  ],
  "Service Adviser Behavior": [
    "Service adviser was not listening",
    "Service adviser behaved rudely",
    "Adviser gave no proper answers",
    "Adviser was not presentable"
  ],
  "Cost & Explanation": [
    "Overcharging compared to estimate",
    "Invoice not explained properly",
    "Extra jobs added without asking",
    "Parts prices are too high"
  ],
  "Warranty Policy": [
    "Warranty not given in warranty period",
    "Asked money for warranty replacement",
    "Warranty claim rejected without reason",
    "Battery warranty denied"
  ],
  "Waiting Time": [
    "More waiting at job card opening",
    "Delivery not on promised time",
    "Billing takes too long",
    "Service took too many hours"
  ],
  "Customer Lounge Amenities": [
    "Comfortable seating not available in lounge",
    "Lounge is dirty and hot",
    "No drinking water or refreshments",
    "No AC in the waiting area"
  ],
  "Operating Hours": [
    "Sunday opening not available",
    "Workshop closes too early",
    "Opens too late in the morning"
  ],
  "Workshop Facilities": [
    "Pick up & drop facility not available",
    "Express service not available",
    "No updates during service",
    "Poor communication from workshop"
  ]
};

const WS_NEG_VERBATIM_TO_DRIVER = new Map<string, string>();
Object.entries(WORKSHOP_NEGATIVE_VERBATIMS_BY_DRIVER).forEach(([l2, list]) =>
  list.forEach(p => WS_NEG_VERBATIM_TO_DRIVER.set(p.trim().toLowerCase(), l2)));

const WS_NEG_L3_TO_DRIVER = new Map<string, string>();
Object.entries(WORKSHOP_NEGATIVE_L2_TO_L3).forEach(([l2, list]) =>
  list.forEach(p => WS_NEG_L3_TO_DRIVER.set(p.trim().toLowerCase(), l2)));

export function findWorkshopNegDriverForText(phrase: string): string | null {
  const k = String(phrase || '').trim().toLowerCase();
  return WS_NEG_VERBATIM_TO_DRIVER.get(k) || WS_NEG_L3_TO_DRIVER.get(k) || null;
}

export function pickWorkshopNegVerbatimForDriver(
  l2: string,
  usedInRow: Set<string>,
  usedInCol?: Set<string>
): string | null {
  const pool = WORKSHOP_NEGATIVE_VERBATIMS_BY_DRIVER[l2] || [];
  if (pool.length === 0) return null;
  const lower = (s: string) => s.trim().toLowerCase();
  const fresh = pool.filter(p => !usedInRow.has(lower(p)) && !(usedInCol && usedInCol.has(lower(p))));
  const notInRow = pool.filter(p => !usedInRow.has(lower(p)));
  const choices = fresh.length ? fresh : notInRow;
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
}
