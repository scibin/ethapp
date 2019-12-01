// load libraries
const fs = require('fs');
const mysql = require('mysql');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const moment = require('moment');
const multer = require('multer');
const aws = require('aws-sdk');
const request = require('request-promise-native');

// Multer
// Uses the tmp directory to temporarily store folders
const upload = multer({ dest: path.join(__dirname, '/tmp/') });

// Port
const PORT = parseInt(process.argv[2] || process.env.APP_PORT || process.env.PORT) || 3000;

// Start the application
const app = express();

// CORS and Morgan
app.use(cors());
app.use(morgan('tiny'));

// Handle requests here

app.listen(PORT,
    () => {
        console.info(`Application started on port ${PORT} at ${new Date()}`);
    }
)