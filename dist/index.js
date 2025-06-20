// src/index.ts
import {
  ModelType,
  Service as Service2,
  logger as logger8,
  createUniqueUuid,
  asUUID as asUUID6
} from "@elizaos/core";
import { z as z3 } from "zod";

// src/actions/ActionGetNewsData.ts
import {
  elizaLogger,
  EventType,
  logger as logger2,
  asUUID
} from "@elizaos/core";

// node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm/rng.js
import { randomFillSync } from "crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm/native.js
import { randomUUID } from "crypto";
var native_default = { randomUUID };

// node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/services/ApiService.ts
import {
  logger,
  Service
} from "@elizaos/core";
var data = JSON.stringify({
  username: "jane-doe",
  email: "jane.doe@your-domain.com",
  role: "superuser",
  age: 23,
  birthplace: "New York"
});
async function postData(path, data2) {
  var options = {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: data2
  };
  await fetch("http://127.0.0.1:8642/" + path, options).then((response) => {
    return response.json();
  }).then((_data) => {
    console.log(_data);
    return _data;
  }).catch((error) => {
    console.error("Error:", error);
  });
}
var ApiService = class _ApiService extends Service {
  static serviceType = "apiservice";
  capabilityDescription = "This is a api service which is attached to the agent through the cryptotrade plugin.";
  constructor(runtime) {
    super(runtime);
  }
  static async start(runtime) {
    logger.info(`*** Starting api service - MODIFIED: ${(/* @__PURE__ */ new Date()).toISOString()} ***`);
    const service = new _ApiService(runtime);
    service.initState();
    service.initData();
    return service;
  }
  static async stop(runtime) {
    logger.info("*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***");
    const service = runtime.getService(_ApiService.serviceType);
    if (!service) {
      throw new Error("API service not found");
    }
    service.stop();
  }
  async stop() {
    logger.info("*** THIRD CHANGE - TESTING FILE WATCHING! ***");
  }
  async postOnChianAPI(_chain, _date) {
    try {
      const response = await postData("getOnChainData", { chain: _chain, date: _date });
      return response.data;
    } catch (error) {
      console.error("CryptoTrade Server Error: ", error.message);
      throw error;
    }
  }
  async postNewsAPI(_chain, _date) {
    try {
      const response = await postData("getNewsData", { chain: _chain, date: _date });
      return response.data;
    } catch (error) {
      console.error("CryptoTrade Server Error: ", error.message);
      throw error;
    }
  }
  state = { Executing: false, GET_PRICE: "UNDONE" };
  data = { STEP: 0, STAGE: 0 };
  record = {};
  initState() {
    this.state["Executing"] = false;
    this.state["GET_PRICE"] = "UNDONE";
    this.state["GET_NEWS"] = "UNDONE";
    this.state["PROCESS_PRICE"] = "UNDONE";
    this.state["PROCESS_NEWS"] = "UNDONE";
    this.state["PROCESS_REFLET"] = "UNDONE";
    this.state["MAKE_TRADE"] = "UNDONE";
  }
  initData() {
    this.data["STEP"] = this.data["STEP"] + 1;
    this.data["STAGE"] = 0;
    this.data["PRICE"] = "";
    this.data["NEWS"] = "";
    this.data["ANALYSIS_PRICE"] = "";
    this.data["ANALYSIS_NEWS"] = "";
    this.data["REFLECT"] = "";
    this.data["TRADE"] = "";
  }
  stepEnd() {
    this.record[data["STEP"]] = { data: this.data, state: this.state };
    logger.error("STEP END, RECORD:\n", JSON.stringify(this.record[data["STEP"]]));
    this.initData();
    this.initState();
  }
  updateState(Executing, GET_PRICE, GET_NEWS, PROCESS_PRICE, PROCESS_NEWS, PROCESS_REFLET, MAKE_TRADE) {
    this.state["Executing"] = Executing;
    this.state["GET_PRICE"] = GET_PRICE;
    this.state["GET_NEWS"] = GET_NEWS;
    this.state["PROCESS_PRICE"] = PROCESS_PRICE;
    this.state["PROCESS_NEWS"] = PROCESS_NEWS;
    this.state["PROCESS_REFLET"] = PROCESS_REFLET;
    this.state["MAKE_TRADE"] = MAKE_TRADE;
  }
  getState() {
    return JSON.stringify({
      Executing: this.state["Executing"],
      GET_PRICE: this.state["GET_PRICE"],
      GET_NEWS: this.state["GET_NEWS"],
      PROCESS_PRICE: this.state["PROCESS_PRICE"],
      PROCESS_NEWS: this.state["PROCESS_NEWS"],
      PROCESS_REFLET: this.state["PROCESS_REFLET"],
      MAKE_TRADE: this.state["MAKE_TRADE"]
    });
  }
};

