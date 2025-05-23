// lib/ragHelper-enhanced.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai";
import { DocumentProcessor } from '@/services/document/processor';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings-fixed';

interface ChatMessageForHistory {
    type: 'user' | 'bot' | 'ai_response' | 'system' | 'function';
    content: string;
}

// Keep the interface but we won't use it for local JSON anymore
interface PlanServiceEntry {
    Plan: string;
    Service: string;
    In_Network_Cost: string;
    Out_of_Network_Coverage: string;
    Prior_Authorization_Required: string;
    Other_Notes: string;
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'your_google_api_key_env_variable_name';

if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_env_variable_name') {
    console.warn("Google API Key for Gemini is not set or is using the default placeholder.");
}

interface RAGResponse {
    type: 'ai_response' | 'error';
    message: string;
    metadata?: {
        context?: string;
        confidence?: number;
        planName?: string;
        source?: string;
    };
}

// Simplified PlanConfig, primarily for display name.
interface PlanConfig {
    displayName: string;
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
// Initialize our document processor for vector search
const documentProcessor = new DocumentProcessor();
const embeddingService = GeminiEmbeddingService.getInstance();

function formatChatHistoryForGemini(chatHistory: ChatMessageForHistory[]): Content[] {
    const geminiReadyHistory: Content[] = [];
    const recentHistory = chatHistory.slice(-10); // Keep last 10 turns (5 user, 5 bot)
    let currentRoleExpected: 'user' | 'model' = 'user';

    for (const msg of recentHistory) {
        const msgRole = (msg.type === 'user') ? 'user' : 'model';
        if (geminiReadyHistory.length === 0) {
            if (msgRole === 'user') {
                geminiReadyHistory.push({ role: msgRole, parts: [{ text: msg.content }] });
                currentRoleExpected = 'model';
            }
        } else {
            if (msgRole === currentRoleExpected) {
                geminiReadyHistory.push({ role: msgRole, parts: [{ text: msg.content }] });
                currentRoleExpected = (currentRoleExpected === 'user') ? 'model' : 'user';
            } else {
                console.warn(`Skipping message in history due to role sequence: expected ${currentRoleExpected}, got ${msgRole}`);
            }
        }
    }
    return geminiReadyHistory;
}

/**
 * Retrieve context from vector stores (Azure AI Search or Pinecone)
 */
async function retrieveContextFromVectorStore(query: string, tenantId: string = 'default', topK: number = 5): Promise<{
    context: string;
    source: string;
    confidence: number;
}> {
    try {
        console.log(`[${new Date().toISOString()}] Retrieving context from vector stores for query: "${query.substring(0, 50)}..."`);

        // Generate embedding for the query
        const queryEmbedding = await embeddingService.generateEmbedding(query);

        // Use DocumentProcessor's searchSimilarDocuments method (which tries Azure first, then Pinecone)
        const searchResults = await documentProcessor.searchSimilarDocuments(query, tenantId, topK);

        if (searchResults && searchResults.length > 0) {
            // Combine the relevant context from search results
            const context = searchResults.map((result, index) =>
                `[${index + 1}] ${result.content || 'No content available'}`
            ).join('\n\n');

            const source = searchResults[0].metadata?.storageProvider || 'Vector Search';
            const confidence = Math.min(0.7 + (searchResults.length / 20), 0.95); // Confidence based on number of results

            console.log(`[${new Date().toISOString()}] Successfully retrieved ${searchResults.length} context items from ${source}`);
            return { context, source, confidence };
        } else {
            console.log(`[${new Date().toISOString()}] No results found from vector search`);
            return {
                context: "No specific information found in knowledge base.",
                source: "No Results",
                confidence: 0.1
            };
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error retrieving context from vector store:`, error);
        throw error;
    }
}

async function generateResponseWithGemini(
    currentQuery: string,
    retrievedContext: string,
    contextSource: string,
    chatHistory: ChatMessageForHistory[],
    planName?: string
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const formattedHistory = formatChatHistoryForGemini(chatHistory);

        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.25,
            } as GenerationConfig,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

        // Updated system prompt to reflect using retrieved context from vector search
        const promptForCurrentTurn = `You are Aptia's Open Enrollment Assistant.
${planName ? `You are currently discussing the "${planName}" plan.` : ''}
You have access to the following information retrieved from Aptia's knowledge base:
--- BEGIN RETRIEVED INFORMATION ---
${retrievedContext || "No specific information found in the knowledge base for this query."}
--- END RETRIEVED INFORMATION ---

Instructions:
1. Answer the user's "Current Question" based *ONLY* on the "RETRIEVED INFORMATION" provided above.
2. If the "RETRIEVED INFORMATION" doesn't contain what the user is asking about, clearly state that you don't have that specific information in your knowledge base. DO NOT invent answers or use external knowledge.
3. Refer to the "CHAT HISTORY" (already part of our conversation) to understand the flow and provide contextually relevant responses.
4. Keep responses concise, helpful, and easy to understand.
5. Do not mention that your knowledge comes from vector search, Azure AI, or Pinecone. Just reference "our records" or "the information I have".

CHAT HISTORY:
(Chat history is implicitly part of our conversation turns)

Current Question: ${currentQuery}
Answer:`;

        const result = await chat.sendMessage(promptForCurrentTurn);
        const response = result.response;
        const text = response.text();

        return text.trim() || "I'm unable to generate a response at this time.";

    } catch (error) {
        console.error('Error generating Gemini response:', error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
            return "There's an issue with accessing the AI service (API key). Please contact support.";
        }
        if (error instanceof Error && error.message.includes("must be 'user'")) {
            console.error("Gemini History Error Detail: The history likely didn't start with a user message after formatting, or was malformed.");
            return "I had a problem remembering our conversation's flow. Could you try rephrasing or starting this specific query again?";
        }
        return "An error occurred while processing your query. Please try asking again.";
    }
}

// Main RAG function that uses vector search
export async function queryRAGSystem(
    query: string,
    chatHistory: ChatMessageForHistory[] = [],
    planNameFromFrontend?: string
): Promise<RAGResponse> {
    try {
        if (!query.trim()) {
            return { type: 'error', message: "Query cannot be empty." };
        }

        console.log(`[${new Date().toISOString()}] Processing RAG query: "${query.substring(0, 50)}..." for plan: ${planNameFromFrontend || 'unspecified'}`);

        // Only use vector search (Azure AI or Pinecone)
        let retrievedContext = '';
        let contextSource = '';
        let confidence = 0;

        try {
            const tenantId = 'default'; // You can make this dynamic if you have multi-tenant setup
            const vectorResults = await retrieveContextFromVectorStore(query, tenantId);

            retrievedContext = vectorResults.context;
            contextSource = vectorResults.source;
            confidence = vectorResults.confidence;

            console.log(`[${new Date().toISOString()}] Retrieved context from ${contextSource}`);
        } catch (vectorError) {
            console.error(`[${new Date().toISOString()}] Vector search failed:`, vectorError);
            return {
                type: 'error',
                message: "I couldn't access the vector database to answer your question. Please try again later.",
                metadata: { confidence: 0 }
            };
        }

        if (retrievedContext === '' || confidence === 0) {
            return {
                type: 'error',
                message: "I couldn't find any relevant information in our vector database to answer your question. Could you try asking something else?"
            };
        }

        // Generate the response with Gemini using the retrieved context
        const llmResponse = await generateResponseWithGemini(
            query,
            retrievedContext,
            contextSource,
            chatHistory,
            planNameFromFrontend
        );

        return {
            type: 'ai_response',
            message: llmResponse,
            metadata: {
                context: retrievedContext.substring(0, 400) + (retrievedContext.length > 400 ? "..." : ""),
                planName: planNameFromFrontend,
                confidence: confidence,
                source: contextSource
            }
        };

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Critical System Error in RAG:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unexpected critical error in the RAG system.';
        return {
            type: 'error',
            message: "I'm sorry, I encountered a problem trying to answer your question. Please try again later.",
            metadata: { confidence: 0 }
        };
    }
}

export const _test = {
    retrieveContextFromVectorStore,
    generateResponseWithGemini,
    formatChatHistoryForGemini
};
