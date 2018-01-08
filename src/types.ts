import { MessageResponse, WitContext } from "node-wit";

// Type of the object that represents an intent that is part of WitRecognizer's result
export interface IIntent {
    intent: string;
    score: number;
}

// Type of the object(s) that represents an entity that is part of WitRecognizer's result
export interface IEntity {
    entity: string;
    // The rawEntity property is included because Wit.ai doesn't have a perfectly consistent JSON response object.
    // In most cases there is a "value" property whose string value is then assigned to entity.
    // However, in case the value property is undefined, entity will be null.
    // In that case, it's necessary to be able to access the original entity via the "rawEntity" property.
    rawEntity: {[key: string]: any};
    type: string;
    startIndex?: number;
    endIndex?: number;
    score?: number;
}

// Type of the first argument of the recognize method. Contains the message text.
export interface IRecognizeContext {
    message: { text: string };
}

// Type of the second argument of the recognize method. Contains the processed result.
export interface IIntentRecognizerResult {
    score: number;
    intent: string;
    intents?: IIntent[];
    entities?: IEntity[];
}

// NOTE: there is an important difference between IEntity and IWitEntity.
// IEntity is the type of entity the Bot Builder SDK expects to receive from the recognize method.
// Entities of type IWitEntity are contained in the JSON response received from Wit.ai.
export interface IWitEntity {
    type?: string;
    confidence: number;
    value?: string;
    values?: Array<{[key: string]: any}>;
}

// Type of the object that represents the JSON response from Wit.ai.
export interface IWitResults {
    msg_id?: string;
    _text?: string;
    entities?: {
        [index: string]: IWitEntity[];
    };
    error?: string;
}

export interface IOptions {
    cache?: any;
    expire?: number;
}

export enum CacheClients {
    Unknown, // 0
    Redis,
    Memcached,
}

// Type of the Wit.message method
export type MessageHandler = (message: string, context: WitContext) => Promise<MessageResponse>;
export type CacheAdapterResult = (error: Error, result: any) => void;
