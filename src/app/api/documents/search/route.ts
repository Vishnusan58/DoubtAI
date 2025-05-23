import { NextRequest, NextResponse } from 'next/server';
import { AzureStorageService } from '@/services/storage/azure-storage';
import { AzureSearchService } from '@/services/search/azure-search';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings-fixed';
import { Pinecone } from '@pinecone-database/pinecone';
import { systemConfig } from '@/types/config';
import * as genai from '@google/generative-ai';

// Maximum number of documents to retrieve
const MAX_SEARCH_RESULTS = 5;

// Initialize Gemini generative model
let genModel: genai.GenerativeModel;

function initializeGenModel() {
  if (genModel) return;

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new genai.GoogleGenerativeAI(apiKey);
  genModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const requestData = await req.json();
    const { query, filter, vectorSearch } = requestData;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`Processing document search query: "${query}"`);

    // Initialize services
    const searchService = AzureSearchService.getInstance();

    let documents = [];
    let resultSources = [];

    // First try Azure AI Search
    try {
      console.log('Using Azure AI Search for document retrieval');
      const searchResults = await searchService.searchDocuments({
        queryText: query,
        filter: filter,
        top: MAX_SEARCH_RESULTS
      });

      if (searchResults.length > 0) {
        documents = searchResults;
        resultSources.push('azure_search');
      }
    } catch (error) {
      console.error('Azure AI Search error:', error);
    }

    // If Azure Search returned no results and vectorSearch is enabled, try vector search
    if (documents.length === 0 && vectorSearch !== false) {
      try {
        console.log('Falling back to vector search');
        const embedder = GeminiEmbeddingService.getInstance();
        const queryEmbedding = await embedder.generateEmbedding(query);

        const pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY!
        });

        const index = pinecone.Index(`docuflow-${systemConfig.environment}`);

        const vectorResults = await index.query({
          vector: queryEmbedding,
          topK: MAX_SEARCH_RESULTS,
          includeMetadata: true
        });

        if (vectorResults.matches && vectorResults.matches.length > 0) {
          // Get actual documents from IDs
          const storage = await AzureStorageService.getInstance();
          const documentIds = vectorResults.matches
            .filter(match => !match.metadata?.isChunk)
            .map(match => match.id);

          // This assumes you have a method to retrieve multiple documents by ID
          for (const id of documentIds) {
            try {
              const doc = await storage.retrieveDocument(id);
              if (doc && doc.metadata) {
                documents.push({
                  id: doc.metadata._id,
                  title: doc.metadata.title,
                  score: 0, // No score from Cosmos retrieval
                  metadata: {
                    createdAt: doc.metadata.createdAt,
                    contentType: doc.metadata.contentType
                  }
                });
              }
            } catch (err) {
              console.error(`Error retrieving document ${id}:`, err);
            }
          }
          resultSources.push('vector_search');
        }
      } catch (error) {
        console.error('Vector search error:', error);
      }
    }

    // Use Gemini to enhance the search results if we have any
    let enhancedResponse = null;
    if (documents.length > 0) {
      try {
        console.log('Enhancing search results with Gemini');
        initializeGenModel();

        // Create a context from the documents
        const documentContext = documents.map((doc, index) => {
          return `Document ${index + 1}: "${doc.title}"
${doc.content || 'No content available'}`;
        }).join('\n\n');

        // Generate enhanced response with Gemini
        const prompt = `
User query: "${query}"

Document search results:
${documentContext}

Based on these documents, provide a comprehensive answer to the user's query. 
Include relevant information from the documents and cite which document numbers you're referencing.
If the documents don't contain enough information to answer the query, say so honestly.
`;

        const result = await genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        });

        enhancedResponse = result.response.text();
        console.log('Generated enhanced response with Gemini');
      } catch (error) {
        console.error('Gemini enhancement error:', error);
      }
    }

    return NextResponse.json({
      success: true,
      query: query,
      documents: documents,
      sources: resultSources,
      enhancedResponse: enhancedResponse,
      count: documents.length
    });

  } catch (error) {
    console.error('Error in document search API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
