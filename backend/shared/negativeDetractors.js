// shared/negativeDetractors.js
// ────────────────────────────────────────────────────────────────────────
// Negative detractors auto-fill: 3b.1..5 + 4)1..5 verbatims
//   → DF..EM   (L2 Complaint group slots, in order of first appearance)
//   → EP..OJ   (L3 sub-complaint columns + L4/L5/L6 follow-up answers)
//   → EN..EO, MP/MQ, KR/KS, HU/HV/HX, etc. (free-text follow-ups)
//
// Priority chain per column:
//   1. AI value from complaint_followups (if provided)
//   2. Keyword match against the column's valid options
//   3. Random pick from valid options (deterministic via mulberry32(seed))
//   4. Blank (only for "Capture in open Text box" questions)
//
// Never overwrites an already-filled column.
// ────────────────────────────────────────────────────────────────────────

'use strict';

// ─── 1. L2 group → contiguous EP..OJ column block (from your Python dict) ───
const ISSUE_COLUMN_RANGE_MAPPING = {
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

// ─── 2. The master tree — one node per L2 ───────────────────────────────
// Built by hand from Book3.xlsx (97 rows) + excel_column_headers.json +
// ISSUE_COLUMN_RANGE_MAPPING. Every L3 entry maps to its column(s) in EP..OJ.
//
// Node shapes:
//   type:'named'  → items{ l3Name → {primaryCol|enumSplit, L4, L5, L6} }
//   type:'single' → {primaryCol, options[], L4}
//   type:'split'  → {options[], enumColumns{option→col}, L4}
//
// `openText:true` on a follow-up means AI text only (never random).
// ─────────────────────────────────────────────────────────────────────────

const NEGATIVE_TREE = {
    'Brake issues': {
        type: 'named',
        items: {
            'Front brake noise': {
                primaryCol: 'EP',
                keywords: ['front brake noise', 'front brake noisy', 'brake noise front'],
                L4: { col: 'EP', question: 'Q-When this happening?', options: ['Moring time only', 'All time brake noise'] },
                L5: null, L6: null
            },
            'Front brake poor': {
                primaryCol: 'EQ',
                keywords: ['front brake poor', 'front brake weak', 'front braking weak'],
                L4: { col: 'EQ', question: 'Q-What kind of issue?', options: ['Lever touching accelerator', 'Lever play loose', 'Stopping distance is high', 'Brake shoe quick wear', 'Disc pad quick wear'] },
                L5: null, L6: null
            },
            'Front Brake tight': {
                primaryCol: 'ER',
                keywords: ['front brake tight', 'front brake hard'],
                L4: { col: 'ER', question: 'Q-What kind of issue?', options: ['Lever play tight', 'hard to apply brake'] },
                L5: null, L6: null
            },
            'Rear brake noise': {
                primaryCol: 'ES',
                keywords: ['rear brake noise', 'rear brake noisy'],
                L4: { col: 'ES', question: 'Q-When this happening?', options: ['Moring time only', 'All time brake noise'] },
                L5: null, L6: null
            },
            'Rear brake poor': {
                primaryCol: 'ET',
                keywords: ['rear brake poor', 'rear brake weak'],
                L4: { col: 'ET', question: 'Q-What kind of issue?', options: ['Pedal not return', 'Lever play loose', 'Stopping distance is high', 'Brake shoe quick wear', 'Disc pad quick wear'] },
                L5: null, L6: null
            },
            'Rear brake tight': {
                primaryCol: 'EU',
                keywords: ['rear brake tight', 'rear brake hard'],
                L4: { col: 'EU', question: 'Q-What kind of issue?', options: ['Lever play tight', 'hard to apply brake'] },
                L5: null, L6: null
            },
            'ABS Not working': {
                primaryCol: 'EV',
                keywords: ['abs not working', 'abs fail', 'abs issue'],
                L4: { col: 'EV', question: 'Q-Where?', options: ['Front', 'Rear'] },
                L5: { col: null, question: 'Q-Any oil leakage in cylinder?', options: ['Yes', 'No'], appendTo: 'EV' },
                L6: null
            },
            'Hand brake poor': {
                primaryCol: 'EW',
                keywords: ['hand brake poor', 'hand brake not working'],
                L4: { col: 'EW', question: 'Q-What kind of issue?', options: ['Hand brake slippage', 'not working'] },
                L5: null, L6: null
            },
            'Brake poor': {
                primaryCol: 'EX',
                keywords: ['brake poor', 'brake weak', 'braking poor'],
                L4: { col: 'EX', question: 'Q-What kind of issue?', options: ['Pedal not return', 'Stopping distance is high', 'too soft or spongy brake'] },
                L5: { col: null, question: 'Q-Any oil leakage in reservoir? / Q-Any oil leakage in cylinder?', options: ['Yes', 'No'], appendTo: 'EX' },
                L6: null
            }
        }
    },

    'Cable issues': {
        type: 'named',
        items: {
            'Clutch cable': {
                enumSplit: true,
                enumColumns: { 'less life': 'EY', 'Cable breakage': 'EZ' },
                keywords: ['clutch cable'],
                L4: { col: 'enumSplit', question: 'Q-What kind of issue?', options: ['Cable breakage', 'less life'] },
                L5: { col: 'HU', question: 'Q-What is the Life or frequency of change the cable?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L6: null
            },
            'Brake cable': {
                enumSplit: true,
                enumColumns: { 'less life': 'FA', 'Cable breakage': 'FB' },
                keywords: ['brake cable'],
                L4: { col: 'enumSplit', question: 'Q-What kind of issue?', options: ['Cable breakage', 'less life'] },
                L5: { col: 'HU', question: 'Q-What is the Life or frequency of change the cable?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L6: null
            },
            'Speedo cable': {
                enumSplit: true,
                enumColumns: { 'less life': 'FC', 'Cable breakage': 'FD' },
                keywords: ['speedo cable', 'speedometer cable'],
                L4: { col: 'enumSplit', question: 'Q-What kind of issue?', options: ['Cable breakage', 'less life'] },
                L5: { col: 'HU', question: 'Q-What is the Life or frequency of change the cable?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L6: null
            }
        }
    },

    'Chain issue': {
        type: 'single',
        primaryCol: 'FE',
        keywords: ['chain noise', 'chain loose', 'chain tight'],
        question: 'Q-What kind of issue?',
        options: ['Chain noise', 'Chain loose', 'Chain Tight']
    },
    'Chain case issue': {
        type: 'single',
        primaryCol: 'FF',
        keywords: ['chain case'],
        question: 'Q-What kind of issue?',
        options: ['Chain case rust', 'Chain case damage', 'Chain case broken', 'Chain case less life']
    },

    'Clutch issues': {
        type: 'named',
        items: {
            'Clutch loose': {
                primaryCol: 'FG',
                keywords: ['clutch loose'],
                L4: { col: 'FG', question: 'Q-Why any specific problem?', openText: true },
                L5: null, L6: null
            },
            'Clutch Noise': {
                primaryCol: 'FH',
                keywords: ['clutch noise'],
                L4: { col: 'FH', question: 'Q-At what speed clutch noise is coming?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: null, L6: null
            },
            'Clutch hard': {
                primaryCol: 'FI',
                keywords: ['clutch hard'],
                L4: { col: 'FI', question: 'Q-What kind of issue?', options: ['Lever Play Low', 'Hard to operate clutch lever'] },
                L5: null, L6: null
            },
            'Clutch life is low': {
                enumSplit: true,
                enumColumns: { 'Clutch plate wear': 'FJ', 'Clutch plate burning': 'FK' },
                keywords: ['clutch life low', 'clutch plate'],
                L4: { col: 'enumSplit', question: 'Q-Why it is?', options: ['Clutch plate wear', 'Clutch plate burning'] },
                L5: { col: 'HU', question: 'Q-What is the Life or frequency of change the clutch?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L6: null
            }
        }
    },

    'Electrical issues': {
        type: 'named',
        items: {
            'Speedometer issue': {
                primaryCol: 'FL',
                keywords: ['speedometer', 'odometer', 'meter'],
                L4: { col: 'FL', question: 'Q-What is the issue in speedometer?', options: ['Speed is not showing', 'Odometer not working', 'fuel indication issue', 'Water entry in display', 'Speedometer display crack', 'Neutral indication not working', 'Service reminder', 'Low Battery symbol display', 'Engine warning temperature', 'Side stand symbol', 'Mode not changing', 'Bluetooth not connecting', 'MIL glowing', 'ABS lamp continously glowing', 'Neutral wrong indication', 'Gear position wrong indication'] },
                L5: null, L6: null
            },
            'TSL (Indicator)': {
                enumSplit: true,
                enumColumns: {
                    'Beeper Sound not coming': 'FM',
                    'Light Not working': 'FN',
                    'water entry': 'FO',
                    'crack': 'FP'
                },
                keywords: ['indicator', 'tsl'],
                L4: { col: 'enumSplit', question: 'Q-What kind of issue?', options: ['Beeper Sound not coming', 'Light Not working', 'water entry', 'crack'] },
                L5: { col: null, question: 'Q-Which side was the issue?', options: ['Front LH side', 'Front RH side', 'Front both side', 'Rear LH side', 'Rear RH side', 'Rear both side'], appendTo: 'FN' },
                L6: null
            },
            'Head light': {
                enumSplit: true,
                enumColumns: { 'DC headlamp': 'FQ', 'LED headlamp': 'FR' },
                keywords: ['headlight', 'head lamp'],
                L4: { col: 'enumSplit', question: 'Q-What type of headlight?', options: ['DC headlamp', 'LED headlamp'] },
                L5: { col: null, question: 'Q-What kind of issue?', options: ['Low intensity', 'Focus not Ok', 'High beam not working', 'Low beam not working', 'Both high and low beam not working', 'Pass by not working', 'Water entry in headlamp', 'Low headlamp brightness'], appendTo: 'FQ' },
                L6: null
            },
            'Tail lamp not working': {
                enumSplit: true,
                enumColumns: { 'Bulb': 'FS', 'LED': 'FT' },
                keywords: ['tail lamp', 'tail light'],
                L4: { col: 'enumSplit', question: 'Q-What type of Tail lamp?', options: ['Bulb', 'LED'] },
                L5: { col: null, question: 'Q-What was the problem?', options: ['not working', 'water entry'], appendTo: 'FS' },
                L6: null
            },
            'Horn issues': {
                primaryCol: 'FU',
                keywords: ['horn'],
                L4: { col: 'FU', question: 'Q-What kind of issue?', options: ['Not working', 'low sound', 'change in tone', 'intermittent working'] },
                L5: null, L6: null
            },
            'Switch problem': {
                primaryCol: 'FV',
                keywords: ['switch'],
                L4: { col: 'FV', question: 'Q-Which switch was problem?', options: ['Self start switch', 'High or low beam switch', 'Pass by switch', 'Indicator switch', 'Kill switch', 'Hazard switch'] },
                L5: null, L6: null
            },
            'Locks not working': {
                enumSplit: true,
                enumColumns: {
                    'Ignition key not working': 'FW',
                    'Side lock not working': 'FX',
                    'Fuel tank cap lock not working': 'FY'
                },
                keywords: ['lock'],
                L4: { col: 'enumSplit', question: 'Q-Which lock was issue?', options: ['Ignition key not working', 'Side lock not working', 'Fuel tank cap lock not working'] },
                L5: { col: null, question: 'Q-What was the problem?', options: ['Hard', 'Loose', 'Stuckup', 'sometimes not working'], appendTo: 'FW' },
                L6: null
            }
        }
    },

    'Engine issues': {
        type: 'named',
        items: {
            'Engine noise': {
                enumSplit: true,
                enumColumns: { 'Top side': 'FZ', 'bottom side': 'GA', 'Unknown': 'GB' },
                keywords: ['engine noise', 'engine sound'],
                L4: { col: 'enumSplit', question: 'Q-From where noise is coming?', options: ['Top side', 'bottom side', 'Unknown'] },
                L5: { col: null, question: 'Q-Noise is coming in what speed range?', options: ['Idling', 'constant speed'], appendTo: 'FZ' },
                L6: null
            },
            'Engine oil leak': {
                primaryCol: 'GC',
                keywords: ['engine oil leak', 'oil leak'],
                L4: { col: 'GC', question: 'Q-In which location?', options: ['Cylinder head', 'Engine bottom drain hole', 'Oil cooler', 'clutch side', 'Magneto side', 'chain sprocket side', 'Unknown'] },
                L5: null, L6: null
            },
            'Engine Heat': {
                enumSplit: true,
                enumColumns: { 'LH side': 'GD', 'RH side': 'GE', 'Both': 'GF' },
                keywords: ['engine heat', 'heat'],
                L4: { col: 'enumSplit', question: 'Q-Which side are you feeling heat?', options: ['LH side', 'RH side', 'Both'] },
                L5: { col: null, question: 'Q-Can you specify where it is?', options: ['Foot', 'knee', 'Thigh', 'Seat', 'All'], appendTo: 'GD' },
                L6: null
            },
            'Engine parts rust': {
                primaryCol: 'GG',
                keywords: ['engine parts rust', 'rust'],
                L4: { col: 'GG', question: 'Q-Where is the rust and specify the location name?', openText: true },
                L5: null, L6: null
            }
        }
    },

    'Gear issues': {
        type: 'named',
        items: {
            'Gear noise': {
                enumSplit: true,
                enumColumns: { 'Upshifitng': 'GH', 'Downshifting': 'GI', 'Both': 'GJ' },
                keywords: ['gear noise'],
                L4: { col: 'enumSplit', question: 'Q-When noise is coming?', options: ['Upshifitng', 'Downshifting', 'both'] },
                L5: { col: null, question: 'Q-In which gear condition?', options: ['N-1', '1-2', '2-3', '3-4', '4-5', 'All Gears', '1-N', '2-1', '3-2', '4-3', '5-4'], appendTo: 'GH' },
                L6: null
            },
            'Gear shifting hard': {
                enumSplit: true,
                enumColumns: { 'Upshifitng': 'GK', 'Downshifting': 'GL', 'Both': 'GM' },
                keywords: ['gear shifting hard', 'gear hard'],
                L4: { col: 'enumSplit', question: 'Q-When it is hard?', options: ['Upshifitng', 'Downshifting', 'both'] },
                L5: { col: null, question: 'Q-In which gear condition?', options: ['N-1', '1-2', '2-3', '3-4', '4-5', 'All Gears', '1-N', '2-1', '3-2', '4-3', '5-4'], appendTo: 'GK' },
                L6: null
            },
            'Not Coming to Neutral': {
                primaryCol: 'GN',
                keywords: ['neutral'],
                L4: { col: 'GN', question: 'Q-What kind of issue?', options: ['Stuck up', 'indication not showing properly'] },
                L5: null, L6: null
            },
            'Additional gear required': {
                primaryCol: 'GO',
                keywords: ['additional gear', 'extra gear'],
                L4: { col: 'GO', question: 'Q-Why it is required?', openText: true },
                L5: null, L6: null
            }
        }
    },

    'Handle Bar issues': {
        type: 'named',
        items: {
            'Handle bar noise': {
                primaryCol: 'GP',                       // default variant; enum spread GP..GS
                enumSplit: true,
                enumColumns: { 'Cornering': 'GP', 'Pot holes': 'GQ', 'Bumpy roads': 'GR', 'Others': 'GS' },
                keywords: ['handle bar noise', 'handlebar noise'],
                L4: { col: 'enumSplit', question: 'Q-When it is happening?', options: ['Cornering', 'Pot holes', 'Bumpy roads', 'Others'] },
                L5: { col: null, question: 'Q-Noise at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'GP' },
                L6: null
            },
            'Handle bar loose/ Tight /jam': {
                enumSplit: true,
                enumColumns: {
                    'loose Cornering': 'GT', 'loose Pot holes': 'GU', 'loose Bumpy roads': 'GV', 'loose Others': 'GW',
                    'Tight Cornering': 'GX', 'Tight Pot holes': 'GY', 'Tight Bumpy roads': 'GZ', 'Tight Others': 'HA',
                    'jam Cornering': 'HB', 'jam Pot holes': 'HC', 'jam Bumpy roads': 'HD', 'jam Others': 'HE'
                },
                keywords: ['handle bar loose', 'handle bar tight', 'handle bar jam'],
                L4: { col: 'enumSplit', question: 'Q-When it is happening?', options: ['Cornering', 'Pot holes', 'Bumpy roads', 'Others'] },
                L5: { col: null, question: 'Q- If any specific speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'GT' },
                L6: null
            },
            'handle bar bend': {
                enumSplit: true,
                enumColumns: { 'Yes': 'HJ', 'No': 'HK' },
                keywords: ['handle bar bend'],
                L4: { col: 'enumSplit', question: 'Q-How?', options: ['Looks like bend', 'Bend after any incident'] },
                L5: { col: 'HJ', question: 'Q-Is vehicle fall down?', options: ['Yes', 'No'] },
                L6: null
            },
            'Handle Bar shaking': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'HL', '25-50 kmph': 'HM', '>=50 kmph': 'HN' },
                keywords: ['handle bar shaking', 'handlebar shaking'],
                L4: { col: 'enumSplit', question: 'Q-Shaking at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: null, L6: null
            },
            'Handle bar vibration': {
                enumSplit: true,
                enumColumns: { 'LH side': 'HO', 'RH side': 'HP', 'Both side': 'HQ' },
                keywords: ['handle bar vibration', 'handlebar vibration'],
                L4: { col: 'enumSplit', question: 'Q-In which side?', options: ['LH side', 'RH side', 'Both side'] },
                L5: { col: null, question: 'Q-Vibration at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'HO' },
                L6: null
            }
        }
    },

    'Kicker issues': {
        type: 'named',
        items: {
            'Kicker hard': {
                primaryCol: 'HR',
                keywords: ['kicker hard', 'kick stuck', 'kick not returning', 'difficult to kick'],
                L4: { col: 'HR', question: 'Q-What kind of issue?', options: ['Difficult to kick', 'Kick stuck', 'Kick not returning'] },
                L5: null, L6: null
            },
            'Kicker oil leakage': {
                primaryCol: 'HS',
                keywords: ['kicker oil leakage', 'kicker oil leak'],
                L4: null, L5: null, L6: null
            }
        }
    },

    'Low Mileage': {
        type: 'single',
        primaryCol: 'HT',
        keywords: ['mileage', 'kmpl', 'km/l'],
        question: 'Q-What mileage are you getting?',
        options: ['less than 20km', '20-30km', '30-40km', '40-50km', 'more than 50km'],
        L4: { col: 'HU', question: 'Q-What is your average Speed using regularly?', options: ['Less than 50kmph', '50 - 60kmph', '60 - 70kmph', '70 - 80kmph', 'more than 80kmph'] },
        L5: { col: 'HV', question: 'Q-What kind of traffic are you mostly using?', options: ['More traffic', 'less traffic'] },
        L6: { col: 'HX', question: 'Usually how many passenger/load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] }
    },

    'Low Speed': {
        type: 'single',
        primaryCol: 'HY',
        keywords: ['top speed', 'low speed', 'slow speed'],
        question: 'Q-What is top speed are you getting now?',
        options: ['less than 50kmph', '50-60kmph', '60-70kmph', '70-80kmph', '80-90kmph', '90-100kmph', 'morethan 100kmph'],
        L4: { col: 'HZ', question: 'Q-What is the top speed are you Expecting?', openText: true }
    },

    'Muffler issues': {
        type: 'named',
        items: {
            'Muffler Noise': {
                enumSplit: true,
                enumColumns: { 'Rough road': 'IA', 'plain road': 'IB' },
                keywords: ['muffler noise'],
                L4: { col: 'enumSplit', question: 'Q-What kind of noise?', options: ['Muffler Guard rattling', 'Misfiring noise', 'tone changes', 'Others'] },
                L5: { col: 'IA', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] },
                L6: null
            },
            'Muffler smoke more': {
                enumSplit: true,
                enumColumns: { 'Idling speed': 'IC', 'While running': 'ID' },
                keywords: ['muffler smoke'],
                L4: { col: 'enumSplit', question: 'Q-What kind of smoke?', options: ['White smoke', 'black smoke'] },
                L5: { col: 'IC', question: 'Q-When it is happening?', options: ['Idling speed', 'While running'] },
                L6: null
            },
            'Muffler Rust': {
                primaryCol: 'IE',
                keywords: ['muffler rust'],
                L4: { col: 'IE', question: 'Q-Where is the rust and specify the location?', openText: true },
                L5: null, L6: null
            }
        }
    },

    'Starting trouble': {
        type: 'named',
        items: {
            'Self start problem': {
                enumSplit: true,
                enumColumns: {
                    'Taking Many self for starting': 'IF',
                    'in gear condition': 'IG',
                    'Not at all starting': 'IH'
                },
                keywords: ['self start'],
                L4: { col: 'enumSplit', question: 'Q-What is the issue?', options: ['Taking Many self for starting', 'in gear condition', 'Not at all starting'] },
                L5: { col: null, question: 'Q-When it is happening?', options: ['Morning time', 'During long parking', 'Not starting after driving few km'], appendTo: 'IF' },
                L6: null
            },
            'Kick start problem': {
                primaryCol: 'II',
                keywords: ['kick start'],
                L4: { col: 'II', question: 'Q-What is the issue?', options: ['Takes too many kicks', 'Kick hard'] },
                L5: null, L6: null
            }
        }
    },

    'Suspension issues': {
        type: 'named',
        items: {
            'Front suspension Noise': {
                enumSplit: true,
                enumColumns: { 'Cornering': 'IJ', 'Pot holes': 'IK', 'Bumpy roads': 'IL', 'Normal road': 'IM' },
                keywords: ['front suspension noise'],
                L4: { col: 'enumSplit', question: 'Q-When it is happening?', options: ['Cornering', 'Pot holes', 'Bumpy roads', 'Normal road'] },
                L5: { col: null, question: 'Q-Noise at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'IJ' },
                L6: null
            },
            'Oil leak from front suspension': {
                primaryCol: 'IN',
                keywords: ['front suspension oil leak', 'oil leak from front suspension'],
                L4: null, L5: null, L6: null
            },
            'Front suspension Hard': {
                primaryCol: 'IO',
                keywords: ['front suspension hard'],
                L4: { col: 'IO', question: 'Q-Usually how many passenger will travel? / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
                L5: { col: 'IQ', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] },
                L6: null
            },
            'Front suspension Soft': {
                primaryCol: 'IR',
                keywords: ['front suspension soft'],
                L4: { col: 'IR', question: 'Q-Usually how many passenger will travel? / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
                L5: { col: 'IT', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] },
                L6: null
            },
            'Rear suspension Hard': {
                primaryCol: 'IU',
                keywords: ['rear suspension hard'],
                L4: { col: 'IU', question: 'Q-Usually how many passenger will travel? / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
                L5: { col: 'IW', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] },
                L6: null
            },
            'Rear suspension Soft': {
                primaryCol: 'IX',
                keywords: ['rear suspension soft'],
                L4: { col: 'IX', question: 'Q-Usually how many passenger will travel? / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
                L5: { col: 'IZ', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] },
                L6: null
            },
            'Rear suspension Noise': {
                enumSplit: true,
                enumColumns: { 'Cornering': 'JA', 'Pot holes': 'JB', 'Bumpy roads': 'JC', 'Normal road': 'JD' },
                keywords: ['rear suspension noise'],
                L4: { col: 'enumSplit', question: 'Q-When it is happening?', options: ['Cornering', 'Pot holes', 'Bumpy roads', 'Normal road'] },
                L5: { col: null, question: 'Q-Noise at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'JA' },
                L6: null
            }
        }
    },

    'Vehicle noise': {
        type: 'named',
        items: {
            'Front side noise': {
                primaryCol: 'JE',
                keywords: ['front side noise', 'front noise'],
                L4: { col: 'JE', question: 'Q-Can you specify the location?', options: ['Meter noise', 'Front mudguard', 'Front panel noise', 'Wisor noise', 'Headlamp rattling noise', 'Floor board', 'Lockset noise', 'Petrol cap noise', 'Customer unable to say'] },
                L5: { col: null, question: 'Q-Noise at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'JE' },
                L6: { col: 'JN', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] }
            },
            'Rear side noise': {
                primaryCol: 'JO',
                keywords: ['rear side noise', 'rear noise'],
                L4: { col: 'JO', question: 'Q-Can you specify the location?', options: ['Kicker noise', 'Rear mudguard', 'Accessories noise', 'Rear panel noise', 'Seat noise', 'Muffler noise', 'gear box', 'Customer unable to say'] },
                L5: { col: null, question: 'Q-Noise at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'JO' },
                L6: { col: 'JW', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] }
            }
        }
    },

    'Vibration': {
        type: 'named',
        items: {
            'Front side vibration': {
                primaryCol: 'JX',
                keywords: ['front vibration', 'front side vibration'],
                L4: { col: 'JX', question: 'Q-Can you specify the location?', options: ['Wisor Vibration', 'Foot rest vibration', 'Handle bar', 'Speedometer', 'Juddering', 'Seat vibration', 'Tank vibration'] },
                L5: { col: null, question: 'Q-Vibration at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'JX' },
                L6: { col: 'KE', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] }
            },
            'Rear side vibration': {
                primaryCol: 'KF',
                keywords: ['rear vibration', 'rear side vibration'],
                L4: { col: 'KF', question: 'Q-Can you specify the location?', options: ['Clutch vibration', 'pillion handle vibration', 'Muffler vibration', 'Saree guard vibration', 'Seat vibration'] },
                L5: { col: null, question: 'Q-Vibration at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'KF' },
                L6: { col: 'KK', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] }
            },
            'Foot rest vibration': {
                enumSplit: true,
                enumColumns: { 'LH side': 'KL', 'RH side': 'KM', 'Both side': 'KN' },
                keywords: ['foot rest vibration', 'footrest vibration'],
                L4: { col: 'enumSplit', question: 'Q-In which side?', options: ['LH side', 'RH side', 'Both side'] },
                L5: { col: null, question: 'Q-Vibration at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'KL' },
                L6: null
            }
        }
    },

    'Mirror issues': {
        type: 'named',
        items: {
            'Mirror loose': {
                enumSplit: true,
                enumColumns: { 'LH side': 'KO', 'RH side': 'KP', 'Both side': 'KQ' },
                keywords: ['mirror loose'],
                L4: { col: 'enumSplit', question: 'Q-In which side?', options: ['LH side', 'RH side', 'Both side'] },
                L5: { col: null, question: 'Q-at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'KO' },
                L6: null
            },
            'Mirror vibration': {
                enumSplit: true,
                enumColumns: { 'LH side': 'KO', 'RH side': 'KP', 'Both side': 'KQ' },
                keywords: ['mirror vibration'],
                L4: { col: 'enumSplit', question: 'Q-In which side?', options: ['LH side', 'RH side', 'Both side'] },
                L5: { col: null, question: 'Q-Vibration at what speed?', options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms'], appendTo: 'KO' },
                L6: null
            },
            'Mirror small size': {
                primaryCol: 'KR',
                keywords: ['mirror small', 'mirror size'],
                L4: { col: 'KR', question: 'Q-Comparing with which competition model?', openText: true },
                L5: { col: 'KS', question: 'Q-What is customer expectation?', openText: true },
                L6: null
            }
        }
    },

    'Wheel/Tyre issues': {
        type: 'named',
        items: {
            'Front wheel noise': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'KT', '25-50 kmph': 'KU', '>50 kmph': 'KV' },
                keywords: ['front wheel noise', 'front tyre noise'],
                L4: { col: 'enumSplit', question: 'Q-Noise at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'KT' },
                L6: null
            },
            'Front wheel wobbling': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'KW', '25-50 kmph': 'KX', '>50 kmph': 'KY' },
                keywords: ['front wheel wobbling', 'front wobble'],
                L4: { col: 'enumSplit', question: 'Q-Wobbling at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'KW' },
                L6: { col: 'KZ', question: 'Q-How frequently you fill air in Tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Front tyre skidding': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'LA', '25-50 kmph': 'LB', '>50 kmph': 'LC' },
                keywords: ['front tyre skidding', 'front skid'],
                L4: { col: 'enumSplit', question: 'Q-Skidding at what speed?', options: ['less than 25 kmph', '25-50 kmph', '50-80', 'more than 80 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LA' },
                L6: { col: 'LD', question: 'Q-How frequently you fill air in Tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Front tyre weak/less life': {
                enumSplit: true,
                enumColumns: {
                    'less than 1000km': 'LE', '1000-5000km': 'LF', '5000-10000km': 'LG',
                    '10000-15000km': 'LH', '15000-20000km': 'LI', 'more than 20000 kms': 'LJ'
                },
                keywords: ['front tyre weak', 'front tyre less life'],
                L4: { col: 'enumSplit', question: 'Q-What is the Life or frequency of change the tyre?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LE' },
                L6: { col: 'LK', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Front wheel tight': {
                primaryCol: 'LL',
                keywords: ['front wheel tight'],
                L4: null, L5: null, L6: null
            },
            'Front widder tyre required': {
                primaryCol: 'LM',
                keywords: ['front wider tyre', 'front widder tyre'],
                L4: { col: 'LM', question: 'Q-Comparing with which competition model?', openText: true },
                L5: null, L6: null
            },
            'Rear wheel noise': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'LN', '25-50 kmph': 'LO', '>50 kmph': 'LP' },
                keywords: ['rear wheel noise', 'rear tyre noise'],
                L4: { col: 'enumSplit', question: 'Q-Noise at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LN' },
                L6: null
            },
            'Rear wheel wobbling': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'LQ', '25-50 kmph': 'LR', '>50 kmph': 'LS' },
                keywords: ['rear wheel wobbling', 'rear wobble'],
                L4: { col: 'enumSplit', question: 'Q-Wobbling at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LQ' },
                L6: { col: 'LT', question: 'Q-How frequently you fill air in Tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Rear tyre skidding': {
                enumSplit: true,
                enumColumns: { '<=25 kmph': 'LU', '25-50 kmph': 'LV', '>50 kmph': 'LW' },
                keywords: ['rear tyre skidding', 'rear skid'],
                L4: { col: 'enumSplit', question: 'Q-Skidding at what speed?', options: ['less than 25 kmph', '25-50 kmph', '50-80', 'more than 80 kmph'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LU' },
                L6: { col: 'LX', question: 'Q-How frequently you fill air in Tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Rear tyre weak/less life': {
                enumSplit: true,
                enumColumns: {
                    'less than 1000km': 'LY', '1000-5000km': 'LZ', '5000-10000km': 'MA',
                    '10000-15000km': 'MB', '15000-20000km': 'MC', 'more than 20000 kms': 'MD'
                },
                keywords: ['rear tyre weak', 'rear tyre less life'],
                L4: { col: 'enumSplit', question: 'Q-What is the Life or frequency of change the tyre?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'] },
                L5: { col: null, question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'], appendTo: 'LY' },
                L6: { col: 'ME', question: 'Q-How frequently you fill air in tyre?', options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly'] }
            },
            'Rear wheel tight': {
                primaryCol: 'MF',
                keywords: ['rear wheel tight'],
                L4: null, L5: null, L6: null
            },
            'Rear widder tyre required': {
                primaryCol: 'MG',
                keywords: ['rear wider tyre', 'rear widder tyre'],
                L4: { col: 'MG', question: 'Q-Comparing with which competition model?', openText: true },
                L5: null, L6: null
            }
        }
    },

    'Battery issues': {
        type: 'named',
        items: {
            'Battery issue': {
                enumSplit: true,
                enumColumns: { 'Battery drain quickly': 'MH', 'Battery life is less': 'MI', 'Battery out of warranty': 'MJ' },
                keywords: ['battery'],
                L4: { col: 'enumSplit', question: 'Q-What is the issue in battery?', options: ['Battery drain quickly', 'Battery life is less', 'Battery out of warranty'] },
                L5: { col: null, question: 'Q-Life or frequency of change?', options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms'], appendTo: 'MH' },
                L6: { col: 'MK', question: 'Q-Which brand battery in the vehicle?', options: ['Exide', 'Amron', 'Amco', 'TATA green'] }
            }
        }
    },

    'Jerking issues': {
        type: 'named',
        items: {
            'Jerking': {
                primaryCol: 'ML',
                keywords: ['jerking', 'jerk'],
                L4: { col: 'ML', question: 'Q-In what speed vehicle get jerking?', options: ['less than 20km', '20-40km', '40-60km', '60-80km', 'more than 80kmph'] },
                L5: { col: 'MM', question: 'Q-In what kind of condition?', options: ['Cold condition', 'hot condition'] },
                L6: { col: 'MN', question: 'Q-If vehicle get Jerking in specific gear?', options: ['Yes', 'No'] }
            }
        }
    },

    'Part not available': {
        type: 'single',
        primaryCol: 'MP',
        keywords: ['part not available', 'parts not available'],
        question: 'Q-Which part not available?',
        openText: true,
        L4: { col: 'MQ', question: 'Q-In which Location it is not available?', openText: true }
    },

    'Pick-up problem': {
        type: 'single',
        primaryCol: 'MR',
        keywords: ['pickup problem', 'pick up problem', 'pickup low'],
        question: 'Q-When this Pick-up problem occur, in what speed?',
        options: ['less than 20km', '20-40km', '40-60km', '60-80km', 'more than 80kmph'],
        L4: { col: null, question: 'Q-In what kind of condition?', options: ['Cold condition', 'hot condition'] },
        L5: { col: null, question: 'Q-Usually how many passenger / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
        L6: { col: null, question: 'Q-What kind of road condition?', options: ['Plain Road', 'gradient road'] }
    },

    'Running off': {
        type: 'split',
        keywords: ['running off', 'switches off', 'turns off'],
        question: 'Q-When is the vehicle getting Running off?',
        options: ['Slow speed (less than 30 kmph)', 'High speed (more than 50 kmph)', 'During idle condition', 'While Crossing speed breaker', 'While De-acceleration', 'While applying brake', 'While applying clutch'],
        enumColumns: {
            'Slow speed (less than 30 kmph)': 'NC',
            'High speed (more than 50 kmph)': 'ND',
            'During idle condition': 'NE',
            'While Crossing speed breaker': 'NF',
            'While De-acceleration': 'NG',
            'While applying brake': 'NH',
            'While applying clutch': 'NI'
        },
        L4: { col: null, question: 'Q-When it is happening?', options: ['Vehicle running off in morning', 'after heating the engine', 'any time'] }
    },

    'Throttle/Accelerator issue': {
        type: 'single',
        primaryCol: 'NJ',
        keywords: ['throttle', 'accelerator', 'rpm'],
        question: 'Q-What kind of issue?',
        options: ['Accelearator hard', 'Accelearator loose', 'RPM auto rasing']
    },

    'Vehicle body parts issue': {
        type: 'named',
        items: {
            'Low ground clearance': {
                enumSplit: true,
                enumColumns: { 'Rough road': 'NM', 'plain road': 'NN' },
                keywords: ['ground clearance'],
                L4: { col: 'enumSplit', question: 'Q-Usually how many passenger will travel? / Load?', options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg'] },
                L5: { col: 'NM', question: 'Q-What kind of road condition?', options: ['Rough road', 'plain road'] },
                L6: null
            },
            'Stand Problem': {
                enumSplit: true,
                enumColumns: { 'Loose': 'NO', 'tight': 'NP', 'Returnability': 'NQ' },
                keywords: ['stand'],
                L4: { col: 'enumSplit', question: 'Q-Which stand?', options: ['Side stand', 'center stand'] },
                L5: { col: null, question: 'Q-What kind of issue?', options: ['Loose', 'tight', 'Returnability'], appendTo: 'NO' },
                L6: null
            },
            'Paint issue': {
                primaryCol: 'NR',
                keywords: ['paint'],
                L4: { col: 'NR', question: 'Q-What kind of issue?', options: ['Paint peel off', 'Paint faded', 'Paint scratch'] },
                L5: { col: null, question: 'Q-Can you specify the location?', openText: true, appendTo: 'NR' },
                L6: null
            },
            'Panel issue': {
                enumSplit: true,
                enumColumns: { 'Fitment gap': 'NS', 'loose fitment': 'NT', 'Alignment problem': 'NU', 'damage': 'NV', 'dent': 'NW' },
                keywords: ['panel'],
                L4: { col: 'enumSplit', question: 'Q-Which side is the issue?', options: ['Front', 'Rear', 'LH side', 'RH side'] },
                L5: { col: null, question: 'Q-What kind of issue?', options: ['Fitment gap', 'loose fitment', 'Alignment problem', 'damage', 'dent'], appendTo: 'NS' },
                L6: null
            }
        }
    },

    'Fuel related issue': {
        type: 'named',
        items: {
            'Petrol leakage': {
                primaryCol: 'NX',
                keywords: ['petrol leakage', 'fuel leakage'],
                L4: { col: 'NX', question: 'Q-In which Location petrol leakage happening?', openText: true },
                L5: null, L6: null
            },
            'Low fuel tank capacity': {
                primaryCol: 'NY',
                keywords: ['fuel tank capacity', 'tank capacity'],
                L4: { col: 'NY', question: 'Q-Usually how many Kms are Customer using daily?', options: ['Lessthan 50kms', '50 - 100kms', '100 - 150kms', '150 - 200kms', 'morethan 200kms'] },
                L5: { col: null, question: 'Q-Comparing with which competition model?', openText: true, appendTo: 'NY' },
                L6: null
            }
        }
    },

    'Low Boot space': {
        type: 'single',
        primaryCol: 'NZ',
        keywords: ['boot space', 'utility box'],
        question: 'Q-What kind of problem?',
        options: ['Utility box size is small', 'No. of utility box is less'],
        L4: { col: 'NZ', question: 'Q-Comparing with which competition model?', openText: true }
    },

    'Seat issue': {
        type: 'named',
        items: {
            'Seat issue': {
                primaryCol: 'OA',
                keywords: ['seat'],
                L4: { col: 'OA', question: 'Q-What kind of issue?', options: ['Worn-out quickly', 'Tear-off quickly', 'Rider seat not comfortable', 'Pillion seat not comfortable', 'While applying brake seat was slippery'] },
                L5: null, L6: null
            },
            'Wider / Comfortable seat required': {
                primaryCol: 'OB',
                keywords: ['wider seat', 'comfortable seat'],
                L4: { col: 'OB', question: 'Q-Comparing with which competition model?', openText: true },
                L5: null, L6: null
            }
        }
    },

    'Vehicle Pulling problem': {
        type: 'single',
        primaryCol: 'OC',
        keywords: ['vehicle pulling', 'pulling'],
        question: 'Q-In which side?',
        options: ['LH side', 'RH side', 'Both side'],
        L4: { col: 'OD', question: 'Q-Pulling at what speed?', options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph'] }
    },

    'Roof top (soft top) issue': {
        type: 'single',
        primaryCol: 'OE',
        keywords: ['roof top', 'soft top'],
        question: 'Q-What kind of issue?',
        options: ['Worn-out quickly', 'Tear-off quickly', 'less life'],
        L4: { col: 'OF', question: 'Q-Where it is worn-out or tear-off quickly?', options: ['Front portion', 'Middle portion', 'Rear portion'] },
        L5: { col: 'OG', question: 'Q-What is the Life or frequency of change?', options: ['less than 1month', '1-3 months', '3-6 months', 'more than 6 months'] }
    },

    'Wiper problem': {
        type: 'single',
        primaryCol: 'OH',
        keywords: ['wiper'],
        question: 'Q-What kind of problem?',
        options: ['Wiper blade rubber easily worn-out', 'Wiper not working'],
        L4: { col: 'OI', question: 'Q-What is the Life or frequency of change the Wiper blade?', options: ['less than 1month', '1-3 months', '3-6 months', 'more than 6 months'] }
    },

    'Faster issue': {
        type: 'single',
        primaryCol: 'OJ',
        keywords: ['fastener', 'bolt', 'nut', 'screw'],
        question: 'Q-What kind of issue?',
        options: ['Bolt & Nut getting loose frequently', 'Screw missing', 'Misalignment']
    }
};

// ─── 3. Helpers ──────────────────────────────────────────────────────────

// Deterministic PRNG so demo reloads are stable
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

function pickRandom(arr, rng) {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr[Math.floor(rng() * arr.length)];
}

// Is any keyword found in the verbatim? (case-insensitive substring)
function keywordHit(text, keywords) {
    if (!text || !Array.isArray(keywords)) return false;
    for (const k of keywords) {
        if (text.includes(String(k).toLowerCase())) return true;
    }
    return false;
}

// Try to extract one of the valid options from the verbatim text.
// Strips common noise so "morning" matches "Moring time only".
function matchOption(text, options) {
    if (!text || !Array.isArray(options)) return null;
    const t = ' ' + text.toLowerCase() + ' ';

    // direct substring (longest option first so "less than 1000km" beats "less")
    const sorted = [...options].sort((a, b) => b.length - a.length);
    for (const opt of sorted) {
        const o = String(opt).toLowerCase().trim();
        if (o.length < 3) continue;
        if (t.includes(o)) return opt;
        // fuzzy: first two words
        const words = o.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
            const hits = words.filter(w => t.includes(w));
            if (hits.length >= Math.min(2, words.length)) return opt;
        }
    }
    return null;
}

// ─── 4. Main entry point ────────────────────────────────────────────────

/**
 * @param {string[]} verbatims3b  the 5 values from 3b.1..5
 * @param {string[]} verbatims4   the 5 values from 4)1..5
 * @param {object}   aiFollowups  optional AI-provided complaint_followups object
 *                                shaped as { [l2Name]: { [colLetter or l3Name]: value } }
 * @param {number}   seed         deterministic seed (row index) for random fallbacks
 * @returns {{ l2Slots: Record<string,string>,
 *             l3Values: Record<string,string>,
 *             followups: Record<string,string> }}
 */
function mapNegativeDetractors(verbatims3b, verbatims4, aiFollowups, seed) {
    console.log('[NEG] called with seed:', seed);
    console.log('[NEG] 3b:', verbatims3b);
    console.log('[NEG] 4 :', verbatims4);

    const rng = mulberry32(seed == null ? 42 : seed);

    const allText = [
        ...(Array.isArray(verbatims3b) ? verbatims3b : []),
        ...(Array.isArray(verbatims4) ? verbatims4 : [])
    ].filter(Boolean).map(v => String(v).toLowerCase()).join('  ||  ');

    const l2Slots = {};
    const l3Values = {};
    const followups = {};
    const DF = ['DF', 'DG', 'DH', 'DI', 'DJ', 'DK', 'DL', 'DM', 'DN', 'DO', 'DP', 'DQ', 'DR', 'DS', 'DT', 'DU', 'DV', 'DW', 'DX', 'DY', 'DZ', 'EA', 'EB', 'EC', 'ED', 'EE', 'EF', 'EG', 'EH', 'EI', 'EJ', 'EK', 'EL', 'EM'];

    let slotIdx = 0;
    const matchedL2s = [];

    // ── Phase 1: which L2s fire? ──────────────────────────────────────────
    for (const [l2Name, node] of Object.entries(NEGATIVE_TREE)) {
        let fired = false;
        if (node.type === 'named') {
            for (const item of Object.values(node.items)) {
                if (keywordHit(allText, item.keywords || [item])) { fired = true; break; }
            }
        } else {
            if (keywordHit(allText, node.keywords || [])) fired = true;
            // For question-as-L3 (single/split) also try matching options
            if (!fired && node.options) {
                if (matchOption(allText, node.options)) fired = true;
            }
        }
        if (fired) matchedL2s.push(l2Name);
    }

    // ── Phase 2: assign L2s to DF..EM in order ────────────────────────────
    for (const l2Name of matchedL2s) {
        if (slotIdx >= DF.length) break;
        l2Slots[DF[slotIdx++]] = l2Name;
    }

    // ── Phase 3: for each matched L2, fill its L3 / follow-up columns ────
    for (const l2Name of matchedL2s) {
        const node = NEGATIVE_TREE[l2Name];
        const ai = (aiFollowups && aiFollowups[l2Name]) || {};

        if (node.type === 'named') {
            for (const [l3Name, item] of Object.entries(node.items)) {
                if (!keywordHit(allText, item.keywords || [l3Name])) continue;

                // Primary column (enumSplit vs single)
                if (item.enumSplit) {
                    const opt = ai['__option'] || matchOption(allText, item.L4?.options || Object.keys(item.enumColumns)) || pickRandom(Object.keys(item.enumColumns), rng);
                    const col = item.enumColumns[opt];
                    if (col && !l3Values[col]) l3Values[col] = 'Yes';
                } else if (item.primaryCol) {
                    const ans = ai[item.primaryCol] || matchOption(allText, (item.L4 && item.L4.options) || []) || (item.L4 && item.L4.openText ? '' : pickRandom((item.L4 && item.L4.options) || [], rng));
                    if (ans && !l3Values[item.primaryCol]) l3Values[item.primaryCol] = ans;
                }

                // L4 / L5 / L6 follow-ups
                for (const key of ['L4', 'L5', 'L6']) {
                    const fu = item[key];
                    if (!fu) continue;
                    if (fu.openText) {
                        const v = ai[fu.col] || ai[key];
                        if (v && fu.col && !followups[fu.col]) followups[fu.col] = v;
                        continue;
                    }
                    const ans = ai[fu.col] || ai[key] || matchOption(allText, fu.options || []) || pickRandom(fu.options || [], rng);
                    if (!ans) continue;
                    if (fu.col && fu.col !== 'enumSplit') {
                        if (!followups[fu.col]) followups[fu.col] = ans;
                    } else if (fu.appendTo) {
                        // No dedicated column → append into the primary
                        const prev = followups[fu.appendTo] || l3Values[fu.appendTo] || '';
                        const merged = prev ? `${prev}; ${ans}` : ans;
                        if (!l3Values[fu.appendTo]) l3Values[fu.appendTo] = merged;
                    }
                }
            }
        } else if (node.type === 'single') {
            const ans = ai[node.primaryCol] || matchOption(allText, node.options) || pickRandom(node.options, rng);
            if (ans && !l3Values[node.primaryCol]) l3Values[node.primaryCol] = ans;
            if (node.L4) {
                if (node.L4.openText) {
                    const v = ai[node.L4.col];
                    if (v && node.L4.col && !followups[node.L4.col]) followups[node.L4.col] = v;
                } else {
                    const a = ai[node.L4.col] || matchOption(allText, node.L4.options) || pickRandom(node.L4.options, rng);
                    if (a && node.L4.col && !followups[node.L4.col]) followups[node.L4.col] = a;
                }
            }
        } else if (node.type === 'split') {
            const opt = ai['__option'] || matchOption(allText, node.options) || pickRandom(node.options, rng);
            const col = node.enumColumns[opt];
            if (col && !l3Values[col]) l3Values[col] = 'Yes';
            if (node.L4) {
                const a = ai[node.L4.col] || matchOption(allText, node.L4.options) || pickRandom(node.L4.options, rng);
                if (a && node.L4.col && !followups[node.L4.col]) followups[node.L4.col] = a;
            }
        }
    }

    return { l2Slots, l3Values, followups };
}

module.exports = {
    NEGATIVE_TREE,
    ISSUE_COLUMN_RANGE_MAPPING,
    mapNegativeDetractors,
    mulberry32
};