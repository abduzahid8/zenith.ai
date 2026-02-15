import { config } from '../config.ts';
import { Logger } from '../utils/logger.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export class GeminiClient {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async generate<T>(
        prompt: string,
        systemPrompt: string,
        schema: z.ZodType<T>,
        jsonSchema: any // The raw JSON schema describing user intent for the model
    ): Promise<T> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

        this.logger.debug('Calling Gemini API', { systemPrompt });

        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt + '\n\n' + prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 1000,
                responseMimeType: 'application/json',
                responseSchema: jsonSchema
            },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                throw new Error('Gemini API returned empty response');
            }

            let parsed: any;
            try {
                parsed = JSON.parse(rawText);
            } catch (e) {
                this.logger.error('Failed to parse Gemini JSON output', { rawText });
                throw new Error('Invalid JSON received from Gemini');
            }

            const validation = schema.safeParse(parsed);
            if (!validation.success) {
                this.logger.error('Gemini output validation failed', { errors: validation.error.errors, parsed });
                throw new Error('Gemini output failed schema validation');
            }

            return validation.data;

        } catch (error) {
            this.logger.error('Gemini Generation Failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
}
