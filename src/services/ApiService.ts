import {
    type IAgentRuntime,
    logger,
    ModelType,
    Service} from "@elizaos/core";
import * as fs from 'fs';
import path from "path";
import * as readline from 'readline';
import { delim, EX_RATE, GAS_FEE, LLM_retry_times, STARTING_CASH_RATIO, starting_date, STARTING_NET_WORTH } from "../const/Const";
import { BinanceService } from "./BinanceService";
import { SymbolPrice, TradingDayTickerFull, TradingDayTickerMini } from "binance";


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

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export interface Article{
  // id:number,
  // url:string,
  title:string,
  time:string,
  content:string,
  content_simplified:string
}
export interface RecordNewsData{
  date:string,
  data:Article[]
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
    service.initConfigs();
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
  public step_data:{} = {STEP:0};
  
  public is_action_executing = {};

  public price_data = [];
  public transaction_data = [];

  public news_data:RecordNewsData[] = [];
  public news_data_simplified = [];
  public record = [];
  public onChainDataLoaded = false;
  public offChainNewsLoaded = false;
  public abortAllTasks = false;

  public callbackInActions = true;
  public enableNewsSimplification = false;
  public useTransactionData = false;
  public customTimeSlot:boolean = false;
  public project_initialized:boolean = false;

  public cash:number;
  public coin_held:number;
  public starting_net_worth:number;
  public net_worth:number;
  public total_roi:number;
  public last_net_worth:number;
  public starting_price:number;

  public start_day:string;
  public end_day:string;
  public today_idx:number;
  public end_day_idx:number;

  public CRYPT_STARTING_DAY:string;
  public CRYPT_ENDING_DAY:string;
  public CRYPT_STAGE:string;

  public dumpRecordPath:string;

  initConfigs(){
    if(process.env.CRYPT_STARTING_DAY){
      this.CRYPT_STARTING_DAY = process.env.CRYPT_STARTING_DAY;
    }
    if(process.env.CRYPT_ENDING_DAY){
      this.CRYPT_ENDING_DAY = process.env.CRYPT_ENDING_DAY;
    }
    if(process.env.CRYPT_STAGE){
      this.CRYPT_STAGE = process.env.CRYPT_STAGE;
    }
    if(process.env.CRYPT_CUSTOM_TIME_SLOT){
      if(process.env.CRYPT_CUSTOM_TIME_SLOT === 'true'){
        this.customTimeSlot = true;
      }else{
        this.customTimeSlot = false;
      }
    }
    if(process.env.CRYPT_CALLBACK_IN_ACTIONS){
      if(process.env.CRYPT_CALLBACK_IN_ACTIONS === 'true'){
        this.callbackInActions = true;
      }else{
        this.callbackInActions = false;
      }
    }
    if(process.env.CRYPT_ENABLE_NEWS_SIMPLIFICATION){
      if(process.env.CRYPT_ENABLE_NEWS_SIMPLIFICATION === 'true'){
        this.enableNewsSimplification = true;
      }else{
        this.enableNewsSimplification = false;
      }
    }
    if(process.env.CRYPT_USE_TRANSACTION){
      if(process.env.CRYPT_USE_TRANSACTION === 'true'){
        this.useTransactionData = true;
      }else{
        this.useTransactionData = false;
      }
    }
    logger.error(`Config init done:\nthis.CRYPT_STARTING_DAY: ${this.CRYPT_STARTING_DAY}\nthis.CRYPT_STAGE: ${this.CRYPT_STAGE}\nthis.callbackInActions: ${this.callbackInActions}\nthis.enableNewsSimplification: ${this.enableNewsSimplification}`);
  }

  initProject(){
    // project parms should be initialized as soon as the data is loaded
    this.starting_price = this.price_data[this.today_idx].value['open'];
    this.starting_net_worth = STARTING_NET_WORTH;
    this.cash = this.starting_net_worth * STARTING_CASH_RATIO;
    this.coin_held = (this.starting_net_worth - this.cash) / this.starting_price
    this.last_net_worth = this.starting_net_worth;
    this.project_initialized = true;
    this.dumpRecordPath = `./data/local/record/${this.start_day}-${this.end_day}.json`;
  }

