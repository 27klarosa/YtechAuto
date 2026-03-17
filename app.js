const express = require('express');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const ejs = require('ejs');
const node = require('node')
const session = require('express-session');

const app = express();

const db = new sqlite3.Database('database/database.sql', (err) => {
    if (err) return console.error('Error connecting to database:', err.message);
}); 

const 