import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { ApiService, sleep } from "./ApiService";
import { LocalNewsAnalyseService } from "./LocalNewsAnalyseService";
import { writeFile, mkdir } from 'fs/promises';
import path, { resolve } from "path";
import * as readline from 'readline';
import * as fs from 'fs';
import { KlineInterval, SymbolPrice } from "binance";
import { exec } from "child_process";
import { promisify } from "util";
import { transaction_path, price_path, delim, data_dir_binance } from "../const/Const";
import { BinanceService } from "./BinanceService";

export class PrinceAnalyzeService extends Service {
  static serviceType = 'PrinceAnalyzeService';
  private apiService:ApiService;

  capabilityDescription =
    'This is PrinceAnalyzeService which is attached to the agent through the cryptotrade plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.apiService = runtime.getService(ApiService.serviceType) as ApiService;
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting PrinceAnalyzeService service -- : ${new Date().toISOString()} ***`);
    const service = new PrinceAnalyzeService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
    // get the service from the runtime
    const service = runtime.getService(LocalNewsAnalyseService.serviceType);
    if (!service) {
      throw new Error('LocalNewsAnalyseService not found');
    }
    service.stop();
  }
  
  async stop() {
    logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
  }

  public price_data:any[] = [];
  public transaction_data:any[] = [];
  public onChainDataLoaded = false;

  async readLocalCsvFile(filePath: string, which_data:string, reverse: boolean = false): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      let firstLine = true;
      let labels:string[] = [];
      rl.on('line', (line) => {
        if(!firstLine){
          let data = line.split(','); // ...,2781,42569.7614,43243.16818,41879.18999,...
          if (!this.apiService.CRYPT_CUSTOM_DATE_INTERVAL) {
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


  public async loadTransactionDataFromBinance(local: boolean = true): Promise<string>{
    return new Promise<string>(async (resolve, reject) =>{
      // TODO
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
          if (this.apiService.CRYPT_CUSTOM_DATE_INTERVAL) {
            res = await this.readLocalCsvFile(transaction_path, "transaction", true);
          } else {
            res = await this.readLocalCsvFile("./data/local/bitcoin_transaction_statistics.csv", "transaction", false);
          }
          logger.error('loadTransactionData END');
        }else{
          // values = await fetchFileFromWeb();
        }
      } catch (error) {
        logger.error('loadPriceData error: ', error);
        reject(error);
      }
      this.onChainDataLoaded = true;
      resolve(res);
    });
  }

  ewma(data: number[], span: number): number[] {
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

  public async loadPriceDataFromFile(chain:string = 'btc', force:boolean = false, local: boolean = true) : Promise<any>{
      return new Promise<any>(async (resolve, reject)=>{
        if(!force && this.onChainDataLoaded){
          resolve('PRICE DATA HAS LOADED, SKIP');
        }else{
          logger.error('DATA: loadPriceData start');
        }
        let res = 'error';
        try {
          let data_path:string;
          if(local){
            if (this.apiService.CRYPT_CUSTOM_DATE_INTERVAL) {
              if (!fs.existsSync(data_dir_binance)) {
                fs.mkdirSync(data_dir_binance);
              }
              data_path = price_path;
            } else {
              data_path = "./data/local/bitcoin_daily_price.csv";
            }
            res = await this.readLocalCsvFile(data_path, 'price', true);
            logger.error('loadPriceData END');
            let result = this.calculateMACD();
            for (let i=0; i<this.price_data.length; i++){
                this.price_data[i].value['ema12'] = result.ema12[i];
                this.price_data[i].value['ema26'] = result.ema26[i];
                this.price_data[i].value['macd'] = result.macd[i];
                this.price_data[i].value['signalLine'] = result.signalLine[i];
            }
            logger.error('MACD DATA CALC END');
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
      const ema12 = this.ewma(openPrices, 12);
      const ema26 = this.ewma(openPrices, 26);
  
      const macd = ema12.map((val, idx) => val - ema26[idx]);
      // logger.error('calculateMACD macd: ', macd);
      const signalLine = this.ewma(macd, 9);
  
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
  
  public getPromptOfOnChainData(chain: string = 'BTC', date:string = '', windowSize:number = 5): string{
    let idx_price = this.price_data.findIndex((item: { key: string; }) => item.key === date);
    let price_s = "You are an " + chain + 
      "cryptocurrency trading analyst. The recent price and auxiliary information is given in chronological order below:" + delim;
    if(!this.apiService.CRYPT_ENABLE_TRANSACTION_DATA){
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
        price_s += delim + 'Write one concise paragraph to analyze the recent information and estimate the market trend accordingly.'
        return price_s;
      }
      throw new Error(`Data not found, date: ${this.apiService.step_data!['DATE']}`);
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
      throw new Error(`Data not found, date: ${this.apiService.step_data!['DATE']}`);
      // return null;
    }
  }

  // YYYY-MM-DD-HH:mm:ss
  public parseDateToString(date:Date = new Date(), accuracy:'full'|'month'|'day'|'hour'|'minute' = 'full'){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    if(accuracy === 'full'){
      return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
    }
    if(accuracy === 'month'){
      return `${year}-${month}`;
    }
    if(accuracy === 'day'){
      return `${year}-${month}-${day}`;
    }
    if(accuracy === 'hour'){
      return `${year}-${month}-${day}-${hours}`;
    }
    if(accuracy === 'minute'){
      return `${year}-${month}-${day}-${hours}:${minutes}`;
    }
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

  async downloadZip(url: string, destination: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(destination, buffer);
    // logger.log(`Downloaded zip to ${destination}`);
  }

  async unzipWithSystem(zipFilePath: string, outputDir: string) {
    const command = `unzip -o "${zipFilePath}" -d "${outputDir}"`;
    logger.warn(`🧩 Running: ${command}`);
    const execAsync = promisify(exec);
    await execAsync(command);
    logger.warn(`✅ Unzipped to ${outputDir}`);
  }

  public async initOnChainDataFromBinance(range:'daily'|'monthly' = 'daily', symbol = 'BTCUSDT', interval:KlineInterval = '1h', force = false){
    // https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2025-06.zip
    // https://data.binance.vision/data/spot/daily/klines/BTCUSDT/15m/BTCUSDT-15m-2025-07-14.zip
    let date = new Date();
    let stop_today = new Date();
    stop_today.setDate(stop_today.getDate() - 7);
    date.setMonth(stop_today.getMonth() - 1);
    while(date.getTime() != stop_today.getTime()){
      // 2025-07-14
      const reqDate = this.parseDateToString(date, 'day');

      // spot/daily/klines/BTCUSDT/15m
      const info = `spot/${range}/klines/${symbol}/${interval}`;
      // BTCUSDT-1h-2025-06-11.zip
      const zipFileName = `${symbol}-${interval}-${reqDate}.zip`;
      // ./data/local/binance/zip/spot/daily/klines/BTCUSDT/15m
      const outputDir = `${data_dir_binance}zip/${info}`;
      if(!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, {recursive: true});
      }
      // https://data.binance.vision/data/spot/daily/klines/BTCUSDT/15m/BTCUSDT-15m-2025-07-12.zip
      const url = `https://data.binance.vision/data/${info}/${zipFileName}`;

