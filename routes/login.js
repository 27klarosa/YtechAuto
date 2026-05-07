require("dotenv").config();
const express = require("express");
const crypto = require('crypto');
const router = express.Router();

// Local login route for testing without Azure AD

router.get("/signup", (req, res) => {
    res.render("signup");
});

router.post("/signup", (req, res) => {
    const { email, password, stat } = req.body;
    const db = req.app.locals.db;

    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).send('Password must be at least 6 characters');
    }

    // hash the password with PBKDF2 + random salt
    const hashPassword = (pwd) => {
        const salt = crypto.randomBytes(16).toString('hex');
        const iterations = 100000;
        const keylen = 64;
        const digest = 'sha512';
        const derived = crypto.pbkdf2Sync(pwd, salt, iterations, keylen, digest).toString('hex');
        return `${salt}$${iterations}$${digest}$${derived}`;
    };

    const stored = hashPassword(password);

    db.run('INSERT INTO users (email, password, stat) VALUES (?, ?, ?)', [email, stored, stat], function(err) {
        if (err) {
            console.error('Database error during signup:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/loginPage');
    });
});

router.get("/loginPage", (req, res) => {
    res.render("loginPage");
});

router.post("/loginPage", (req, res) => {
    const { email, password } = req.body;
    const db = req.app.locals.db;
    if (!password || !email) return res.status(400).send('Email and password are required');

    db.get('SELECT id, stat, password AS storedPassword FROM users WHERE email = ? LIMIT 1', [email], (err, row) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!row) return res.status(401).send('Invalid email or password');

        const userId = row.id;
        const role = row.stat ? String(row.stat).toLowerCase() : 'customer';
        const stored = row.storedPassword || '';

        const verify = (pwd, storedVal) => {
            try {
                if (!storedVal) return false;
                // If stored is in our hashed format: salt$iterations$digest$hash
                if (storedVal.indexOf('$') !== -1) {
                    const parts = storedVal.split('$');
                    if (parts.length < 4) return false;
                    const salt = parts[0];
                    const iterations = parseInt(parts[1], 10) || 100000;
                    const digest = parts[2] || 'sha512';
                    const hash = parts.slice(3).join('$');
                    const keylen = Buffer.from(hash, 'hex').length;
                    const derived = crypto.pbkdf2Sync(pwd, salt, iterations, keylen, digest).toString('hex');
                    // use timing-safe comparison
                    const a = Buffer.from(derived, 'hex');
                    const b = Buffer.from(hash, 'hex');
                    if (a.length !== b.length) return false;
                    return crypto.timingSafeEqual(a, b);
                }

                // legacy plaintext stored password: compare directly (and upgrade)
                return pwd === storedVal;
            } catch (e) {
                console.error('Password verify error', e);
                return false;
            }
        };

        const ok = verify(password, stored);
        if (!ok) return res.status(401).send('Invalid email or password');

        // If stored password was plaintext, upgrade to hashed form
        if (stored && stored.indexOf('$') === -1) {
            try {
                const salt = crypto.randomBytes(16).toString('hex');
                const iterations = 100000;
                const keylen = 64;
                const digest = 'sha512';
                const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
                const storedNew = `${salt}$${iterations}$${digest}$${derived}`;
                db.run('UPDATE users SET password = ? WHERE id = ?', [storedNew, userId], (uErr) => { if (uErr) console.error('Failed to upgrade stored password:', uErr); });
            } catch (e) { /* ignore upgrade errors */ }
        }

        req.session.user = { id: userId, email, stat: role };
        return res.redirect('/');
    });
});





module.exports = router;