// src/actions/ActionGetNewsData.ts
var getNewsData = {
  name: "GET_NEWS",
  similes: [
    "CHECK_NEWS",
    "FETCH_NEWS",
    "GET_CRYPTO_NEWS",
    "CRYPTO_NEWS",
    "CHECK_CRYPTO_NEWS"
  ],
  description: "Get news for a cryptocurrency",
  validate: async (runtime, message, state) => {
    return true;
  },
  handler: async (runtime, message, state, _options, callback, _responses) => {
    try {
      const service = runtime.getService(ApiService.serviceType);
      const resp = "{title:[Devs accuse colleagues from Bitcoin Core of being rogue over the plans to remove the spam filter from Bitcoin], context:[Bitcoin Core will remove OP_RETURN in the next version, scheduled for release in October. OP_RETURN is a script Bitcoin Core devs added to Bitcoin in 2014. It\u2019s worth noting that Bitcoin Core developers have encouraged bitcoiners not to use the Bitcoin blockchain for recording arbitrary data, as there are better options that would not pile extra pressure on the Bitcoin network. At the end of the day, both currencies lost to the original Bitcoin. Will Bitcoin Core\u2019s implementation turn Bitcoin into something different? Will learn by the end of the year.]}";
      service.data["NEWS"] = resp;
      if (callback) {
        callback({
          text: `
                    Here is the off-chain news: 
                    
                    ${resp}
                    `
        });
        service.state["GET_NEWS"] = "DONE";
        var message;
        message.content.text = "CryptoTrade_Action_GET_NEWS DONE";
        message.id = asUUID(v4_default());
        runtime.emitEvent(EventType.MESSAGE_SENT, { runtime, message, source: "CryptoTrade_Action_GET_NEWS" });
        logger2.warn("***** ACTION GET_NEWS DONE *****");
        return true;
      }
    } catch (error) {
      elizaLogger.error("Error in news fetch:", error);
      if (callback) {
        callback({
          text: `
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
          text: "What's the news of Bitcoin yesterday?"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "I'll check the Bitcoin news for you right away.",
          action: "GET_NEWS"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "The news of  BTC market price are: [{date:{date}, title:{tiles1}, context:{context1}},.....]"
        }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Can you check news of ETH on 2025/04/03?"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "I'll fetch the news of Ethereum on 2025/04/03 for you.",
          action: "GET_NEWS"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "The news of ETH price on 2025/04/03 are: [{date:{date}, title:{tiles1}, context:{context1}},.....]"
        }
      }
    ]
  ]
};

// src/actions/ActionGetOnChainData.ts
import {
  elizaLogger as elizaLogger2,
  EventType as EventType2,
  logger as logger3,
  asUUID as asUUID2
} from "@elizaos/core";
import { z } from "zod";
var Blockchains = /* @__PURE__ */ ((Blockchains2) => {
  Blockchains2["BTC"] = "btc";
  Blockchains2["SOL"] = "sol";
  Blockchains2["ETH"] = "eth";
  return Blockchains2;
})(Blockchains || {});
var getBlockchainPriceRequestSchema = z.object({
  blockchain: z.nativeEnum(Blockchains).describe("The blockchain to get statistics for"),
  date: z.string().optional().describe("The date to request (optional)")
  // toTimestamp: z
  //     .number()
  //     .optional()
  //     .describe("End timestamp for the transfers (optional)"),
});
var getOnChainData = {
  name: "GET_PRICE",
  similes: [
    "GET_PRICE",
    "CHECK_PRICE",
    "PRICE_CHECK",
    "GET_CRYPTO_PRICE",
    "CRYPTO_PRICE",
    "CHECK_CRYPTO_PRICE",
    "PRICE_LOOKUP"
  ],
  description: "Get current price information for a cryptocurrency pair",
  validate: async (runtime, message, state) => {
    return true;
  },
  handler: async (runtime, message, state, _options, callback, _responses) => {
    try {
      const service = runtime.getService(ApiService.serviceType);
      const resp = "BTC price: {today:{24h Low/High $107,493.00 / $110,269.00}, yesterday:{24h Low/High $108,640.00 / $110,236.00}, }";
      service.data["PRICE"] = resp;
      if (callback) {
        callback({
          text: `
                    Here is the on-chain data: 
                    
                    ${resp}
                    `
        });
      }
      service.state["GET_PRICE"] = "DONE";
      service.state["Executing"] = true;
      var message;
      message.content.text = "CryptoTrade_Action_GET_PRICE DONE";
      message.id = asUUID2(v4_default());
      runtime.emitEvent(EventType2.MESSAGE_SENT, { runtime, message, source: "CryptoTrade_Action_GET_PRICE" });
      logger3.warn("***** ACTION GET_PRICE DONE *****");
      return true;
    } catch (error) {
      elizaLogger2.error("Error in price check:", error);
      if (callback) {
        callback({
          text: `
                    Error in price check:
                    
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
          text: "What's the market price of Bitcoin yesterday?"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "I'll check the Bitcoin market price for you right away.",
          action: "GET_PRICE"
        }
      },
      {
        name: "{{agent}}",
        content: {
          text: "The current BTC market price is {date}, open: {open price} USDT, close: {close price}} USDT"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you check ETH price on 2025/04/03?"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll fetch the Ethereum price on 2025/04/03 for you.",
          action: "GET_PRICE"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "The ETH price on 2025/04/03 is {date}, open: {open price} USDT, close: {close price}} USDT"
        }
      }
    ]
  ]
};

// src/actions/ActionProcessNews.ts
import {
  elizaLogger as elizaLogger3,
  EventType as EventType3,
  logger as logger4,
  asUUID as asUUID3
} from "@elizaos/core";
var processNewsData = {
  name: "PROCESS_NEWS",
  similes: [
    "ANALYZE_NEWS"
  ],
  description: "Analyze news and make a cryptocurrency trade",
  validate: async (runtime, message, state) => {
    return true;
  },
  handler: async (runtime, message, state, _options, callback, _responses) => {
    try {
      const service = runtime.getService(ApiService.serviceType);
      const resp = "Analysis done, the news shows that the price of the cryptocurrency will go down.";
      if (callback) {
        callback({
          text: `
                    Here is the analysis of off-chain news: 
                    
                    ${resp}
                    `
        });
      }
      service.data["ANALYSIS_NEWS"] = resp;
      service.state["PROCESS_NEWS"] = "DONE";
      var message;
      message.content.text = "CryptoTrade_Action_PROCESS_NEWS DONE";
      message.id = asUUID3(v4_default());
      runtime.emitEvent(EventType3.MESSAGE_SENT, { runtime, message, source: "CryptoTrade_Action_PROCESS_NEWS" });
      logger4.warn("***** ACTION PROCESS_NEWS DONE *****");
      return true;
    } catch (error) {
      elizaLogger3.error("Error in news analyse:", error);
      if (callback) {
        callback({
          text: `
                    Error in news analyze:
                    
                    ${error.message}
                    `
        });
        return false;
      }
      return false;
    }
  },
  examples: []
};

// src/actions/ActionProcessPrice.ts
import {
  elizaLogger as elizaLogger4,
  EventType as EventType4,
  logger as logger5,
  asUUID as asUUID4
} from "@elizaos/core";
var processPriceData = {
  name: "PROCESS_PRICE",
  similes: [
    "ANALYZE_PRICE"
  ],
  description: "Analyze price and make a cryptocurrency trade",
  validate: async (runtime, message, state) => {
    return true;
  },
  handler: async (runtime, message, state, _options, callback, _responses) => {
    try {
      const service = runtime.getService(ApiService.serviceType);
      const resp = "Analysis done, it seems that the price will go down.";
      if (callback) {
        callback({
          text: `
                    Here is the analysis of on-chain data: 
                    
                    ${resp}
                    `
        });
      }
      service.data["ANALYSIS_PRICE"] = resp;
      service.state["PROCESS_PRICE"] = "DONE";
      var message;
      message.content.text = "CryptoTrade_Action_PROCESS_PRICE DONE";
      message.id = asUUID4(v4_default());
      runtime.emitEvent(EventType4.MESSAGE_SENT, { runtime, message, source: "CryptoTrade_Action_PROCESS_PRICE" });
      logger5.warn("***** ACTION PROCESS_PRICE DONE *****");
      return true;
    } catch (error) {
      elizaLogger4.error("Error in price analyse:", error);
      if (callback) {
        callback({
          text: `
                    Error in news analyze:
                    
                    ${error.message}
                    `
        });
        return false;
      }
      return false;
    }
  },
  examples: []
};

// src/actions/ActionReply.ts
import {
  logger as logger6
} from "@elizaos/core";
import { z as z2 } from "zod";
var getBlockchainPriceRequestSchema2 = z2.object({
  blockchain: z2.nativeEnum({ BTC: "btc", SOL: "sol", ETH: "eth" }).describe("The blockchain to get statistics for"),
  date: z2.string().optional().describe("The date to request (optional)")
  // toTimestamp: z
  //     .number()
  //     .optional()
  //     .describe("End timestamp for the transfers (optional)"),
});
var reply = {
  name: "REPLY",
  similes: [
    "REPLY_TO_MESSAGE",
    "RESPNES",
    "RESPOND"
  ],
  description: "Generate first response to user.",
  validate: async (_runtime, _message, _state) => {
    return true;
  },
  handler: async (_runtime, message, state, _options, callback, _responses) => {
    try {
      logger6.info("Handling reply action");
      const service = _runtime.getService(ApiService.serviceType);
      const responseContent = {
        thought: "",
        // text: 'The final decision of trade in step[' + (service.data['STEP']-1) + '] is: ' + service.record[(service.data['STEP']-1)]['TRADE'] + '\n',
        text: "The final decision of trade is sell [-0.3/1.0]\n",
        actions: ["REPLY"]
      };
      service.state["Executing"] = false;
      service.stepEnd();
      await callback(responseContent);
    } catch (error) {
      logger6.error("Error in REPLY action:", error);
      throw error;
    }
  },
  examples: []
};

// src/index.ts
import {
  composePromptFromState as composePromptFromState2,
  EventType as EventType6,
  messageHandlerTemplate
} from "@elizaos/core";

// src/actions/ActionMakeTrade.ts
import {
  elizaLogger as elizaLogger5,
  EventType as EventType5,
  logger as logger7,
  asUUID as asUUID5
} from "@elizaos/core";
var makeTrade = {
  name: "MAKE_TRADE",
  similes: [
    "MAKE_DECISION"
  ],
  description: "Make a cryptocurrency trade",
  validate: async (runtime, message, state) => {
    return true;
  },
  handler: async (runtime, message, state, _options, callback, _responses) => {
    try {
      const service = runtime.getService(ApiService.serviceType);
      const resp = "After check and analyze the price and news of the cryptocurrency, I think we should sell 30% of it. My trade decision is -0.3/1.0";
      if (callback) {
        callback({
          text: `
                    Here is the analysis of on-chain data: 
                    
                    ${resp}
                    `
        });
        service.state["MAKE_TRADE"] = "DONE";
        service.data["TRADE"] = resp;
        var message;
        message.content.text = "CryptoTrade_Action_MAKE_TRADE DONE";
        message.id = asUUID5(v4_default());
        runtime.emitEvent(EventType5.MESSAGE_SENT, { runtime, message, source: "CryptoTrade_Action_MAKE_TRADE" });
        logger7.warn("***** ACTION MAKE_TRADE DONE *****");
        return true;
      }
    } catch (error) {
      elizaLogger5.error("Error in MAKE_TRADE:", error);
      if (callback) {
        callback({
          text: `
                    Error in news analyze:
                    
                    ${error.message}
                    `
        });
        return false;
      }
      return false;
    }
  },
  examples: []
};

// src/index.ts
var configSchema = z3.object({
  EXAMPLE_PLUGIN_VARIABLE: z3.string().min(1, "Example plugin variable is not provided").optional().transform((val) => {
    if (!val) {
      logger8.warn("Example plugin variable is not provided (this is expected)");
    }
    return val;
  })
});
var helloWorldAction = {
  name: "HELLO_WORLD",
  similes: ["GREET", "SAY_HELLO"],
  description: "Responds with a simple hello world message",
  validate: async (_runtime, _message, _state) => {
    return true;
  },
  handler: async (_runtime, message, _state, _options, callback, _responses) => {
    try {
      logger8.info("Handling HELLO_WORLD action");
      const responseContent = {
        text: "hello world!",
        actions: ["HELLO_WORLD"],
        source: message.content.source
      };
      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger8.error("Error in HELLO_WORLD action:", error);
      throw error;
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Can you say hello?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "hello world!",
          actions: ["HELLO_WORLD"]
        }
      }
    ]
  ]
};
var helloWorldProvider = {
  name: "HELLO_WORLD_PROVIDER",
  description: "A simple example provider",
  get: async (_runtime, _message, _state) => {
    return {
      text: "I am a provider",
      values: {},
      data: {}
    };
  }
};
var StarterService = class _StarterService extends Service2 {
  static serviceType = "starter";
  capabilityDescription = "This is a starter service which is attached to the agent through the starter plugin.";
  constructor(runtime) {
    super(runtime);
  }
  static async start(runtime) {
    logger8.info(`*** Starting starter service - MODIFIED: ${(/* @__PURE__ */ new Date()).toISOString()} ***`);
    const service = new _StarterService(runtime);
    return service;
  }
  static async stop(runtime) {
    logger8.info("*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***");
    const service = runtime.getService(_StarterService.serviceType);
    if (!service) {
      throw new Error("Starter service not found");
    }
    service.stop();
  }
  async stop() {
    logger8.info("*** THIRD CHANGE - TESTING FILE WATCHING! ***");
  }
};
var managerMsgHandler = async ({
  runtime,
  message,
  callback,
  onComplete
}) => {
  let _state = await runtime.composeState(message);
  const _responseContent = {
    thought: "",
    actions: ["GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "MAKE_TRADE", "REPLY"],
    text: ""
  };
  const _responseMessage = {
    id: asUUID6(v4_default()),
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    content: _responseContent,
    roomId: message.roomId,
    createdAt: Date.now()
  };
  if (_responseContent && _responseContent.text && (_responseContent.actions?.length === 0 || _responseContent.actions?.length === 1 && _responseContent.actions[0].toUpperCase() === "REPLY")) {
    logger8.warn("[Manager Handler] callback");
    await callback(_responseContent);
  } else {
    logger8.warn("[Manager Handler] processActions");
    await runtime.processActions(message, [_responseMessage], _state, callback);
  }
  const manageTemplate_Intro = `
  # You are a professional cryptoCurrency trader. If you received message from user, you should start you actions immediately. You are supposed to make a trade by executing actions in the following steps: 1."GET_PRICE" and "GET_NEWS" (these two actions should be take together, not single); 2."PROCESS_PRICE" and "PROCESS_NEW " (these two actions should be take together, not single); 3."MAKE_TRADE"; 4."REPLY".


  # Task: Generate dialog with actions.
  # Instructions: Write the next message for user.
  "thought" should be a short description of what the agent is thinking about and planning.
  "message" should be the next message for user which they will send to the conversation.
  "actions" should be the next actions that agent will conduct, "actions" should include one or more actions. 
  # Possible response actions: "GET_PRICE", "GET_NEWS", "PROCESS_PRICE", "PROCESS_NEWS", "MAKE_TRADE", "REPLY", "IGNORE"


  `;
  const manageTemplate_Example = `
  # Action Examples:
  user: Please help me to make a decision of BTC trade, am I supposed to buy or sell?
agent: I'll conduct a research of BTC now. (actions: "GET_PRICE", "GET_NEWS")


  agent: I've got the price and news of BTC, analysing. (actions: "PROCESS_PRICE", "PROCESS_NEWS")


  agent: Analysis done, the price of BTC seems to be going down, we should sell part of them, about 20%. (actions: "MAKE_TRADE")


  agent: Finally, reply the decision to user. The decision is: -0.2/1.0 of your BTC. (actions: "REPLY")
  `;
  const manageTemplate_Rules = `
  # RULES:
  RULE 1: User is asking the proposal to make a cryptoCurrency trade, you should begin to make a trade by executing actions in the following order above, and reply in the end;

  RULE 2: When your are executing ations, they must be executed strictly in the order of steps;

  RULE 3: You should decide next actions with the state of the steps'execution provided below, after actions in step before has been "DONE", execute actions in the next step;

  RULE 4: User is talking about other things, or your are executing actions (eg: In step 2, "PROCESS_PRICE" done, but still waiting "PROCESS_NEWS"), set "actions" as "IGNORE".

  RULE 5: The response must contain "thought", "message", and "actions".


  `;
  const manageTemplate_state = `
  The state of the steps'execution:
  `;
  const manageTemplate_format = `
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
  const manageTemplate_take_actions = `
  # Choose your next actions within the [Possible response action] and the [RULES] mentioned before.
  # Your response should be formatted in a valid JSON block like this:

  {
      "thought": "<string>",
      "message": "<string>",
      "actions": ["<string>", "<string>", "<string>"]
  }
  # Now, choose your next actions:
  `;
  logger8.warn("[Manager Handler] Saving message to memory and embeddings");
  if (message && message.content && message.content.text) {
    await Promise.all([
      runtime.addEmbeddingToMemory(message),
      runtime.createMemory(message, "messages")
    ]);
  }
  let state = await runtime.composeState(message);
  var apiService = runtime.getService(ApiService.serviceType);
  var userMsgTmp = "";
  var prompt = "";
  if (message && message.content && message.content.text.startsWith("CryptoTrade_Action")) {
    prompt = composePromptFromState2({
      state,
      template: manageTemplate_Intro + manageTemplate_Example + manageTemplate_Rules + manageTemplate_state + apiService.getState() + "\n\n" + manageTemplate_take_actions
    });
  } else {
    if (message && message.content && message.content.text) {
      userMsgTmp = "\n# User's message as below:\n\nuser:" + message.content.text + "\n# User's message end";
    }
    prompt = composePromptFromState2({
      state,
      template: manageTemplate_Intro + manageTemplate_Example + manageTemplate_Rules + manageTemplate_state + apiService.getState() + "\n\n" + userMsgTmp + manageTemplate_format
    });
  }
  logger8.warn("[CryptoTrader] *** prompt content ***\n", prompt);
  const response = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt
  });
  logger8.warn("[CryptoTrader] *** response ***\n", response);
  const parsedJson = JSON.parse(response);
  let responseContent = null;
  let responseMessages = [];
  logger8.warn("[CryptoTrader] *** message.id ***\n", message.id);
  if (parsedJson) {
    responseContent = {
      ...parsedJson,
      thought: parsedJson.thought || "",
      actions: parsedJson.actions || ["IGNORE"],
      text: parsedJson.text || ""
    };
  } else {
    responseContent = null;
  }
  if (responseContent && message.id) {
    responseContent.inReplyTo = createUniqueUuid(runtime, message.id);
    const responseMessage = {
      id: asUUID6(v4_default()),
      entityId: runtime.agentId,
      agentId: runtime.agentId,
      content: responseContent,
      roomId: message.roomId,
      createdAt: Date.now()
    };
    responseMessages = [responseMessage];
  }
  if (responseContent && responseContent.text && (responseContent.actions?.length === 0 || responseContent.actions?.length === 1 && responseContent.actions[0].toUpperCase() === "REPLY")) {
    await callback(responseContent);
  } else {
    await runtime.processActions(message, responseMessages, state, callback);
  }
};
var events = {
  [EventType6.MESSAGE_RECEIVED]: [
    async (payload) => {
      if (!payload.callback) {
        logger8.warn("No callback provided for message");
        return;
      }
      await managerMsgHandler({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback,
        onComplete: payload.onComplete
      });
    }
  ],
  [EventType6.MESSAGE_SENT]: [
    async (payload) => {
      logger8.warn(`[CryptoTrader] Message sent: ${payload.message}`);
    }
  ],
  [EventType6.ACTION_STARTED]: [
    async (payload) => {
      logger8.warn(`[Bootstrap] Action started: ${payload.actionName} (${payload.actionId})`);
    }
  ],
  [EventType6.ACTION_COMPLETED]: [
    async (payload) => {
      const status = payload.error ? `failed: ${payload.error.message}` : "completed";
      logger8.warn(`[Bootstrap] Action ${status}: ${payload.actionName} (${payload.actionId})`);
    }
  ]
};
var starterPlugin = {
  name: "plugin-exam",
  description: "Plugin starter for elizaOS",
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE
  },
  async init(config) {
    logger8.info("*** TESTING DEV MODE - PLUGIN MODIFIED AND RELOADED! ***");
    try {
      const validatedConfig = await configSchema.parseAsync(config);
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z3.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(", ")}`
        );
      }
      throw error;
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (_runtime, params) => {
      return "Crypto Plugin ModelType.TEXT_SMALL called...";
    },
    [ModelType.TEXT_LARGE]: async (_runtime, {
      prompt,
      stopSequences = [],
      maxTokens = 8192,
      temperature = 0.7,
      frequencyPenalty = 0.7,
      presencePenalty = 0.7
    }) => {
      return "Crypto Plugin ModelType.TEXT_LARGE called......";
    }
  },
  routes: [
    {
      name: "hello-world-route",
      path: "/helloworld",
      type: "GET",
      handler: async (_req, res) => {
        res.json({
          message: "Hello World!"
        });
      }
    }
  ],
  services: [StarterService, ApiService],
  actions: [
    helloWorldAction,
    reply,
    getNewsData,
    getOnChainData,
    processNewsData,
    processPriceData,
    makeTrade
  ],
  providers: [helloWorldProvider],
  events
};
var src_default = starterPlugin;
export {
  StarterService,
  src_default as default,
  starterPlugin
};
//# sourceMappingURL=index.js.map