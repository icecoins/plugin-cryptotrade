import {
    type ActionExample,
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
// import {CRYPTO_EventType} from '../index.ts'
import {v4} from 'uuid';
import { ApiService } from "src/services/ApiService";
export const makeTrade: Action = {
    name: "MAKE_TRADE",
    similes: [
        "MAKE_DECISION"
    ],
    description: "Make a cryptocurrency trade",
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
    ): Promise<boolean> => {
        try {
            // var result = getBlockchainPriceRequestSchema.safeParse(message.content);
            // if (!result.success) {
            //     throw new ValidationError(result.error.message);
            // }
            // var data = getBlockchainPriceRequestSchema.parse(message.content);
            // // Ensure the content has the required shape
            // const content = {
            //     symbol: data.blockchain.toString().toUpperCase().trim(),
            // };
            // if (content.symbol.length < 2 || content.symbol.length > 10) {
            //     throw new Error("Invalid cryptocurrency symbol");
            // }
            const service = runtime.getService(ApiService.serviceType) as ApiService;
            // const resp = await service.postNewsAPI(data.blockchain, data.date);
            const resp = 'After check and analyze the price and news of the cryptocurrency, I think we should sell 30% of it. My trade decision is -0.3/1.0';
            if(callback){
                callback({
                    text:`
                    Here is the analysis of on-chain data: 
                    
                    ${resp}
                    `
                });
                        
                // await runtime.emitEvent(CRYPTO_EventType.CRYPTO_NOTIFY_ACTION_END, {
                //     runtime,
                //     entityId: runtime.agentId,
                //     status: 'CRYPTO_NOTIFY_ACTION_END',
                //     source: runtime.character.name,
                // });
                // state['stage']='NOTIFY_MANAGER';
                
                service.state['MAKE_TRADE'] = 'DONE';
                service.data['TRADE'] = resp;
                var message: Memory;
                message.content.text = 'CryptoTrade_Action_MAKE_TRADE DONE';
                message.id = asUUID(v4());
                runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_MAKE_TRADE'});
                logger.warn('***** ACTION MAKE_TRADE DONE *****')
                return true;
            }
        } catch (error) {
            elizaLogger.error("Error in MAKE_TRADE:", error);
            if(callback){
                callback({
                    text:`
                    Error in news analyze:
                    
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

