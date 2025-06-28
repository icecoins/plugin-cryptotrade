import {
    type IAgentRuntime,
    logger,
    ModelType,
    Service} from "@elizaos/core";
import { rejects } from "assert";
import { error, time } from "console";
import * as fs from 'fs';
import path, { resolve } from "path";
import * as readline from 'readline';
import { EX_RATE, GAS_FEE, LLM_retry_times, STARTING_CASH_RATIO, starting_date, STARTING_NET_WORTH } from "src/const/Const";
import { date, number } from "zod";

export const delim = '\n"""\n';

export async function getData(path: string) : Promise<any>{
  await fetch('http://127.0.0.1:8642/' + path)
    .then(response => {return response.json();})
    .then(_data => {
      console.log(_data);
      return _data;
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

export async function postData(path: string, data: any): Promise<any>{
  var options:RequestInit = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: data
  };
  await fetch('http://127.0.0.1:8642/' + path, options)
    .then(response => {
      return response.json();
    })
    .then(_data => {
      console.log(_data);
      return _data;
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
function ewma(data: number[], span: number): number[] {
    const alpha = 2 / (span + 1);
    const result: number[] = [];
    let prevEwma = data[0];
    result.push(prevEwma);

    for (let i = 1; i < data.length; i++) {
        const currentEwma = alpha * data[i] + (1 - alpha) * prevEwma;
        result.push(currentEwma);
        prevEwma = currentEwma;
    }

    return result;
}

export class ApiService extends Service {
  static serviceType = 'apiservice';
  capabilityDescription =
    'This is a api service which is attached to the agent through the cryptotrade plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting api service -- : ${new Date().toISOString()} ***`);
    const service = new ApiService(runtime);
    service.initState();
    service.initData();
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
    // get the service from the runtime
    const service = runtime.getService(ApiService.serviceType);
    if (!service) {
      throw new Error('API service not found');
    }
    service.stop();
  }
  
  async stop() {
    logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
  }
  
  async postOnChianAPI(_chain: string, _date: string){
    // CALL SERVER
    try {
        const response = await postData('getOnChainData', {chain: _chain, date: _date});
        return response.data;
    } catch (error) {
        console.error("CryptoTrade Server Error: ", error.message);
        throw error;
    }
  }
  async postNewsAPI(_chain: string, _date: string){
        try {
        const response = await postData('getNewsData', {chain: _chain, date: _date});
        return response.data;
    } catch (error) {
        console.error("CryptoTrade Server Error: ", error.message);
        throw error;
    }
  }
  public step_state:{} = {Executing:false, GET_PRICE:'UNDONE'};
  public step_data:{} = {STEP:0, STAGE:0};
  
  public is_action_executing = {};
  public price_data = [];
  public transaction_data = [];
  public news_data = [];
  public record = [];
  public onChainDataLoaded = false;
  public offChainNewsLoaded = false;

  public cash:number;
  public coin_held:number;
  public starting_net_worth:number;
  public net_worth:number;
  public total_roi:number;
  public last_net_worth:number;
  public starting_price:number;

  public today_idx:number;
  public end_day_idx:number;
  public project_initialized:boolean = false;
  initProject(){
    // project parms should be initialized as soon as the data is loaded
    this.starting_price = this.price_data[this.today_idx].value['open'];
    this.starting_net_worth = STARTING_NET_WORTH;
    this.cash = this.starting_net_worth * STARTING_CASH_RATIO;
    this.coin_held = (this.starting_net_worth - this.cash) / this.starting_price
    this.last_net_worth = this.starting_net_worth;
    this.project_initialized = true;
  }

  initState() {
    // state will restore at the beginning of every step
    this.step_state['Executing'] = false;
    this.step_state['GET_PRICE'] = 'UNDONE';
    this.step_state['GET_NEWS'] = 'UNDONE';
    this.step_state['PROCESS_PRICE'] = 'UNDONE';
    this.step_state['PROCESS_NEWS'] = 'UNDONE';
    this.step_state['PROCESS_REFLET'] = 'UNDONE';
    this.step_state['MAKE_TRADE'] = 'UNDONE';
    
    this.is_action_executing['GET_PRICE'] = false;
    this.is_action_executing['GET_NEWS'] = false;
    this.is_action_executing['PROCESS_PRICE'] = false;
    this.is_action_executing['PROCESS_NEWS'] = false;
    this.is_action_executing['PROCESS_REFLET'] = false;
    this.is_action_executing['MAKE_TRADE'] = false;
  }

  initData() {
    // data will restore at the beginning of every step
    this.step_data['STEP'] = this.step_data['STEP'] + 1;
    this.step_data['DATE'] = '';
    this.step_data['ANALYSIS_REPORT_ON_CHAIN'] = '';
    this.step_data['ANALYSIS_REPORT_NEWS'] = '';
    this.step_data['ANALYSIS_REPORT_REFLECT'] = '';
    this.step_data['TRADE_REASON'] = '';
    this.step_data['TRADE_ACTION'] = '';
    this.step_data['TRADE_ACTION_VALUE'] = 0;
    this.step_data['DAILY_RETURN'] = 0;
    this.step_data['TODAY_ROI'] = 0;
  }

  public stepEnd(){
    this.record.push({step:this.step_data['STEP'], date: this.step_data['DATE'], data: this.step_data, state: this.step_state});
    logger.error('STEP END, RECORD:\n', JSON.stringify(this.record[this.record.length-1]))
    this.initData();
    this.initState();
  }

  public updateState(Executing: boolean, GET_PRICE: string, GET_NEWS: string, 
    PROCESS_PRICE: string, PROCESS_NEWS: string, PROCESS_REFLET: string, MAKE_TRADE: string) {
    this.step_state['Executing'] = Executing;
    this.step_state['GET_PRICE'] = GET_PRICE;
    this.step_state['GET_NEWS'] = GET_NEWS;
    this.step_state['PROCESS_PRICE'] = PROCESS_PRICE;
    this.step_state['PROCESS_NEWS'] = PROCESS_NEWS;
    this.step_state['PROCESS_REFLET'] = PROCESS_REFLET;
    this.step_state['MAKE_TRADE'] = MAKE_TRADE;
  }

  public getState() {
    return JSON.stringify({
      Executing :this.step_state['Executing'],
      GET_PRICE :this.step_state['GET_PRICE'],
      GET_NEWS :this.step_state['GET_NEWS'],
      PROCESS_PRICE :this.step_state['PROCESS_PRICE'],
      PROCESS_NEWS :this.step_state['PROCESS_NEWS'],
      PROCESS_REFLET :this.step_state['PROCESS_REFLET'],
      MAKE_TRADE :this.step_state['MAKE_TRADE']
    })
  }

  async readLocalCsvFile(filePath: string, which_data:string, reverse: boolean = false): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      let firstLine = true;
      let labels = [];
      rl.on('line', (line) => {
        if(!firstLine){
          let data = line.split(','); // ...,2781,42569.7614,43243.16818,41879.18999,...
          data[0] = data[0].substring(0,10) // 2024-02-01
          let values: Record<string, any> = {}; // day:xx, unique_addresses:xxx, ...
          for(let i = 0; i < labels.length; i++){
            if(!('open' === labels[i])){
              values[labels[i]] = data[i];
            }else{
              values[labels[i]] = Number(data[i]);
            }
          }
          switch (which_data) {
            case "price":
              // key:date, value:{name1:value1,...}
              this.price_data.push({ key: data[0], value: values });
              break;
            case "transaction":
              this.transaction_data.push({ key: data[0], value: values });
              break;
            default:
              break;
          }
        }else{
          logger.error('The first line of the csv file: ' + line);
          labels = line.split(',')
          firstLine = false;
        }
      });

      rl.on('close', () => {
        if(reverse){
          switch(which_data){
            case 'price':
              this.price_data = this.price_data.reverse();
              break;
            case 'transaction':
              this.transaction_data = this.transaction_data.reverse();
              break;
            default:
              break;
          }
        }
        logger.error('Process End');
        resolve('Read CSV File Process End');
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async loadTransactionData(local: boolean = true): Promise<string>{
    return new Promise<string>(async (resolve, reject) =>{
      if(this.onChainDataLoaded){
        resolve('TRANSACTION DATA HAS LOADED, SKIP');
      }else{
        logger.error('DATA: loadTransactionData start');
      }
      let res = 'error';
      try {
        let values = {};
        if(local){
          res = await this.readLocalCsvFile('./data/local/bitcoin_transaction_statistics.csv', 'transaction', false);
          logger.error('loadTransactionData END');
        }else{
          values = await fetchFileFromWeb();
        }
      } catch (error) {
        logger.error('loadPriceData error: ', error);
        reject(error);
      }
      this.onChainDataLoaded = true;
      resolve(res);
    });
  }

  public async readFileByAbsPath(path:string, local: boolean = true): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await fs.readFileSync(path, 'utf-8');
        resolve(data);
      } 
      catch (error) {
        reject(error);
      }
    });
  }

  public async loadNewsData(chain:string = 'btc', force:boolean = false, local: boolean = true): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      if(!force && this.offChainNewsLoaded){
        resolve('News Data Has Loaded, SKIP');
      }
      let fileNames:string[] = [];
      let dir = `./data/local/news/${chain}`;
      const list = await fs.readdirSync(dir, 'utf-8');
      try {
        for (const name of list) {
            fileNames.push(name);
        }
        for (const name of fileNames){
          let news_data = await this.readFileByAbsPath(path.join(dir, name));
          this.news_data.push({ key:name.split('.')[0], value: news_data });
        }
        this.offChainNewsLoaded = true;
        resolve('News data has been successfully loaded.');
      } 
      catch (error) {
        reject(error);
      }
    });
  }

  public async loadPriceData(chain:string = 'btc', force:boolean = false, local: boolean = true) : Promise<any>{
    return new Promise<any>(async (resolve, reject)=>{
      if(!force && this.onChainDataLoaded){
        resolve('PRICE DATA HAS LOADED, SKIP');
      }else{
        logger.error('DATA: loadPriceData start');
      }
      let res = 'error';
      try {
        let values;
        if(local){
          res = await this.readLocalCsvFile('./data/local/bitcoin_daily_price.csv', 'price', true);
          logger.error('loadPriceData END');
          let result = this.calculateMACD();
          for (let i=0; i<this.price_data.length; i++){
            this.price_data[i].value['ema12'] = result.ema12[i];
            this.price_data[i].value['ema26'] = result.ema26[i];
            this.price_data[i].value['macd'] = result.macd[i];
            this.price_data[i].value['signalLine'] = result.signalLine[i];
          }
          logger.error('MACD DATA CALC END');
        }else{
          values = await fetchFileFromWeb();
        }
      } catch (error) {
        logger.error('loadPriceData error: ', error);
        reject(error);
      }
      resolve(res);
    });
  }

  public calculateMACD() {
    //this.price_data.push({ key: data[0], value: values });
    const openPrices = this.price_data.map(d => d.value['open']);
    //logger.error('calculateMACD openPrices: ', openPrices);
    const ema12 = ewma(openPrices, 12);
    const ema26 = ewma(openPrices, 26);

    const macd = ema12.map((val, idx) => val - ema26[idx]);
    // logger.error('calculateMACD macd: ', macd);
    const signalLine = ewma(macd, 9);

    return {
        ema12,
        ema26,
        macd,
        signalLine,
    };
  }

  public getNextDay(dateString:string){
    let idx = this.price_data.findIndex( d => d.key === dateString);
    if(-1 != idx && idx + 1 < this.price_data.length){
      return this.price_data[idx+1].key;
    }
    throw new Error('Invalid date');
  }

  public getNextOpenPriceByDate(dateString:string){
    let idx = this.price_data.findIndex( d => d.key == dateString);
    if(-1 != idx && idx + 1 < this.price_data.length){
      return this.price_data[idx+1].value['open'];
    }
    throw new Error('Invalid date');
  }

  public getNextOpenPriceByDateIdx(idx:number){
    if(-1 != idx && idx + 1 < this.price_data.length){
      return this.price_data[idx+1].value['open'];
    }
    throw new Error('Invalid date');
  }
  
  public calculateROI(): Promise<any>{
    return new Promise<any>((resolve, rejects) => {
      //Return On Investment
      // console.error(`[CRYPTOTRADE]: ***** calculateROI start *****`);
      let next_open_price = this.getNextOpenPriceByDateIdx(this.today_idx);
      this.net_worth = this.cash + this.coin_held * next_open_price;
      this.total_roi = this.net_worth / this.starting_net_worth - 1;
      this.step_data['TODAY_ROI'] = this.net_worth / this.last_net_worth - 1;
      this.last_net_worth = this.net_worth;
      // console.error(`this.step_data['TODAY_ROI']: ${this.step_data['TODAY_ROI']}`);
      // console.error(`this.last_net_worth: ${this.last_net_worth}`);
      console.error(`[CRYPTOTRADE]: ***** calculateROI end *****`);
      resolve(null);
    });
  }

  public executeTrade(){
    return new Promise<any>((resolve, rejects) => {
      // console.error(`[CRYPTOTRADE]: ***** executeTrade start *****`);
      this.step_data['TRADE_ACTION'] = 'hold';
      let action_val = this.step_data['TRADE_ACTION_VALUE'];
      let open_price = this.price_data[this.today_idx].value['open']
      if (-1 <= action_val && action_val < 0 && this.coin_held > 0){
        this.step_data['TRADE_ACTION'] = 'sell';
        let eth_diff = Math.abs(action_val) * this.coin_held;
        let cash_diff = eth_diff * open_price;
        this.coin_held -= eth_diff;
        this.cash += cash_diff;
        this.cash -= GAS_FEE * open_price + cash_diff * EX_RATE;
      }
      else if (0 < action_val && action_val <= 1 && this.cash > 0){
        this.step_data['TRADE_ACTION'] = 'buy';
        let cash_diff = Math.abs(action_val) * this.cash;
        let eth_diff = cash_diff / open_price;
        this.cash -= cash_diff;
        this.coin_held += eth_diff;
        this.cash -= GAS_FEE * open_price + cash_diff * EX_RATE;
      }
      // console.error(`action_val: ${action_val}`);
      // console.error(`open_price: ${open_price}`);
      // console.error(`this.coin_held: ${this.coin_held}`);
      // console.error(`this.cash: ${this.cash}`);
      console.error(`[CRYPTOTRADE]: ***** executeTrade end *****`);
      resolve(null);
    });
  }

  public parseAction(response: string | number): number {
    if (typeof response === 'string') {
        //-0.x、0.x、-1.0、1.0
        const regex = /-?(?:0(?:\.\d{1})|1\.0)/g;
        const actions = response.match(regex);
        if (!actions || actions.length === 0) {
            console.error(`ERROR: Invalid llm response: \n${response}. \nSet to no action.`);
            response = 0;
        } else if (actions.length === 1) {
            response = parseFloat(actions[0]);
        } else {
            response = parseFloat(actions[actions.length - 1]);
        }
    }
    if (typeof response !== 'number' || response < -1 || response > 1) {
        response = -999;
        // throw new Error(`ERROR: Invalid action: ${response}. Set to no action.`);
    }
    return response;
  }

  public async getPromptOfOnChainData(chain: string = 'BTC', date:string = '2024-09-26', windowSize:number = 5){
    let idx_price = this.price_data.findIndex(item => item.key === date);
    let idx_transaction = this.transaction_data.findIndex(item => item.key === date);
    if(-1 != idx_price && -1 != idx_transaction){
      let idx_price_start = idx_price - windowSize < 0 ? 0 : idx_price - windowSize;
      let idx_transaction_start = idx_transaction - windowSize < 0 ? 0 : idx_transaction - windowSize;
      let price_s = "You are an " + chain + 
      "cryptocurrency trading analyst. The recent price and auxiliary information is given in chronological order below:" + delim;
      for(; (idx_price_start <= idx_price) && (idx_transaction_start <= idx_transaction); 
            idx_price_start++, idx_transaction_start++){
        let data_str =  'Open price: ' + this.price_data[idx_price_start].value['open'];
        let transaction_value_set = this.transaction_data[idx_transaction_start].value;
        let transaction_labels = Object.keys(transaction_value_set);
        for (const label of transaction_labels){
          data_str += `, ${label}: ${transaction_value_set[label]}`; 
        }
        let macd:number = this.price_data[idx_price_start].value['macd']
        let macd_signal_line:number = this.price_data[idx_price_start].value['signalLine']
        let macd_signal = 'hold';
        if (macd < macd_signal_line){
          macd_signal = 'buy';
        }
        else if (macd > macd_signal_line){
          macd_signal = 'sell';
        }
        data_str += `, macd_signal: ${macd_signal}`;
        data_str += ';\n';
        price_s += data_str;
      }
      // Open price: 17446.36027, day: 2023-01-11, unique_addresses: 1274205, total_transactions: 6726228, total_value_transferred: 250059124.5, average_fee: 0.00055232, total_size_used: 2.13E+11, coinbase_transactions: 405;
      price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
      // logger.error('API SERVICE getPromptOfOnChainData: \n' + price_s);
      return price_s;
    }else{
      return null;
    }
  }

  public async getPromptOfNewsData(chain: string = 'btc', date:string = '2024-09-26'){
    let idx_news = this.news_data.findIndex(item => item.key === date);
    logger.error('API SERVICE getPromptOfNewsData: [' + idx_news + ']\n');
    if(-1 != idx_news){
      let news_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. You are required to analyze the following news articles:` + delim;
      news_s += this.news_data[idx_news].value;
      news_s += delim + `Write one concise paragraph to analyze the news and estimate the market trend accordingly.`;
      // logger.error('API SERVICE getPromptOfOnChainData: \n' + price_s);
      return news_s;
    }else{
      return 'FAILED TO FETCH NEWS DATA';
    }
  }

  public async getPromptOfReflectHistory(chain: string = 'btc', windowSize:number = 10){
    let record_len = this.record.length;
    let reflect_end = record_len - 1;
    let idx_start = reflect_end - windowSize < 0 ? 0 : reflect_end - windowSize;
    logger.error('API SERVICE getPromptOfReflectHistory: [' + idx_start + ']\n');
    let reflect_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. Your analysis and action history is given in chronological order:` + delim;
    
    if(0 === record_len){
      reflect_s += 'There is not any analysis and action history yet.';
    }
    let reflect_data = [];
    // this.record.push({step:this.data['STEP'], date: this.data['DATE'], data: this.data, state: this.state});
    for(; idx_start < record_len; idx_start++){
      const date_set = this.record[idx_start].data;
      reflect_data.push({
        Date: date_set['DATE'],
        Reasoning: date_set['TRADE_REASON'],
        Action: date_set['TRADE_ACTION'],
        DailyReturn: date_set['DAILY_RETURN'],
      });
    }
    reflect_s += JSON.stringify(reflect_data);
    reflect_s += delim + `Reflect on your recent performance and instruct your future trades from a high level, e.g., identify what information is currently more important, and what to be next, like aggresive or conversative. Write one concise paragraph to reflect on your recent trading performance with a focus on the effective strategies and information that led to the most successful outcomes, and the ineffective strategies and information that led to loss of profit. Identify key trends and indicators in the current cryptocurrency market that are likely to influence future trades. Also assess whether a more aggressive or conservative trading approach is warranted.`;
    return reflect_s;
  }

  public async getPromptOfMakeTrade(chain: string = 'btc'){
    let trade_s = `You are an experienced ${chain.toUpperCase()} cryptocurrency trader and you are trying to maximize your overall profit by trading ${chain.toUpperCase()}. In each day, you will make an action to buy or sell ${chain.toUpperCase()}. You are assisted by a few analysts below and need to decide the final action.`
    trade_s += `\n\nON-CHAIN ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_ON_CHAIN']}${delim}\nNEWS ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_NEWS']}${delim}\nREFLECTION ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_REFLECT']}${delim}\n`;
    trade_s += 'Now, start your response with your brief reasoning over the given reports. Then, based on the synthesized reports, conclude a clear market trend, emphasizing long-term strategies over short-term gains. Finally, indicate your trading action as a 1-decimal float in the range of [-1,1], reflecting your confidence in the market trend and your strategic decision to manage risk appropriately.'
    return trade_s;
  }

  public async tryToCallLLMsWithoutFormat(prompt: string, parseAction:boolean = false) : Promise<string>{
    return new Promise<string>( async (resolve, reject) => {
      let response = 'LLM HAS NOT RESPONSE';
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          logger.warn('[CryptoTrader] tryToCallLLMsWithoutFormat *** prompt content ***\n', prompt);
          response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: prompt,
          });
          // Attempt to parse the XML response
          logger.warn('[CryptoTrader] tryToCallLLMsWithoutFormat *** response ***\n', response);
          // const parsedXml = parseKeyValueXml(response);
          // const parsedJson = parseJSONObjectFromText(response);
          if(parseAction){
            this.step_data['TRADE_ACTION_VALUE'] = this.parseAction(response);
            if (-999 === this.step_data['TRADE_ACTION_VALUE']){
              continue;
            }
          }
          if(response && response != ''){
            break;
          }
          // logger.warn('[CryptoTrader] *** Parsed JSON Content ***\n', parsedJson);
        } catch (error) {
          // retry
          response = null;
        }
      }
      if(!response){
        reject('LLM_ERROR')
      }else{
        resolve(response);
      }
    });
  }

  public async tryToCallLLMs4Json(prompt: string, runtime: IAgentRuntime) : Promise<any>{
    return new Promise<any>( async (resolve, reject) => {
      let parsedJson;
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          logger.warn('[CryptoTrader] tryToCallLLM *** prompt ***\n', prompt);
          const response = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: prompt,
          });

          // Attempt to parse the XML response
          logger.warn('[CryptoTrader] tryToCallLLM *** response ***\n', response);
          // const parsedXml = parseKeyValueXml(response);
          // const parsedJson = parseJSONObjectFromText(response);
          parsedJson = JSON.parse(response);
          if(response && parsedJson){
            break;
          }
          // logger.warn('[CryptoTrader] *** Parsed JSON Content ***\n', parsedJson);
        } catch (error) {
          // retry
          parsedJson = null;
        }
      }
      if(!parsedJson){
        reject('LLM_ERROR')
      }else{
        resolve(parsedJson);
      }
    });
  }

}
export async function fetchFileFromWeb() {
  try {
    const response = await fetch('https://domain.com/file.csv');
    if (!response.ok) { 
      throw new Error('Network response was not ok'); 
    } 
    const data = await response.text();
    const json = await response.json();
    console.log(data); 
    return json;
  } catch (error) { 
    console.error('There has been a problem with your fetch operation:', error); 
  } 
} 


