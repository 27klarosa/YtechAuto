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

    db.run('INSERT INTO users (email, password, stat) VALUES (?, ?, ?)', [email, password, stat], function(err) {
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
    
    db.get('SELECT id, stat FROM users WHERE email = ? AND password = ? LIMIT 1', [email, password], (err, row) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).send('Internal Server Error');
        }   
        if (!row) {
            return res.status(401).send('Invalid email or password');
        }

        const userId = row.id;
        const role = row.stat ? String(row.stat).toLowerCase() : 'customer';
        req.session.user = { id: userId, email, stat: role };
        return res.redirect('/');
    });
});





module.exports = router;