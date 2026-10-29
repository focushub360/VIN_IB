// QcDropdownTree.ts
// ─────────────────────────────────────────────────────────────
// Hand-built from product.xlsx (questions + options) and
// header.xlsx (actual expanded column names).
//
// Rules applied:
//  • For every L3 question that has options, list the actual
//    header names from header.xlsx that belong to it.
//  • For every L4 question, list the actual header names.
//  • For every L5 question, list the actual header names.
//  • For every L6 question, list the actual header names.
//  • For split columns (e.g. "Head light [DC headlamp]"),
//    put the L5 options on the split column (that's the
//    question the inspector actually fills in for that cell).
// ─────────────────────────────────────────────────────────────
import { GUINEA_COLUMNS_449 } from '../guineaSchema';


// Helper: resolve "EP" → "Front brake noise" using the schema
const L = (letter: string): string => {
    let n = 0;
    for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
    return GUINEA_COLUMNS_449[n - 1] || '';
};

// Helper: spread from a start letter across N consecutive columns
const spread = (start: string, count: number): string[] => {
    let n = 0;
    for (let i = 0; i < start.length; i++) n = n * 26 + (start.charCodeAt(i) - 64);
    const out: string[] = [];
    for (let k = 0; k < count; k++) {
        const hdr = GUINEA_COLUMNS_449[n - 1 + k];
        if (hdr) out.push(hdr);
    }
    return out;
};

// ─────────────────────────────────────────────────────────────
// The new tree: for each L2, an array of { cols, options } blocks.
//  • cols: the actual header names from header.xlsx
//  • options: the actual options from product.xlsx
// ─────────────────────────────────────────────────────────────
export interface QcDropdownBlock {
    cols: string[];
    options: string[];
}

