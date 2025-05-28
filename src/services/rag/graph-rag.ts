import { PineconeService } from '../pinecone';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';
import { normalizeL2 } from '@/utils/vector-utils';
import * as crypto from 'crypto';

/**
 * Interface for a node in the knowledge graph
 */
interface GraphNode {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    documentId: string;
    chunkIndex: number;
    nodeType: 'chunk' | 'entity' | 'concept';
    [key: string]: any;
  };
}

/**
 * Interface for an edge in the knowledge graph
 */
interface GraphEdge {
  source: string; // Source node ID
  target: string; // Target node ID
  weight: number; // Edge weight (e.g., similarity score)
  type: 'semantic' | 'sequential' | 'hierarchical' | 'reference';
}

/**
 * Service for implementing Graph RAG (Retrieval Augmented Generation)
 * This enhances traditional RAG by modeling relationships between chunks
 * as a graph, enabling more contextual and comprehensive retrieval.
 */
export class GraphRAGService {
  private static instance: GraphRAGService;
  private embedder: GeminiEmbeddingService;
  private pinecone: PineconeService;
  private similarityThreshold: number = 0.75; // Threshold for creating semantic edges

  private constructor() {
    this.embedder = GeminiEmbeddingService.getInstance();
    this.pinecone = new PineconeService();
    console.log(`[${new Date().toISOString()}] Graph RAG Service initialized`);
  }

  public static getInstance(): GraphRAGService {
    if (!GraphRAGService.instance) {
      GraphRAGService.instance = new GraphRAGService();
    }
    return GraphRAGService.instance;
  }