  initState() {
    // state will restore at the beginning of every step
    this.step_state['Executing'] = false;
    this.step_state['GET_PRICE'] = 'UNDONE';
    this.step_state['GET_NEWS'] = 'UNDONE';
    this.step_state['PROCESS_PRICE'] = 'UNDONE';
    this.step_state['PROCESS_NEWS'] = 'UNDONE';
    this.step_state['SIMPLIFY_NEWS'] = 'UNDONE';
    this.step_state['PROCESS_REFLET'] = 'UNDONE';
    this.step_state['MAKE_TRADE'] = 'UNDONE';
    
    this.is_action_executing['GET_PRICE'] = false;
    this.is_action_executing['GET_NEWS'] = false;
    this.is_action_executing['PROCESS_PRICE'] = false;
    this.is_action_executing['PROCESS_NEWS'] = false;
    this.is_action_executing['SIMPLIFY_NEWS'] = false;
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
    this.step_data['TODAY_ROI'] = 0;
    this.step_data['SIMPLIFIED_NEWS'] = [];
  }

  public stepEnd(){
    this.record.push(structuredClone(this.step_data));
    // logger.error('STEP END, RECORD:\n', JSON.stringify(this.record));
    this.initData();
    this.initState();
  }

  public appendRecord(){
    fs.appendFileSync(this.dumpRecordPath, JSON.stringify(this.record[this.record.length-1]) + ',\n');
  }

  public updateState(Executing: boolean, GET_PRICE: string, GET_NEWS: string, 
    PROCESS_PRICE: string, PROCESS_NEWS: string, SIMPLIFY_NEWS: string,
    PROCESS_REFLET: string, MAKE_TRADE: string) {
    this.step_state['Executing'] = Executing;
    this.step_state['GET_PRICE'] = GET_PRICE;
    this.step_state['GET_NEWS'] = GET_NEWS;
    this.step_state['PROCESS_PRICE'] = PROCESS_PRICE;
    this.step_state['PROCESS_NEWS'] = PROCESS_NEWS;
    this.step_state['SIMPLIFY_NEWS'] = SIMPLIFY_NEWS;
    this.step_state['PROCESS_REFLET'] = PROCESS_REFLET;
    this.step_state['MAKE_TRADE'] = MAKE_TRADE;
  }

  public getState() {
    return JSON.stringify({
      Executing :this.step_state['Executing'],
      GET_PRICE :this.step_state['GET_PRICE'],
      GET_NEWS :this.step_state['GET_NEWS'],
      PROCESS_PRICE :this.step_state['PROCESS_PRICE'],
      SIMPLIFY_NEWS :this.step_state['SIMPLIFY_NEWS'],
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
          if (!this.customTimeSlot) {
            data[0] = data[0].substring(0, 10);
          }
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
          if (this.customTimeSlot) {
            res = await this.readLocalCsvFile("./data/local/binance/bitcoin_transaction_statistics.csv", "transaction", false);
          } else {
            res = await this.readLocalCsvFile("./data/local/bitcoin_transaction_statistics.csv", "transaction", false);
          }
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
        const data = fs.readFileSync(path, 'utf-8');
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
          let news_str = await this.readFileByAbsPath(path.join(dir, name));
          // news_str = [{id, url, title, content,...}, {}, ...]
          let raw_news_data:Article[] = JSON.parse(news_str);
          let format_news_data:Article[] = [];
          for(let i = 0; i < raw_news_data.length; i++){
            // Filter id, url, ...s
            // logger.error(`Parse Article:\n\ttitle: ${raw_news_data[i].title}\n\tdate:raw_news_data[i].time`)
            const article:Article = JSON.parse(JSON.stringify({
              title: raw_news_data[i].title, time:raw_news_data[i].time, content:raw_news_data[i].content
            }));
            format_news_data.push(article);
          }
          // name.split('.')[0] = 'yyyy-mm-dd
          this.news_data.push({ date:name.split('.')[0], data: structuredClone(format_news_data)});
        }
        this.offChainNewsLoaded = true;
        resolve('News data has been successfully loaded.');
      } 
      catch (error) {
        reject(error);
        throw new Error(error);
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
        let values:string;
        let path:string;
        if(local){
          if (this.customTimeSlot) {
            if(this.useTransactionData){
                const err = 'Error: CRYPT_CUSTOM_TIME_SLOT and CRYPT_USE_TRANSACTION can not be true at the same time.\nThe action of fetch current news data has not implemented yet.';
                reject(err);
                throw new Error(err);
            }
            if (!fs.existsSync("./data/local/binance/")) {
              fs.mkdirSync("./data/local/binance/");
            }
            await this.fetchOnChainDataFromBinance();
            path = "./data/local/binance/bitcoin_daily_price.csv";
          } else {
            path = "./data/local/bitcoin_daily_price.csv";
          }
          res = await this.readLocalCsvFile(path, 'price', true);
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
    let openPrices = this.price_data.map(d => d.value['open']);
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
      this.step_data['TOTAL_ROI'] = this.total_roi;
      this.step_data['TODAY_ROI'] = this.net_worth / this.last_net_worth - 1;
      this.last_net_worth = this.net_worth;
      console.error(`[CRYPTOTRADE]: ***** calculateROI end *****`);
      resolve(null);
    });
  }

