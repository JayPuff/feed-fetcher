# FeedFetcher
## Documentation for v2.7

## What is this for

This package is meant for the browser context.

In order to make scheduled fetch requests (usually for data feeds) easier and less annoying when it comes to exceptions and errors, feed fetcher handles most of it internally while providing an interface that is very similar to what you are used in the browser: setTimeout/setInterval, it also allows you to feed things once, or use the former methods and clearInterval/clearTimeout as you would normally.

For the error types when fetching look at the *error types* section. 

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

### Importing [Script Tag]
NOTE: Reminder to include fetch and Promise polyfills for browsers like internet explorer, BEFORE including the FeedFetcher script

```html
<script src="https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@2.0.4/fetch.min.js"> </script>
<script src="FeedFetcher.min.js"> </script>
```

```javascript
// Access it through window:
window.feedFetcher
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
        feedFetcher.clearInterval(intervalID)
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
    // Current possible values: 'json', 'text', 'blob'
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
    //     errorType: 'FETCH_FAIL' || 'JSON_PARSE_FAIL' || 'JSON_AND_TEXT_PARSE_FAIL', //... more error types, look below.
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


### Error Types
By logging the error object with the onError callback, and reading the errorType property, we can know what went wrong.

```javascript
error.errorType == 'FETCH_TIMEOUT'
// The fetch timed out, either because you specified a timeout number in specific: ex: 10000 (10 seconds)
// Or the default timeout parameter: 15 seconds.


error.errorType == 'JSON_PARSE_FAIL'
// When fetching in JSON mode, response.json() failed internally, so whatever you fetched could not parse properly.
// error.textContents will contain the response as a string so you can see what might be the problem.


error.errorType == 'JSON_AND_TEXT_PARSE_FAIL'
// When trying to read the text contents of a JSON_PARSE_FAIL error, we also cannot get the text contents. This is not likely.


error.errorType == 'BLOB_PARSE_FAIL'
// Tried to fetch a file/url as a blob but the internal response.blob() failed. Can get text contents of request via error.textContents


error.errorType == 'BLOB_AND_TEXT_PARSE_FAIL'
// Similar as JSON_AND_TEXT_PARSE_FAIL but for blob.


error.errorType == 'FETCH_FAIL'
// General error for failed fetching, use error.errorText, or analyize error.feedObject / error.statusText / error.status to see what went wrong


error.errorType == 'USER_METHOD_ERROR'
// An error got caught within the callback methods supplied: onData, onSameData (Warning: onError will not be caught here.)
// Ex: Trying to JSON parse something that's not a proper JSON string, whether related to the fetched data or not in this method, will be caught internally.
// errorText will display the error.
```


### requestAnimationFrame Mode
If you are confident you will have requestAnimationFrame support on your target browser and you do not want the fetches to run when the page is tabbed out;
You can set the internal mode of feed fetcher to work via requestAnimationFrame.
Note that you can only change this when there are no feeds set up to run at an interval or timeout. So ideally, at the beginning of the app.

```javascript
feedFetcher.setMode('raf') // Default is 'interval'
```






