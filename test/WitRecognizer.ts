///<reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
const WitRecognizer = require('../lib/WitRecognizer');
import { Wit } from 'node-wit';
import { expect } from 'chai';

describe('WitRecognizer', function () {
    describe('constructor', function () {
        it('should fail if not called with an accessToken', function () {
            function throwsException () {
                new WitRecognizer();
            }
            expect(throwsException).to.throw('Could not find access token, learn more at https://wit.ai/docs');
        });

        it('should not fail if called with an accessToken', function () {
            function throwsException () {
                new WitRecognizer("access token");
            }
            expect(throwsException).not.to.throw(Error);
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
            error : "Bad auth, check token/params",
            code : "no-auth"
        };

        // Response from Wit.ai when no intent could be found
        const wit_no_entities_response = {
            _text: "default",
            entities: {}
        };

        // Response from Wit.ai when
        const wit_no_intent_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }]
            }
        };

        // Response from Wit.ai when an intent and two entities were be found
        const wit_intent_response = {
            _text: "There's a bar and a baz in here somewhere",
            entities: {
                intent: [{ value: "foo", confidence: 0.99 }],
                bar_entity: [{ type: "value", value: "bar", confidence: 0.95 }],
                baz_entity: [{ type: "value", value: "baz", confidence: 0.85 }]
            }
        };

        // Mock results from WitRecognizer's recognize method
        const defaultResult = { score: 0.0, intent: null };
        const intentIsNoneResult = {
            intent: 'none',
            score: 1.0,
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
        const successResult = {
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

        // Create a mock of the Wit.ai client
        function Wit() {}
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
                case 'intent':
                    promise = Promise.resolve(wit_intent_response);
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
            witRecognizer.recognize({ message: { text: 'error' }}, function (err, result) {
                expect(err.message).to.equal(wit_error_response.error);
                done();
            });
        });

        it('should receive the default result if context.message.text is undefined', function (done) {
            witRecognizer.recognize({ message: {}}, function (err, result) {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it('should receive the default result if no entities were found', function (done) {
            witRecognizer.recognize({ message: { text: 'no entities' }}, function (err, result) {
                expect(result).to.deep.equal(defaultResult);
                done();
            });
        });

        it('should receive the "none" intent if no intent but other entities were found', function (done) {
            witRecognizer.recognize({ message: { text: 'no intent' }}, function (err, result) {
                expect(result).to.deep.equal(intentIsNoneResult);
                done();
            });
        });

        it('should receive the success result if an intent was found', function (done) {
            witRecognizer.recognize({ message: { text: 'intent' }}, function (err, result) {
                expect(result).to.deep.equal(successResult);
                done();
            });
        });

        it('should catch errors if an exception is thrown during the request', function (done) {
            witRecognizer.recognize({ message: { text: 'exception' }}, function (err) {
                expect(err.message).to.equal('Something failed');
                done();
            });
        });
    });
});