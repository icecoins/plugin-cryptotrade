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
import { ApiService } from "../services/ApiService";
export const getNewsData: Action = {
    name: "GET_NEWS",
    similes: [
        "CHECK_NEWS",
        "FETCH_NEWS",
        "GET_CRYPTO_NEWS",
        "CRYPTO_NEWS",
        "CHECK_CRYPTO_NEWS"
    ],
    description: "Get news for a cryptocurrency",
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
            
            if(service.is_action_executing['GET_NEWS']){
                // logger.error('***** ACTION GET_NEWS IS RUNNING, SKIP ACTION  ***** \n');
                return false;
            }
            service.is_action_executing['GET_NEWS'] = true;
            logger.warn('***** GET NEWS DATA START ***** \n');
            const resp = `service.loadNewsData: ` + await service.loadNewsData();
            logger.warn('***** GET NEWS DATA END ***** \n', resp);
            if(callback){
                if(!resp){
                    callback({
                        text:`Error in fetch news DATA. `
                    });
                    return false;
                }
                callback({
                    thought: resp,
                    text: `News data loaded. `
                });
            }            
            service.step_state['GET_NEWS'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_GET_NEWS DONE';
            message.id = asUUID(v4());
            await runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_GET_NEWS'});
            logger.warn('***** ACTION GET_NEWS DONE *****')
            service.is_action_executing['GET_NEWS'] = false;
            return true;
        } catch (error) {
            elizaLogger.error("Error in news fetch:", error);
            if(callback){
                callback({
                    text:`
                    Error in news fetch:
                    
                    ${error.message}
                    `
                });
                return false;
            }
            return false;
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: {
                    text: "What's the news of Bitcoin yesterday?",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "I'll check the Bitcoin news for you right away.",
                    action: "GET_NEWS",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "The news of  BTC market price are: [{date:{date}, title:{tiles1}, context:{context1}},.....]",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: {
                    text: "Can you check news of ETH on 2025/04/03?",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "I'll fetch the news of Ethereum on 2025/04/03 for you.",
                    action: "GET_NEWS",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "The news of ETH price on 2025/04/03 are: [{date:{date}, title:{tiles1}, context:{context1}},.....]",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

