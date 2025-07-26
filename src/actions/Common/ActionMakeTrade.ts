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
// import {CRYPTO_EventType} from '../index.ts'
import {v4} from 'uuid';
import { ApiService } from "../../services/ApiService";
export const makeTrade: Action = {
    name: "MAKE_TRADE",
    similes: [
        "MAKE_DECISION"
    ],
    description: "Make a cryptocurrency trade",
    validate: async (_runtime: IAgentRuntime, _message: MessageMemory, _state: State) => {
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
            let tmp = await apiService.getPromptOfMakeTrade('BTC');
            const prompt = composePromptFromState({
                    state,
                    template:tmp
            });
            let resp = await apiService.tryToCallLLMsWithoutFormat(prompt, true, true);
            apiService.step_data!['TRADE_REASON'] = resp;
            if(apiService.step_data!['TRADE_ACTION_VALUE'] === -999){
                apiService.step_data!['TRADE_ACTION_VALUE'] = 0;
            }
            await apiService.executeTrade();
            await apiService.calculateROI();
            if(callback){
                // Always callback afer make trade decision.
                callback({
                    thought:
                    `${resp}`,
                    text:
                    `Here is the action of Trade Agent:\n\t\tAction: ${apiService.step_data!['TRADE_ACTION']} \n\t\tValue: ${apiService.step_data!['TRADE_ACTION_VALUE']}\n\t\t\nDaily Return: ${apiService.step_data!['TODAY_ROI'] * 100} %\n\t\t\nTotal Return: ${apiService.total_roi! * 100} %`,
                });
            }
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_MAKE_TRADE DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_MAKE_TRADE'});
            logger.warn('***** ACTION MAKE_TRADE DONE *****')
            apiService.saveTradeReport();
            apiService.step_state!['Executing'] = false;
            return;
        } catch (error) {
            logger.error("Error in MAKE_TRADE:", error);
            if(callback){
                callback({
                    text:`
                    Error in MAKE_TRADE:
                    ${error}
                    `
                });
                return;
            }
            return;
        }
    },
    examples: [
    ],
} as Action;

