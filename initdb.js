const aws = require('aws-sdk');
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;
const { DO_SPACE_URL, bucketName, bucketTestKey } = require('./dbinfo');

const loadConfig = (config) => {
	return {
		mysql: mysql.createPool(config.mysql),
		s3: new aws.S3({
			endpoint: new aws.Endpoint(DO_SPACE_URL),
			accessKeyId: config.s3.accessKeyId,
			secretAccessKey: config.s3.secretAccessKey
		}),
		mongodb: new MongoClient(config.mongodb, { useUnifiedTopology: true })
	}
};

const testConnections = (mysql, mongodb, s3) => {
    const p = [];

    // Wrap MySQL getConnection ping as a promise
	p.push(new Promise(
		(resolve, reject) => {
			mysql.getConnection(
				(err, conn) => {
					if (err)
						return reject(err);
					conn.ping(err => {
						conn.release();
						if (err)
							return reject(err);
						// console.info('>>> Connection test: resolved mysql');
						resolve();
					})
				}
			)
		}
	));

    // Wrap MongoDB connect as a promise
	p.push(new Promise(
		(resolve, reject) => {
			mongodb.connect(
				err => {
					if (err)
						return reject(err);
					// console.info('>>> Connection test: resolved mongodb');
					resolve();
				}
			)
		}
	))

    // Wrap s3 getObject as a promise
	p.push(new Promise(
		(resolve, reject) => {
			const params = {
                // Make sure that this exists in DO Spaces!
				Bucket: bucketName,
				Key: bucketTestKey
			}
			s3.getObject(params,
				(err, result) => {
					if (err)
						return reject(err);
					// console.info('>>> Connection test: resolved s3');
					resolve();
				}
			)
		}
	))

	return (Promise.all(p))
}

module.exports = { loadConfig, testConnections };
