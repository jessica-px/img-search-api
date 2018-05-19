const express = require('express');
const request = require('request');
const https = require('https');

const app = express();
//const localport = 8080;
const port = process.env.port;

// Google Search API
const apiKey = 'AIzaSyDT6vGJtBx41vPPbuBbu6Y9NW6XVBDgxOQ';
const apiId = '001423376409891962792:fbkq6pjo3ky';
const googleURI = 'https://www.googleapis.com/customsearch/v1?key=' + apiKey + '&cx=' + apiId;

// Setup MongoDB
let db;
let dbCollection;
const MongoClient = require('mongodb').MongoClient;
//const localMongoUrl = "mongodb://localhost:27017/";

const mongoUser = 'admin';
const mongoPw = 'imgSearchPw';
const mongoUrl = 'mongodb://' + mongoUser + ':' + mongoPw + '@ds157599.mlab.com:57599/img-search';

MongoClient.connect(mongoUrl, (err, client) => {
    if (err) throw err;
    db = client.db('img-search');
    console.log("Connecting to database '"+ db.s.databaseName +"'...")
    dbCollection = db.collection('recentSearches');
    console.log("Using collection '" + dbCollection.s.name + "'...");
})

// Link to build directory
//app.use(express.static (__dirname + '/public/'));

// Initialize
app.listen(port);
console.log('Listening on port ' + port + '...');


/*
*
*   API 
*
*/

// Generic error handler
const errorHandler = (res, reason, message, code) => {
    console.log("ERROR: " + reason);
    res.status(code || 500).json ({"error": message});
}

// Get images
app.get("/api/search/:searchQuery", (req, res) => {
    const searchQuery = req.params.searchQuery;
    let offset = req.query.offset;
    console.log('Searched for: ' + searchQuery);

    //Get img data from Google Api
    googleApiRequest(searchQuery, offset)
        .then(imgData => res.send(imgData))
        .catch((err) => errorHandler(res, err.message, "Could not get promise from Google API."));

    //Record this in "recent searches" database
    newRecentSearch(searchQuery);
})

// Get Recent Searches
app.get("/api/recent", (req, res) => {
    dbCollection.find({}).toArray((err, records) => {
        if (err) throw err;
        const recentSearches = records.map(record => record.query);
        res.send(recentSearches);
    })
})
/*
*
*   Helper Functions
*
*/

const googleApiRequest = (searchQuery, offset) => {
    return new Promise((resolve, reject) => {
        let URI = googleURI + '&q=' + searchQuery + '&searchType=image';
        if (offset > 1){
            URI += "&start=" + (parseInt(offset)-1) * 10;
        }
        request(URI, {json: true}, (err, res, body) => {
            if (err) throw err;
            // Return array of formatted img objects
            let imgData = [];
            for(let img of body.items){
                const data = {
                    url: img.link,
                    thumbnail: img.image.thumbnailLink,
                    altText: img.title,
                    pageUrl: img.image.contextLink
                }
                imgData.push(data);
            }
            //console.log(imgData);
            resolve(imgData);
        })
    }
)}

const newRecentSearch = (searchQuery) => {
    const recentSearch = {
        query: searchQuery,
        time: Date.now()
    }
    // Add to database
    dbCollection.insertOne(recentSearch, (err, res) => {
        if (err) throw err;
        console.log('Added ' + searchQuery + ' to recent searches.')

        // If database has more than 10 records, delete the oldest
        dbCollection.find({}).toArray((err, result) => {
            if (err) throw err;
            if (result.length > 10){
                const oldestRecord = result[0];
                dbCollection.remove( {"_id": oldestRecord._id});
                console.log("Removed recent search: " + oldestRecord.query)
            }
        });
    })

}