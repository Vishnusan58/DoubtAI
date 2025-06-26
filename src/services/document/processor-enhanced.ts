import { GeminiEmbeddingService } from '../embeddings/gemini-embeddings-fixed';
import { TextChunker } from '@/utils/text-chunking';
import { systemConfig } from '@/types/config';
import { PineconeService } from '../pinecone';
import { AzureSearchService } from '@/services/search/azure-search';
import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { azureConfig } from "@/config/azure-config";

export class DocumentProcessor {
    private embedder: GeminiEmbeddingService;
    private chunker: TextChunker;
    private pinecone: PineconeService;
    private azureSearchClient: SearchIndexClient | null = null;

    // Consistent index name configuration
    private readonly PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "myvectordbb";

    constructor() {
        this.embedder = GeminiEmbeddingService.getInstance();
        this.chunker = new TextChunker(500);
        this.pinecone = new PineconeService();

        // Initialize Azure Search client
        try {
            const endpoint = process.env.AZURE_SEARCH_ENDPOINT || azureConfig.search?.endpoint;
            const apiKey = process.env.AZURE_SEARCH_API_KEY || azureConfig.search?.apiKey;

            if (endpoint && apiKey) {
                this.azureSearchClient = new SearchIndexClient(
                    endpoint,
                    new AzureKeyCredential(apiKey)
                );
                console.log(`[${new Date().toISOString()}] Azure Search client initialized successfully`);
            } else {
                console.warn(`[${new Date().toISOString()}] Azure Search credentials missing, will use Pinecone as primary storage`);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to initialize Azure Search:`, error);
            console.log(`[${new Date().toISOString()}] Will use Pinecone as fallback`);
        }

        console.log(`[${new Date().toISOString()}] Using Pinecone index: ${this.PINECONE_INDEX_NAME}`);
    }

    async processDocument(tenantId: string, document: Buffer): Promise<ProcessingResult> {
        try {
            // Convert buffer to text
            const text = document.toString('utf-8');

            // Split into chunks
            const chunks = this.chunker.splitIntoChunks(text);

            console.log(`[${new Date().toISOString()}] Generating embeddings for ${chunks.length} chunks`);

            // Generate embeddings for each chunk individually using Promise.all
            const embeddings = await Promise.all(
                chunks.map(chunk => this.embedder.generateEmbedding(chunk))
            );

            console.log(`[${new Date().toISOString()}] Embeddings generated successfully`);

            // First try to store in Azure AI Search if available
            if (this.azureSearchClient) {
                try {
                    const azureIndexName = process.env.AZURE_SEARCH_INDEX_NAME ||
                        azureConfig.search?.indexName ||
                        'myvectordbb';

                    console.log(`[${new Date().toISOString()}] Attempting to store vectors in Azure AI Search index: ${azureIndexName}`);

                    const searchDocuments = embeddings.map((embedding, idx) => ({
                        id: `${tenantId}-${Date.now()}-${idx}`,
                        content: chunks[idx],
                        embedding: embedding,
                        tenantId: tenantId,
                        title: `Document Chunk ${idx + 1}`,
                        metadata: {
                            processedBy: systemConfig.currentUser,
                            processedAt: systemConfig.timestamp,
                            modelName: 'gemini-embeddings'
                        }
                    }));

                    const searchClient = this.azureSearchClient.getSearchClient(azureIndexName);
                    const storageResult = await searchClient.uploadDocuments(searchDocuments);

                    console.log(`[${new Date().toISOString()}] Successfully stored documents in Azure AI Search`);

                    return {
                        status: 'success',
                        chunksProcessed: chunks.length,
                        embeddings: embeddings.length,
                        metadata: {
                            processedBy: systemConfig.currentUser,
                            processedAt: systemConfig.timestamp,
                            modelName: 'gemini-embeddings',
                            storageProvider: 'Azure AI Search',
                            indexName: azureIndexName
                        }
                    };
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Failed to store vectors in Azure AI Search:`, error);
                    console.log(`[${new Date().toISOString()}] Falling back to Pinecone...`);
                }
            }

