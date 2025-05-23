import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { azureConfig } from "@/config/azure-config";

interface SearchOptions {
  queryText: string;
  filter?: string;
  top?: number;
  includeFacets?: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  content?: string;
  metadata?: any;
  score?: number;
  highlights?: any;
}

export class AzureSearchService {
  private static instance: AzureSearchService;
  private indexClient: SearchIndexClient;

  private constructor() {
    const endpoint = process.env.AZURE_SEARCH_ENDPOINT || azureConfig.search?.endpoint;
    const apiKey = process.env.AZURE_SEARCH_API_KEY || azureConfig.search?.apiKey;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'documents';

    if (!endpoint || !apiKey) {
      throw new Error("Azure Search endpoint and API key must be configured");
    }

    this.indexClient = new SearchIndexClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );

    console.log(`AzureSearchService initialized with index: ${indexName}`);
  }

  public static getInstance(): AzureSearchService {
    if (!AzureSearchService.instance) {
      AzureSearchService.instance = new AzureSearchService();
    }
    return AzureSearchService.instance;
  }

  /**
   * Search documents in the Azure AI Search index
   */
  async searchDocuments(options: SearchOptions): Promise<SearchResult[]> {
    try {
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'documents';
      const searchClient = this.indexClient.getSearchClient(indexName);

      console.log(`Searching for: "${options.queryText}" in index ${indexName}`);

      // Build search parameters
      const searchParams: any = {
        includeTotalCount: true,
        highlightFields: 'content',
        queryType: 'semantic',
        semanticConfiguration: 'default',
      };

      // Add optional parameters if provided
      if (options.filter) {
        searchParams.filter = options.filter;
      }

      if (options.top) {
        searchParams.top = options.top;
      }

      if (options.includeFacets) {
        searchParams.facets = ['metadata/documentType'];
      }

      // Execute search
      const searchResults = await searchClient.search(options.queryText, searchParams);

      // Process and format results
      const results: SearchResult[] = [];
      for await (const result of searchResults.results) {
        results.push({
          id: result.document.id,
          title: result.document.title,
          content: result.document.content,
          metadata: result.document.metadata,
          score: result.score,
          highlights: result.highlights
        });
      }

      console.log(`Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error("Error searching documents:", error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string): Promise<any> {
    try {
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'documents';
      const searchClient = this.indexClient.getSearchClient(indexName);

      const document = await searchClient.getDocument(documentId);
      return document;
    } catch (error) {
      console.error(`Error fetching document with ID ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize a document from Cosmos DB to the Azure AI Search index
   */
  async syncDocument(document: any): Promise<void> {
    try {
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'documents';
      const searchClient = this.indexClient.getSearchClient(indexName);

      // Format document for search indexing
      const searchDocument = {
        id: document._id,
        title: document.title,
        content: document.content,
        metadata: {
          createdAt: document.createdAt,
          createdBy: document.createdBy,
          contentType: document.contentType,
          size: document.size,
          documentType: document.contentType?.split('/')[1] || 'unknown'
        }
      };

      console.log(`Syncing document to search index: ${document._id}`);
      await searchClient.uploadDocuments([searchDocument]);
      console.log(`Document synced successfully: ${document._id}`);
    } catch (error) {
      console.error("Error syncing document to search index:", error);
      throw error;
    }
  }

  /**
   * Delete a document from the Azure AI Search index
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'documents';
      const searchClient = this.indexClient.getSearchClient(indexName);

      await searchClient.deleteDocuments([{ id: documentId }]);
      console.log(`Document deleted from search index: ${documentId}`);
    } catch (error) {
      console.error(`Error deleting document ${documentId} from search index:`, error);
      throw error;
    }
  }
}
