import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { ApiService } from "./ApiService";
import { LocalNewsAnalyseService } from "./LocalNewsAnalyseService";
import { analyzeAndTradeTask, analyzeAndTradeWorker } from "../tasks/TaskAnalyzeAndTrade";

export class TaskService extends Service {
  static serviceType = 'PrinceAnalyzeService';
  private apiService:ApiService|undefined;

  capabilityDescription =
    'This is PrinceAnalyzeService which is attached to the agent through the cryptotrade plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting TaskService service -- : ${new Date().toISOString()} ***`);
    const service = new TaskService(runtime);
    service.apiService = runtime.getService(ApiService.serviceType) as ApiService;
    runtime.createTask(analyzeAndTradeTask);
    runtime.registerTaskWorker(analyzeAndTradeWorker);
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


}