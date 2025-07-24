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
            const service = runtime.getService(ApiService.serviceType) as ApiService;
            if(service.is_action_executing!['PROCESS_REFLECT']){
                logger.error('***** ACTION PROCESS_REFLECT IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            service.is_action_executing!['PROCESS_REFLECT'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_REFLECT START\n`);
            let tmp = await service.getPromptOfReflectHistory('BTC');
            const prompt = composePromptFromState({
                state,
                template:tmp
            });
            let resp = await service.tryToCallLLMsWithoutFormat(prompt);
            if(callback && service.CRYPT_CALLBACK_IN_ACTIONS){
                callback({
                    thought:``,
                    text:`Here is the reponse of Reflect Agent:\n\t\t${resp}`,
                });
            }
            service.step_data!['ANALYSIS_REPORT_REFLECT'] = resp;
            service.step_state!['PROCESS_REFLET'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_REFLET DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_REFLET'});
            logger.warn('***** ACTION PROCESS_REFLET DONE *****');
            service.is_action_executing!['PROCESS_REFLECT'] = false;
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