  public executeTrade(): Promise<any>{
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

  public async simplifyNewsData(chain: string = 'btc', date:string = this.step_data['DATE']){
    /*
    There are 1~5 articles selected everyday,
    build prompt and simplify them with LLM in a loop.
    */
    let idx_news_set = this.news_data.findIndex(item => item.date === date);
    logger.error('API SERVICE getPromptOfSimplifyNewsData: [' + idx_news_set + ']\n');
    if(-1 != idx_news_set && this.news_data[idx_news_set].data.length > 0){
      const simp_tmp = `
You are a parsing agent for cryptocurrency news. Your goal is to extract and structure key factual information from each article so that it can be used as input by downstream generation agents.
Input includes:
- Title
- Time
- Full article text

Instructions:
- Do not write in full prose or natural language.
- Extract core information points in a structured, atomic way.
- Avoid summarizing style or commentary; focus only on facts.
- Output should be short, less than 500 words.
- Organize output in a consistent and machine-readable format (e.g., JSON or labeled bullet points).
- Include fields such as: main events, impact, involved entities (optional: sentiment, domain).

Output Format Example:
{
  "short_summary": "...",
  "impact": "...",
  "domain": "...",
  "sentiment": "neutral",
  "key_points": ["...", "..."],
}

Input article data:
` + delim;
      for (let i = 0; i < this.news_data[idx_news_set].data.length; i++){
        // this.news_data[idx_news_set].data = [{title, time, content}, {...}, ...]
        let simp_s = simp_tmp + JSON.stringify({
          title:this.news_data[idx_news_set].data[i].title,
          time:this.news_data[idx_news_set].data[i].time,
          content:this.news_data[idx_news_set].data[i].content
        });
        simp_s += delim;
        const resp = await this.tryToCallLLMsWithoutFormat(simp_s, false, false, /*maxTokens:*/200);
        this.news_data[idx_news_set].data[i].content_simplified = resp;
      }
      return 'simplifyNewsData done, data record to this.news_data[idx_news_set]';
    }else{
      return 'FAILED TO FETCH NEWS DATA';
    }
  }

  // YYYY-MM-DD-HH:mm:ss
  public parseDateToString(date:Date = new Date()){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
  }

  public getTimeBeforeHours(n: number, date:Date = new Date()): Date {
    date.setHours(date.getHours() - n);
    return date;
  }
  
  public getTimeSlotBeforeHours(n: number, date:Date = new Date()): Date {
    date = structuredClone(date);
    date.setHours(date.getHours() - n);
    return date;
  }

  public async fetchOnChainDataFromBinance(coin_symbol = 'BTCUSDT', /* hours: */slot: 1 | 4 | 23 = 4){
    return new Promise<string>(async (resolve, reject) => {
      if (fs.existsSync("./data/local/binance/bitcoin_daily_price.csv") || fs.existsSync("./data/local/binance/bitcoin_transaction_statistics.csv")) {
        logger.error("Data has fetched, skip");
        resolve("Data has fetched, skip");
      }
      // if current data == null
      const binanceService = this.runtime.getService(BinanceService.serviceType) as BinanceService;
      const requestCount = Number(24/slot);
      let timeSlot:Date[] = [];
      // push current time as elem[0]
      timeSlot.push(structuredClone(new Date()));
      logger.error(`Date now: \n${timeSlot[0]}`);
      for(let i = 1; i < requestCount; i++){
        let tmp = this.getTimeSlotBeforeHours(slot, timeSlot[i-1]);
        timeSlot.push(tmp);
      }

      // elem[0] = current price data
      const t_cTickerData:SymbolPrice|SymbolPrice[] = await binanceService.getTickerPrice(coin_symbol);
      const cTickerData:SymbolPrice = JSON.parse(JSON.stringify(t_cTickerData));
      const file_price = fs.openSync("./data/local/binance/bitcoin_daily_price.csv", "w");
      const file_transaction = fs.openSync("./data/local/binance/bitcoin_transaction_statistics.csv", "w");
      let tickerData;
      let parsedTickerData;
      let transactionRawWindowData = [];
      transactionRawWindowData.push({});

      logger.error(`Date now2 : \n${timeSlot[0]}`);
      fs.writeSync(file_price, `time,open\n${this.parseDateToString(timeSlot[0])},${cTickerData.price}\n`);
      fs.writeSync(file_transaction, `time,CEX,totalValueTransferred,priceChange,priceChangePercent,transactionsCount\n${this.parseDateToString(timeSlot[0])},Binance,NO_DATA,NO_DATA,NO_DATA,NO_DATA\n`);
            for (let i = 1; i < timeSlot.length; i++) {
        try {
          tickerData = await binanceService.getRollingWindowTicker(coin_symbol, i * slot);
          parsedTickerData = JSON.parse(JSON.stringify(tickerData));
        } catch (error) {
          reject(error);
        }
        const time = this.parseDateToString(timeSlot[i]);
        let tansactionWindowValues = {
          totalValueTransferred: parsedTickerData.quoteVolume,
          priceChange: parsedTickerData.priceChange,
          priceChangePercent: parsedTickerData.priceChangePercent,
          transactionsCount: parsedTickerData.count
        };
        let tansactionValues = {
          CEX: "Binance",
          totalValueTransferred: i > 1 ? Number(parsedTickerData.quoteVolume) - Number(transactionRawWindowData[i - 1].totalValueTransferred) : Number(parsedTickerData.quoteVolume),
          priceChange: i > 1 ? Number(parsedTickerData.priceChange) - Number(transactionRawWindowData[i - 1].priceChange) : Number(parsedTickerData.priceChange),
          priceChangePercent: i > 1 ? Number(parsedTickerData.priceChangePercent) - Number(transactionRawWindowData[i - 1].priceChangePercent) : Number(parsedTickerData.priceChangePercent),
          transactionsCount: i > 1 ? parsedTickerData.count - transactionRawWindowData[i - 1].transactionsCount : parsedTickerData.count
        };
        transactionRawWindowData.push(structuredClone(tansactionWindowValues));
        fs.writeSync(file_price, `${time},${parsedTickerData.openPrice}\n`);
        fs.writeSync(file_transaction, `${time},${tansactionValues.CEX},${tansactionValues.totalValueTransferred},${tansactionValues.priceChange},${tansactionValues.priceChangePercent},${tansactionValues.transactionsCount}\n`);
        await sleep(500);
      }
      fs.closeSync(file_price);
      fs.closeSync(file_transaction);
      logger.error(`transactionRawWindowData:\n${JSON.stringify(transactionRawWindowData)}\n`);
      // throw new Error("stop");
      resolve("OnChain data fetched from Binance.");
    });
  }

  public getPromptOfOnChainData(chain: string = 'BTC', date:string = '', windowSize:number = 5){
    let idx_price = this.price_data.findIndex((item: { key: string; }) => item.key === date);
    let price_s = "You are an " + chain + 
      "cryptocurrency trading analyst. The recent price and auxiliary information is given in chronological order below:" + delim;
    if(!this.useTransactionData){
      if(-1 != idx_price){
        let idx_price_start = idx_price - windowSize < 0 ? 0 : idx_price - windowSize;
        for(; idx_price_start <= idx_price; idx_price_start++){
          let data_str =  'Open price: ' + this.price_data[idx_price_start].value['open'];
          let macd:number = this.price_data[idx_price_start].value['macd']
          let macd_signal_line:number = this.price_data[idx_price_start].value['signalLine']
          let macd_signal = 'hold';
          if (macd < macd_signal_line){
            macd_signal = 'buy';
          }
          else if (macd > macd_signal_line){
            macd_signal = 'sell';
          }
          data_str += `, MACD Signal: ${macd_signal}`;
          data_str += ';\n';
          price_s += data_str;
        }
        // Open price: 17446.36027, day: 2023-01-11, unique_addresses: 1274205, total_transactions: 6726228, total_value_transferred: 250059124.5, average_fee: 0.00055232, total_size_used: 2.13E+11, coinbase_transactions: 405;
        price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
        return price_s;
      }
      return null;
    }
    let idx_transaction = this.transaction_data.findIndex(item => item.key === date);
    if(-1 != idx_price && -1 != idx_transaction){
      let idx_price_start = idx_price - windowSize < 0 ? 0 : idx_price - windowSize;
      let idx_transaction_start = idx_transaction - windowSize < 0 ? 0 : idx_transaction - windowSize;
      for(; (idx_price_start <= idx_price) && (idx_transaction_start <= idx_transaction); 
            idx_price_start++, idx_transaction_start++){
        let data_str =  'Open price: ' + this.price_data[idx_price_start].value['open'];
        let transaction_value_set = this.transaction_data[idx_transaction_start].value;
        let transaction_labels = Object.keys(transaction_value_set);
        for (const label of transaction_labels){
          data_str += `, ${label}: ${transaction_value_set[label]}`; 
        }
        let macd:number = this.price_data[idx_price_start].value['macd'];
        let macd_signal_line:number = this.price_data[idx_price_start].value['signalLine'];
        let macd_signal = 'hold';
        if (macd < macd_signal_line){
          macd_signal = 'buy';
        }
        else if (macd > macd_signal_line){
          macd_signal = 'sell';
        }
        data_str += `, MACD signal: ${macd_signal}`;
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

  public getPromptOfProcessNewsData(chain: string = 'btc', date:string = '2024-09-26', maxArticles:number = 3){
    let idx_news = this.news_data.findIndex(item => item.date === date);
    logger.error('API SERVICE getPromptOfNewsData: [' + idx_news + ']\n');
    if(-1 != idx_news && this.news_data[idx_news].data.length > 0){
      let news_s = '';
      if(this.enableNewsSimplification){
        if(!(this.news_data.length > 0)){
          throw new Error(`Error: The SIMPLIFIED_NEWS set on ${this.step_data['DATE']} is empty.`);
        }
        news_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. There are some articles about cryptocurrency today, and an analyst has completed the summary. You are required to analyze the following summary of these articles:` + delim;
        for(let i = 0; i < this.news_data[idx_news].data.length; i++){
          news_s += `{title:${this.news_data[idx_news].data[i].title}, time:${this.news_data[idx_news].data[i].time}, content:${this.news_data[idx_news].data[i].content_simplified}}\n`;
        }
        news_s += delim + `Write one concise paragraph to analyze the summary and estimate the market trend accordingly.`;
      }else{
        news_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. You are required to analyze the following news articles:` + delim;
        if(this.news_data[idx_news].data.length > maxArticles){
          for(let i = 0; i < maxArticles; i++){
            news_s += JSON.stringify(this.news_data[idx_news].data[i]);
          }
        }else{
          news_s += JSON.stringify(this.news_data[idx_news].data);
        }
        news_s += delim + `Write one concise paragraph to analyze the news and estimate the market trend accordingly.`;
      }
      return news_s;
    }else{
      throw new Error('FAILED TO FETCH NEWS DATA');
    }
  }

  public getPromptOfReflectHistory(chain: string = 'btc', windowSize:number = 5){
    const record_len = this.record.length;
    let reflect_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. Your analysis and action history is given in chronological order:` + delim;
    if(0 === record_len){
      reflect_s += 'There is not any analysis and action history yet.';
    }
    else{
      let idx_start = record_len - windowSize < 0 ? 0 : record_len - windowSize;
      for(; idx_start < record_len; idx_start++){
        const data_set = this.record[idx_start];
        let reflect_data = [];
        reflect_data.push({
          Step: data_set['STEP'],
          Date: data_set['DATE'],
          Reasoning: data_set['TRADE_REASON'],
          Action: data_set['TRADE_ACTION'],
          ActionValue: data_set['TRADE_ACTION_VALUE'],
          TotalReturn: data_set['TOTAL_ROI'],
          DailyReturn: data_set['TODAY_ROI'],
        });
        reflect_s += JSON.stringify(reflect_data) + '\n';
      }
    }
    reflect_s += delim + `Reflect on your recent performance and instruct your future trades from a high level, e.g., identify what information is currently more important, and what to be next, like aggresive or conversative. Write one concise paragraph to reflect on your recent trading performance with a focus on the effective strategies and information that led to the most successful outcomes, and the ineffective strategies and information that led to loss of profit. Identify key trends and indicators in the current cryptocurrency market that are likely to influence future trades. Also assess whether a more aggressive or conservative trading approach is warranted.`;
    return reflect_s;
  }

  public getPromptOfMakeTrade(chain: string = 'btc'){
    let trade_s = `You are an experienced ${chain.toUpperCase()} cryptocurrency trader and you are trying to maximize your overall profit by trading ${chain.toUpperCase()}. In each day, you will make an action to buy or sell ${chain.toUpperCase()}. You are assisted by a few analysts below and need to decide the final action.`
    trade_s += `\n\nON-CHAIN ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_ON_CHAIN']}${delim}\nNEWS ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_NEWS']}${delim}\nREFLECTION ANALYST REPORT:${delim}${this.step_data['ANALYSIS_REPORT_REFLECT']}${delim}\n`;
    trade_s += 'Now, start your response with your brief reasoning over the given reports. Then, based on the synthesized reports, conclude a clear market trend, emphasizing long-term strategies over short-term gains. Finally, indicate your trading action as a 1-decimal float in the range of [-1,1], reflecting your confidence in the market trend and your strategic decision to manage risk appropriately.'
    return trade_s;
  }

  public async tryToCallLLMsWithoutFormat(prompt: string, parseAction:boolean = false, debug = true, 
    maxTokens = 1000, temperature = 0.7, contextSize = 16384) : Promise<string>{
    return new Promise<string>( async (resolve, reject) => {
      let response = 'LLM HAS NOT RESPONSE';
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          if(debug){
            logger.warn('[CryptoTrader] tryToCallLLMsWithoutFormat *** prompt content ***\n', prompt);
          }
          response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: prompt,
            temperature: temperature,
            maxTokens: maxTokens,
            contextSize: contextSize
          });
          if(parseAction){
            this.step_data['TRADE_ACTION_VALUE'] = this.parseAction(response);
            if (-999 === this.step_data['TRADE_ACTION_VALUE']){
              continue;
            }
          }
          if(response && response.length > 25 && response.length < maxTokens * 4){
            break;
          }
        } catch (error) {
          // retry after seconds
          response = null;
        }
      }
      if(!response){
        this.abortAllTasks = true;
        reject('LLM_ERROR')
      }else{
        if(debug){
          logger.warn('[CryptoTrader] tryToCallLLMsWithoutFormat *** response ***\n', response);
        }
        // await sleep(1000);
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