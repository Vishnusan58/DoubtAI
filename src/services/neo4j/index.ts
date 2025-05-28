import neo4j, { Driver, Session, Record, QueryResult } from 'neo4j-driver';

/**
 * Service for interacting with Neo4j graph database
 * This service provides methods for connecting to Neo4j, creating nodes and relationships,
 * and querying the graph database.
 */
export class Neo4jService {
  private static instance: Neo4jService;
  private driver: Driver | null = null;

  private constructor() {
    this.initializeDriver();
    console.log(`[${new Date().toISOString()}] Neo4j service initialized`);
  }

  public static getInstance(): Neo4jService {
    if (!Neo4jService.instance) {
      Neo4jService.instance = new Neo4jService();
    }
    return Neo4jService.instance;
  }

  /**
   * Initialize the Neo4j driver
   */
  private initializeDriver(): void {
    try {
      const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      console.log(`[${new Date().toISOString()}] Connected to Neo4j at ${uri}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to connect to Neo4j:`, error);
      this.driver = null;
    }
  }

  /**
   * Get a Neo4j session
   */
  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized');
    }
    return this.driver.session();
  }

  /**
   * Close the Neo4j driver
   */
  public async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log(`[${new Date().toISOString()}] Neo4j connection closed`);
    }
  }

  /**
   * Execute a Cypher query
   * @param query Cypher query
   * @param params Query parameters
   */
  public async executeQuery(query: string, params: Record<string, any> = {}): Promise<Record[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records;
    } finally {
      await session.close();
    }
  }

  /**
   * Create a document node in the graph
   * @param documentId Document ID
   * @param title Document title
   * @param metadata Document metadata
   */
  public async createDocumentNode(
    documentId: string,
    title: string,
    metadata: Record<string, any> = {}
  ): Promise<Record[]> {
    const query = `
      CREATE (d:Document {
        id: $documentId,
        title: $title,
        createdAt: datetime(),
        ...$metadata
      })
      RETURN d
    `;

    return this.executeQuery(query, { documentId, title, metadata });
  }

  /**
   * Create a chunk node in the graph
   * @param chunkId Chunk ID
   * @param documentId Document ID
   * @param content Chunk content
   * @param embedding Chunk embedding
   * @param metadata Chunk metadata
   */
  public async createChunkNode(
    chunkId: string,
    documentId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any> = {}
  ): Promise<Record[]> {
    const query = `
      MATCH (d:Document {id: $documentId})
      CREATE (c:Chunk {
        id: $chunkId,
        content: $content,
        embedding: $embedding,
        ...$metadata
      })
      CREATE (d)-[:CONTAINS]->(c)
      RETURN c
    `;

    return this.executeQuery(query, { 
      chunkId, 
      documentId, 
      content, 
      embedding, 
      metadata 
    });
  }

  /**
   * Create a relationship between two chunk nodes
   * @param sourceId Source chunk ID
   * @param targetId Target chunk ID
   * @param type Relationship type
   * @param weight Relationship weight
   */
  public async createChunkRelationship(
    sourceId: string,
    targetId: string,
    type: 'SEQUENTIAL' | 'SEMANTIC',
    weight: number
  ): Promise<Record[]> {
    const query = `
      MATCH (source:Chunk {id: $sourceId})
      MATCH (target:Chunk {id: $targetId})
      CREATE (source)-[r:${type} {weight: $weight}]->(target)
      RETURN r
    `;

    return this.executeQuery(query, { sourceId, targetId, weight });
  }

  /**
   * Find similar chunks using vector similarity
   * @param embedding Query embedding
   * @param limit Number of results to return
   */
  public async findSimilarChunks(
    embedding: number[],
    limit: number = 5
  ): Promise<Record[]> {
    // This query uses the vector similarity function
    // Note: Neo4j requires the vector index to be set up separately
    const query = `
      MATCH (c:Chunk)
      WITH c, gds.similarity.cosine(c.embedding, $embedding) AS similarity
      WHERE similarity > 0.7
      RETURN c.id AS id, c.content AS content, similarity
      ORDER BY similarity DESC
      LIMIT $limit
    `;

    return this.executeQuery(query, { embedding, limit });
  }

  /**
   * Expand the graph from initial nodes
   * @param initialNodeIds Initial node IDs
   * @param expansionSteps Number of expansion steps
   */
  public async expandGraph(
    initialNodeIds: string[],
    expansionSteps: number = 1
  ): Promise<Record[]> {
    const query = `
      MATCH (start:Chunk)
      WHERE start.id IN $initialNodeIds
      CALL apoc.path.expandConfig(start, {
        relationshipFilter: "SEQUENTIAL|SEMANTIC",
        minLevel: 1,
        maxLevel: $expansionSteps
      })
      YIELD path
      WITH DISTINCT nodes(path) AS nodes
      UNWIND nodes AS node
      RETURN DISTINCT node.id AS id, node.content AS content
    `;

    return this.executeQuery(query, { initialNodeIds, expansionSteps });
  }

  /**
   * Get all documents
   */
  public async getAllDocuments(): Promise<Record[]> {
    const query = `
      MATCH (d:Document)
      RETURN d.id AS id, d.title AS title, toString(d.createdAt) AS createdAt
      ORDER BY d.createdAt DESC
    `;

    return this.executeQuery(query);
  }

  /**
   * Get document by ID
   * @param documentId Document ID
   */
  public async getDocumentById(documentId: string): Promise<Record | null> {
    const query = `
      MATCH (d:Document {id: $documentId})
      RETURN d.id AS id, d.title AS title, toString(d.createdAt) AS createdAt
    `;

    const records = await this.executeQuery(query, { documentId });
    return records.length > 0 ? records[0] : null;
  }

  /**
   * Get chunks by document ID
   * @param documentId Document ID
   */
  public async getChunksByDocumentId(documentId: string): Promise<Record[]> {
    const query = `
      MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)
      RETURN c.id AS id, c.content AS content
    `;

    return this.executeQuery(query, { documentId });
  }
}