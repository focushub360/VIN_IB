require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('stream');
const sequelize = require('./database');
const User = require('./models/User');
const Inspection = require('./models/Inspection');
const UploadedFile = require('./models/UploadedFile');
const SavedReference = require('./models/SavedReference');
const SurveyResponse = require('./models/SurveyResponse');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { GUINEA_COLUMNS_449, GUINEA_COLUMN_DEFS, orderColumns, orderColumnNames } = require('./guineaSchema');
const { POSITIVE_DRIVER_L2_TO_L3, mapPositiveDrivers } = require('./shared/positiveDrivers');
const { mapNegativeDetractors } = require('./shared/negativeDetractors');
const { mapWorkshopDrivers } = require('./shared/workshopDrivers');


const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'vin-inspector-secret-key';

// ============================================================
// Page 2 / Page 3 auto-fill pools (3 variants x 3 distinct items)
// ============================================================
const WORKSHOP_3A_POOLS = [
    [
        "Resolving the reported issues in First Time Right",   // Resolution of Problem
        "Skilled technicians available in workshop",            // Skilled Manpower
        "Quick job card opening"                                // Waiting Time
    ],
    [
        "Service adviser listened attentively",                 // Service Adviser Behavior
        "Reasonable cost with clear explanation",               // Cost & Explanation
        "Pick up & drop facility available"                     // Workshop Facilities
    ],
    [
        "Comfortable customer lounge with AC",                  // Customer Lounge Amenities
        "Easy warranty process",                                // Warranty Policy
        "Proper washing done"                                   // Washing Quality
    ]
];

const WORKSHOP_3B_POOLS = [
    [
        "More waiting at job card opening",                     // Waiting Time
        "Invoice not explained properly",                       // Cost & Explanation
        "Vehicle not washed properly"                           // Washing Quality
    ],
    [
        "Service adviser was not listening",                    // Service Adviser Behavior
        "Warranty not given in warranty period",                // Warranty Policy
        "Pick up & drop facility not available"                 // Workshop Facilities
    ],
    [
        "Repetition of issues since last service",              // Resolution of Problem
        "Sunday opening not available",                         // Operating Hours
        "Comfortable seating not available in lounge"           // Customer Lounge Amenities
    ]
];

const WORKSHOP_4_POOLS = [
    [
        "Technicians not skilled enough",                       // Skilled Manpower
        "Spare parts not available at workshop",                // Parts availability
        "Delivery not on promised time"                         // Waiting Time
    ],
    [
        "Issues not resolved even after repeated visits",       // Resolution of Problem
        "Overcharging compared to invoice",                     // Cost & Explanation
        "Service adviser behaved rudely"                        // Service Adviser Behavior
    ],
    [
        "Polishing not done after wash",                        // Washing Quality
        "Asked money for warranty replacement",                 // Warranty Policy
        "Express service not available"                         // Workshop Facilities
    ]
];

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '176mxEbMqKmO86oV4_xMlCr_kxNhn7Y1a';

let oAuth2Client = null;

function getOAuthClient() {
    if (!oAuth2Client) {
        oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    }
    return oAuth2Client;
}

async function uploadBufferToDrive(buffer, fileName, mimeType = 'image/jpeg') {
    const auth = getOAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    try {
        // 1. Upload file
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [DRIVE_FOLDER_ID]
            },
            media: {
                mimeType,
                body: Readable.from(buffer)
            },
            fields: 'id, webViewLink'
        });

        const fileId = response.data.id;

        // 2. Make file publicly readable (so frontend can view it)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        return `https://drive.google.com/file/d/${fileId}/view`;

    } catch (error) {
        console.error(`Drive upload failed for ${fileName}:`, error.message);
        throw error;
    }
}

// A5 a–j shared value set
const A5_SHARED_SET = ['Yes', 'No', 'OK', 'Not OK'];

// Pick `n` distinct random items from an array (no repeats within the row)
function pickDistinct(arr, n) {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length > 0) {
        const i = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(i, 1)[0]);
    }
    return out;
}

// Deterministic 3-variant selection based on record index
function workshopPools(index) {
    const v = Math.abs(index) % 3;
    return {
        a: WORKSHOP_3A_POOLS[v],
        b: WORKSHOP_3B_POOLS[v],
        c: WORKSHOP_4_POOLS[v]
    };
}

// A5 a–j: use AI value if present, otherwise random from shared set
function buildA5Fields(row = {}) {
    const pick = () => A5_SHARED_SET[Math.floor(Math.random() * A5_SHARED_SET.length)];
    const orPick = (k) => row[k] || pick();
    return {
        'a) Have you received Service reminder call': orPick('process_reminder_call'),
        'b) Appointment given': orPick('process_appointment_given'),
        'c) Vehicle test drive taken while making job cards to understand the complaints': orPick('process_test_drive_jobcard'),
        'd) Customer lounge Facilities': orPick('process_customer_lounge'),
        'e) Staff behaviour': orPick('process_staff_behavior'),
        'f) All complaints reported are resolved': orPick('process_complaints_resolved'),
        'g) Fairness of charges': orPick('process_fairness_charges'),
        'h) Explanation of Work done': orPick('process_explanation_work'),
        'i) Washing quality': orPick('process_washing_quality'),
        'j) Test drive offered before billing': orPick('process_test_drive_before_billing')
    };
}

// A6–A11: keep AI values, randomize only missing; A6=No forces A7/A8='—'
function buildA6ToA11Fields(row = {}) {
    const yesNo = () => (Math.random() < 0.5 ? 'Yes' : 'No');
    const a6 = row['post_service_vps_satisfied'] || yesNo();
    let a7, a8;
    if (a6 === 'Yes') {
        a7 = row['post_service_issues_facing'] || yesNo();
        a8 = row['post_service_reported_advisor'] || yesNo();
    } else {
        a7 = '—';
        a8 = '—';
    }
    const a9 = row['post_service_first_time_right'] || yesNo();
    const a10 = row['post_service_delivery_promised_time'] || yesNo();
    const a11Raw = row['workshop_overall_rating_A11'];
    const a11 = (a11Raw != null && !isNaN(Number(a11Raw)))
        ? Number(a11Raw)
        : [8, 9, 10][Math.floor(Math.random() * 3)];
    return {
        'A6. Are you satisfied with Vehicle Performance after service? (VPS)': a6,
        'A7. Currently are you facing any issues / complaints in vehicle? No of customer not satisfied with vehicle performance after service': a7,
        'A8. Have you reported this issue to the Service advisor during Job card making during your last Visit?': a8,
        'A9. Fixing problems First Time Right': a9,
        'A10. Delivery as per promised time': a10,
        'A11. Overall, how satisfied are you with your experience at our workshop/dealership for servicing your vehicle? (Please rate your satisfaction on a scale of “0 to 10”)': a11
    };
}

// ============================================================
// B-track (Service Satisfaction — alternative to A-track)
// Fills only when the AI extracted at least one B reason.
// If B has 1 reason → auto-fill the other 2 (distinct).
// If B has 0 reasons → return {} (leave B empty, A-track stays).
// ============================================================
const B_REASON_POOLS = [
    ["Far location", "Long waiting time", "High charges"],
    ["No pickup & drop", "Limited service hours", "Unclear billing"],
    ["Poor communication", "No online booking", "Less service bays"]
];
function buildBFields(row = {}, index = 0) {
    // Accept multiple possible key spellings from the AI
    const pickB = (n) => String(
        row[`B${n}_reason`]
        || row[`b${n}_reason`]
        || row[`reason${n}`]
        || row[`B${n}`]
        || row[`B${n}. Reason for not choosing the Authorized Service Centers?`]
        || ''
    ).trim();

    const aiB1 = pickB(1);
    const aiB2 = pickB(2);
    const aiB3 = pickB(3);

    const aiScoreRaw =
        row['B2_quality_score']
        || row['b2_quality_score']
        || row['quality_score']
        || row['B2. How would you rate the quality of Authorized service center? (Choose any score from 1 - 10, "1 means worst, 10 means best")'];
    const aiScoreNum = (aiScoreRaw != null && !isNaN(Number(aiScoreRaw))) ? Number(aiScoreRaw) : null;

    // If AI found NO B field at all → not a B-survey row, leave B empty
    const anyB = Boolean(aiB1 || aiB2 || aiB3 || aiScoreNum != null);
    if (!anyB) return {};

    const variant = Math.abs(index) % 3;
    const pool = B_REASON_POOLS[variant];

    const used = new Set([aiB1, aiB2, aiB3].filter(Boolean));
    const pickMissing = () => {
        for (const candidate of pool) {
            if (!used.has(candidate)) { used.add(candidate); return candidate; }
        }
        return pool[0];
    };

    const finalB1 = aiB1 || pickMissing();
    const finalB2 = aiB2 || pickMissing();
    const finalB3 = aiB3 || pickMissing();

    const quality = aiScoreNum != null
        ? aiScoreNum
        : [8, 9, 10][Math.floor(Math.random() * 3)];

    return {
        'B1. Reason for not choosing the Authorized Service Centers?': finalB1,
        'B2. Reason for not choosing the Authorized Service Centers?': finalB2,
        'B3. Reason for not choosing the Authorized Service Centers?': finalB3,
        'B2. How would you rate the quality of Authorized service center? (Choose any score from 1 - 10, "1 means worst, 10 means best")': quality,
        __isBSurvey: true
    };
}
// ============================================================
// Page 3 — TVS Genuine Spare Parts (C1–C4 scores + C5 reasons)
// 3 variants × 5 distinct C5 reasons
// ============================================================
// ============================================================
// Page 3 — TVS Genuine Spare Parts (C1–C4 scores + C5 reasons)
// ============================================================
const C5_REASON_POOLS = [
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

function buildCFields(row = {}, index = 0) {
    const variant = Math.abs(index) % 3;
    const pool = C5_REASON_POOLS[variant];

    const rnd = () => [8, 9, 10][Math.floor(Math.random() * 3)];

    const c1 = rnd();
    const c2 = rnd();
    const c3 = rnd();
    const c4 = rnd();


    const aiC5 = String(
        row['spare_parts_reason_C5']
        || row['1-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?']
        || ''
    ).trim();

    const used = new Set();
    if (aiC5) used.add(aiC5);

    const pickMissing = () => {
        for (const candidate of pool) {
            if (!used.has(candidate)) { used.add(candidate); return candidate; }
        }
        for (const candidate of C5_REASON_POOLS[(variant + 1) % 3]) {
            if (!used.has(candidate)) { used.add(candidate); return candidate; }
        }
        return pool[0];
    };

    const c5 = [];
    c5.push(aiC5 || pickMissing());
    for (let k = 1; k < 5; k++) c5.push(pickMissing());

    return {
        'C1. Will you recommend / tell / advise your friends, colleague or fellow rider’s for TVS Genuine Spare Parts? (9 & 10 means “you will definitely recommend”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”) You can choose a': c1,
        'C2. How satisfied are you with the availability of TVS Genuine Spare Parts when you need them? (9 & 10 means “Extremely Satisfied”, 7 & 8 means “Satisfied”, 6 and below means “Not Satisfied”) You can choose any score between 0 and 10. So which score would': c2,
        'C3. How satisfied are you with the quality of TVS Genuine Spare Parts? (9 & 10 means “Extremely Satisfied”, 7 & 8 means “Satisfied”, 6 and below means “Not Satisfied”) You can choose any score between 0 and 10. So which score would you like to give? (Tick': c3,
        'C4. How satisfied are you with the value for money of TVS Genuine Spare Parts? (9 & 10 means “Extremely Satisfied”, 7 & 8 means “Satisfied”, 6 and below means “Not Satisfied”) You can choose any score between 0 and 10. So which score would you like to giv': c4,
        '1-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?': c5[0],
        '2-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?': c5[1],
        '3-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?': c5[2],
        '4-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?': c5[3],
        '5-C5. What is the primary reason for the above rating (in “Ques: C1”) you given for TVS Genuine Spare Parts?': c5[4]
    };
}
// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'VIN_IB Inspector API is running' });
});

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
    }
});
const upload = multer({
    storage,
    limits: {
        fieldSize: 100 * 1024 * 1024, // 100MB for large stringified JSON fields (like 449-column survey rows)
        fileSize: 100 * 1024 * 1024   // 100MB for uploaded files
    }
});

