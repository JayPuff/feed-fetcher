# FeedFetcher

## What is this for

In order to make automatic json (or other) feed fetching easier, with one or multiple sources, this is an abstraction that lets you choose feed url, refresh time, callbacks, using similar syntax as setInterval and setTimeout.

## Documentation for v2.6

### Importing [Webpack]
Import into a webpack project by using
```javascript
import feedFetcher from 'feed-fetcher'
```

If you need to support older browsers that don't have Promise, fetch, or requestAnimationFrame make sure you include polyfills before importing anything from FeedFetcher 
```javascript
import './your-polyfills' // Import your own polyfills if needed. ex: promise-polyfill, whatwg-fetch
import feedFetcher from 'feed-fetcher'
```

### Using setInterval and clearInterval

```javascript
// Minimal example, automatically sets mode to json because of filename.
// data on the method onData can be expected to be a json object
// intervalID return value can be used to clearFeedInterval when needed.
// In this case: As soon as we get working data once, we kill the feed fetcher.
let intervalID = feedFetcher.setInterval({
    url: 'https://somewebsite.com/file.json',
    onData: (data, prevData) => {
        console.log('New Data:', data)
        clearInterval(intervalID)
    }
}, 10000)
```


### setInterval parameters
```javascript
let options = {
    // Url that will be fetched.
    url: '/file1.json', 

    // [optional]
    // Defines how to parse and deal with data internally. If omitted it will be set automatically to 'json' for json files, 'text' for txt files, and by default to 'text' for all other urls
    // Current possible values: 'json', 'text'
    mode: 'json', 


    // How often we will attempt to fetch data in milliseconds
    // if omitted the default will be used: 10 seconds.
    // This refresh rate can be specified as a second parameter also like usual browser setInterval, setTimeout
    refreshRate: 5000,


    // How long we will wait for request to be completed before failing.
    // Default is 15 seconds.
    timeout: 15000,

    // Runs when we receive data.
    // data parameter will contain a string in 'text' mode, and a javascript object if mode is set to 'json'
    // prevData parameter will work similarly as data, but with the last cached data, on the first execution it will be null (no previous data)
    // Note: if compareWithCache option is set to true, this method will not execute on identical new data. 
    onData: (data, prevData) => {/* do something... */},


    // [optional]
    // if not omitted, it will run when data received is equal to the last data received that was cached.
    // Works identically to onData otherwise.
    onSameData: (data) => {/* do something... */},


    // [optional]
    // Although errors are already logged, if anything in particular needs to be done depending on the error type, this callback can be specified:
    // error parameter is always an object which contains:
    // error = {
    //     errorType: 'FETCH_FAIL' || 'JSON_PARSE_FAIL' || 'JSON_AND_TEXT_PARSE_FAIL',
    //     errorText: 'Error text caught in the catch() of the fetch',
    //     feedObject: {'internal feed object being exposed for analysis. Do not modify it'},

    //     // if errorType == 'FETCH FAIL'
    //     status: 404,
    //     statusText: 'Not Found'

    // }
    onError: (error) => {

    }
    
}
```


### Using setTimeout, clearTimeout and fetch

setTimeout and clearTimeout work identically to setInterval and clearInterval where the first parameter is the options, and the second parameter is milliseconds.


#### fetch

Fetch is a shorthand for fetching a feed just once and cancelling the subsequent fetching internally, no matter what the result ends up being.

```javascript
// Simple one time fetch that times out after 5 seconds
feedFetcher.fetch({
    url: '/',
    timeout: 5000,
    mode: 'text',
    onData: (data) => {
        console.log('Data received: ', data)
    },
    onError: (error) => {
        console.warn('Error occurred with fetch: ', error)
    }
})
```


### Alternative parameters

You can also do the following shorthand for function parameters:
url[, mode], onData [, onError, onSameData], milliseconds 

The mandatory parameters are url, onData, and milliseconds.
you can specify mode in between url and onData, and specify other method handlers before milliseconds.

```javascript
// Simple one time fetch.
feedFetcher.fetch('https://somewebsite.com/file.json', (data) => {
    console.log(data)
})

feedFetcher.setInterval('/', 'text',
    (data) => {
        console.log(data)
    },
    (error) => {
        console.error(error)
    }
, 7500)

```






