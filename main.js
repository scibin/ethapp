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
const uuidv1 = require('uuid/v1');

const jwt = require('jsonwebtoken');
const passport = require('passport');

// load one or more strategies
const LocalStrategy = require('passport-local').Strategy;

// Eth utility
const eth = require('./eth');

// Paypal utility
const paypal = require('./paypal');

// Refactored functions for MySQL queries/transactions
const db = require('./dbutil');

// Refactored functions for mongoDB queries
const dbmongo = require('./mongoutil');

// Config file
const config = require('./productionConfig');

// Functions to initialize databases
const { loadConfig, testConnections } = require('./initdb');

// Load databases info and settings
const { DO_SPACE_URL,bucketName, bucketFolderName,
		mongoDBName } = require('./dbinfo');

// Load mysql, s3 and mongodb connections as pool, s3 and atlasClient
const { mysql: pool, s3, mongodb: atlasClient } = loadConfig(config);


// MySQl query phrases
const qp_ADD_NEW_USER = 'insert into users(email, password, first_name, last_name) values(?, sha2(?, 256), ?, ?)';
const qp_ADD_NEW_USER_ETH_ACC = 'insert into ethacc(email, ethaddress, ethpk) values(?, ?, ?)';
const qp_ADD_NEW_USER_BALANCE = 'insert into userbalance(email) values(?)';
const qp_ADD_NEW_USER_PROFILE = 'insert into profile(email) values(?)';

const qp_CHECK_IF_USER_EXISTS = 'select count(*) as total from users where email = ?';
const qp_AUTH_USER = 'select count(*) as user_count from users where email = ? and password = sha2(?, 256)';
// Used for JWT generation
const qp_GET_USER_KEY_DETAILS = 'select email, first_name, email_confirmed from users where email = ?';
const qp_GET_USER_ETH_ADDRESS = 'select ethaddress from ethacc where email = ?';

const qp_UPDATE_USER_FIAT_BALANCE = 'update userbalance set fiat = fiat + ? where email = ?';
const qp_GET_USER_ETH_ADDRESS_AND_PK = 'select ethaddress as address, ethpk as private_key from ethacc where email = ?';
const qp_UPDATE_USER_ETH_BALANCE = 'update userbalance set eth = eth + ? where email = ?';

// Check ethereum balance
const qp_GET_USER_CURRENT_ACC_ETH = 'select eth from userbalance where email = ?';

const qp_GET_USER_ALL_BALANCES = 'select * from userbalance where email = ?';




// MySQl query functions
const addNewUser = db.mkQuery(qp_ADD_NEW_USER);
const addNewUserEthAcc = db.mkQuery(qp_ADD_NEW_USER_ETH_ACC);
const addNewUserBalance = db.mkQuery(qp_ADD_NEW_USER_BALANCE);
const addNewUserProfile = db.mkQuery(qp_ADD_NEW_USER_PROFILE);

const checkIfUserExists = db.mkQueryFromPool(db.mkQuery(qp_CHECK_IF_USER_EXISTS), pool);
const authUser = db.mkQueryFromPool(db.mkQuery(qp_AUTH_USER), pool);
const getUserKeyDetails = db.mkQueryFromPool(db.mkQuery(qp_GET_USER_KEY_DETAILS), pool);
const getUserEthAddress = db.mkQueryFromPool(db.mkQuery(qp_GET_USER_ETH_ADDRESS), pool);

// Deposit fiat
const updateUserFiatBalance = db.mkQueryFromPool(db.mkQuery(qp_UPDATE_USER_FIAT_BALANCE), pool);

// Deposit ethereum
const getUserEthAddressAndPK = db.mkQueryFromPool(db.mkQuery(qp_GET_USER_ETH_ADDRESS_AND_PK), pool);
const updateUserEthBalance = db.mkQueryFromPool(db.mkQuery(qp_UPDATE_USER_ETH_BALANCE), pool);

// Get all balances
const getUserAllBalances = db.mkQueryFromPool(db.mkQuery(qp_GET_USER_ALL_BALANCES), pool);
// Get all balances transaction version
const getUserAllBalancesTxVersion = db.mkQuery(qp_GET_USER_ALL_BALANCES);

// SQL transaction version
const updateUserEthBalanceTxVersion = db.mkQuery(qp_UPDATE_USER_ETH_BALANCE);
const updateUserFiatBalanceTxVersion = db.mkQuery(qp_UPDATE_USER_FIAT_BALANCE);

// Function to authenticate user through [email, password]
// Returns true/false
const authenticateUser = (param) => {
    return (
        authUser(param)
            .then(result => (result.length && result[0].user_count > 0))
    )
}

