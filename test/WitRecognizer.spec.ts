const { WitRecognizer } = require("../lib/WitRecognizer");
const RedisAdapter = require("../lib/adapters/RedisAdapter");
const MemcachedAdapter = require("../lib/adapters/MemcachedAdapter");
import { expect } from "chai";
import { Wit } from "node-wit";
import * as sinon from "sinon";
import { setImmediate } from "timers";

describe("WitRecognizer", () => {
    describe("constructor", () => {
        const invalidAccessToken = "Constructor must be invoked with an accessToken of type \"string\"";
        const invalidCache = "Invalid cache client. See the module's README.md for more details";
        it("should fail if not called with an accessToken", () => {
            function throwsException() {
                const witRecognizer = new WitRecognizer(null, {});
            }
            expect(throwsException).to.throw(invalidAccessToken);
        });

        it("should fail if called with a non-string accessToken", () => {
            function throwsException() {
                const witRecognizer = new WitRecognizer({ accessToken: "foo" });
            }
            expect(throwsException).to.throw(invalidAccessToken);
        });

        it('should not fail if called with an accessToken of type "string"', () => {
            function throwsNoException() {
                const witRecognizer = new WitRecognizer("access token");
            }
            expect(throwsNoException).not.to.throw(Error);
        });

        it("should set the key expire duration to the value of the provided expire option ", () => {
            function RedisClient() { }
            const recognizer = new WitRecognizer("access token", { cache: new RedisClient(), expire: 3600 });
            expect(recognizer.cacheAdapter.expire).to.equal(3600);
        });

        it("should use a default expire value when the expire option is absent or invalid", () => {
            function RedisClient() { }
            const recognizer_1 = new WitRecognizer("access token", { cache: new RedisClient() });
            // Should use default when expire option is absent
            expect(recognizer_1.cacheAdapter.expire).to.equal(3 * 3600);
            const recognizer_2 = new WitRecognizer("access token", { cache: new RedisClient(), expire: "3600" });
            // Should use default when expire option is not a number
            expect(recognizer_2.cacheAdapter.expire).to.equal(3 * 3600);
        });

        it("should have a cacheAdapter of type RedisAdapter when using Redis", () => {
            function RedisClient() { }
            const recognizer = new WitRecognizer("access token", { cache: new RedisClient() });
            expect({}).to.be.instanceOf(Object);
            expect(recognizer.cacheAdapter).to.be.instanceOf(RedisAdapter.default);
        });

        it("should have a cacheAdapter of type MemcachedAdapter when using Memcached", () => {
            function Client() { }
            const recognizer = new WitRecognizer("access token", { cache: new Client() });
            expect(recognizer.cacheAdapter).to.be.instanceOf(MemcachedAdapter.default);
        });

        it("should throw an exception when providing an unknown cache client", () => {
            function UnknownClient() { }
            function throwsException() {
                const witRecognizer = new WitRecognizer("access token", { cache: new UnknownClient() });
            }
            expect(throwsException).to.throw(invalidCache);
        });
    });

    describe("#witClient", () => {
        it("should be an instance of Wit", () => {
            const witRecognizer = new WitRecognizer("access token");
            expect(witRecognizer.witClient).to.be.an.instanceof(Wit);
        });
    });

    describe("#recognize()", () => {
        const witRecognizer = new WitRecognizer("access token");

        // Typical response from Wit.ai if incorrect authorization token was used.
        const wit_error_response = {
            error: "Bad auth, check token/params",
            code: "no-auth",
        };

        // Response from Wit.ai when no intent or other entities were found
        const wit_no_entities_response = {
            _text: "default",
            entities: {},
        };

        // Response from Wit.ai when no intent was found, but there are other entities
        const wit_no_intent_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }],
            },
        };

        // Response from Wit.ai when only an intent was found
        const wit_intent_only_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
            },
        };

        // Response from Wit.ai when an intent and two entities were found
        const wit_intent_plus_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }],
            },
        };

        // Response from Wit.ai when an intent and two entities were found, one of which is of type 'interval'
        const wit_intent_plus_interval_response = {
            _text: " Set the alarm tomorrow morning",
            entities: {
                intent: [{ value: "set_alarm", confidence: 0.99 }],
                reminder: [{
                    confidence: 0.7947374127577925,
                    entities: {},
                    type: "value",
                    value: "Set the alarm",
                    suggested: true,
                }],
                datetime: [{
                    confidence: 0.9978530104247438,
                    values: [{
                        to: {
                            value: "2017-01-14T12:00:00.000Z",
                            grain: "hour",
                        },
                        from: {
                            value: "2017-01-14T04:00:00.000Z",
                            grain: "hour",
                        },
                        type: "interval",
                    }],
                    to: {
                        value: "2017-01-14T12:00:00.000Z",
                        grain: "hour",
                    },
                    from: {
                        value: "2017-01-14T04:00:00.000Z",
                        grain: "hour",
                    },
                    type: "interval",
                }],
            },
        };

        // Mock results from WitRecognizer's recognize method
        const defaultResult = { score: 0.0, intent: null };
        const intentIsNoneResult = {
            intent: "none",
            score: 0.1,
            entities: [
                {
                    type: "bar_entity",
                    entity: "bar",
                    rawEntity: { type: "value", value: "bar", confidence: 0.95 },
                    score: 0.95,
                    startIndex: 10,
                    endIndex: 12,
                },
                {
                    type: "baz_entity",
                    entity: "baz",
                    rawEntity: { type: "value", value: "baz", confidence: 0.85 },
                    score: 0.85,
                    startIndex: 20,
                    endIndex: 22,
                },
            ],
        };
        const successResultOfIntentPlus = {
            intent: "foo",
            score: 0.99,
            intents: [{ intent: "foo", score: 0.99 }],
            entities: [
                {
                    type: "bar_entity",
                    entity: "bar",
                    rawEntity: { type: "value", value: "bar", confidence: 0.95 },
                    score: 0.95,
                    startIndex: 10,
                    endIndex: 12,
                },
                {
                    type: "baz_entity",
                    entity: "baz",
                    rawEntity: { type: "value", value: "baz", confidence: 0.85 },
                    score: 0.85,
                    startIndex: 20,
                    endIndex: 22,
                },
            ],
        };

        const successResultOfIntentPlusInterval = {
            score: 0.99,
            intent: "set_alarm",
            intents: [{ intent: "set_alarm", score: 0.99 }],
            entities: [
                {
                    type: "reminder",
                    entity: "Set the alarm",
                    rawEntity: {
                        confidence: 0.7947374127577925,
                        entities: {},
                        type: "value",
                        value: "Set the alarm",
                        suggested: true,
                    },
                    score: 0.7947374127577925,
                    startIndex: 1,
                    endIndex: 13,
                },
                {
                    type: "datetime",
                    entity: null,
                    rawEntity: {
                        confidence: 0.9978530104247438,
                        values: [{
                            to: {
                                value: "2017-01-14T12:00:00.000Z",
                                grain: "hour",
                            },
                            from: {
                                value: "2017-01-14T04:00:00.000Z",
                                grain: "hour",
                            },
                            type: "interval",
                        }],
                        to: {
                            value: "2017-01-14T12:00:00.000Z",
                            grain: "hour",
                        },
                        from: {
                            value: "2017-01-14T04:00:00.000Z",
                            grain: "hour",
                        },
                        type: "interval",
                    },
                    score: 0.9978530104247438,
                },
            ],
        };

        const successResultOfIntentOnly = {
            intent: "foo",
            score: 0.99,
            intents: [{ intent: "foo", score: 0.99 }],
        };

        // Create a mock of the Wit.ai client
        function Wit() { }
        Wit.prototype.message = (message) => {
            let promise;

            switch (message) {
                case "error":
                    promise = Promise.resolve(wit_error_response);
                    break;
                case "no entities":
                    promise = Promise.resolve(wit_no_entities_response);
                    break;
                case "no intent":
                    promise = Promise.resolve(wit_no_intent_response);
                    break;
                case "intent only":
                    promise = Promise.resolve(wit_intent_only_response);
                    break;
                case "intent plus":
                    promise = Promise.resolve(wit_intent_plus_response);
                    break;
                case "intent plus interval":
                    promise = Promise.resolve(wit_intent_plus_interval_response);
                    break;
                case "exception":
                    promise = Promise.reject(new Error("Something failed"));
                    break;
            }
            return promise;
        };

        // Replace the actual client with the mock
        witRecognizer.witClient = new Wit();

        it("should receive an error if Wit.ai responds with an error", (done) => {
            witRecognizer.recognize({ message: { text: "error" } }, (err, result) => {
                expect(err.message).to.equal(wit_error_response.error);
                done();
            });
        });

        it("should receive the default result if context.message.text is undefined", (done) => {
            witRecognizer.recognize({ message: {} }, (err, result) => {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it("should receive the default result if no entities were found", (done) => {
            witRecognizer.recognize({ message: { text: "no entities" } }, (err, result) => {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it('should receive the "none" intent if no intent but other entities were found', (done) => {
            witRecognizer.recognize({ message: { text: "no intent" } }, (err, result) => {
                expect(result).to.deep.equal(intentIsNoneResult);
                done();
            });
        });

        it("should receive the success result if an intent plus another entity were found (1)", (done) => {
            witRecognizer.recognize({ message: { text: "intent plus" } }, (err, result) => {
                expect(result).to.deep.equal(successResultOfIntentPlus);
                done();
            });
        });

        it("should receive the success result if an intent plus another entity were found (2)", (done) => {
            witRecognizer.recognize({ message: { text: "intent plus interval" } }, (err, result) => {
                expect(result).to.deep.equal(successResultOfIntentPlusInterval);
                done();
            });
        });

        it("should receive the success result if only an intent was found", (done) => {
            witRecognizer.recognize({ message: { text: "intent only" } }, (err, result) => {
                expect(result).to.deep.equal(successResultOfIntentOnly);
                done();
            });
        });

        it("should catch thrown exceptions", (done) => {
            witRecognizer.recognize({ message: { text: "exception" } }, (err) => {
                expect(err.message).to.equal("Something failed");
                done();
            });
        });
    });

    describe("#getClientType()", () => {
        it("should return 0 for unknown clients", () => {
            const witRecognizer = new WitRecognizer("access token");
            function UnknownClient() { }
            let type = witRecognizer.getClientType(new UnknownClient());
            // 0 equals CacheClients.Unknown
            expect(type).to.equal(0);
            // Test with invalid input
            type = type = witRecognizer.getClientType("client");
            expect(type).to.equal(0);
        });

        it("should return 1 for Redis clients", () => {
            const witRecognizer = new WitRecognizer("access token");
            function RedisClient() { }
            const type = witRecognizer.getClientType(new RedisClient());
            // 0 equals CacheClients.Redis
            expect(type).to.equal(1);
        });

        it("should return 1 for Redis clients", () => {
            const witRecognizer = new WitRecognizer("access token");
            function Client() { }
            const type = witRecognizer.getClientType(new Client());
            // 0 equals CacheClients.Memcached
            expect(type).to.equal(2);
        });
    });

    describe("#witDecorator()", () => {
        // Redis client mock
        function RedisClient() { }
        RedisClient.prototype.expire = (key, expire, callback) => {
            callback(null, 1);
        };

        const witRecognizer = new WitRecognizer("accessToken", { cache: new RedisClient() });
        // const originalMessage = witRecognizer.witClient.message;
        const witSuccessResponse = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }],
            },
        };
        // Typical response from Wit.ai if incorrect authorization token was used.
        const witErrorResponse = {
            error: "Bad auth, check token/params",
            code: "no-auth",
        };

        it("should return the cached result when possible", (done) => {
            const message = () => {
                throw new Error("message() should not have been invoked.");
            };
            RedisClient.prototype.get = (key, callback) => {
                callback(null, JSON.stringify(witSuccessResponse));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witSuccessResponse);
                done();
            });
        });

        it("should use Wit.ai if the cache returned an error", (done) => {
            sinon.stub(console, "error").callsFake((error) => { });
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return an error
            RedisClient.prototype.get = (key, callback) => {
                callback(new Error("Something failed"));
            };
            RedisClient.prototype.set = (key, value, option, expire, callback) => {
                callback(null, "OK");
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witSuccessResponse);
                (console as any).error.restore();
                done();
            });
        });

        it("should use Wit.ai if the cached result could not be parsed", (done) => {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return a response that cannot be parsed as JSON
            RedisClient.prototype.get = (key, callback) => {
                const triggersParsingError = JSON.stringify(witSuccessResponse) + "}";
                callback(null, triggersParsingError);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witSuccessResponse);
                done();
            });
        });

        it("should catch errors while accessing Wit.ai", (done) => {
            const message = () => {
                return Promise.reject(new Error("Test error message"));
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            sinon.stub(console, "error").callsFake((error) => {
                const e = error;
            });

            decoratedMessage("There's a bar and a baz in here somewhere").catch((err) => {
                expect(err.message).to.equal("Test error message");
                setImmediate(() => {
                    (console.error as any).restore();
                    done();
                });
            });
        });

        it("should not cache the response from Wit.ai if it contains an error message", (done) => {
            const message = () => {
                return Promise.resolve(witErrorResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witErrorResponse);
                done();
            });
        });

        it("should log the error if caching the response from Wit.ai failed", (done) => {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, null);
            };
            RedisClient.prototype.set = (key, value, option, expire, callback) => {
                callback(new Error("Something failed"));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            sinon.stub(console, "error").callsFake((error) => {
                expect(error.message).to.equal("Something failed");
            });

            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witSuccessResponse);
                (console.error as any).restore();
                done();
            });
        });

        it("should log the error if refreshing the TTL failed", (done) => {
            const message = () => {
                return Promise.resolve(witSuccessResponse);
            };
            // Force the cache to return no response. This triggers a new request to Wit.ai.
            RedisClient.prototype.get = (key, callback) => {
                callback(null, JSON.stringify(witSuccessResponse));
            };
            RedisClient.prototype.expire = (key, expire, callback) => {
                callback(new Error("Something failed"));
            };

            const decoratedMessage = witRecognizer.witDecorator(message);
            sinon.stub(console, "error").callsFake((error) => {
                expect(error.message).to.equal("Something failed");
            });
            decoratedMessage("There's a bar and a baz in here somewhere").then((res) => {
                expect(res).to.deep.equal(witSuccessResponse);
                (console.error as any).restore();
                done();
            });
        });
    });
});
