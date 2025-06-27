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
    ): Promise<boolean> => {
        try {
            const service = runtime.getService(ApiService.serviceType) as ApiService;
            if(service.is_action_executing['PROCESS_REFLECT']){
                logger.error('***** ACTION PROCESS_REFLECT IS RUNNING, SKIP ACTION  ***** \n');
                return false;
            }
            service.is_action_executing['PROCESS_REFLECT'] = true;
            logger.error(`[CRYPTOTRADE] PROCESS_REFLECT START\n`);
            let tmp = await service.getPromptOfReflectHistory('BTC');
            const prompt = composePromptFromState({
                state,
                template:tmp
            });
            let resp = await service.tryToCallLLMsWithoutFormat(prompt);
            // const resp = 'Reflect: In last stage, I decided to sell part of BTC. Accuracy of my decision is 80%.';
            if(callback){
                callback({
                    thought:`Reading actions and results on ${service.price_data[service.today_idx].key}...`,
                    text:`Here is the reponse of Reflect Agent:\n\t\t${resp}`,
                });
            }
            service.step_data['ANALYSIS_REPORT_REFLECT'] = resp;
            service.step_state['PROCESS_REFLET'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_REFLET DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_REFLET'});
            logger.warn('***** ACTION PROCESS_REFLET DONE *****');
            service.is_action_executing['PROCESS_REFLECT'] = false;
            return true;
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

