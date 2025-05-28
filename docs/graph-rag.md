# Graph RAG Implementation

This document explains the Graph RAG (Retrieval Augmented Generation) implementation in the DoubtAI project.

## Overview

Graph RAG enhances traditional RAG systems by modeling relationships between document chunks as a graph, enabling more contextual and comprehensive retrieval. Instead of treating document chunks as isolated pieces of information, Graph RAG captures the connections between them, allowing for more intelligent and context-aware retrieval.

## Key Components

### 1. Graph Data Structure

The graph consists of:

- **Nodes**: Represent document chunks, entities, or concepts
- **Edges**: Represent relationships between nodes, with different types:
  - **Sequential**: Connect adjacent chunks in a document
  - **Semantic**: Connect chunks that are semantically similar
  - **Hierarchical**: Connect chunks with parent-child relationships
  - **Reference**: Connect chunks that reference each other

### 2. Document Processing

When a document is processed:

1. The document is split into chunks
2. Each chunk becomes a node in the graph
3. Embeddings are generated for each chunk
4. Relationships between chunks are identified and stored as edges
   - Sequential edges are created between adjacent chunks
   - Semantic edges are created between chunks with high similarity

### 3. Graph-Based Retrieval

The retrieval process:

1. Generate an embedding for the user query
2. Find the most similar nodes using vector similarity search
3. Expand the graph by following edges to related nodes
4. Retrieve and combine the content of all nodes
5. Use the combined context to generate a response

## Benefits of Graph RAG

- **More Contextual Retrieval**: By following relationships between chunks, the system can retrieve information that is contextually related but not necessarily similar in vector space.
- **Improved Answer Coherence**: The system can retrieve connected information, leading to more coherent and comprehensive answers.
- **Better Handling of Complex Queries**: For queries that require information from multiple parts of a document, Graph RAG can retrieve the relevant pieces by traversing the graph.

## Implementation Details

### GraphRAGService

The `GraphRAGService` class implements the core Graph RAG functionality:

- `processDocumentToGraph`: Processes a document into a graph structure
- `retrieveWithGraphExpansion`: Retrieves relevant context using graph-based retrieval

### GraphRAGEngine

The `GraphRAGEngine` class provides a high-level interface for using Graph RAG:

- `generateResponse`: Generates a response using Graph RAG
- `processDocument`: Processes a document and creates a knowledge graph

## API Endpoints

### Query Endpoint

```
POST /api/graph-rag
```

Request body:
```json
{
  "query": "What is Graph RAG?",
  "tenantId": "tenant-123",
  "options": {
    "topK": 3,
    "expansionSteps": 1,
    "temperature": 0.2
  }
}
```

### Document Processing Endpoint

```
PUT /api/graph-rag
```

Request body:
```json
{
  "documentId": "doc-123",
  "content": "Document content...",
  "metadata": {
    "title": "Graph RAG Paper",
    "author": "John Doe"
  }
}
```

## Usage Example

```typescript
// Process a document
const documentId = "doc-123";
const content = "Document content...";
const metadata = { title: "Graph RAG Paper", author: "John Doe" };

const graphRagEngine = new GraphRAGEngine();
await graphRagEngine.processDocument(documentId, content, metadata);

// Generate a response
const query = "What is Graph RAG?";
const tenantId = "tenant-123";
const options = { topK: 3, expansionSteps: 1, temperature: 0.2 };

const result = await graphRagEngine.generateResponse(tenantId, query, options);
console.log(result.response);
```

## Future Improvements

1. **Entity Extraction**: Extract entities from documents and create nodes for them
2. **Cross-Document Relationships**: Create edges between nodes from different documents
3. **Dynamic Graph Updates**: Update the graph as new information becomes available
4. **User Feedback Integration**: Use user feedback to improve the graph structure
5. **Visualization Tools**: Create tools to visualize the knowledge graph