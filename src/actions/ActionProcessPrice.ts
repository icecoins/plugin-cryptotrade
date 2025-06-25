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
    composePromptFromState,
} from "@elizaos/core";
import {v4} from 'uuid';
import { ApiService } from "src/services/ApiService";
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
            logger.error(`[CRYPTOTRADE] PROCESS_PRICE START\n`);
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            let tmp = await service.getPromptOfOnChainData('BTC', service.price_data[10].key)
            const prompt = composePromptFromState({
                    state,
                    template:tmp
                });
            let resp = await service.tryToCallLLMsWithoutFormatWithoutRuntime(prompt);
            logger.error(`[CRYPTOTRADE] resp:\n${resp}\n\n`);
            let resp2 = await service.tryToCallLLMsWithoutFormat(prompt, runtime);
            logger.error(`[CRYPTOTRADE] resp2:\n${resp2}\n\n`);
            // let resp = await runtime.useModel(ModelType.TEXT_LARGE, {
            //     prompt: prompt,
            // });
            // const resp = 'Analysis done, it seems that the price will go down.';
            if(callback){
                if(!resp || resp === ''){
                    callback({
                        text:`
                        LLM ERROR: NOT RESPOND
                        `
                    });
                    return;
                }
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
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_PRICE'});
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

