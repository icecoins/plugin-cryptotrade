import {
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
import { ApiService } from "../../services/ApiService";
import { PrinceAnalyzeService } from "../../services/PrinceAnalyzeService";
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
    ): Promise<void> => {
        try {
            const apiService = runtime.getService(ApiService.serviceType) as ApiService;
            const priceService = runtime.getService(PrinceAnalyzeService.serviceType) as PrinceAnalyzeService;
            if(apiService.is_action_executing!['PROCESS_PRICE']){
                logger.error('***** ACTION PROCESS_PRICE IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            apiService.is_action_executing!['PROCESS_PRICE'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_PRICE START\n`);
            let tmp = priceService.getPromptOfOnChainData('BTC');
            const prompt = composePromptFromState({
                    state,
                    template:tmp
                });
            let resp = await apiService.tryToCallLLMsWithoutFormat(prompt);
            if(callback && apiService.CRYPT_CALLBACK_IN_ACTIONS){
                if(!resp || resp === ''){
                    callback({
                        text:`
                        LLM ERROR: NOT RESPOND
                        `
                    });
                    return;
                }
                callback({
                    thought:``,
                    text:`Here is the reponse of On-Chain Data Analysis Agent:\n\t\t${resp}`,
                });
            }
            apiService.saveOnChainReport(resp);
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_PRICE DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_PRICE'});
            logger.warn('***** ACTION PROCESS_PRICE DONE *****');
            apiService.is_action_executing!['PROCESS_PRICE'] = false;
            return;
        } catch (error) {
            logger.error("Error in price analyse:", error);
            if(callback){
                callback({
                    text:`
                    Error in price analyze:
                    
                    ${error}
                    `
                });
            }
            return;
        }
    },
    examples: [],
} as Action;

