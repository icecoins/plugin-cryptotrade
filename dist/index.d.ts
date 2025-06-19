import { Plugin, Service, IAgentRuntime } from '@elizaos/core';

declare class StarterService extends Service {
    static serviceType: string;
    capabilityDescription: string;
    constructor(runtime: IAgentRuntime);
    static start(runtime: IAgentRuntime): Promise<StarterService>;
    static stop(runtime: IAgentRuntime): Promise<void>;
    stop(): Promise<void>;
}
declare const starterPlugin: Plugin;

export { StarterService, starterPlugin as default, starterPlugin };
