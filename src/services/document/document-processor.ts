import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';
import { normalizeL2 } from '@/utils/vector-utils';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

interface DocumentMetadata {
    title: string;
    createdAt: string;
    createdBy: string;
    documentType: string;
    fileSize: number;
    pageCount?: number;
}

interface ProcessedDocument {
    id: string;
    content: string;
    embedding: number[];
    metadata: DocumentMetadata;
    chunks: ProcessedChunk[];
}

interface ProcessedChunk {
    id: string;
    content: string;
    embedding: number[];
    startPosition: number;
    endPosition: number;
}

export class DocumentProcessor {
    private static instance: DocumentProcessor;
    private embedder: GeminiEmbeddingService;

    private constructor() {
        this.embedder = GeminiEmbeddingService.getInstance();
        console.log(`[${CURRENT_TIMESTAMP}] Document processor initialized by ${CURRENT_USER}`);
    }

    public static getInstance(): DocumentProcessor {
        if (!DocumentProcessor.instance) {
            DocumentProcessor.instance = new DocumentProcessor();
        }
        return DocumentProcessor.instance;
    }

    async processDocument(
        content: string,
        metadata: DocumentMetadata
    ): Promise<ProcessedDocument> {
        try {
            console.log(`[${CURRENT_TIMESTAMP}] Processing document: ${metadata.title}`);

            // Generate document-level embedding
            const rawDocumentEmbedding = await this.embedder.generateEmbedding(content);
            // Apply L2 normalization to match Python script behavior
            const documentEmbedding = normalizeL2(rawDocumentEmbedding);

            // Split content into chunks (simple paragraph-based splitting for now)
            const chunks = this.splitIntoChunks(content);

            // Process each chunk
            const processedChunks = await Promise.all(
                chunks.map(async (chunk, index) => {
                    const rawEmbedding = await this.embedder.generateEmbedding(chunk.content);
                    // Apply L2 normalization to match Python script behavior
                    const embedding = normalizeL2(rawEmbedding);

                    return {
                        id: `${metadata.title}-chunk-${index}`,
                        content: chunk.content,
                        embedding,
                        startPosition: chunk.startPosition,
                        endPosition: chunk.endPosition
                    };
                })
            );

            const processedDocument: ProcessedDocument = {
                id: `doc-${Date.now()}`,
                content,
                embedding: documentEmbedding,
                metadata: {
                    ...metadata,
                    createdAt: metadata.createdAt || CURRENT_TIMESTAMP,
                    createdBy: metadata.createdBy || CURRENT_USER
                },
                chunks: processedChunks
            };

            console.log(`[${CURRENT_TIMESTAMP}] Document processed successfully. Chunks: ${processedChunks.length}`);
            return processedDocument;

        } catch (error) {
            console.error(`[${CURRENT_TIMESTAMP}] Error processing document:`, error);
            throw error;
        }
    }

    private splitIntoChunks(content: string): Array<{ content: string; startPosition: number; endPosition: number }> {
        // Split by paragraphs (double newlines)
        const paragraphs = content.split(/\n\s*\n/);

        let currentPosition = 0;
        return paragraphs
            .filter(p => p.trim().length > 0) // Remove empty paragraphs
            .map(paragraph => {
                const start = currentPosition;
                const end = start + paragraph.length;
                currentPosition = end + 2; // +2 for the double newline
                return {
                    content: paragraph.trim(),
                    startPosition: start,
                    endPosition: end
                };
            });
    }
}
