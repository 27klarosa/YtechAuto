//importer
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);
const initializeDatabase = require('./scripts/initDatabase');

const fs = require('fs');

// Make database available to other modules after initialization
app.locals.db = null;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Middleware
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET || 'defaultsecretkey',
    resave: false,
    saveUninitialized: true
}));

// serve uploaded files (videos/images/signatures)
app.use('/upload', express.static(path.join(__dirname, 'upload')));

//Routes
const indexRouter = require('./routes/index');
const mechanicRouter = require('./routes/mechanic');
const customerRouter = require('./routes/customer');
const customerDisRouter = require('./routes/customerDis');
const mechanicDisRouter = require('./routes/mechanicDis');
const mechanicEditRouter = require('./routes/mechanicEdit');
const ticketRoute = require('./routes/ticket');
const authRouter = require('./routes/auth');
const loginRouter = require('./routes/login');



app.use('/', indexRouter);
app.use('/', mechanicRouter);
app.use('/', customerRouter);
app.use('/', customerDisRouter);
app.use('/', authRouter);
app.use('/', mechanicDisRouter);
app.use('/', mechanicEditRouter);
app.use('/', loginRouter);
app.use('/', ticketRoute);

initializeDatabase()
    .then((db) => {
        app.locals.db = db;
        server.listen(PORT, () => {
            console.log(`Example app listening on port http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database initialization failed:', err);
        process.exit(1);
    });

module.exports = app;