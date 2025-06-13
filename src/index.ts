import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  type Plugin,
  logger,
  parseKeyValueXml,
  createUniqueUuid,
  asUUID,
  parseJSONObjectFromText,
  MemoryType,
} from '@elizaos/core';

import { z } from 'zod';
import {getNewsData} from "./actions/action_get_news_data.ts";
import {getOnChainData} from "./actions/action_get_on_chain_data.ts";
import {processNewsData} from "./actions/action_process_news.ts";
import {processPriceData} from "./actions/action_process_price.ts";
import {reply} from "./actions/action_reply_1.ts" ;
import { ApiService } from './services/apiService.ts';
import { ActionEventPayload, composePromptFromState, EventType, messageHandlerTemplate, 
  MessagePayload, MessageReceivedHandlerParams, PluginEvents } from '@elizaos/core';


import { v4 } from 'uuid';
// import {getOnChainData} from "./actions/action_get_on_chain_data" ;
/**
 * Defines the configuration schema for a plugin, including the validation rules for the plugin name.
 *
 * @type {import('zod').ZodObject<{ EXAMPLE_PLUGIN_VARIABLE: import('zod').ZodString }>}
 */
const configSchema = z.object({
  EXAMPLE_PLUGIN_VARIABLE: z
    .string()
    .min(1, 'Example plugin variable is not provided')
    .optional()
    .transform((val) => {
      if (!val) {
        logger.warn('Example plugin variable is not provided (this is expected)');
      }
      return val;
    }),
});

/**
 * Example HelloWorld action
 * This demonstrates the simplest possible action structure
 */
/**
 * Action representing a hello world message.
 * @typedef {Object} Action
 * @property {string} name - The name of the action.
 * @property {string[]} similes - An array of related actions.
 * @property {string} description - A brief description of the action.
 * @property {Function} validate - Asynchronous function to validate the action.
 * @property {Function} handler - Asynchronous function to handle the action and generate a response.
 * @property {Object[]} examples - An array of example inputs and expected outputs for the action.
 */
const helloWorldAction: Action = {
  name: 'HELLO_WORLD',
  similes: ['GREET', 'SAY_HELLO'],
  description: 'Responds with a simple hello world message',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling HELLO_WORLD action');

      // Simple response content
      const responseContent: Content = {
        text: 'hello world!',
        actions: ['HELLO_WORLD'],
        source: message.content.source,
      };

      // Call back with the hello world message
      await callback(responseContent);

      return responseContent;
    } catch (error) {
      logger.error('Error in HELLO_WORLD action:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you say hello?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'hello world!',
          actions: ['HELLO_WORLD'],
        },
      },
    ],
  ],
};

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: 'HELLO_WORLD_PROVIDER',
  description: 'A simple example provider',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    return {
      text: 'I am a provider',
      values: {},
      data: {},
    };
  },
};

export class StarterService extends Service {
  static serviceType = 'starter';
  capabilityDescription =
    'This is a starter service which is attached to the agent through the starter plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting starter service - MODIFIED: ${new Date().toISOString()} ***`);
    const service = new StarterService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error('Starter service not found');
    }
    service.stop();
  }

  async stop() {
    logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
  }
}


const managerMsgHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  const manageTemplate_Intro = `
  # You are a professional cryptoCurrency trader. If you received message from user, you should start you actions immediately. You are supposed to make a trade by executing actions in the following steps: 1."GET_PRICE" and "GET_NEWS" (these two actions should be take together, not single); 2."PROCESS_PRICE" and "PROCESS_NEW " (these two actions should be take together, not single); 3."MAKE_TRADE"; 4."REPLY".\n\n
  # Task: Generate dialog with actions.
  # Instructions: Write the next message for user.
  "thought" should be a short description of what the agent is thinking about and planning.
  "message" should be the next message for user which they will send to the conversation.
  "actions" should be the next actions that agent will conduct, "actions" should include one or more actions. 
  # Possible response actions: "GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "MAKE_TRADE", "REPLY", "IGNORE"\n\n
  `;
  const manageTemplate_Example = `
  # Action Examples:
  user: Please help me to make a decision of BTC trade, am I supposed to buy or sell?\nagent: I'll conduct a research of BTC now. (actions: "GET_PRICE", "GET_NEWS")\n\n
  agent: I've got the price and news of BTC, analysing. (actions: "PROCESS_PRICE", "PROCESS_NEWS")\n\n
  agent: Analysis done, the price of BTC seems to be going down, we should sell part of them, about 20%. (actions: "MAKE_TRADE")\n\n
  agent: Finally, reply the decision to user. The decision is: -0.2/1.0 of your BTC. (actions: "REPLY")
  `;
  const manageTemplate_Rules = `
  # RULES:
  RULE 1: User is asking the proposal to make a cryptoCurrency trade, you should begin to make a trade by executing actions in the following order above, and reply in the end;\n
  RULE 2: When your are executing ations, they must be executed strictly in the order of steps;\n
  RULE 3: You should decide next actions with the state of the steps'execution provided below, after actions in step before has been "DONE", execute actions in the next step;\n
  RULE 4: User is talking about other things, or your are executing actions (eg: In step 2, "PROCESS_PRICE" done, but still waiting "PROCESS_NEWS"), set "actions" as "IGNORE".\n
  RULE 5: The response must contain "thought", "message", and "actions".\n\n
  `;
  const manageTemplate_state = `
  The state of the steps'execution:
  `;
  const manageTemplate_format = `
  # Response format
  # Response format should be formatted in a valid JSON block like this:

  {
      "thought": "<string>",
      "message": "<string>",
      "actions": ["<string>", "<string>", "<string>"]
  }

  # Your response should include the valid JSON block and nothing else.
  # Response format end
  `;
  const manageTemplate_take_actions = `
  # Choose your next actions within the [Possible response action] and the [RULES] mentioned before.
  # Your response should be formatted in a valid JSON block like this:

  {
      "thought": "<string>",
      "message": "<string>",
      "actions": ["<string>", "<string>", "<string>"]
  }
  # Now, choose your next actions:
  `;
  // First, save the incoming message
  logger.warn('[Manager Handler] Saving message to memory and embeddings');
  if(message && message.content && message.content.text){
    await Promise.all([
      runtime.addEmbeddingToMemory(message),
      runtime.createMemory(message, 'messages'),
    ]);
  }
  let state = await runtime.composeState(message);
  var apiService = runtime.getService(ApiService.serviceType) as ApiService;
  var userMsgTmp = '';
  var prompt;
  // Message from CryptoTrade Actions, take next actions
  if(message && message.content && message.content.text.startsWith('CryptoTrade_Action')){
    prompt = composePromptFromState({
        state,
        template: manageTemplate_Intro + manageTemplate_Example + 
        manageTemplate_Rules + manageTemplate_state + apiService.get_state() + 
        '\n\n' + manageTemplate_take_actions
    });
  }else{
    // Message from user or system
    if(message && message.content && message.content.text){
      userMsgTmp = '\n# User\'s message as below:\n\nuser:' + message.content.text + '\n# User\'s message end';
    }
    prompt = composePromptFromState({
        state,
        template: manageTemplate_Intro + manageTemplate_Example + 
        manageTemplate_Rules + manageTemplate_state + apiService.get_state() + 
        '\n\n' + userMsgTmp + manageTemplate_format
    });
  }

  logger.warn('[CryptoTrader] *** prompt content ***\n', prompt);
  const response = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt: prompt,
  });

  // Attempt to parse the XML response
  logger.warn('[CryptoTrader] *** response ***\n', response);
  // const parsedXml = parseKeyValueXml(response);
  // const parsedJson = parseJSONObjectFromText(response);
  const parsedJson = JSON.parse(response);
  // logger.warn('[CryptoTrader] *** Parsed JSON Content ***\n', parsedJson);

  let responseContent: Content | null = null;
  let responseMessages: Memory[] = [];
  
  // Map parsed XML to Content type, handling potential missing fields
  // if (parsedXml) {
  //   responseContent = {
  //     ...parsedXml,
  //     thought: parsedXml.thought || '',
  //     actions: parsedXml.actions || ['IGNORE'],
  //     providers: parsedXml.providers || [],
  //     text: parsedXml.text || '',
  //     simple: parsedXml.simple || false,
  //   };
  // } else {
  //   responseContent = null;
  // }
  
  logger.warn('[CryptoTrader] *** message.id ***\n', message.id);
  if (parsedJson) {
    responseContent = {
      ...parsedJson,
      thought: parsedJson.thought || '',
      actions: parsedJson.actions || ['IGNORE'],
      text: parsedJson.text || ''
    };
  } else {
    responseContent = null;
  }
  // logger.warn('[CryptoTrader] *** responseContent ***\n', responseContent);
  if (responseContent && message.id) {
      responseContent.inReplyTo = createUniqueUuid(runtime, message.id);

      const responseMessage = {
        id: asUUID(v4()),
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: responseContent,
        roomId: message.roomId,
        createdAt: Date.now(),
      };
      
      responseMessages = [responseMessage];
  }
  if (
          responseContent &&
          responseContent.text &&
          (responseContent.actions?.length === 0 ||
            (responseContent.actions?.length === 1 &&
              responseContent.actions[0].toUpperCase() === 'REPLY'))
        ) {
          await callback(responseContent);
        } else {
          // this will process GET_DATA/NEWS ....
          await runtime.processActions(message, responseMessages, state, callback);
        }
  }

