import {
    type IAgentRuntime,
    logger,
    Service} from "@elizaos/core";
import * as fs from 'fs';
import * as readline from 'readline';

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
  public record = {};
  public dataLoaded = false;
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
  async readLocalCsvFile(filePath: string, which_data:string, reverse: boolean = false): Promise<string>{
    try {  
      let fileStream = fs.createReadStream(filePath);
      let firstLine = true;
      let labels = [];
      let rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      rl.on('line', (line) => {
        // day,unique_addresses,total_transactions,total_value_transferred,average_fee,total_size_used,coinbase_transactions
        // 0        1            2                   3                       4            5             6   
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
              logger.error("transaction_data.push: [" + this.transaction_data[this.transaction_data.length-1].key + 
                              '] ,[' + this.transaction_data[this.transaction_data.length-1].value['total_transactions'] + ']\n');
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
        // reverse the price data 
        // const reversed = new Map(Array.from(this.price_data.entries()).reverse());
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
        return 'Process End';
      });
    } catch (error) {
      logger.error('File Error: ', error)
      return 'Process File Error';
    }
    return;
  };
  public async loadTransactionData(local: boolean = true): Promise<string>{
    if(this.dataLoaded){
      return;
    }
    let res = 'error';
    try {
      let values = {};
      if(local){
        res = await this.readLocalCsvFile('./data/local/bitcoin_transaction_statistics.csv', 'transaction', false)
      }else{
        values = await fetchFileFromWeb();
      }
    } catch (error) {
      console.error('loadPriceData error: ', error);
    }
    return res;
  }
  public async loadPriceData(local: boolean = true) : Promise<string>{
    if(this.dataLoaded){
      return;
    }
    let res = 'error';
    try {
      let values;
      if(local){
        // await this.readLocalPriceData('./data/local/bitcoin_daily_price.csv');
        res = await this.readLocalCsvFile('./data/local/bitcoin_daily_price.csv', 'price', true)
      }else{
        values = await fetchFileFromWeb();
      }
    } catch (error) {
      console.error('loadPriceData error: ', error);
    }
    return res;
  }
  public async waitForData(): Promise<void>{
    while(!this.dataLoaded){
    }
  }
  public async getPromptOfOnChainData(chain: string = 'BTC', date:string = '2024-09-26T00:00:00.000Z', windowSize:number = 5){
    await this.waitForData();
    let idx_price = this.price_data.findIndex(item => item.key === date);
    let idx_transaction = this.transaction_data.findIndex(item => item.key === date);
    logger.error('API SERVICE getPromptOfOnChainData: [' + idx_price + '], [' + idx_transaction + ']\n');
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
        for (const [key, value] of Object.entries(this.transaction_data[idx_transaction])) {
          data += `, ${key}: ${value}`
        }
        data += '\n';
        price_s += data;
      }
      price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
      logger.error('API SERVICE getPromptOfOnChainData: \n' + price_s);
      return price_s;
    }else{
      return null;
    }
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


