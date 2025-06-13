import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
  MessageMemory,
} from '@elizaos/core';

import { ModelType } from "@elizaos/core/v2";
import { ApiService } from 'src/services/apiService';

const manageTemplate_Intro = `
# You are a professional cryptoCurrency trader. You are supposed to make a trade by executing actions in the following steps: 1.GET_PRICE and GET_NEWS; 2.PROCESS_PRICE and PROCESS_NEWS; 3.MAKE_TRADE; 4.REPLY.\n\n
# Task: Generate dialog with actions.
# Instructions: Write the next message for user.
"thought" should be a short description of what the agent is thinking about and planning.
"message" should be the next message for user which they will send to the conversation.
"actions" should be the next actions that agent will conduct, "actions" should include one or more actions. 
Possible response actions: GET_PRICE, GET_NEWS, PROCESS_PRICE, PROCESS_NEWS, MAKE_TRADE, REPLY, IGNORE\n\n
`;
const manageTemplate_Example = `
# Action Examples:
user: Please help me to make a decision of BTC trade, am I supposed to buy or sell?\nagent: I'll conduct a research of BTC now. (actions: GET_PRICE, GET_NEWS)\n\n
agent: I've got the price and news of BTC, analysing. (actions: PROCESS_PRICE, PROCESS_NEWS)\n\n
agent: Action PROCESS_PRICE done, but still waiting PROCESS_NEWS, I have to wait. (actions: IGNORE)\n\n
agent: Analysis done, the price of BTC seems to be going down, we should sell part of them, about 20%. (actions: MAKE_TRADE)\n\n
agent: Finally, reply the decision to user. The decision is: Sell 0.2/1.0 of your BTC. (actions: REPLY)
`;
const manageTemplate_Rules = `
# RULES:
RULE 1: User is asking the proposal to make a cryptoCurrency trade, you should begin to make a trade by executing actions in the following order above, and reply in the end; 
RULE 2: When your are executing ations, they must be executed strictly in the order of steps;
RULE 3: You should decide next actions with the state of the steps'execution provided below;
RULE 4: User is talking about other things, or you're waiting for an action to be done (eg: At step 1, GET_PRICE done, but waiting GET_NEWS), set "actions" as "IGNORE".\n\n
`;
const manageTemplate_state = `
The state of the steps'execution:
`;
const manageTemplate_format = `
Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "message": "<string>",
    "actions": {"<string>", "<string>", ...}
}
\`\`\`

Your response should include the valid JSON block and nothing else.
`;

    export const manage: Action = {
    name: "MANAGE",
    similes: [
    ],
    description: "Generate actions and response to user.",
    validate: async (runtime: IAgentRuntime, message: MessageMemory, state: State) => {
        return (state['stage'] && state['stage']=='NOTIFY_MANAGER');
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback,
        _responses: Memory[]
    ) => {
        try {
            logger.info('Handling manage action');
            // Only generate response using LLM if no suitable response was found
            state = await _runtime.composeState(message, [
                ...(message.content.providers ?? []),
                'RECENT_MESSAGES',
            ]);
            var apiService = _runtime.getService(ApiService.serviceType) as ApiService;
            const prompt = composePromptFromState({
                state,
                template: manageTemplate_Intro + manageTemplate_Example + 
                manageTemplate_Rules + manageTemplate_state + apiService.get_state() + 
                '\n\n' + manageTemplate_format,
            });

            const response = await _runtime.useModel(ModelType.OBJECT_LARGE, {
                prompt,
            });

            const responseContent = {
                thought: response.thought,
                text: (response.message as string) || '',
                actions: [(response.action as string) || 'REPLY'],
            };
            // Call back with the hello world message
            await callback(responseContent);
        } catch (error) {
            logger.error('Error in GETNEWS action:', error);
            throw error;
        }
    },
    examples: [
            [
                {
                    name: "{{user1}}",
                    content: {
                        text: "Trade begin.",
                    },
                },
                {
                    name: "{{agent}}",
                    content: {
                        text: "I'll conduct trade for you right away.",
                        action: ["GET_PRICE", "GET_NEWS"],
                    },
                },
                {
                    name: "{{agent}}",
                    content: {
                        text: "Data fetched, processing.",
                        action: ["PROCESS_PRICE", "PROCESS_NEWS"],
                    },
                },
                {
                    name: "{{agent}}",
                    content: {
                        text: "Result is [+0.5].",
                        action: ["REPLY"],
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
            ],
            [
                {
                    name: "{{user1}}",
                    content: {
                        text: "Hi, what do you think about CryptoCurrency?",
                    },
                },
                {
                    name: "{{agent}}",
                    content: {
                        text: "It's really wonderful and can be used in different area.",
                        action: "NONE",
                    },
                },
            ],
        
        ],
};
