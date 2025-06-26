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
  createUniqueUuid,
  asUUID
} from '@elizaos/core';

import { getNewsData } from "./actions/ActionGetNewsData.ts";
import { getOnChainData } from "./actions/ActionGetOnChainData.ts";
import { processNewsData } from "./actions/ActionProcessNews.ts";
import { processPriceData } from "./actions/ActionProcessPrice.ts";
import { reply } from "./actions/ActionReply.ts" ;
import { ApiService } from './services/ApiService.ts';
import { ActionEventPayload, composePromptFromState, EventType, messageHandlerTemplate, 
  MessagePayload, MessageReceivedHandlerParams, PluginEvents } from '@elizaos/core';


import { v4 } from 'uuid';
import { makeTrade } from './actions/ActionMakeTrade.ts';
import { manageTemplate_Intro, manageTemplate_Example, manageTemplate_Rules, 
  manageTemplate_state, manageTemplate_take_actions, manageTemplate_format, 
  LLM_produce_actions,
  LLM_retry_times} from './const/Const.ts';

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
  let _state = await runtime.composeState(message);
  if(!LLM_produce_actions){
    const _responseContent = {
        thought: '',
        actions: ["GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "MAKE_TRADE", "REPLY"],
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
  
  const parsedJson = await apiService.tryToCallLLM(prompt, runtime);
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

export const starterPlugin: Plugin = {
  name: 'plugin-exam',
  description: 'Plugin starter for elizaOS',
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** TESTING DEV MODE - PLUGIN MODIFIED AND RELOADED! ***');
  },
  models: {
    
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
    getOnChainData, processNewsData, processPriceData, makeTrade],
  providers: [helloWorldProvider],
  events:events
};

export default starterPlugin;
