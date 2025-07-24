import { IAgentRuntime, logger, Service } from "@elizaos/core";
import { delim } from "../const/Const";
import * as fs from 'fs';
import path, { resolve } from "path";
import { ApiService } from "./ApiService";

export interface DefaultArticle{
  // id:number,
  // url:string,
  title:string,
  time:string,
  content:string,
  content_simplified:string
}

export interface RecordNewsData{
  date:string,
  data:DefaultArticle[]|any[]
}

export class LocalNewsAnalyseService extends Service {
  static serviceType = 'LocalNewsAnalyseService';
  capabilityDescription =
    'This is LocalNewsAnalyseService which is attached to the agent through the cryptotrade plugin.';
  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.apiService = runtime.getService(ApiService.serviceType) as ApiService;
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting api service -- : ${new Date().toISOString()} ***`);
    const service = new LocalNewsAnalyseService(runtime);
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

  public apiService:ApiService;
  public news_data:RecordNewsData[] = [];
  public news_data_simplified:any[] = [];
  public offChainNewsLoaded = false;

  public async loadNewsDataFromReddit(chain:string = 'btc', force:boolean = false){
    if(this.apiService.newsDataSource != 'Reddit'){
        throw new Error('Data source should be Reddit, now: ' + this.apiService.newsDataSource);
    }
    if(!force && this.offChainNewsLoaded){
        resolve('News Data Has Loaded, SKIP');
    }
    throw new Error('News from Reddit has not implemented yet.');
  }

  public async loadNewsDataFromFile(chain:string = 'btc', force:boolean = false, local: boolean = true): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      if(this.apiService.newsDataSource != 'Local'){
        reject('Data source should be Local, but now: ' + this.apiService.newsDataSource);
      }
      if(!force && this.offChainNewsLoaded){
        resolve('News Data Has Loaded, SKIP');
      }
      let fileNames:string[] = [];
      let dir = `./data/local/news/${chain}`;
      const list = await fs.readdirSync(dir, 'utf-8');
      try {
        for (const name of list) {
            fileNames.push(name);
        }
        for (const name of fileNames){
          let news_str = await this.apiService.readFileByAbsPath(path.join(dir, name));
          // news_str = [{id, url, title, content,...}, {}, ...]
          let raw_news_data:DefaultArticle[] = JSON.parse(news_str);
          let format_news_data:DefaultArticle[] = [];
          for(let i = 0; i < raw_news_data.length; i++){
            // Filter id, url, ...s
            // logger.error(`Parse Article:\n\ttitle: ${raw_news_data[i].title}\n\tdate:raw_news_data[i].time`)
            const article:DefaultArticle = JSON.parse(JSON.stringify({
              title: raw_news_data[i].title, time:raw_news_data[i].time, content:raw_news_data[i].content
            }));
            format_news_data.push(article);
          }
          // name.split('.')[0] = 'yyyy-mm-dd
          this.news_data.push({ date:name.split('.')[0], data: structuredClone(format_news_data)});
        }
        this.offChainNewsLoaded = true;
        resolve('News data has been successfully loaded.');
      } 
      catch (error) {
        throw new Error('Error: ' + error);
        reject(error);
      }
    });
  }

  public async simplifyNewsData(chain: string = 'btc', date:string = this.apiService.step_data!['DATE']){
      /*
      There are 1~5 articles selected everyday,
      build prompt and simplify them with LLM in a loop.
      */
      let idx_news_set = this.news_data.findIndex(item => item.date === date);
      logger.error('API SERVICE getPromptOfSimplifyNewsData: [' + idx_news_set + ']\n');
      if(-1 != idx_news_set && this.news_data[idx_news_set].data.length > 0){
        const simp_tmp = `
  You are a parsing agent for cryptocurrency news. Your goal is to extract and structure key factual information from each article so that it can be used as input by downstream generation agents.
  Input includes:
  - Title
  - Time
  - Full article text
  
  Instructions:
  - Do not write in full prose or natural language.
  - Extract core information points in a structured, atomic way.
  - Avoid summarizing style or commentary; focus only on facts.
  - Output should be short, less than 500 words.
  - Organize output in a consistent and machine-readable format (e.g., JSON or labeled bullet points).
  - Include fields such as: main events, impact, involved entities (optional: sentiment, domain).
  
  Output Format Example:
  {
    "short_summary": "...",
    "impact": "...",
    "domain": "...",
    "sentiment": "neutral",
    "key_points": ["...", "..."],
  }
  
  Input article data:
  ` + delim;
        for (let i = 0; i < this.news_data[idx_news_set].data.length; i++){
          // this.news_data[idx_news_set].data = [{title, time, content}, {...}, ...]
          let simp_s = simp_tmp + JSON.stringify({
            title:this.news_data[idx_news_set].data[i].title,
            time:this.news_data[idx_news_set].data[i].time,
            content:this.news_data[idx_news_set].data[i].content
          });
          simp_s += delim;
          const resp = await this.apiService.tryToCallLLMsWithoutFormat(simp_s, false, false, /*maxTokens:*/200);
          this.news_data[idx_news_set].data[i].content_simplified = resp;
        }
        return 'simplifyNewsData done, data record to this.news_data[idx_news_set]';
      }else{
        return 'FAILED TO FETCH NEWS DATA';
      }
    }
  
  public getPromptOfProcessNewsData(chain: string = 'btc', date:string = '2024-09-26', maxArticles:number = 3) :string{
    if(!this.apiService.CRYPT_ENABLE_NEWS_ANALYZE){
      return '';
    }
    let idx_news = this.news_data.findIndex(item => item.date === date);
    logger.error('API SERVICE getPromptOfNewsData: [' + idx_news + ']\n');
    if(-1 != idx_news && this.news_data[idx_news].data.length > 0){
      let news_s = '';
      if(this.apiService.CRYPT_ENABLE_NEWS_SIMPLIFICATION){
        if(!(this.news_data.length > 0)){
          throw new Error(`Error: The SIMPLIFIED_NEWS set on ${this.apiService.step_data!['DATE']} is empty.`);
        }
        news_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. There are some articles about cryptocurrency today, and an analyst has completed the summary. You are required to analyze the following summary of these articles:` + delim;
        for(let i = 0; i < this.news_data[idx_news].data.length; i++){
          news_s += `{title:${this.news_data[idx_news].data[i].title}, time:${this.news_data[idx_news].data[i].time}, content:${this.news_data[idx_news].data[i].content_simplified}}\n`;
        }
        news_s += delim + `Write one concise paragraph to analyze the summary and estimate the market trend accordingly.`;
      }else{
        news_s = `You are an ${chain.toUpperCase()} cryptocurrency trading analyst. You are required to analyze the following news articles:` + delim;
        if(this.news_data[idx_news].data.length > maxArticles){
          for(let i = 0; i < maxArticles; i++){
            news_s += JSON.stringify(this.news_data[idx_news].data[i]);
          }
        }else{
          news_s += JSON.stringify(this.news_data[idx_news].data);
        }
        news_s += delim + `Write one concise paragraph to analyze the news and estimate the market trend accordingly.`;
      }
      return news_s;
    }else{
      throw new Error('FAILED TO FETCH NEWS DATA');
    }
  }
}
  