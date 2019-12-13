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


// Gets the list of distinct values according to an attribute
const getDistinctList = (client, distinctAttribute) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(mongoDBCollection)
        .distinct(distinctAttribute)
        .then(result => resolve(result))
        .catch(err => reject(err))
    });
};

// Get the list of listings in a particular country
// Default limit is 200
const getListingsList = (client, country, limit = 200) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(mongoDBCollection)
        .find({ 'address.country': country }).project({
            _id: 1,
            name: 1,
            summary: 1,
            'images.picture_url': 1,
            'host.host_location': 1,
            'host.host_name': 1
        }).limit(limit)
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    });
};

const getListing = (client, id) => {
    return new Promise((resolve, reject) => {
        client.db(mongoDBName).collection(mongoDBCollection)
        .aggregate([
            {
                $match: { _id: id }
            },
            {
                $project: {
                    listing_url: 1,
                    name: 1,
                    space: 1,
                    description: 1,
                    neighborhood_review: 1,
                    access: 1,
                    property_type: 1,
                    room_type: 1,
                    bed_type: 1,
                    minimum_nights: 1,
                    maximum_nights: 1,
                    cancellation_policy: 1,
                    accomodates: 1,
                    bedrooms: 1,
                    beds: 1,
                    number_of_reviews: 1,
                    bathrooms: 1,
                    amenities: 1,
                    price: 1,
                    image: '$images.picture_url',
                    host: 1,
                    address: 1,
                    coordinates: {
                            type: 'Point',
                            coordinates: [
                                { $arrayElemAt: [ '$address.location.coordinates', 0 ] },
                                { $arrayElemAt: [ '$address.location.coordinates', 1 ] }
                                ]
                    },
                    review_scores: 1,
                    reviews: 1
                }
            }
        ])
        .toArray()
        .then(result => resolve(result))
        .catch(err => reject(err))
    })
}

module.exports = { insertLog, insertLogTxVer };
