const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const videoDir = path.join(__dirname, '..', 'upload', 'videos');
const imageDir = path.join(__dirname, '..', 'upload', 'images');
const signatureDir = path.join(__dirname, '..', 'upload', 'signatures');
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(signatureDir, { recursive: true });

// save signature dataURL to signatures table (insert -> write -> update)
async function saveSignatureFromDataUrl(db, dataUrl, clientName) {
    return new Promise((resolve, reject) => {
        if (!dataUrl || typeof dataUrl !== 'string') return resolve(null);
        const comma = dataUrl.indexOf(',');
        if (comma === -1) return resolve(null);
        const b64 = dataUrl.slice(comma + 1);
        let buffer;
        try { buffer = Buffer.from(b64, 'base64'); } catch (e) { return resolve(null); }

        const ensureSql = `
          CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketID INTEGER,
            filename TEXT NOT NULL,
            originalName TEXT NOT NULL,
            relativePath TEXT NOT NULL,
            uploadDate TEXT DEFAULT (datetime('now'))
          )`;
        db.run(ensureSql, (ensureErr) => {
            if (ensureErr) return reject(ensureErr);

            const tempName = `signature-pending-${Date.now()}.tmp`;
            const tempRel = path.join('upload', 'signatures', tempName).split(path.sep).join('/');
            const insertSql = `INSERT INTO signatures (ticketID, filename, originalName, relativePath, uploadDate)
                               VALUES (?, ?, ?, ?, datetime('now'))`;
            db.run(insertSql, [null, tempName, clientName || tempName, tempRel], function (insertErr) {
                if (insertErr) return reject(insertErr);
                const sigId = this.lastID;
                const finalName = (clientName && path.basename(String(clientName))) || `signature-${sigId}.png`;
                const savePath = path.join(signatureDir, finalName);
                fs.writeFile(savePath, buffer, (writeErr) => {
                    if (writeErr) {
                        // remove placeholder row on failure
                        db.run('DELETE FROM signatures WHERE id = ?', [sigId], () => {
                            return reject(writeErr);
                        });
                        return;
                    }
                    const relPath = path.relative(path.join(__dirname, '..'), savePath).split(path.sep).join('/');
                    const updateSql = `UPDATE signatures SET filename = ?, relativePath = ? WHERE id = ?`;
                    db.run(updateSql, [finalName, relPath, sigId], function (updErr) {
                        if (updErr) {
                            try { fs.unlinkSync(savePath); } catch (e) { /* ignore */ }
                            db.run('DELETE FROM signatures WHERE id = ?', [sigId], () => {
                                return reject(updErr);
                            });
                            return;
                        }
                        return resolve({ id: sigId, filename: finalName, relativePath: relPath });
                    });
                });
            });
        });
    });
}

// video storage
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, videoDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Only video files are allowed'));
    }
});

// image storage (matches video flow, uses field name 'image')
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, imageDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const imageUpload = multer({
    storage: imageStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// signature storage + multipart upload route
const signatureStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, signatureDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'signature-' + uniqueSuffix + ext);
    }
});

