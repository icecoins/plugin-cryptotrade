import {
    type ActionExample,
    elizaLogger,
    type IAgentRuntime,
    type Memory,
    type State,
    type Action,
    HandlerCallback,
    MessageMemory,
    EventType,
    logger,
    asUUID,
} from "@elizaos/core";

import { ApiService } from "src/services/ApiService";

import { z } from "zod";

export enum Blockchains {
    BTC = "btc",
    SOL = "sol",
    ETH = "eth",
}

import { v4 } from 'uuid';

export const getBlockchainPriceRequestSchema = z.object({
  blockchain: z
      .nativeEnum(Blockchains)
      .describe("The blockchain to get statistics for"),
  date: z
      .string()
      .optional()
      .describe("The date to request (optional)"),
  // toTimestamp: z
  //     .number()
  //     .optional()
  //     .describe("End timestamp for the transfers (optional)"),
});

/**
 * Validates the blockchain stats request
 */

export const getOnChainData: Action = {
    name: "GET_PRICE",
    similes: [
        "GET_PRICE",
        "CHECK_PRICE",
        "PRICE_CHECK",
        "GET_CRYPTO_PRICE",
        "CRYPTO_PRICE",
        "CHECK_CRYPTO_PRICE",
        "PRICE_LOOKUP",
    ],
    description: "Get current price information for a cryptocurrency pair",
    validate: async (runtime: IAgentRuntime, message: MessageMemory, state: State) => {
        // return (state['stage'] && state['stage']=='GET_DATA');
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state:State,
        _options:{[key:string]:unknown},
        callback: HandlerCallback,
        _responses: Memory[]
    ): Promise<unknown> => {
        try {
            logger.error('***** ACTION GET_PRICE START ***** \n');
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            /*
            const resp = await service.postOnChianAPI(data.blockchain, data.date);
            */
            // let r1 = await service.loadPriceData(true);
            // let r2 = await service.loadTransactionData(true);
            // logger.warn('***** ACTION GET_PRICE DATA ***** \n[' + r1 + ']\n');
            // logger.warn('***** ACTION GET_PRICE DATA *****\n[' + r2 + ']\n');
            await service.loadPriceData(true);
            await service.loadTransactionData(true);
            logger.warn('***** GET_PRICE DATA END ***** \n');
            // const resp = 'BTC price: {today:{24h Low/High $107,493.00 / $110,269.00}, yesterday:{24h Low/High $108,640.00 / $110,236.00}, }';
            const resp = `BTC open price on ${service.price_data[10].value['timeOpen']} is ${service.price_data[10].value['open']}`
            service.data['PRICE'] = resp;
            if(callback){
                callback({
                    text:`
                    Here is the on-chain price data:
                    ${resp}
                    `
                });
            }
            service.state['GET_PRICE'] = 'DONE';
            service.state['Executing'] = true;
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_GET_PRICE DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message: message, source: 'CryptoTrade_Action_GET_PRICE'});
            logger.warn('***** ACTION GET_PRICE DONE *****')
            return true;
        } catch (error) {
            elizaLogger.error("Error in price check:", error);
            if(callback){
                callback({
                    text:`
                    Error in price check:
                    
                    ${error.message}
                    `
                });
                return false;
            }
            return false;
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: {
                    text: "What's the market price of Bitcoin yesterday?",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "I'll check the Bitcoin market price for you right away.",
                    action: "GET_PRICE",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "The current BTC market price is {date}, open: {open price} USDT, close: {close price}} USDT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you check ETH price on 2025/04/03?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll fetch the Ethereum price on 2025/04/03 for you.",
                    action: "GET_PRICE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The ETH price on 2025/04/03 is {date}, open: {open price} USDT, close: {close price}} USDT",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
