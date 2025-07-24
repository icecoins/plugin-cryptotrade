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
import { LocalNewsAnalyseService } from "../../services/LocalNewsAnalyseService";
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
            let apiService = runtime.getService(ApiService.serviceType) as ApiService;
            let newsService = runtime.getService(LocalNewsAnalyseService.serviceType) as LocalNewsAnalyseService;
            if(apiService.is_action_executing!['SIMPLIFY_NEWS']){
                logger.error('***** ACTION SIMPLIFY_NEWS IS RUNNING, SKIP ACTION  ***** \n');
                return;
            }
            apiService.is_action_executing!['SIMPLIFY_NEWS'] = true;
            logger.error(`[CRYPTOTRADE] SIMPLIFY_NEWS START\n`);
            let resp = await newsService.simplifyNewsData();
            // logger.error(`[CRYPTOTRADE] news analysis resp:\n${resp}\n\n`);
            if(callback && apiService.CRYPT_CALLBACK_IN_ACTIONS){
                callback({
                    thought:``,
                    text:`Here is the reponse of Raw News Simplify Agent:\n\t\t${resp}`,
                });
            }
            apiService.step_state!['SIMPLIFY_NEWS'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_SIMPLIFY_NEWS DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_NEWS'});
            logger.warn('***** ACTION SIMPLIFY_NEWS DONE *****')
            apiService.is_action_executing!['SIMPLIFY_NEWS'] = false;
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

