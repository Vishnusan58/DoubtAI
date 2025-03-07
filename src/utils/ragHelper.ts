//Updated code with accessinng of multiple plans and their details
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { Metadata_details } from "../../data/metadata";

// Configuration constants
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'your_pinecone_key';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your_openai_key';
const DEFAULT_INDEX = 'horizonblue';
const DIMENSION = 1024;

// Interface definitions
interface RAGResponse {
    type: 'ai_response' | 'error';
    message: string;
    metadata?: {
        context?: string;
        confidence: number;
        planName?: string;
    };
}

// Plan configuration
interface PlanConfig {
    indexName: string;
    displayName: string;
    description: string;
}

// Mapping provided plan names to Pinecone indexes and details
const PLAN_CONFIGS: { [key: string]: PlanConfig } = {
    'horizonplatinum': {
        indexName: 'horizonblue',
        displayName: 'Horizon Platinum',
        description: 'Comprehensive healthcare coverage by Horizon Blue Cross Blue Shield'
    },
    'unitedhealthcare': {
        indexName: 'unitedhealthcare',
        displayName: 'United Healthcare',
        description: 'Healthcare coverage provided by United Healthcare'
    },
    'amerihealthplatinum': {
        indexName: 'amerihealthplat',
        displayName: 'AmeriHealth Platinum',
        description: 'Healthcare coverage provided by AmeriHealth Platinum'
    }
};

/**
 * Get plan configuration by name.
 * If not provided or unrecognized, default to DEFAULT_INDEX.
 */
function getPlanConfig(planName?: string): PlanConfig {
    if (!planName) {
        console.warn("No plan name provided; defaulting to:", DEFAULT_INDEX);
        return PLAN_CONFIGS[DEFAULT_INDEX];
    }
    const normalizedPlanName = planName.toLowerCase().replace(/\s+/g, '');
    console.log("Normalized plan name:", normalizedPlanName);
    if (normalizedPlanName.includes('united')) return PLAN_CONFIGS['unitedhealthcare'];
    if (normalizedPlanName.includes('ameri')) return PLAN_CONFIGS['amerihealthplatinum'];
    if (normalizedPlanName.includes('horizon')) return PLAN_CONFIGS['horizonplatinum'];
    console.warn("Plan not matched; defaulting to:", DEFAULT_INDEX);
    return PLAN_CONFIGS[DEFAULT_INDEX];
}

/**
 * Generates embeddings for the text using OpenAI's text-embedding-3-small.
 */
async function generateEmbeddings(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text
        });
        return response.data[0].embedding.slice(0, DIMENSION);
    } catch (error) {
        console.error('Error generating embeddings:', error);
        return Array(DIMENSION).fill(0);
    }
}

/**
 * Retrieves the best matching context from the Pinecone index.
 */
async function retrieveSingleBestContext(queryEmbedding: number[], index: any): Promise<string> {
    try {
        console.log('Querying Pinecone index:', index.name || "Index name  available");
        const results = await index.query({
            vector: queryEmbedding,
            topK: 7,
            includeMetadata: true
        });
        if (results.matches.length === 0) return "";
        results.matches.sort((a: any, b: any) => b.score - a.score);
        return results.matches[0].metadata.text;
    } catch (error) {
        console.error('Error retrieving context:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            console.error('Pinecone index not found:', index.name);
        }
        return "";
    }
}

/**
 * Generates a response using OpenAI GPT-4o-mini with the selected plan details.
 */
async function generateResponse(query: string, context: string, planConfig: PlanConfig, selectedPlan: string): Promise<string> {
    try {
        const prompt = `
Selected Plan: ${selectedPlan}
Plan Description: ${planConfig.description}

Use ONLY the given context and the above plan details to answer the following question concisely.
if the information is not available in the context, Use the ${selectedPlan} plan and ${Metadata_details.INSURANCE_DETAILS_meta} to answer the question.

Context:
${context}

Question: ${query}

Answer:
`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an expert insurance assistant." },
                { role: "user", content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.3
        });
        return response.choices[0]?.message?.content || "I'm unable to generate a response at this time.";
    } catch (error) {
        console.error('Error generating response:', error);
        return "An error occurred while generating the response.";
    }
}

/**
 * Main query function for the RAG system.
 * It obtains the effective plan name, logs details, retrieves the config, and queries Pinecone.
 */
export async function queryRAGSystem(query: string, planName?: string, selectedPlan?: string): Promise<RAGResponse> {
    try {
        if (!query.trim()) {
            throw new Error("Query cannot be empty");
        }

        const effectivePlanName = selectedPlan || planName;
        console.log('Effective Plan Name:', effectivePlanName);
        const planConfig = getPlanConfig(effectivePlanName);
        console.log('Selected Plan Config:', planConfig);

        if (!planConfig || !planConfig.indexName) {
            throw new Error("");
        }

        const queryEmbedding = await generateEmbeddings(query);
        const index = pinecone.index(planConfig.indexName);
        console.log("Using Pinecone index name:", planConfig.indexName);

        const context = await retrieveSingleBestContext(queryEmbedding, index);
        if (!context) {
            return {
                type: 'ai_response',
                message: `I don't have specific information about that aspect of it.`,
                metadata: { confidence: 0, planName: planConfig.displayName }
            };
        }
        const response = await generateResponse(query, context, planConfig, selectedPlan || planConfig.displayName);
        return {
            type: 'ai_response',
            message: response,
            metadata: { context, confidence: 1, planName: planConfig.displayName }
        };
    } catch (error) {
        console.error('RAG System Error:', error);
        return {
            type: 'error',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            metadata: { confidence: 0 }
        };
    }
}

// Initialize Pinecone client and OpenAI
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Export helper functions for testing
export const _test = {
    generateEmbeddings,
    retrieveSingleBestContext,
    generateResponse,
    getPlanConfig
};