// Passport - Local Strategy
passport.use(
    new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password'
        },    
        (email, password, done) => {
            authenticateUser([ email, password ])
                .then(result => {
                    if (result)
                        return (done(null, email))
                    done(null, false);
                })
                .catch(err => {
                    console.error('authentication db error: ', err);
                    done(null, false);
                })
        }
    )
);

// Multer
// Uses the tmp directory to temporarily store folders
const upload = multer({ dest: path.join(__dirname, '/tmp/') });

// Port
const PORT = parseInt(process.argv[2] || process.env.APP_PORT || process.env.PORT) || 3000;

// Start the express application
const app = express();

// CORS and Morgan
app.use(cors());
app.use(morgan('tiny'));

// Middleware

// Append this to whereever needed
// jwtVerification()
const jwtVerification = () => {
    return (req, res, next) => {
        const authorization = req.get('Authorization');
        // If JWT token does not exist in http header Authorization: Bearer [...],
        // return 403
        if (!(authorization && authorization.startsWith('Bearer ')))
            return res.redirect('/api/status/403');
        // Extract JWT string
        const tokenStr = req.get('Authorization').substring('Bearer '.length);
        // Verify JWT
        try {
            // Attach entire JWT object to req
            req.jwt = jwt.verify(tokenStr, config.jwtsecret);
            // For easier access, attach user object to req: 
            // { email, first_name, email_confirmed, is2faAuthenticated }
            req.user = req.jwt.data;
            return next();
        } catch (e) {
            console.log('>>> e: ', e);
            return res.redirect('/api/status/401');
        }
    }
}


// Handle requests here

// !!! Implement code checking - other cases
app.get('/api/status/:code', (req, res) => {
    res.status(parseInt(req.params.code)).json({ status: parseInt(req.params.code) });
})

// User registration
app.post('/api/registeruser', express.json({limit: '5mb'}), (req, res) => {
	// Get information from form
	m = req.body;
    // !!! Do checks on form: does email, password follow requirements
    //
    // Start a transaction to add user details -> if addNewUser fails, rollback and send error
    pool.getConnection(
        (err, conn) => {
            if (err)
                throw err;
            // Start transaction
            // { connection, result, params, error }
            db.startTransaction(conn)
                // Store new user's email, hashed pw, first/last name in users table
                .then(status => {
                    return (
                        addNewUser({ connection: status.connection, params: [ m.email, m.password, m.first_name, m.last_name ] })
                    );
                })
                // Create an eth account for the user and store it in ethacc table 
                .then(status => {
                    const newEthAcc = eth.createEthPaperAccount();
                    return (
                        addNewUserEthAcc({ connection: status.connection, params: [ m.email, newEthAcc.address, newEthAcc.privateKey ] })
                    );
                })
                // Create fiat/eth/token e-balance for user (default balances are 0) in userbalance table
                .then(status => {
                    return (
                        addNewUserBalance({ connection: status.connection, params: [ m.email ] })
                    );
                })
                // Create profile entry for user (default balances are 0) in profile table
                .then(status => {
                    return (
                        addNewUserProfile({ connection: status.connection, params: [ m.email ] })
                    );
                })
                .then(db.commit, db.rollback)
                .then(
                    (status) => {
                        res.status(201).json({ status: 0 }); 
                    },
                    (status) => {
                        console.log('>>> error is: ', status.error);
                        res.redirect('/api/status/500');
                    }
                )
                .finally(() => { conn.release() });
        } // getConnection
    )
})


// User email / password authentication
app.post('/api/authenticate',
	// Body parser middleware
	express.json({limit:'5mb'}),
    // Use LocalStrategy to authenticate
    passport.authenticate('local', { 
        failureRedirect: '/api/status/401',
		// Disable session, otherwise there will be error
        session: false
	}),
	(req, res) => {
		// console.log('>>> req.body: ', req.body);
		// req.body -> email, password, checkbox: '' or true
        // Default expiry period of 30 minutes
        let expiryPeriod = (60 * 30); // 60 secs / min  *   30 mins
        // If user clicks remember me, set expiry period to 1 day
        if (req.body.checkbox) {
            expiryPeriod = (60 * 60 * 24 * 1);
        }
        // Issue the JWT here
        // console.info('>>> user: ', req.user);
        getUserKeyDetails([ req.user ])
            .then(result => {
                // userData format: 
                // { email: 'fred@gmail.com', first_name: 'Fred', email_confirmed: 0 }
                const userData = { ...result[0] };
                const d = (new Date()).getTime();
                const token = jwt.sign({
                    sub: userData.email,
                    iss: 'trinance',
                    // Convert to seconds from milliseconds
                    iat: d / 1000,
                    // Expire 15 mins from now
                    expiry: d / 1000 + expiryPeriod,
                    data: {
                        email: userData.email,
                        first_name: userData.first_name,
                        email_confirmed: (userData.email_confirmed) ? true : false,
                        is2faAuthenticated: false
                    },
                },
                config.jwtsecret)
                console.log('>>> accesstoken is: ', token);
                // Status, token_type, access_token, expiresAt
                res.status(200).json({ status: 0, token_type: 'Bearer', access_token: token, expiresAt: ((d / 1000) + expiryPeriod), first_name: userData.first_name });
            })
            .catch(err => {
                console.log('>>> err is: ', err);
                res.redirect('/api/status/500');
            })
	}
)


