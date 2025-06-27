import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';

import { z } from "zod";
import { ApiService } from 'src/services/ApiService';

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
      const service = _runtime.getService(ApiService.serviceType) as ApiService;
      const responseContent = {
          thought: '',
          // text: 'The final decision of trade in step[' + (service.data['STEP']-1) + '] is: ' + service.record[(service.data['STEP']-1)]['TRADE'] + '\n',
          text: 'The final decision of trade is ...\n',
          actions: ['REPLY'],
      };
      if(callback){
        await callback(responseContent);
      }
    } catch (error) {
      logger.error('Error in REPLY action:', error);
      throw error;
    }
  },
  examples: [],
};
