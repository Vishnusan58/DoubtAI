import { GoogleGenerativeAI } from '@google/generative-ai';
import { PineconeService } from '../pinecone';
import { systemConfig } from '@/types/config';
import { GraphRAGService } from './graph-rag';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';

/**
 * Enhanced RAG Engine that uses Graph-based retrieval
 * This extends the traditional RAG system with graph-based context expansion
 */
export class GraphRAGEngine {
    private gemini: GoogleGenerativeAI;
    private pinecone: PineconeService;
    private graphRAG: GraphRAGService;
    private embedder: GeminiEmbeddingService;

    constructor() {
        this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        this.pinecone = new PineconeService();
        this.graphRAG = GraphRAGService.getInstance();
        this.embedder = GeminiEmbeddingService.getInstance();
        console.log(`[${new Date().toISOString()}] Graph RAG Engine initialized`);
    }

    /**
     * Generate a response using Graph-based RAG
     * @param tenantId Tenant ID for multi-tenancy support
     * @param query User query
     * @param options Additional options for retrieval and generation
     */
    async generateResponse(
        tenantId: string, 
        query: string,
        options: {
            topK?: number;
            expansionSteps?: number;
            temperature?: number;
        } = {}
    ) {
        try {
            console.log(`[${new Date().toISOString()}] Generating response for query: "${query}"`);
            
            // Set default options
            const topK = options.topK || 3;
            const expansionSteps = options.expansionSteps || 1;
            const temperature = options.temperature || 0.2;
            
            // Retrieve context using graph-based retrieval
            const context = await this.graphRAG.retrieveWithGraphExpansion(
                query,
                topK,
                expansionSteps
            );
            
            // Generate response using the retrieved context
            const response = await this.generateLLMResponse(query, context, temperature);
            
            return {
                response,
                metadata: {
                    generatedBy: systemConfig.currentUser,
                    timestamp: new Date().toISOString(),
                    tenantId,
                    retrievalMethod: 'graph-rag',
                    topK,
                    expansionSteps
                }
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Graph RAG processing failed:`, error);
            throw error;
        }
    }

    /**
     * Process a document and create a knowledge graph
     * @param documentId Document ID
     * @param content Document content
     * @param metadata Additional metadata
     */
    async processDocument(
        documentId: string,
        content: string,
        metadata: Record<string, any> = {}
    ) {
        try {
            console.log(`[${new Date().toISOString()}] Processing document for Graph RAG: ${documentId}`);
            
            // Split content into chunks
            const chunks = this.splitIntoChunks(content);
            
            // Process document to graph
            const result = await this.graphRAG.processDocumentToGraph(
                documentId,
                chunks.map(chunk => chunk.content),
                {
                    ...metadata,
                    processedAt: new Date().toISOString(),
                    processedBy: systemConfig.currentUser
                }
            );
            
            return {
                documentId,
                nodeCount: result.nodes.length,
                edgeCount: result.edges.length,
                metadata: {
                    ...metadata,
                    processedAt: new Date().toISOString(),
                    processedBy: systemConfig.currentUser
                }
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error processing document for Graph RAG:`, error);
            throw error;
        }
    }

    /**
     * Generate a response using the LLM
     * @param query User query
     * @param context Retrieved context
     * @param temperature Temperature for generation
     */
    private async generateLLMResponse(
        query: string,
        context: string,
        temperature: number = 0.2
    ): Promise<string> {
        try {
            const model = this.gemini.getGenerativeModel({ 
                model: "gemini-1.5-flash-latest",
                generationConfig: {
                    temperature,
                    maxOutputTokens: 800,
                }
            });
            
            const prompt = `
You are an AI assistant that answers questions based on the provided context.

CONTEXT:
${context}

QUESTION:
${query}

Instructions:
1. Answer the question based ONLY on the information provided in the CONTEXT.
2. If the CONTEXT doesn't contain enough information to answer the question, say "I don't have enough information to answer that question."
3. Keep your answer concise, informative, and directly related to the question.
4. Do not mention that you're using a provided context in your answer.

ANSWER:`;
            
            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error generating LLM response:`, error);
            return "I'm sorry, I encountered an error while generating a response.";
        }
    }

    /**
     * Split content into chunks
     * @param content Document content
     */
    private splitIntoChunks(content: string): Array<{ content: string; startPosition: number; endPosition: number }> {
        // Split by paragraphs (double newlines)
        const paragraphs = content.split(/\n\s*\n/);
        
        let currentPosition = 0;
        return paragraphs
            .filter(p => p.trim().length > 0) // Remove empty paragraphs
            .map(paragraph => {
                const start = currentPosition;
                const end = start + paragraph.length;
                currentPosition = end + 2; // +2 for the double newline
                return {
                    content: paragraph.trim(),
                    startPosition: start,
                    endPosition: end
                };
            });
    }
}