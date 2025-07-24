import {
    type IAgentRuntime,
    logger,
    ModelType,
    Service} from "@elizaos/core";
import * as fs from 'fs';
import { bear_ending_date, bear_starting_date, bull_ending_date, bull_starting_date, delim, ending_date, EX_RATE, GAS_FEE, LLM_retry_times, sideways_ending_date, sideways_starting_date, STARTING_CASH_RATIO, starting_date, STARTING_NET_WORTH } from "../const/Const";
import { PrinceAnalyzeService } from "./PrinceAnalyzeService";
import { LocalNewsAnalyseService as LocalNewsAnalyseService } from "./LocalNewsAnalyseService";

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export type PriceDataSource = 'Local'|'Binance'|'CoinBase';
export type NewsDataSource = 'Local'|'CryptoNews'|'Reddit';

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
    
    service.priceService = runtime.getService(PrinceAnalyzeService.serviceType) as PrinceAnalyzeService;
    service.newsService = runtime.getService(LocalNewsAnalyseService.serviceType) as LocalNewsAnalyseService;
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
    
  public step_state?:{
    Executing:boolean; 
    GET_PRICE:string;
    GET_NEWS:string;
    PROCESS_PRICE:string;
    PROCESS_NEWS:string;
    SIMPLIFY_NEWS:string;
    PROCESS_REFLET:string;
    MAKE_TRADE:string;
  };

  public step_data?:{
    STEP:number;
    DATE:string;
    ANALYSIS_REPORT_ON_CHAIN:string;
    ANALYSIS_REPORT_NEWS:string;
    ANALYSIS_REPORT_REFLECT:string;
    TRADE_REASON:string;
    TRADE_ACTION:string;
    TRADE_ACTION_VALUE:number;
    TODAY_ROI:number;
    TOTAL_ROI:number;
    SIMPLIFIED_NEWS:string[];
  };
  
  public is_action_executing?:{
    GET_PRICE:boolean;
    GET_NEWS:boolean;
    PROCESS_PRICE:boolean;
    PROCESS_NEWS:boolean;
    SIMPLIFY_NEWS:boolean;
    PROCESS_REFLECT:boolean;
    MAKE_TRADE:boolean;
  };

  public record:any[] = [];
  public abortAllTasks = false;

  public project_initialized:boolean = false;

  public cash:number|undefined;
  public coin_held:number|undefined;
  public starting_net_worth:number|undefined;
  public net_worth:number|undefined;
  public total_roi:number|undefined;
  public last_net_worth:number|undefined;
  public starting_price:number|undefined;

  public start_day:string|undefined;
  public end_day:string|undefined;
  public today_idx:number = -1;
  public end_day_idx:number|undefined;

  public CRYPT_STARTING_DAY:string|undefined;
  public CRYPT_ENDING_DAY:string|undefined;
  public CRYPT_STAGE:string|undefined;
  public CRYPT_ENABLE_NEWS_ANALYZE = true;
  public CRYPT_ENABLE_NEWS_SIMPLIFICATION = false;
  public CRYPT_ENABLE_TRANSACTION_DATA = false;
  public CRYPT_CALLBACK_IN_ACTIONS = true;
  public CRYPT_CUSTOM_DATE_INTERVAL = false;

  public dumpRecordPath:string|undefined;

  private priceService:PrinceAnalyzeService|undefined;
  private newsService:LocalNewsAnalyseService|undefined;
  
  public priceDataSource:PriceDataSource = 'Local';
  public newsDataSource:NewsDataSource = 'Local';
  
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
        this.CRYPT_CUSTOM_DATE_INTERVAL = true;
      }else{
        this.CRYPT_CUSTOM_DATE_INTERVAL = false;
      }
    }
    if(process.env.CRYPT_CALLBACK_IN_ACTIONS){
      if(process.env.CRYPT_CALLBACK_IN_ACTIONS === 'true'){
        this.CRYPT_CALLBACK_IN_ACTIONS = true;
      }else{
        this.CRYPT_CALLBACK_IN_ACTIONS = false;
      }
    }
    if(process.env.CRYPT_ENABLE_NEWS_ANALYZE){
      if(process.env.CRYPT_ENABLE_NEWS_ANALYZE === 'true'){
        this.CRYPT_ENABLE_NEWS_ANALYZE = true;
      }else{
        this.CRYPT_ENABLE_NEWS_ANALYZE = false;
      }
    }
    if(process.env.CRYPT_ENABLE_NEWS_SIMPLIFICATION){
      if(process.env.CRYPT_ENABLE_NEWS_SIMPLIFICATION === 'true'){
        this.CRYPT_ENABLE_NEWS_SIMPLIFICATION = true;
      }else{
        this.CRYPT_ENABLE_NEWS_SIMPLIFICATION = false;
      }
    }
    if(process.env.CRYPT_USE_TRANSACTION){
      if(process.env.CRYPT_USE_TRANSACTION === 'true'){
        this.CRYPT_ENABLE_TRANSACTION_DATA = true;
      }else{
        this.CRYPT_ENABLE_TRANSACTION_DATA = false;
      }
    }
    logger.error(`Config init done:\nthis.CRYPT_STARTING_DAY: ${this.CRYPT_STARTING_DAY}\nthis.CRYPT_STAGE: ${this.CRYPT_STAGE}\nthis.callbackInActions: ${this.CRYPT_CALLBACK_IN_ACTIONS}\nthis.enableNewsSimplification: ${this.CRYPT_ENABLE_NEWS_SIMPLIFICATION}`);
  }

  initProject(){
    // project parms should be initialized as soon as the data is loaded
    if(!this.today_idx || !this.end_day_idx){
      if(this.CRYPT_CUSTOM_DATE_INTERVAL){
            this.today_idx = this.priceService!.price_data.length - 2;
            this.end_day_idx = this.priceService!.price_data.length;
            this.start_day = this.priceService!.price_data[this.today_idx].key;
            this.end_day = this.priceService!.price_data[this.end_day_idx].key;
      }else{
          if(this.CRYPT_STAGE){
              switch(this.CRYPT_STAGE){
                  case 'bull':
                      this.start_day = bull_starting_date;
                      this.end_day = bull_ending_date;
                      break;
                  case 'bear':
                      this.start_day = bear_starting_date;
                      this.end_day = bear_ending_date;
                      break;
                  case 'sideways':
                      this.start_day = sideways_starting_date;
                      this.end_day = sideways_ending_date;
                      break;
              }
          }else{
              this.start_day = starting_date;
              this.end_day = ending_date;
          }
          this.today_idx = this.priceService!.price_data.findIndex(d => d.key === this.start_day);
          this.end_day_idx = this.priceService!.price_data.findIndex(d => d.key === this.end_day);
      }
    } 
    this.starting_price = this.priceService!.price_data[this.today_idx].value['open'];
    this.starting_net_worth = STARTING_NET_WORTH;
    this.cash = this.starting_net_worth * STARTING_CASH_RATIO;
    this.coin_held = (this.starting_net_worth - this.cash) / this.starting_price!;
    this.last_net_worth = this.starting_net_worth;
    this.project_initialized = true;
    this.dumpRecordPath = `./data/local/record/${this.start_day}-${this.end_day}.json`;
  }

  initState() {
    // state will restore at the beginning of every step
    this.step_state = structuredClone({
      Executing:false,
      GET_PRICE:'UNDONE',
      GET_NEWS:'UNDONE',
      PROCESS_PRICE:'UNDONE',
      PROCESS_NEWS:'UNDONE',
      SIMPLIFY_NEWS:'UNDONE',
      PROCESS_REFLET:'UNDONE',
      MAKE_TRADE:'UNDONE',
    });

    this.is_action_executing = structuredClone({
      GET_PRICE:false,
      GET_NEWS:false,
      PROCESS_PRICE:false,
      PROCESS_NEWS:false,
      SIMPLIFY_NEWS:false,
      PROCESS_REFLECT:false,
      MAKE_TRADE:false,
    });
  }

  initData() {
    // data will restore at the beginning of every step
    this.step_data = structuredClone({
      STEP: this.step_data?.STEP?this.step_data.STEP + 1 : 0,
      DATE: '',
      ANALYSIS_REPORT_ON_CHAIN: '',
      ANALYSIS_REPORT_NEWS: '',
      ANALYSIS_REPORT_REFLECT: '',
      TRADE_REASON: '',
      TRADE_ACTION: '',
      TRADE_ACTION_VALUE: 0,
      TODAY_ROI: 0,
      TOTAL_ROI: 0,
      SIMPLIFIED_NEWS: []
    });
  }

  public stepEnd(){
    const data = structuredClone(this.step_data!)
    this.record.push(data);
    this.initData();
    this.initState();
  }

  public appendRecord(){
    fs.appendFileSync(this.dumpRecordPath!, JSON.stringify(this.record[this.record.length-1]) + ',\n');
  }

  public getState() {
    return JSON.stringify({
      Executing :this.step_state!['Executing'],
      GET_PRICE :this.step_state!['GET_PRICE'],
      GET_NEWS :this.step_state!['GET_NEWS'],
      PROCESS_PRICE :this.step_state!['PROCESS_PRICE'],
      SIMPLIFY_NEWS :this.step_state!['SIMPLIFY_NEWS'],
      PROCESS_NEWS :this.step_state!['PROCESS_NEWS'],
      PROCESS_REFLET :this.step_state!['PROCESS_REFLET'],
      MAKE_TRADE :this.step_state!['MAKE_TRADE']
    })
  }

  public async loadPriceData(){
    return new Promise(async (resolve, reject) => {
      try {
        let resp = 'Error';
        switch(this.priceDataSource){
          case "Local":
            resp = await this.priceService!.loadPriceDataFromFile();
            break;
          case "Binance":
            await this.priceService!.initOnChainDataFromBinance('daily', 'BTCUSDT', '1h', false);
            resp = await this.priceService!.retrieveOnChainDataFromBinance('BTCUSDT', '1h', true);
            break;
          case "CoinBase":
            throw new Error(`loadPriceData from CoinBase not implemented.`);
            break;
        }
        resolve(resp);
      } 
      catch (error) {
        reject(error);
      }
    });
  }

  public async loadTransactionData(){
    return new Promise(async (resolve, reject) => {
      try {
        let resp = 'Error';
        switch(this.priceDataSource){
          case "Local":
            resp = await this.priceService!.loadTransactionData();
            break;
          case "Binance":
            throw new Error(`loadTransactionData from Binance not implemented.`);
            break;
          case "CoinBase":
            throw new Error(`loadTransactionData from CoinBase not implemented.`);
            break;
        }
        resolve(resp);
      } 
      catch (error) {
        reject(error);
      }
    });
  }

  public async loadNewsData(){
    return new Promise(async (resolve, reject) => {
      try {
        let resp = 'Error';
        switch(this.newsDataSource){
          case "Local":
            resp = await this.newsService!.loadNewsDataFromFile();
            break;
          case "CryptoNews":
            throw new Error(`loadNewsData from CryptoNews not implemented.`);
            break;
          case "Reddit":
            throw new Error(`loadNewsData from Reddit not implemented.`);
            break;
        }
        resolve(resp);
      } 
      catch (error) {
        reject(error);
      }
    });
  }

  public async readFileByAbsPath(path:string): Promise<string> {
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

  public setPriceDataSource(source:PriceDataSource){
    this.priceDataSource = source;
  }

  public setNewsDataSource(source:NewsDataSource){
    this.newsDataSource = source;
  }

  public getTodayString(){
    return this.priceService!.price_data[this.today_idx].key;
  }

  public getTodayOpenPrice(){
    return this.priceService!.price_data[this.today_idx].value['open'];
  }

  public calculateROI(): Promise<any>{
    return new Promise<any>((resolve, rejects) => {
      //Return On Investment
      // console.error(`[CRYPTOTRADE]: ***** calculateROI start *****`);
      let next_open_price = this.priceService!.getNextOpenPriceByDateIdx(this.today_idx);
      this.net_worth = this.cash! + this.coin_held! * next_open_price;
      this.total_roi = this.net_worth / this.starting_net_worth! - 1;
      this.step_data!['TOTAL_ROI'] = this.total_roi;
      this.step_data!['TODAY_ROI'] = this.net_worth / this.last_net_worth! - 1;
      this.last_net_worth = this.net_worth;
      console.error(`[CRYPTOTRADE]: ***** calculateROI end *****`);
      resolve(null);
    });
  }

  public executeTrade(): Promise<any>{
    return new Promise<any>((resolve, rejects) => {
      // console.error(`[CRYPTOTRADE]: ***** executeTrade start *****`);
      this.step_data!['TRADE_ACTION'] = 'hold';
      let action_val = this.step_data!['TRADE_ACTION_VALUE'];
      let open_price = this.priceService!.price_data[this.today_idx].value['open']
      if (-1 <= action_val && action_val < 0 && this.coin_held! > 0){
        this.step_data!['TRADE_ACTION'] = 'sell';
        let eth_diff = Math.abs(action_val) * this.coin_held!;
        let cash_diff = eth_diff * open_price;
        this.coin_held! -= eth_diff;
        this.cash! += cash_diff;
        this.cash! -= GAS_FEE * open_price + cash_diff * EX_RATE;
      }
      else if (0 < action_val && action_val <= 1 && this.cash! > 0){
        this.step_data!['TRADE_ACTION'] = 'buy';
        let cash_diff = Math.abs(action_val) * this.cash!;
        let eth_diff = cash_diff / open_price;
        this.cash! -= cash_diff;
        this.coin_held! += eth_diff;
        this.cash! -= GAS_FEE * open_price + cash_diff * EX_RATE;
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
        let reflect_data:any = [];
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

    trade_s += `\n\nON-CHAIN ANALYST REPORT:${delim}${this.step_data!['ANALYSIS_REPORT_ON_CHAIN']}${delim}\n`;

    if(this.CRYPT_ENABLE_NEWS_ANALYZE){
      trade_s += `NEWS ANALYST REPORT:${delim}${this.step_data!['ANALYSIS_REPORT_NEWS']}${delim}\n`;
    }

    trade_s += `REFLECTION ANALYST REPORT:${delim}${this.step_data!['ANALYSIS_REPORT_REFLECT']}${delim}\n`;

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
            this.step_data!['TRADE_ACTION_VALUE'] = this.parseAction(response);
            if (-999 === this.step_data!['TRADE_ACTION_VALUE']){
              continue;
            }
          }
          if(response && response.length > 25 && response.length < maxTokens * 4){
            break;
          }
        } catch (error) {
          // retry after seconds
          response = '';
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

  public generateActions(args:string[]): string[]{
    let actions:string[] = [];
    if(args![1] === '1' || args![1] === 'true'){
      actions = ["GET_PRICE", "GET_NEWS", "PROCESS_PRICE"];
      if(this.CRYPT_ENABLE_NEWS_SIMPLIFICATION){
        actions.push('SUMMARIZE_NEWS');
      }
      actions = actions.concat(["PROCESS_NEWS", "PROCESS_REFLECT", "MAKE_TRADE"]);
    }else if(args![2] === '1' || args![2] === 'true'){
      actions = ["CALL_BINANCE_API"];
    }
    return actions;
  }

}