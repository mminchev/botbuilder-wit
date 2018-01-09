import { createHash } from "crypto";
import { MessageResponse, Wit, WitContext } from "node-wit";
import CacheAdapter from "./adapters/CacheAdapter";
import MemcachedAdapter from "./adapters/MemcachedAdapter";
import RedisAdapter from "./adapters/RedisAdapter";
import {
    CacheClients,
    IEntity,
    IIntentRecognizerResult,
    IOptions,
    IRecognizeContext,
    IWitResults,
    MessageHandler,
} from "./types";

/**
 * The WitRecognizer class that is used in conjunction with an IntentDialog.
 * Example:
 * const recognizer = new WitRecognizer('Wit.ai_access_token');
 * const dialog = new IntentDialog({recognizers: [recognizer]});
 */
export class WitRecognizer {
    public witClient: Wit;
    public cacheAdapter: CacheAdapter = null;

    /**
     * Creates an instance of WitRecognizer.
     * @param accessToken {string} API token from Wit.ai
     * @param options {IOptions}
     */
    constructor(accessToken: string, options: IOptions = {}) {
        const { cache } = options;

        if (!accessToken || typeof accessToken !== "string") {
            const msg = "Constructor must be invoked with an accessToken of type \"string\"";
            throw new Error(msg);
        }
        this.witClient = new Wit({ accessToken });

        // Evaluate the type of the cache client
        // Instantiate a corresponding adapter
        if (cache) {
            // By default, key's will expire after 3 hours
            const expire = typeof options.expire === "number" ? options.expire : 3 * 3600;
            const clientType = this.getClientType(cache);

            if (clientType !== CacheClients.Unknown) {
                const _message = this.witClient.message;
                // Override the original message function with a new implementation
                // that checks the cache first before sending a request to Wit.ai.
                // The response from Wit.ai is then stored in the cache.
                this.witClient.message = this.witDecorator(_message);
            }

            // Instantiate the client's corresponding adapter
            switch (clientType) {
                case CacheClients.Redis:
                    this.cacheAdapter = new RedisAdapter(cache, expire);
                    break;
                case CacheClients.Memcached:
                    this.cacheAdapter = new MemcachedAdapter(cache, expire);
                    break;
                default: // CacheClients.Unknown
                    const msg = "Invalid cache client. See the module's README.md for more details";
                    throw new Error(msg);
            }
        }
    }

    /**
     * Makes a request to Wit.ai and parses the response in a way the Bot Builder SDK understands.
     * @param {IRecognizeContext} context - contains the message received from the user
     * @param {function} done - the result callback
     */
    public recognize(context: IRecognizeContext, done: (err: Error, result: IIntentRecognizerResult) => void) {
        const result = { score: 0.0, intent: null } as IIntentRecognizerResult;
        if (context && context.message && context.message.text) {
            const utterance = context.message.text;

            // Send a request to Wit.ai
            this.witClient.message(utterance, {} as WitContext)
                .then((response: IWitResults) => {
                    // Check if Wit.ai responded with an error
                    if (response.error) {
                        return done(new Error(response.error), null);
                    }

                    // Wit.ai currently does not support multiple intents.
                    // The intent property is either undefined or an array with a single object.
                    // Also note that, unlike LUIS.ai, Wit.ai treats an intent like a regular entity
                    const { intent, ...entities } = response.entities;
                    const hasOtherEntities = Object.keys(entities).length > 0;

                    // If there no useful response from Wit.ai, trigger the IntentDialog's default handler
                    if (!intent && !hasOtherEntities) {
                        return done(null, result);
                    }

                    if (intent) {
                        const { value, confidence } = intent[0];
                        // Update the default values for intent (null) and score (0.0)
                        result.intent = value;
                        result.score = confidence;
                        result.intents = [{ intent: value, score: confidence }];
                    }

                    if (hasOtherEntities) {
                        // If Wit.ai did not discover any intent, but it did find other entities,
                        // the result's score property must not be left to its default value of null.
                        // Otherwise, the Bot Builder SDK will trigger the dialog's default handler
                        // with a default result object => { score: 0.0, intent: null }.
                        // Any other entities will not be included. The action below prevents this behavior.
                        // Setting score to 0.1 lets the intent still be triggered but keeps it from
                        // stomping on other models.
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
                                    entity: null, // default value
                                    rawEntity: entity as {[key: string]: any},
                                    score: confidence,
                                } as IEntity;

                                // In most cases the entity's in the response from Wit.ai will be of type "value".
                                // There are other possible types, like "interval", in which case there will be a
                                // "values" property instead. To deal with this variety of structures, there's a
                                // "rawEntity" property to allow for custom entity processing in your own code.
                                if (type === "value") {
                                    // Overwrite the default value null, with a value that must be a string.
                                    foundEntity.entity = value;
                                    // The startIndex and endIndex values will not always be useful.
                                    // For example, a datetime entity of type "value" will get a universal timestamp
                                    // as its value which cannot be found in the original message.
                                    foundEntity.startIndex = response._text.indexOf(value);
                                    foundEntity.endIndex = foundEntity.startIndex + (value.length - 1);
                                }
                                result.entities.push(foundEntity);
                            }
                        }
                    }
                    done(null, result);
                })
                .catch((err: Error) => {
                    done(err, null);
                });
        } else {
            done(null, result);
        }
    }

    /**
     * Determines the type of the provided cache client.
     * @param {*} client - the client with which the results will be saved to the cache.
     * @returns {CacheClients} any of the possible enum values
     */
    public getClientType(client: any): CacheClients {
        let clientType = CacheClients.Unknown;

        if (typeof client === "object" && client.constructor) {
            switch (client.constructor.name) {
                case "RedisClient":
                    clientType = CacheClients.Redis;
                    break;
                case "Client":
                    clientType = CacheClients.Memcached;
            }
        }

        return clientType;
    }

    /**
     * The decorator function that adds caching to the Wit.ai request/response cycle.
     * @param {function} message - the original Wit.message function that will be decorated
     * @returns {function} the decorated function
     */
     private witDecorator(message: MessageHandler): MessageHandler {
        return (utterance, context) => {
            // Create hash from the utterance.
            const hash = createHash("sha256").update(utterance);
            const key = hash.digest("hex");

            return new Promise<MessageResponse>((resolve, reject) => {
                // Check if the key exists
                this.cacheAdapter.get(key, (error, result) => {
                    if (error) {
                        console.error(error);
                        // If something failed while accessing the cache,
                        // it's still possible to continue and access Wit.ai,
                        // so there is no need to invoke reject(error)
                        return resolve(null);
                    }

                    try {
                        resolve(result ? JSON.parse(result) : null);
                    } catch (error) {
                        resolve(null);
                    }
                });
            }).then((result) => {
                if (result) {
                    // Reset expire to initial value
                    this.cacheAdapter.touch(key, (error, result) => {
                        if (error) { console.error(error); }
                    });
                    // Return the result, skip Wit.ai
                    return Promise.resolve(result);
                } else {
                    // No cached result was found, use Wit.ai to parse the utterance
                    const witPromise = message(utterance, context);
                    witPromise.then((result: IWitResults) => {
                        // Cache the result from Wit.ai unless it contains an error message
                        // Possible error would be: "Bad auth, check token/params"
                        if (!result.error) {
                            const value = JSON.stringify(result);
                            this.cacheAdapter.set(key, value, (error, result) => {
                                if (error) { console.error(error); }
                            });
                        }
                    }).catch((error: Error) => {
                        console.error(error);
                    });

                    return witPromise;
                }
            });
        };
    }
}
