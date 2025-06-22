import {
    type IAgentRuntime,
    logger,
    Service,
    State
} from "@elizaos/core";
import { read } from "fs";

import fs_promises from 'fs/promises';
import * as fs from 'fs';
import * as readline from 'readline';
import { e } from "node_modules/@elizaos/core/dist/index-S6eSMHDH";


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


export class ApiService extends Service {
  static serviceType = 'apiservice';
  capabilityDescription =
    'This is a api service which is attached to the agent through the cryptotrade plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }
  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting api service - MODIFIED: ${new Date().toISOString()} ***`);
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
  public price_data:{} = {};
  public record:{} = {};

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
  public addPriceData(data: any){
    this.price_data[data.date] = data;
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

  async readLocalData(filePath: string){
    try {  
      let fileStream = fs.createReadStream(filePath);
      let rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      rl.on('line', (line) => {
        if(line.startsWith('202')){
          let data = line.split(',')
          // TimeOpen,TimeClose,TimeHigh,TimeLow,Name,Open,High,Low,Close,Volume,MarketCap,Timestamp
          // 0        1         2        3       4    5     6   7   8     9      10        11
          this.price_data[data[0]] = {
            TimeOpen:data[0], TimeClose:data[1], 
            TimeHigh:data[2], TimeLow:data[3],
            Name:data[4], Open:data[5], 
            High:data[6], CloseLow:data[7], 
            Volume:data[8], MarketCap:data[9], 
            Timestamp:data[10]
          }
        }else{
          console.log(line);
        }
      });
      rl.on('close', () => {
        console.log('Process End');
      });
    } catch (error) {
      console.error('File Error: ', error)
    }
  };
  
  public async loadPriceData(local: boolean = true){
    try {
      let values;
      if(local){
        await this.readLocalData('./data/local/bitcoin_daily_price.csv');
      }else{
        values = await fetchFileFromWeb();
      }
    } catch (error) {
      console.error('loadPriceData error: ', error);
    }
  }

  public async getPromptOfPrice(chain: string = 'BTC', date = '2024-09-26T00:00:00.000Z', windowSize = 5){
    let price_s = "You are an " + chain + "cryptocurrency trading analyst. The recent price and auxiliary information is given in chronological order below:" + delim;

    /*
    for i, item in enumerate(self._history[-price_window * 3:]):
      if item['label'] == 'state':
          state = item['value']
          state_log = f'Open price: {state["open"]:.2f}'
          if use_txnstat:
              txnstat_dict = state['txnstat']
              for k, v in txnstat_dict.items():
                  state_log += f', {k}: {v}'
          if use_tech:
              tech_dict = state['technical']
              for k, v in tech_dict.items():
                  state_log += f', {k}: {v}'
          price_s += state_log + '\n'
    */
   
    price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
  }
}


export async function fetchFileFromWeb() {
  try {
    const response = await fetch('https://domain.com/file.csv'); // 或者任何支持返回text()的URL，如JSON API等。 
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


