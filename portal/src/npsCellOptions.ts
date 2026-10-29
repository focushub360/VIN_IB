import { POSITIVE_DRIVER_L2_TO_L3 } from './shared/positiveDrivers';
import {
  WORKSHOP_POSITIVE_L2_TO_L3,
  WORKSHOP_NEGATIVE_L2_TO_L3
} from './shared/workshopDrivers';

// ============================================================
// Shared Option Arrays
// ============================================================

// 1) Product Positive (union of 3 excellentPools + 3 maybePositivePools from getSectionAFields)
export const EXCELLENT_POOLS: string[][] = [
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

export const MAYBE_POSITIVE_POOLS: string[][] = [
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

export const PRODUCT_POSITIVE_OPTIONS: string[] = Array.from(
  new Set([...EXCELLENT_POOLS.flat(), ...MAYBE_POSITIVE_POOLS.flat()])
);

// 2) Product Negative (union of 3 detractorPools + 3 maybeDissatisfactionPools from getSectionAFields)
export const DETRACTOR_POOLS: string[][] = [
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

export const MAYBE_DISSATISFACTION_POOLS: string[][] = [
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

export const PRODUCT_NEGATIVE_OPTIONS: string[] = Array.from(
  new Set([...DETRACTOR_POOLS.flat(), ...MAYBE_DISSATISFACTION_POOLS.flat()])
);

// 3) Service Positive (all L3 options across WORKSHOP_POSITIVE_L2_TO_L3)
export const SERVICE_POSITIVE_OPTIONS: string[] = Array.from(
  new Set(Object.values(WORKSHOP_POSITIVE_L2_TO_L3).flat())
);

// 4) Service Negative (all L3 options across WORKSHOP_NEGATIVE_L2_TO_L3)
export const SERVICE_NEGATIVE_OPTIONS: string[] = Array.from(
  new Set(Object.values(WORKSHOP_NEGATIVE_L2_TO_L3).flat())
);

// 5) TVS Genuine Spare Parts C5 reasons
export const C5_REASON_POOLS: string[][] = [
  [
    "Genuine quality parts",
    "Easy availability",
    "Reasonable price",
    "Long lasting",
    "Good performance"
  ],
  [
    "Trusted brand",
    "Wide dealer network",
    "Consistent quality",
    "Fair pricing",
    "Ready stock at dealer"
  ],
  [
    "Reliable spare parts",
    "Quick replacement",
    "Value for money",
    "Original TVS parts",
    "Minimal failure rate"
  ]
];

export const C5_REASON_OPTIONS: string[] = Array.from(
  new Set(C5_REASON_POOLS.flat())
);

// ============================================================
// NPS Cell Options Map (Keyed by exact column name string from GUINEA_COLUMNS_449)
// ============================================================
export const NPS_CELL_OPTIONS: Record<string, string[]> = {
  // Product Positive (AB–AF)
  "3a)1 why will you recommend your vehicle?": PRODUCT_POSITIVE_OPTIONS,
  "3a)2 why will you recommend your vehicle?": PRODUCT_POSITIVE_OPTIONS,
  "3a)3 why will you recommend your vehicle?": PRODUCT_POSITIVE_OPTIONS,
  "3a)4 why will you recommend your vehicle?": PRODUCT_POSITIVE_OPTIONS,
  "3a)5 why will you recommend your vehicle?": PRODUCT_POSITIVE_OPTIONS,

  // Product Negative (AG–AK and AN–AR)
  "3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "\r\n3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?": PRODUCT_NEGATIVE_OPTIONS,
  "4)1 why will you not recommend your vehicle?": PRODUCT_NEGATIVE_OPTIONS,
  "4)2 why will you not recommend your vehicle?": PRODUCT_NEGATIVE_OPTIONS,
  "4)3 why will you not recommend your vehicle?": PRODUCT_NEGATIVE_OPTIONS,
  "4)4 why will you not recommend your vehicle?": PRODUCT_NEGATIVE_OPTIONS,
  "4)5 why will you not recommend your vehicle?": PRODUCT_NEGATIVE_OPTIONS,

  // Service Positive (BW–BY)
  "3a)1 Which experience you like the most to recommend Workshop / Dealer?": SERVICE_POSITIVE_OPTIONS,
  "3a)2 Which experience you like the most to recommend Workshop / Dealer?": SERVICE_POSITIVE_OPTIONS,
  "3a)3 Which experience you like the most to recommend Workshop / Dealer?": SERVICE_POSITIVE_OPTIONS,

  // Service Negative (BZ–CB and CC–CE)
  "3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?": SERVICE_NEGATIVE_OPTIONS,
  "3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?": SERVICE_NEGATIVE_OPTIONS,
  "3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?": SERVICE_NEGATIVE_OPTIONS,
  "4)1 What are the main reasons for you have not recommend Workshop / Dealer?": SERVICE_NEGATIVE_OPTIONS,
  "4)2 What are the main reasons for you have not recommend Workshop / Dealer?": SERVICE_NEGATIVE_OPTIONS,
  "4)3 What are the main reasons for you have not recommend Workshop / Dealer?": SERVICE_NEGATIVE_OPTIONS,

  // Service Positive Driver columns (AU–BM)
  "Brake": POSITIVE_DRIVER_L2_TO_L3["Brake"] || [],
  "Electrical": POSITIVE_DRIVER_L2_TO_L3["Electrical"] || [],
  "Engine": POSITIVE_DRIVER_L2_TO_L3["Engine"] || [],
  "Load": POSITIVE_DRIVER_L2_TO_L3["Load"] || [],
  "Maintenance": POSITIVE_DRIVER_L2_TO_L3["Maintenance"] || [],
  "Mileage": POSITIVE_DRIVER_L2_TO_L3["Mileage"] || [],
  "Mirror": POSITIVE_DRIVER_L2_TO_L3["Mirror"] || [],
  "Vehicle": POSITIVE_DRIVER_L2_TO_L3["Vehicle"] || [],
  "Seat": POSITIVE_DRIVER_L2_TO_L3["Seat"] || [],
  "Sound": POSITIVE_DRIVER_L2_TO_L3["Sound"] || [],
  "Roof top (soft top)": POSITIVE_DRIVER_L2_TO_L3["Roof top (soft top)"] || [],
  "Spare parts": POSITIVE_DRIVER_L2_TO_L3["Spare parts"] || [],
  "Style": POSITIVE_DRIVER_L2_TO_L3["Style"] || [],
  "Suspension": POSITIVE_DRIVER_L2_TO_L3["Suspension"] || [],
  "Tyre": POSITIVE_DRIVER_L2_TO_L3["Tyre"] || [],
  "Vehicle price": POSITIVE_DRIVER_L2_TO_L3["Vehicle price"] || [],
  "Income": POSITIVE_DRIVER_L2_TO_L3["Income"] || [],
  "Windshield": POSITIVE_DRIVER_L2_TO_L3["Windshield"] || [],
  "Brand image": POSITIVE_DRIVER_L2_TO_L3["Brand image"] || [],

  // Mirrored OK–OW columns
  "Resolution of Problem is good": WORKSHOP_POSITIVE_L2_TO_L3["Resolution of Problem"] || [],
  "Parts availability & quality": WORKSHOP_POSITIVE_L2_TO_L3["Parts availability"] || [],
  "Skilled Manpower is available in workshop": WORKSHOP_POSITIVE_L2_TO_L3["Skilled Manpower"] || [],
  "Washing Quality (Applicable only for Asia)": WORKSHOP_POSITIVE_L2_TO_L3["Washing Quality"] || [],
  "Happy with Service Adviser Behaviour": WORKSHOP_POSITIVE_L2_TO_L3["Service Adviser Behavior"] || [],
  "Cost & Explanation was good": WORKSHOP_POSITIVE_L2_TO_L3["Cost & Explanation"] || [],
  "Warranty Policy is good": WORKSHOP_POSITIVE_L2_TO_L3["Warranty Policy"] || [],
  "Waiting Time was adequate": WORKSHOP_POSITIVE_L2_TO_L3["Waiting Time"] || [],
  "Satisfied with Customer Lounge Amenities": WORKSHOP_POSITIVE_L2_TO_L3["Customer Lounge Amenities"] || [],
  "Extension of Operating Hours is very supportive": WORKSHOP_POSITIVE_L2_TO_L3["Operating Hours"] || [],
  "Workshop Facilities": WORKSHOP_POSITIVE_L2_TO_L3["Workshop Facilities"] || [],

  // Service Negative Driver columns (OX–PL)
  "Complaints not resolved": WORKSHOP_NEGATIVE_L2_TO_L3["Resolution of Problem"] || [],
  "Parts availability issues Give names of three parts which were not available, with details.": WORKSHOP_NEGATIVE_L2_TO_L3["Parts availability"] || [],
  "Parts availability issues Give names of three parts which were not available, with details.45": WORKSHOP_NEGATIVE_L2_TO_L3["Parts availability"] || [],
  "Improve Skilled Manpower": WORKSHOP_NEGATIVE_L2_TO_L3["Skilled Manpower"] || [],
  "Washing Quality (Applicable only for Asia)46": WORKSHOP_NEGATIVE_L2_TO_L3["Washing Quality"] || [],
  "Service Adviser Behaviour issues": WORKSHOP_NEGATIVE_L2_TO_L3["Service Adviser Behavior"] || [],
  "Not satisfied with Cost & Explanation": WORKSHOP_NEGATIVE_L2_TO_L3["Cost & Explanation"] || [],
  "Warranty Policy issues": WORKSHOP_NEGATIVE_L2_TO_L3["Warranty Policy"] || [],
  "Waiting Time is more": WORKSHOP_NEGATIVE_L2_TO_L3["Waiting Time"] || [],
  "Improve Customer Lounge Amenities": WORKSHOP_NEGATIVE_L2_TO_L3["Customer Lounge Amenities"] || [],
  "Extent the Operating Hours": WORKSHOP_NEGATIVE_L2_TO_L3["Operating Hours"] || [],
  "Improve Workshop Facilities": WORKSHOP_NEGATIVE_L2_TO_L3["Workshop Facilities"] || [],

  // TVS Genuine Spare Parts reasons (QC–QG)
  "1-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?": C5_REASON_OPTIONS,
  "2-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?": C5_REASON_OPTIONS,
  "3-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?": C5_REASON_OPTIONS,
  "4-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?": C5_REASON_OPTIONS,
  "5-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?": C5_REASON_OPTIONS,
};
