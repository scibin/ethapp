// Database information and settings

// ||| MySQL

// Name of MySQL database to connect to
// !!! Change this
const sqldbName = 'trinance';
// Max pool connection limit
const sqlConnLimit = 10;


// ||| DigitalOcean Spaces S3

// URL of DigitalOcean Space - most likely will not change
const DO_SPACE_URL = 'sgp1.digitaloceanspaces.com';
// Name of the DigitalOcean bucket
const bucketName = 'abc1234';
// Name of the folder for the file(s) to be stored in the bucket
const bucketFolderName = 'ethapp';
// File to be used for testing the connection to the space
const bucketTestKey = 'forTestingConnectionDontDelete.txt';


// ||| Atlas MongoDB

// Name of the database
const mongoDBName = 'trinance';
// Name of the collection
// const mongoDBCollection = 'accounts';


module.exports = {
    sqldbName,
    sqlConnLimit,
    DO_SPACE_URL,
    bucketName,
    bucketFolderName,
    bucketTestKey,
    mongoDBName,
}
