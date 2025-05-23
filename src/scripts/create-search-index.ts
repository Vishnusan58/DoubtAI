import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { azureConfig } from "@/config/azure-config";

/**
 * This script creates an Azure AI Search index for your documents.
 * Run this once before using the document search functionality.
 */
async function createSearchIndex() {
  try {
    console.log("Starting to create Azure AI Search index...");

    // Get configuration from environment variables or config
    const endpoint = process.env.AZURE_SEARCH_ENDPOINT || azureConfig.search?.endpoint;
    const apiKey = process.env.AZURE_SEARCH_API_KEY || azureConfig.search?.apiKey;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME || azureConfig.search?.indexName || 'doubtai-documents-index';

    if (!endpoint || !apiKey) {
      throw new Error("Azure Search endpoint and API key must be configured in environment variables");
    }

    console.log(`Using Azure Search service at: ${endpoint}`);
    console.log(`Creating index: ${indexName}`);

    // Create SearchIndexClient
    const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

    // Define the index schema
    const index = {
      name: indexName,
      fields: [
        {
          name: "id",
          type: "Edm.String",
          key: true,
          searchable: false,
          filterable: true,
          sortable: true
        },
        {
          name: "title",
          type: "Edm.String",
          searchable: true,
          filterable: true,
          sortable: true
        },
        {
          name: "content",
          type: "Edm.String",
          searchable: true,
          filterable: false,
          sortable: false
        },
        {
          name: "metadata",
          type: "Edm.ComplexType",
          fields: [
            {
              name: "createdAt",
              type: "Edm.String",
              searchable: false,
              filterable: true,
              sortable: true
            },
            {
              name: "createdBy",
              type: "Edm.String",
              searchable: true,
              filterable: true,
              sortable: true
            },
            {
              name: "contentType",
              type: "Edm.String",
              searchable: false,
              filterable: true,
              sortable: false
            },
            {
              name: "size",
              type: "Edm.Int32",
              searchable: false,
              filterable: true,
              sortable: true
            },
            {
              name: "documentType",
              type: "Edm.String",
              searchable: false,
              filterable: true,
              sortable: false
            }
          ]
        },
        {
          name: "embedding",
          type: "Collection(Edm.Single)",
          dimensions: 768,
          vectorSearchConfiguration: "default"
        }
      ],
      vectorSearch: {
        algorithms: {
          hnsw: {
            parameters: {
              m: 4,
              efConstruction: 400,
              efSearch: 500,
              metric: "cosine"
            }
          }
        },
        profiles: {
          default: {
            algorithmConfigurationName: "hnsw",
            vectorizer: "none"
          }
        }
      },
      semantic: {
        configurations: [
          {
            name: "default",
            prioritizedFields: {
              titleField: {
                fieldName: "title"
              },
              contentFields: [
                {
                  fieldName: "content"
                }
              ],
              keywordsFields: []
            }
          }
        ]
      }
    };

    // Create the index
    console.log("Creating index...");
    const result = await client.createIndex(index);
    console.log("Index created successfully!");
    console.log(result);

    return result;
  } catch (error) {
    console.error("Error creating Azure AI Search index:", error);
    throw error;
  }
}

// Run the script
createSearchIndex()
  .then(() => console.log("Index creation complete"))
  .catch(err => console.error("Failed to create index:", err));
