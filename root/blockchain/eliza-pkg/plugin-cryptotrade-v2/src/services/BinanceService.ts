import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { MainClient } from 'binance';
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

        // this.client.getAccountTradeList({ symbol: 'BTCUSDT' })
        // .then((result) => {
        //     console.log('getAccountTradeList result: ', result);
        // })
        // .catch((err) => {
        //     console.error('getAccountTradeList error: ', err);
        // });

        // this.client.getExchangeInfo()
        // .then((result) => {
        //     console.log('getExchangeInfo inverse result: ', result);
        // })
        // .catch((err) => {
        //     console.error('getExchangeInfo inverse error: ', err);
        // });
    }
}