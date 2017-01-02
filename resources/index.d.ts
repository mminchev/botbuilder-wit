declare module "node-wit" {
    interface WitOptions {
        accessToken: string;
    }

    export class Wit {
        constructor(options: WitOptions);
        message(text: string): any;
    }
}