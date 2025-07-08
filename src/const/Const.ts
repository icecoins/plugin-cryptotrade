export const LLM_produce_actions = false;

export const starting_date='2023-10-01';
export const ending_date='2023-12-01';

export const bear_starting_date='2023-04-12';
export const bear_ending_date='2023-06-16';

export const sideways_starting_date='2023-06-17';
export const sideways_ending_date='2023-08-28';

export const bull_starting_date='2023-10-01';
export const bull_ending_date='2023-12-01';

export const LLM_retry_times = 10;

export const manageTemplate_Intro = `
  # You are a professional cryptoCurrency trader. If you received message from user, you should start you actions immediately. You are supposed to make a trade by executing actions in the following steps: 1."GET_PRICE" and "GET_NEWS" (these two actions should be take together, not single); 2."PROCESS_PRICE" and "PROCESS_NEW " (these two actions should be take together, not single); 3."MAKE_TRADE"; 4."REPLY".\n\n
  # Task: Generate dialog with actions.
  # Instructions: Write the next message for user.
  "thought" should be a short description of what the agent is thinking about and planning.
  "message" should be the next message for user which they will send to the conversation.
  "actions" should be the next actions that agent will conduct, "actions" should include one or more actions. 
  # Possible response actions: "GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "MAKE_TRADE", "REPLY", "IGNORE"\n\n
  `;
export const manageTemplate_Example = `
  # Action Examples:
  user: Please help me to make a decision of BTC trade, am I supposed to buy or sell?\nagent: I'll conduct a research of BTC now. (actions: "GET_PRICE", "GET_NEWS")\n\n
  agent: I've got the price and news of BTC, analysing. (actions: "PROCESS_PRICE", "PROCESS_NEWS")\n\n
  agent: Analysis done, the price of BTC seems to be going down, we should sell part of them, about 20%. (actions: "MAKE_TRADE")\n\n
  agent: Finally, reply the decision to user. The decision is: -0.2/1.0 of your BTC. (actions: "REPLY")
  `;
export const manageTemplate_Rules = `
  # RULES:
  RULE 1: User is asking the proposal to make a cryptoCurrency trade, you should begin to make a trade by executing actions in the following order above, and reply in the end;\n
  RULE 2: When your are executing ations, they must be executed strictly in the order of steps;\n
  RULE 3: You should decide next actions with the state of the steps'execution provided below, after actions in step before has been "DONE", execute actions in the next step;\n
  RULE 4: User is talking about other things, or your are executing actions (eg: In step 2, "PROCESS_PRICE" done, but still waiting "PROCESS_NEWS"), set "actions" as "IGNORE".\n
  RULE 5: The response must contain "thought", "message", and "actions".\n\n
  `;
export const manageTemplate_state = `
  The state of the steps'execution:
  `;
export const manageTemplate_format = `
  # Response format
  # Response format should be formatted in a valid JSON block like this:

  {
      "thought": "<string>",
      "message": "<string>",
      "actions": ["<string>", "<string>", "<string>"]
  }

  # Your response should include the valid JSON block and nothing else.
  # Response format end
  `;
export const manageTemplate_take_actions = `
  # Choose your next actions within the [Possible response action] and the [RULES] mentioned before.
  # Your response should be formatted in a valid JSON block like this:

  {
      "thought": "<string>",
      "message": "<string>",
      "actions": ["<string>", "<string>", "<string>"]
  }
  # Now, choose your next actions:
  `;

export const delim = '\n"""\n';
export const STARTING_NET_WORTH: number = 1_000_000;
export const STARTING_CASH_RATIO = 0.5;
export const GAS_LIMITS = 21000;
export const GAS_PRICE = 70;
export const GAS_FEE = GAS_LIMITS * GAS_PRICE * 1e-9;
export const EX_RATE = 4e-3  //  exchange fee = txn_amount * ex_rate