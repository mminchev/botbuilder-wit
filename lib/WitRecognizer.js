"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const node_wit_1 = require("node-wit");
const MemcachedAdapter_1 = require("./adapters/MemcachedAdapter");
const RedisAdapter_1 = require("./adapters/RedisAdapter");
const types_1 = require("./types");
class WitRecognizer {
    constructor(accessToken, options = {}) {
        this.cacheAdapter = null;
        const { cache } = options;
        if (!accessToken || typeof accessToken !== "string") {
            const msg = "Constructor must be invoked with an accessToken of type \"string\"";
            throw new Error(msg);
        }
        this.witClient = new node_wit_1.Wit({ accessToken });
        if (cache) {
            const expire = typeof options.expire === "number" ? options.expire : 3 * 3600;
            this.prefix = typeof options.prefix === "string" ? options.prefix : "";
            const clientType = this.getClientType(cache);
            if (clientType !== types_1.CacheClients.Unknown) {
                const _message = this.witClient.message;
                this.witClient.message = this.witDecorator(_message);
            }
            switch (clientType) {
                case types_1.CacheClients.Redis:
                    this.cacheAdapter = new RedisAdapter_1.default(cache, expire);
                    break;
                case types_1.CacheClients.Memcached:
                    this.cacheAdapter = new MemcachedAdapter_1.default(cache, expire);
                    break;
                default:
                    const msg = "Invalid cache client. See the module's README.md for more details";
                    throw new Error(msg);
            }
        }
    }
    recognize(context, done) {
        const result = { score: 0.0, intent: null };
        if (context && context.message && context.message.text) {
            const utterance = context.message.text;
            this.witClient.message(utterance, {})
                .then((response) => {
                if (response.error) {
                    return done(new Error(response.error), null);
                }
                const _a = response.entities, { intent } = _a, entities = __rest(_a, ["intent"]);
                const hasOtherEntities = Object.keys(entities).length > 0;
                if (!intent && !hasOtherEntities) {
                    return done(null, result);
                }
                if (intent) {
                    const { value, confidence } = intent[0];
                    result.intent = value;
                    result.score = confidence;
                    result.intents = [{ intent: value, score: confidence }];
                }
                if (hasOtherEntities) {
                    if (!result.intent) {
                        result.intent = "none";
                        result.score = 0.1;
                    }
                    result.entities = [];
                    for (const key of Object.keys(entities)) {
                        for (const entity of entities[key]) {
                            const { type, value, confidence } = entity;
                            const foundEntity = {
                                type: key,
                                entity: null,
                                rawEntity: entity,
                                score: confidence,
                            };
                            if (type === "value") {
                                foundEntity.entity = value;
                                foundEntity.startIndex = response._text.indexOf(value);
                                foundEntity.endIndex = foundEntity.startIndex + (value.length - 1);
                            }
                            result.entities.push(foundEntity);
                        }
                    }
                }
                done(null, result);
            })
                .catch((err) => {
                done(err, null);
            });
        }
        else {
            done(null, result);
        }
    }
    getClientType(client) {
        let clientType = types_1.CacheClients.Unknown;
        if (typeof client === "object" && client.constructor) {
            switch (client.constructor.name) {
                case "RedisClient":
                    clientType = types_1.CacheClients.Redis;
                    break;
                case "Client":
                    clientType = types_1.CacheClients.Memcached;
            }
        }
        return clientType;
    }
    witDecorator(message) {
        return (utterance, context) => {
            const hash = crypto_1.createHash("sha256").update(utterance);
            const key = this.prefix + hash.digest("hex");
            return new Promise((resolve, reject) => {
                this.cacheAdapter.get(key, (error, result) => {
                    if (error) {
                        console.error(error);
                        return resolve(null);
                    }
                    try {
                        resolve(result ? JSON.parse(result) : null);
                    }
                    catch (error) {
                        resolve(null);
                    }
                });
            }).then((result) => {
                if (result) {
                    this.cacheAdapter.touch(key, (error, result) => {
                        if (error) {
                            console.error(error);
                        }
                    });
                    return Promise.resolve(result);
                }
                else {
                    const witPromise = message(utterance, context);
                    witPromise.then((result) => {
                        if (!result.error) {
                            const value = JSON.stringify(result);
                            this.cacheAdapter.set(key, value, (error, result) => {
                                if (error) {
                                    console.error(error);
                                }
                            });
                        }
                    }).catch((error) => {
                        console.error(error);
                    });
                    return witPromise;
                }
            });
        };
    }
}
exports.WitRecognizer = WitRecognizer;
//# sourceMappingURL=WitRecognizer.js.map