  /**
   * Process a document and create a knowledge graph
   * @param documentId The ID of the document
   * @param chunks The text chunks from the document
   * @param metadata Additional metadata for the document
   */
  async processDocumentToGraph(
    documentId: string,
    chunks: string[],
    metadata: Record<string, any> = {}
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    try {
      console.log(`[${new Date().toISOString()}] Processing document to graph: ${documentId}`);

      // 1. Create nodes for each chunk
      const nodes: GraphNode[] = await Promise.all(
        chunks.map(async (chunk, index) => {
          const embedding = await this.embedder.generateEmbedding(chunk);
          const normalizedEmbedding = normalizeL2(embedding);
          
          return {
            id: this.generateNodeId(documentId, index),
            content: chunk,
            embedding: normalizedEmbedding,
            metadata: {
              documentId,
              chunkIndex: index,
              nodeType: 'chunk',
              ...metadata
            }
          };
        })
      );

      // 2. Create edges between nodes
      const edges: GraphEdge[] = [];
      
      // 2.1 Create sequential edges (connecting adjacent chunks)
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          source: nodes[i].id,
          target: nodes[i + 1].id,
          weight: 1.0, // Maximum weight for sequential connections
          type: 'sequential'
        });
      }
      
      // 2.2 Create semantic edges (connecting semantically similar chunks)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 2; j < nodes.length; j++) { // Skip adjacent chunks (already connected)
          const similarity = this.cosineSimilarity(nodes[i].embedding, nodes[j].embedding);
          
          if (similarity > this.similarityThreshold) {
            edges.push({
              source: nodes[i].id,
              target: nodes[j].id,
              weight: similarity,
              type: 'semantic'
            });
          }
        }
      }

      // 3. Store nodes in Pinecone
      await this.storeGraphNodes(nodes);
      
      // 4. Store edges (could be in a separate database or in Pinecone metadata)
      await this.storeGraphEdges(edges);

      console.log(`[${new Date().toISOString()}] Graph created with ${nodes.length} nodes and ${edges.length} edges`);
      
      return { nodes, edges };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creating knowledge graph:`, error);
      throw error;
    }
  }

  /**
   * Retrieve relevant context using graph-based retrieval
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
      console.log(`[${new Date().toISOString()}] Retrieving with graph expansion for query: ${query}`);
      
      // 1. Generate embedding for the query
      const queryEmbedding = await this.embedder.generateEmbedding(query);
      const normalizedQueryEmbedding = normalizeL2(queryEmbedding);
      
      // 2. Get Pinecone index
      const index = this.pinecone.getInstance().Index('docuflow-production');
      
      // 3. Initial vector search to find entry points in the graph
      const initialResults = await index.query({
        vector: normalizedQueryEmbedding,
        topK,
        includeMetadata: true
      });
      
      // 4. Extract the initial node IDs
      const retrievedNodeIds = new Set<string>();
      initialResults.matches.forEach(match => {
        retrievedNodeIds.add(match.id);
      });
      
      // 5. Expand the graph by following edges
      for (let step = 0; step < expansionSteps; step++) {
        const nodesToExpand = Array.from(retrievedNodeIds);
        
        // For each node, find its connected nodes
        for (const nodeId of nodesToExpand) {
          const connectedNodes = await this.getConnectedNodes(nodeId);
          
          // Add connected nodes to the set
          connectedNodes.forEach(connectedNodeId => {
            retrievedNodeIds.add(connectedNodeId);
          });
        }
      }
      
      // 6. Retrieve the content of all nodes
      const expandedNodes = await this.getNodesContent(Array.from(retrievedNodeIds));
      
      // 7. Combine the content into a context string
      const context = expandedNodes.map(node => node.content).join('\n\n');
      
      console.log(`[${new Date().toISOString()}] Retrieved ${expandedNodes.length} nodes after graph expansion`);
      
      return context;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in graph-based retrieval:`, error);
      throw error;
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

  /**
   * Store graph nodes in Pinecone
   */
  private async storeGraphNodes(nodes: GraphNode[]): Promise<void> {
    try {
      const index = this.pinecone.getInstance().Index('docuflow-production');
      
      // Convert nodes to Pinecone vectors
      const vectors = nodes.map(node => ({
        id: node.id,
        values: node.embedding,
        metadata: {
          content: node.content,
          ...node.metadata
        }
      }));
      
      // Upsert vectors in batches (Pinecone has limits on batch size)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
      }
      
      console.log(`[${new Date().toISOString()}] Stored ${nodes.length} graph nodes in Pinecone`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error storing graph nodes:`, error);
      throw error;
    }
  }

  /**
   * Store graph edges (in this implementation, we store edges in node metadata)
   */
  private async storeGraphEdges(edges: GraphEdge[]): Promise<void> {
    try {
      // Group edges by source node
      const edgesBySource = new Map<string, GraphEdge[]>();
      
      edges.forEach(edge => {
        if (!edgesBySource.has(edge.source)) {
          edgesBySource.set(edge.source, []);
        }
        edgesBySource.get(edge.source)!.push(edge);
      });
      
      // Update node metadata with edge information
      const index = this.pinecone.getInstance().Index('docuflow-production');
      
      for (const [sourceId, sourceEdges] of edgesBySource.entries()) {
        // Get the current vector
        const queryResult = await index.fetch([sourceId]);
        
        if (queryResult.vectors[sourceId]) {
          const vector = queryResult.vectors[sourceId];
          
          // Update metadata with edges
          const updatedMetadata = {
            ...vector.metadata,
            edges: sourceEdges
          };
          
          // Upsert the updated vector
          await index.upsert([{
            id: sourceId,
            values: vector.values,
            metadata: updatedMetadata
          }]);
        }
      }
      
      console.log(`[${new Date().toISOString()}] Stored ${edges.length} graph edges in node metadata`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error storing graph edges:`, error);
      throw error;
    }
  }

  /**
   * Get nodes connected to a given node
   */
  private async getConnectedNodes(nodeId: string): Promise<string[]> {
    try {
      const index = this.pinecone.getInstance().Index('docuflow-production');
      
      // Fetch the node
      const queryResult = await index.fetch([nodeId]);
      
      if (!queryResult.vectors[nodeId] || !queryResult.vectors[nodeId].metadata.edges) {
        return [];
      }
      
      // Extract connected node IDs from edges
      const edges = queryResult.vectors[nodeId].metadata.edges as GraphEdge[];
      return edges.map(edge => edge.target);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error getting connected nodes:`, error);
      return [];
    }
  }

  /**
   * Get the content of multiple nodes
   */
  private async getNodesContent(nodeIds: string[]): Promise<GraphNode[]> {
    try {
      if (nodeIds.length === 0) {
        return [];
      }
      
      const index = this.pinecone.getInstance().Index('docuflow-production');
      
      // Fetch nodes in batches (Pinecone has limits on batch size)
      const batchSize = 100;
      const nodes: GraphNode[] = [];
      
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batchIds = nodeIds.slice(i, i + batchSize);
        const queryResult = await index.fetch(batchIds);
        
        // Convert Pinecone vectors to GraphNodes
        for (const id of batchIds) {
          if (queryResult.vectors[id]) {
            const vector = queryResult.vectors[id];
            
            nodes.push({
              id,
              content: vector.metadata.content as string,
              embedding: vector.values,
              metadata: {
                documentId: vector.metadata.documentId as string,
                chunkIndex: vector.metadata.chunkIndex as number,
                nodeType: vector.metadata.nodeType as 'chunk' | 'entity' | 'concept',
                ...vector.metadata
              }
            });
          }
        }
      }
      
      return nodes;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error getting nodes content:`, error);
      return [];
    }
  }
}