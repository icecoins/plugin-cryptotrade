import {
    type ActionExample,
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

import { ApiService } from "../../services/ApiService";

import { z } from "zod";

export enum Blockchains {
    BTC = "btc",
    SOL = "sol",
    ETH = "eth",
}

import { v4 } from 'uuid';
import { bear_ending_date, bear_starting_date, bull_ending_date, bull_starting_date, ending_date, sideways_ending_date, sideways_starting_date, starting_date } from "../../const/Const";

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
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            if(service.is_action_executing['GET_PRICE']){
               //  logger.error('***** ACTION GET_PRICE IS RUNNING, SKIP ACTION  ***** \n');
                return false;
            }
            service.is_action_executing['GET_PRICE'] = true;
            // logger.error('***** ACTION GET_PRICE START ***** \n');
            const load_res1 = `service.loadPriceData: ` + await service.loadPriceData();
            const load_res2 = `service.loadTransactionData: ` + await service.loadTransactionData(true);
            logger.warn(`today_idx: ${service.today_idx}\nend_day_idx: ${service.end_day_idx}`);
            if(!service.today_idx || !service.end_day_idx){
                let star_date: string, 
                    end_date: string;
                if(service.CRYPT_STAGE){
                    switch(service.CRYPT_STAGE){
                        case 'bull':
                            star_date = bull_starting_date;
                            end_date = bull_ending_date;
                            break;
                        case 'bear':
                            star_date = bear_starting_date;
                            end_date = bear_ending_date;
                            break;
                        case 'sideways':
                            star_date = sideways_starting_date;
                            end_date = sideways_ending_date;
                            break;
                    }
                }else{
                    star_date = starting_date;
                    end_date = ending_date;
                }
                service.today_idx = service.price_data.findIndex(d => d.key === star_date);
                service.end_day_idx = service.price_data.findIndex(d => d.key === end_date);
            }
            if (!service.project_initialized){
                service.initProject();
            }
            service.step_data["DATE"] = service.price_data[service.today_idx].key;
            logger.warn(`today_idx: ${service.today_idx}\nend_day_idx: ${service.end_day_idx}`);
            logger.warn('***** GET_PRICE DATA END ***** \n');
            const resp = `Price and transaction data loaded.\nBTC open price on  ${service.price_data[service.today_idx].value['timeOpen']} is  ${service.price_data[service.today_idx].value['open']}`;
            if(callback && service.callbackInActions){
                callback({
                    thought:`${load_res1}\n${load_res2}`,
                    text:`Here is the on-chain price data: ${resp} `
                });
            }
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_GET_PRICE DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message: message, source: 'CryptoTrade_Action_GET_PRICE'});
            logger.warn('***** ACTION GET_PRICE DONE *****')
            service.step_state['GET_PRICE'] = 'DONE';
            service.step_state['Executing'] = true;
            service.is_action_executing['GET_PRICE'] = false;
            return true;
        } catch (error) {
            logger.error("Error in price check:", error);
            if(callback){
                callback({
                    text:`Error in price check: ${error.message} `
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
