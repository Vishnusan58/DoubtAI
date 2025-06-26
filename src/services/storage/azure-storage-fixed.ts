import { MongoClient, Collection, Db, MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { azureConfig } from '../../config/azure-config';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

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
    private static initializationPromise: Promise<void> | null = null;
    private mongoClient: MongoClient;
    private database!: Db;
    private documentsCollection!: Collection<StorageMetadata>;
    private versionsCollection!: Collection;
    private embeddingsCollection!: Collection;
    private isInitialized: boolean = false;

    private constructor() {
        // MongoDB specific options for Cosmos DB
        const options: MongoClientOptions = {
            connectTimeoutMS: 30000, // Increased to 30 seconds
            socketTimeoutMS: 360000, // 6 minutes
            serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
            maxPoolSize: 10,
            minPoolSize: 0,
            ssl: true,
            retryWrites: false,
        };

        // Clean and format the connection string
        const cleanConnectionString = azureConfig.mongodb.connectionString
            .replace(/^["']|["']$/g, '')  // Remove quotes
            .trim();

        console.log(`[${CURRENT_TIMESTAMP}] Initializing MongoDB connection...`);
        this.mongoClient = new MongoClient(cleanConnectionString, options);
    }

    public static async getInstance(): Promise<AzureStorageService> {
        if (!AzureStorageService.instance) {
            AzureStorageService.instance = new AzureStorageService();
            // Store the initialization promise to avoid multiple simultaneous initializations
            AzureStorageService.initializationPromise = AzureStorageService.instance.initialize();
            await AzureStorageService.initializationPromise;
        } else if (!AzureStorageService.instance.isInitialized) {
            // If there's a pending initialization, wait for it
            if (AzureStorageService.initializationPromise) {
                await AzureStorageService.initializationPromise;
            } else {
                // If there's no pending initialization but the instance is not initialized,
                // initialize it now
                AzureStorageService.initializationPromise = AzureStorageService.instance.initialize();
                await AzureStorageService.initializationPromise;
            }
        }
        return AzureStorageService.instance;
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log(`[${CURRENT_TIMESTAMP}] Connecting to MongoDB...`);
            await this.mongoClient.connect();

            this.database = this.mongoClient.db(azureConfig.mongodb.database);

            // Initialize collections
            this.documentsCollection = this.database.collection<StorageMetadata>(
                azureConfig.mongodb.collections.documents
            );
            this.versionsCollection = this.database.collection(
                azureConfig.mongodb.collections.versions
            );
            this.embeddingsCollection = this.database.collection(
                azureConfig.mongodb.collections.embeddings
            );

            // Create indexes
            await Promise.all([
                this.documentsCollection.createIndex({ createdAt: 1 }),
                this.versionsCollection.createIndex({ documentId: 1, version: -1 }),
                this.embeddingsCollection.createIndex({ documentId: 1 })
            ]);

            this.isInitialized = true;
            console.log(`[${CURRENT_TIMESTAMP}] Storage initialized successfully`);
        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Storage initialization failed:`, error);
            throw error;
        }
    }

    async storeDocument(
        content: Buffer,
        metadata: Omit<StorageMetadata, '_id' | 'version' | 'blobPath'>,
        embedding: number[]
    ): Promise<string> {
        // Ensure we're initialized before proceeding
        if (!this.isInitialized) {
            await this.initialize();
        }

        const documentId = uuidv4();
        const version = 1;

        try {
            // Store document metadata
            const documentMetadata: StorageMetadata = {
                _id: documentId,
                ...metadata,
                version,
                createdAt: metadata.createdAt || CURRENT_TIMESTAMP,
                createdBy: metadata.createdBy || CURRENT_USER
            };

            await this.documentsCollection.insertOne(documentMetadata);

            // Store version information
            await this.versionsCollection.insertOne({
                documentId,
                version,
                timestamp: CURRENT_TIMESTAMP,
                userId: CURRENT_USER
            });

            // Store embedding
            await this.embeddingsCollection.insertOne({
                documentId,
                version,
                embedding,
                timestamp: CURRENT_TIMESTAMP
            });

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
        // Ensure we're initialized before proceeding
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            console.log(`[${CURRENT_TIMESTAMP}] Fetching all documents from storage`);
            const documents = await this.documentsCollection.find({}).toArray();
            console.log(`[${CURRENT_TIMESTAMP}] Retrieved ${documents.length} documents`);
            return documents;
        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Failed to list documents:`, error);
            throw error;
        }
    }

    // Add other methods as needed...
}
