
// Requirements: Fetch API polyfill for browsers/environments that require it.
//               Promise Polyfill (Used by Fetch)
//               RequestAnimationFrame if you want to setMode('raf') so that it does not run when not tabbed.. not as performant.


((window) => {

    const DEFAULT_REFRESH_RATE = 10000
    const DEFAULT_URL = 'http://no-url-specified.com/nothing'
    const DEFAULT_MODE = 'text'
    const DEFAULT_TIMEOUT = 15000
    const SUPPORTED_MODES = ['json', 'text', 'blob']
    const DEFAULT_EXT_MAPPINGS = {
        'json': 'json',
        'html': 'text',
        'txt': 'text',
        'md': 'text',
        'jpg': 'blob',
        'jpeg': 'blob',
        'png': 'blob',
        'ico': 'blob',
        'svg': 'blob',
        'mp3': 'blob',
        'mp4': 'blob',
        'webm': 'blob',
        'ogg': 'blob'
    }
    
    class FeedFetcher {
        
        constructor() {
            this._mode = 'interval' // or requestAnimationFrame
            this._requirementsMet = true
            this._requirements = {
                fetch: true,
                promise: true,
                requestAnimationFrame: true
            }
            if(!window.fetch || !window.Promise) {
                console.warn('FeedFetcher - fetch/Promise are not defined on this browser - If you need to use a polyfill make sure it included before importing or including the FeedFetcher script')
                this._requirementsMet = false
                if(!window.fetch) this._requirements.fetch = false;
                if(!window.Promise) this._requirements.promise = false;
                if(!window.requestAnimationFrame) this._requirements.requestAnimationFrame = false;
                console.error('Requirements not met: [fetch: ' + this._requirements.fetch + '] [Promise:' + this._requirements.promise + '] [requestAnimationFrame - optional for setMode("raf"): ' + this._requirements.requestAnimationFrame + ']')
            }
    
            // Keep track of feed objects
            this._nextIntervalID = 1
            this._feedObjects = {}
    
            // In case I want to stop _step
            this._animationFrameID = null
    
            // Timeout promise implementation
            // https://github.com/jkomyno/fetch-timeout
            this._timeoutPromise = function(promise, timeout, error) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                    reject(error);
                    }, timeout);
                    promise.then(resolve, reject);
                });
            }
            
            this._fetchTimeout = function (url, options, timeout, error) {
                error = error || 'Request timed out.';
                options = options || {};
                timeout = timeout || DEFAULT_TIMEOUT;
                return this._timeoutPromise(fetch(url, options), timeout, error);
            };
    
            // Begin steps
            if(this._mode != 'interval') {
                this._step()
            }
        }
    

        setMode(mode) {
            let feedCount = 0
            for(let f in this._feedObjects) {
                feedCount += 1
                break;
            }
            if(feedCount != 0) {
                console.warn('FeedFetcher - Cannot change mode while feed objects have been created.')
                return;
            }

            if(this._mode == mode) {
                console.warn('FeedFetcher - Mode already set to ' + mode)
                return;
            }

            if(mode == 'interval') {
                cancelAnimationFrame(this._animationFrameID)
                this._mode = 'interval'
            } else if (mode == 'requestAnimationFrame' || mode == 'raf') {
                if(this._requirements.requestAnimationFrame) {
                    this._mode = 'raf'
                    this._step()
                } else {
                    console.warn('FeedFetcher - Cannot change to requestAnimationFrame as it is not supported on this environment.')
                }
            }
        }
    
    
        _step() {
            this._animationFrameID = requestAnimationFrame(this._step.bind(this))

            let thisStep = Date.now()
    
            for(let f in this._feedObjects) {
                let feed = this._feedObjects[f]

                let deltaTime = thisStep - feed._lastStep
                feed._lastStep = thisStep
                feed._millisecondsSinceLastRefresh += deltaTime
    
                if (feed._millisecondsSinceLastRefresh >= feed._refreshRate) {
                    feed._millisecondsSinceLastRefresh = 0
                    this._doFetch(feed)
                }
    
            }
            
        }
    
        // Tests: URL doesnt exist/return, no connection sometimes?, not JSON?
        
        _doFetch(feed) {
            if(!feed) {
                console.error('FeedFetcher - Tried to fetch but not feed argument exists or it is null')
                return;
            }
    
            let _fetchID = feed._fetchID += 1
            let _jsonStep = false
            let _jsonResponse = null
            let _blobStep = false
            let _blobResponse = null
            let _status = ''
            let _statusText = ''

            let _userMethodError = false
    
    
    
            this._fetchTimeout(feed._url,{cache: "no-store"}, feed._timeout).then((response) => {
                _status = response.status || ''
                _statusText = response.statusText || ''
                if (!response.ok) {
                    throw Error(response.status + ' - ' + response.statusText)
                }
                return response
            })
            .then((response) => {
                if(feed._mode == 'json') {
                    _jsonStep = true
                    _jsonResponse = response.clone()
                    return response.json()
                } else if(feed._mode == 'blob') {
                    _blobStep = true
                    _blobResponse = response.clone()
                    return response.blob()
                } else {
                    return response.text()
                }
            })
            .then(data => {
                if(feed._mode == 'json') {
                    // console.log('FeedFetcher - New json data', data)
                    let newCachedJson = JSON.stringify(data)
                    if(feed._cachedJson[feed._url] == newCachedJson && feed._onSameData) {
                        _userMethodError = 'onSameData'
                        feed._onSameData(data)
                    } else {
                        _userMethodError = true
                        _userMethodError = 'onData'
                        feed._onData(data, feed._cachedJson[feed._url] ? JSON.parse(feed._cachedJson[feed._url]) : null )
                        feed._cachedJson[feed._url] = newCachedJson
                    }
                // Compare with cache to be implemented, need to serialize or hash?
                // if serialize... that could be a bit too big depending on the file?
                // Might still need the compare with cache option as a boolean to be added back universally.
                } else if(feed._mode == 'blob') {
                    _userMethodError = 'onData'
                    feed._onData(data, null)
                } else {
                    // console.log('FeedFetcher - New text data', data)
                    if(feed._cachedText[feed._url] == data && feed._onSameData) {
                        _userMethodError = 'onSameData'
                        feed._onSameData(data)
                    } else {
                        _userMethodError = 'onData'
                        feed._onData(data, feed._cachedText[feed._url] || null)
                        feed._cachedText[feed._url] = data
                    }
                   
                }
            })
            .catch((err) => {
                if(err == 'Request timed out.') {
                    if(!feed._onError) {
                        console.warn('FeedFetcher - Request timed out', {errorType: 'FETCH_TIMEOUT', errorText: err, feedObject: feed, status: _status, statusText: _statusText})
                    } else {
                        feed._onError({errorType: 'FETCH_TIMEOUT',  errorText: err , feedObject: feed, status: _status, statusText: _statusText})
                    }
                } else if (_userMethodError) {
                    if(!feed._onError) {
                        console.warn('FeedFetcher - Caught an error within your code in callback function [' + _userMethodError + ']', {errorType: 'USER_METHOD_ERROR', userMethod: _userMethodError,  errorText: err ,feedObject: feed, status: _status, statusText: _statusText})
                    } else {
                        feed._onError({errorType: 'USER_METHOD_ERROR',  errorText: err , userMethod: _userMethodError, feedObject: feed, status: _status, statusText: _statusText})
                    }
                } else {
                    if(_jsonStep) {
                        // console.warn('FeedFetcher - Response could not be parsed to json', {fetchID: _fetchID})
                        _jsonResponse.text().then((text) => {
                            if(!feed._onError) {
                                console.warn('FeedFetcher - Text contents of failed json response:', {errorType: 'JSON_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text})
                            } else {
                                feed._onError({errorType: 'JSON_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text})
                            }
                            
                        }).catch((err) => {
                            if(!feed._onError) {
                                console.warn('FeedFetcher - Could not read text contents from failed json response:', {errorType: 'JSON_AND_TEXT_PARSE_FAIL', errorText: err, feedObject: feed, rawResponse: _jsonResponse})
                            } else {
                                feed._onError({errorType: 'JSON_AND_TEXT_PARSE_FAIL',  errorText: err, feedObject: feed, rawResponse: _jsonResponse})
                            }
                        })
                    } else if (_blobStep) {
                        // console.warn('FeedFetcher - Response could not be loaded as blob', {fetchID: _fetchID})
                        _blobResponse.text().then((text) => {
                            if(!feed._onError) {
                                console.warn('FeedFetcher - Text contents of failed blob response:', {errorType: 'BLOB_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text})
                            } else {
                                feed._onError({errorType: 'BLOB_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text})
                            }
                            
                        }).catch((err) => {
                            if(!feed._onError) {
                                console.warn('FeedFetcher - Could not read text contents from failed blob response:', {errorType: 'BLOB_AND_TEXT_PARSE_FAIL', errorText: err, feedObject: feed, rawResponse: _jsonResponse})
                            } else {
                                feed._onError({errorType: 'BLOB_AND_TEXT_PARSE_FAIL',  errorText: err, feedObject: feed, rawResponse: _jsonResponse})
                            }
                        })
                    } else {
                        if(!feed._onError) {
                            console.warn('FeedFetcher - Response could not be fetched', {errorType: 'FETCH_FAIL',  errorText: err ,feedObject: feed, status: _status, statusText: _statusText})
                        } else {
                            feed._onError({errorType: 'FETCH_FAIL',  errorText: err , feedObject: feed, status: _status, statusText: _statusText})
                        }
                    }
                }
            })

            if(feed._once) {
                this.clearInterval(feed._feedID)
                return;
            }
        }
    
    
        
        fetch(args) {
            this._setLogic(arguments, 'fetch')
        }
    
        setTimeout(args) {
            return this._setLogic(arguments, 'setTimeout')
        }

        setInterval(args) {
            return this._setLogic(arguments, 'setInterval')
        }
    
    
        _setLogic(args, method) {
            if(!this._requirementsMet) {
                console.error('Requirements not met for setFeedInterval: [fetch: ' + this._requirements.fetch + '] [Promise:' + this._requirements.promise + '] [requestAnimationFrame: ' + this._requirements.requestAnimationFrame + ']')
                return;
            }

            let milliseconds = null
            let options = {}

            // Object parameter mode
            let argIndex = 0
            if(typeof args[argIndex] == 'object') {
                options = args[argIndex]
                if(typeof args[argIndex + 1] == 'number') {
                    milliseconds = args[argIndex + 1]
                }
            // string first param
            } else if (typeof args[argIndex] == 'string') {
                options.url = args[argIndex]
                argIndex += 1

                if(typeof args[argIndex] == 'string') {
                    options.mode = args[argIndex]
                    argIndex += 1
                }

                if(typeof args[argIndex] == 'function') {
                    options.onData = args[argIndex]
                    argIndex += 1
                }

                if(typeof args[argIndex] == 'function') {
                    options.onError = args[argIndex]
                    argIndex += 1
                }

                if(typeof args[argIndex] == 'function') {
                    options.onSameData = args[argIndex]
                    argIndex += 1
                }

                if(typeof args[argIndex] == 'number') {
                    milliseconds = args[argIndex]
                    argIndex += 1
                }
            }

            if(method == 'setTimeout') {
                options.once = true
                options.setTimeout = true
            } else if (method == 'fetch') {
                options.once = true
            }


            
    
            // Assign a unique feed ID and increment.
            let feedID = this._nextIntervalID
            this._nextIntervalID += 1
    
            let feedObject = {}
    
            feedObject._lastStep = (new Date()).getTime()
            feedObject._feedID = feedID
    
            
            // timeout 
            feedObject._timeout = options.timeout
    
            // Initialize from options
            if(milliseconds) {
                feedObject._refreshRate = milliseconds
            } else {
                if(!options.refreshRate) {
                    feedObject._refreshRate = DEFAULT_REFRESH_RATE
                } else {
                    feedObject._refreshRate = options.refreshRate
                }
            }
    
           
    
            feedObject._once = options.once
            feedObject._url = options.url || DEFAULT_URL
    
            if(!options.mode) {
                // check file extension
                let split = feedObject._url.split('.')
                let extension = split[split.length - 1].toLowerCase()
                
                feedObject._mode = DEFAULT_EXT_MAPPINGS[extension] || DEFAULT_MODE

            } else {
                feedObject._mode = options.mode
                let modeValid = false
                for(let m in SUPPORTED_MODES) {
                    if(SUPPORTED_MODES[m] == feedObject._mode) {
                        modeValid = true
                    }
                }
    
                if(!modeValid) {
                    console.error('FeedFetcher - Mode [' + feedObject._mode + '] given to feed fetcher through options is not supported.')
                    return;
                }
                
            }
            
            if(options.setTimeout) {
                feedObject._millisecondsSinceLastRefresh = 0
            } else {
                feedObject._millisecondsSinceLastRefresh = feedObject._refreshRate // Start immediately
            }
            feedObject._fetchID = 0
    
            // cached Json for key: url -> value: stringified json / text
            feedObject._cachedJson = {}
            feedObject._cachedText = {}
    
            // Callbacks
            feedObject._onData = options.onData || ((data) => { console.info('FeedFetcher - Received data but no onData method was passed through constructor', {data: data}) })
            feedObject._onSameData = options.onSameData || null
            feedObject._onError = options.onError || null
    
            this._feedObjects[feedID] = feedObject

            if(this._mode == 'interval') {
                if(method == 'fetch') {
                    this._doFetch(feedObject)
                } else if (method == 'setTimeout') {
                    feedObject._clearMode = 'timeout'
                    feedObject._clearID = setTimeout(() => { this._doFetch(feedObject) }, feedObject._refreshRate)
                } else {
                    this._doFetch(feedObject)
                    feedObject._clearMode = 'interval'
                    feedObject._clearID = setInterval(() => { this._doFetch(feedObject) }, feedObject._refreshRate)
                }
            }
    
            return feedID;
        }
    
        clearInterval(id) {
            let feed = this._feedObjects[id]
            if(feed) {
                if(this._mode == 'interval') {
                    if(feed._clearMode == 'interval') {
                        clearInterval(this._feedObjects[id]._clearID)
                    } else {
                        clearTimeout(this._feedObjects[id]._clearID)
                    }
                }
                delete this._feedObjects[id]
                // console.log('FeedFetcher - cleared feed #' + id)
            }
        }
    
        clearTimeout(id) {
            this.clearInterval(id)
        }
    }
    
    
    let feedFetcher = new FeedFetcher()
    if(window) {
        window.feedFetcher = feedFetcher
    }
    
    if (typeof(module) !== "undefined" && module.exports) { //node
        module.exports = feedFetcher;
    }
    
    
})(window);    