# DoubtAI: Document Processing & Question-Answering System

## Project Overview

DoubtAI is an advanced document question-answering system that processes uploaded documents (primarily PDFs), generates embeddings, and uses LLM-based question-answering capabilities. The system leverages Retrieval Augmented Generation (RAG) to provide accurate answers based on document content.

## Tech Stack

### Frontend
- **Next.js** - React framework for the application
- **TypeScript/JavaScript** - Primary programming languages
- **React** - UI component library

### Backend & APIs
- **Next.js API Routes** - Serverless API endpoints
- **Node.js** - Runtime environment

### AI & Machine Learning
- **Google Gemini API** - For embeddings (`text-embedding-004`, `gemini-embedding-exp-03-07`) and text generation
- **LangChain** - Utilities for document processing

### Data Storage
- **Pinecone** - Vector database for embeddings
- **Azure Cosmos DB** - Document storage with MongoDB API
- **Azure Storage** - For file storage
- **Azure Redis Cache** - Optional caching layer

### Document Processing
- **PDFLoader** (LangChain) - PDF text extraction
- **RecursiveCharacterTextSplitter** - Text chunking functionality

## System Architecture

DoubtAI follows a modular architecture with these key components:

```
┌────────────────┐     ┌─────────────────┐     ┌────────────────────┐
│   Frontend     │────►│  API Layer      │────►│  Document Processor │
└────────────────┘     └─────────────────┘     └────────────────────┘
                             │                          │
                             ▼                          ▼
                       ┌─────────────┐         ┌────────────────┐
                       │  RAG Engine │◄────────┤ Embedding Gen. │
                       └─────────────┘         └────────────────┘
                             │                          │
                             ▼                          ▼
                     ┌───────────────┐         ┌───────────────────┐
                     │ LLM Interface │         │ Vector DB Storage │
                     └───────────────┘         └───────────────────┘
                             │                          │
                             └──────────────────────────┘
```

## Data Flow

### Document Upload & Processing Flow

1. **Document Upload**
    - User uploads PDF through frontend
    - File stored in Cosmos DB with metadata (without embeddings initially)

2. **Text Extraction & Chunking**
    - PDF content extracted using PDFLoader
    - Text split into manageable chunks
    - Example: `Document split into 3 chunks`

3. **Embedding Generation**
    - Each text chunk sent to Gemini embedding model
    - Embeddings generated (vector representations of text)
    - Example: `Generating embedding for text using model text-embedding-004`

4. **Vector Storage**
    - Embeddings stored in Pinecone vector database
    - Each chunk indexed with its vector representation
    - Example: `Successfully stored 3 chunks in Pinecone`

### Question-Answering Flow

1. **User Query**
    - User submits question through the frontend
    - Query sent to RAG system

2. **Context Retrieval**
    - Query converted to embedding
    - Similar vectors retrieved from Pinecone
    - Most relevant document chunks selected

3. **Response Generation**
    - Retrieved context combined with user query
    - Sent to Gemini LLM for answer generation
    - Formatted response returned to user

## Key Components

### Document Embedding Service

Handles document processing and embedding generation:

- Extracts text from PDFs
- Chunks text into manageable pieces
- Generates embeddings using Gemini models
- Stores vectors in Pinecone or Azure AI Search

### RAG Helper

Provides retrieval augmented generation capabilities:

- Formats chat history for Gemini
- Generates responses using document context
- Handles error cases and fallbacks

## Implementation Details

### Document Processing Pipeline

```
Upload → Cosmos DB Storage → Text Extraction → Chunking → 
Embedding Generation → Vector Storage → Response Generation
```

### Configuration

Environment variables required:
- `GOOGLE_API_KEY`: For Gemini API access
- `PINECONE_API_KEY`: For vector database access
- Various Azure connection strings (for Cosmos DB, Redis, etc.)

## Setup & Troubleshooting

### Common Issues

1. **404 Pinecone Index Error**
    - Error: `PineconeNotFoundError: A call to https://api.pinecone.io/indexes/healthdoc returned HTTP status 404`
    - Solution: Create the required index in Pinecone console with matching name and dimensions

2. **API Key Configuration Issues**
    - Error: `GEMINI_API_KEY is not configured or is using a placeholder`
    - Solution: Set proper API keys in environment variables

3. **PDF Processing Errors**
    - Solution: Check file formats and ensure proper access permissions

### Success Indicators

```
Successfully stored 3 chunks in Pinecone
Successfully processed PDF with 3 chunks
```

The system is successfully extracting text, generating embeddings with Gemini models, and storing them in Pinecone for retrieval during question answering.