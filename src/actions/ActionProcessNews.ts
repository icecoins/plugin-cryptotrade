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
import {v4} from 'uuid';
import { ApiService } from "src/services/ApiService";
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
    ): Promise<boolean> => {
        try {
            // var result = getBlockchainPriceRequestSchema.safeParse(message.content);
            // if (!result.success) {
            //     throw new ValidationError(result.error.message);
            // }
            // var data = getBlockchainPriceRequestSchema.parse(message.content);
            // // Ensure the content has the required shape
            // const content = {
            //     symbol: data.blockchain.toString().toUpperCase().trim(),
            // };
            // if (content.symbol.length < 2 || content.symbol.length > 10) {
            //     throw new Error("Invalid cryptocurrency symbol");
            // }
            let service = runtime.getService(ApiService.serviceType) as ApiService;
            // const resp = await service.postNewsAPI(data.blockchain, data.date);
            // const resp = 'Analysis done, the news shows that the price of the cryptocurrency will go down.';
            const resp = service.tryToCallLLMsWithoutFormatWithoutRuntime('');
            if(callback){
                callback({
                    text:`
                    Here is the analysis of off-chain news: 
                    
                    ${resp}
                    `
                });
            }
            service.data['ANALYSIS_NEWS'] = resp;
            service.state['PROCESS_NEWS'] = 'DONE';
            var message: Memory;
            message.content.text = 'CryptoTrade_Action_PROCESS_NEWS DONE';
            message.id = asUUID(v4());
            runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_PROCESS_NEWS'});
            logger.warn('***** ACTION PROCESS_NEWS DONE *****')
            return true;
        } catch (error) {
            elizaLogger.error("Error in news analyse:", error);
            if(callback){
                callback({
                    text:`
                    Error in news analyze:
                    
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