      const zipFilePath = `${outputDir}/${zipFileName}`;

      const unzipDir = `${data_dir_binance}${info}`;
      if(!fs.existsSync(unzipDir)){
        fs.mkdirSync(unzipDir, {recursive: true});
      }
      if(!fs.existsSync(zipFilePath)){
        try{
          await this.downloadZip(url, zipFilePath);
          await this.unzipWithSystem(zipFilePath, unzipDir);
        }catch(error){
          throw new Error('Error: ' + error);
        }
      }
      date.setDate(date.getDate() + 1);
    }
  }

  public async retrieveOnChainDataFromBinance(coin_symbol = 'BTCUSDT', interval:KlineInterval = '4h', forceDelet:boolean = false){
    return new Promise<string>(async (resolve, reject) => {
      if(forceDelet){
        fs.rmSync(price_path);
        fs.rmSync(transaction_path);
      }
      if (fs.existsSync(price_path) || fs.existsSync(transaction_path)) {
        logger.error("Data has fetched, skip");
        resolve("Data has fetched, skip");
        return;
      }
      // if current data == null
      const binanceService = this.runtime.getService(BinanceService.serviceType) as BinanceService;
      // elem[0] = current price data
      const t_cTickerData:SymbolPrice|SymbolPrice[] = await binanceService.getTickerPrice(coin_symbol);
      const cTickerData:SymbolPrice = JSON.parse(JSON.stringify(t_cTickerData));

      const file_price = fs.openSync(price_path, "w");
      const file_transaction = fs.openSync(transaction_path, "w");

      let start_time = new Date();
      start_time.setDate(start_time.getDate() - 1);
      try{
        let klinesData = await binanceService.getTransactionDataWithKlines(coin_symbol, start_time, new Date(), interval);
        fs.writeSync(file_price, `time,openPrice\n${this.parseDateToString(start_time)},${cTickerData.price}\n`);
        fs.writeSync(file_transaction, `time,CEX,interval,openPrice,closePrice,quoteVolume,transactionCount\n${this.parseDateToString(start_time)},Binance,${interval},NO_DATA,NO_DATA,NO_DATA,NO_DATA\n`);
        for(let i = 0; i < klinesData.length; i++){
          const kData = klinesData[i];
          let parsedKlineData = {
            openTime: kData[0],
            CEX: 'Binance',
            openPrice: kData[1],
            highPrice: kData[2],
            lowPrice: kData[3],
            closePrice: kData[4],
            volume: kData[5],
            closeTime: kData[6],
            quoteVolume: kData[7],
            transactionCount: kData[8],
            volumeBuy: kData[9],
            quoteVolumeBuy: kData[10],
            ignore: kData[11]
          };
          const openTime_str = this.parseDateToString(new Date(parsedKlineData.openTime));
          fs.writeSync(file_price, `${openTime_str},${parsedKlineData.openPrice}\n`);
          fs.writeSync(file_transaction, `${openTime_str},Binance,${interval},${parsedKlineData.openPrice},${parsedKlineData.closePrice},${parsedKlineData.quoteVolume},${parsedKlineData.transactionCount}\n`);
        }
        fs.closeSync(file_price);
        fs.closeSync(file_transaction);
        resolve("OnChain data fetched from Binance.");
      }catch(error){
        reject(error);
      }
    });
  }

  public async retrieveOnChainDataFromBinanceWithRollingWindow(coin_symbol = 'BTCUSDT', /* hours: */slot: 1 | 4 | 23 = 4){
    return new Promise<string>(async (resolve, reject) => {
      if (fs.existsSync(price_path) || fs.existsSync(transaction_path)) {
        logger.error("Data has fetched, skip");
        resolve("Data has fetched, skip");
        return;
      }
      // if current data == null
      const binanceService = this.runtime.getService(BinanceService.serviceType) as BinanceService;
      const requestCount = Number(24/slot);
      let timeSlot:Date[] = [];
      // push current time as elem[0]
      timeSlot.push(structuredClone(new Date()));
      // logger.error(`Date now: \n${timeSlot[0]}`);
      
      for(let i = 1; i < requestCount; i++){
        let tmp = this.getTimeSlotBeforeHours(slot, timeSlot[i-1]);
        timeSlot.push(tmp);
      }

      // elem[0] = current price data
      const t_cTickerData:SymbolPrice|SymbolPrice[] = await binanceService.getTickerPrice(coin_symbol);
      const cTickerData:SymbolPrice = JSON.parse(JSON.stringify(t_cTickerData));
      const file_price = fs.openSync(price_path, "w");
      const file_transaction = fs.openSync(transaction_path, "w");
      let tickerData;
      let parsedTickerData;
      let transactionRawWindowData:{
        totalValueTransferred:number;
        priceChange:number;
        priceChangePercent:number;
        transactionsCount:number;
      }[] = [];
      transactionRawWindowData.push({
          totalValueTransferred: 0,
          priceChange: 0,
          priceChangePercent: 0,
          transactionsCount: 0
        });

      fs.writeSync(file_price, `time,open\n${this.parseDateToString(timeSlot[0])},${cTickerData.price}\n`);
      fs.writeSync(file_transaction, `time,CEX,totalValueTransferred,priceChange,priceChangePercent,transactionCount\n${this.parseDateToString(timeSlot[0])},Binance,NO_DATA,NO_DATA,NO_DATA,NO_DATA\n`);
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
}