// || Authenticated routes only:
app.get('/api/user/get/ethaddress', jwtVerification(), (req, res) => {
    // Get email from req.user object
    // console.log('>>> req.user is: ', req.user);
    const email = req.user.email;
    getUserEthAddress([ email ])
    .then(result => {
        // result[0].ethaddress
        if (result.length > 0) {
            return res.status(200).json({ data: result[0].ethaddress });
        } else {
            return res.status(404).json({ data: 'Not found, please try again' })
        }
    })
    .catch(err => {
        console.log('>>> This is err: ', err);
        return res.status(500).json({ data: 'Internal server error, please try again' })
    });
})

// Deposit fiat into user's account
app.post('/api/user/deposit/fiat', jwtVerification(), express.json({limit: '5mb'}), (req, res) => {
    // Get parameters required
    const id = req.body.id, paypalEmail = req.body.email; // Paypal email used for funding
    const amount = parseFloat(req.body.amount), email = req.user.email; // User's email
    // Update user's fiat balance in DB, and log tx data
    Promise.all([
        updateUserFiatBalance([ amount, email ]),
        dbmongo.insertLog(atlasClient, 'deposits', { email, from: paypalEmail, fiatAmt: amount, currency: 'fiat', txID: id, time: moment().valueOf() })
    ])
    .then(result => { return res.status(201).json({ status: 0 }) })
    .catch(err => { return res.status(500).json({ status: 1 }) });
})

// Deposit eth into user's account
app.get('/api/user/deposit/eth', jwtVerification(), (req, res) => {
    // Get the current user's email
    const email = req.user.email;
    getUserEthAddressAndPK([ email ])
	.then(result => {
		return Promise.all([ eth.getEthBalance(result[0].address), eth.gasPriceAndFees, result[0] ])
	})
	.then(result => {
		// result is in this format: [ '0.1', [0.0001, 20], { address, private_key } ]
        // Eth balance - tx fees (have to use BN to subtract accurately)
		const amtToSendInEth = eth.subtractUsingBN(result[0], result[1][0]);
		const senderAddress = result[2].address;
		const senderPK = result[2].private_key;
		// Exchange's hot wallet
		const receiverAddress = config.hotwallet.address;
        const gasPriceInGwei = result[1][1];
		// Perform transaction, and keep details for logging
		return Promise.all([
			// Perform eth transaction
			eth.ethtx(senderAddress, receiverAddress, amtToSendInEth, gasPriceInGwei, senderPK),
			// Info for logging 
			{ email: email, from: senderAddress, ethAmount: parseFloat(result[0]), txfees: result[1][0], gasPrice: gasPriceInGwei }
		]);
	})
	.then(result => {
		// const txhash = result[0]; // const information = result[1];
		// Perform SQL update here
		return Promise.all([
			// Params: [amount, email]
			updateUserEthBalance([ result[1].ethAmount, email ]),
            dbmongo.insertLog(atlasClient, 'deposits', { ... result[1], txhash: result[0], currency: 'ethereum', txID: uuidv1(), time: moment().valueOf() })
		]);
	})
	.then(result => {
        return res.status(201).json({ status: 0 });
	})
	.catch(err => {
		return res.status(500).json({ status: 1 })
	})
})

// Gets user's account all balances
app.get('/api/user/account/all', jwtVerification(), (req, res) => {
    // Get the current user's email
    const email = req.user.email;
    getUserAllBalances([ email ])
	.then(result => {
        return res.status(200).json({ ...result[0] });
	})
	.catch(err => {
		return res.status(500).json({ data: 'Internal server error, please try again' })
	})
})

