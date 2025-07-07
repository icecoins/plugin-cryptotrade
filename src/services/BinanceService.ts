import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { CurrentAvgPrice, MainClient, SymbolPrice, Ticker24hrResponse } from 'binance';
export class BinanceService extends Service {
    static serviceType = 'binance';
    capabilityDescription =
        'This is a binance service which is attached to the agent through the starter plugin.';
    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    static async start(runtime: IAgentRuntime) {
        logger.info(`*** Starting binance service - MODIFIED: ${new Date().toISOString()} ***`);
        const service = new BinanceService(runtime);
        service.initConfigs();
        service.initEnv();
        return service;
    }

    static async stop(runtime: IAgentRuntime) {
        logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
        // get the service from the runtime
        const service = runtime.getService(BinanceService.serviceType);
        if (!service) {
        throw new Error('Starter service not found');
        }
        service.stop();
    }
    public CRYPT_BINANCE_API_KEY:string;
    public CRYPT_BINANCE_KEY:string;
    public client:MainClient;
    async stop() {
        logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
    }

    initConfigs(){
        this.CRYPT_BINANCE_API_KEY = process.env.CRYPT_BINANCE_API_KEY;
        this.CRYPT_BINANCE_KEY = process.env.CRYPT_BINANCE_KEY;
    }

    initEnv(){
        this.client = new MainClient({
            api_key: this.CRYPT_BINANCE_API_KEY,
            api_secret: this.CRYPT_BINANCE_KEY,
            testnet: true, // Connect to testnet environment
        });

        logger.info('*** Service Binance: Client Init done. ***');
    }
    async getAvgPrice(coin_symbol:string = 'BTCUSDT'){
        return new Promise<CurrentAvgPrice>(async (resolve, reject) =>{
            try {
                const price = await this.client.getAvgPrice({symbol:coin_symbol});
                resolve(price);
            } catch (error) {
                reject(error)
            }
        });
    }
    async getTickerPrice(coin_symbol:string = 'BTCUSDT'){
        return new Promise<SymbolPrice|SymbolPrice[]>(async (resolve, reject) =>{
            try {
                const price = await this.client.getSymbolPriceTicker({symbol:coin_symbol});
                resolve(price);
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
                const price = await this.client.get24hrChangeStatistics({symbol: coin_symbol, type: 'MINI'},);
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