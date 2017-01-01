import { Wit } from 'node-wit';

// Type of the object that represents an intent that is part of WitRecognizer's result
interface IIntent {
    intent: string;
    score: number;
}

// Type of the object(s) that represents an entity that is part of WitRecognizer's result
interface IEntity {
    entity: string;
    // The rawEntity property is included because Wit.ai doesn't have a perfectly consistent JSON response object.
    // In most cases there is a "value" property whose string value is then assigned to entity. 
    // However, in case the value property is undefined, entity will be null.
    // In that case, it's necessary to be able to access the original entity via the "rawEntity" property.
    rawEntity: Object;
    type: string;
    startIndex?: number;
    endIndex?: number;
    score?: number;
}

// Type of the first argument of the recognize method. Contains the message text.
interface IRecognizeContext {
    message: { text: string };
}

// Type of the second argument of the recognize method. Contains the processed result.
interface IIntentRecognizerResult {
    score: number;
    intent: string;
    intents?: IIntent[];
    entities?: IEntity[];
}

// NOTE: there is an important difference between IEntity and IWitEntity.
// IEntity is the type of entity the Bot Builder SDK expects to receive from the recognize method.
// Entities of type IWitEntity are contained in the JSON response received from Wit.ai.
interface IWitEntity {
    type?: string;
    confidence: number;
    value?: string;
    values?: Object[];
}

// Type of the object that represents the JSON response from Wit.ai.
interface IWitResults {
    msg_id?: string;
    _text?: string;
    entities?: {
        [index: string]: IWitEntity[];
    };
    error?: string;
}

class WitRecognizer {
    private _witClient: Wit;

    constructor(accessToken: string) {
        this._witClient = new Wit({ accessToken });
    }

    get witClient(): Wit {
        return this._witClient;
    }

    recognize(context: IRecognizeContext, done: (err: Error, result: IIntentRecognizerResult) => void) {
        let result = <IIntentRecognizerResult>{ score: 0.0, intent: null };
        if (context && context.message && context.message.text) {
            const utterance = context.message.text;

            // Send a request to Wit.ai
            this._witClient.message(utterance)
                .then((response: IWitResults) => {
                    // Check if Wit.ai responded with an error
                    if (response.error) {
                        console.log(response);
                        return done(new Error(response.error), null);
                    }

                    // Wit.ai currently does not support multiple intents.
                    // The intent property is either undefined or an array with a single object.
                    // Also note that, unlike LUIS.ai, Wit.ai treats an intent like a regular entity
                    let { intent, ...entities } = response.entities;
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
                        if(!result.intent) {
                            result.intent = 'none';
                            result.score = 1.0;
                        }

                        result.entities = [];
                        for (let key in entities) {
                            for (let entity of entities[key]) {
                                const { type, value, confidence } = entity;
                                const foundEntity = <IEntity>{
                                    type: key,
                                    entity: null, // default value
                                    rawEntity: <Object>entity,
                                    score: confidence,
                                };

                                // In most cases the entity's in the response from Wit.ai will be of type "value".
                                // There are other possible types, like "interval", in which case there will be a
                                // "values" property instead. To deal with this variety of structures, there's a
                                // "rawEntity" property to allow for custom entity processing in your own code.
                                if (type === 'value') {
                                    // Overwrite the default value null, with a value that must be a string.
                                    foundEntity.entity = value;
                                    // The startIndex and endIndex values will not always be useful.
                                    // For example, a datetime entity of type "value" will get a universal timestamp
                                    // as its value which cannot be found in the original message.
                                    foundEntity.startIndex = response._text.indexOf(value);
                                    foundEntity.endIndex = foundEntity.startIndex + (value.length -1);
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
}

module.exports = WitRecognizer;