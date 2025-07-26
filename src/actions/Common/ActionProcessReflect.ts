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
export const processRelect: Action = {
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
    ): Promise<void> => {
        try {
            const apiService = runtime.getService(ApiService.serviceType) as ApiService;
            if(apiService.is_action_executing!['PROCESS_REFLECT']){
                logger.error('***** ACTION PROCESS_REFLECT IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            apiService.is_action_executing!['PROCESS_REFLECT'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_REFLECT START\n`);
            let tmp = await apiService.getPromptOfReflectHistory('BTC');
            const prompt = composePromptFromState({
                state,
                template:tmp
            });
            let resp = await apiService.tryToCallLLMsWithoutFormat(prompt);
            if(callback && apiService.CRYPT_CALLBACK_IN_ACTIONS){
                callback({
                    thought:``,
                    text:`Here is the reponse of Reflect Agent:\n\t\t${resp}`,
                });
            }
            apiService.saveReflectReport(resp);
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_REFLET DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_REFLET'});
            logger.warn('***** ACTION PROCESS_REFLET DONE *****');
            apiService.is_action_executing!['PROCESS_REFLECT'] = false;
            return;
        } catch (error) {
            logger.error("Error in reflect action:", error);
            if(callback){
                callback({
                    text:`
                    Error in reflect:
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