// ============================================================
// Common Master Data: Regions, Countries, IB Versions
// ============================================================
const REGIONS = [
    { id: 1, name: 'Africa' },
    { id: 2, name: 'Asia' },
    { id: 3, name: 'Latin America' },
    { id: 4, name: 'Middle East' }
];

const COUNTRIES = [
    { id: 1, name: 'Guinea', region_id: 1, region_name: 'Africa' },
    { id: 2, name: 'Nigeria', region_id: 1, region_name: 'Africa' },
    { id: 3, name: 'Kenya', region_id: 1, region_name: 'Africa' },
    { id: 4, name: 'Ghana', region_id: 1, region_name: 'Africa' },
    { id: 5, name: 'Egypt', region_id: 1, region_name: 'Africa' },
    { id: 6, name: 'India', region_id: 2, region_name: 'Asia' },
    { id: 7, name: 'Indonesia', region_id: 2, region_name: 'Asia' },
    { id: 8, name: 'Philippines', region_id: 2, region_name: 'Asia' },
    { id: 9, name: 'Vietnam', region_id: 2, region_name: 'Asia' },
    { id: 10, name: 'Mexico', region_id: 3, region_name: 'Latin America' },
    { id: 11, name: 'Brazil', region_id: 3, region_name: 'Latin America' },
    { id: 12, name: 'Colombia', region_id: 3, region_name: 'Latin America' },
    { id: 13, name: 'UAE', region_id: 4, region_name: 'Middle East' },
    { id: 14, name: 'Saudi Arabia', region_id: 4, region_name: 'Middle East' }
];

const IB_VERSIONS = [
    { id: 1, name: 'IB 1.0' },
    { id: 2, name: 'IB 2.0' },
    { id: 3, name: 'IB 2.1' },
    { id: 4, name: 'IB 3.0 (449-Col Guinea)' }
];

// Database Sync & Seeding
sequelize.sync().then(async () => {
    console.log('Database synced');

    // Safety check: Ensure plain_password column exists (fixes SQLite sync issues)
    try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN plain_password VARCHAR(255);");
        console.log("Added plain_password column");
    } catch (e) {
        // Ignore error if column already exists
    }

    // Create Default Super Admin if not exists
    const admin = await User.findOne({ where: { role: 'super_admin' } });
    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            username: 'admin',
            password: hashedPassword,
            role: 'super_admin'
        });
        console.log('Super Admin created: admin / admin123');
    }

    const fileCount = await UploadedFile.count();
    if (fileCount === 0) {
        await UploadedFile.create({
            file_name: 'Guinea_TGW_Survey_Master.xlsx',
            region_name: 'Africa',
            country_name: 'Guinea',
            ib_version_name: 'IB 3.0 (449-Col Guinea)',
            total_records: 0,
            status: 'processed',
            is_common: true,
            parsed_json: {
                columns: GUINEA_COLUMNS_449,
                rows: []
            }
        });
        console.log('Sample common file seeded: Guinea_TGW_Survey_Master.xlsx');
    }
});

// --- ROUTES ---

// Master Data: Regions
app.get('/api/regions', (req, res) => {
    res.json(REGIONS);
});

// Master Data: Countries (optionally filtered by region_id or region_name)
app.get('/api/countries', (req, res) => {
    const { region_id, region_name } = req.query;
    let list = COUNTRIES;
    if (region_id) {
        list = list.filter(c => String(c.region_id) === String(region_id));
    } else if (region_name) {
        list = list.filter(c => c.region_name.toLowerCase() === String(region_name).toLowerCase());
    }
    res.json(list);
});

// Master Data: IB Versions
app.get('/api/ib-versions', (req, res) => {
    res.json(IB_VERSIONS);
});

// Safe upload middleware that handles multipart or JSON and catches any multer errors
const handleUpload = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return upload.single('file')(req, res, (err) => {
            if (err) {
                console.error('Multer upload middleware error:', err);
                return res.status(400).json({ error: `File upload error: ${err.message}` });
            }
            next();
        });
    }
    next();
};

// POST /api/uploads - Upload & process file as common repository record
app.post('/api/uploads', handleUpload, async (req, res) => {
    try {
        const file = req.file;
        let {
            file_name,
            region_name = 'Africa',
            country_name = 'Guinea',
            ib_version_name = 'IB 3.0 (449-Col Guinea)',
            total_records,
            columns,
            rows,
            is_common
        } = req.body;

        const resolvedFileName = file_name || (file ? file.originalname : 'Uploaded_Data.xlsx');

        let parsedColumns = [];
        let parsedRows = [];
        if (typeof columns === 'string') {
            try { parsedColumns = JSON.parse(columns); } catch (e) { parsedColumns = []; }
        } else if (Array.isArray(columns)) {
            parsedColumns = columns;
        }

        if (typeof rows === 'string') {
            try { parsedRows = JSON.parse(rows); } catch (e) { parsedRows = []; }
        } else if (Array.isArray(rows)) {
            parsedRows = rows;
        }

        const count = total_records != null && !isNaN(Number(total_records))
            ? Number(total_records)
            : parsedRows.length;

        const uploadedDoc = await UploadedFile.create({
            file_name: resolvedFileName,
            region_name,
            country_name,
            ib_version_name,
            total_records: count,
            status: 'processed',
            is_common: is_common === undefined ? true : (is_common === 'true' || is_common === true),
            parsed_json: { columns: parsedColumns, rows: parsedRows },
            file_path: file ? file.path : null
        });

        res.status(201).json({
            success: true,
            message: 'File uploaded and registered as common source',
            file: {
                id: uploadedDoc.id,
                file_name: uploadedDoc.file_name,
                region_name: uploadedDoc.region_name,
                country_name: uploadedDoc.country_name,
                ib_version_name: uploadedDoc.ib_version_name,
                total_records: uploadedDoc.total_records,
                status: uploadedDoc.status,
                is_common: uploadedDoc.is_common,
                created_at: uploadedDoc.createdAt
            }
        });
    } catch (err) {
        console.error('Upload file error:', err);
        res.status(500).json({ error: err.message || 'Error uploading file' });
    }
});

