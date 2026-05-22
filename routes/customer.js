const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { ensureLoggedIn } = require('../middleware/auth');

router.get('/customer', ensureLoggedIn, (req, res) => {
    const session = req.user || req.cookies.user;
    const ticketId = req.query.ticketId;

    console.log('debug - Ticket ID from URL:', ticketId);

    if (session) {
        try {
            const user = (typeof session === 'string') ? JSON.parse(session) : session;
            const email = user.email.toLowerCase();
            const db = req.app.locals.db;

            if (!db) {
                console.error('Database connection not available');
                return res.status(500).send('Database error');
            }

            if (!ticketId) {
                console.log('No ticketId provided, redirecting to customerDis');
                return res.redirect('/customerDis');
            }

            console.log(`Looking for ticket ${ticketId} for user ${email}`);

            // Get specific ticket for this user
            db.get('SELECT * FROM tickets WHERE id = ? AND LOWER(customerEmail) = ? AND stat = ?',
                [ticketId, email, 'complete'], (err, ticket) => {
                    if (err) {
                        console.error('Database error:', err.message);
                        return res.status(500).send('Database error');
                    }

                    if (!ticket) {
                        console.log(`Ticket ${ticketId} not found for user ${email}`);
                        return res.redirect('/customerDis');
                    }

                    console.log('Ticket found! Processing repairs...');
                    console.log('Raw recommendedRepairs field:', ticket.recommendedRepairs);

                    // Parse repairs from the recommendedRepairs text field
                    let repairs = [];
                    try {
                        if (ticket.recommendedRepairs && ticket.recommendedRepairs.trim() !== '') {
                            // If it's JSON, parse it
                            if (ticket.recommendedRepairs.startsWith('[') || ticket.recommendedRepairs.startsWith('{')) {
                                repairs = JSON.parse(ticket.recommendedRepairs);
                            } else {
                                // If it's plain text, create a simple repair object
                                repairs = [{
                                    repairDescription: ticket.recommendedRepairs,
                                    qty: '',
                                    partNumber: '',
                                    partsTotal: 0,
                                    laborTotal: 0
                                }];
                            }
                        }
                    } catch (parseError) {
                        console.error('Error parsing recommendedRepairs:', parseError);
                        // Treat as plain text
                        repairs = [{
                            repairDescription: ticket.recommendedRepairs || 'No repairs listed',
                            qty: '',
                            partNumber: '',
                            partsTotal: 0,
                            laborTotal: 0
                        }];
                    }

                    console.log('Parsed repairs:', repairs);

                    // Get vehicle info for this ticket
                    db.get('SELECT * FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err, vehicle) => {
                        if (err) {
                            console.error('Vehicle info error:', err.message);
                            vehicle = {};
                        }

                        console.log('Vehicle info found:', vehicle ? 'YES' : 'NO');

                        // Calculate totals from repairs
                        let partsSubtotal = 0;
                        let laborSubtotal = 0;

                        if (repairs && repairs.length > 0) {
                            repairs.forEach(repair => {
                                partsSubtotal += parseFloat(repair.partsTotal || 0);
                                laborSubtotal += parseFloat(repair.laborTotal || 0);
                            });
                        }

                        const tax = partsSubtotal * 0.06;
                        const total = partsSubtotal + tax;

                        console.log(`Rendering customer page for ticket ${ticketId}`);
                        console.log(`   - Repairs to display: ${repairs.length}`);

                        // --- fetch inspection data and categorize into good/monitor/bad ---
                        const dbAll = (sql, params) => new Promise((resolve, reject) => {
                            db.all(sql, params, (qErr, rows) => qErr ? reject(qErr) : resolve(rows || []));
                        });

                        const categorizeBrake = (val) => {
                            const n = parseFloat(String(val || '').replace(/[^0-9.\-]/g, ''));
                            if (Number.isNaN(n)) return null;
                            if (n >= 1 && n <= 2) return 'bad';
                            if (n >= 3 && n <= 4) return 'monitor';
                            if (n >= 5 && n <= 12) return 'good';
                            return null;
                        };
                        const categorizeByStatus = (s) => {
                            if (!s) return null;
                            switch (String(s).trim().toLowerCase()) {
                                case 'green': return 'good';
                                case 'yellow': return 'monitor';
                                case 'red': return 'bad';
                                default: return null;
                            }
                        };
                        const mapSteeringStatus = (s) => {
                            if (!s) return null;
                            switch (String(s).trim().toLowerCase()) {
                                case 'ok': return 'good';
                                case 'monitor': return 'monitor';
                                case 'replace': return 'bad';
                                default: return null;
                            }
                        };

                        (async () => {
                            try {
                                const monitorItems = [];
                                const badItems = [];

                                // courtesyTableItems (join courtesyTable -> ticketID)
                                try {
                                    const courtesyRows = await dbAll(
                                        `SELECT cti.item, cti.status, cti.notes 
                                     FROM courtesyTableItems cti 
                                     JOIN courtesyTable ct ON ct.id = cti.tableID 
                                     WHERE ct.ticketID = ?`,
                                        [ticketId]
                                    );
                                    courtesyRows.forEach(r => {
                                        const cat = categorizeByStatus(r.status);
                                        const label = r.item + (r.notes ? ` — ${r.notes}` : '');
                                        if (cat === 'monitor') monitorItems.push(label);
                                        else if (cat === 'bad') badItems.push(label);
                                    });
                                } catch (e) {
                                    console.error('Failed fetching courtesy items:', e);
                                }

                                // emissionsTable (join emissions -> ticketID)
                                try {
                                    const emisRows = await dbAll(
                                        `SELECT et.item, et.status 
                                     FROM emissionsTable et 
                                     JOIN emissions e ON e.id = et.emissionsID 
                                     WHERE e.ticketID = ?`,
                                        [ticketId]
                                    );
                                    emisRows.forEach(r => {
                                        const cat = categorizeByStatus(r.status);
                                        if (cat === 'monitor') monitorItems.push(r.item);
                                        else if (cat === 'bad') badItems.push(r.item);
                                    });
                                } catch (e) {
                                    console.error('Failed fetching emissions items:', e);
                                }

                                // brakesTable (join brakes -> ticketID) — use "actual" numeric ranges
                                try {
                                    const brakesRows = await dbAll(
                                        `SELECT bt.item, bt.actual 
                                     FROM brakesTable bt 
                                     JOIN brakes b ON b.id = bt.brakesID 
                                     WHERE b.ticketID = ?`,
                                        [ticketId]
                                    );
                                    brakesRows.forEach(r => {
                                        const cat = categorizeBrake(r.actual);
                                        if (cat === 'monitor') monitorItems.push(`${r.item} (${r.actual})`);
                                        else if (cat === 'bad') badItems.push(`${r.item} (${r.actual})`);
                                    });
                                } catch (e) {
                                    console.error('Failed fetching brakes items:', e);
                                }

                                // steeringSuspensionTable (join steeringSuspension -> ticketID)
                                try {
                                    const steerRows = await dbAll(
                                        `SELECT sst.item, sst.left, sst.right, sst.front, sst.rear 
                                     FROM steeringSuspensionTable sst 
                                     JOIN steeringSuspension ss ON ss.id = sst.steeringSuspensionID 
                                     WHERE ss.ticketID = ?`,
                                        [ticketId]
                                    );
                                    steerRows.forEach(r => {
                                        [['left', 'left'], ['right', 'right'], ['front', 'front'], ['rear', 'rear']].forEach(([col, label]) => {
                                            const val = r[col];
                                            const cat = mapSteeringStatus(val);
                                            if (!cat) return;
                                            const entry = `${r.item} (${label}: ${val})`;
                                            if (cat === 'monitor') monitorItems.push(entry);
                                            else if (cat === 'bad') badItems.push(entry);
                                        });
                                    });
                                } catch (e) {
                                    console.error('Failed fetching steering suspension items:', e);
                                }

                                // Remove duplicates and trim
                                const uniq = (arr) => Array.from(new Set((arr || []).map(a => String(a).trim()).filter(Boolean)));

                                // fetch latest uploaded video for this ticket (if any)
                                let video = null;
                                try {
                                    const vids = await dbAll(`SELECT * FROM videos WHERE ticketID = ? ORDER BY id DESC LIMIT 1`, [ticketId]);
                                    if (Array.isArray(vids) && vids.length > 0) {
                                        video = vids[0];
                                        if (video.relativePath) {
                                            video.webPath = '/' + String(video.relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
                                        }
                                    }
                                } catch (vErr) {
                                    console.error('Failed fetching video for ticket:', vErr);
                                    video = null;
                                }

                                if (video) {
                                    console.log('video DB row:', video);
                                    const expected = path.join(__dirname, '..', video.relativePath || '');
                                    console.log('expected disk path:', expected, 'exists=', fs.existsSync(expected));
                                    console.log('video.webPath:', video.webPath);
                                }

                                // fetch latest uploaded image(s) for this ticket (if any)
                                let images = [];
                                try {
                                    // pictures table (not images) — match your schema
                                    const imgs = await dbAll(`SELECT * FROM pictures WHERE ticketID = ? ORDER BY id ASC`, [ticketId]);
                                    console.log('DEBUG: raw pictures rows count =', Array.isArray(imgs) ? imgs.length : 'not-array');
                                    if (Array.isArray(imgs) && imgs.length > 0) {
                                        console.log('DEBUG: sample picture row =', imgs[0]);
                                        try {
                                            const schema = await dbAll(`PRAGMA table_info(pictures)`, []);
                                            console.log('DEBUG: pictures table schema =', schema);
                                        } catch (schemaErr) {
                                            console.warn('DEBUG: failed to read pictures table schema', schemaErr);
                                        }

                                        images = imgs.map(r => {
                                            // prefer relativePath (matches your CREATE TABLE)
                                            const rel = r.relativePath || r.relativepath || r.relative_path || r.path || r.filepath || r.filename || '';
                                            let webPath = null;
                                            if (rel && typeof rel === 'string') {
                                                // normalize backslashes and ensure leading slash
                                                const s = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
                                                webPath = '/' + s;
                                            } else if (r.filename) {
                                                // fallback to uploads folder if you store files there
                                                webPath = '/uploads/' + String(r.filename).replace(/^\/+/, '');
                                            }

                                            const originalName = r.originalName || r.originalname || r.filename || `picture-${r.id || ''}`;
                                            const mimeType = r.mimeType || r.mimetype || 'image/jpeg';

                                            // debug: absolute path and existence
                                            let _absPath = null;
                                            let _existsOnDisk = false;
                                            try {
                                                const candidate = r.relativePath || r.relativepath || r.filename || '';
                                                if (candidate) {
                                                    _absPath = path.join(__dirname, '..', String(candidate));
                                                    _existsOnDisk = fs.existsSync(_absPath);
                                                }
                                            } catch (e) {
                                                _absPath = null;
                                                _existsOnDisk = false;
                                            }

                                            return Object.assign({}, r, {
                                                webPath,
                                                originalName,
                                                mimeType,
                                                _absPath,
                                                _existsOnDisk
                                            });
                                        }).filter(x => x && x.webPath);
                                    }
                                } catch (imgErr) {
                                    console.error('Failed fetching pictures for ticket:', imgErr);
                                    images = [];
                                }
                                console.log('images fetched for ticket (after normalize):', images.length);
                                // keep single-image compatibility if other code expects it
                                const image = images.length ? images[0] : null;

                                res.render('customer', {
                                    user: user,
                                    ticket: ticket,
                                    repairs: repairs,
                                    vehicle: vehicle || {},
                                    inspection: {
                                        monitorItems: uniq(monitorItems),
                                        badItems: uniq(badItems)
                                    },
                                    video: video,
                                    images: images,
                                    totals: {
                                        partsSubtotal: partsSubtotal.toFixed(2),
                                        laborSubtotal: laborSubtotal.toFixed(2),
                                        tax: tax.toFixed(2),
                                        total: total.toFixed(2)
                                    }
                                });
                            } catch (e) {
                                console.error('Error assembling inspection data:', e);
                                // still render page without inspection arrays on error
                                res.render('customer', {
                                    user: user,
                                    ticket: ticket,
                                    repairs: repairs,
                                    vehicle: vehicle || {},
                                    inspection: { monitorItems: [], badItems: [] },
                                    video: null,
                                    image: null,
                                    totals: {
                                        partsSubtotal: partsSubtotal.toFixed(2),
                                        laborSubtotal: laborSubtotal.toFixed(2),
                                        tax: tax.toFixed(2),
                                        total: total.toFixed(2)
                                    }
                                });
                            }
                        })();
                    });
                });

        } catch (error) {
            console.error('Cookie parsing error:', error);
            res.clearCookie('user');
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
});

router.post('/customer', (req, res) => {
    res.redirect('/customer');
});

module.exports = router;
