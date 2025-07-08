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
    ): Promise<boolean> => {
        try {
            const service = runtime.getService(ApiService.serviceType) as ApiService;
            let tmp = await service.getPromptOfMakeTrade('BTC');
            const prompt = composePromptFromState({
                    state,
                    template:tmp
            });
            let resp = await service.tryToCallLLMsWithoutFormat(prompt, true, true);
            service.step_data['TRADE_REASON'] = resp;
            if(service.step_data['TRADE_ACTION_VALUE'] === -999){
                service.step_data['TRADE_ACTION_VALUE'] = 0;
            }
            await service.executeTrade();
            await service.calculateROI();
            if(callback){
                // Always callback afer make trade decision.
                callback({
                    thought:
                    `${resp}`,
                    text:
                    `Here is the action of Trade Agent:\n\t\tAction: ${service.step_data['TRADE_ACTION']} \n\t\tValue: ${service.step_data['TRADE_ACTION_VALUE']}\n\t\t\nDaily Return: ${service.step_data['TODAY_ROI'] * 100} %\n\t\t\nTotal Return: ${service.total_roi * 100} %`,
                });
            }
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_MAKE_TRADE DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_MAKE_TRADE'});
            logger.warn('***** ACTION MAKE_TRADE DONE *****')
            service.step_state['MAKE_TRADE'] = 'DONE';
            service.step_state['Executing'] = false;
            service.stepEnd();
            return true;
        } catch (error) {
            logger.error("Error in MAKE_TRADE:", error);
            if(callback){
                callback({
                    text:`
                    Error in MAKE_TRADE:
                    ${error.message}
                    `
                });
                return false;
            }
            return false;
        }
    },
    examples: [
    ],
} as Action;

