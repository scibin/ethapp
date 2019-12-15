// Load libraries
const request = require('request-promise-native');

// Ethereum
const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

// Config file
const config = require('./productionConfig');


// ABIs
const ABI = require('./abis');

// Ethereum - initialize web3, connect to remote node

// web3 instance
// const web3 = new Web3(`https://mainnet.infura.io/${config.infura}`);
// NOTE: Connecting to testnet, not mainnet!!
const web3 = new Web3(`https://ropsten.infura.io/${config.infura}`);

// Big number library required for calculations
// NOTE: web3's BN does not support decimals!!
const BN = web3.utils.BN;

// Alternative BN, supports decimals
// https://github.com/MikeMcl/bignumber.js/
const BigNumber = require('bignumber.js');

// Subtract function: performs (a-b) | Takes two numbers in
const subtractUsingBN = (a , b) => {
    const first = new BigNumber(a.toString());
    const second = new BigNumber(b.toString());
    const subtracted = first.minus(second);
    return subtracted.toString();
}

// Add function: performs (a+b) | Takes two numbers in
const addUsingBN = (a , b) => {
    const first = new BigNumber(a.toString());
    const second = new BigNumber(b.toString());
    const added = first.plus(second);
    return added.toString();
}

// Get bid/ask prices of trading pair from Binance e.g. 'ETHUSDT'
const getBinanceBidAskPrices = (tradingPair) => {
	return new Promise(
		(resolve, reject) => {
			//
			binance.bookTickers(tradingPair, (error, ticker) => {
				if (error) {
					// The error.body object contains the error info
					return reject(error.body);
				}
				return resolve(ticker);
			});
		}
	)
}


// || Gets fastest gas price from ethgasstation, and the total fees in eth 
const gasPriceAndFees = new Promise(
    (resolve, reject) => {
        //
        request.get('https://ethgasstation.info/json/ethgasAPI.json')
        .then(result => {
            // Result is multiplied by factor of 10, so have to /10
            // If request.get isn't working for some reason, set the default gasPrice to 30
            const fastestGasPrice = parseFloat((JSON.parse(result).fastest / 10)) || 30;
            // Set up calculation parameters by converting to BN
            const BN_gasLimit = new BN(21000);
            const BN_gasPrice = new BN(fastestGasPrice);
            // Conversion factor for 1gwei/gas to 10^9wei/gas
            const convFactor = new BN(10).pow(new BN(9));
            // Calculate fees
            const feesInWei = BN_gasLimit.mul(BN_gasPrice).mul(convFactor).toString();
            const feesInEth = parseFloat(web3.utils.fromWei(feesInWei, 'ether'));
            // feesInEth - float, fastestGasPrice - int
            return resolve([feesInEth, fastestGasPrice]);
        })
        // [Ethbalance, feesInEth, fastestGasPrice]
        .catch(error => {
            return reject(error);
        })
    }
)


// // || Perform transaction from ethAdd1 to ethAdd2

// // Total transaction fee = gas limit (gas) * gas price (gwei/gas)
// // Assuming 21000 gas * 30 gwei/gas and given that 10^9 wei = 1 gwei
// // const totalPriceInWei = 21000 * 30 * 10^9; // in wei
// // const totalPriceInEth = web3.utils.fromWei(totalPriceInWei.toString(), 'ether');

// // If error: nonce too low, check the tx.sign() if the correct address is used!!

// || Promisified ethereum transaction from sender to receiver
// amtToSendInEth / gasPriceInGwei: integer
// address and pk: string
// If successful, returns transaction hash
const ethtx = (senderAddress, receiverAddress, amtToSendInEth, gasPriceInGwei, senderPK) => {
    return new Promise(
        (resolve, reject) => {
            web3.eth.getTransactionCount(
                senderAddress, (err, txCount) => {
                    if (err)
                        return reject(err);
                    const txObject = {
                        // This value has to be converted to Hexadecimal
                        nonce: web3.utils.toHex(txCount),
                        // The account the ether is sent to
                        to: receiverAddress,
                        // The amount of ether to send, expressed in hexadecimal and wei
                        value: web3.utils.toHex(web3.utils.toWei(amtToSendInEth.toString(), 'ether')),
                        // Max amount of gas consumed by the transaction - simple tx is 21000 by default
                        gasLimit: web3.utils.toHex(21000),
                        // Gas price in gwei/gas
                        gasPrice: web3.utils.toHex(web3.utils.toWei(gasPriceInGwei.toString(), 'gwei'))
                    }

                    // Initialize module to sign tx locally
                    // https://ethereum.stackexchange.com/questions/77737/transaction-hash-is-undefined-when-running-web3-code-from-command-prompt
                    const tx = new Tx(txObject, {chain:'ropsten', hardfork: 'petersburg'});
                    // Convert to hex first
                    const pkToHex = Buffer.from(senderPK.substring(2), 'hex');
                    // Sign transaction using private key
                    tx.sign(pkToHex);
                    // Serialize the transaction -> output is a buffer
                    const serializedTx = tx.serialize();
                    
                    // Convert serialized transaction to a hexidecimal string
                    const raw = '0x' + serializedTx.toString('hex');

                    // Broadcast the transaction
                    web3.eth.sendSignedTransaction(raw, (err, txHash) => {
                        // Testnet: https://ropsten.etherscan.io
                        const transactionHash = txHash;
                        // console.log('>>> txHash is:', txHash);
                        // console.log('>>> err is: ', err);
                        if (transactionHash) {
                            return resolve(transactionHash);
                        } else {
                            return reject(err);
                        }
                    })
                }
            )
        }
    )
}

// !!! To be implemented

// ||| Create account
// Technically an account, but commonly referred to as paper wallet
// console.log(web3.eth.accounts.create());

// IMPT NOTE: Rmb to set privateKey to null after use!
// Output : { address, privateKey, signTransaction, sign, encrypt }
const createEthPaperAccount = () => {
    return { ... web3.eth.accounts.create() };
}

// // ||| Version 2: Create account using password, then generating a keystore
// // Accessing the account requires a keystore and a password
// const fs = require('fs');
// const tester = () => {
//     const { address, privateKey } = web3.eth.accounts.create();
//     console.log('>> address: ', address);
//     console.log('>> private key: ', privateKey);
//     // Password
//     password = 'fredperryisexpensive';
//     const keyStore = web3.eth.accounts.encrypt(privateKey, password);
//     fs.writeFile('./tmp/testing.json', JSON.stringify(keyStore), (err) => {
//         if (!err) {
//             console.log('>> done');
//         }
//     });
//     console.log(keyStore);
// }
// // tester();
// console.log(web3.eth.accounts.decrypt(JSON.parse(fs.readFileSync('./tmp/testing.json')), 'fredperryisexpensive'));


// ||| Get balance

// Returns the amount of eth stored in an address (units in Eth)
const getEthBalance = (address) => {
    return new Promise(
        (resolve, reject) => {
            web3.eth.getBalance(address)
                .then(result => {
                    // Result will be in wei, have to convert it
                    balance = web3.utils.fromWei(result, 'ether');
                    resolve(balance);
                })
                .catch(err => {
                    reject(err);
                })
        }
    )
}


// config.infura
// Vulnerability in web3: https://www.npmjs.com/advisories/877


// Export modules
module.exports = { web3, getBinanceBidAskPrices, subtractUsingBN, addUsingBN, createEthPaperAccount, ethtx, gasPriceAndFees, getEthBalance };
