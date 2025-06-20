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
            const service = runtime.getService(ApiService.serviceType) as ApiService;
            // const resp = await service.postNewsAPI(data.blockchain, data.date);
            const resp = '{title:[Devs accuse colleagues from Bitcoin Core of being rogue over the plans to remove the spam filter from Bitcoin], context:[Bitcoin Core will remove OP_RETURN in the next version, scheduled for release in October. OP_RETURN is a script Bitcoin Core devs added to Bitcoin in 2014. It’s worth noting that Bitcoin Core developers have encouraged bitcoiners not to use the Bitcoin blockchain for recording arbitrary data, as there are better options that would not pile extra pressure on the Bitcoin network. At the end of the day, both currencies lost to the original Bitcoin. Will Bitcoin Core’s implementation turn Bitcoin into something different? Will learn by the end of the year.]}';
            service.data['NEWS'] = resp;
            if(callback){
                callback({
                    text:`
                    Here is the off-chain news: 
                    
                    ${resp}
                    `
                });
                        
                // await runtime.emitEvent(CRYPTO_EventType.CRYPTO_NOTIFY_ACTION_END, {
                //     runtime,
                //     entityId: runtime.agentId,
                //     status: 'CRYPTO_NOTIFY_ACTION_END',
                //     source: runtime.character.name,
                // });
                // state['stage']='NOTIFY_MANAGER';
                
                service.state['GET_NEWS'] = 'DONE';
                var message: Memory;
                message.content.text = 'CryptoTrade_Action_GET_NEWS DONE';
                message.id = asUUID(v4());
                runtime.emitEvent(EventType.MESSAGE_SENT, {runtime: runtime, message:message, source: 'CryptoTrade_Action_GET_NEWS'});
                logger.warn('***** ACTION GET_NEWS DONE *****')
                return true;
            }
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

