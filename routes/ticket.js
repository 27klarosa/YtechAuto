const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');

router.get('/ticket', ensureLoggedIn, (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    db.all("SELECT id, repairOrderNumber, date AS roDate, customerName, stat FROM tickets WHERE stat = ? ORDER BY date DESC", ['complete'], (err, rows) => {
        if (err) {
            console.error('Error fetching completed tickets:', err);
            return res.status(500).send('Internal Server Error');
        }
        return res.render('ticket', { tickets: rows, user: req.user });
    });
});

module.exports = router;
