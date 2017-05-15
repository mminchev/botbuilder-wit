const { WitRecognizer } = require('../lib/WitRecognizer');
const RedisAdapter = require('../lib/adapters/RedisAdapter');
const MemcachedAdapter = require('../lib/adapters/MemcachedAdapter');
import { Wit } from 'node-wit';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('WitRecognizer', function () {
    describe('constructor', function () {
        const invalidAccessToken = 'Invalid argument. Constructor must be invoked with an accessToken of type "string".';
        const invalidCache = 'Invalid cache client. View the module\'s README.md for more details => https://github.com/sebsylvester/botbuilder-wit/blob/master/README.md';
        it('should fail if not called with an accessToken', function () {
            function throwsException() {
                new WitRecognizer(null, {});
            }
            expect(throwsException).to.throw(invalidAccessToken);
        });

        it('should fail if called with a non-string accessToken', function () {
            function throwsException() {
                new WitRecognizer({ accessToken: 'foo' });
            }
            expect(throwsException).to.throw(invalidAccessToken);
        });

        it('should not fail if called with an accessToken of type "string"', function () {
            function throwsNoException() {
                new WitRecognizer("access token");
            }
            expect(throwsNoException).not.to.throw(Error);
        });

        it('should set the key expire duration to the value of the provided expire option ', function () {
            function RedisClient() { };
            const recognizer = new WitRecognizer("access token", { cache: new RedisClient(), expire: 3600 });
            expect(recognizer.cacheAdapter.expire).to.equal(3600);
        });

        it('should use a default expire value when the expire option is absent or invalid', function () {
            function RedisClient() { };
            const recognizer_1 = new WitRecognizer("access token", { cache: new RedisClient() });
            // Should use default when expire option is absent
            expect(recognizer_1.cacheAdapter.expire).to.equal(3 * 3600);
            const recognizer_2 = new WitRecognizer("access token", { cache: new RedisClient(), expire: '3600' });
            // Should use default when expire option is not a number
            expect(recognizer_2.cacheAdapter.expire).to.equal(3 * 3600);
        });

        it('should have a cacheAdapter of type RedisAdapter when using Redis', function () {
            function RedisClient() { };
            const recognizer = new WitRecognizer("access token", { cache: new RedisClient() });
            expect({}).to.be.instanceOf(Object);
            expect(recognizer.cacheAdapter).to.be.instanceOf(RedisAdapter.default);
        });

        it('should have a cacheAdapter of type MemcachedAdapter when using Memcached', function () {
            function Client() { };
            const recognizer = new WitRecognizer("access token", { cache: new Client() });
            expect(recognizer.cacheAdapter).to.be.instanceOf(MemcachedAdapter.default);
        });

        it('should throw an exception when providing an unknown cache client', function () {
            function UnknownClient() { };
            function throwsException() {
                new WitRecognizer("access token", { cache: new UnknownClient() });
            }
            expect(throwsException).to.throw(invalidCache);
        });
    });

    describe('#witClient', function () {
        it('should be an instance of Wit', function () {
            const witRecognizer = new WitRecognizer("access token");
            expect(witRecognizer.witClient).to.be.an.instanceof(Wit);
        });
    });

    describe('#recognize()', function () {
        const witRecognizer = new WitRecognizer("access token");

        // Typical response from Wit.ai if incorrect authorization token was used.
        const wit_error_response = {
            error: "Bad auth, check token/params",
            code: "no-auth"
        };

        // Response from Wit.ai when no intent or other entities were found
        const wit_no_entities_response = {
            _text: "default",
            entities: {}
        };

        // Response from Wit.ai when no intent was found, but there are other entities
        const wit_no_intent_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }]
            }
        };

        // Response from Wit.ai when only an intent was found
        const wit_intent_only_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }]
            }
        };

        // Response from Wit.ai when an intent and two entities were found
        const wit_intent_plus_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }]
            }
        };

        // Response from Wit.ai when an intent and two entities were found, one of which is of type 'interval'
        const wit_intent_plus_interval_response = {
            "_text": " Set the alarm tomorrow morning",
            "entities": {
                intent: [{ value: "set_alarm", confidence: 0.99 }],
                "reminder": [{
                    "confidence": 0.7947374127577925,
                    "entities": {},
                    "type": "value",
                    "value": "Set the alarm",
                    "suggested": true
                }],
                "datetime": [{
                    "confidence": 0.9978530104247438,
                    "values": [{
                        "to": {
                            "value": "2017-01-14T12:00:00.000Z",
                            "grain": "hour"
                        },
                        "from": {
                            "value": "2017-01-14T04:00:00.000Z",
                            "grain": "hour"
                        },
                        "type": "interval"
                    }],
                    "to": {
                        "value": "2017-01-14T12:00:00.000Z",
                        "grain": "hour"
                    },
                    "from": {
                        "value": "2017-01-14T04:00:00.000Z",
                        "grain": "hour"
                    },
                    "type": "interval"
                }]
            }
        };

        // Mock results from WitRecognizer's recognize method
        const defaultResult = { score: 0.0, intent: null };
        const intentIsNoneResult = {
            intent: 'none',
            score: 0.1,
            entities: [
                {
                    type: 'bar_entity',
                    entity: 'bar',
                    rawEntity: { type: "value", value: "bar", confidence: 0.95 },
                    score: 0.95,
                    startIndex: 10,
                    endIndex: 12
                },
                {
                    type: 'baz_entity',
                    entity: 'baz',
                    rawEntity: { type: "value", value: "baz", confidence: 0.85 },
                    score: 0.85,
                    startIndex: 20,
                    endIndex: 22
                }
            ]
        };
        const successResultOfIntentPlus = {
            intent: 'foo',
            score: 0.99,
            intents: [{ intent: 'foo', score: 0.99 }],
            entities: [
                {
                    type: 'bar_entity',
                    entity: 'bar',
                    rawEntity: { type: "value", value: "bar", confidence: 0.95 },
                    score: 0.95,
                    startIndex: 10,
                    endIndex: 12
                },
                {
                    type: 'baz_entity',
                    entity: 'baz',
                    rawEntity: { type: "value", value: "baz", confidence: 0.85 },
                    score: 0.85,
                    startIndex: 20,
                    endIndex: 22
                }
            ]
        };

        const successResultOfIntentPlusInterval = {
            score: 0.99,
            intent: 'set_alarm',
            intents: [{ intent: 'set_alarm', score: 0.99 }],
            entities: [
                {
                    type: 'reminder',
                    entity: 'Set the alarm',
                    rawEntity: {
                        "confidence": 0.7947374127577925,
                        "entities": {},
                        "type": "value",
                        "value": "Set the alarm",
                        "suggested": true
                    },
                    score: 0.7947374127577925,
                    startIndex: 1,
                    endIndex: 13
                },
                {
                    type: 'datetime',
                    entity: null,
                    rawEntity: {
                        "confidence": 0.9978530104247438,
                        "values": [{
                            "to": {
                                "value": "2017-01-14T12:00:00.000Z",
                                "grain": "hour"
                            },
                            "from": {
                                "value": "2017-01-14T04:00:00.000Z",
                                "grain": "hour"
                            },
                            "type": "interval"
                        }],
                        "to": {
                            "value": "2017-01-14T12:00:00.000Z",
                            "grain": "hour"
                        },
                        "from": {
                            "value": "2017-01-14T04:00:00.000Z",
                            "grain": "hour"
                        },
                        "type": "interval"
                    },
                    score: 0.9978530104247438
                }
            ]
        };

        const successResultOfIntentOnly = {
            intent: 'foo',
            score: 0.99,
            intents: [{ intent: 'foo', score: 0.99 }],
        };

        // Create a mock of the Wit.ai client
        function Wit() { }
        Wit.prototype.message = function (message) {
            var promise;

            switch (message) {
                case 'error':
                    promise = Promise.resolve(wit_error_response);
                    break;
                case 'no entities':
                    promise = Promise.resolve(wit_no_entities_response);
                    break;
                case 'no intent':
                    promise = Promise.resolve(wit_no_intent_response);
                    break;
                case 'intent only':
                    promise = Promise.resolve(wit_intent_only_response);
                    break;
                case 'intent plus':
                    promise = Promise.resolve(wit_intent_plus_response);
                    break;
                case 'intent plus interval':
                    promise = Promise.resolve(wit_intent_plus_interval_response);
                    break;
                case 'exception':
                    promise = Promise.reject(new Error('Something failed'));
                    break;
            }
            return promise;
        };

        // Replace the actual client with the mock
        witRecognizer.witClient = new Wit();

        it('should receive an error if Wit.ai responds with an error', function (done) {
            witRecognizer.recognize({ message: { text: 'error' } }, function (err, result) {
                expect(err.message).to.equal(wit_error_response.error);
                done();
            });
        });

        it('should receive the default result if context.message.text is undefined', function (done) {
            witRecognizer.recognize({ message: {} }, function (err, result) {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it('should receive the default result if no entities were found', function (done) {
            witRecognizer.recognize({ message: { text: 'no entities' } }, function (err, result) {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it('should receive the "none" intent if no intent but other entities were found', function (done) {
            witRecognizer.recognize({ message: { text: 'no intent' } }, function (err, result) {
                expect(result).to.deep.equal(intentIsNoneResult);
                done();
            });
        });

        it('should receive the success result if an intent plus another entity were found (1)', function (done) {
            witRecognizer.recognize({ message: { text: 'intent plus' } }, function (err, result) {
                expect(result).to.deep.equal(successResultOfIntentPlus);
                done();
            });
        });

        it('should receive the success result if an intent plus another entity were found (2)', function (done) {
            witRecognizer.recognize({ message: { text: 'intent plus interval' } }, function (err, result) {
                expect(result).to.deep.equal(successResultOfIntentPlusInterval);
                done();
            });
        });

        it('should receive the success result if only an intent was found', function (done) {
            witRecognizer.recognize({ message: { text: 'intent only' } }, function (err, result) {
                expect(result).to.deep.equal(successResultOfIntentOnly);
                done();
            });
        });

        it('should catch thrown exceptions', function (done) {
            witRecognizer.recognize({ message: { text: 'exception' } }, function (err) {
                expect(err.message).to.equal('Something failed');
                done();
            });
        });
    });

    describe('#getClientType()', function () {
        it('should return 0 for unknown clients', function () {
            const witRecognizer = new WitRecognizer("access token");
            function UnknownClient() { };
            let type = witRecognizer.getClientType(new UnknownClient());
            // 0 equals CacheClients.Unknown
            expect(type).to.equal(0);
            // Test with invalid input
            type = type = witRecognizer.getClientType('client');
            expect(type).to.equal(0);
        });

        it('should return 1 for Redis clients', function () {
            const witRecognizer = new WitRecognizer("access token");
            function RedisClient() { };
            const type = witRecognizer.getClientType(new RedisClient());
            // 0 equals CacheClients.Redis
            expect(type).to.equal(1);
        });

        it('should return 1 for Redis clients', function () {
            const witRecognizer = new WitRecognizer("access token");
            function Client() { };
            const type = witRecognizer.getClientType(new Client());
            // 0 equals CacheClients.Memcached
            expect(type).to.equal(2);
        });
    });

    describe('#witDecorator()', function () {
        // Redis client mock
        function RedisClient() { };
        RedisClient.prototype.expire = (key, expire, callback) => {
            callback(null, 1);
        };

        const witRecognizer = new WitRecognizer('accessToken', { cache: new RedisClient() });
        // const originalMessage = witRecognizer.witClient.message;
        const witSuccessResponse = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }]
            }
        };
        // Typical response from Wit.ai if incorrect authorization token was used.
        const witErrorResponse = {
            error: "Bad auth, check token/params",
            code: "no-auth"
        };

        it('should return the cached result when possible', function (done) {
            const message = () => {
                throw new Error('message() should not have been invoked.');
            };
            RedisClient.prototype.get = (key, callback) => {
                callback(null, JSON.stringify(witSuccessResponse));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witSuccessResponse);
                done();
            });
        });

        it('should use Wit.ai if the cache returned an error', function (done) {
            sinon.stub(console, 'error', (error) => { });
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return an error
            RedisClient.prototype.get = (key, callback) => {
                callback(new Error('Something failed'));
            };
            RedisClient.prototype.set = (key, value, option, expire, callback) => {
                callback(null, 'OK');
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witSuccessResponse);
                (<any>console).error.restore();
                done();
            });
        });

        it('should use Wit.ai if the cached result could not be parsed', function (done) {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return a response that cannot be parsed as JSON
            RedisClient.prototype.get = (key, callback) => {
                const triggersParsingError = JSON.stringify(witSuccessResponse) + '}';
                callback(null, triggersParsingError);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witSuccessResponse);
                done();
            });
        });

        it('should catch errors while accessing Wit.ai', function (done) {
            const message = () => {
                return Promise.reject(new Error('Test error message'));
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").catch(err => {
                expect(err.message).to.equal('Test error message');
                done();
            });
        });

        it('should not cache the response from Wit.ai if it contains an error message', function (done) {
            const message = () => {
                return Promise.resolve(witErrorResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witErrorResponse);
                done();
            });
        });

        it('should log the error if caching the response from Wit.ai failed', function (done) {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };
            RedisClient.prototype.set = (key, value, option, expire, callback) => {
                callback(new Error('Something failed'));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            sinon.stub(console, "error", (error) => {
                expect(error.message).to.equal('Something failed');
            });
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witSuccessResponse);
                (<any>console.error).restore();
                done();
            });
        });

        it('should log the error if refreshing the TTL failed', function (done) {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, JSON.stringify(witSuccessResponse));
            };
            RedisClient.prototype.expire = (key, expire, callback) => {
                callback(new Error('Something failed'));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            sinon.stub(console, "error", (error) => {
                expect(error.message).to.equal('Something failed');
            });
            decoratedMessage("There's a bar and a baz in here somewhere").then(res => {
                expect(res).to.deep.equal(witSuccessResponse);
                (<any>console.error).restore();
                done();
            });
        });
    });
});