import type { ActionEventPayload, MessagePayload, MessageReceivedHandlerParams, Plugin, PluginEvents } from '@elizaos/core';
import {
  type Action,
  type Content,
  EventType,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  asUUID,
  composePromptFromState,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { z } from 'zod';
import { StarterPluginTestSuite } from './tests';

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

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    // Always valid
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    try {
      logger.info('Handling HELLO_WORLD action');

      // Simple response content
      const responseContent: Content = {
        text: 'hello world!',
        actions: ['HELLO_WORLD'],
        source: message.content.source,
      };

      // Call back with the hello world message if callback is provided
      if (callback) {
        await callback(responseContent);
      }

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
    _state: State | undefined
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
  constructor(protected runtime: IAgentRuntime) {
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

export const starterPlugin: Plugin = {
  name: 'plugin-starter',
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
      { prompt, stopSequences = [] }: GenerateTextParams
    ) => {
      return 'Never gonna give you up, never gonna let you down, never gonna run around and desert you...';
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
      return 'Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you...';
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
    {
      name: 'current-time-route',
      path: '/api/time',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // Return current time in various formats
        const now = new Date();
        res.json({
          timestamp: now.toISOString(),
          unix: Math.floor(now.getTime() / 1000),
          formatted: now.toLocaleString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
    },
  ],
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.debug('MESSAGE_RECEIVED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.debug('VOICE_MESSAGE_RECEIVED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.debug('WORLD_CONNECTED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.debug('WORLD_JOINED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
  },
  services: [StarterService],
  actions: [helloWorldAction],
  providers: [helloWorldProvider],
  tests: [StarterPluginTestSuite],
  // dependencies: ['@elizaos/plugin-knowledge'], <--- plugin dependecies go here (if requires another plugin)
};


import { BinanceService } from './services/BinanceService.ts';
import { getNewsData } from './actions/ActionGetOffChainNewsData.ts';
import { getOnChainData } from './actions/ActionGetOnChainData.ts';
import { makeTrade } from './actions/ActionMakeTrade.ts';
import { processNewsData } from './actions/ActionProcessOffChainNewsData.ts';
import { processPriceData } from './actions/ActionProcessOnChainData.ts';
import { processRelect } from './actions/ActionProcessReflect.ts';
import { reply } from './actions/ActionReply.ts';
import { LLM_produce_actions, manageTemplate_Intro, manageTemplate_Example, manageTemplate_Rules, manageTemplate_state, manageTemplate_take_actions, manageTemplate_format, LLM_retry_times } from './const/Const.ts';
import { ApiService } from './services/ApiService.ts';
import { v4 } from 'uuid';

const managerMsgHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  let _state = await runtime.composeState(message);
  let service = runtime.getService(ApiService.serviceType) as ApiService;
  if(!LLM_produce_actions){
    do {
      const _responseContent = {
          thought: '',
          actions: ["GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "PROCESS_REFLECT", "MAKE_TRADE"],
          text: ''
      };
      const _responseMessage = {
            id: asUUID(v4()),
            entityId: runtime.agentId,
            agentId: runtime.agentId,
            content: _responseContent,
            roomId: message.roomId,
            createdAt: Date.now(),
      };
      if (_responseContent && _responseContent.text && (_responseContent.actions?.length === 0 || 
        _responseContent.actions?.length === 1 && _responseContent.actions[0].toUpperCase() === "REPLY")) {
        logger.warn('[Manager Handler] callback');
        await callback(_responseContent);
      } else {
        logger.warn('[Manager Handler] processActions');
        await runtime.processActions(message, [_responseMessage], _state, callback);
      }
      service.today_idx += 1;
    } while (service.today_idx <= service.end_day_idx && !service.abortAllTasks);
    logger.warn(`[Manager Handler] END at [${service.today_idx}] , [${service.end_day_idx}]`);
    return;
  }
  
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
  var prompt = '';
  // Message from CryptoTrade Actions, take next actions
  if(message && message.content && message.content.text.startsWith('CryptoTrade_Action')){
    prompt = composePromptFromState({
        state,
        template: manageTemplate_Intro + manageTemplate_Example + 
        manageTemplate_Rules + manageTemplate_state + apiService.getState() + 
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
        manageTemplate_Rules + manageTemplate_state + apiService.getState() + 
        '\n\n' + userMsgTmp + manageTemplate_format
    });
  }
  
  const parsedJson = await apiService.tryToCallLLMs4Json(prompt, runtime);
  // const parsedJson = JSON.parse('response');
  if(!parsedJson){
    let responseContent = {
      thought: 'LLM error',
      actions: ['IGNORE'],
      text: 'Can not parse data from LLM after retry [' + LLM_retry_times + '] times',
    };
    await callback(responseContent);
    return;
  }

  let responseContent: Content | null = null;
  let responseMessages: Memory[] = [];
  
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
      logger.warn(`[CryptoTrader] Message from: [${payload.source}]`);
      if(LLM_produce_actions && payload.source && payload.source.startsWith('CryptoTrade_Action')){
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

export const cryptoPlugin: Plugin = {
  name: 'plugin-exam',
  description: 'Plugin starter for elizaOS',
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** TESTING DEV MODE - PLUGIN MODIFIED AND RELOADED! ***');
  },
  models: {},
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
  services: [ApiService, BinanceService],
  actions: [
    helloWorldAction, 
    reply, 
    getNewsData, 
    getOnChainData, 
    processNewsData, 
    processPriceData, 
    processRelect, 
    makeTrade
  ],
  providers: [helloWorldProvider],
  events:events
};



export default cryptoPlugin;
