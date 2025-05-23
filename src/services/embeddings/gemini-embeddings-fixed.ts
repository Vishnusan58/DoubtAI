import * as genai from '@google/generative-ai';

// Constants for configuration
const CURRENT_USER = 'Vishnusan58';
const API_KEY = 'AIzaSyDr6KjoDsPwQiAdDN-8CdzTTbIk8rIIZRg';
const MODEL_NAME = 'gemini-embedding-exp-03-07';
const MAX_CHUNK_SIZE = 30000; // Maximum size for each text chunk (below the 36000 byte limit)

export class GeminiEmbeddingService {
    private static instance: GeminiEmbeddingService;
    private genAI: genai.GoogleGenerativeAI;

    private constructor() {
        // It's safer to get the API key from environment variables
        const apiKey = process.env.GOOGLE_API_KEY || API_KEY;
        if (!apiKey || apiKey === 'AIzaSyDr6KjoDsPwQiAdDN-8CdzTTbIk8rIIZRg') {
            console.error("GEMINI_API_KEY is not configured or is using a placeholder. Please set it in your environment variables.");
        }
        this.genAI = new genai.GoogleGenerativeAI(apiKey);

        console.log(`[${new Date().toISOString()}] GeminiEmbeddingService instantiated by ${CURRENT_USER}`);
    }

    public static getInstance(): GeminiEmbeddingService {
        if (!GeminiEmbeddingService.instance) {
            GeminiEmbeddingService.instance = new GeminiEmbeddingService();
        }
        return GeminiEmbeddingService.instance;
    }

    /**
     * Generate embedding for text, handling large texts by chunking
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const modelName = process.env.GEMINI_EMBEDDING_MODEL_NAME || MODEL_NAME;
            console.log(`[${new Date().toISOString()}] Generating embedding for text: "${text.substring(0, 50)}..." using model ${modelName}`);

            // Check if text is too large for a single request
            const textBytes = new TextEncoder().encode(text).length;

            if (textBytes > MAX_CHUNK_SIZE) {
                console.log(`[${new Date().toISOString()}] Text is too large (${textBytes} bytes), splitting into chunks`);
                return await this.generateEmbeddingForLargeText(text, modelName);
            }

            // For smaller texts, proceed normally
            const embedder = this.genAI.getGenerativeModel({ model: modelName });

            const result = await embedder.embedContent({
                content: { parts: [{ text: text }], role: "user" },
                taskType: genai.TaskType.RETRIEVAL_DOCUMENT
            });

            console.log(`[${new Date().toISOString()}] Embedding generated successfully`);
            return result.embedding.values;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error generating embedding:`, error);
            throw error;
        }
    }

    /**
     * Handle large texts by splitting into chunks, generating embeddings for each,
     * then averaging the embeddings.
     */
    private async generateEmbeddingForLargeText(text: string, modelName: string): Promise<number[]> {
        // Split text into manageable chunks
        const chunks = this.splitTextIntoChunks(text, MAX_CHUNK_SIZE);
        console.log(`[${new Date().toISOString()}] Split text into ${chunks.length} chunks`);

        // Generate embeddings for each chunk
        const embedder = this.genAI.getGenerativeModel({ model: modelName });
        const embeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i++) {
            try {
                console.log(`[${new Date().toISOString()}] Processing chunk ${i+1}/${chunks.length}, size: ${new TextEncoder().encode(chunks[i]).length} bytes`);
                const result = await embedder.embedContent({
                    content: { parts: [{ text: chunks[i] }], role: "user" },
                    taskType: genai.TaskType.RETRIEVAL_DOCUMENT
                });
                embeddings.push(result.embedding.values);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error processing chunk ${i+1}:`, error);
                // If a chunk fails, we'll skip it rather than failing the whole process
            }
        }

        if (embeddings.length === 0) {
            throw new Error('Failed to generate any embeddings from text chunks');
        }

        // If we only got one chunk with embedding, return it directly
        if (embeddings.length === 1) {
            return embeddings[0];
        }

        // Average the embeddings across all chunks to get a single embedding
        // First ensure all embeddings have the same dimensions
        const dimension = embeddings[0].length;
        const sumEmbedding = new Array(dimension).fill(0);

        for (const embedding of embeddings) {
            for (let i = 0; i < dimension; i++) {
                sumEmbedding[i] += embedding[i];
            }
        }

        // Calculate average
        const avgEmbedding = sumEmbedding.map(val => val / embeddings.length);

        console.log(`[${new Date().toISOString()}] Generated and averaged embeddings from ${embeddings.length} chunks`);
        return avgEmbedding;
    }

    /**
     * Split text into chunks of maximum byte size
     */
    private splitTextIntoChunks(text: string, maxBytes: number): string[] {
        const encoder = new TextEncoder();
        const chunks: string[] = [];
        let currentChunk = '';

        // Split by paragraphs first
        const paragraphs = text.split(/\n\n|\r\n\r\n/);

        for (const paragraph of paragraphs) {
            // If a single paragraph is too large, split by sentences
            if (encoder.encode(paragraph).length > maxBytes) {
                const sentences = paragraph.split(/(?<=[.!?])\s+/);

                for (const sentence of sentences) {
                    // If the current chunk plus this sentence would be too large, start a new chunk
                    if (encoder.encode(currentChunk + sentence).length > maxBytes) {
                        if (currentChunk) {
                            chunks.push(currentChunk);
                            currentChunk = '';
                        }

                        // If even a single sentence is too large, split it into smaller pieces
                        if (encoder.encode(sentence).length > maxBytes) {
                            let sentencePart = '';
                            for (const word of sentence.split(/\s+/)) {
                                if (encoder.encode(sentencePart + word + ' ').length > maxBytes) {
                                    chunks.push(sentencePart);
                                    sentencePart = word + ' ';
                                } else {
                                    sentencePart += word + ' ';
                                }
                            }
                            if (sentencePart) {
                                currentChunk = sentencePart;
                            }
                        } else {
                            currentChunk = sentence + ' ';
                        }
                    } else {
                        currentChunk += sentence + ' ';
                    }
                }
            } else {
                // Check if adding this paragraph would make the chunk too large
                if (encoder.encode(currentChunk + paragraph + '\n\n').length > maxBytes) {
                    chunks.push(currentChunk);
                    currentChunk = paragraph + '\n\n';
                } else {
                    currentChunk += paragraph + '\n\n';
                }
            }
        }

        // Add the final chunk if it's not empty
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        try {
            const modelName = process.env.GEMINI_EMBEDDING_MODEL_NAME || MODEL_NAME;
            console.log(`[${new Date().toISOString()}] Processing batch of ${texts.length} texts using model ${modelName}`);

            // For batch processing, we'll process each text individually to handle large texts properly
            const results: number[][] = [];

            for (let i = 0; i < texts.length; i++) {
                console.log(`[${new Date().toISOString()}] Processing batch item ${i+1}/${texts.length}`);
                const embedding = await this.generateEmbedding(texts[i]);
                results.push(embedding);
            }

            console.log(`[${new Date().toISOString()}] Batch embeddings generated successfully`);
            return results;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Batch embedding generation failed:`, error);
            throw error;
        }
    }
}
