const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'upload/videos/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'));
        }
    }
});

router.get('/mechanic', (req, res) => {
    const userCookie = req.cookies.user;
    if (!userCookie) return res.redirect('/login');

    const ticketId = req.query.id || req.query.ticketId;
    const db = req.app.locals.db;
    if (!ticketId) {
        return res.render('mechanic');
    }

    if (!db) return res.status(500).send('Database not available');

    db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err) {
            console.error('Error fetching ticket:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!ticket) return res.status(404).send('Ticket not found');

        db.all('SELECT * FROM recRepairs WHERE ticketId = ?', [ticketId], (err2, repairs) => {
            if (err2) {
                console.error('Error fetching repairs:', err2);
                repairs = [];
            }
            db.get('SELECT * FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err3, vehicle) => {
                if (err3) {
                    console.error('Error fetching vehicle info:', err3);
                    vehicle = null;
                }
                ticket.repairs = repairs || [];
                ticket.vehicle = vehicle || null;
                return res.render('mechanic', { ticket });
            });
        });
    });
});

router.post('/mechanic', (req, res) => {
    // collect fields
    const roNum = req.body.roNum;
    const roDate = req.body.roDate;
    const technician = req.body.technician;
    const timeArrive = req.body.timeIn;
    const timeOut = req.body.timeOut;
    const totTime = req.body.totTime;
    const custName = req.body.custName;
    const custAdd = req.body.custAddress;
    const custPhone = req.body.custPhone;
    const custEmail = req.body.custEmail;
    const concern = req.body.concern;
    const diagnosis = req.body.diagnosis;
    const sDate = req.body.sDate;
    const signature = req.body.signature;
    const ticketStatus = req.body.ticketStatus || 'open';

    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    // parse repairs
    let repairs = [];
    try { if (req.body.repairs) repairs = JSON.parse(req.body.repairs); } catch (e) { repairs = []; }

    const recommendedRepairsText = JSON.stringify(repairs || []);

    // Ensure schema has roNum column, then INSERT
    db.all("PRAGMA table_info('tickets')", [], (err, cols) => {
        if (err) {
            console.error('Failed to read tickets table info', err);
            return res.status(500).send('Database error');
        }
        const hasRepairOrderNumber = Array.isArray(cols) && cols.some(c => c && c.name === 'repairOrderNumber');
        const hasRo = Array.isArray(cols) && cols.some(c => c && c.name === 'roNum');

        const chooseAndInsert = (colName) => {
            const insertCols = `${colName}, date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned, stat`;
            const insertPlaceholders = Array(insertCols.split(',').length).fill('?').join(', ');
            const insertTicketSql = `INSERT INTO tickets (${insertCols}) VALUES (${insertPlaceholders})`;
            const ticketParams = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus];

            db.run(insertTicketSql, ticketParams, function(err) {
                if (err) {
                    console.error('Failed to insert ticket:', err);
                    return res.status(500).send('Failed to save ticket');
                }

                const ticketId = this.lastID;
                console.log('Inserted ticket id', ticketId);

                if (!repairs || repairs.length === 0) return res.redirect('/mechanic');

                const insertRecSql = `INSERT INTO recRepairs (ticketId, repairDescription, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const stmt = db.prepare(insertRecSql);
                repairs.forEach(r => {
                    const desc = r.repairDescription || '';
                    const qty = Number.isFinite(Number(r.qty)) ? parseInt(r.qty) : (r.qty ? parseInt(r.qty) : 0);
                    const partNumber = r.partNumber || '';
                    const partPrice = Number.isFinite(Number(r.partPrice)) ? parseFloat(r.partPrice) : (r.partPrice ? parseFloat(r.partPrice) : 0);
                    const partsTotal = Number.isFinite(Number(r.partsTotal)) ? parseFloat(r.partsTotal) : (r.partsTotal ? parseFloat(r.partsTotal) : (qty * partPrice));
                    const laborHours = Number.isFinite(Number(r.laborHours)) ? parseFloat(r.laborHours) : (r.laborHours ? parseFloat(r.laborHours) : 0);
                    const laborTotal = Number.isFinite(Number(r.laborTotal)) ? parseFloat(r.laborTotal) : (r.laborTotal ? parseFloat(r.laborTotal) : (laborHours * 100));

                    stmt.run([ticketId, desc, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal], (err) => {
                        if (err) console.error('Failed to insert recRepair row:', err);
                    });
                });
                stmt.finalize((err) => {
                    if (err) console.error('Failed finalizing recRepairs stmt:', err);
                    return res.redirect('/mechanic');
                });
            });
        };

        if (hasRepairOrderNumber) return chooseAndInsert('repairOrderNumber');
        if (hasRo) return chooseAndInsert('roNum');

        // prefer adding repairOrderNumber to match existing schema expectations
        db.run("ALTER TABLE tickets ADD COLUMN repairOrderNumber TEXT", [], (err2) => {
            if (err2) console.error('Failed to add repairOrderNumber column to tickets table', err2);
            chooseAndInsert('repairOrderNumber');
        });
    });
});


router.post('/upload-video', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        console.log('Video uploaded successfully:', req.file.filename);
        console.log('File size:', req.file.size, 'bytes');
        console.log('Original name:', req.file.originalname);
        
        res.json({ 
            success: true, 
            message: 'Video uploaded successfully',
            filename: req.file.filename,
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

module.exports = router;
