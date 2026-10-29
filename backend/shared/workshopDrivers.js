'use strict';

const WORKSHOP_POSITIVE_L2_TO_L3 = {
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
    "Tea , Coffee Vending Machine",
    "AC",
    "TV",
    "WIFI",
    "Magazines , Newspaper",
    "Comfortable Seating"
  ],
  "Operating Hours": [
    "Sunday Opening",
    "After 7.00 PM Availability",
    "Before 09:00 AM Workshop Opening"
  ],
  "Workshop Facilities": [
    "Pick up & Drop",
    "Express Service",
    "AMC",
    "RSA",
    "Live Streaming",
    "Paper Less Workshop",
    "Work in Progress Updates",
    "Refreshment at Lounge",
    "What's App Updates",
    "Clear Communication"
  ]
};

const WORKSHOP_POSITIVE_L2_TO_COL = {
  "Resolution of Problem":     "Resolution of Problem is good",
  "Parts availability":        "Parts availability & quality",
  "Skilled Manpower":          "Skilled Manpower is available in workshop",
  "Washing Quality":           "Washing Quality (Applicable only for Asia)",
  "Service Adviser Behavior":  "Happy with Service Adviser Behaviour",
  "Cost & Explanation":        "Cost & Explanation was good",
  "Warranty Policy":           "Warranty Policy is good",
  "Waiting Time":              "Waiting Time was adequate",
  "Customer Lounge Amenities": "Satisfied with Customer Lounge Amenities",
  "Operating Hours":           "Extension of Operating Hours is very supportive",
  "Workshop Facilities":       "Workshop Facilities"
};

const WORKSHOP_NEGATIVE_L2_TO_L3 = {
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
    "Tea , Coffee Vending Machine",
    "AC",
    "TV",
    "WIFI",
    "Magazines , Newspaper",
    "Comfortable Seating"
  ],
  "Operating Hours": [
    "Sunday Opening",
    "After 7.00 PM Availability",
    "Before 09:00 AM Workshop Opening"
  ],
  "Workshop Facilities": [
    "Pick up & Drop",
    "Express Service",
    "AMC",
    "RSA",
    "Live Streaming",
    "Paper Less Workshop",
    "Work in Progress Updates",
    "Refreshment at Lounge",
    "What's App Updates",
    "Clear Communication"
  ]
};

const WORKSHOP_NEGATIVE_L2_TO_COL = {
  "Resolution of Problem":     "Complaints not resolved",
  "Parts availability":        "Parts availability issues Give names of three parts which were not available, with details.",
  "Skilled Manpower":          "Improve Skilled Manpower",
  "Washing Quality":           "Washing Quality (Applicable only for Asia)46",
  "Service Adviser Behavior":  "Service Adviser Behaviour issues",
  "Cost & Explanation":        "Not satisfied with Cost & Explanation",
  "Warranty Policy":           "Warranty Policy issues",
  "Waiting Time":              "Waiting Time is more",
  "Customer Lounge Amenities": "Improve Customer Lounge Amenities",
  "Operating Hours":           "Extent the Operating Hours",
  "Workshop Facilities":       "Improve Workshop Facilities"
};

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function keywordMatch(phraseLower, l3) {
  const kw = String(l3).toLowerCase()
    .replace(/[(),&]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  if (kw.length === 0) return false;
  return kw.every(k => phraseLower.includes(k));
}

/**
 * @param {object} row         fully-assembled row (must already contain 3a/3b/4 keys)
 * @param {number} index       row index for deterministic random
 * @param {object} aiPos       optional AI object: { [L2Name]: "L3 phrase" }
 * @param {object} aiNeg       optional AI object: { [L2Name]: "L3 phrase" }
 * @returns {{ positive: Record<string,string>, negative: Record<string,string> }}
 *          where keys are REAL Excel column names from OK..OW / OX..PL
 */
function mapWorkshopDrivers(row, index, aiPos, aiNeg) {
  const rng = mulberry32(index == null ? 42 : index + 1);
  const pos = {};
  const neg = {};

  const get = (keys) => {
    const out = [];
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
    let hit = null;
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

    let hit = null;
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

module.exports = {
  WORKSHOP_POSITIVE_L2_TO_L3,
  WORKSHOP_POSITIVE_L2_TO_COL,
  WORKSHOP_NEGATIVE_L2_TO_L3,
  WORKSHOP_NEGATIVE_L2_TO_COL,
  mapWorkshopDrivers,
  mulberry32
};
