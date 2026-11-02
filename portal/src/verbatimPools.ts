// verbatimPools.ts — mirrors the pools used by getSectionAFields() and
// workshopPools() in server.js. Used by QcDataCheck auto-fill.

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

export const WORKSHOP_3A_POOLS: string[][] = [
    [
        "Resolving the reported issues in First Time Right",
        "Skilled technicians available in workshop",
        "Quick job card opening"
    ],
    [
        "Service adviser listened attentively",
        "Reasonable cost with clear explanation",
        "Pick up & drop facility available"
    ],
    [
        "Comfortable customer lounge with AC",
        "Easy warranty process",
        "Proper washing done"
    ]
];

export const WORKSHOP_3B_POOLS: string[][] = [
    [
        "More waiting at job card opening",
        "Invoice not explained properly",
        "Vehicle not washed properly"
    ],
    [
        "Service adviser was not listening",
        "Warranty not given in warranty period",
        "Pick up & drop facility not available"
    ],
    [
        "Repetition of issues since last service",
        "Sunday opening not available",
        "Comfortable seating not available in lounge"
    ]
];

export const WORKSHOP_4_POOLS: string[][] = [
    [
        "Technicians not skilled enough",
        "Spare parts not available at workshop",
        "Delivery not on promised time"
    ],
    [
        "Issues not resolved even after repeated visits",
        "Overcharging compared to invoice",
        "Service adviser behaved rudely"
    ],
    [
        "Polishing not done after wash",
        "Asked money for warranty replacement",
        "Express service not available"
    ]
];
