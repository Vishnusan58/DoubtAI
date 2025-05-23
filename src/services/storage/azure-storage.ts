import { MongoClient, Collection, Db, MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { azureConfig } from '../../config/azure-config';

const CURRENT_TIMESTAMP = '2025-05-18 06:01:14';
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
    private static instance: AzureStorageService;
    private mongoClient: MongoClient;
    private database!: Db;
    private documentsCollection!: Collection<StorageMetadata>;
    private versionsCollection!: Collection;
    private embeddingsCollection!: Collection;

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
            await AzureStorageService.instance.initialize();
        }
        return AzureStorageService.instance;
    }

    private async initialize(): Promise<void> {
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
        const documentId = uuidv4();
        const version = 1;

        try {
            // Store document metadata
            const documentMetadata: StorageMetadata = {
                _id: documentId,
                ...metadata,
                version,
                createdAt: CURRENT_TIMESTAMP,
                createdBy: CURRENT_USER
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

            console.log(`[${CURRENT_TIMESTAMP}] Document stored successfully. ID: ${documentId}`);
            return documentId;

        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Failed to store document:`, error);
            throw error;
        }
    }

    async retrieveDocument(documentId: string, version?: number): Promise<{
        metadata: StorageMetadata;
        embedding: number[];
    }> {
        try {
            // Get latest version if not specified
            if (!version) {
                const versionDoc = await this.versionsCollection
                    .find({ documentId })
                    .sort({ version: -1 })
                    .limit(1)
                    .toArray();

                if (!versionDoc.length) {
                    throw new Error(`No versions found for document: ${documentId}`);
                }

                version = versionDoc[0].version;
            }

            // Get metadata
            const metadata = await this.documentsCollection.findOne({ _id: documentId });
            if (!metadata) {
                throw new Error(`Document not found: ${documentId}`);
            }

            // Get embedding
            const embeddingDoc = await this.embeddingsCollection.findOne({
                documentId,
                version
            });

            if (!embeddingDoc) {
                throw new Error(`Embedding not found for document: ${documentId}, version: ${version}`);
            }

            return {
                metadata,
                embedding: embeddingDoc.embedding
            };

        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Failed to retrieve document:`, error);
            throw error;
        }
    }

    async listDocuments(): Promise<StorageMetadata[]> {
        try {
            const documents = await this.documentsCollection
                .find({})
                .sort({ createdAt: -1 })
                .limit(20)
                .toArray();

            console.log(`[${new Date().toISOString()}] Retrieved ${documents.length} documents`);
            return documents;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to list documents:`, error);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        try {
            await this.mongoClient.close();
            console.log(`[${CURRENT_TIMESTAMP}] Storage connections closed`);
        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Failed to cleanup storage:`, error);
            throw error;
        }
    }
}

