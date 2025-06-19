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
// import {CRYPTO_EventType} from '../index.ts'
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
            /**
            const prompt = composePromptFromState({
                    state,
                    template: 'You are a crypto trader, analyze the history records of your decision, and return a report: ' + 
                        step: [' + (service.data['STEP']-1) + '], record: {' + 
                        service.record[(service.data['STEP']-1)]['TRADE'] + '}';
                });
            }
            const resp = await runtime.useModel(ModelType.TEXT_LARGE, {
                prompt: prompt,
            });
             */
            const resp = 'Reflect: In last stage, I decided to sell part of BTC. Accuracy of my decision is 80%.';
            if(callback){
                callback({
                    text:`
                    Here is the reflect of records: 
                    
                    ${resp}
                    `
                });
            }
            service.data['REFLECT'] = resp;
            service.state['PROCESS_REFLET'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_REFLET DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_REFLET'});
            logger.warn('***** ACTION PROCESS_REFLET DONE *****')
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

