import {
    elizaLogger,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State, 
    type Action,
    MessageMemory,
    EventType,
    logger,
    asUUID,
} from "@elizaos/core";
import {v4} from 'uuid';
import { BinanceService } from "../services/BinanceService";
export const getDailyPrice: Action = {
    name: "CALL_BINANCE_API",
    similes: [
        "CALL_BINANCE"
    ],
    description: "Try to call binance api for price data.",
    validate: async (_runtime: IAgentRuntime, _message: MessageMemory, _state: State) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state:State,
        _options:{[key:string]:unknown},
        callback: HandlerCallback,
        _responses: Memory[]
    ): Promise<boolean> => {
        try {
            const binanceService = runtime.getService(BinanceService.serviceType) as BinanceService;
            const data = await binanceService.getDailyPrice('BTCUSDT');
            if(callback){
                callback({
                    text: `Here is the data from Binance API:\n ${JSON.stringify(data)}`,
                });
            }
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_CALL_BINANCE_API DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_CALL_BINANCE_API'});
            logger.warn('***** ACTION CALL_BINANCE_API DONE *****')
            return true;
        } catch (error) {
            elizaLogger.error("Error in CALL_BINANCE_API:", error);
            if(callback){
                callback({
                    text:`
                    Error in CALL_BINANCE_API:
                    ${error.message}
                    `
                });
                return false;
            }
            return false;
        }
    },
    examples: [
    ],
} as Action;

