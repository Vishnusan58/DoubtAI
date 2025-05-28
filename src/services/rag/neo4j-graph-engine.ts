import { GoogleGenerativeAI } from '@google/generative-ai';
import { Neo4jGraphRAGService } from './neo4j-graph-rag';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';
import { PDFProcessor } from '../document/pdf-processor';
import * as crypto from 'crypto';

/**
 * Enhanced RAG Engine that uses Neo4j-based Graph RAG
 * This extends the traditional RAG system with graph-based context expansion using Neo4j
 */
export class Neo4jGraphRAGEngine {
    private gemini: GoogleGenerativeAI;
    private graphRAG: Neo4jGraphRAGService;
    private embedder: GeminiEmbeddingService;
    private pdfProcessor: PDFProcessor;

    constructor() {
        this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
        this.graphRAG = Neo4jGraphRAGService.getInstance();
        this.embedder = GeminiEmbeddingService.getInstance();
        this.pdfProcessor = PDFProcessor.getInstance();
        console.log(`[${new Date().toISOString()}] Neo4j Graph RAG Engine initialized`);
    }

    /**
     * Generate a response using Neo4j Graph-based RAG
     * @param query User query
     * @param options Additional options for retrieval and generation
     */
    async generateResponse(
        query: string,
        options: {
            documentId?: string;
            tenantId?: string;
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
                    timestamp: new Date().toISOString(),
                    documentId: options.documentId,
                    tenantId: options.tenantId || 'admin',
                    retrievalMethod: 'neo4j-graph-rag',
                    topK,
                    expansionSteps
                }
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Neo4j Graph RAG processing failed:`, error);
            throw error;
        }
    }

    /**
     * Process a PDF document and create a knowledge graph in Neo4j
     * @param pdfBuffer PDF buffer
     * @param title Document title
     * @param metadata Additional metadata
     */
    async processPdfDocument(
        pdfBuffer: Buffer,
        title: string,
        metadata: Record<string, any> = {}
    ) {
        try {
            console.log(`[${new Date().toISOString()}] Processing PDF document for Neo4j Graph RAG: ${title}`);
            
            // Generate a document ID
            const documentId = `doc-${crypto.randomUUID()}`;
            
            // Extract text from PDF
            const content = await this.pdfProcessor.extractTextFromPDF(pdfBuffer);
            
            // Split content into chunks
            const chunks = this.splitIntoChunks(content);
            
            // Process document to graph
            const result = await this.graphRAG.processDocumentToGraph(
                documentId,
                title,
                chunks.map(chunk => chunk.content),
                {
                    ...metadata,
                    processedAt: new Date().toISOString(),
                    fileSize: pdfBuffer.length,
                    documentType: 'pdf'
                }
            );
            
            return {
                documentId,
                title,
                nodeCount: result.nodeCount,
                edgeCount: result.edgeCount,
                metadata: {
                    ...metadata,
                    processedAt: new Date().toISOString(),
                    fileSize: pdfBuffer.length,
                    documentType: 'pdf'
                }
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error processing PDF document for Neo4j Graph RAG:`, error);
            throw error;
        }
    }

    /**
     * Get all documents from Neo4j
     */
    async getAllDocuments() {
        return this.graphRAG.getAllDocuments();
    }

    /**
     * Get document by ID from Neo4j
     * @param documentId Document ID
     */
    async getDocumentById(documentId: string) {
        return this.graphRAG.getDocumentById(documentId);
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