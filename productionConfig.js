// This file is to help assign the environment variables
// to the config parameters required for MySQL / S3 / mongodb
// if the config.js file is not available

// This filed will be able to be checked in into git because it
// does not contain any keys/passwords

// Load libraries required
const fs = require('fs');
const path = require('path');
const { sqldbName, sqlConnLimit } = require('./dbinfo');

// Path of config file used during development
const configPath = path.join(__dirname, 'config.js');

// MySQL
let mysql;
// S3 AWS config
let s3;
// mongodb config
let mongodb;
// Google API Key
let google;
// Infura API Key
let infura;
// JWT Secret
let jwtsecret;
// Trinance's ethereum hot wallet
let hotwallet;
// Paypal business account
let paypal;
// Binance
let binance;

// If config file used during development exists, use it 
// If not, get config keys from env variables
if (fs.existsSync(configPath)) {
    const config = require('./config');
    mysql = config.mysql;
    mysql.ssl = {
        ca: fs.readFileSync(mysql.cacert)
    };
    s3 = config.s3;
    mongodb = config.mongodb.url;
    google = config.google.key;
    infura = config.infura.key;
    jwtsecret = config.jwtsecret.secret;
    hotwallet = config.hotwallet;
    paypal = config.paypal;
    binance = config.binance;
} else {
    mysql = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: sqldbName,
        connectionLimit: sqlConnLimit,
        ssl: {
            ca: process.env.DB_CA
        }
    };
    s3 = {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    };
    mongodb = process.env.MONGODB_URL;
    google = process.env.GOOGLE_API_KEY;
    infura = process.env.INFURA_API_KEY;
    jwtsecret = process.env.JWT_SECRET;
    hotwallet = {
        address: process.env.HOTWALLET_ADDRESS,
        privateKey: process.env.HOTWALLET_PRIVATE_KEY
    };
    paypal = {
        username: process.env.PAYPAL_USERNAME,
        password: process.env.PAYPAL_PASSWORD
    };
	binance = {
		apiKey: process.env.BINANCE_APIKEY,
		apiSecret: process.env.BINANCE_APISECRET
	}
}

module.exports = { mysql, s3, mongodb, google, infura, jwtsecret, hotwallet, paypal, binance };