// Withdraw eth
// !!! Also has the option to convert to urlencoded
// !!! Maybe should ensure that receiverAddress is in the correct form - a lot of errors arising from it
app.post('/api/user/withdraw/eth', jwtVerification(), express.json({limit: '5mb'}), (req, res) => {
    // Get the current user's email and other information required
    console.log('>>>> req.body: ', req.body);
    const email = req.user.email, receiverAddress = req.body.addressToWithdrawTo, amtToSendInEth = parseFloat(req.body.amount);
    const gasPriceInGwei = 30, senderAddress = config.hotwallet.address, senderPK = config.hotwallet.privateKey;
    pool.getConnection(
        (err, conn) => {
            if (err)
                throw err;
            // Start transaction
            db.startTransaction(conn)
                .then(status => {
                    return (
                        getUserAllBalancesTxVersion({ connection: status.connection, params: [ email ] })
                    );
                })
                .then(status => {
                    // Eth balance of user: status.result[0].eth
                    const currentUserEthBalance = status.result[0].eth;
                    // Amount to withdraw cannot be more than his/her current balance
                    if (amtToSendInEth > currentUserEthBalance) {
                        return Promise.reject({ connection: status.connection, error: 'Balance not enough' });
                    }
                    return Promise.all([
                        // Perform SQL update, deduct amount of eth withdrew from account
                        updateUserEthBalanceTxVersion({ connection: status.connection, params: [ -amtToSendInEth , email ] }),
                        { ethBalance: (currentUserEthBalance - amtToSendInEth) }
                    ]);
                })
                .then(status => {
                    // Pass connection object, log details, and perform eth tx
                    return Promise.all([
                        { connection: status[0].connection }, // 0: Connection object
                        eth.ethtx(senderAddress, receiverAddress, amtToSendInEth, gasPriceInGwei, senderPK), // 1: Transaction
                        status[1] // 2: Log details
                    ]);
                })
                .then(status => {
                    const information = { email, to: receiverAddress, ethAmount: amtToSendInEth, txhash: status[1], ethBalance: status[2].ethBalance, currency: 'ethereum', txID: uuidv1(), time: moment().valueOf() };
                    // Log to mongoDB. Use transaction version of insertLog (see mongoutil for more details).
                    return (dbmongo.insertLogTxVer(atlasClient, 'withdrawals', information, status[0].connection));
                })
                .then(db.commit, db.rollback)
                .then(
                    (status) => {
                        return res.status(200).json({ status: 0 });
                    },
                    (status) => {
                        console.log('>>>>>', status.error);
                        return res.status(500).json({ status: 1 });
                    }
                )
                .finally(() => { conn.release() });
        }
    )
})

// Withdraw fiat
app.post('/api/user/withdraw/fiat', jwtVerification(), express.json({limit: '5mb'}), (req, res) => { 
    // Get information
    const email = req.user.email, fiatAmt = req.body.fiatAmt, paypalEmail = req.body.paypalEmail;
    pool.getConnection(
        (err, conn) => {
            if (err)
                throw err;
            // Start transaction
            db.startTransaction(conn)
                .then(status => {
                    return (
                        getUserAllBalancesTxVersion({ connection: status.connection, params: [ email ] })
                    );
                })
                .then(status => {
                    // Fiat balance of user
                    const currentUserFiatBalance = status.result[0].fiat;
                    if (fiatAmt > currentUserFiatBalance) {
                        return Promise.reject({ connection: status.connection, error: 'Balance not enough' });
                    }
                    return Promise.all([
                        // Perform SQL update, deduct amount of fiat withdrew from account
                        updateUserFiatBalanceTxVersion({ connection: status.connection, params: [ -fiatAmt , email ] }),
                        paypal.paypalPayOutToUser(fiatAmt, paypalEmail, status.connection),
                        { fiatBalance: (currentUserFiatBalance - fiatAmt) }
                    ]);
                })
                .then(status => {
                    const information = { email, to: paypalEmail, fiatAmount: fiatAmt, fiatBalance: status[2].fiatBalance, currency: 'fiat', txID: status[1].result, time: moment().valueOf() };
                    return (dbmongo.insertLogTxVer(atlasClient, 'withdrawals', information, status[1].connection));
                })
                .then(db.commit, db.rollback)
                .then(
                    (status) => {
                        return res.status(200).json({ status: 0 });
                    },
                    (status) => {
                        console.log('>>>>>', status.error);
                        return res.status(500).json({ status: 1 });
                    }
                )
                .finally(() => { conn.release() });
        }
    );
})

// !!! Testing out
app.get('/testing', jwtVerification(), (req, res) => {
    // Log info
    // NOTE: req.user defined after passport auth is diff from after jwt auth!
    console.log('>>> req.user: ', req.user);
    console.log('>>> req.jwt: ', req.jwt);
    res.json({ status: 0 });
})


// Serve static folders
// app.use(express.static(path.join(__dirname, 'public')));


// Execute 3 promises from initdb.js
// If successful, start app.listen
testConnections(pool, atlasClient, s3)
	.then(() => {
		app.listen(PORT,
			() => {
				console.info(`Application started on port ${PORT} at ${new Date()}`);
			}
		)
	})
	.catch(error => {
		console.error('Error in connection tests: ', error);
		process.exit(-1);
    })
