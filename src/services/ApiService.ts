import {
    type IAgentRuntime,
    logger,
    Service,
    State
} from "@elizaos/core";

var data = JSON.stringify({
      username: "jane-doe",
      email: "jane.doe@your-domain.com",
      role: "superuser",
      age: 23,
      birthplace: "New York",
    })


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
  public stepEnd(){
    this.record[data['STEP']] = {data: this.data, state: this.state};
    logger.error('STEP END, RECORD:\n', JSON.stringify(this.record[data['STEP']]))
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
}