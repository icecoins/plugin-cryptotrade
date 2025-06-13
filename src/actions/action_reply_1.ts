import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
} from '@elizaos/core';

import { z } from "zod";
import { ModelType } from "@elizaos/core/v2";

export const getBlockchainPriceRequestSchema = z.object({
  blockchain: z
      .nativeEnum({BTC:"btc", SOL: "sol", ETH:"eth"})
      .describe("The blockchain to get statistics for"),
  date: z
      .string()
      .optional()
      .describe("The date to request (optional)"),
  // toTimestamp: z
  //     .number()
  //     .optional()
  //     .describe("End timestamp for the transfers (optional)"),
});

const replyTemplate = `# Task: Generate dialog for user.
# Instructions: Write the next message for user.
"thought" should be a short description of what the agent is thinking about and planning.
"message" should be the next message for user which they will send to the conversation.
"action" should be the next action that agent will conduct. 
RULE 1: User is asking the price of BTC, then the "action" will be GET_PRICE; 
RULE 2: User wants to know news of ETH, the "action" in reply should be "GET_NEWS"; 
RULE 3: User is talking about other things, set "action" as "NONE".

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "message": "<string>",
    "action": "<string>",
}
\`\`\`

Your response should include the valid JSON block and nothing else.`;

export const reply: Action = {
    name: "REPLY",
    similes: [
        "REPLY_TO_MESSAGE",
        "RESPNES",
        "RESPOND"
    ],
    description: "Generate first response to user.",
    validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
        // Always valid
        return true;
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
        logger.info('Handling reply action');
        // Only generate response using LLM if no suitable response was found
        state = await _runtime.composeState(message, [
            ...(message.content.providers ?? []),
            'RECENT_MESSAGES',
        ]);
        const prompt = composePromptFromState({
            state,
            template: replyTemplate,
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
                    text: "What's the price of Bitcoin yesterday?",
                },
            },
            {
                name: "{{agent}}",
                content: {
                    text: "I'll check the Bitcoin news for you right away.",
                    action: "GET_PRICE",
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
        ],,
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
