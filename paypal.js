// Load libraries and deps
const request = require('request-promise-native');
const config = require('./productionConfig');
const uuidv1 = require('uuid').v1;
// || Paying an user from a business account

// Step 1: Get the Bearer token
const paypalPayOutToUser = (fiatAmt, paypalEmail, connection) => {
    return new Promise((resolve, reject) => {
        const username = config.paypal.username;
        const password = config.paypal.password;
        // Taken from POSTMAN and made some minor adjustments
        const tokenRequestOptions = {
            method: 'POST',
            url: 'https://api.sandbox.paypal.com/v1/oauth2/token',
            headers: {
                'cache-control': 'no-cache',
                Connection: 'keep-alive',
                'Content-Length': '29',
                'Accept-Encoding': 'gzip, deflate',
                Host: 'api.sandbox.paypal.com',
                //  'Postman-Token': 'bb980715-c85c-489c-bad0-a6f274fb3f61,8aab230c-cfb4-451e-8757-abae43660348',
                'Cache-Control': 'no-cache',
                Accept: '*/*',
                // 'User-Agent': 'PostmanRuntime/7.20.1',
                Authorization: 'Basic ' + Buffer.from(username + ":" + password).toString("base64"),
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            form: {
                grant_type: 'client_credentials'
            }
        };
        request(tokenRequestOptions)
        .then(result => {
            const bearer = JSON.parse(result).access_token;
            const payoutOptions = {
                method: 'POST',
                url: 'https://api.sandbox.paypal.com/v1/payments/payouts',
                headers: {
                    Host: 'api.sandbox.paypal.com',
                    Authorization: 'Bearer ' + bearer,
                    Connection: 'keep-alive',
                    'cache-control': 'no-cache',
                    'Content-Type': 'application/json',
                },
                json: true,
                body: {
                    "sender_batch_header": {
                        "sender_batch_id": uuidv1(),
                        "email_subject": "You have a payout from Trinance!",
                        "email_message": "You have received a payout! Thanks for using our service!"
                    },
                    "items": [
                        {
                            "recipient_type": "EMAIL",
                            "amount": {
                              "value": fiatAmt,
                              "currency": "USD"
                            },
                            "note": "Here's the withdrawal money!",
                            "receiver": paypalEmail
                        }
                    ]
                }
            };
            // Step 2: With the bearer, send the payout to the designated email address
            return(request(payoutOptions));
        })
        .then(result => resolve({ connection, result: result['batch_header']['payout_batch_id'] }))
        .catch(error => reject({ connection, error }))
    });
}

module.exports = { paypalPayOutToUser };
