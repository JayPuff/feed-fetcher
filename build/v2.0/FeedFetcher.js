'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Requirements: Fetch API polyfill for browsers that require it.
//               Promise Polyfill (Used by Fetch)
//               RequestAnimationFrame polyfill for ie < 11 (will not have same behaviour (dont run when tabbed))

(function (window) {

    var DEFAULT_REFRESH_RATE = 10000;
    var DEFAULT_URL = 'http://no-url-specified.com/nothing';
    var DEFAULT_MODE = 'text';
    var DEFAULT_TIMEOUT = 10000;
    var SUPPORTED_MODES = ['json', 'text'];

    var FeedFetcher = function () {
        function FeedFetcher() {
            _classCallCheck(this, FeedFetcher);

            this._requirementsMet = true;
            this._requirements = {
                fetch: true,
                promise: true,
                requestAnimationFrame: true
            };
            if (!window.fetch || !window.Promise || !window.requestAnimationFrame) {
                console.warn('FeedFetcher - fetch/Promise/requestAnimationFrame are not defined on this browser - If you need to use a polyfill make sure it included before importing or including the FeedFetcher script');
                this._requirementsMet = false;
                if (!window.fetch) this._requirements.fetch = false;
                if (!window.Promise) this._requirements.promise = false;
                if (!window.requestAnimationFrame) this._requirements.requestAnimationFrame = false;
                console.error('Requirements not met: [fetch: ' + this._requirements.fetch + '] [Promise:' + this._requirements.promise + '] [requestAnimationFrame: ' + this._requirements.requestAnimationFrame + ']');
            }

            // Keep track of feed objects
            this._nextIntervalID = 1;
            this._feedObjects = {};

            // In case I want to stop _step
            this._animationFrameID = null;

            // Timeout promise implementation
            // https://github.com/jkomyno/fetch-timeout
            this._timeoutPromise = function (promise, timeout, error) {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        reject(error);
                    }, timeout);
                    promise.then(resolve, reject);
                });
            };

            this._fetchTimeout = function (url, options, timeout, error) {
                error = error || 'Request timed out.';
                options = options || {};
                timeout = timeout || DEFAULT_TIMEOUT;
                return this._timeoutPromise(fetch(url, options), timeout, error);
            };

            // Begin steps
            this._step();
        }

        _createClass(FeedFetcher, [{
            key: '_step',
            value: function _step() {
                this._animationFrameID = requestAnimationFrame(this._step.bind(this));

                for (var f in this._feedObjects) {
                    var feed = this._feedObjects[f];

                    var thisStep = new Date().getTime();
                    var deltaTime = thisStep - feed._lastStep;
                    feed._lastStep = thisStep;

                    feed._millisecondsSinceLastRefresh += deltaTime;

                    if (feed._millisecondsSinceLastRefresh >= feed._refreshRate) {
                        feed._millisecondsSinceLastRefresh = 0;
                        this._doFetch(feed);
                    }
                }
            }

            // Tests: URL doesnt exist/return, no connection sometimes?, not JSON?

        }, {
            key: '_doFetch',
            value: function _doFetch(feed) {
                if (!feed) {
                    console.error('FeedFetcher - Tried to fetch but not feed argument exists or it is null');
                    return;
                }

                if (feed._once) {
                    if (feed._fetchedOnce) {
                        this.clearInterval(feed._feedID);
                        return;
                    } else {
                        feed._fetchedOnce = true;
                    }
                }

                var _fetchID = feed._fetchID += 1;
                var _jsonStep = false;
                var _jsonResponse = null;
                var _status = '';
                var _statusText = '';

                this._fetchTimeout(feed._url, { cache: "no-store" }, 5000).then(function (response) {
                    _status = response.status || '';
                    _statusText = response.statusText || '';
                    if (!response.ok) {
                        throw Error(response.status + ' - ' + response.statusText);
                    }
                    return response;
                }).then(function (response) {
                    if (feed._mode == 'json') {
                        _jsonStep = true;
                        _jsonResponse = response.clone();
                        return response.json();
                    } else {
                        return response.text();
                    }
                }).then(function (data) {
                    if (feed._mode == 'json') {
                        // console.log('FeedFetcher - New json data', data)
                        var newCachedJson = JSON.stringify(data);
                        if (feed._cachedJson[feed._url] == newCachedJson && feed._onSameData) {
                            feed._onSameData(data);
                        } else {
                            feed._onData(data, feed._cachedJson[feed._url] ? JSON.parse(feed._cachedJson[feed._url]) : null);
                            feed._cachedJson[feed._url] = newCachedJson;
                        }
                    } else {
                        // console.log('FeedFetcher - New text data', data)
                        if (feed._cachedText[feed._url] == data && feed._onSameData) {
                            feed._onSameData(data);
                        } else {
                            feed._onData(data, feed._cachedText[feed._url] || null);
                            feed._cachedText[feed._url] = data;
                        }
                    }
                }).catch(function (err) {
                    if (err == 'Request timed out.') {
                        if (!feed._onError) {
                            console.warn('FeedFetcher - Request timed out', { errorType: 'FETCH_TIMEOUT', errorText: err, feedObject: feed, status: _status, statusText: _statusText });
                        } else {
                            feed._onError({ errorType: 'FETCH_TIMEOUT', errorText: err, feedObject: feed, status: _status, statusText: _statusText });
                        }
                    } else {
                        if (_jsonStep) {
                            // console.warn('FeedFetcher - Response could not be parsed to json', {fetchID: _fetchID})
                            _jsonResponse.text().then(function (text) {
                                if (!feed._onError) {
                                    console.warn('FeedFetcher - Text contents of failed json response:', { errorType: 'JSON_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text });
                                } else {
                                    feed._onError({ errorType: 'JSON_PARSE_FAIL', errorText: err, feedObject: feed, textContents: text });
                                }
                            }).catch(function (err) {
                                if (!feed._onError) {
                                    console.warn('FeedFetcher - Could not read text contents from failed json response:', { errorType: 'JSON_AND_TEXT_PARSE_FAIL', errorText: err, feedObject: feed, rawResponse: _jsonResponse });
                                } else {
                                    feed._onError({ errorType: 'JSON_AND_TEXT_PARSE_FAIL', errorText: err, feedObject: feed, rawResponse: _jsonResponse });
                                }
                            });
                        } else {
                            if (!feed._onError) {
                                console.warn('FeedFetcher - Response could not be fetched', { errorType: 'FETCH_FAIL', errorText: err, feedObject: feed, status: _status, statusText: _statusText });
                            } else {
                                feed._onError({ errorType: 'FETCH_FAIL', errorText: err, feedObject: feed, status: _status, statusText: _statusText });
                            }
                        }
                    }
                });
            }
        }, {
            key: 'fetch',
            value: function fetch(args) {
                this._setLogic(arguments, 'fetch');
            }
        }, {
            key: 'setTimeout',
            value: function setTimeout(args) {
                return this._setLogic(arguments, 'setTimeout');
            }
        }, {
            key: 'setInterval',
            value: function setInterval(args) {
                return this._setLogic(arguments, 'setInterval');
            }
        }, {
            key: '_setLogic',
            value: function _setLogic(args, method) {
                if (!this._requirementsMet) {
                    console.error('Requirements not met for setFeedInterval: [fetch: ' + this._requirements.fetch + '] [Promise:' + this._requirements.promise + '] [requestAnimationFrame: ' + this._requirements.requestAnimationFrame + ']');
                    return;
                }

                var milliseconds = null;
                var options = {};

                // Object parameter mode
                var argIndex = 0;
                if (_typeof(args[argIndex]) == 'object') {
                    options = args[argIndex];
                    if (typeof args[argIndex + 1] == 'number') {
                        milliseconds = args[argIndex + 1];
                    }
                    // string first param
                } else if (typeof args[argIndex] == 'string') {
                    options.url = args[argIndex];
                    argIndex += 1;

                    if (typeof args[argIndex] == 'string') {
                        options.mode = args[argIndex];
                        argIndex += 1;
                    }

                    if (typeof args[argIndex] == 'function') {
                        options.onData = args[argIndex];
                        argIndex += 1;
                    }

                    if (typeof args[argIndex] == 'function') {
                        options.onError = args[argIndex];
                        argIndex += 1;
                    }

                    if (typeof args[argIndex] == 'function') {
                        options.onSameData = args[argIndex];
                        argIndex += 1;
                    }

                    if (typeof args[argIndex] == 'number') {
                        milliseconds = args[argIndex];
                        argIndex += 1;
                    }
                }

                if (method == 'setTimeout') {
                    options.once = true;
                    options.timeout = true;
                } else if (method == 'fetch') {
                    options.once = true;
                }

                // Assign a unique feed ID and increment.
                var feedID = this._nextIntervalID;
                this._nextIntervalID += 1;

                var feedObject = {};

                feedObject._lastStep = new Date().getTime();
                feedObject._feedID = feedID;

                if (!options) {
                    options = {};
                }

                // Initialize from options
                if (milliseconds) {
                    feedObject._refreshRate = milliseconds;
                } else {
                    if (!options.refreshRate) {
                        feedObject._refreshRate = DEFAULT_REFRESH_RATE;
                    } else {
                        feedObject._refreshRate = options.refreshRate;
                    }
                }

                feedObject._once = options.once;
                feedObject._url = options.url || DEFAULT_URL;

                if (!options.mode) {
                    // check file extension
                    var split = feedObject._url.split('.');
                    var extension = split[split.length - 1].toLowerCase();

                    if (extension == 'json') {
                        feedObject._mode = 'json';
                    } else if (extension == 'txt') {
                        feedObject._mode = 'text';
                    } else {
                        feedObject._mode = DEFAULT_MODE;
                    }
                } else {
                    feedObject._mode = options.mode;
                    var modeValid = false;
                    for (var m in SUPPORTED_MODES) {
                        if (SUPPORTED_MODES[m] == feedObject._mode) {
                            modeValid = true;
                        }
                    }

                    if (!modeValid) {
                        console.error('FeedFetcher - Mode [' + feedObject._mode + '] given to feed fetcher through options is not supported.');
                        return;
                    }
                }

                if (options.timeout) {
                    feedObject._millisecondsSinceLastRefresh = 0;
                } else {
                    feedObject._millisecondsSinceLastRefresh = feedObject._refreshRate; // Start immediately
                }
                feedObject._fetchID = 0;

                // cached Json for key: url -> value: stringified json / text
                feedObject._cachedJson = {};
                feedObject._cachedText = {};

                // Callbacks
                feedObject._onData = options.onData || function (data) {
                    console.info('FeedFetcher - Received data but no onData method was passed through constructor', { data: data });
                };
                feedObject._onSameData = options.onSameData || null;
                feedObject._onError = options.onError || null;

                this._feedObjects[feedID] = feedObject;

                return feedID;
            }
        }, {
            key: 'clearInterval',
            value: function clearInterval(id) {
                if (this._feedObjects[id]) {
                    delete this._feedObjects[id];
                    // console.log('FeedFetcher - cleared feed #' + id)
                }
            }
        }, {
            key: 'clearTimeout',
            value: function clearTimeout(id) {
                clearInterval(id);
            }
        }]);

        return FeedFetcher;
    }();

    var feedFetcher = new FeedFetcher();
    if (window) {
        window.feedFetcher = feedFetcher;
    }

    if (typeof module !== "undefined" && module.exports) {
        //node
        module.exports = feedFetcher;
    }
})(window);
