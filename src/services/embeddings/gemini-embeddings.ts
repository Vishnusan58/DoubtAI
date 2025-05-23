import * as genai from '@google/generative-ai'; // Using namespace import

// It's better to manage these via environment variables or a dedicated config file
// especially the API_KEY. Timestamps and user should ideally be dynamic.

const CURRENT_USER = 'Vishnusan58'; // Hardcoded
const API_KEY = 'AIzaSyDr6KjoDsPwQiAdDN-8CdzTTbIk8rIIZRg'; // Hardcoded API Key - MAJOR SECURITY RISK
const MODEL_NAME = 'gemini-embedding-exp-03-07'; // This model name might be outdated or an experimental one.
// Official models are like 'embedding-001' or 'text-embedding-004'.
// Verify the correct model name.

export class GeminiEmbeddingService {
    private static instance: GeminiEmbeddingService;
    private genAI: genai.GoogleGenerativeAI; // Use the type from the imported module

    private constructor() {
        // It's safer to get the API key from environment variables
        const apiKey = process.env.GEMINI_API_KEY; // Fallback, but ideally only from env
        if (!apiKey || apiKey === 'AIzaSyDr6KjoDsPwQiAdDN-8CdzTTbIk8rIIZRg') { // Check against your hardcoded default
            console.error("GEMINI_API_KEY is not configured or is using a placeholder. Please set it in your environment variables.");
            // Optionally throw an error here if the API key is critical for instantiation
        }
        this.genAI = new genai.GoogleGenerativeAI(apiKey); // Initialize with API key

        // this.genAI.configure({ apiKey: API_KEY }); // This is not how the genAI SDK is typically configured.
        // Pass API key directly to constructor.
        console.log(`[${new Date().toISOString()}] GeminiEmbeddingService instantiated by ${CURRENT_USER}`); // Use dynamic timestamp
    }

    public static getInstance(): GeminiEmbeddingService {
        if (!GeminiEmbeddingService.instance) {
            GeminiEmbeddingService.instance = new GeminiEmbeddingService();
        }
        return GeminiEmbeddingService.instance;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const modelName = process.env.GEMINI_EMBEDDING_MODEL_NAME || MODEL_NAME;
            console.log(`[${new Date().toISOString()}] Generating embedding for text: "${text.substring(0, 50)}..." using model ${modelName}`);

            // The SDK uses GenerativeModel for embeddings, not embed_content directly on the main module.
            const embedder = this.genAI.getGenerativeModel({ model: modelName });

            // Correct method is embedContent
            const result = await embedder.embedContent({
                content: { parts: [{ text: text }], role: "user" }, // Content needs to be structured
                taskType: genai.TaskType.RETRIEVAL_DOCUMENT // Use enum from the SDK
            });

            console.log(`[${new Date().toISOString()}] Embedding generated successfully`);
            return result.embedding.values; // Access values property of the embedding
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error generating embedding:`, error);
            throw error;
        }
    }

    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        try {
            const modelName = process.env.GEMINI_EMBEDDING_MODEL_NAME || MODEL_NAME;
            console.log(`[${new Date().toISOString()}] Processing batch of ${texts.length} texts using model ${modelName}`);

            const embedder = this.genAI.getGenerativeModel({ model: modelName });

            // Use batchEmbedContents for batching
            const requests = texts.map(text => ({
                content: { parts: [{ text: text }], role: "user" },
                taskType: genai.TaskType.RETRIEVAL_DOCUMENT
            }));

            const result = await embedder.batchEmbedContents({ requests });

            const embeddings = result.embeddings.map(emb => emb.values);

            console.log(`[${new Date().toISOString()}] Batch embeddings generated successfully`);
            return embeddings;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Batch embedding generation failed:`, error);
            throw error;
        }
    }
}