            // Fall back to Pinecone - using consistent index name
            console.log(`[${new Date().toISOString()}] Using Pinecone for vector storage with index: ${this.PINECONE_INDEX_NAME}`);

            const vectors = embeddings.map((embedding, idx) => ({
                id: `${tenantId}-${Date.now()}-${idx}`,
                values: embedding,
                metadata: {
                    text: chunks[idx],
                    processedBy: systemConfig.currentUser,
                    processedAt: systemConfig.timestamp,
                    modelName: 'gemini-embeddings',
                    tenantId: tenantId
                }
            }));

            try {
                const pineconeInstance = PineconeService.getInstance();

                // Check if index exists first
                try {
                    const indexList = await pineconeInstance.listIndexes();
                    const indexExists = indexList.indexes?.some(idx => idx.name === this.PINECONE_INDEX_NAME);

                    if (!indexExists) {
                        console.error(`[${new Date().toISOString()}] Pinecone index '${this.PINECONE_INDEX_NAME}' does not exist`);
                        console.log(`[${new Date().toISOString()}] Available indexes:`, indexList.indexes?.map(idx => idx.name));
                        throw new Error(`Pinecone index '${this.PINECONE_INDEX_NAME}' not found`);
                    }
                } catch (listError) {
                    console.warn(`[${new Date().toISOString()}] Could not verify index existence, proceeding anyway:`, listError);
                }

                const index = pineconeInstance.Index(this.PINECONE_INDEX_NAME);
                const upsertResult = await index.upsert(vectors);

                console.log(`[${new Date().toISOString()}] Successfully stored vectors in Pinecone index: ${this.PINECONE_INDEX_NAME}`);

                return {
                    status: 'success',
                    chunksProcessed: chunks.length,
                    embeddings: embeddings.length,
                    metadata: {
                        processedBy: systemConfig.currentUser,
                        processedAt: systemConfig.timestamp,
                        modelName: 'gemini-embeddings',
                        storageProvider: 'Pinecone',
                        indexName: this.PINECONE_INDEX_NAME
                    }
                };
            } catch (pineconeError) {
                console.error(`[${new Date().toISOString()}] Failed to store vectors in Pinecone:`, pineconeError);
                throw pineconeError;
            }
        } catch (error) {
            console.error('[' + new Date().toISOString() + '] Document processing failed:', error);
            throw error;
        }
    }

    /**
     * Verify that a vector was successfully stored in Pinecone
     */
    private async verifyStorage(vectorId: string): Promise<void> {
        try {
            console.log(`[${new Date().toISOString()}] Verifying storage of vector: ${vectorId}`);

            const pineconeInstance = PineconeService.getInstance();
            const index = pineconeInstance.Index(this.PINECONE_INDEX_NAME);
            const fetchResult = await index.fetch([vectorId]);

            if (fetchResult && fetchResult.vectors && fetchResult.vectors[vectorId]) {
                console.log(`[${new Date().toISOString()}] Vector storage verified successfully`);
            } else {
                console.warn(`[${new Date().toISOString()}] Warning: Vector ${vectorId} not found after upsert`);
            }
        } catch (verificationError) {
            console.warn(`[${new Date().toISOString()}] Could not verify vector storage:`, verificationError);
        }
    }

    /**
     * Check if vectors exist in Pinecone for a given tenant
     */
    async checkVectorsExist(tenantId: string, vectorIds: string[]): Promise<{ [id: string]: boolean }> {
        try {
            const pineconeInstance = PineconeService.getInstance();
            const index = pineconeInstance.Index(this.PINECONE_INDEX_NAME);
            const fetchResult = await index.fetch(vectorIds);
            const existenceMap: { [id: string]: boolean } = {};

            vectorIds.forEach(id => {
                existenceMap[id] = !!(fetchResult?.vectors?.[id]);
            });

            return existenceMap;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error checking vector existence:`, error);
            throw error;
        }
    }

    /**
     * Search for similar documents in Azure AI Search first, then fall back to Pinecone if needed
     */
    async searchSimilarDocuments(query: string, tenantId: string, topK: number = 5): Promise<SearchResult[]> {
        try {
            console.log(`[${new Date().toISOString()}] Generating embedding for search query: "${query}"`);
            const queryEmbedding = await this.embedder.generateEmbedding(query);

            // Try Azure Search first
            if (this.azureSearchClient) {
                try {
                    const azureIndexName = process.env.AZURE_SEARCH_INDEX_NAME ||
                        azureConfig.search?.indexName ||
                        'myvectordbb';

                    console.log(`[${new Date().toISOString()}] Searching Azure AI Search index: ${azureIndexName}`);

                    const searchClient = this.azureSearchClient.getSearchClient(azureIndexName);

                    const searchResults = await searchClient.search("", {
                        vectorQueries: [
                            {
                                vector: queryEmbedding,
                                fields: "embedding",
                                k: topK
                            }
                        ],
                        select: ["id", "content", "metadata", "title", "tenantId"],
                        filter: tenantId ? `tenantId eq '${tenantId}'` : undefined
                    });

                    const results: SearchResult[] = [];
                    for await (const result of searchResults.results) {
                        results.push({
                            id: result.document.id,
                            content: result.document.content,
                            metadata: result.document.metadata,
                            score: result.score || 0,
                            title: result.document.title || "Untitled Document"
                        });
                    }

                    console.log(`[${new Date().toISOString()}] Azure AI Search returned ${results.length} results`);
                    return results;
                } catch (azureError) {
                    console.error(`[${new Date().toISOString()}] Azure AI Search failed:`, azureError);
                    console.log(`[${new Date().toISOString()}] Falling back to Pinecone for search...`);
                }
            }

            // Fall back to Pinecone search - using consistent index name
            console.log(`[${new Date().toISOString()}] Searching in Pinecone index: ${this.PINECONE_INDEX_NAME}`);

            const pineconeInstance = PineconeService.getInstance();

            // Check if index exists before searching
            try {
                const indexList = await pineconeInstance.listIndexes();
                const indexExists = indexList.indexes?.some(idx => idx.name === this.PINECONE_INDEX_NAME);

                if (!indexExists) {
                    console.error(`[${new Date().toISOString()}] Pinecone index '${this.PINECONE_INDEX_NAME}' does not exist for search`);
                    console.log(`[${new Date().toISOString()}] Available indexes:`, indexList.indexes?.map(idx => idx.name));
                    throw new Error(`Pinecone index '${this.PINECONE_INDEX_NAME}' not found`);
                }
            } catch (listError) {
                console.warn(`[${new Date().toISOString()}] Could not verify index existence for search, proceeding anyway:`, listError);
            }

            const index = pineconeInstance.Index(this.PINECONE_INDEX_NAME);

            const queryResponse = await index.query({
                vector: queryEmbedding,
                topK,
                includeMetadata: true,
                filter: tenantId ? { tenantId } : undefined
            });

            const results: SearchResult[] = queryResponse.matches.map(match => ({
                id: match.id,
                content: match.metadata?.text || "",
                metadata: match.metadata || {},
                score: match.score,
                title: match.metadata?.title || "Document Fragment"
            }));

            console.log(`[${new Date().toISOString()}] Pinecone returned ${results.length} results`);
            return results;

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error searching for similar documents:`, error);
            throw error;
        }
    }
}

interface ProcessingResult {
    status: 'success' | 'error';
    chunksProcessed: number;
    embeddings: number;
    metadata: {
        processedBy: string;
        processedAt: string;
        modelName: string;
        storageProvider?: string;
        indexName?: string;
    };
}

interface SearchResult {
    id: string;
    content: string;
    metadata: Record<string, any>;
    score: number;
    title: string;
}