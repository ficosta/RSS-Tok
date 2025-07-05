import OpenAI from 'openai';
import { writeFileSync, unlinkSync, createReadStream } from 'fs';
import { join } from 'path';
import { ItemRepository } from '@/repositories/ItemRepository';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { TARGET_LANGUAGES, TargetLanguage } from '@/config/feedUrls';
import { TranslationJob } from '@/types';

interface TranslationJobData {
  itemId: string;
  title: string;
  content: string;
  link: string;
  pubDate: string;
  mediaContent: any;
  mediaThumbnail: any;
  mediaCredit: string;
  categories: string[];
}

export class TranslationService {
  private openai: OpenAI;
  private itemRepository: ItemRepository;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    this.itemRepository = new ItemRepository();
  }

  async createTranslationJob(data: TranslationJobData): Promise<void> {
    try {
      logger.info(`Creating translation job for item ${data.itemId}`);

      const requests = this.buildTranslationRequests(data);
      const batchFile = await this.createBatchFile(requests);
      
      // Upload file to OpenAI
      const fileResponse = await this.openai.files.create({
        file: createReadStream(batchFile),
        purpose: 'batch',
      });

      // Create batch job
      const batch = await this.openai.batches.create({
        input_file_id: fileResponse.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      });

      // Save job data
      const jobData: TranslationJob = {
        batchId: batch.id,
        status: 'processing',
        submittedAt: Date.now(),
        targetLanguages: [...TARGET_LANGUAGES],
        requests: requests.length,
      };

      await this.itemRepository.updateTranslationJob(data.itemId, jobData);
      
      // Clean up temp file
      unlinkSync(batchFile);
      
      logger.info(`Translation job created for item ${data.itemId}`, { batchId: batch.id });
      
    } catch (error) {
      logger.error(`Error creating translation job for item ${data.itemId}:`, error);
      throw error;
    }
  }

  private buildTranslationRequests(data: TranslationJobData): any[] {
    const requests: any[] = [];

    TARGET_LANGUAGES.forEach((lang) => {
      const languageName = this.getLanguageName(lang);
      const systemPrompt = this.getSystemPrompt(languageName, env.TRANSLATION_SYSTEM_PROMPT_STYLE);
      
      // Request for title translation
      requests.push({
        custom_id: `${data.itemId}|${lang}|title`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: env.OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: this.buildUserPrompt(data.title, 'title', data, env.TRANSLATION_INCLUDE_CONTEXT),
            },
          ],
          max_tokens: env.OPENAI_MAX_TOKENS,
          temperature: env.OPENAI_TEMPERATURE,
          store: true,
        },
      });

      // Request for content translation
      if (data.content) {
        requests.push({
          custom_id: `${data.itemId}|${lang}|content`,
          method: 'POST',
          url: '/v1/chat/completions',
          body: {
            model: env.OPENAI_MODEL,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: this.buildUserPrompt(data.content, 'content', data, env.TRANSLATION_INCLUDE_CONTEXT),
              },
            ],
            max_tokens: env.OPENAI_MAX_TOKENS,
            temperature: env.OPENAI_TEMPERATURE,
            store: true,
          },
        });
      }
    });

    return requests;
  }

  private getLanguageName(lang: TargetLanguage): string {
    const languageMap = {
      en: 'English',
      pt: 'Portuguese (Brazil)',
      es: 'Spanish',
      tr: 'Turkish',
    };
    return languageMap[lang];
  }

  private getSystemPrompt(languageName: string, style: string): string {
    const basePrompt = `You are a professional translator specializing in German news content to ${languageName}.`;
    
    const stylePrompts = {
      professional: `${basePrompt} Maintain formal tone and precise terminology. Preserve the journalistic style while ensuring clarity and accuracy.`,
      casual: `${basePrompt} Use a more conversational tone while keeping the information accurate. Make it accessible to general readers.`,
      news: `${basePrompt} Translate as a news article, maintaining the urgency and impact of the original. Use appropriate news language conventions for ${languageName}. Keep headlines punchy and content engaging.`
    };

    const selectedPrompt = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.news;
    
    return `${selectedPrompt}

IMPORTANT RULES:
- Translate ONLY the text, do not add explanations or commentary
- Preserve the original meaning and intent
- Adapt cultural references when necessary for ${languageName} audience
- Maintain the emotional tone (urgent, neutral, dramatic, etc.)
- For headlines: keep them concise and impactful
- For content: ensure natural flow in ${languageName}
- Do not translate proper names unless commonly translated
- Handle numbers, dates, and currency appropriately for ${languageName} locale`;
  }

  private buildUserPrompt(text: string, fieldType: 'title' | 'content', data: TranslationJobData, includeContext: boolean): string {
    let prompt = '';
    
    if (includeContext && fieldType === 'content' && data.title) {
      prompt += `Context: This is a news article with the headline "${data.title}"\n\n`;
    }
    
    if (fieldType === 'title') {
      prompt += `Translate this news headline:\n"${text}"`;
    } else {
      prompt += `Translate this news content:\n"${text}"`;
    }
    
    if (includeContext && data.categories && data.categories.length > 0) {
      prompt += `\n\nCategories: ${data.categories.join(', ')}`;
    }
    
    return prompt;
  }

  private async createBatchFile(requests: any[]): Promise<string> {
    const lines = requests.map((r) => JSON.stringify(r)).join('\n');
    const fileName = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}.jsonl`;
    const filePath = join(process.cwd(), fileName);
    
    writeFileSync(filePath, lines);
    return filePath;
  }

  async pollTranslationJobs(): Promise<void> {
    logger.info('Starting translation job polling');
    
    const processingItems = await this.itemRepository.findByTranslationStatus('processing');
    
    for (const item of processingItems) {
      try {
        await this.processTranslationJob(item);
      } catch (error) {
        logger.error(`Error processing translation job for item ${item.itemId}:`, error);
      }
    }
    
    logger.info(`Completed translation job polling for ${processingItems.length} items`);
  }

  private async processTranslationJob(item: any): Promise<void> {
    const jobData = item.translationJob as TranslationJob;
    
    if (!jobData.batchId) {
      logger.warn(`No batch ID found for item ${item.itemId}`);
      return;
    }

    try {
      const batch = await this.openai.batches.retrieve(jobData.batchId);
      
      if (batch.status === 'completed') {
        logger.info(`Batch ${jobData.batchId} completed, processing results`);
        await this.processBatchResults(item, batch.output_file_id!);
        
        // Update job status
        jobData.status = 'completed';
        jobData.completedAt = Date.now();
        await this.itemRepository.updateTranslationJob(item.itemId, jobData);
        
      } else if (batch.status === 'failed' || batch.status === 'expired') {
        logger.error(`Batch ${jobData.batchId} failed or expired`, { status: batch.status });
        
        jobData.status = 'failed';
        jobData.error = `Batch ${batch.status}`;
        await this.itemRepository.updateTranslationJob(item.itemId, jobData);
        
      } else {
        logger.debug(`Batch ${jobData.batchId} still processing`, { status: batch.status });
      }
      
    } catch (error) {
      logger.error(`Error checking batch status for ${jobData.batchId}:`, error);
      
      jobData.status = 'failed';
      jobData.error = error instanceof Error ? error.message : 'Unknown error';
      await this.itemRepository.updateTranslationJob(item.itemId, jobData);
    }
  }

  private async processBatchResults(item: any, outputFileId: string): Promise<void> {
    try {
      const fileResponse = await this.openai.files.content(outputFileId);
      const fileContents = await fileResponse.text();
      const lines = fileContents.split('\n').filter((line) => line.trim() !== '');
      
      const translations = item.translations || {};
      
      for (const line of lines) {
        const result = JSON.parse(line);
        const [itemId, lang, field] = result.custom_id.split('|');
        
        if (result.error) {
          logger.error(`Translation error for ${result.custom_id}:`, result.error);
          continue;
        }
        
        if (result.response?.body?.choices?.[0]?.message?.content) {
          let translation = result.response.body.choices[0].message.content.trim();
          translation = translation.replace(/^"+|"+$/g, ''); // Remove extra quotes
          
          if (!translations[lang]) {
            translations[lang] = {};
          }
          
          translations[lang][field] = translation;
          
          logger.debug(`Updated translation for ${itemId} - ${lang} - ${field}`);
        }
      }
      
      await this.itemRepository.updateTranslations(item.itemId, translations);
      logger.info(`Successfully updated translations for item ${item.itemId}`);
      
    } catch (error) {
      logger.error(`Error processing batch results for item ${item.itemId}:`, error);
      throw error;
    }
  }

  async getTranslationStats(): Promise<any> {
    const stats = await this.itemRepository.getStats();
    return {
      ...stats,
      translationProgress: stats.totalItems > 0 
        ? (stats.itemsWithTranslations / stats.totalItems) * 100 
        : 0,
    };
  }

  async getOpenAIJobsStatus(): Promise<any> {
    try {
      // Get a larger sample of batch jobs for better metrics
      const processingItems = await this.itemRepository.findByTranslationStatus('processing');
      const recentJobs = processingItems.slice(0, 20); // Check 20 for better statistics
      
      const jobStatuses = await Promise.allSettled(
        recentJobs.map(async (item) => {
          const jobData = item.translationJob as TranslationJob;
          if (!jobData.batchId) return null;
          
          try {
            const batch = await this.openai.batches.retrieve(jobData.batchId);
            return {
              batchId: jobData.batchId,
              status: batch.status,
              requestCounts: batch.request_counts,
              createdAt: batch.created_at,
              completedAt: batch.completed_at,
              inProgressAt: batch.in_progress_at,
              finalizingAt: batch.finalizing_at,
              cancelledAt: batch.cancelled_at,
              failedAt: batch.failed_at,
              expiredAt: batch.expired_at,
              metadata: batch.metadata,
              errorFileId: batch.error_file_id,
              outputFileId: batch.output_file_id,
            };
          } catch (error) {
            return {
              batchId: jobData.batchId,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
              createdAt: jobData.submittedAt ? Math.floor(jobData.submittedAt / 1000) : null,
            };
          }
        })
      );

      const validJobs = jobStatuses
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      // Calculate comprehensive metrics
      const metrics = this.calculateOpenAIMetrics(validJobs);
      const costEstimation = this.estimateCosts(validJobs, processingItems.length);
      const performanceMetrics = this.calculatePerformanceMetrics(validJobs);

      return {
        totalProcessingJobs: processingItems.length,
        recentJobsSample: validJobs.slice(0, 5), // Show only top 5 in UI
        allJobsMetrics: metrics,
        costEstimation,
        performance: performanceMetrics,
        configuration: {
          model: env.OPENAI_MODEL,
          maxTokens: env.OPENAI_MAX_TOKENS,
          temperature: env.OPENAI_TEMPERATURE,
          promptStyle: env.TRANSLATION_SYSTEM_PROMPT_STYLE,
          includeContext: env.TRANSLATION_INCLUDE_CONTEXT,
        },
        lastChecked: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting OpenAI jobs status:', error);
      return {
        totalProcessingJobs: 0,
        recentJobsSample: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: Date.now(),
      };
    }
  }

  private calculateOpenAIMetrics(jobs: any[]): any {
    if (jobs.length === 0) return {};

    const statusCounts = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    const totalRequests = jobs.reduce((sum, job) => sum + (job.requestCounts?.total || 0), 0);
    const completedRequests = jobs.reduce((sum, job) => sum + (job.requestCounts?.completed || 0), 0);
    const failedRequests = jobs.reduce((sum, job) => sum + (job.requestCounts?.failed || 0), 0);

    const avgCompletionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

    return {
      statusDistribution: statusCounts,
      requestMetrics: {
        total: totalRequests,
        completed: completedRequests,
        failed: failedRequests,
        pending: totalRequests - completedRequests - failedRequests,
        completionRate: Math.round(avgCompletionRate * 100) / 100,
      },
      jobCount: jobs.length,
    };
  }

  private estimateCosts(jobs: any[], totalJobs: number): any {
    // OpenAI batch API pricing (approximate)
    const COST_PER_1K_TOKENS = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
    };

    const modelCost = COST_PER_1K_TOKENS[env.OPENAI_MODEL as keyof typeof COST_PER_1K_TOKENS] || COST_PER_1K_TOKENS['gpt-4o-mini'];
    
    // Estimate tokens per request (title + content translation)
    const avgTokensPerRequest = env.OPENAI_MAX_TOKENS * 0.7; // Assume 70% of max tokens used
    const avgInputTokens = 200; // Estimated input tokens per translation

    const totalRequests = jobs.reduce((sum, job) => sum + (job.requestCounts?.total || 0), 0);
    const estimatedTotalRequests = totalJobs * 8; // 4 languages * 2 fields (title + content)

    const estimatedInputCost = (estimatedTotalRequests * avgInputTokens / 1000) * modelCost.input;
    const estimatedOutputCost = (estimatedTotalRequests * avgTokensPerRequest / 1000) * modelCost.output;
    const totalEstimatedCost = estimatedInputCost + estimatedOutputCost;

    return {
      model: env.OPENAI_MODEL,
      pricing: modelCost,
      estimates: {
        totalRequests: estimatedTotalRequests,
        processedRequests: totalRequests,
        avgTokensPerRequest,
        inputCost: Math.round(estimatedInputCost * 100) / 100,
        outputCost: Math.round(estimatedOutputCost * 100) / 100,
        totalCost: Math.round(totalEstimatedCost * 100) / 100,
      },
    };
  }

  private calculatePerformanceMetrics(jobs: any[]): any {
    if (jobs.length === 0) return {};

    const now = Date.now() / 1000;
    const processingTimes = jobs
      .filter(job => job.completedAt && job.createdAt)
      .map(job => job.completedAt - job.createdAt);

    const waitingTimes = jobs
      .filter(job => job.inProgressAt && job.createdAt)
      .map(job => job.inProgressAt - job.createdAt);

    const pendingTimes = jobs
      .filter(job => !job.completedAt && job.createdAt)
      .map(job => now - job.createdAt);

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    const avgWaitingTime = waitingTimes.length > 0
      ? waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length
      : 0;

    const avgPendingTime = pendingTimes.length > 0
      ? pendingTimes.reduce((a, b) => a + b, 0) / pendingTimes.length
      : 0;

    return {
      processingTime: {
        average: Math.round(avgProcessingTime),
        samples: processingTimes.length,
        formatted: this.formatDuration(avgProcessingTime),
      },
      waitingTime: {
        average: Math.round(avgWaitingTime),
        samples: waitingTimes.length,
        formatted: this.formatDuration(avgWaitingTime),
      },
      pendingTime: {
        average: Math.round(avgPendingTime),
        samples: pendingTimes.length,
        formatted: this.formatDuration(avgPendingTime),
      },
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }
}