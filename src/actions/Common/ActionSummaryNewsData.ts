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
} from "@elizaos/core";
import {v4} from 'uuid';
import { ApiService } from "../../services/ApiService";
export const simplifyNewsData: Action = {
    name: "SUMMARIZE_NEWS",
    similes: [
        "SIMPLIFY_NEWS"
    ],
    description: "Simplify/Summarize news context for analysis.",
    validate: async (runtime: IAgentRuntime, message: MessageMemory, state: State) => {
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
            if(service.is_action_executing!['SIMPLIFY_NEWS']){
                logger.error('***** ACTION SIMPLIFY_NEWS IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            service.is_action_executing!['SIMPLIFY_NEWS'] = true;
            logger.error(`[CRYPTOTRADE] SIMPLIFY_NEWS START\n`);
            let resp = await service.simplifyNewsData();
            // logger.error(`[CRYPTOTRADE] news analysis resp:\n${resp}\n\n`);
            if(callback && service.callbackInActions){
                callback({
                    thought:`Reading raw news on ${service.price_data[service.today_idx].key}...`,
                    text:`Here is the reponse of Raw News Simplify Agent:\n\t\t${resp}`,
                });
            }
            service.step_state!['SIMPLIFY_NEWS'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_SIMPLIFY_NEWS DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_NEWS'});
            logger.warn('***** ACTION SIMPLIFY_NEWS DONE *****')
            service.is_action_executing!['SIMPLIFY_NEWS'] = false;
            return;
        } catch (error) {
            logger.error("Error in news analyse:", error);
            if(callback){
                callback({
                    text:`
                    Error in news simplify:
                    ${error}
                    `
                });
                return;
            }
            return;
        }
    },
    examples: [
    ] as ActionExample[][],
} as Action;

