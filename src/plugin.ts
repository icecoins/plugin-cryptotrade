import type { ActionEventPayload, MessagePayload, MessageReceivedHandlerParams, Plugin, PluginEvents } from '@elizaos/core';
import {
  type Content,
  EventType,
  type Memory,
  asUUID,
  composePromptFromState,
  createUniqueUuid,
  logger,
} from '@elizaos/core';

import { BinanceService } from './services/BinanceService.ts';
import { getNewsData } from './actions/Common/ActionGetOffChainNewsData.ts';
import { getOnChainData } from './actions/Common/ActionGetOnChainData.ts';
import { makeTrade } from './actions/Common/ActionMakeTrade.ts';
import { processNewsData } from './actions/Common/ActionProcessOffChainNewsData.ts';
import { processPriceData } from './actions/Common/ActionProcessOnChainData.ts';
import { processRelect } from './actions/Common/ActionProcessReflect.ts';
import { getDailyPrice } from './actions/Binance/ActionBinanceGetDailyPrice.ts';
import { LLM_produce_actions, manageTemplate_Intro, manageTemplate_Example, manageTemplate_Rules, manageTemplate_state, manageTemplate_take_actions, manageTemplate_format, LLM_retry_times } from './const/Const.ts';
import { ApiService } from './services/ApiService.ts';
import { v4 } from 'uuid';
import { simplifyNewsData } from './actions/Common/ActionSummaryNewsData.ts';

const managerMsgHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  let _state = await runtime.composeState(message);
  let service = runtime.getService(ApiService.serviceType) as ApiService;
  let args:string[];
  if(message.content.text){
    args = message.content.text.split(',');
    if(!args || args.length < 3 || !(args[0] === 'crypto' || args[0] === 'cryptotrade')){
      // cryptotrade, trade, callBinanceAPI
      await callback({
                    text:`Invalid args.\nIf you are trying to use plugin-cryptotrade for ElizaOS, please format your input text as:\n\ncryptotrade,1,0\n\nWhich means use_cryptotrade?, for_trade?, test_call_binance_API?\n`,
                  });
      return;
    }
  }
  if(!LLM_produce_actions){
    do {
      let actions:string[] = [];
      if(args![1] === '1' || args![1] === 'true'){
        actions = ["GET_PRICE", "GET_NEWS", "PROCESS_PRICE"];
        if(service.CRYPT_ENABLE_NEWS_SIMPLIFICATION){
          actions.push('SUMMARIZE_NEWS');
        }
        actions = actions.concat(["PROCESS_NEWS", "PROCESS_REFLECT", "MAKE_TRADE"]);
      }else if(args![2] === '1' || args![2] === 'true'){
        actions = ["CALL_BINANCE_API"];
      }
      const _responseContent = {
          thought: '',
          actions: actions,
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
      service.appendRecord();
    } while (service.today_idx <= service.end_day_idx! && !service.abortAllTasks);
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
  if(message && message.content && message.content.text!.startsWith('CryptoTrade_Action')){
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
          callback: payload.callback!,
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
  name: 'plugin-cryptotrade',
  description: 'Plugin cryptotrade for elizaOS',
  config: {
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
    simplifyNewsData,
    getNewsData, 
    getOnChainData, 
    processNewsData, 
    processPriceData, 
    processRelect, 
    makeTrade,
    getDailyPrice
  ],
  providers: [],
  events:events
};

export default cryptoPlugin;
