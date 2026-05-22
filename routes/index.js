const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');

/* router.get('/', ensureLoggedIn, (req, res) => {
    const user = req.user;
    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    const email = (user && user.email) ? String(user.email).toLowerCase() : null;
    if (!email) {
        res.clearCookie('user');
        return res.redirect('/login');
    }

    // Check user exists in DB and render
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            res.clearCookie('user');
            return res.redirect('/login');
        }
        if (row) return res.render('index', { user });
        console.log(`User ${email} not found in database, clearing cookie`);
        res.clearCookie('user');
        return res.redirect('/login');
    });
});
*/

router.get('/', (req, res) => {
    res.render('index');
});

module.exports = router;