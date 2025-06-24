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
import {v4} from 'uuid';
import { ApiService } from "src/services/ApiService";
import { tryToCallLLMsWithoutFormat } from "src/const/Const";
export const processPriceData: Action = {
    name: "PROCESS_PRICE",
    similes: [
        "ANALYZE_PRICE"
    ],
    description: "Analyze price and make a cryptocurrency trade",
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
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            let prompt = await service.getPromptOfOnChainData('BTC', service.price_data[10].key)
            // const prompt = composePromptFromState({
            //         state,
            //         template:tmp
            //     });
            let resp = await tryToCallLLMsWithoutFormat(prompt, runtime);
            // let resp = await runtime.useModel(ModelType.TEXT_LARGE, {
            //     prompt: prompt,
            // });
            // const resp = 'Analysis done, it seems that the price will go down.';
            if(callback){
                callback({
                    text:`
                    Here is the analysis of on-chain data: 
                    
                    ${resp}
                    `
                });
            }
            service.data['ANALYSIS_PRICE'] = resp;
            service.state['PROCESS_PRICE'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_PRICE DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_PRICE'});
            logger.warn('***** ACTION PROCESS_PRICE DONE *****')
            return true;
        } catch (error) {
            elizaLogger.error("Error in price analyse:", error);
            if(callback){
                callback({
                    text:`
                    Error in price analyze:
                    
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

