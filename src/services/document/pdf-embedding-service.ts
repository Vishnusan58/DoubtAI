import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';
import { PDFProcessor } from './pdf-processor';
import { normalizeL2 } from '@/utils/vector-utils';
import { PineconeService } from '@/services/pinecone';
import * as crypto from 'crypto';

interface PdfProcessingOptions {
  chunkSize?: number;
  overlapSize?: number;
  documentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for processing PDF documents and storing their embeddings in Pinecone
 * This integrates the functionality from your Python script into your TypeScript app
 */
export class PdfEmbeddingService {
  private static instance: PdfEmbeddingService;
  private embedder: GeminiEmbeddingService;
  private pdfProcessor: PDFProcessor;
  private pinecone: PineconeService;

  private constructor() {
    this.embedder = GeminiEmbeddingService.getInstance();
    this.pdfProcessor = PDFProcessor.getInstance();
    this.pinecone = PineconeService.getInstance();
    console.log(`[${new Date().toISOString()}] PDF Embedding Service initialized`);
  }

  public static getInstance(): PdfEmbeddingService {
    if (!PdfEmbeddingService.instance) {
      PdfEmbeddingService.instance = new PdfEmbeddingService();
    }
    return PdfEmbeddingService.instance;
  }

  /**
   * Process a PDF file and store its embeddings in Pinecone
   * This method mimics the functionality in your Python script
   */
  async processPdfAndStoreEmbeddings(
    pdfBuffer: Buffer,
    options: PdfProcessingOptions = {}
  ): Promise<{ documentId: string; chunkCount: number }> {
    try {
      console.log(`[${new Date().toISOString()}] Processing PDF document and generating embeddings`);

      // Extract text from PDF
      const documentText = await this.pdfProcessor.extractTextFromPDF(pdfBuffer);

      // Set default options
      const chunkSize = options.chunkSize || 500; // Same as in your Python script
      const documentId = options.documentId || `doc-${crypto.randomUUID()}`;

      // Split into chunks similar to your Python script
      const textChunks = this.splitTextIntoChunks(documentText, chunkSize);
      console.log(`[${new Date().toISOString()}] Document split into ${textChunks.length} chunks`);

      // Get Pinecone index
      const index = this.pinecone.Index('myvectordbb'); // Using your index name from the Python script

      // Process and store each chunk
      const vectors = await Promise.all(
        textChunks.map(async (chunk, i) => {
          // Generate embedding
          const embedding = await this.embedder.generateEmbedding(chunk);

          // Normalize embedding using L2 norm (like in your Python script)
          const normalizedEmbedding = normalizeL2(embedding);

          // Create vector ID using hash (similar to your Python approach)
          const vectorId = crypto.createHash('sha256').update(`${documentId}-chunk-${i}`).digest('hex');

          // Return the vector object for Pinecone
          return {
            id: vectorId,
            values: normalizedEmbedding,
            metadata: {
              text: chunk,
              documentId: documentId,
              chunkIndex: i,
              ...options.metadata
            }
          };
        })
      );

      // Store vectors in Pinecone
      await index.upsert(vectors);

      console.log(`[${new Date().toISOString()}] Successfully stored ${vectors.length} chunks in Pinecone`);

      return {
        documentId,
        chunkCount: textChunks.length
      };

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing PDF document:`, error);
      throw error;
    }
  }

  /**
   * Split text into chunks of specified size
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    // Simple chunking by character count
    const chunks: string[] = [];

    // First split by paragraphs to maintain some context
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    let currentChunk = "";

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        // Store current chunk and start a new one
        chunks.push(currentChunk);
        currentChunk = paragraph;
      }
      // If the paragraph itself exceeds chunk size, split it
      else if (paragraph.length > chunkSize) {
        // If we have a current chunk, add it first
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        // Split the large paragraph
        let i = 0;
        while (i < paragraph.length) {
          chunks.push(paragraph.substring(i, i + chunkSize));
          i += chunkSize;
        }
      }
      // Otherwise, add to current chunk
      else {
        if (currentChunk.length > 0) {
          currentChunk += " ";
        }
        currentChunk += paragraph;
      }
    }

    // Don't forget the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
