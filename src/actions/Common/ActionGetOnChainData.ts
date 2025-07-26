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
import { PrinceAnalyzeService } from "../../services/PrinceAnalyzeService";

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
            const apiService = runtime.getService(ApiService.serviceType) as ApiService;
            if(apiService.is_action_executing!['GET_PRICE']){
               //  logger.error('***** ACTION GET_PRICE IS RUNNING, SKIP ACTION  ***** \n');
                return false;
            }
            apiService.is_action_executing!['GET_PRICE'] = true;
            // logger.error('***** ACTION GET_PRICE START ***** \n');
            await apiService.loadPriceData();
            if(apiService.CRYPT_ENABLE_TRANSACTION_DATA){
                await apiService.loadTransactionData();
            }
            logger.warn('***** GET_PRICE DATA END ***** \n');
            const resp = `Price and transaction data loaded.\nBTC open price on  ${apiService.getTodayString()} is  ${apiService.getTodayOpenPrice()}`;
            if(callback && apiService.CRYPT_CALLBACK_IN_ACTIONS){
                callback({
                    thought:``,
                    text:`Here is the on-chain price data: ${resp} `
                });
            }
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_GET_PRICE DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message: message, source: 'CryptoTrade_Action_GET_PRICE'});
            logger.warn('***** ACTION GET_PRICE DONE *****')
            apiService.step_state!['GET_PRICE'] = 'DONE';
            apiService.step_state!['Executing'] = true;
            apiService.is_action_executing!['GET_PRICE'] = false;
            return;
        } catch (error) {
            logger.error("Error in price check:", error);
            if(callback){
                callback({
                    text:`Error in price check: ${error} `
                });
                return;
            }
            return;
        }
    },
    examples: [],
} as Action;
