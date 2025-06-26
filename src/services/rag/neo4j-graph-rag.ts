import { Neo4jService } from '../neo4j';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';
import { normalizeL2 } from '@/utils/vector-utils';
import * as crypto from 'crypto';

/**
 * Service for implementing Graph RAG (Retrieval Augmented Generation) with Neo4j
 * This enhances traditional RAG by modeling relationships between chunks
 * as a graph in Neo4j, enabling more contextual and comprehensive retrieval.
 */
export class Neo4jGraphRAGService {
  private static instance: Neo4jGraphRAGService;
  private embedder: GeminiEmbeddingService;
  private neo4j: Neo4jService;
  private similarityThreshold: number = 0.75; // Threshold for creating semantic edges

  private constructor() {
    this.embedder = GeminiEmbeddingService.getInstance();
    this.neo4j = Neo4jService.getInstance();
    console.log(`[${new Date().toISOString()}] Neo4j Graph RAG Service initialized`);
  }

  public static getInstance(): Neo4jGraphRAGService {
    if (!Neo4jGraphRAGService.instance) {
      Neo4jGraphRAGService.instance = new Neo4jGraphRAGService();
    }
    return Neo4jGraphRAGService.instance;
  }

  /**
   * Process a document and create a knowledge graph in Neo4j
   * @param documentId The ID of the document
   * @param title The title of the document
   * @param chunks The text chunks from the document
   * @param metadata Additional metadata for the document
   */
  async processDocumentToGraph(
    documentId: string,
    title: string,
    chunks: string[],
    metadata: Record<string, any> = {}
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    try {
      console.log(`[${new Date().toISOString()}] Processing document to Neo4j graph: ${documentId}`);

      // 1. Create document node
      await this.neo4j.createDocumentNode(documentId, title, metadata);
      
      // 2. Create nodes for each chunk
      const chunkNodes = await Promise.all(
        chunks.map(async (chunk, index) => {
          const embedding = await this.embedder.generateEmbedding(chunk);
          const normalizedEmbedding = normalizeL2(embedding);
          
          const chunkId = this.generateNodeId(documentId, index);
          
          await this.neo4j.createChunkNode(
            chunkId,
            documentId,
            chunk,
            normalizedEmbedding,
            {
              chunkIndex: index,
              nodeType: 'chunk',
            }
          );
          
          return {
            id: chunkId,
            content: chunk,
            embedding: normalizedEmbedding,
            index
          };
        })
      );

      // 3. Create edges between nodes
      let edgeCount = 0;
      
      // 3.1 Create sequential edges (connecting adjacent chunks)
      for (let i = 0; i < chunkNodes.length - 1; i++) {
        await this.neo4j.createChunkRelationship(
          chunkNodes[i].id,
          chunkNodes[i + 1].id,
          'SEQUENTIAL',
          1.0 // Maximum weight for sequential connections
        );
        edgeCount++;
      }
      
      // 3.2 Create semantic edges (connecting semantically similar chunks)
      for (let i = 0; i < chunkNodes.length; i++) {
        for (let j = i + 2; j < chunkNodes.length; j++) { // Skip adjacent chunks (already connected)
          const similarity = this.cosineSimilarity(chunkNodes[i].embedding, chunkNodes[j].embedding);
          
          if (similarity > this.similarityThreshold) {
            await this.neo4j.createChunkRelationship(
              chunkNodes[i].id,
              chunkNodes[j].id,
              'SEMANTIC',
              similarity
            );
            edgeCount++;
          }
        }
      }

      console.log(`[${new Date().toISOString()}] Neo4j graph created with ${chunkNodes.length} nodes and ${edgeCount} edges`);
      
      return { 
        nodeCount: chunkNodes.length,
        edgeCount 
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creating Neo4j knowledge graph:`, error);
      throw error;
    }
  }

  /**
   * Retrieve relevant context using graph-based retrieval from Neo4j
   * @param query The user query
   * @param topK Number of initial nodes to retrieve
   * @param expansionSteps Number of graph expansion steps
   */
  async retrieveWithGraphExpansion(
    query: string,
    topK: number = 3,
    expansionSteps: number = 1
  ): Promise<string> {
    try {
      console.log(`[${new Date().toISOString()}] Retrieving with Neo4j graph expansion for query: ${query}`);
      
      // 1. Generate embedding for the query
      const queryEmbedding = await this.embedder.generateEmbedding(query);
      const normalizedQueryEmbedding = normalizeL2(queryEmbedding);
      
      // 2. Find similar chunks using vector similarity
      const similarChunks = await this.neo4j.findSimilarChunks(normalizedQueryEmbedding, topK);
      
      // 3. Extract the initial node IDs
      const initialNodeIds = similarChunks.map(record => record.get('id'));
      
      if (initialNodeIds.length === 0) {
        return "No relevant information found for this query.";
      }
      
      // 4. Expand the graph by following edges
      const expandedNodes = await this.neo4j.expandGraph(initialNodeIds, expansionSteps);
      
      // 5. Combine the content into a context string
      const context = expandedNodes.map(record => record.get('content')).join('\n\n');
      
      console.log(`[${new Date().toISOString()}] Retrieved ${expandedNodes.length} nodes after Neo4j graph expansion`);
      
      return context;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in Neo4j graph-based retrieval:`, error);
      throw error;
    }
  }

  /**
   * Get all documents from Neo4j
   */
  async getAllDocuments(): Promise<Array<{id: string, title: string, createdAt: string}>> {
    try {
      const records = await this.neo4j.getAllDocuments();
      return records.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        createdAt: record.get('createdAt')
      }));
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error getting documents from Neo4j:`, error);
      return [];
    }
  }

  /**
   * Get document by ID from Neo4j
   * @param documentId Document ID
   */
  async getDocumentById(documentId: string): Promise<{id: string, title: string, createdAt: string} | null> {
    try {
      const record = await this.neo4j.getDocumentById(documentId);
      if (!record) return null;
      
      return {
        id: record.get('id'),
        title: record.get('title'),
        createdAt: record.get('createdAt')
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error getting document from Neo4j:`, error);
      return null;
    }
  }

  /**
   * Generate a unique ID for a node
   */
  private generateNodeId(documentId: string, chunkIndex: number): string {
    return crypto.createHash('sha256').update(`${documentId}-chunk-${chunkIndex}`).digest('hex');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
}