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
import { ApiService } from "src/services/apiService";
export const processNewsData: Action = {
    name: "PROCESS_REFLECT",
    similes: [
        "ANALYZE_REFLECT"
    ],
    description: "Analyze records and reflect to make a cryptocurrency trade",
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
            const resp = 'Reflect: In last stage, I decided to sell part of BTC. Accuracy of my decision is 80%.';
            service.data['REFLECT'] = resp;
            if(callback){
                callback({
                    text:`
                    Here is the reflect of records: 
                    
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
                
                service.state['PROCESS_REFLET'] = 'DONE';
                var message: Memory;
                message.content.text = 'CryptoTrade_Action_PROCESS_REFLET DONE';
                message.id = asUUID(v4());
                runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_REFLET'});
                logger.warn('***** ACTION PROCESS_REFLET DONE *****')
                return true;
            }
        } catch (error) {
            elizaLogger.error("Error in reflect action:", error);
            if(callback){
                callback({
                    text:`
                    Error in reflect:
                    
                    ${error.message}
                    `
                });
                return false;
            }
            return false;
        }
    },
    examples: [
    ] as ActionExample[][],
} as Action;

