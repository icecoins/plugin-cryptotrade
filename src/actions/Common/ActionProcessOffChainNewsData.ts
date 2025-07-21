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
export const processNewsData: Action = {
    name: "PROCESS_NEWS",
    similes: [
        "ANALYZE_NEWS"
    ],
    description: "Analyze news and make a cryptocurrency trade",
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
            if(service.is_action_executing!['PROCESS_NEWS']){
                logger.error('***** ACTION PROCESS_NEWS IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            service.is_action_executing!['PROCESS_NEWS'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_NEWS START\n`);
            let tmp = await service.getPromptOfProcessNewsData('BTC', service.price_data[service.today_idx].key)
            const prompt = composePromptFromState({
                    state,
                    template:tmp
                });
            let resp = await service.tryToCallLLMsWithoutFormat(prompt);
            // logger.error(`[CRYPTOTRADE] news analysis resp:\n${resp}\n\n`);
            if(callback && service.CRYPT_CALLBACK_IN_ACTIONS){
                callback({
                    thought:`Reading news on ${service.price_data[service.today_idx].key}...`,
                    text:`Here is the reponse of News Analysis Agent:\n\t\t${resp}`,
                });
            }
            service.step_data!['ANALYSIS_REPORT_NEWS'] = resp;
            service.step_state!['PROCESS_NEWS'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_NEWS DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_NEWS'});
            logger.warn('***** ACTION PROCESS_NEWS DONE *****')
            service.is_action_executing!['PROCESS_NEWS'] = false;
            return;
        } catch (error) {
            logger.error("Error in news analyse:", error);
            if(callback){
                callback({
                    text:`
                    Error in news analyze:
                    ${error}
                    `
                });
            }
            return;
        }
    },
    examples: [
    ] as ActionExample[][],
} as Action;

