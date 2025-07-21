import {
    type ActionExample,
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
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            if(service.is_action_executing!['PROCESS_PRICE']){
                logger.error('***** ACTION PROCESS_PRICE IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            service.is_action_executing!['PROCESS_PRICE'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_PRICE START\n`);
            let tmp = service.getPromptOfOnChainData('BTC');
            const prompt = composePromptFromState({
                    state,
                    template:tmp
                });
            let resp = await service.tryToCallLLMsWithoutFormat(prompt);
            if(callback && service.CRYPT_CALLBACK_IN_ACTIONS){
                if(!resp || resp === ''){
                    callback({
                        text:`
                        LLM ERROR: NOT RESPOND
                        `
                    });
                    return;
                }
                callback({
                    thought:`Reading On-Chain data on ${service.price_data[service.today_idx].key}...`,
                    text:`Here is the reponse of On-Chain Data Analysis Agent:\n\t\t${resp}`,
                });
            }
            service.step_data!['ANALYSIS_REPORT_ON_CHAIN'] = resp;
            service.step_state!['PROCESS_PRICE'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_PRICE DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_PRICE'});
            logger.warn('***** ACTION PROCESS_PRICE DONE *****');
            service.is_action_executing!['PROCESS_PRICE'] = false;
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

