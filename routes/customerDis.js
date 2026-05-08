const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');

router.get('/customerDis', ensureLoggedIn, (req, res) => {
    const user = req.user;
    if (!user || !user.email) { res.clearCookie('user'); return res.redirect('/login'); }
    const email = String(user.email).toLowerCase();

    const db = req.app.locals.db;
    if (!db) { console.error('Database connection not available'); return res.status(500).send('Database error'); }

    db.all('SELECT * FROM tickets WHERE customerEmail = ? and stat = ? ORDER BY date DESC', [email, 'complete'], (err, tickets) => {
        if (err) { console.error('Database error:', err && err.message); return res.status(500).send('Database error'); }
        return res.render('customerDis', { user: user, tickets: tickets || [], userEmail: email });
    });
});

router.post('/customerDis', (req, res) => { res.redirect('/customerDis'); });

module.exports = router;
