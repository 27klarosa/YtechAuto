const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');

router.get('/mechanicEdit', ensureLoggedIn, (req, res) => {
    res.render('mechanicEdit', { user: req.user });
});

// return list of incomplete tickets as JSON
router.get('/mechanic/incomplete', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const sql = `SELECT id, date, techName, customerName, stat FROM tickets WHERE stat IS NULL OR stat != 'complete' ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Failed to fetch incomplete tickets', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        res.json(rows || []);
    });
});

router.post('/mechanic/completeTicket', ensureLoggedIn, (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const { ticketId } = req.body;
    const parsedTicketId = Number(ticketId);
    if (!Number.isInteger(parsedTicketId) || parsedTicketId <= 0) {
        return res.status(400).json({ error: 'A valid ticketId is required' });
    }

    db.get('SELECT * FROM tickets WHERE id = ?', [parsedTicketId], (findErr, ticket) => {
        if (findErr) return res.status(500).json({ error: 'Failed to load ticket' });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const requiredFields = ['repairOrderNumber', 'date', 'techName', 'customerName', 'customerAddress', 'diagnosis'];
        const missingField = requiredFields.find(field => !String(ticket[field] || '').trim());
        if (missingField) return res.status(400).json({ error: `${missingField} is required` });

        db.get('SELECT id FROM signatures WHERE ticketID = ? LIMIT 1', [parsedTicketId], (signatureErr, signature) => {
            if (signatureErr) return res.status(500).json({ error: 'Failed to verify signature' });
            if (!signature && !ticket.customerSignature) {
                return res.status(400).json({ error: 'Customer signature is required' });
            }

            const sql = `UPDATE tickets SET stat = 'complete' WHERE id = ?`;
            db.run(sql, [parsedTicketId], function(err) {
                if (err) {
                    console.error('Failed to complete ticket', err);
                    return res.status(500).json({ error: 'Failed to complete ticket' });
                }
                return res.sendStatus(204);
            });
        });
    });
});
module.exports = router;