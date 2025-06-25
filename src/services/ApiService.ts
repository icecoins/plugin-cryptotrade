import {
    type IAgentRuntime,
    logger,
    ModelType,
    Service} from "@elizaos/core";
import { rejects } from "assert";
import { time } from "console";
import * as fs from 'fs';
import path, { resolve } from "path";
import * as readline from 'readline';
import { LLM_retry_times } from "src/const/Const";
import { number } from "zod";

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
  public state:{} = {Executing:false, GET_PRICE:'UNDONE'};
  public data:{} = {STEP:0, STAGE:0};
  // public price_data = new Map<string, Record<string, any>>();
  public price_data = [];
  public transaction_data = [];
  public news_data = [];
  public record = {};
  public onChainDataLoaded = false;
  public offChainNewsLoaded = false;
  initState() {
    this.state['Executing'] = false;
    this.state['GET_PRICE'] = 'UNDONE';
    this.state['GET_NEWS'] = 'UNDONE';
    this.state['PROCESS_PRICE'] = 'UNDONE';
    this.state['PROCESS_NEWS'] = 'UNDONE';
    this.state['PROCESS_REFLET'] = 'UNDONE';
    this.state['MAKE_TRADE'] = 'UNDONE';
  }

  initData() {
    this.data['STEP'] = this.data['STEP'] + 1;
    this.data['STAGE'] = 0;
    this.data['PRICE'] = '';
    this.data['NEWS'] = '';
    this.data['ANALYSIS_PRICE'] = '';
    this.data['ANALYSIS_NEWS'] = '';
    this.data['REFLECT'] = '';
    this.data['TRADE'] = '';
  }

  public stepEnd(){
    this.record[this.data['STEP']] = {data: this.data, state: this.state};
    logger.error('STEP END, RECORD:\n', JSON.stringify(this.record[this.data['STEP']]))
    this.initData();
    this.initState();
  }

  public updateState(Executing: boolean, GET_PRICE: string, GET_NEWS: string, 
    PROCESS_PRICE: string, PROCESS_NEWS: string, PROCESS_REFLET: string, MAKE_TRADE: string) {
    this.state['Executing'] = Executing;
    this.state['GET_PRICE'] = GET_PRICE;
    this.state['GET_NEWS'] = GET_NEWS;
    this.state['PROCESS_PRICE'] = PROCESS_PRICE;
    this.state['PROCESS_NEWS'] = PROCESS_NEWS;
    this.state['PROCESS_REFLET'] = PROCESS_REFLET;
    this.state['MAKE_TRADE'] = MAKE_TRADE;
  }

  public getState() {
    return JSON.stringify({
      Executing :this.state['Executing'],
      GET_PRICE :this.state['GET_PRICE'],
      GET_NEWS :this.state['GET_NEWS'],
      PROCESS_PRICE :this.state['PROCESS_PRICE'],
      PROCESS_NEWS :this.state['PROCESS_NEWS'],
      PROCESS_REFLET :this.state['PROCESS_REFLET'],
      MAKE_TRADE :this.state['MAKE_TRADE']
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
          let values: Record<string, string> = {}; // day:xx, unique_addresses:xxx, ...
          for(let i = 0; i < labels.length; i++){
            values[labels[i]] = data[i];
          }
          switch (which_data) {
            case "price":
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
        resolve('Process End');
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async loadTransactionData(local: boolean = true): Promise<string>{
    return new Promise<string>(async (resolve, reject) =>{
      if(this.onChainDataLoaded){
        resolve('DATA HAS LOADED');
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
        resolve(true);
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
        resolve(true);
      } 
      catch (error) {
        reject(error);
      }
    });
  }
  public async loadPriceData(local: boolean = true) : Promise<any>{
    return new Promise<any>(async (resolve, reject)=>{
      if(this.onChainDataLoaded){
        resolve('DATA HAS LOADED');
      }else{
        logger.error('DATA: loadPriceData start');
      }
      let res = 'error';
      try {
        let values;
        if(local){
          // await this.readLocalPriceData('./data/local/bitcoin_daily_price.csv');
          res = await this.readLocalCsvFile('./data/local/bitcoin_daily_price.csv', 'price', true);
          logger.error('loadPriceData END');
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
  public async getPromptOfOnChainData(chain: string = 'BTC', date:string = '2024-09-26T00:00:00.000Z', windowSize:number = 5){
    let idx_price = this.price_data.findIndex(item => item.key === date);
    let idx_transaction = this.transaction_data.findIndex(item => item.key === date);
    // logger.error('API SERVICE getPromptOfOnChainData: [' + idx_price + '], [' + idx_transaction + ']\n');
    if(-1 != idx_price && -1 != idx_transaction){
      let idx_price_stop = idx_price + windowSize;
      let idx_transaction_stop = idx_transaction + windowSize;
      let price_s = "You are an " + chain + 
      "cryptocurrency trading analyst. The recent price and auxiliary information is given in chronological order below:" + delim;
      for(; idx_price < this.price_data.length, idx_price < idx_price_stop, 
            idx_transaction < this.transaction_data.length, idx_transaction < idx_transaction_stop; 
            idx_price++, idx_transaction++){
        let data = 
        'Open price: ' + this.price_data[idx_price].value['open'];
        for (const value of Object.values(this.transaction_data[idx_transaction])) {
          let labels = Object.keys(value);
          for (const label of labels){
            data += `, ${label}: ${value[label]}`; 
          }
        }
        data += ';\n';
        price_s += data;
      }
      price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
      // logger.error('API SERVICE getPromptOfOnChainData: \n' + price_s);
      return price_s;
    }else{
      return null;
    }
  }
  public async getPromptOfNewsData(chain: string = 'btc', date:string = '2024-09-26T00:00:00.000Z'){
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
  public async tryToCallLLMsWithoutFormat(prompt: string, runtime: IAgentRuntime) : Promise<any>{
    return new Promise<any>(async (resolve, reject) => {
      let response = null;
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          // logger.warn('[CryptoTrader] *** prompt content ***\n', prompt);
          response = await runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: prompt,
          });

          // Attempt to parse the XML response
          logger.warn('[CryptoTrader] *** response ***\n', response);
          // const parsedXml = parseKeyValueXml(response);
          // const parsedJson = parseJSONObjectFromText(response);
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

  public async tryToCallLLMsWithoutFormatWithoutRuntime(prompt: string) : Promise<string>{
    return new Promise<string>( async (resolve, reject) => {
      let response = 'LLM HAS NOT RESPONSE';
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          // logger.warn('[CryptoTrader] *** prompt content ***\n', prompt);
          response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: prompt,
          });

          // Attempt to parse the XML response
          logger.warn('[CryptoTrader] *** response ***\n', response);
          // const parsedXml = parseKeyValueXml(response);
          // const parsedJson = parseJSONObjectFromText(response);
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

  public async tryToCallLLM(prompt: string, runtime: IAgentRuntime) : Promise<any>{
    return new Promise<any>( async (resolve, reject) => {
      let parsedJson;
      for(var i = 0; i < LLM_retry_times; i++){
        try {
          // logger.warn('[CryptoTrader] *** prompt content ***\n', prompt);
          const response = await runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: prompt,
          });

          // Attempt to parse the XML response
          logger.warn('[CryptoTrader] *** response ***\n', response);
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


