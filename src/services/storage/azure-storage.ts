import { MongoClient, Collection, Db, MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { azureConfig } from '../../config/azure-config';

const CURRENT_TIMESTAMP = new Date().toISOString();

interface StorageMetadata {
    _id: string;
    title: string;
    createdAt: string;
    createdBy: string;
    version: number;
    contentType: string;
    size: number;
    blobPath?: string;
}

export class AzureStorageService {
    private static instance: AzureStorageService | null = null;
    private client: MongoClient;
    private db: Db;
    private documentsCollection: Collection<StorageMetadata>;

    private constructor() {
        const options: MongoClientOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        };
        this.client = new MongoClient(azureConfig.mongoUri, options);
        this.db = this.client.db(azureConfig.dbName);
        this.documentsCollection = this.db.collection(azureConfig.collectionName);
    }

    public static async getInstance(): Promise<AzureStorageService> {
        if (!AzureStorageService.instance) {
            AzureStorageService.instance = new AzureStorageService();
            // Initialize connection here if needed
        }
        return AzureStorageService.instance;
    }

    async storeDocument(
        content: Buffer,
        metadata: Omit<StorageMetadata, '_id' | 'version' | 'blobPath'>,
        embedding: number[]
    ): Promise<string> {
        const documentId = uuidv4();
        const version = 1;

        try {
            // Store document metadata
            const documentMetadata: StorageMetadata = {
                _id: documentId,
                ...metadata,
                version,
                createdAt: metadata.createdAt || CURRENT_TIMESTAMP,
                createdBy: metadata.createdBy || 'system'
            };

            await this.documentsCollection.insertOne(documentMetadata);

            // Return the document ID
            return documentId;
        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Failed to store document:`, error);
            throw error;
        }
    }

    /**
     * List all documents in the storage
     */
    async listDocuments(): Promise<StorageMetadata[]> {
        try {
            console.log(`[${new Date().toISOString()}] Fetching all documents from storage`);
            const documents = await this.documentsCollection.find({}).toArray();
            console.log(`[${new Date().toISOString()}] Retrieved ${documents.length} documents`);
            return documents;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to list documents:`, error);
            throw error;
        }
    }
}
