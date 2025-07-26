import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { CurrentAvgPrice, Kline, KlineInterval, MainClient, SymbolPrice, Ticker24hrResponse, TradingDayTickerFull, TradingDayTickerMini } from 'binance';
export class BinanceService extends Service {
    static serviceType = 'binance';
    
    public CRYPT_BINANCE_API_KEY:string|undefined;
    public CRYPT_BINANCE_KEY:string|undefined;
    public client:MainClient|undefined;
    
    capabilityDescription =
        'This is a binance service which is attached to the agent through the starter plugin.';
    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    static async start(runtime: IAgentRuntime) {
        logger.info(`*** Starting binance service - MODIFIED: ${new Date().toISOString()} ***`);
        const service = new BinanceService(runtime);
        service.initConfigs();
        service.client = new MainClient({
            api_key: service.CRYPT_BINANCE_API_KEY,
            api_secret: service.CRYPT_BINANCE_KEY,
            testnet: true, // Connect to testnet environment
        });
        logger.info('*** Service Binance: Client Init done. ***');
        return service;
    }

    static async stop(runtime: IAgentRuntime) {
        logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
        // get the service from the runtime
        const service = runtime.getService(BinanceService.serviceType);
        if (!service) {
        throw new Error('BinanceService not found');
        }
        service.stop();
    }
    async stop() {
        logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
    }

    initConfigs(){
        this.CRYPT_BINANCE_API_KEY = process.env.CRYPT_BINANCE_API_KEY;
        this.CRYPT_BINANCE_KEY = process.env.CRYPT_BINANCE_KEY;
    }
    async getAvgPrice(coin_symbol:string = 'BTCUSDT'){
        return new Promise<CurrentAvgPrice>(async (resolve, reject) =>{
            try {
                const price = await this.client!.getAvgPrice({symbol:coin_symbol});
                resolve(price);
            } catch (error) {
                reject(error)
            }
        });
    }
    async getTickerPrice(coin_symbol:string = 'BTCUSDT'){
        return new Promise<SymbolPrice|SymbolPrice[]>(async (resolve, reject) =>{
            try {
                const price = await this.client!.getSymbolPriceTicker({symbol:coin_symbol});
                resolve(price);
            } catch (error) {
                reject(error)
            }
        });
    }

    async getPriceDataWithKlines(coin_symbol:string = 'BTCUSDT', endTime = structuredClone(new Date()), 
        interval: KlineInterval = '1s', timeZone = '8', limit = 1){
        return new Promise<Kline[]>(async (resolve, reject) =>{
            try {
                let startTime = structuredClone(endTime);
                startTime.setSeconds(startTime.getSeconds() - 1);
                const data = await this.client!.getKlines({symbol:coin_symbol, interval: interval, 
                    startTime:startTime.getTime(), endTime:endTime.getTime(), timeZone:timeZone, limit: limit});
                // logger.error(`getRollingWindowTicker:\n${data}\n${JSON.stringify(data)}`);
                resolve(data);
            } catch (error) {
                reject(error)
            }
        });
    }

    async getTransactionDataWithKlines(coin_symbol:string = 'BTCUSDT', startTime:Date, endTime = structuredClone(new Date()), 
        interval: KlineInterval = '4h', timeZone = '8', limit = 50){
        return new Promise<Kline[]>(async (resolve, reject) =>{
            try {
                const data = await this.client!.getKlines({symbol:coin_symbol, interval: interval, 
                    startTime:startTime.getTime(), endTime:endTime.getTime(), timeZone:timeZone, limit: limit});
                // logger.error(`getRollingWindowTicker:\n${data}\n${JSON.stringify(data)}`);
                resolve(data);
            } catch (error) {
                reject(error)
            }
        });
    }

    async getRollingWindowTicker(coin_symbol:string = 'BTCUSDT', windowSize = 4){
        return new Promise<TradingDayTickerFull[] | TradingDayTickerMini[]>(async (resolve, reject) =>{
            try {
                const data = await this.client!.getRollingWindowTicker({symbol:coin_symbol, windowSize: windowSize + 'h', type:'FULL'});
                // logger.error(`getRollingWindowTicker:\n${data}\n${JSON.stringify(data)}`);
                resolve(data);
            } catch (error) {
                reject(error)
            }
        });
    }

    async getDailyPrice(coin_symbol:string = 'BTCUSDT'){
        return new Promise<Ticker24hrResponse>(async (resolve, reject) =>{
            try {
                if(!coin_symbol.includes('USDT')){
                    coin_symbol = coin_symbol.toUpperCase().concat('USDT');
                }
                const price = await this.client!.get24hrChangeStatistics({symbol: coin_symbol, type: 'FULL'});
                resolve(price);
            } catch (error) {
                reject(error)
            }
        });
        // symbol: string;
        // openPrice: string;
        // highPrice: string;
        // lowPrice: string;
        // lastPrice: string;
        // volume: string;
        // quoteVolume: string;
        // openTime: number;
        // closeTime: number;
        // firstId: number;
        // lastId: number;
        // count: number;
    }
}