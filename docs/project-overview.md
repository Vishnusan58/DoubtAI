# DoubtAI Project Overview

## What is DoubtAI?

DoubtAI is an intelligent document question-answering system designed to help users extract information from their documents using natural language queries. The system leverages advanced AI techniques to understand documents, build knowledge representations, and generate accurate answers to user questions.

## Core Functionality

At its core, DoubtAI allows users to:

1. **Upload Documents**: Users can upload PDF documents to the system.
2. **Ask Questions**: Users can ask questions about the content of these documents in natural language.
3. **Receive Answers**: The system provides accurate, contextually relevant answers based on the document content.

## How It Works

DoubtAI works through a process called Retrieval Augmented Generation (RAG):

1. **Document Processing**:
   - Documents are uploaded and processed
   - Text is extracted and divided into manageable chunks
   - Each chunk is converted into a vector representation (embedding)

2. **Knowledge Organization**:
   - Traditional RAG: Chunks are stored as independent vectors
   - Graph RAG: Chunks are connected in a knowledge graph based on their relationships

3. **Query Processing**:
   - User questions are converted to the same vector format
   - Relevant document chunks are retrieved
   - A large language model (Gemini) generates a response using the retrieved context

## Key Innovations

DoubtAI implements two approaches to RAG:

1. **Traditional RAG**: Uses vector similarity to find relevant document chunks
2. **Graph RAG**: Builds a knowledge graph connecting related chunks, enabling more contextual retrieval

The Graph RAG approach is particularly innovative as it allows the system to:
- Follow connections between related pieces of information
- Provide more coherent and comprehensive answers
- Better handle complex queries that span multiple sections of documents

## User Interface

The system provides:
- A clean, intuitive interface for asking questions
- An admin panel for document management
- Multi-tenant support for organization-specific document collections

## Technical Foundation

DoubtAI is built on:
- Next.js and React for the frontend
- Vector databases (Pinecone) for efficient similarity search
- Google's Gemini AI for natural language understanding and generation
- Optional Azure services for extended functionality

For more detailed technical information, please refer to the [Current Flow Documentation](current-flow.md).