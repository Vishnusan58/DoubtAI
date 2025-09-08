# DoubtAI Setup Guide

This guide provides detailed instructions for setting up and running the DoubtAI project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 or higher
- **npm** or **yarn**: For package management
- **Git**: For version control

## External Service Requirements

DoubtAI relies on several external services:

1. **Pinecone Account**: For vector database storage
   - Sign up at [pinecone.io](https://www.pinecone.io/)
   - Create an index with 1536 dimensions (for Gemini embeddings)
   - Note your API key and index name

2. **Google AI/Gemini API**: For embeddings and text generation
   - Sign up for Google AI Studio at [ai.google.dev](https://ai.google.dev/)
   - Create an API key
   
3. **Azure Services** (Optional):
   - Azure Cosmos DB (MongoDB API)
   - Azure Blob Storage
   - Azure Redis Cache
   - Azure Cognitive Search

## Installation Steps

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd DoubtAI
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory with the following variables:

   ```
   # API Keys
   PINECONE_API_KEY=your_pinecone_api_key
   GOOGLE_API_KEY=your_google_api_key
   GEMINI_API_KEY=your_google_api_key  # Same as GOOGLE_API_KEY for Gemini

   # Environment
   NEXT_PUBLIC_ENVIRONMENT=development

   # Pinecone Configuration
   PINECONE_INDEX_NAME=your_index_name

   # Optional Azure Configuration (if using Azure services)
   AZURE_COSMOS_CONNECTION_STRING=your_cosmos_connection_string
   AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string
   AZURE_REDIS_CONNECTION_STRING=your_redis_connection_string
   AZURE_SEARCH_ENDPOINT=your_search_endpoint
   AZURE_SEARCH_API_KEY=your_search_api_key
   AZURE_SEARCH_INDEX_NAME=your_search_index_name
   ```

## Running the Application

1. **Development Mode**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

   This will start the development server with Turbopack. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

2. **Production Build**

   ```bash
   npm run build
   npm start
   # or
   yarn build
   yarn start
   ```

## Testing Components

DoubtAI includes several test scripts to verify functionality:

1. **Test Embeddings**

   ```bash
   npm run test-embeddings
   # or
   yarn test-embeddings
   ```

   This tests the Gemini embedding service to ensure it's properly configured.

2. **Test Vector Search**

   ```bash
   npm run test-search
   # or
   yarn test-search
   ```

   This tests the vector search functionality with Pinecone.

3. **Test Azure Storage** (if using Azure)

   ```bash
   npm run test-storage
   # or
   yarn test-storage
   ```

   This tests the Azure Blob Storage connection.

## Initial Setup

After starting the application:

1. Navigate to the admin interface at [http://localhost:3000/admin](http://localhost:3000/admin)
2. Upload your first document (PDF format recommended)
3. The system will process the document, which may take some time depending on its size
4. Once processing is complete, you can start asking questions about the document content

## Troubleshooting

### Common Issues

1. **API Key Errors**:
   - Ensure all API keys in your `.env` file are correct and have the necessary permissions
   - Check for any whitespace or special characters in your API keys

2. **Vector Database Connection Issues**:
   - Verify your Pinecone index is properly configured with 1536 dimensions
   - Check that your Pinecone service is in the correct region

3. **Document Processing Errors**:
   - Ensure your PDF documents are text-based (not scanned images)
   - Large documents may need to be split into smaller files

For more detailed information about the system architecture and flow, refer to the [Current Flow Documentation](current-flow.md).