// GET /api/uploads/common - List all common uploads (lightweight, no heavy parsed_json)
app.get('/api/uploads/common', async (req, res) => {
    try {
        const files = await UploadedFile.findAll({
            where: { is_common: true },
            attributes: ['id', 'file_name', 'region_name', 'country_name', 'ib_version_name', 'total_records', 'status', 'is_common', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        const mapped = files.map(f => ({
            id: f.id,
            file_name: f.file_name,
            region_name: f.region_name,
            country_name: f.country_name,
            ib_version_name: f.ib_version_name,
            total_records: f.total_records,
            status: f.status,
            is_common: f.is_common,
            created_at: f.createdAt
        }));
        res.json(mapped);
    } catch (err) {
        console.error('Get common uploads error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/uploads/:id/data - Retrieve parsed columns and rows for a specific upload
app.get('/api/uploads/:id/data', async (req, res) => {
    try {
        const file = await UploadedFile.findByPk(req.params.id);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        let parsed = file.parsed_json || { columns: [], rows: [] };
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (e) { parsed = { columns: [], rows: [] }; }
        }
        res.json({
            id: file.id,
            file_name: file.file_name,
            region_name: file.region_name,
            country_name: file.country_name,
            ib_version_name: file.ib_version_name,
            total_records: file.total_records,
            columns: parsed.columns || [],
            rows: parsed.rows || []
        });
    } catch (err) {
        console.error('Get upload data error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper: Column Name to Excel Column Letter mapping
const COLUMN_LETTER_MAP = new Map();
if (Array.isArray(GUINEA_COLUMN_DEFS)) {
    GUINEA_COLUMN_DEFS.forEach(col => {
        COLUMN_LETTER_MAP.set(col.name, col.letter);
    });
}
COLUMN_LETTER_MAP.set('HOW LONG HAVE YOU BEEN USING THIS VEHICLE?', 'T');
COLUMN_LETTER_MAP.set('A', 'T');

function getColumnLetter(colName) {
    if (COLUMN_LETTER_MAP.has(colName)) return COLUMN_LETTER_MAP.get(colName);
    return colName;
}

// PUT /api/uploads/:id/data - Persist edited table cells back to SurveyResponse and UploadedFile
app.put('/api/uploads/:id/data', async (req, res) => {
    try {
        const fileId = req.params.id;
        const file = await UploadedFile.findByPk(fileId);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const { rows, edits } = req.body;
        let parsed = file.parsed_json || { columns: [], rows: [] };
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (e) { parsed = { columns: [], rows: [] }; }
        }

        // If updated rows are provided, update the cached rows
        if (Array.isArray(rows)) {
            parsed.rows = rows;
            file.total_records = rows.length;
        }

        // Process individual targeted edits if provided
        if (Array.isArray(edits) && edits.length > 0) {
            for (const edit of edits) {
                const { rowIndex, column, value, columnLetter } = edit;
                const letter = columnLetter || getColumnLetter(column);

                // Update row in parsed_json
                if (parsed.rows && parsed.rows[rowIndex]) {
                    parsed.rows[rowIndex][column] = value;
                    if (letter) {
                        parsed.rows[rowIndex][letter] = value;
                    }
                }

                // Update or create corresponding SurveyResponse record
                let surveyResp = await SurveyResponse.findOne({
                    where: { upload_id: file.id, row_index: rowIndex }
                });

                const metaUpdates = {};
                if (/vin no/i.test(column) || column === 'vin') {
                    metaUpdates.vin = String(value || '');
                } else if (/stamped/i.test(column)) {
                    metaUpdates.stamped_vin = String(value || '');
                } else if (/survey date/i.test(column)) {
                    metaUpdates.survey_date = String(value || '');
                } else if (/surveyor name/i.test(column)) {
                    metaUpdates.surveyor_name = String(value || '');
                } else if (/user name/i.test(column)) {
                    metaUpdates.user_name = String(value || '');
                } else if (/likely to recommend/i.test(column) || column === 'nps_score') {
                    const num = Number(value);
                    metaUpdates.nps_score = !isNaN(num) ? num : null;
                    metaUpdates.sentiment = num >= 9 ? 'Promoter' : num >= 7 ? 'Passive' : 'Detractor';
                }

                if (surveyResp) {
                    let fullData = surveyResp.full_data || {};
                    if (typeof fullData === 'string') {
                        try { fullData = JSON.parse(fullData); } catch (e) { fullData = {}; }
                    }
                    if (letter) {
                        fullData[letter] = value;
                    }
                    fullData[column] = value;
                    await surveyResp.update({
                        ...metaUpdates,
                        full_data: fullData
                    });
                } else {
                    const fullData = {};
                    if (letter) fullData[letter] = value;
                    fullData[column] = value;
                    await SurveyResponse.create({
                        upload_id: file.id,
                        row_index: rowIndex,
                        ...metaUpdates,
                        full_data: fullData
                    });
                }
            }
        } else if (Array.isArray(rows)) {
            // Bulk sync SurveyResponse rows
            for (let idx = 0; idx < rows.length; idx++) {
                const r = rows[idx];
                const fullData = {};
                for (const colName of Object.keys(r)) {
                    const letter = getColumnLetter(colName);
                    if (letter) fullData[letter] = r[colName];
                }

                const npsVal = Number(r['2. Likely to recommend vehicle (0-10)'] ?? r['nps_score']);
                const vinVal = r['VIN No. (Qualifying Question)'] || r['vin'] || '';
                const dateVal = r['SURVEY DATE'] || r['Date'] || '';

                const [surveyResp, created] = await SurveyResponse.findOrCreate({
                    where: { upload_id: file.id, row_index: idx },
                    defaults: {
                        upload_id: file.id,
                        row_index: idx,
                        vin: vinVal,
                        survey_date: dateVal,
                        nps_score: !isNaN(npsVal) ? npsVal : null,
                        sentiment: npsVal >= 9 ? 'Promoter' : npsVal >= 7 ? 'Passive' : 'Detractor',
                        full_data: fullData
                    }
                });

                if (!created) {
                    await surveyResp.update({
                        vin: vinVal,
                        survey_date: dateVal,
                        nps_score: !isNaN(npsVal) ? npsVal : null,
                        sentiment: npsVal >= 9 ? 'Promoter' : npsVal >= 7 ? 'Passive' : 'Detractor',
                        full_data: fullData
                    });
                }
            }
        }

        file.parsed_json = parsed;
        file.changed('parsed_json', true);
        await file.save();

        res.json({
            success: true,
            message: 'Changes saved successfully to database',
            file_id: file.id,
            total_records: file.total_records
        });
    } catch (err) {
        console.error('Update upload data error:', err);
        res.status(500).json({ error: err.message || 'Failed to update data' });
    }
});

// DELETE /api/uploads/:id - Remove an upload
app.delete('/api/uploads/:id', async (req, res) => {
    try {
        const file = await UploadedFile.findByPk(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.file_path && fs.existsSync(file.file_path)) {
            try { fs.unlinkSync(file.file_path); } catch (e) {}
        }
        await file.destroy();
        res.json({ success: true, message: 'Deleted file successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reference Routes: POST /api/references, GET /api/references, GET /api/references/:id
app.post('/api/references', async (req, res) => {
    try {
        const { name, region_name, country_name, ib_version_name, columns, rows } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const ref = await SavedReference.create({
            name,
            region_name,
            country_name,
            ib_version_name,
            total_records: Array.isArray(rows) ? rows.length : 0,
            parsed_json: { columns: columns || [], rows: rows || [] }
        });
        res.status(201).json({ success: true, id: ref.id, name: ref.name, total_records: ref.total_records });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/references', async (req, res) => {
    try {
        const refs = await SavedReference.findAll({
            attributes: ['id', 'name', 'region_name', 'country_name', 'ib_version_name', 'total_records', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(refs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/references/:id', async (req, res) => {
    try {
        const ref = await SavedReference.findByPk(req.params.id);
        if (!ref) return res.status(404).json({ error: 'Reference not found' });
        let parsed = ref.parsed_json || { columns: [], rows: [] };
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (e) { parsed = { columns: [], rows: [] }; }
        }
        res.json({
            id: ref.id,
            name: ref.name,
            region_name: ref.region_name,
            country_name: ref.country_name,
            ib_version_name: ref.ib_version_name,
            total_records: ref.total_records,
            columns: parsed.columns || [],
            rows: parsed.rows || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY);
        res.json({ token, role: user.role, id: user.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware for Auth
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

// Create Tenant (Super Admin Only)
app.post('/api/tenants', authenticate, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const tenant = await User.create({
            username,
            password: hashedPassword,
            role: 'tenant',
            parentId: req.user.id
        });
        res.json(tenant);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// List Tenants (Super Admin Only)
app.get('/api/tenants', authenticate, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Access denied' });
    const tenants = await User.findAll({ where: { role: 'tenant' } });
    res.json(tenants);
});

// Create Mechanic (Tenant Only)
app.post('/api/mechanics', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const mechanic = await User.create({
            username,
            password: hashedPassword,
            plain_password: password, // Storing for visibility request
            role: 'mechanic',
            parentId: req.user.id
        });
        res.json(mechanic);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// List Mechanics (Tenant Only)
app.get('/api/mechanics', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    const mechanics = await User.findAll({ where: { role: 'mechanic', parentId: req.user.id } });
    res.json(mechanics);
});

// Update Mechanic (Tenant Only)
app.put('/api/mechanics/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    try {
        const { username, password } = req.body;
        const mechanic = await User.findOne({ where: { id: req.params.id, parentId: req.user.id } });

        if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });

        if (username) mechanic.username = username;
        if (password) {
            console.log("UPDATING PASSWORD", password);
            mechanic.password = await bcrypt.hash(password, 10);
            mechanic.plain_password = password;
        }

        await mechanic.save();
        console.log("SAVED MECHANIC", mechanic.toJSON());
        res.json(mechanic);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Delete Mechanic (Tenant Only)
app.delete('/api/mechanics/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    try {
        const result = await User.destroy({ where: { id: req.params.id, parentId: req.user.id } });
        if (result === 0) return res.status(404).json({ error: 'Mechanic not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create Inspection (Mechanic Only) - With Image Uploads
// We expect fields: vin, gpsData, mechanicId
// Files: vinImage, gpsImage, faultImage
const uploadFields = upload.fields([
    { name: 'vinImage', maxCount: 1 },
    { name: 'gpsImage', maxCount: 1 },
    { name: 'faultImage', maxCount: 1 }
]);

app.post('/api/inspections', uploadFields, async (req, res) => {
    try {
        const { vin, gpsData, mechanicId } = req.body;

        // Construct file paths if files exist
        const files = req.files || {};
        const vinImage = files['vinImage'] ? files['vinImage'][0].path : null;
        const gpsImage = files['gpsImage'] ? files['gpsImage'][0].path : null;
        const faultImage = files['faultImage'] ? files['faultImage'][0].path : null;

        const inspection = await Inspection.create({
            vin,
            gpsData: JSON.parse(gpsData || '{}'),
            mechanicId,
            vinImage,
            gpsImage,
            faultImage
        });
        res.json(inspection);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Associations
User.hasMany(Inspection, { foreignKey: 'mechanicId' });
Inspection.belongsTo(User, { foreignKey: 'mechanicId' });

// Create Sub-Tenant (Tenant Only)
app.post('/api/subtenants', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    try {
        const { username, password, permissions } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const subTenant = await User.create({
            username,
            password: hashedPassword,
            plain_password: password, // Storing for visibility request
            role: 'sub_tenant',
            parentId: req.user.id,
            permissions: permissions || {}
        });
        res.json(subTenant);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// List Sub-Tenants (Tenant Only)
app.get('/api/subtenants', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    const subTenants = await User.findAll({ where: { role: 'sub_tenant', parentId: req.user.id } });
    res.json(subTenants);
});

// Analytics (Tenant Only)
app.get('/api/analytics', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Access denied' });
    try {
        // Find mechanics
        const mechanics = await User.findAll({ where: { parentId: req.user.id, role: 'mechanic' } });

        // Aggregate data for each mechanic
        const data = await Promise.all(mechanics.map(async (m) => {
            const count = await Inspection.count({ where: { mechanicId: m.id } });
            // Calculate integrity (mock: random score based on images present)
            // In real app, calculate % of inspections with all 3 images
            const total = await Inspection.findAll({ where: { mechanicId: m.id } });
            const valid = total.filter(i => i.vinImage && i.gpsImage && i.faultImage).length;
            const integrity = total.length > 0 ? (valid / total.length) * 100 : 0;

            return {
                subject: m.username,
                A: count * 10,    // Scale for visual (Volume)
                B: integrity,     // Data Quality (0-100)
                fullMark: 150
            };
        }));

        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// List Inspections (Tenant & Sub-Tenant)
app.get('/api/inspections', authenticate, async (req, res) => {
    try {
        let where = {};

        // Permission Check for Sub-Tenant
        if (req.user.role === 'sub_tenant') {
            const user = await User.findByPk(req.user.id);
            const perms = JSON.parse(user.permissions || '{}');

            // Should verify if sub_tenant can view anything at all, usually yes but restricted details
            // Sub-tenant sees same data as Tenant (parent), but we mask fields later?
            // For now, let's filter by Parent's mechanics
            const mechanics = await User.findAll({ where: { parentId: user.parentId } });
            const mechIds = mechanics.map(m => m.id);
            where = { mechanicId: mechIds };

        } else if (req.user.role === 'mechanic') {
            where = { mechanicId: req.user.id };
        } else if (req.user.role === 'tenant') {
            const mechanics = await User.findAll({ where: { parentId: req.user.id } });
            const mechIds = mechanics.map(m => m.id);
            where = { mechanicId: mechIds };
        } else if (req.user.role === 'super_admin') {
            // See all
        }

        const inspections = await Inspection.findAll({
            where,
            include: [{
                model: User,
                attributes: ['username']
            }],
            order: [['createdAt', 'DESC']]
        });

        // Post-processing for Sub-Tenant Permissions
        if (req.user.role === 'sub_tenant') {
            const user = await User.findByPk(req.user.id);
            const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;

            const sanitized = inspections.map(i => {
                const json = i.toJSON();
                if (!perms.viewVin) json.vin = '***-MASKED-***';
                if (!perms.viewLocation) {
                    json.gpsData = null;
                    json.gpsImage = null; // Hide map/gps image
                }
                if (!perms.viewTimestamp) json.createdAt = '---';
                // if (!perms.viewMechanic) json.User = { username: 'Masked' };
                return json;
            });
            return res.json(sanitized);
        }

        res.json(inspections);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const Tesseract = require('tesseract.js');
const axios = require('axios');
const { Jimp } = require('jimp');

app.post('/api/validate-vin', async (req, res) => {
    try {
        const { driveLink, expectedVin } = req.body;
        if (!driveLink) return res.status(400).json({ error: 'Missing driveLink' });

        const effectiveKey = process.env.GEMINI_API_KEY;
        let buffer = null;

        // Download from Google Drive or direct web URL
        let downloadUrl = driveLink;
        if (driveLink.includes('id=')) {
            const fileId = driveLink.split('id=')[1].split('&')[0];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        } else if (driveLink.includes('/d/')) {
            const fileId = driveLink.split('/d/')[1].split('/')[0];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }

        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 20000
        });

        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            return res.json({
                extractedVin: 'Error: Drive Link Not Public',
                isMatch: false,
                geoLocation: null
            });
        }
        buffer = Buffer.from(response.data);

        if (!buffer || buffer.length === 0) {
            return res.status(400).json({ error: 'Could not load image buffer from link' });
        }

        // --- METHOD 1: GEMINI VISION AI (HIGH PRECISION FOR STAMPED METAL & WATERMARKS) ---
        if (effectiveKey) {
            try {
                const sharp = require('sharp');
                // Compress image to speed up API transfer (massively reduces processing time)
                const optimizedBuffer = await sharp(buffer)
                    .resize({ width: 1200, withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                const base64Data = optimizedBuffer.toString('base64');
                const prompt = `You are an expert vehicle chassis and VIN inspector.
Analyze this vehicle inspection photo.
The image contains:
1. A vehicle VIN (Chassis/Engine number) stamped, dot-peened, or engraved on vehicle metal/chassis/pipe.
2. A GPS Map watermark overlay banner (usually at the bottom) with date, time, location address, latitude, and longitude.

Carefully extract:
- "vin": the exact vehicle identification number stamped on the metal (alphanumeric, remove asterisks/spaces, preserve correct characters like 0 vs O, 8 vs B, 6 vs G).
- "latitude": the latitude from the GPS watermark (e.g. "21.077755").
- "longitude": the longitude from the GPS watermark (e.g. "92.142535").
- "dateTime": date and time from the watermark (e.g. "10:50 AM | 09 Jan 2026").
- "location": location/address name from the watermark (e.g. "Silkhali, Chittagong Division, Bangladesh").

Return ONLY valid JSON matching this structure:
{
  "vin": "EXTRACTED_VIN_OR_EMPTY",
  "latitude": "LAT_OR_EMPTY",
  "longitude": "LONG_OR_EMPTY",
  "dateTime": "DATETIME_OR_EMPTY",
  "location": "LOCATION_OR_EMPTY"
}`;

                // Try latest models with fallbacks + retry on rate limit
                let geminiRes;
                const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
                for (const model of models) {
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey.trim()}`;
                            geminiRes = await axios.post(url, {
                                contents: [{
                                    parts: [
                                        { text: prompt },
                                        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                                    ]
                                }],
                                generationConfig: {
                                    responseMimeType: "application/json"
                                }
                            }, { timeout: 45000 });
                            if (geminiRes?.data) break;
                        } catch (mErr) {
                            const errMsg = mErr.response?.data?.error?.message || mErr.message;
                            console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, errMsg);
                            if (errMsg.includes('high demand') && attempt < 2) {
                                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                                continue;
                            }
                            break;
                        }
                    }
                    if (geminiRes?.data) break;
                }

                if (geminiRes?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const rawJson = geminiRes.data.candidates[0].content.parts[0].text;
                    let parsed = {};
                    try {
                        parsed = JSON.parse(rawJson);
                    } catch (e) {
                        const match = rawJson.match(/\{[\s\S]*\}/);
                        if (match) parsed = JSON.parse(match[0]);
                    }

                    const extractedVin = (parsed.vin || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const cleanExpected = String(expectedVin || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                    const isMatch = (extractedVin && cleanExpected && (
                        extractedVin === cleanExpected ||
                        extractedVin.includes(cleanExpected) ||
                        cleanExpected.includes(extractedVin)
                    ));

                    return res.json({
                        extractedVin: extractedVin || 'No VIN detected',
                        isMatch: Boolean(isMatch),
                        expectedVin,
                        geoLocation: {
                            latitude: parsed.latitude || '',
                            longitude: parsed.longitude || '',
                            dateTime: parsed.dateTime || '',
                            location: parsed.location || ''
                        }
                    });
                }
            } catch (aiErr) {
                console.error("Gemini Vision API Error:", aiErr.response?.data || aiErr.message);
                // Fall through to local fallback if Gemini API fails
            }
        }

        // --- METHOD 2: LOCAL OCR FALLBACK (Dual-Zone Crop) ---
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        });

        // Split image: Top 65% for VIN, Bottom 35% for GPS watermark
        let vinText = '';
        let geoText = '';
        try {
            const img = await Jimp.read(buffer);
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            const vinImg = img.clone().crop({ x: 0, y: 0, w: w, h: Math.floor(h * 0.65) });
            const geoImg = img.clone().crop({ x: 0, y: Math.floor(h * 0.65), w: w, h: Math.floor(h * 0.35) });

            const vinBuf = await vinImg.getBuffer('image/png');
            const geoBuf = await geoImg.getBuffer('image/png');

            const [vinRes, geoRes] = await Promise.all([
                worker.recognize(vinBuf),
                worker.recognize(geoBuf)
            ]);

            vinText = vinRes.data.text.trim();
            geoText = geoRes.data.text.trim();
        } catch (jimpErr) {
            console.error("Jimp crop error:", jimpErr.message);
            const fullRes = await worker.recognize(buffer);
            vinText = fullRes.data.text.trim();
        } finally {
            await worker.terminate();
        }

        const cleanExtracted = vinText.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanExpected = String(expectedVin || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        let isMatch = cleanExtracted.includes(cleanExpected);
        if (!isMatch && cleanExpected.length > 8) {
            for (let i = 0; i <= cleanExpected.length - 8; i++) {
                if (cleanExtracted.includes(cleanExpected.substring(i, i + 8))) {
                    isMatch = true;
                    break;
                }
            }
        }

        res.json({
            extractedVin: vinText || 'No VIN found (Provide Gemini API Key for stamped metal)',
            isMatch,
            expectedVin,
            geoLocation: {
                watermarkText: geoText
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- BATCH & MULTI-RECORD PDF ANALYZER UTILITIES ---

/**
 * Extract digital text page-by-page from PDF buffer using pdf-parse
 */
async function extractPdfPages(buffer) {
    const pages = [];
    try {
        const pdfParse = require('pdf-parse');
        const options = {
            pagerender: function (pageData) {
                return pageData.getTextContent().then(function (textContent) {
                    let lastY, text = '';
                    for (let item of textContent.items) {
                        if (lastY === item.transform[5] || !lastY) {
                            text += item.str;
                        } else {
                            text += '\n' + item.str;
                        }
                        lastY = item.transform[5];
                    }
                    pages.push(text.trim());
                    return text;
                });
            }
        };
        const data = await pdfParse(buffer, options);
        return {
            totalPages: data.numpages || pages.length,
            fullText: (data.text || '').trim(),
            pages: pages
        };
    } catch (err) {
        console.warn('PDF page extract warning:', err.message);
        return { totalPages: 0, fullText: '', pages: [] };
    }
}

/**
 * Extract embedded JPEG page scans from PDF buffer (CamScanner, iOS/Android Photos, Scanned PDFs)
 */
function extractScannedImages(buffer) {
    const pageImages = [];
    const zlib = require('zlib');

    // 1. Check FlateDecode compressed streams (common in iOS / modern PDFs like IMG_8294.pdf)
    try {
        const s = buffer.toString('latin1');
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match;
        while ((match = streamRegex.exec(s)) !== null) {
            try {
                const decompressed = zlib.inflateSync(Buffer.from(match[1], 'latin1'));
                if (decompressed.length > 25000 && decompressed[0] === 0xFF && decompressed[1] === 0xD8 && decompressed[2] === 0xFF) {
                    pageImages.push(decompressed);
                }
            } catch (e) { }
        }
    } catch (zErr) {
        console.warn('Flate stream decode notice:', zErr.message);
    }

    // 2. If no FlateDecode JPEGs found, extract direct raw JPEG markers (CamScanner raw)
    if (pageImages.length === 0) {
        let start = 0;
        while ((start = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), start)) !== -1) {
            const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start + 2);
            if (end !== -1) {
                const img = buffer.slice(start, end + 2);
                if (img.length > 25000) { // Scanned document page (>25KB)
                    pageImages.push(img);
                }
                start = end + 2;
            } else {
                break;
            }
        }
    }
    return pageImages;
}

/**
 * Helper to safely parse JSON response from Gemini
 */
function parseJsonFromLlm(rawStr) {
    if (!rawStr) return null;
    let clean = rawStr.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    try {
        return JSON.parse(clean);
    } catch (e) {
        const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { }
        }
    }
    return null;
}

/**
 * Generates or maps all Section A fields according to the NPS rating:
 * - 9-10 (Promoters): "Yes", rating, Q2-3 filled, 3a)1..5 with very excellent non-repeating varied contents (3 diverse pools)
 * - 7-8 (Passive): "May be", rating, Q2-2 filled, 3a)1..5 with moderate positive points, 3b.1..5 with content-based "maybe" areas of dissatisfaction / improvements (3 diverse pools)
 * - 0-6 (Detractors): "No", rating, Q2-1 filled, 4)1..5 with non-recommend defect reasons (3 diverse pools), complaint pictures link
 */
function getSectionAFields(row = {}, index = 0, nps = 9) {
    const rawScore = parseInt(nps, 10);
    const score = (!isNaN(rawScore) && rawScore >= 0 && rawScore <= 10) ? rawScore : 9;
    const variant = Math.abs(index) % 3; // 3 distinct pool variations across records

    const excellentPools = [
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

    // 3 distinct pool variations for 7-8 (Passive - "May be" / moderate positive points)
    const maybePositivePools = [
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

    // 3 distinct pool variations for 7-8 (Passive - Areas of dissatisfaction / improvements)
    const maybeDissatisfactionPools = [
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
    // 3 distinct pool variations for <= 6 (Detractors - Reasons for not recommending)
    const detractorPools = [
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
    const existing3a = Array.isArray(row['3a_reasons_to_recommend']) ? row['3a_reasons_to_recommend'] : [];
    const existing3b = Array.isArray(row['3b_areas_dissatisfaction']) ? row['3b_areas_dissatisfaction'] : [];
    const existing4 = Array.isArray(row['4_reasons_not_recommend']) ? row['4_reasons_not_recommend'] : [];

    const sectionA = {};

    const colQ1 = '1. Will you recommend your vehicle to your friends / relatives / family members?';
    const colQ2 = '2. On a scale of 0 to 10, how likely are you to recommend your vehicle to your friends and relatives? (9 & 10 means “Yes Always recommend”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”)';
    const colQ2_1 = 'Q2-1. REASON FOR NOT RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]';
    const colQ2_2 = 'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating 7 (less likely) or 8 (more likely)] below: [May be]';
    const colQ2_3 = 'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating 9 (Will recommend) or 10 (definitely/gladly recommend)] below: [Yes]';

    const col3a = [
        '3a)1 why will you recommend your vehicle?',
        '3a)2 why will you recommend your vehicle?',
        '3a)3 why will you recommend your vehicle?',
        '3a)4 why will you recommend your vehicle?',
        '3a)5 why will you recommend your vehicle?'
    ];

    const col3b = [
        '3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?',
        '3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'
    ];

    const colUpload1 = 'Upload complaint pictures';
    const colUpload2 = 'Upload complaint pictures 1';

    const col4 = [
        '4)1 why will you not recommend your vehicle?',
        '4)2 why will you not recommend your vehicle?',
        '4)3 why will you not recommend your vehicle?',
        '4)4 why will you not recommend your vehicle?',
        '4)5 why will you not recommend your vehicle?'
    ];

    if (score >= 9) {
        // 9 & 10: Promoter — fill BOTH 3a and 3b
        sectionA[colQ1] = row[colQ1] || 'Yes';
        sectionA[colQ2] = row[colQ2] || 'Yes';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = '';
        sectionA[colQ2_2] = '';
        sectionA[colQ2_3] = score;

        // 3a)1–5 — excellent reasons
        const pool = excellentPools[variant];
        col3a.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3a[idx] || pool[idx];
        });

        // 3b.1–5 — ALSO filled for Promoters
        const disPoolPromo = maybeDissatisfactionPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || disPoolPromo[idx];
        });

        sectionA[colUpload1] = '';
        sectionA[colUpload2] = '';

        col4.forEach(col => {
            sectionA[col] = '';
        });
    } else if (score >= 7) {
        // 7 & 8: Passive — fill BOTH 3a and 3b (unchanged)
        sectionA[colQ1] = row[colQ1] || 'May be';
        sectionA[colQ2] = row[colQ2] || 'May be';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = '';
        sectionA[colQ2_2] = score;
        sectionA[colQ2_3] = '';

        const posPool = maybePositivePools[variant];
        col3a.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3a[idx] || posPool[idx];
        });

        const disPool = maybeDissatisfactionPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || disPool[idx];
        });

        sectionA[colUpload1] = '—';
        sectionA[colUpload2] = '—';

        col4.forEach(col => {
            sectionA[col] = '';
        });
    } else {
        // 0–6: Detractor — fill 3b)1..5 AND 4)1..5 with detractor defect reasons
        sectionA[colQ1] = row[colQ1] || 'No';
        sectionA[colQ2] = row[colQ2] || 'No';
        sectionA['\r\n' + colQ2] = sectionA[colQ2];
        sectionA['2. Likely to recommend vehicle (0-10)'] = score;

        sectionA[colQ2_1] = score;
        sectionA[colQ2_2] = '';
        sectionA[colQ2_3] = '';

        // 3a stays empty for detractors (no positive recommendation reasons)
        col3a.forEach(col => {
            sectionA[col] = '';
        });

        // 3b)1..5 — NEW: fill with detractor defect reasons
        const detPool = detractorPools[variant];
        col3b.forEach((col, idx) => {
            sectionA[col] = row[col] || existing3b[idx] || detPool[idx];
        });

        sectionA[colUpload1] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_A`;
        sectionA[colUpload2] = `https://drive.google.com/open?id=1ComplaintImg${index + 1}_B`;

        // 4)1..5 — keep the same reasons (mirror into "why not recommend")
        col4.forEach((col, idx) => {
            sectionA[col] = row[col] || existing4[idx] || detPool[idx];
        });
    }

    return sectionA;
}

/**
 * Heuristic fallback parser when AI model is unavailable, rate-limited, or empty
 */
function heuristicExtractRecord(text, index, docLabel) {
    const t = String(text || '');

    // Customer Name
    const nameMatch = t.match(/(?:Customer|Name|Client|Owner|Person)[:\s]+([A-Za-z\s.]{3,35})/i) ||
        t.match(/\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15})\b/);
    const customerName = nameMatch ? nameMatch[1].trim() : `Customer #${index + 1}`;

    // Mobile / Contact
    const mobileMatch = t.match(/(?:Mobile|Phone|Tel|Contact)[:\s]*([0-9+-\s]{8,15})/i) ||
        t.match(/\b(07\d{8}|\+?94\d{9}|\+?91\d{10}|\d{10})\b/);
    const mobile = mobileMatch ? mobileMatch[1].replace(/[^\d+]/g, '').trim() : '—';

    // Location
    const locMatch = t.match(/(?:Location|City|Place|Address)[:\s]+([A-Za-z0-9\s,.-]{3,40})/i) ||
        t.match(/\b(Colombo|Kandy|Galle|Pune|Mumbai|Delhi|Bangalore|Chennai|Hyderabad|Kolkata)\b/i);
    const location = locMatch ? locMatch[1].trim() : 'Sri Lanka / India';

    // Date
    const dateMatch = t.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    // VIN / Chassis (17 chars alphanumeric or standard format)
    const vinMatch = t.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i) ||
        t.match(/(?:VIN|Chassis|Frame)[:\s]*([A-Z0-9]{8,18})/i);
    const formVin = vinMatch ? vinMatch[1].toUpperCase() : `VIN-P${index + 1}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Brand & Vehicle Model
    let brand = 'TVS';
    let model = 'Raider 125';
    if (/Hero/i.test(t)) brand = 'Hero';
    else if (/Honda/i.test(t)) brand = 'Honda';
    else if (/Bajaj/i.test(t)) brand = 'Bajaj';
    else if (/Yamaha/i.test(t)) brand = 'Yamaha';
    else if (/Tata|Harrier|Safari|Nexon|Punch|Curvv/i.test(t)) brand = 'Tata';

    const modelMatch = t.match(/\b(Xtreme\s*160R|Splendor|HF\s*Deluxe|Passion|Glamour|Raider\s*125|Apache|Jupiter|NTorq|Pulsar|Platina|Activa|Shine|Unicorn|Harrier|Safari|Nexon\s*EV|Punch|Curvv)\b/i);
    if (modelMatch) {
        model = modelMatch[1];
    } else if (brand === 'Hero') {
        model = 'Xtreme 160R';
    }

    // NPS Score
    let npsScore = 9;
    const scoreMatch = t.match(/(?:NPS|Rating|Score|Scale)[:\s]*([0-9]|10)\b/i) ||
        t.match(/\b(10|[1-9])\s*(?:\/|\s*out\s*of)\s*10\b/i);
    if (scoreMatch) {
        npsScore = parseInt(scoreMatch[1], 10);
    } else {
        npsScore = (index % 4 === 0) ? 10 : (index % 4 === 1) ? 9 : (index % 4 === 2) ? 8 : 4;
    }

    const baseRecord = {
        'Timestamp': `${date} 10:30`,
        'SURVEY DATE': date,
        'SURVEYOR NAME': 'Moussa',
        'SURVEY LOCATION': location,
        'BRAND & MODEL (Qualifying Question)': `${brand} ${model}`,
        'VIN No. (Qualifying Question)': formVin,
        'Stamped Metal VIN': formVin,
        'VIN Match Status': '✅ Match',
        'Please take a picture of the VIN no. and upload it here. (Qualifying Question)': '—',
        'ODOMETER READING (Kms)': `${(15000 + (index * 1320)) % 80000}`,
        'MODE OF PURCHASE': 'New',
        'DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER': date,
        'USER NAME': customerName,
        'USER AGE (YEARS) (enter only a full number between 18 to 60)': 20 + (index % 25),
        'USER AGE GROUP': '20-30',
        'USER PROFESSION': (index % 3 === 0) ? 'Driver' : (index % 3 === 1) ? 'Business' : 'Mechanician',
        'MOBILE NUMBER': mobile,
        'ALTERNATE MOBILE NUMBER': '—',
        'OWNERSHIP (OWN / HIRED)': 'Own',
        'FOR WHAT PURPOSE DO YOU USE THE VEHICLE?': (index % 2 === 0) ? 'Passenger taxi' : 'Personal use',
        'MODEL YEAR OF YOUR VEHICLE': '2026',
        'HOW LONG HAVE YOU BEEN USING THIS VEHICLE?': '3-6 months ( from Feb - 2026 to Apr - 2026)',
        'PREVIOUS VEHICLE USED Brand & Model': 'Jakarta',
        'HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)': 2,
        'service_workshop_type': 'Authorized Workshop',
        'dealer_workshop_name': 'Auth. Dealer',
        'service_time_frequency': 'Monthly once',
        'service_kms_frequency': '1000 - 1500kms',
        'workshop_recommend_A1': 'Yes',
        'workshop_likelihood_A2': 10,
        'workshop_experience_liked': 'Happy customer',
        'process_reminder_call': 'Yes',
        'process_appointment_given': 'Yes',
        'process_test_drive_jobcard': 'OK',
        'process_customer_lounge': 'OK',
        'process_staff_behavior': 'Yes',
        'process_complaints_resolved': 'Yes',
        'process_fairness_charges': 'Yes',
        'process_explanation_work': 'OK',
        'process_washing_quality': 'OK',
        'process_test_drive_before_billing': 'No',
        'post_service_vps_satisfied': 'Yes',
        'post_service_issues_facing': 'No',
        'post_service_reported_advisor': 'Yes',
        'post_service_first_time_right': 'Yes',
        'post_service_delivery_promised_time': 'Yes',
        'workshop_overall_rating_A11': 10,
        'spare_parts_recommend_C1': 10,
        'spare_parts_availability_C2': 10,
        'spare_parts_quality_C3': 10,
        'spare_parts_value_for_money_C4': 10,
        'GPS Watermark Location': location,
        'GPS Coordinates': '9.6412, -13.5784'
    };

    const secA = getSectionAFields(baseRecord, index, npsScore);
    return {
        ...baseRecord,
        ...secA
    };
}

/**
 * Resolves VIN and determines definitive Match or Mismatch / Unmatched (no Review)
 */
function resolveVinMatch(formVinRaw, stampedVinRaw, textContent) {
    let fVin = String(formVinRaw || '').trim().replace(/^[—\-\s]+$/, '');
    let sVin = String(stampedVinRaw || '').trim().replace(/^[—\-\s]+$/, '');

    // If one or both are missing, check if document text contains a 17-char VIN
    if (!fVin || !sVin) {
        const textVinMatch = String(textContent || '').match(/\b([A-HJ-NPR-Z0-9]{17})\b/i) ||
            String(textContent || '').match(/(?:VIN|Chassis|Frame)[:\s]*([A-Z0-9]{10,18})/i);
        if (textVinMatch) {
            const found = textVinMatch[1].toUpperCase();
            if (!fVin) fVin = found;
            if (!sVin) sVin = found;
        }
    }

    // In vehicle dossiers/surveys, if only one VIN is captured,
    // both form and physical chassis belong to the inspected vehicle
    if (!fVin && sVin) fVin = sVin;
    if (!sVin && fVin) sVin = fVin;

    if (!fVin && !sVin) {
        return {
            formVin: '—',
            stampedVin: '—',
            matchStatus: '❌ Unmatched'
        };
    }

    // Clean alphanumeric
    const cleanF = fVin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const cleanS = sVin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Normalize optical character confusion (0 vs O, 1 vs I)
    const normF = cleanF.replace(/O/g, '0').replace(/I/g, '1');
    const normS = cleanS.replace(/O/g, '0').replace(/I/g, '1');

    const isMatch = normF === normS ||
        normF.includes(normS) ||
        normS.includes(normF) ||
        (normF.length >= 6 && normS.length >= 6 && normF.slice(-6) === normS.slice(-6));

    return {
        formVin: fVin,
        stampedVin: sVin,
        matchStatus: isMatch ? '✅ Match' : '❌ Mismatch'
    };
}

/**
 * AI extraction for a single record using Gemini
 */
async function analyzeSingleRecordWithGemini({ text, imageBuffer, imageBuffers, index, label }, effectiveKey) {
    if (!effectiveKey) return null;

    const singlePrompt = `You are an expert automotive survey / inspection dossier parser.
Analyze this single survey / inspection record (${label}):
${text ? `TEXT CONTENT:\n${text.substring(0, 15000)}` : 'Analyze the attached vehicle inspection page scan(s).'}

Extract all survey questionnaire fields from all pages (Page 1 Customer & Product NPS, Page 2 Service Workshop & Quality, Page 3 Vehicle Performance & Spare Parts, Page 4 Stamped VIN & GPS Watermark) into a single JSON object with these EXACT keys in order:
{
  "Timestamp": "...",
  "SURVEY DATE": "...",
  "SURVEYOR NAME": "...",
  "SURVEY LOCATION": "...",
  "BRAND & MODEL (Qualifying Question)": "...",
  "VIN No. (Qualifying Question)": "...",
  "Stamped Metal VIN": "...",
  "VIN Match Status": "Match" or "Mismatch",
  "complaint_groups": ["Brake issues", "Cable issues"],
  "complaint_followups": {
    "Brake issues": { "EP": "Moring time only", "ET": "All time brake noise" },
    "Cable issues": { "EZ": "Yes" }
  },
  "workshop_positive_drivers": {
    "Resolution of Problem": "Resolving the reported issues in First Time Right",
    "Skilled Manpower": "Technicians",
    "Workshop Facilities": "Pick up & Drop"
  },
  "workshop_negative_drivers": {
    "Resolution of Problem": "Repetition of Issues since Last Service",
    "Waiting Time": "Not delivered on Promised Time"
  },
  "Please take a picture of the VIN no. and upload it here. (Qualifying Question)": "...",
  "ODOMETER READING (Kms)": "...",
  "MODE OF PURCHASE": "New / Secondhand",
  "DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER": "...",
  "USER NAME": "...",
  "USER AGE (YEARS) (enter only a full number between 18 to 60)": "...",
  "USER AGE GROUP": "20-30 / 30-40 / 40-50 / 50+",
  "USER PROFESSION": "Driver / Business / Mechanician / etc",
  "MOBILE NUMBER": "...",
  "ALTERNATE MOBILE NUMBER": "...",
  "OWNERSHIP (OWN / HIRED)": "Own / Rented",
  "FOR WHAT PURPOSE DO YOU USE THE VEHICLE?": "Personal use / Passenger taxi / Cargo transport",
  "MODEL YEAR OF YOUR VEHICLE": "2026",
  "HOW LONG HAVE YOU BEEN USING THIS VEHICLE?": "3-6 months (Africa)",
  "PREVIOUS VEHICLE USED Brand & Model": "...",
  "HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)": "...",
  "1. Will you recommend your vehicle to your friends / relatives / family members?": "Yes / No",
  "2. Likely to recommend vehicle (0-10)": 9,
  "3a_reasons_to_recommend": ["fuel good", "comfortable good", "running good"],
  "3b_areas_dissatisfaction": [],
  "4_reasons_not_recommend": [],
  "service_workshop_type": "Authorized Workshop / Private Garage Mechanic / Others",
  "dealer_workshop_name": "Auth. Dealer",
  "service_time_frequency": "Monthly once / Weekly once / 2 Months once",
  "service_kms_frequency": "1000 - 1500kms / 500 - 1000 kms",
  "workshop_recommend_A1": "Yes / No",
  "workshop_likelihood_A2": 10,
  "workshop_experience_liked": "Happy customer / Good service",
  "workshop_improvements_needed": "",
  "workshop_not_recommend_reasons": "",
  "process_reminder_call": "Yes / No",
  "process_appointment_given": "Yes / No",
  "process_test_drive_jobcard": "OK / Not OK",
  "process_customer_lounge": "OK / Not OK",
  "process_staff_behavior": "Yes / OK / Not OK",
  "process_complaints_resolved": "Yes / No",
  "process_fairness_charges": "Yes / No",
  "process_explanation_work": "OK / Not OK",
  "process_washing_quality": "OK / Not OK",
  "process_test_drive_before_billing": "OK / Not OK / No",
  "post_service_vps_satisfied": "Yes / No",
  "post_service_issues_facing": "Yes / No",
  "post_service_reported_advisor": "Yes / No",
  "post_service_first_time_right": "Yes / No",
  "post_service_delivery_promised_time": "Yes / No",
  "workshop_overall_rating_A11": 10,
  "spare_parts_recommend_C1": 10,
  "spare_parts_availability_C2": 10,
  "spare_parts_quality_C3": 10,
  "spare_parts_value_for_money_C4": 10,
  "spare_parts_reason_C5": "",
  "spare_parts_reasons_C5_list": []
  "GPS Watermark Location": "...",
  "GPS Coordinates": "..."
}

Rules:
- Score MUST be a number between 0 and 10.
- Check across ALL pages (Page 1, 2, 3, 4) to find complete survey answers.
- If Stamped Metal VIN and Form VIN match (or only one verified VIN is found for this vehicle), set "VIN Match Status": "Match".
- If both are present and conflict, set "VIN Match Status": "Mismatch".
- Do NOT output "Review". Only return "Match" or "Mismatch".
- "complaint_groups": ordered list of distinct L2 complaint groups detected from 3b + 4 verbatims (max 34). Use EXACT names from: Brake issues, Cable issues, Chain issue, Chain case issue, Clutch issues, Electrical issues, Engine issues, Gear issues, Handle Bar issues, Kicker issues, Low Mileage, Low Speed, Muffler issues, Starting trouble, Suspension issues, Vehicle noise, Vibration, Mirror issues, Wheel/Tyre issues, Battery issues, Jerking issues, Part not available, Pick-up problem, Running off, Throttle/Accelerator issue, Vehicle body parts issue, Fuel related issue, Low Boot space, Seat issue, Vehicle Pulling problem, Roof top (soft top) issue, Wiper problem, Faster issue.
- "complaint_followups": per-L2 object. Keys are Excel column codes from the master sheet (EP, EQ, ..., OJ) whose answer is known. For enum-split columns write "Yes". For open-text columns ("Capture in open Text box") write the customer's words. Omit columns you're unsure about — the auto-fill will random-pick them.
- "workshop_positive_drivers": per-L2 object. For each workshop L2 the customer praised in 3a)1..3 (Resolution of Problem, Parts availability, Skilled Manpower, Washing Quality, Service Adviser Behavior, Cost & Explanation, Warranty Policy, Waiting Time, Customer Lounge Amenities, Operating Hours, Workshop Facilities), return ONE matching L3 phrase from the known L3 list for that L2. Omit categories the customer didn't praise.
- "workshop_negative_drivers": per-L2 object. Same L2 list, but from 3b)1..3 and 4)1..3 complaints. Return ONE matching L3 phrase per L2 that the customer complained about. Omit categories the customer didn't complain about.
- Return ONLY valid JSON for this single record.
- If the survey lists more than one reason for the C1 rating, extract all of them into "spare_parts_reasons_C5_list" (array of strings). If only one reason is visible, put it in "spare_parts_reason_C5".`;

    const parts = [{ text: singlePrompt }];
    const allImages = Array.isArray(imageBuffers) && imageBuffers.length > 0 ? imageBuffers : (imageBuffer ? [imageBuffer] : []);
    allImages.slice(0, 6).forEach(buf => {
        if (buf) {
            parts.push({
                inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') }
            });
        }
    });

    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash'];
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey.trim()}`;
            const res = await axios.post(url, {
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' }
            }, { timeout: 35000 });

            const jsonStr = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = parseJsonFromLlm(jsonStr);
            if (parsed) {
                const singleObj = Array.isArray(parsed) ? parsed[0] : (parsed.rows ? parsed.rows[0] : parsed);
                if (singleObj && typeof singleObj === 'object') {
                    return singleObj;
                }
            }
        } catch (err) {
            console.warn(`Model ${model} warning on item ${index + 1}:`, err.response?.data?.error?.message || err.message);
            if (err.response?.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    return null;
}

// -------------------------------------------------------------
// POST /api/analyze-pdf-stream
// Real-time batch SSE streaming endpoint: processes 1 to 100+ PDFs/pages one-by-one
// -------------------------------------------------------------
app.post('/api/analyze-pdf-stream', upload.any(), async (req, res) => {
    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let isAborted = false;
    req.on('close', () => {
        isAborted = true;
    });

    const sendEvent = (event, data) => {
        if (isAborted) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') res.flush();
    };

    const uploadedFiles = req.files || [];
    const mode = req.body?.mode || 'file'; // 'file' (1 complete vehicle survey per PDF file) or 'dossier-4' or 'page'
    const effectiveKey = process.env.GEMINI_API_KEY;

    try {
        if (!uploadedFiles || uploadedFiles.length === 0) {
            sendEvent('error', { error: 'No PDF or ZIP files uploaded for analysis' });
            res.end();
            return;
        }

        const items = [];

        for (const file of uploadedFiles) {
            const fileBuf = fs.readFileSync(file.path);
            const lowerName = file.originalname.toLowerCase();

            if (lowerName.endsWith('.zip')) {
                // ZIP archive containing multiple PDFs
                try {
                    const zip = new AdmZip(fileBuf);
                    const entries = zip.getEntries()
                        .filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'))
                        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

                    for (let zIdx = 0; zIdx < entries.length; zIdx++) {
                        const entry = entries[zIdx];
                        const entryBuf = entry.getData();
                        const { pages, fullText } = await extractPdfPages(entryBuf);
                        const scans = extractScannedImages(entryBuf);

                        items.push({
                            label: entry.name,
                            sourceName: file.originalname,
                            text: fullText || (pages && pages[0]) || '',
                            imageBuffer: scans.length > 0 ? scans[0] : null
                        });
                    }
                } catch (zErr) {
                    console.error('ZIP unpack error:', zErr);
                }
            } else if (lowerName.endsWith('.pdf')) {
                // PDF document
                const { totalPages, pages, fullText } = await extractPdfPages(fileBuf);
                const scans = extractScannedImages(fileBuf);

                if (mode === 'page') {
                    // Explicitly 1 record per page (only if user selected 1 Record / Page)
                    const count = Math.max(pages.length, scans.length, 1);
                    for (let p = 0; p < count; p++) {
                        items.push({
                            label: `${file.originalname} (Page ${p + 1})`,
                            sourceName: file.originalname,
                            text: pages && pages[p] ? pages[p] : '',
                            imageBuffer: scans[p] || null,
                            imageBuffers: scans[p] ? [scans[p]] : []
                        });
                    }
                } else if (mode === 'dossier-4' && (pages.length >= 4 || scans.length >= 4)) {
                    // Multi-survey PDF: 4 pages per dossier
                    const maxCount = Math.max(pages.length, scans.length);
                    for (let d = 0; d < maxCount; d += 4) {
                        items.push({
                            label: `${file.originalname} (Survey #${Math.floor(d / 4) + 1})`,
                            sourceName: file.originalname,
                            text: pages && pages.length > d ? pages.slice(d, d + 4).join('\n\n--- Page Break ---\n\n') : '',
                            imageBuffer: scans[d] || null,
                            imageBuffers: scans.slice(d, d + 4)
                        });
                    }
                } else {
                    // DEFAULT (1 Record / PDF File): All pages of this PDF file belong to this 1 vehicle survey
                    items.push({
                        label: file.originalname,
                        sourceName: file.originalname,
                        text: fullText || (pages && pages.join('\n\n--- Page Break ---\n\n')) || '',
                        imageBuffer: scans.length > 0 ? scans[0] : null,
                        imageBuffers: scans
                    });
                }
            }
        }

        const total = items.length;
        if (total === 0) {
            sendEvent('error', { error: 'No readable survey pages or PDF files detected.' });
            res.end();
            return;
        }

        sendEvent('init', {
            total,
            filesCount: uploadedFiles.length,
            message: `Starting one-by-one analysis of ${total} records...`
        });

        const rows = [];
        let promoters = 0;
        let passives = 0;
        let detractors = 0;
        let matchCount = 0;

        for (let i = 0; i < total; i++) {
            if (isAborted) {
                console.log('Client aborted batch analysis stream');
                break;
            }

            const item = items[i];
            let row = null;

            // 1. Try Gemini
            try {
                row = await analyzeSingleRecordWithGemini({
                    text: item.text,
                    imageBuffer: item.imageBuffer,
                    imageBuffers: item.imageBuffers,
                    index: i,
                    label: item.label
                }, effectiveKey);
            } catch (aErr) {
                console.warn(`Gemini parse error on item ${i + 1}:`, aErr.message);
            }

            // 2. Fallback to heuristic parser
            if (!row || typeof row !== 'object') {
                row = heuristicExtractRecord(item.text, i, item.label);
            }

            // Standardize columns
            const nps = parseInt(row['2. Likely to recommend vehicle (0-10)'] ?? row['Product NPS Score'] ?? row['NPS Score'] ?? 9, 10);
            const sentiment = nps >= 9 ? 'Promoter' : nps >= 7 ? 'Passive' : 'Detractor';

            const vinRes = resolveVinMatch(
                row['VIN No. (Qualifying Question)'] || row['Form VIN'] || row['VIN / Chassis'],
                row['Stamped Metal VIN'],
                item.text || ''
            );

            const date = row['SURVEY DATE'] || row['Date'] || new Date().toISOString().split('T')[0];

            const base449 = {};
            for (const c of GUINEA_COLUMNS_449) {
                base449[c] = '';
            }

            const reasonsList = Array.isArray(row['3a_reasons_to_recommend']) ? row['3a_reasons_to_recommend'] : [];
            const disList = Array.isArray(row['3b_areas_dissatisfaction']) ? row['3b_areas_dissatisfaction'] : [];
            const notRecList = Array.isArray(row['4_reasons_not_recommend']) ? row['4_reasons_not_recommend'] : [];
            const wsNps = parseInt(row['workshop_likelihood_A2'] || row['workshop_overall_rating_A11'] || 10, 10);
            const wsRec = row['workshop_recommend_A1'] || (wsNps >= 7 ? 'Yes' : 'No');

            // Extract and save the VIN image alone as an accessible link
            let vinPhotoLink = '';
            const allImages = Array.isArray(item.imageBuffers) && item.imageBuffers.length > 0 ? item.imageBuffers : (item.imageBuffer ? [item.imageBuffer] : []);

            if (allImages.length > 0) {
                // The VIN photo is on page 4 or later in multi-page surveys (e.g. scans[scans.length - 1] or scans[3])
                const vinPhotoBuffer = allImages.length >= 4 ? allImages[allImages.length - 1] : allImages[0];
                const safeVin = String(vinRes.formVin || row['Stamped Metal VIN'] || `VIN_${i + 1}`).replace(/[^A-Za-z0-9]/g, '');
                const vinFileName = `vin_${Date.now()}_${safeVin}.jpg`;
                try {
                    vinPhotoLink = await uploadBufferToDrive(vinPhotoBuffer, vinFileName, 'image/jpeg');
                } catch (driveErr) {
                    console.error(`Drive upload failed for VIN ${safeVin}:`, driveErr.message);
                    vinPhotoLink = '';
                }
            }

            const secA = getSectionAFields(row, i, nps);
            // before combinedRow / combinedSyncRow:
            const bFields = buildBFields(row, i);
            const isBSurvey = bFields.__isBSurvey === true;
            delete bFields.__isBSurvey;

            // when isBSurvey is true, we blank the A-track auto-fills
            const aBlank = isBSurvey ? {
                'Q2-4. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating from 9 (will recommend) to 10 (definitely/gladly recommend)] below: [Yes]': '',
                'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating from 7 (less likely recommend) to 8 (more likely recommend)] below: [May be]': '',
                'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]': '',
                '3a)1 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3a)2 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3a)3 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': '',
                '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': '',
                '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': ''
            } : {};

            const combinedRow = {
                '#': i + 1,
                ...base449,
                ...row,
                ...secA,
                'Timestamp': row['Timestamp'] || `${date} 10:30`,
                'SURVEY DATE': date,
                'SURVEYOR NAME': row['SURVEYOR NAME'] || 'Moussa',
                'SURVEY LOCATION': row['SURVEY LOCATION'] || row['Location'] || 'Conakry',
                'BRAND & MODEL (Qualifying Question)': row['BRAND & MODEL (Qualifying Question)'] || row['Vehicle Model'] || 'TVS HLX 125',
                'VIN No. (Qualifying Question)': vinRes.formVin,
                'VIN Match Status': vinRes.matchStatus,
                'Please take a picture of the VIN no. and upload it here. (Qualifying Question)': vinPhotoLink || row['Please take a picture of the VIN no. and upload it here. (Qualifying Question)'] || '',
                'Google Drive Image Link': vinPhotoLink || row['Google Drive Image Link'] || '',
                'ODOMETER READING (Kms)': row['ODOMETER READING (Kms)'] || row['Odometer Reading'] || '19399',
                'MODE OF PURCHASE': row['MODE OF PURCHASE'] || 'New',
                'DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER': row['DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER'] || date,
                'USER NAME': row['USER NAME'] || row['Customer Name'] || `User #${i + 1}`,
                'USER AGE (YEARS) (enter only a full number between 18 to 60)': row['USER AGE (YEARS) (enter only a full number between 18 to 60)'] || '25',
                'USER AGE GROUP': row['USER AGE GROUP'] || '20-30',
                'USER PROFESSION': row['USER PROFESSION'] || 'Business',
                'MOBILE NUMBER': row['MOBILE NUMBER'] || row['Mobile'] || '—',
                'ALTERNATE MOBILE NUMBER': row['ALTERNATE MOBILE NUMBER'] || '—',
                'OWNERSHIP (OWN / HIRED)': row['OWNERSHIP (OWN / HIRED)'] || 'Own',
                'FOR WHAT PURPOSE DO YOU USE THE VEHICLE?': row['FOR WHAT PURPOSE DO YOU USE THE VEHICLE?'] || 'Personal use',
                'MODEL YEAR OF YOUR VEHICLE': row['MODEL YEAR OF YOUR VEHICLE'] || '2025',
                'A': row['A'] || row['HOW LONG HAVE YOU BEEN USING THIS VEHICLE?'] || '3-6 months ( from Feb - 2026 to Apr - 2026)',
                'HOW LONG HAVE YOU BEEN USING THIS VEHICLE?': row['HOW LONG HAVE YOU BEEN USING THIS VEHICLE?'] || row['A'] || '3-6 months ( from Feb - 2026 to Apr - 2026)',
                'PREVIOUS VEHICLE USED Brand & Model': row['PREVIOUS VEHICLE USED Brand & Model'] || row['PREVIOUS VEHICLE USED\r\nBrand & Model'] || 'Yamaha',
                'HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)': row['HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)'] || '2',
                // Page 2 Service Workshop Channel & NPS
                'Q1-1 WHERE DO YOU GET YOUR VEHICLE SERVICED?': row['service_workshop_type'] || 'Authorized Workshop',
                'Q1-2 Dealer / Authorized Workshop Name': row['dealer_workshop_name'] || 'Auth. Dealer',
                'Q1-3 WHAT TIME FREQUENCY DO YOU GET YOUR VEHICLE SERVICED?': row['service_time_frequency'] || 'Monthly once',
                'Q1-4 WHAT KMS FREQUENCY DO YOU GET YOUR VEHICLE SERVICED?': row['service_kms_frequency'] || '1000 - 1500kms',
                'A1. Will you recommend / tell / advise your friends or family members for servicing their vehicle at Authorized Service workshop / Authorized Dealer?': wsRec,
                'A2. We have a rating scale from 0 to 10 to understand this better. (9 & 10 means “you will definitely recommend workshop / Dealers to service their vehicle”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”) You can choose': wsRec === 'Yes' ? 'Yes' : 'No',
                // Page 2 Workshop A-section (3a)1–3, 3b)1–3, 4)1–3 with 3 distinct short labels
                ...(wsNps >= 7 ? (() => {
                    const pa = workshopPools(i).a;
                    const pb = workshopPools(i).b;
                    const qKey = wsNps >= 9
                        ? 'Q2-4. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating from 9 (will recommend) to 10 (definitely/gladly recommend)] below: [Yes]'
                        : 'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating from 7 (less likely recommend) to 8 (more likely recommend)] below: [May be]';
                    return {
                        [qKey]: wsNps,
                        // 3a) — filled for BOTH 9–10 and 7–8
                        '3a)1 Which experience you like the most to recommend Workshop / Dealer?': row['workshop_experience_liked'] || pa[0],
                        '3a)2 Which experience you like the most to recommend Workshop / Dealer?': pa[1],
                        '3a)3 Which experience you like the most to recommend Workshop / Dealer?': pa[2],
                        // 3b) — filled for BOTH 9–10 and 7–8
                        '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': row['workshop_improvements_needed'] || pb[0],
                        '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': pb[1],
                        '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': pb[2]
                    };
                })() : (() => {
                    const pc = workshopPools(i).c;
                    return {
                        'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]': wsNps,
                        '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': row['workshop_not_recommend_reasons'] || pc[0],
                        '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': pc[1],
                        '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': pc[2]
                    };
                })()),
                // Page 2 A5 a–j (random from shared set per column)
                ...buildA5Fields(),
                // Page 3 A6–A11 (correlated conditional)
                ...buildA6ToA11Fields(),
                ...bFields,
                ...aBlank,
                // Page 3 TVS Genuine Spare Parts Satisfaction (C1 through C5)
                ...buildCFields(row, i),
                'GPS Watermark Location': row['GPS Watermark Location'] || row['Location'] || 'Conakry, Guinea',
                'GPS Coordinates': row['GPS Coordinates'] || '9.6412, -13.5784'
            };

            // Hierarchical Defect Probing Matrix (Electrical, Engine, Frame Issues mapped from customer box verbatims)
            const fullVerbatim = `${Array.isArray(row['3b_areas_dissatisfaction']) ? row['3b_areas_dissatisfaction'].join(' ') : (row['3b_areas_dissatisfaction'] || '')} ${Array.isArray(row['4_reasons_not_recommend']) ? row['4_reasons_not_recommend'].join(' ') : (row['4_reasons_not_recommend'] || '')} ${Object.values(secA).join(' ')} ${item.text || ''}`.toLowerCase();

            if (fullVerbatim.includes('stand')) {
                combinedRow['Stand Problem [Loose]'] = 'Loose';
            }
            if (fullVerbatim.includes('gear') || fullVerbatim.includes('shifting')) {
                combinedRow['Gear shifting hard Both'] = 'Yes';
                combinedRow['Not Coming to Neutral'] = 'Yes';
            }
            if (fullVerbatim.includes('brake') || fullVerbatim.includes('stopping')) {
                combinedRow['Front brake noise'] = 'Yes';
            }
            if (fullVerbatim.includes('indicator') || fullVerbatim.includes('tsl')) {
                combinedRow['TSL (Indicator) [Light Not working]'] = 'Light Not working';
                combinedRow['TSL (Indicator) [crack]'] = 'Crack';
            }
            if (fullVerbatim.includes('headlight') || fullVerbatim.includes('head lamp')) {
                combinedRow['Head light [DC headlamp]'] = 'Low intensity';
            }
            if (fullVerbatim.includes('speedometer') || fullVerbatim.includes('odometer') || fullVerbatim.includes('meter')) {
                combinedRow['What is the issue in speedometer?'] = 'Speed is not showing';
            }
            if (fullVerbatim.includes('oil leak') || fullVerbatim.includes('leakage')) {
                combinedRow['Engine oil leak'] = 'Cylinder head';
            }
            if (fullVerbatim.includes('engine noise') || fullVerbatim.includes('noise')) {
                combinedRow['Engine noise [Top side]'] = 'Top side';
            }
            if (fullVerbatim.includes('heat') || fullVerbatim.includes('engine heat')) {
                combinedRow['Engine Heat [Both]'] = 'Both';
            }
            if (fullVerbatim.includes('rust')) {
                combinedRow['Engine parts rust'] = 'Engine parts rust';
            }
            if (fullVerbatim.includes('horn')) {
                combinedRow['Horn issues'] = 'Low sound';
            }
            if (fullVerbatim.includes('lock')) {
                combinedRow['Locks not working [Ignition key not working]'] = 'Hard';
            }
            if (fullVerbatim.includes('vibration') || fullVerbatim.includes('shaking')) {
                combinedRow['Handle bar vibration [Both side]'] = 'Both side';
            }
            if (fullVerbatim.includes('clutch')) {
                combinedRow['Clutch hard'] = 'Yes';
            }

            Object.assign(combinedRow, mapPositiveDrivers([
                row['3a)1 why will you recommend your vehicle?'] || secA['3a)1 why will you recommend your vehicle?'],
                row['3a)2 why will you recommend your vehicle?'] || secA['3a)2 why will you recommend your vehicle?'],
                row['3a)3 why will you recommend your vehicle?'] || secA['3a)3 why will you recommend your vehicle?'],
                row['3a)4 why will you recommend your vehicle?'] || secA['3a)4 why will you recommend your vehicle?'],
                row['3a)5 why will you recommend your vehicle?'] || secA['3a)5 why will you recommend your vehicle?']
            ], combinedRow));

            // Negative detractors: 3b + 4 → DF..EM + EP..OJ (never overwrites)
            {
                const neg = mapNegativeDetractors(
                    [
                        secA['3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?']
                    ],
                    [
                        secA['4)1 why will you not recommend your vehicle?'],
                        secA['4)2 why will you not recommend your vehicle?'],
                        secA['4)3 why will you not recommend your vehicle?'],
                        secA['4)4 why will you not recommend your vehicle?'],
                        secA['4)5 why will you not recommend your vehicle?']
                    ],
                    row.complaint_followups || {},
                    i
                );
                for (const [c, v] of Object.entries(neg.l2Slots)) if (!combinedRow[c]) combinedRow[c] = v;
                for (const [c, v] of Object.entries(neg.l3Values)) if (!combinedRow[c]) combinedRow[c] = v;
                for (const [c, v] of Object.entries(neg.followups)) if (!combinedRow[c]) combinedRow[c] = v;
            }

            // Workshop drivers: 3a → OK..OW, 3b+4 → OX..PL (never overwrites)
            {
                const wsDrivers = mapWorkshopDrivers(
                    combinedRow,
                    i,
                    row.workshop_positive_drivers || {},
                    row.workshop_negative_drivers || {}
                );
                for (const [c, v] of Object.entries(wsDrivers.positive)) {
                    if (!combinedRow[c]) combinedRow[c] = v;
                }
                for (const [c, v] of Object.entries(wsDrivers.negative)) {
                    if (!combinedRow[c]) combinedRow[c] = v;
                }
            }

            const autoFilledKeys = [];
            for (const k of Object.keys(combinedRow)) {
                if (k.startsWith('__')) continue;
                if (row[k] === undefined || row[k] === null || row[k] === '') {
                    if (combinedRow[k] !== undefined && combinedRow[k] !== '' && combinedRow[k] !== '—') {
                        autoFilledKeys.push(k);
                    }
                }
            }
            combinedRow.__autoFilledKeys = autoFilledKeys;

            const standardizedRow = orderColumns(combinedRow);

            // Running stats
            if (sentiment === 'Promoter') promoters++;
            else if (sentiment === 'Passive') passives++;
            else detractors++;

            if (vinRes.matchStatus.includes('Match') && !vinRes.matchStatus.includes('Mismatch')) {
                matchCount++;
            }

            rows.push(standardizedRow);

            const countSoFar = rows.length;
            const netNps = Math.round(((promoters - detractors) / countSoFar) * 100);

            sendEvent('record', {
                index: i + 1,
                total,
                label: item.label,
                row: standardizedRow,
                stats: {
                    processed: countSoFar,
                    promoters,
                    passives,
                    detractors,
                    netNps,
                    matchRate: Math.round((matchCount / countSoFar) * 100)
                }
            });

            // Smooth pacing for UI updates and avoiding rate limits
            await new Promise(r => setTimeout(r, 120));
        }

        const columns = GUINEA_COLUMNS_449;

        sendEvent('done', {
            total,
            processed: rows.length,
            columns,
            stats: {
                processed: rows.length,
                promoters,
                passives,
                detractors,
                netNps: rows.length > 0 ? Math.round(((promoters - detractors) / rows.length) * 100) : 0,
                matchRate: rows.length > 0 ? Math.round((matchCount / rows.length) * 100) : 100
            }
        });

        res.end();
    } catch (streamErr) {
        console.error('Batch stream error:', streamErr);
        sendEvent('error', { error: streamErr.message || 'Stream analysis failed' });
        res.end();
    } finally {
        for (const file of uploadedFiles) {
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
        }
    }
});

// -------------------------------------------------------------
// POST /api/analyze-pdf (Synchronous legacy/single endpoint)
// Also upgraded to safely handle multi-page PDFs
// -------------------------------------------------------------
app.post('/api/analyze-pdf', upload.any(), async (req, res) => {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    try {
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const primaryFile = uploadedFiles[0];
        const buffer = fs.readFileSync(primaryFile.path);
        const { totalPages, pages, fullText } = await extractPdfPages(buffer);
        const scans = extractScannedImages(buffer);
        const effectiveKey = process.env.GEMINI_API_KEY;

        const rows = [];
        const count = Math.max(pages.length, scans.length, 1);

        for (let i = 0; i < count; i++) {
            let row = null;
            if (effectiveKey) {
                row = await analyzeSingleRecordWithGemini({
                    text: pages[i] || fullText,
                    imageBuffer: scans[i] || null,
                    index: i,
                    label: `Record #${i + 1}`
                }, effectiveKey);
            }
            if (!row) {
                row = heuristicExtractRecord(pages[i] || fullText, i, `Record #${i + 1}`);
            }

            const nps = parseInt(row['2. Likely to recommend vehicle (0-10)'] ?? row['Product NPS Score'] ?? row['NPS Score'] ?? 9, 10);
            const sentiment = nps >= 9 ? 'Promoter' : nps >= 7 ? 'Passive' : 'Detractor';

            const vinRes = resolveVinMatch(
                row['VIN No. (Qualifying Question)'] || row['Form VIN'] || row['VIN / Chassis'],
                row['Stamped Metal VIN'],
                pages[i] || fullText || ''
            );

            let syncVinPhotoLink = '';
            if (Array.isArray(scans) && scans.length > 0) {
                const vinPhotoBuffer = scans.length >= 4 ? scans[scans.length - 1] : scans[0];
                const safeVin = String(vinRes.formVin || row['Stamped Metal VIN'] || `VIN_${i + 1}`).replace(/[^A-Za-z0-9]/g, '');
                const vinFileName = `vin_${Date.now()}_${safeVin}.jpg`;
                try {
                    syncVinPhotoLink = await uploadBufferToDrive(vinPhotoBuffer, vinFileName, 'image/jpeg');
                } catch (e) {
                    console.error('Drive upload failed (sync):', e.message);
                }
            }

            const date = row['SURVEY DATE'] || row['Date'] || new Date().toISOString().split('T')[0];

            const base449 = {};
            for (const c of GUINEA_COLUMNS_449) {
                base449[c] = '';
            }

            const secA = getSectionAFields(row, i, nps);
            const wsNps = parseInt(row['workshop_likelihood_A2'] || row['workshop_overall_rating_A11'] || 10, 10);
            const wsRec = row['workshop_recommend_A1'] || (wsNps >= 7 ? 'Yes' : 'No');

            const bFields = buildBFields(row, i);
            const isBSurvey = bFields.__isBSurvey === true;
            delete bFields.__isBSurvey;
            const aBlank = isBSurvey ? {
                'Q2-4. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating from 9 (will recommend) to 10 (definitely/gladly recommend)] below: [Yes]': '',
                'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating from 7 (less likely recommend) to 8 (more likely recommend)] below: [May be]': '',
                'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]': '',
                '3a)1 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3a)2 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3a)3 Which experience you like the most to recommend Workshop / Dealer?': '',
                '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': '',
                '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': '',
                '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': '',
                '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': ''
            } : {};

            const combinedSyncRow = {
                '#': i + 1,
                ...base449,
                ...row,
                ...secA,
                'Timestamp': row['Timestamp'] || `${date} 10:30`,
                'SURVEY DATE': date,
                'SURVEYOR NAME': row['SURVEYOR NAME'] || 'Moussa',
                'SURVEY LOCATION': row['SURVEY LOCATION'] || row['Location'] || 'Conakry',
                'BRAND & MODEL (Qualifying Question)': row['BRAND & MODEL (Qualifying Question)'] || row['Vehicle Model'] || 'TVS HLX 125',
                'VIN No. (Qualifying Question)': vinRes.formVin,
                'VIN Match Status': vinRes.matchStatus,
                'Please take a picture of the VIN no. and upload it here. (Qualifying Question)':
                    syncVinPhotoLink || row['Please take a picture of the VIN no. and upload it here. (Qualifying Question)'] || '',
                'Google Drive Image Link': syncVinPhotoLink || row['Google Drive Image Link'] || '',
                'ODOMETER READING (Kms)': row['ODOMETER READING (Kms)'] || row['Odometer Reading'] || '19399',
                'MODE OF PURCHASE': row['MODE OF PURCHASE'] || 'New',
                'DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER': row['DATE OF PURCHASING THE VEHICLE FROM DEALER / PREVIOUS OWNER'] || date,
                'USER NAME': row['USER NAME'] || row['Customer Name'] || `User #${i + 1}`,
                'USER AGE (YEARS) (enter only a full number between 18 to 60)': row['USER AGE (YEARS) (enter only a full number between 18 to 60)'] || '25',
                'USER AGE GROUP': row['USER AGE GROUP'] || '20-30',
                'USER PROFESSION': row['USER PROFESSION'] || 'Business',
                'MOBILE NUMBER': row['MOBILE NUMBER'] || row['Mobile'] || '—',
                'ALTERNATE MOBILE NUMBER': row['ALTERNATE MOBILE NUMBER'] || '—',
                'OWNERSHIP (OWN / HIRED)': row['OWNERSHIP (OWN / HIRED)'] || 'Own',
                'FOR WHAT PURPOSE DO YOU USE THE VEHICLE?': row['FOR WHAT PURPOSE DO YOU USE THE VEHICLE?'] || 'Personal use',
                'MODEL YEAR OF YOUR VEHICLE': row['MODEL YEAR OF YOUR VEHICLE'] || '2025',
                'A': row['A'] || row['HOW LONG HAVE YOU BEEN USING THIS VEHICLE?'] || '3-6 months ( from Feb - 2026 to Apr - 2026)',
                'HOW LONG HAVE YOU BEEN USING THIS VEHICLE?': row['HOW LONG HAVE YOU BEEN USING THIS VEHICLE?'] || row['A'] || '3-6 months ( from Feb - 2026 to Apr - 2026)',
                'PREVIOUS VEHICLE USED Brand & Model': row['PREVIOUS VEHICLE USED Brand & Model'] || row['PREVIOUS VEHICLE USED\r\nBrand & Model'] || 'Yamaha',
                'HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)': row['HOW LONG DID YOU USE THE PREVIOUS VEHICLE? (Years)'] || '2',
                'Q1-1 WHERE DO YOU GET YOUR VEHICLE SERVICED?': row['service_workshop_type'] || 'Authorized Workshop',
                'Q1-2 Dealer / Authorized Workshop Name': row['dealer_workshop_name'] || 'Auth. Dealer',
                'Q1-3 WHAT TIME FREQUENCY DO YOU GET YOUR VEHICLE SERVICED?': row['service_time_frequency'] || 'Monthly once',
                'Q1-4 WHAT KMS FREQUENCY DO YOU GET YOUR VEHICLE SERVICED?': row['service_kms_frequency'] || '1000 - 1500kms',
                'A1. Will you recommend / tell / advise your friends or family members for servicing their vehicle at Authorized Service workshop / Authorized Dealer?': wsRec,
                'A2. We have a rating scale from 0 to 10 to understand this better. (9 & 10 means “you will definitely recommend workshop / Dealers to service their vehicle”, 7 & 8 means “May be recommend”, 6 and below means “No, definitely not recommend”) You can choose': wsRec === 'Yes' ? 'Yes' : 'No',
                ...(wsNps >= 7 ? (() => {
                    const pa = workshopPools(i).a;
                    const pb = workshopPools(i).b;
                    const qKey = wsNps >= 9
                        ? 'Q2-4. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "Yes", select a rating from 9 (will recommend) to 10 (definitely/gladly recommend)] below: [Yes]'
                        : 'Q2-3. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "May be", select a rating from 7 (less likely recommend) to 8 (more likely recommend)] below: [May be]';
                    return {
                        [qKey]: wsNps,
                        // 3a) — filled for BOTH 9–10 and 7–8
                        '3a)1 Which experience you like the most to recommend Workshop / Dealer?': row['workshop_experience_liked'] || pa[0],
                        '3a)2 Which experience you like the most to recommend Workshop / Dealer?': pa[1],
                        '3a)3 Which experience you like the most to recommend Workshop / Dealer?': pa[2],

                        // 3b) — filled for BOTH 9–10 and 7–8
                        '3b)1 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': row['workshop_improvements_needed'] || pb[0],
                        '3b)2 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': pb[1],
                        '3b)3 Can you please tell us if there are any expectation or areas of improvement you wish to experience in your workshop visit for Service?': pb[2]
                    };
                })() : (() => {
                    const pc = workshopPools(i).c;
                    return {
                        'Q2-2. REASON FOR RECOMMENDING [If answer to the above question Q4-1 is "No", select a rating from 0 (will not at all recommend) to 6 (recommend but with reservations)] below: [No]': wsNps,
                        '4)1 What are the main reasons for you have not recommend Workshop / Dealer?': row['workshop_not_recommend_reasons'] || pc[0],
                        '4)2 What are the main reasons for you have not recommend Workshop / Dealer?': pc[1],
                        '4)3 What are the main reasons for you have not recommend Workshop / Dealer?': pc[2]
                    };
                })()),
                ...buildA5Fields(row),
                ...buildA6ToA11Fields(row),
                ...bFields,
                ...aBlank,
                ...buildCFields(row, i),
                'GPS Watermark Location': row['GPS Watermark Location'] || row['Location'] || 'Conakry, Guinea',
                'GPS Coordinates': row['GPS Coordinates'] || '9.6412, -13.5784'
            };

            Object.assign(combinedSyncRow, mapPositiveDrivers([
                combinedSyncRow['3a)1 why will you recommend your vehicle?'] || row['3a)1 why will you recommend your vehicle?'],
                combinedSyncRow['3a)2 why will you recommend your vehicle?'] || row['3a)2 why will you recommend your vehicle?'],
                combinedSyncRow['3a)3 why will you recommend your vehicle?'] || row['3a)3 why will you recommend your vehicle?'],
                combinedSyncRow['3a)4 why will you recommend your vehicle?'] || row['3a)4 why will you recommend your vehicle?'],
                combinedSyncRow['3a)5 why will you recommend your vehicle?'] || row['3a)5 why will you recommend your vehicle?']
            ], combinedSyncRow));

            {
                const neg = mapNegativeDetractors(
                    [
                        secA['3b.1. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 2. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 3. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 4. Can you please tell us if there are any areas of dissatisfaction or improvements needed?'],
                        secA['3b. 5. Can you please tell us if there are any areas of dissatisfaction or improvements needed?']
                    ],
                    [
                        secA['4)1 why will you not recommend your vehicle?'],
                        secA['4)2 why will you not recommend your vehicle?'],
                        secA['4)3 why will you not recommend your vehicle?'],
                        secA['4)4 why will you not recommend your vehicle?'],
                        secA['4)5 why will you not recommend your vehicle?']
                    ],
                    row.complaint_followups || {},
                    i
                );
                for (const [c, v] of Object.entries(neg.l2Slots)) if (!combinedSyncRow[c]) combinedSyncRow[c] = v;
                for (const [c, v] of Object.entries(neg.l3Values)) if (!combinedSyncRow[c]) combinedSyncRow[c] = v;
                for (const [c, v] of Object.entries(neg.followups)) if (!combinedSyncRow[c]) combinedSyncRow[c] = v;
            }

            // Workshop drivers: 3a → OK..OW, 3b+4 → OX..PL (never overwrites)
            {
                const wsDrivers = mapWorkshopDrivers(
                    combinedSyncRow,
                    i,
                    row.workshop_positive_drivers || {},
                    row.workshop_negative_drivers || {}
                );
                for (const [c, v] of Object.entries(wsDrivers.positive)) {
                    if (!combinedSyncRow[c]) combinedSyncRow[c] = v;
                }
                for (const [c, v] of Object.entries(wsDrivers.negative)) {
                    if (!combinedSyncRow[c]) combinedSyncRow[c] = v;
                }
            }

            const autoFilledKeys = [];
            for (const k of Object.keys(combinedSyncRow)) {
                if (k.startsWith('__')) continue;
                if (row[k] === undefined || row[k] === null || row[k] === '') {
                    if (combinedSyncRow[k] !== undefined && combinedSyncRow[k] !== '' && combinedSyncRow[k] !== '—') {
                        autoFilledKeys.push(k);
                    }
                }
            }
            combinedSyncRow.__autoFilledKeys = autoFilledKeys;

            rows.push(orderColumns(combinedSyncRow));
        }

        const columns = rows.length > 0 ? Object.keys(rows[0]).filter(c => c !== '#') : [];
        res.json({
            success: true,
            columns,
            rows
        });
    } catch (err) {
        console.error('Analyze PDF error:', err);
        res.status(500).json({ error: err.message || 'Error analyzing PDF' });
    } finally {
        for (const file of uploadedFiles) {
            if (file.path && fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
