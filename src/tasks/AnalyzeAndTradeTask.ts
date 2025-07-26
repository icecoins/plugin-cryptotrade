import { TaskWorker, IAgentRuntime, Task, Memory, State, logger, ServiceType, Service } from "@elizaos/core";

export const analyzeAndTradeWorker: TaskWorker = {
    /** The unique name of the task type this worker handles. This name links `Task` instances to this worker. */
    name: "analyzeAndTradeTask",
    validate: async (runtime, message, state) => {
        return true;
    },
    execute: function (runtime: IAgentRuntime, options: { [key: string]: unknown; }, task: Task): Promise<void> {
        // throw new Error("Function not implemented.");
        return new Promise<void>((resolve, reject)=>{
            // TODO
            logger.error('Task running');
            resolve();
        });
    },
}

export const analyzeAndTradeTask: Task = {
    /** The name of the task, which should correspond to a registered `TaskWorker.name`. */
    name: "analyzeAndTradeTask",
    description: "Analyze On/Off-chain data and execute trade in every period.",
    tags: ["report", "repeat", 'queue'],
    metadata: {
        // updateInterval: 86400000, // 24 hours
        updateInterval: 1000,
    },
    updatedAt:Date.now(),
}