export const QC_DROPDOWN_TREE: Record<string, QcDropdownBlock[]> = {
    // ─────────────────────────────────────────────────────────
    // BRAKE
    // ─────────────────────────────────────────────────────────
    'Brake issues': [
        {
            cols: [L('EP')], // Front brake noise
            options: ['Moring time only', 'All time brake noise']
        },
        {
            cols: [L('EQ')], // Front brake poor
            options: ['Lever touching accelerator', 'Lever play loose', 'Stopping distance is high', 'Brake shoe quick wear', 'Disc pad quick wear']
        },
        {
            cols: [L('ER')], // Front Brake tight
            options: ['Lever play tight', 'hard to apply brake']
        },
        {
            cols: [L('ES')], // Rear brake noise
            options: ['Moring time only', 'All time brake noise']
        },
        {
            cols: [L('ET')], // Rear brake poor
            options: ['Pedal not return', 'Lever play loose', 'Stopping distance is high', 'Brake shoe quick wear', 'Disc pad quick wear']
        },
        {
            cols: [L('EU')], // Rear brake tight
            options: ['Lever play tight', 'hard to apply brake']
        },
        {
            // ABS Not working → EV is primary, but split by "where" (Front/Rear) is L4
            // header has "ABS Not working" (EV) → L5 "Any oil leakage in cylinder" on EV
            cols: [L('EV')],
            options: ['Yes', 'No']
        },
        {
            cols: [L('EW')], // Hand brake poor
            options: ['Hand brake slippage', 'not working']
        },
        {
            // Brake poor → EX (L5 "Any oil leakage" on EX)
            cols: [L('EX')],
            options: ['Yes', 'No']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // CABLE
    // ─────────────────────────────────────────────────────────
    'Cable issues': [
        {
            cols: [L('EY'), L('EZ')], // Clutch cable [less life], [Cable breakage]
            options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms']
        },
        {
            cols: [L('FA'), L('FB')], // Brake cable [less life], [Cable breakage]
            options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms']
        },
        {
            cols: [L('FC'), L('FD')], // Speedo cable [less life], [Cable breakage]
            options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // CHAIN
    // ─────────────────────────────────────────────────────────
    'Chain issue': [
        {
            cols: [L('FE')],
            options: ['Chain noise', 'Chain loose', 'Chain Tight']
        }
    ],
    'Chain case issue': [
        {
            cols: [L('FF')],
            options: ['Chain case rust', 'Chain case damage', 'Chain case broken', 'Chain case less life']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // CLUTCH
    // ─────────────────────────────────────────────────────────
    'Clutch issues': [
        {
            cols: [L('FG')], // Clutch loose (Remarks) → open text
            options: []
        },
        {
            cols: [L('FH')], // Clutch Noise
            options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph']
        },
        {
            cols: [L('FI')], // Clutch hard
            options: ['Lever Play Low', 'Hard to operate clutch lever']
        },
        {
            cols: [L('FJ'), L('FK')], // Clutch life is low [wear]/[burning]
            options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // ELECTRICAL
    // ─────────────────────────────────────────────────────────
    'Electrical issues': [
        {
            cols: [L('FL')], // What is the issue in speedometer?
            options: [
                'Speed is not showing', 'Odometer not working', 'fuel indication issue',
                'Water entry in display', 'Speedometer display crack',
                'Neutral indication not working', 'Service reminder',
                'Low Battery symbol display', 'Engine warning temperature',
                'Side stand symbol', 'Mode not changing', 'Bluetooth not connecting',
                'MIL glowing', 'ABS lamp continously glowing',
                'Neutral wrong indication', 'Gear position wrong indication'
            ]
        },
        {
            // TSL (Indicator) split columns → L5 side options
            cols: [L('FM'), L('FN'), L('FO'), L('FP')],
            options: ['Front LH side', 'Front RH side', 'Front both side', 'Rear LH side', 'Rear RH side', 'Rear both side']
        },
        {
            // Head light split → L5 "What kind of issue?"
            cols: [L('FQ'), L('FR')],
            options: ['Low intensity', 'Focus not Ok', 'High beam not working', 'Low beam not working', 'Both high and low beam not working', 'Pass by not working', 'Water entry in headlamp', 'Low headlamp brightness']
        },
        {
            // Tail lamp split → L5 "What was the problem?"
            cols: [L('FS'), L('FT')],
            options: ['not working', 'water entry']
        },
        {
            cols: [L('FU')], // Horn issues
            options: ['Not working', 'low sound', 'change in tone', 'intermittent working']
        },
        {
            cols: [L('FV')], // Switch problem
            options: ['Self start switch', 'High or low beam switch', 'Pass by switch', 'Indicator switch', 'Kill switch', 'Hazard switch']
        },
        {
            // Locks not working split → L5 "What was the problem?"
            cols: [L('FW'), L('FX'), L('FY')],
            options: ['Hard', 'Loose', 'Stuckup', 'sometimes not working']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // ENGINE
    // ─────────────────────────────────────────────────────────
    'Engine issues': [
        {
            // Engine noise split → L5 speed range
            cols: [L('FZ'), L('GA'), L('GB')],
            options: ['Idling', 'constant speed']
        },
        {
            cols: [L('GC')], // Engine oil leak
            options: ['Cylinder head', 'Engine bottom drain hole', 'Oil cooler', 'clutch side', 'Magneto side', 'chain sprocket side', 'Unknown']
        },
        {
            // Engine Heat split → L5 "where it is?"
            cols: [L('GD'), L('GE'), L('GF')],
            options: ['Foot', 'knee', 'Thigh', 'Seat', 'All']
        },
        {
            cols: [L('GG')], // Engine parts rust → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // GEAR
    // ─────────────────────────────────────────────────────────
    'Gear issues': [
        {
            // Gear noise split → L5 gear condition
            cols: [L('GH'), L('GI'), L('GJ')],
            options: ['N-1', '1-2', '2-3', '3-4', '4-5', 'All Gears', '1-N', '2-1', '3-2', '4-3', '5-4']
        },
        {
            // Gear shifting hard split → L5 gear condition
            cols: [L('GK'), L('GL'), L('GM')],
            options: ['N-1', '1-2', '2-3', '3-4', '4-5', 'All Gears', '1-N', '2-1', '3-2', '4-3', '5-4']
        },
        {
            cols: [L('GN')], // Not Coming to Neutral
            options: ['Stuck up', 'indication not showing properly']
        },
        {
            cols: [L('GO')], // Additional gear required → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // HANDLE BAR
    // ─────────────────────────────────────────────────────────
    'Handle Bar issues': [
        {
            // Handle bar noise split → L5 speed
            cols: [L('GP'), L('GQ'), L('GR'), L('GS')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            // Handle bar loose/tight/jam split (GT..HE, 12 cols) → L5 speed
            cols: [L('GT'), L('GU'), L('GV'), L('GW'), L('GX'), L('GY'), L('GZ'), L('HA'), L('HB'), L('HC'), L('HD'), L('HE')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            // The duplicated handle bar jam columns HF..HI → L5 speed
            cols: [L('HF'), L('HG'), L('HH'), L('HI')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            // handle bar bend [Yes/No] → L5 "Is vehicle fall down?"
            cols: [L('HJ'), L('HK')],
            options: ['Yes', 'No']
        },
        {
            // Handle Bar shaking split → L4 speed
            cols: [L('HL'), L('HM'), L('HN')],
            options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph']
        },
        {
            // Handle bar vibration split → L5 speed
            cols: [L('HO'), L('HP'), L('HQ')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // KICKER
    // ─────────────────────────────────────────────────────────
    'Kicker issues': [
        {
            cols: [L('HR')], // Kicker issues → L4 "What kind of issue?"
            options: ['Difficult to kick', 'Kick stuck', 'Kick not returning']
        },
        {
            cols: [L('HS')], // If Kicker is hard
            options: ['Difficult to kick', 'Kick stuck', 'Kick not returning']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // LOW MILEAGE
    // ─────────────────────────────────────────────────────────
    'Low Mileage': [
        {
            cols: [L('HT')], // Q-What mileage are you getting?
            options: ['less than 20km', '20-30km', '30-40km', '40-50km', 'more than 50km']
        },
        {
            cols: [L('HU')], // Q-What is your average Speed using regularly?
            options: ['Less than 50kmph', '50 - 60kmph', '60 - 70kmph', '70 - 80kmph', 'more than 80kmph']
        },
        {
            cols: [L('HV')], // Q-What kind of traffic are you mostly using?
            options: ['More traffic', 'less traffic']
        },
        {
            cols: [L('HW')], // Usually how many passenger will travel?
            options: ['1', '2', 'more than 2']
        },
        {
            // Usually how much Load are you carry? (5 cols)
            cols: [L('HX'), L('HY'), L('HZ'), L('IA'), L('IB')],
            options: ['less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // LOW SPEED
    // ─────────────────────────────────────────────────────────
    'Low Speed': [
        {
            cols: [L('HY')], // Low Speed (Q-What is top speed...)
            options: ['less than 50kmph', '50-60kmph', '60-70kmph', '70-80kmph', '80-90kmph', '90-100kmph', 'morethan 100kmph']
        },
        {
            cols: [L('HZ')], // What is the top speed are you Expecting? → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // MUFFLER
    // ─────────────────────────────────────────────────────────
    'Muffler issues': [
        {
            // Muffler Noise split → L5 road condition
            cols: [L('IA'), L('IB')],
            options: ['Rough road', 'plain road']
        },
        {
            // Muffler smoke more split → L5 when happening
            cols: [L('IC'), L('ID')],
            options: ['Idling speed', 'While running']
        },
        {
            cols: [L('IE')], // Muffler Rust → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // STARTING TROUBLE
    // ─────────────────────────────────────────────────────────
    'Starting trouble': [
        {
            // Self start problem split → L5 when happening
            cols: [L('IF'), L('IG'), L('IH')],
            options: ['Morning time', 'During long parking', 'Not starting after driving few km']
        },
        {
            cols: [L('II')], // Kick start problem
            options: ['Takes too many kicks', 'Kick hard']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // SUSPENSION
    // ─────────────────────────────────────────────────────────
    'Suspension issues': [
        {
            // Front suspension Noise split → L5 noise speed
            cols: [L('IJ'), L('IK'), L('IL'), L('IM')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('IN')], // Oil leak from front suspension → no options
            options: []
        },
        {
            // Front suspension Hard → L4 passenger/load
            cols: [L('IO'), L('IP')],
            options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('IQ')], // How frequently you fill air in Tyre?
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            cols: [L('IR'), L('IS')], // Front suspension Soft → passenger/load
            options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('IT')], // Front suspension Soft air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            cols: [L('IU'), L('IV')], // Rear suspension Hard → passenger/load
            options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('IW')], // Rear suspension Hard air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            cols: [L('IX'), L('IY')], // Rear suspension Soft → passenger/load
            options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('IZ')], // Rear suspension Soft air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            // Rear suspension Noise split → L5 noise speed
            cols: [L('JA'), L('JB'), L('JC'), L('JD')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // VEHICLE NOISE
    // ─────────────────────────────────────────────────────────
    'Vehicle noise': [
        {
            // Front side noise (9 cols) → L5 noise speed
            cols: [L('JE'), L('JF'), L('JG'), L('JH'), L('JI'), L('JJ'), L('JK'), L('JL'), L('JM')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('JN')], // Front side noise road condition
            options: ['Rough road', 'plain road']
        },
        {
            // Rear side noise (8 cols) → L5 noise speed
            cols: [L('JO'), L('JP'), L('JQ'), L('JR'), L('JS'), L('JT'), L('JU'), L('JV')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('JW')], // Rear side noise road condition
            options: ['Rough road', 'plain road']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // VIBRATION
    // ─────────────────────────────────────────────────────────
    'Vibration': [
        {
            // Front side vibration (7 cols) → L5 vibration speed
            cols: [L('JX'), L('JY'), L('JZ'), L('KA'), L('KB'), L('KC'), L('KD')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('KE')], // Front side vibration road condition
            options: ['Rough road', 'plain road']
        },
        {
            // Rear side vibration (5 cols) → L5 vibration speed
            cols: [L('KF'), L('KG'), L('KH'), L('KI'), L('KJ')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('KK')], // Rear side vibration road condition
            options: ['Rough road', 'plain road']
        },
        {
            // Foot rest vibration (3 cols) → L5 vibration speed
            cols: [L('KL'), L('KM'), L('KN')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // MIRROR
    // ─────────────────────────────────────────────────────────
    'Mirror issues': [
        {
            // Mirror loose (3 cols) → L4 side is the split → L5 speed
            cols: [L('KO'), L('KP'), L('KQ')],
            options: ['Less than 20km', '20 - 40km', '40 - 50km', '50 - 60km', '60 - 70km', '70 - 80km', 'morethan 80kms']
        },
        {
            cols: [L('KR')], // Mirror small size → open text
            options: []
        },
        {
            cols: [L('KS')], // Mirror small size - customer expectation → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // WHEEL / TYRE
    // ─────────────────────────────────────────────────────────
    'Wheel/Tyre issues': [
        {
            // Front wheel noise (3 cols) → L5 road condition
            cols: [L('KT'), L('KU'), L('KV')],
            options: ['Rough road', 'plain road']
        },
        {
            // Front wheel wobbling (3 cols) → L5 road condition
            cols: [L('KW'), L('KX'), L('KY')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('KZ')], // Front wheel wobbling air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            // Front tyre skidding (3 cols) → L5 road condition
            cols: [L('LA'), L('LB'), L('LC')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('LD')], // Front wheel skidding air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            // Front tyre weak/less life (6 cols) → L5 road condition
            cols: [L('LE'), L('LF'), L('LG'), L('LH'), L('LI'), L('LJ')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('LK')], // Front tyre weak air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            cols: [L('LL')], // Front wheel tight → no options
            options: []
        },
        {
            cols: [L('LM')], // Front widder tyre required → open text
            options: []
        },
        {
            // Rear wheel noise (3 cols) → L5 road condition
            cols: [L('LN'), L('LO'), L('LP')],
            options: ['Rough road', 'plain road']
        },
        {
            // Rear wheel wobbling (3 cols) → L5 road condition
            cols: [L('LQ'), L('LR'), L('LS')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('LT')], // Rear wheel wobbling air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            // Rear tyre skidding (3 cols) → L5 road condition
            cols: [L('LU'), L('LV'), L('LW')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('LX')], // Rear wheel skidding air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            // Rear tyre weak/less life (6 cols) → L5 road condition
            cols: [L('LY'), L('LZ'), L('MA'), L('MB'), L('MC'), L('MD')],
            options: ['Rough road', 'plain road']
        },
        {
            cols: [L('ME')], // Rear tyre weak air freq
            options: ['Daily', '4 times a week', '3 times a week', '2 times a week', 'Once in a week', 'Once in 2 week', 'Monthly']
        },
        {
            cols: [L('MF')], // Rear wheel tight → no options
            options: []
        },
        {
            cols: [L('MG')], // Rear widder tyre required → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // BATTERY
    // ─────────────────────────────────────────────────────────
    'Battery issues': [
        {
            // Battery issues split (3 cols) → L5 Life or frequency
            cols: [L('MH'), L('MI'), L('MJ')],
            options: ['less than 1000km', '1000-5000km', '5000-10000km', '10000-15000km', '15000-20000km', 'more than 20000 kms']
        },
        {
            cols: [L('MK')], // Which brand battery in the vehicle?
            options: ['Exide', 'Amron', 'Amco', 'TATA green']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // JERKING
    // ─────────────────────────────────────────────────────────
    'Jerking issues': [
        {
            // Jerking split (2 cols: Cold/hot) → L4 condition (Cold/hot)
            cols: [L('ML'), L('MM')],
            options: ['Cold condition', 'hot condition']
        },
        {
            cols: [L('MN')], // If vehicle get Jerking in specific gear?
            options: ['Yes', 'No']
        },
        {
            cols: [L('MO')], // If previous is yes, which gear?
            options: ['1st gear', '2nd gear', '3rd gear', '4th gear', '5th gear']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // PART NOT AVAILABLE
    // ─────────────────────────────────────────────────────────
    'Part not available': [
        {
            cols: [L('MP')], // Which part not available? → open text
            options: []
        },
        {
            cols: [L('MQ')], // In which Location it is not available? → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // PICK-UP PROBLEM
    // ─────────────────────────────────────────────────────────
    'Pick-up problem': [
        {
            // 5 speed columns → L4 condition (Cold/hot)
            cols: [L('MR'), L('MS'), L('MT'), L('MU'), L('MV')],
            options: ['Cold condition', 'hot condition']
        },
        {
            cols: [L('MW')], // Usually how many passenger will travel?
            options: ['1', '2', 'more than 2']
        },
        {
            // Usually how much Load are you carry? (5 cols)
            cols: [L('MX'), L('MY'), L('MZ'), L('NA'), L('NB')],
            options: ['less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('NC'), L('ND'), L('NE'), L('NF'), L('NG'), L('NH'), L('NI')], // Running off cols aren't part of pick-up
            options: []
        },
        {
            cols: [L('NP')], // Q-What kind of road condition? → Wrong column, skip
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // RUNNING OFF
    // ─────────────────────────────────────────────────────────
    'Running off': [
        {
            // 7 split columns → L4 condition
            cols: [L('NC'), L('ND'), L('NE'), L('NF'), L('NG'), L('NH'), L('NI')],
            options: ['Vehicle running off in morning', 'after heating the engine', 'any time']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // THROTTLE / ACCELERATOR
    // ─────────────────────────────────────────────────────────
    'Throttle/Accelerator issue': [
        {
            cols: [L('NJ')],
            options: ['Accelearator hard', 'Accelearator loose', 'RPM auto rasing']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // VEHICLE BODY PARTS
    // ─────────────────────────────────────────────────────────
    'Vehicle body parts issue': [
        {
            cols: [L('NK'), L('NL')], // Low ground clearance passenger/load
            options: ['1', '2', 'more than 2', 'less than 50kg', '50 - 100kg', '100 - 150kg', '150 - 200kg', 'more than 200kg']
        },
        {
            cols: [L('NM'), L('NN')], // Low ground clearance road condition
            options: ['Rough road', 'plain road']
        },
        {
            // Stand Problem split → L5 issue
            cols: [L('NO'), L('NP'), L('NQ')],
            options: ['Loose', 'tight', 'Returnability']
        },
        {
            cols: [L('NR')], // Paint issue
            options: ['Paint peel off', 'Paint faded', 'Paint scratch']
        },
        {
            // Panel issue split → L5 issue
            cols: [L('NS'), L('NT'), L('NU'), L('NV'), L('NW')],
            options: ['Fitment gap', 'loose fitment', 'Alignment problem', 'damage', 'dent']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // FUEL RELATED
    // ─────────────────────────────────────────────────────────
    'Fuel related issue': [
        {
            cols: [L('NX')], // Petrol leakage → open text
            options: []
        },
        {
            cols: [L('NY')], // Low fuel tank capacity → L4 daily kms
            options: ['Lessthan 50kms', '50 - 100kms', '100 - 150kms', '150 - 200kms', 'morethan 200kms']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // LOW BOOT SPACE
    // ─────────────────────────────────────────────────────────
    'Low Boot space': [
        {
            cols: [L('NZ')],
            options: ['Utility box size is small', 'No. of utility box is less']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // SEAT
    // ─────────────────────────────────────────────────────────
    'Seat issue': [
        {
            cols: [L('OA')],
            options: ['Worn-out quickly', 'Tear-off quickly', 'Rider seat not comfortable', 'Pillion seat not comfortable', 'While applying brake seat was slippery']
        },
        {
            cols: [L('OB')], // Wider/comfortable seat → open text
            options: []
        }
    ],

    // ─────────────────────────────────────────────────────────
    // VEHICLE PULLING
    // ─────────────────────────────────────────────────────────
    'Vehicle Pulling problem': [
        {
            cols: [L('OC')],
            options: ['LH side', 'RH side', 'Both side']
        },
        {
            cols: [L('OD')],
            options: ['less than 25 kmph', '25-50 kmph', 'more than 50 kmph']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // ROOF TOP
    // ─────────────────────────────────────────────────────────
    'Roof top (soft top) issue': [
        {
            cols: [L('OE')],
            options: ['Worn-out quickly', 'Tear-off quickly', 'less life']
        },
        {
            cols: [L('OF')],
            options: ['Front portion', 'Middle portion', 'Rear portion']
        },
        {
            cols: [L('OG')],
            options: ['less than 1month', '1-3 months', '3-6 months', 'more than 6 months']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // WIPER
    // ─────────────────────────────────────────────────────────
    'Wiper problem': [
        {
            cols: [L('OH')],
            options: ['Wiper blade rubber easily worn-out', 'Wiper not working']
        },
        {
            cols: [L('OI')],
            options: ['less than 1month', '1-3 months', '3-6 months', 'more than 6 months']
        }
    ],

    // ─────────────────────────────────────────────────────────
    // FASTER
    // ─────────────────────────────────────────────────────────
    'Faster issue': [
        {
            cols: [L('OJ')],
            options: ['Bolt & Nut getting loose frequently', 'Screw missing', 'Misalignment']
        }
    ]
};

// ─────────────────────────────────────────────────────────────
// Build the flat lookup (header name → options) for QcDataCheck
// ─────────────────────────────────────────────────────────────
export const QC_FOLLOWUP_OPTIONS: Record<string, string[]> = {};
Object.values(QC_DROPDOWN_TREE).forEach(blocks => {
    blocks.forEach(b => {
        if (!b.options || b.options.length === 0) return;
        b.cols.forEach(col => {
            if (col && !QC_FOLLOWUP_OPTIONS[col]) {
                QC_FOLLOWUP_OPTIONS[col] = b.options;
            }
        });
    });
});