const signatureUpload = multer({
    storage: signatureStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
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

    // treat edit mode: if the query param `edit` is provided, respect it; otherwise default to edit mode for DB-loaded tickets
    const editParam = typeof req.query.edit !== 'undefined' ? String(req.query.edit).toLowerCase() : undefined;
    const explicitEdit = typeof editParam === 'undefined' ? true : (editParam === 'true' || editParam === '1' || editParam === 'yes');

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

                // scan all user tables and load rows that reference this ticket (by ticket id column)
                db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err4, tables) => {
                    const renderWithJoinedSections = () => {
                        const courtesyJoinSql = `
                          SELECT cti.*, ct.ticketID AS courtesyTicketID, ct.comments AS courtesyComments
                          FROM courtesyTableItems cti
                          INNER JOIN courtesyTable ct ON cti.tableID = ct.id
                          WHERE ct.ticketID = ?
                          ORDER BY cti.id ASC
                        `;
                        const steeringJoinSql = `
                                                    SELECT sst.*, ss.ticketID AS steeringTicketID, ss.comments AS steeringComments
                                                    FROM steeringSuspensionTable sst
                                                    INNER JOIN steeringSuspension ss ON sst.steeringSuspensionID = ss.id
                                                    WHERE ss.ticketID = ?
                                                    ORDER BY sst.id ASC
                                                `;

                        db.all(courtesyJoinSql, [ticketId], (cErr, courtesyRows) => {
                            if (cErr) {
                                console.error('Error loading courtesy joined rows:', cErr);
                            } else if (Array.isArray(courtesyRows) && courtesyRows.length) {
                                ticket.sections.courtesyTableItems = courtesyRows;
                            }

                            db.all(steeringJoinSql, [ticketId], (sErr, steeringRows) => {
                                if (sErr) {
                                    console.error('Error loading steering joined rows:', sErr);
                                } else {
                                    ticket.sections = ticket.sections || {};
                                    ticket.sections.steeringSuspensionTable = steeringRows || [];
                                }

                                // also load brakes joined rows (parent comments + child rows)
                                const brakesJoinSql = `
                                  SELECT bt.*, b.ticketID AS brakesTicketID, b.comments AS brakesComments
                                  FROM brakesTable bt
                                  INNER JOIN brakes b ON bt.brakesID = b.id
                                  WHERE b.ticketID = ?
                                  ORDER BY bt.id ASC
                                `;
                                db.all(brakesJoinSql, [ticketId], (bErr, brakesRows) => {
                                    if (bErr) {
                                        console.error('Error loading brakes joined rows:', bErr);
                                    } else if (Array.isArray(brakesRows) && brakesRows.length) {
                                        ticket.sections = ticket.sections || {};
                                        ticket.sections.brakesTable = brakesRows;
                                    }

                                    // load emissions child rows joined to their parent (emissions) so client can populate the visual table
                                    const emissionsJoinSql = `
                                                                        SELECT et.*, e.ticketID AS emissionsTicketID, e.comments AS emissionsComments, e.obd AS emissionsOBD, e.inspections AS emissionsInspections, e.emissionsDue AS emissionsDue, e.nextOilChange AS emissionsNextOilChange, e.inspectedBy AS emissionsInspectedBy, e.reInspectedBy AS emissionsReInspectedBy
                                                                        FROM emissionsTable et
                                                                        INNER JOIN emissions e ON et.emissionsID = e.id
                                                                        WHERE e.ticketID = ?
                                                                        ORDER BY et.id ASC
                                                                    `;

                                    db.all(emissionsJoinSql, [ticketId], (emErr, emissionsRows) => {
                                        if (emErr) {
                                            console.error('Error loading emissions joined rows:', emErr);
                                        } else {
                                            ticket.sections = ticket.sections || {};
                                            ticket.sections.emissionsTable = emissionsRows || [];
                                        }

                                        // also fetch the emissions parent row (contains ticket-level fields and comments)
                                        db.get('SELECT * FROM emissions WHERE ticketID = ?', [ticketId], (epErr, emissionsParent) => {
                                            if (epErr) {
                                                console.error('Error fetching emissions parent:', epErr);
                                            }
                                            ticket.sections = ticket.sections || {};
                                            ticket.sections.emissions = emissionsParent || null;

                                            // fetch warnings linked to this emissions parent (if any)
                                            if (emissionsParent && emissionsParent.id) {
                                                db.all('SELECT * FROM warningsTable WHERE emissionsID = ?', [emissionsParent.id], (wErr, warnRows) => {
                                                    if (wErr) console.error('Error loading emissions warnings:', wErr);
                                                    ticket.sections.emissionsWarnings = warnRows || [];
                                                    return res.render('mechanic', { ticket, editMode: explicitEdit });
                                                });
                                            } else {
                                                ticket.sections.emissionsWarnings = [];
                                                return res.render('mechanic', { ticket, editMode: explicitEdit });
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    };

                    if (err4) {
                        console.error('Error fetching table list:', err4);
                        ticket.sections = {};
                        return renderWithJoinedSections();
                    }
                    ticket.sections = {};
                    if (!Array.isArray(tables) || tables.length === 0) return renderWithJoinedSections();

                    // process each table and collect rows where a ticketID-like column equals the ticketId
                    let pending = tables.length;
                    tables.forEach(trow => {
                        const tableName = trow && trow.name;
                        if (!tableName) {
                            if (--pending === 0) return renderWithJoinedSections();
                            return;
                        }

                        // skip the core tickets table to avoid recursion
                        if (tableName.toLowerCase() === 'tickets') {
                            if (--pending === 0) return renderWithJoinedSections();
                            return;
                        }

                        // inspect table columns to find a ticket identifier column
                        db.all(`PRAGMA table_info("${tableName}")`, [], (err5, cols) => {
                            if (err5 || !Array.isArray(cols)) {
                                if (err5) console.error('PRAGMA table_info error for', tableName, err5);
                                if (--pending === 0) return renderWithJoinedSections();
                                return;
                            }

                            // find a column whose name looks like ticket id (case-insensitive)
                            const colNames = cols.map(c => c && c.name).filter(Boolean);
                            const candidate = colNames.find(cn => {
                                const low = String(cn).toLowerCase();
                                return low === 'ticketid' || low === 'ticket_id' || (low.includes('ticket') && low.includes('id'));
                            });
                            if (!candidate) {
                                if (--pending === 0) return renderWithJoinedSections();
                                return;
                            }

                            // query rows matching this ticket id
                            const q = `SELECT * FROM "${tableName}" WHERE "${candidate}" = ?`;
                            db.all(q, [ticketId], (err6, rows2) => {
                                if (err6) {
                                    console.error('Failed to load rows from', tableName, 'by', candidate, err6);
                                } else if (rows2 && rows2.length) {
                                    // attach rows under the table name so client can render appropriately
                                    ticket.sections[tableName] = rows2;
                                }
                                if (--pending === 0) return renderWithJoinedSections();
                            });
                        });
                    });
                });
            });
        });
    });
});

router.post('/mechanic', async (req, res) => {
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

    // try to save signature first (uses req.body.signature dataURL if present)
    let savedSignature = null;
    try {
        if (signature) {
            savedSignature = await saveSignatureFromDataUrl(db, signature, req.body.signatureFilename || req.body.signatureFileName || 'signature.png');
            if (savedSignature) console.log('Saved signature before ticket insert:', savedSignature);
        }
    } catch (sigErr) {
        console.error('Failed to save signature before ticket insert:', sigErr);
        return res.status(500).send('Failed to save signature');
    }

    // helper: attach saved signature row to a ticket id (no-op if no savedSignature)
    const attachSavedSignature = (ticketIdToAttach) => {
        if (!savedSignature || !savedSignature.id || !ticketIdToAttach) return;
        db.run('UPDATE signatures SET ticketID = ? WHERE id = ?', [ticketIdToAttach, savedSignature.id], (sigErr) => {
            if (sigErr) console.error('Failed to attach signature to ticket', ticketIdToAttach, sigErr);
        });
    };

    // Ensure Repair Order is provided (schema requires a repairOrderNumber/roNum)
    if (!roNum || String(roNum).trim() === '') {
        console.warn('POST /mechanic: missing roNum in request body');
        return res.status(400).send('Repair Order number (roNum) is required');
    }

    // parse repairs
    let repairs = [];
    try { if (req.body.repairs) repairs = JSON.parse(req.body.repairs); } catch (e) { repairs = []; }

    const recommendedRepairsText = JSON.stringify(repairs || []);

    // read incoming ticket id (if editing an existing ticket)
    const incomingTicketId = req.body.ticketId;

    // Ensure schema has roNum/repairOrderNumber column, then INSERT or UPDATE with RO included
    db.all("PRAGMA table_info('tickets')", [], (err, cols) => {
        if (err) {
            console.error('Failed to read tickets table info', err);
        }
        const hasRepairOrderNumber = Array.isArray(cols) && cols.some(c => c && c.name === 'repairOrderNumber');
        const hasRo = Array.isArray(cols) && cols.some(c => c && c.name === 'roNum');

        const performUpdate = (colName, targetId) => {
            const updateCols = `${colName} = ?, date = ?, techName = ?, timeIn = ?, timeOut = ?, totalTime = ?, customerName = ?, customerAddress = ?, customerPhone = ?, customerEmail = ?, concern = ?, diagnosis = ?, recommendedRepairs = ?, dateSigned = ?, stat = ?`;
            const updateSql = `UPDATE tickets SET ${updateCols} WHERE id = ?`;
            const updateParams = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus, targetId];
            console.log('Updating ticket id', targetId, 'with params:', updateParams);
            db.run(updateSql, updateParams, function (updErr) {
                if (updErr) {
                    console.error('Failed to update existing ticket:', updErr);
                    return res.status(500).send('Failed to update existing ticket: ' + (updErr.message || 'unknown'));
                }

                // attach saved signature (if any) to this ticket
                attachSavedSignature(targetId);

                // Replace recRepairs for this ticket
                db.run('DELETE FROM recRepairs WHERE ticketId = ?', [targetId], (delErr) => {
                    if (delErr) console.error('Failed to delete old recRepairs for ticket', targetId, delErr);

                    if (!repairs || repairs.length === 0) return res.redirect('/mechanic?id=' + targetId);

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

                        stmt.run([targetId, desc, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal], (rErr) => {
                            if (rErr) console.error('Failed to insert recRepair row for existing ticket:', rErr);
                        });
                    });
                    stmt.finalize((finalErr) => {
                        if (finalErr) console.error('Failed finalizing recRepairs stmt for existing ticket:', finalErr);
                        return res.redirect('/mechanic?id=' + targetId);
                    });
                });
            });
        };

        const chooseAndInsert = (colName) => {
            const insertCols = `${colName}, date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned, stat`;
            const insertPlaceholders = Array(insertCols.split(',').length).fill('?').join(', ');
            const insertTicketSql = `INSERT INTO tickets (${insertCols}) VALUES (${insertPlaceholders})`;
            const ticketParams = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus];
            console.log('Inserting ticket with params:', ticketParams);

            // If inserting into the repairOrderNumber column (which is UNIQUE in schema),
            // check for an existing ticket with the same RO and return a friendly error instead of letting SQLite throw.
            if (String(colName).toLowerCase() === 'repairordernumber') {
                db.get(`SELECT id FROM tickets WHERE "${colName}" = ?`, [roNum], (existsErr, existsRow) => {
                    if (existsErr) {
                        console.error('Failed to check existing repair order:', existsErr);
                        return res.status(500).send('Database error');
                    }
                    if (existsRow) {
                        // Conflict: RO already exists
                        return res.status(409).send('Repair Order number already exists. Use a unique RO or edit the existing ticket.');
                    }
                    // safe to insert
                    db.run(insertTicketSql, ticketParams, function (err) {
                        if (err) {
                            console.error('Failed to insert ticket:', err);
                            return res.status(500).send('Failed to insert ticket: ' + (err && err.message ? err.message : 'unknown'));
                        }

                        const ticketId = this.lastID;
                        console.log('Inserted ticket id', ticketId);

                        // attach saved signature (if any) to the newly created ticket
                        attachSavedSignature(ticketId);

                        if (!repairs || repairs.length === 0) return res.redirect('/mechanic?id=' + ticketId);

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
