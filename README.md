# botbuilder-wit
Node.js module that provides [Wit.ai](https://wit.ai) NLP integration for the [Microsoft Bot Framework](https://dev.botframework.com/).

## Installation

`npm install --save botbuilder-wit`

## Usage
This package does **not** work with Wit.ai's *Story* feature. This is by design. That doesn't mean you can't use it entirely, just not in combination with the IntentDialog that uses the WitRecognizer.
```
const { IntentDialog } = require('botbuilder');
const WitRecognizer = require('botbuilder-wit');
const recognizer = new WitRecognizer('Wit.ai_access_token');
const intents = new IntentDialog({recognizers: [recognizer]});

intents.matches('intent.name', (session, args) => {...});
intents.onDefault(session => {...});

bot.dialog('/', intents)
```

## Using Entities

You can use the utility class [EntityRecognizer](https://docs.botframework.com/en-us/node/builder/chat-reference/classes/_botbuilder_d_.entityrecognizer.html) to parse & resolve common entities.
```
// Inside your dialog handler that receives the session and arguments object
const { EntityRecognizer } = require('botbuilder');
const location = EntityRecognizer.findEntity(args.entities, 'location')
```

## License

MIT