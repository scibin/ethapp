const { mongoDBName } = require('./dbinfo');

// LOGS

// Perform an insert into the collection specified. Inserts an object called information
const insertLog = (client, collectionName, information) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(collectionName)
        .insertOne(information)
        .then(result => resolve(result))
        .catch(err => reject(err))
    });
}

// Perform an insert into the collection specified. Inserts an object called information
// Transaction version for logging - need to pass in status connection
const insertLogTxVer = (client, collectionName, information, connection) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(collectionName)
        .insertOne(information)
        .then(result => resolve({ connection, result }))
        .catch(error => reject({ connection, error }))
    });
}

// Get transaction logs by user identified via email
// General function
const getLogsByUserEmail = (client, collectionName, email) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(collectionName)
        .find({ email: email })
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    });
}

// Get trade logs by user identified via email
// Specific function
const getTradeLogsByUserEmail = (client, email) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection('trades')
        .aggregate([
            {
                $match: { email: email }
            },
            {
                $project: {
                    _id: 0,
                    type: 1,
                    time: 1,
                    id: '$txID',
                    pair: {
                        $concat: [
                            '$base', '$quote'
                        ]
                    },
                    price: 1,
                    quantity: 1,
                    total: 1
                }
            },
            {
                $sort: { time: -1 }
            }
        ])
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    })
}

// Get deposit logs by user identified via email
// Specific function
const getDepositLogsByUserEmail = (client, email) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection('deposits')
        .aggregate([
            {
                $match: { email: email }
            },
            {
                $project: {
                    _id: 0,
                    time: 1,
                    // For the id, if the withdrawal is fiat, take the txID. If eth, take the txhash
                    id: {
                        $cond: [{$eq: ['$currency', 'fiat']}, '$txID', '$txhash']
                    },
                    amount: {
                        $cond: [{$eq: ['$currency', 'fiat']}, '$fiatAmt', '$ethAmount']
                    },
                    currency: 1,
                    from: 1
                }
            },
            {
                $sort: { time: -1 }
            }
        ])
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    })
}

// Get withdrawal logs by user identified via email
// Specific function
const getWithdrawalLogsByUserEmail = (client, email) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection('withdrawals')
        .aggregate([
            {
                $match: { email: email }
            },
            {
                $project: {
                    _id: 0,
                    time: 1,
                    // For the id, if the withdrawal is fiat, take the txID. If eth, take the txhash
                    id: {
                        $cond: [{$eq: ['$currency', 'fiat']}, '$txID', '$txhash']
                    },
                    amount: {
                        $cond: [{$eq: ['$currency', 'fiat']}, '$fiatAmount', '$ethAmount']
                    },
                    currency: 1,
                    to: 1
                //    balance: {
                //        $cond: [{$eq: ['$currency', 'fiat']}, '$fiatBalance', '$ethBalance']
                //    }
                }
            },
            {
                $sort: { time: -1 }
            }
        ])
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    })
}


module.exports = {
    insertLog,
    insertLogTxVer,
    getLogsByUserEmail,
    getTradeLogsByUserEmail,
    getDepositLogsByUserEmail,
    getWithdrawalLogsByUserEmail
};
