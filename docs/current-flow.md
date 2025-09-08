# Current Flow in DoubtAI

This document explains the current flow in the DoubtAI project, focusing on the Graph RAG implementation.

## Overall Architecture

DoubtAI is a Next.js application that implements a Retrieval Augmented Generation (RAG) system with both traditional and graph-based approaches. The system consists of several key components:

1. **Document Processing**: Services for processing and embedding documents
2. **Vector Storage**: Pinecone for storing and retrieving vectors
3. **RAG Engines**: Traditional and Graph-based RAG implementations
4. **API Endpoints**: Interfaces for users to interact with the system

## Document Processing Flow

### 1. Document Ingestion

Documents are ingested through API endpoints. For PDF documents, the flow is:

1. The client uploads a PDF document
2. The PDF buffer is passed to the `PdfEmbeddingService`
3. The `PDFProcessor` extracts text from the PDF

### 2. Document Processing and Embedding

Once the text is extracted, it is processed:

1. The text is split into chunks (paragraphs or fixed-size chunks)
2. Each chunk is embedded using the `GeminiEmbeddingService`
3. Embeddings are normalized using L2 normalization

For Graph RAG, additional processing occurs:

1. Each chunk becomes a node in the knowledge graph
2. Relationships between chunks are identified:
   - Sequential edges connect adjacent chunks
   - Semantic edges connect chunks with high similarity (cosine similarity > 0.75)

### 3. Document Storage

Processed documents are stored in Pinecone:

1. For traditional RAG, chunks are stored as vectors with metadata
2. For Graph RAG, both nodes and edges are stored:
   - Nodes are stored as vectors with metadata
   - Edges are stored in the metadata of the source nodes

## Query Processing Flow

### 1. Query Reception

Queries are received through API endpoints:

1. Traditional RAG: `/api/rag` endpoint
2. Graph RAG: `/api/graph-rag` endpoint

Both endpoints require a query and tenant ID, with optional parameters for customization.

### 2. Relevant Document Retrieval

The retrieval process differs between traditional and Graph RAG:

#### Traditional RAG

1. The query is embedded using the `GeminiEmbeddingService`
2. Pinecone is queried for the most similar vectors (topK)
3. The retrieved chunks form the context

#### Graph RAG

1. The query is embedded using the `GeminiEmbeddingService`
2. Pinecone is queried for the most similar vectors (topK) as entry points
3. The graph is expanded by following edges to connected nodes
4. All retrieved nodes form the context

### 3. Response Generation

Once the context is retrieved, a response is generated:

1. The context and query are formatted into a prompt
2. The prompt is sent to Gemini (Google's LLM)
3. The generated response is returned to the client with metadata

## Graph RAG Implementation

### Graph Construction

The knowledge graph is constructed during document processing:

1. Each document chunk becomes a node with:
   - Unique ID
   - Content
   - Embedding
   - Metadata

2. Edges are created between nodes:
   - Sequential edges connect adjacent chunks with weight 1.0
   - Semantic edges connect similar chunks with weight equal to their similarity score

### Graph-Based Retrieval

The retrieval process leverages the graph structure:

1. Find entry points using vector similarity search
2. Expand the graph by following edges for a specified number of steps
3. Retrieve and combine the content of all nodes in the expanded subgraph

### Advantages over Traditional RAG

Graph RAG offers several advantages:

1. **Contextual Retrieval**: Retrieves information based on relationships, not just similarity
2. **Improved Coherence**: Provides more coherent context by including related chunks
3. **Better Handling of Complex Queries**: Can retrieve information from different parts of documents that are related

## API Endpoints

### Graph RAG Query Endpoint

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

## Complete Flow Example

1. **Document Processing**:
   - A document is uploaded via the PUT endpoint
   - The document is split into chunks
   - Each chunk is embedded
   - A graph is constructed with nodes and edges
   - The graph is stored in Pinecone

2. **Query Processing**:
   - A query is sent via the POST endpoint
   - The query is embedded
   - Initial nodes are retrieved based on similarity
   - The graph is expanded by following edges
   - Context is retrieved from all nodes
   - A response is generated using the context and Gemini
   - The response is returned to the client