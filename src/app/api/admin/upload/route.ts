import { NextRequest, NextResponse } from 'next/server';
import { AzureStorageService } from '@/services/storage/azure-storage';
import { DocumentProcessor } from '@/services/document/document-processor';
import { PineconeService } from '@/services/pinecone';
import { PdfEmbeddingService } from '@/services/document/pdf-embedding-service';

// Helper to read the uploaded file as text
async function readFileAsText(file: any): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(arrayBuffer);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let documentId: string | undefined;

  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as any | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get file metadata
    const filename = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    console.log(`Processing file upload: name=${filename}, type=${fileType}, size=${fileSize}`);

    // Read file content as text
    const textContent = await readFileAsText(file);

    // Initialize services
    const storage = await AzureStorageService.getInstance();

    // STEP 1: Store document in Cosmos DB first (without embeddings)
    console.log('Storing document in Cosmos DB first (without embeddings)');
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    documentId = await storage.storeDocument(
      fileBuffer,
      {
        title: filename,
        contentType: fileType,
        size: fileSize,
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      },
      [] // Empty embedding array as placeholder
    );

    console.log(`Document stored in Cosmos DB with ID: ${documentId}`);

    // STEP 2: Try to process document and generate embeddings
    try {
      console.log('Attempting to process document and generate embeddings');

      // Check if the file is a PDF
      if (fileType.toLowerCase().includes('pdf')) {
        // Use the specialized PDF embedding service for PDFs
        const pdfEmbedder = PdfEmbeddingService.getInstance();

        console.log('Processing PDF document with specialized PDF embedding service');
        const result = await pdfEmbedder.processPdfAndStoreEmbeddings(fileBuffer, {
          documentId: documentId,
          metadata: {
            title: filename,
            documentType: fileType,
            createdAt: new Date().toISOString(),
            createdBy: 'admin'
          }
        });

        console.log(`Successfully processed PDF with ${result.chunkCount} chunks`);

        // Return success with full processing
        return NextResponse.json({
          success: true,
          documentId: documentId,
          message: 'PDF document processed and stored successfully with embeddings',
          embeddingsCount: result.chunkCount,
          embeddings: true
        });
      } else {
        // Use the regular document processor for non-PDF files
        const documentProcessor = DocumentProcessor.getInstance();
        const pinecone = PineconeService.getInstance();

        // Process document and generate embeddings
        const processedDocument = await documentProcessor.processDocument(textContent, {
          title: filename,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
          documentType: fileType,
          fileSize: fileSize
        });

        console.log('Document processed successfully, updating embeddings in Cosmos DB');

        // Update the document with the generated embedding
        // (This would require adding an updateEmbeddings method to your AzureStorageService)
        // await storage.updateEmbeddings(documentId, processedDocument.embedding);

        // Store vector embeddings in Pinecone
        console.log('Storing document embeddings in Pinecone');
        const index = pinecone.Index('docuflow-prod');

        // Store document-level embedding
        await index.upsert([{
          id: documentId,
          values: processedDocument.embedding,
          metadata: {
            title: filename,
            documentType: fileType,
            createdAt: new Date().toISOString(),
            isChunk: false,
            documentId: documentId
          }
        }]);

        // Store chunk embeddings
        const chunkVectors = processedDocument.chunks.map((chunk, idx) => ({
          id: `${documentId}-chunk-${idx}`,
          values: chunk.embedding,
          metadata: {
            title: filename,
            documentId: documentId,
            chunkId: idx,
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
            content: chunk.content.substring(0, 100), // Store a preview of the content
            isChunk: true
          }
        }));

        await index.upsert(chunkVectors);
        console.log('Successfully stored all embeddings in Pinecone');

        // Return success with full processing
        return NextResponse.json({
          success: true,
          documentId: documentId,
          message: 'Document processed and stored successfully with embeddings',
          embeddings: true
        });
      }
    } catch (embeddingError) {
      // If embeddings failed but document is stored, return partial success
      console.error('Error generating embeddings:', embeddingError);
      return NextResponse.json({
        success: true,
        documentId: documentId,
        message: 'Document stored successfully, but embedding generation failed',
        embeddings: false,
        embeddingError: embeddingError instanceof Error ? embeddingError.message : 'Unknown embedding error'
      });
    }

  } catch (error) {
    console.error('Error processing document upload:', error instanceof Error ? error.message : 'Unknown error');

    // If we have a documentId, the document was at least stored
    if (documentId) {
      return NextResponse.json({
        success: true,
        documentId: documentId,
        message: 'Document stored successfully, but further processing failed',
        embeddings: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 207 }); // 207 Multi-Status to indicate partial success
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process document' },
      { status: 500 }
    );
  }
}

// Set the maximum content length for this route
export const config = {
  api: {
    bodyParser: false, // Disable the default body parser as we're handling multipart form data
    responseLimit: '10mb',
  },
};
