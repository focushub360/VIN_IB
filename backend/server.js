require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sequelize = require('./database');
const User = require('./models/User');
const Inspection = require('./models/Inspection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'vin-inspector-secret-key'; // In prod, use .env

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

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
});

// --- ROUTES ---

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

        // Extract file ID
        let fileId = null;
        if (driveLink.includes('id=')) {
            fileId = driveLink.split('id=')[1].split('&')[0];
        } else if (driveLink.includes('/d/')) {
            fileId = driveLink.split('/d/')[1].split('/')[0];
        }
        
        if (!fileId) return res.status(400).json({ error: 'Invalid Google Drive link' });

        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        // Fetch image as arraybuffer
        const response = await axios.get(downloadUrl, { 
            responseType: 'arraybuffer',
            timeout: 20000 
        });
        
        // Check if the link is public (Google returns HTML login page if private)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            return res.json({ 
                extractedVin: 'Error: Drive Link Not Public', 
                isMatch: false,
                geoLocation: null
            });
        }

        const buffer = Buffer.from(response.data);

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

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
