# How to set up the development environment for Plugin-Cryptotrade



## 1. Set up ElizaOS

### 1.1. Install npm

```
https://nodejs.org/en/download
```

### 1.2. install bun

```
https://bun.sh/
```

### 1.3. Install ElizaOS

```
bun i -g @elizaos/cli
```

### 1.4. Create an ElizaOS project

```
elizaos create
# choose [Project - Full ElizaOS application] and set a <project-name>

cd <project-name>
# launch project
elizaos start

# if you choose to use local-ai, ElizaOS will download Llama models.
```

### 1.5. Create an ElizaOS agent

```
# create a new terminal
elizaos create 
# choose [Agent - Character definition file] and set a <agent-name>
# ElizaOS will create a new file: <agent-name>.json
```

#### 1.5.1. Configure your agent

You can edit \<agent-name\>.json directly, add your custom plugin in "plugins": […]

**!!! Notice: if you choose to use [@icecoins/plugin-cryptotrade], please remove [@elizaos/plugin-bootstrap].**

```
{
  "name": "my-agent",
  "plugins": [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-local-ai",
    "@icecoins/plugin-cryptotrade",
    "@elizaos/plugin-bootstrap"
  ],
  "secrets": {},
  ......
}
```

#### 1.5.2. Start/Stop/Delete Agent

After you changed <agent-name>.json, remove agent by agent-name and restart it

```
# launch agent, Ensure that the ElizaOS-project is running
elizaos agent start --path=./path/to/<agent-name>.json

# remove agent to reload <agent-name>.json
elizaos remove --name my-agent

# Configure you agent .json file and restart it
elizaos agent start --path=./path/to/<agent-name>.json
```

You can also operate your agent in the browser (http://localhost:3000/)






## 2. Develop in your plugin and merge it to our project later (recommanded)

### 2.1. Create your plugin

```
elizaos create
# choose [Plugin - Custom ElizaOS plugin]
cd <your-plugin-dir>
```

### 2.2. Develop your plugin

Plugin entry point:

```
path/to/<your-plugin-dir>/src/plugin.ts
```

A plugin consists of Services, Actions, Events, …

#### 2.2.1. Service

You can define data structs and functions in service, and use them in anywhere, like:

```
let service = runtime.getService(YourService.serviceType) as YourService;
await service.YourFunction1();
let result = service.YourFunction2();
......
```


You can modify the code in path/to/\<your-plugin-dir\>/src/plugin.ts directly, or create a new file eg: MyService.ts, then finish and export your service.

#### 2.2.2. Action

A plugin includes one or more actions. An action has its name. ElizaOS will **find the actions by their names**, then execute them in order.

The code in **handler: async (…){…}** will be executed by ElizaOS.

**await callback(…)** will return some messages to user (eg: to browser)


You can define actions in a order, and use **await runtime.processActions(message, [_responseMessage], _state, callback)** to execute them.

#### 2.2.3. Events

EventType.MESSAGE_RECEIVED will be detected as user sent a message.

You can define what to do when the event happened, for example, execute some Actions.

#### 2.2.4. Publish and test

**!!! Notice: After you finish your plugin, you should publish it to npmjs.com**

ElizaOS cannot install plugin locally, it will use **bun add @author/plugin-name** to install a plugin from npmjs.com

Go to https://www.npmjs.com/ in your browser, and sign up.

Then go back to terminal

```
bun run build
# if build error, try this may help: # bun install typescipt # bun install tsup
bun publish
# there will be a link for you to login to npmjs.com, open it in browser
```

After you publish your plugin

1. Add your plugin to your agent, as mentioned before.

   You can edit \<agent-name\>.json directly, add your custom plugin in "plugins": […]

2. Start your agent.

3. Test your plugin.

If you don’t want to publish it every time your modified the plugin, you can replace the dist .js file directly. (but you still have to publish it at first time)

```
cd /path/to/your/plugin-dir/

bun run build && 
rm -r /path/to/your/project-dir/node_modules/<@your-plugin-name>/dist && 
cp -r dist /path/to/your/project-dir/node_modules/<@your-plugin-name>/dist

cd /path/to/your/project-dir/
elizaos start
```



## 3. Develop in plugin-cryptotrade directly

### 3.1. Fork and clone repo

```
# fork https://github.com/icecoins/plugin-cryptotrade
git clone https://github.com/your-account/plugin-cryptotrade
cd plugin-cryptotrade
```

If you want to run plugin-cryptotrade, you have to download some price/tansaction/news data, and put them into your ElizaOS-project

The data can be downloaded at (if the link isn’t available, please contact with me):

```
https://i.i64.cc/s/gwFG
```

The data should be placed at

```
/path/to/your/elizaos-proj/data
```


And you should edit you .env file under the ElizaOS-Project, add some configuration information

```
/path/to/elizaos-project/.env
```

```
SENTRY_TRACES_SAMPLE_RATE=
SENTRY_SEND_DEFAULT_PII=
...
# The API key of binance
CRYPT_BINANCE_API_KEY=
CRYPT_BINANCE_KEY=

CRYPT_STARTING_DAY=
CRYPT_ENDING_DAY=
# bear bull sideways
CRYPT_STAGE=bear

CRYPT_CALLBACK_IN_ACTIONS=false
# set to false to use openPrice and MACD only
CRYPT_USE_TRANSACTION=true
CRYPT_ENABLE_NEWS_SIMPLIFICATION=false
# Developing
CRYPT_CUSTOM_TIME_SLOT=false
...
PGLITE_DATA_DIR=.../.eliza/.elizadb
```



### 3.2. Create your Services in ./plugin-cryptotrade/src/services

### 3.3. Create your Actions in ./plugin-cryptotrade/src/actions

### 3.4. Modify ./plugin-cryptotrade/src/plugin.ts to include your feature

### 3.5. Test your feature and pull request



## 4. Some additional information

### 4.1. ElizaOS doc:  https://eliza.how/

### 4.2. Some slides used in early meetings

```
https://i.i64.cc/s/P7Tz
```



## 5. Thanks for reading

I hope this doc can help you, if you have any problems, please contact with me at anytime.