const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  // Emit run started event
  const startTime = Date.now();
  await runtime.emitEvent(EventType.RUN_STARTED, {
    runtime,
    messageId: message.id,
    roomId: message.roomId,
    entityId: message.entityId,
    startTime,
    status: 'started',
    source: 'messageHandler',
  });

  // First, save the incoming message
  logger.debug('[Bootstrap] Saving message to memory and embeddings');
  await Promise.all([
    runtime.addEmbeddingToMemory(message),
    runtime.createMemory(message, 'messages'),
  ]);
  let state = await runtime.composeState(message);
  const prompt = composePromptFromState({
    state,
    template: runtime.character.templates?.messageHandlerTemplate || messageHandlerTemplate,
  });

  await runtime.emitEvent(EventType.MESSAGE_SENT, {
    runtime,
    messageId: message.id,
    roomId: message.roomId,
    entityId: message.entityId,
    startTime,
    status: 'started',
    source: 'messageHandler',
  });


}

var events:PluginEvents = {
  [EventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      if (!payload.callback) {
        logger.warn('No callback provided for message');
        return;
      }
      // logger.warn('payload.runtime.character.name: [' + payload.runtime.character.name + ']');
      await managerMsgHandler({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback,
        onComplete: payload.onComplete
      });
    },
  ],

  [EventType.MESSAGE_SENT]: [
    async (payload: MessagePayload) => {
      logger.warn(`[CryptoTrader] Message sent: ${payload.message}`);
      if(payload.source && payload.source.startsWith('CryptoTrade_Action')){
        await managerMsgHandler({
          runtime: payload.runtime,
          message: payload.message,
          callback: payload.callback,
          onComplete: payload.onComplete,
        });
      }
    },
  ],

  [EventType.ACTION_STARTED]: [
    async (payload: ActionEventPayload) => {
      logger.warn(`[Bootstrap] Action started: ${payload.actionName} (${payload.actionId})`);
    },
  ],

  [EventType.ACTION_COMPLETED]: [
    async (payload: ActionEventPayload) => {
      const status = payload.error ? `failed: ${payload.error.message}` : 'completed';
      logger.warn(`[Bootstrap] Action ${status}: ${payload.actionName} (${payload.actionId})`);
    },
  ]
};

export const starterPlugin: Plugin = {
  name: 'plugin-exam',
  description: 'Plugin starter for elizaOS',
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** TESTING DEV MODE - PLUGIN MODIFIED AND RELOADED! ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      _runtime,
      params,
    ) => {
       // Maybe you check the prompt and route to different models
      // if (params.prompt.includes('code')) {
      //   return await callCodeSpecializedModel(params);
      // } else if (params.prompt.includes('creative')) {
      //   return await callCreativeModel(params);
      // } else {
      //   return await callGeneralModel(params);
      // }
      return 'Crypto Plugin ModelType.TEXT_SMALL called...';
    },
    [ModelType.TEXT_LARGE]: async (
      _runtime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      return 'Crypto Plugin ModelType.TEXT_LARGE called......';
    },
  },
  routes: [
    {
      name: 'hello-world-route',
      path: '/helloworld',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: 'Hello World!',
        });
      },
    },
  ],
  services: [StarterService, ApiService],
  actions: [helloWorldAction, reply, getNewsData, 
    getOnChainData, processNewsData, processPriceData],
  providers: [helloWorldProvider],
  events:events
};

export default starterPlugin;
