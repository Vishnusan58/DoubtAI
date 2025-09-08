import { NextResponse } from 'next/server';
import { Neo4jGraphRAGEngine } from '@/services/rag/neo4j-graph-engine';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

/**
 * API endpoint for uploading and processing PDFs with Neo4j Graph RAG
 * This endpoint allows users to upload PDF documents and process them with Graph RAG
 */
export async function POST(req: Request) {
    try {
        // Check if the request is a multipart form
        const contentType = req.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json({
                success: false,
                error: 'Request must be multipart/form-data',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        // Parse the form data
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({
                success: false,
                error: 'No file provided',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        // Check if the file is a PDF
        if (file.type !== 'application/pdf') {
            return NextResponse.json({
                success: false,
                error: 'Only PDF files are supported',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        // Get the file buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Get the file name without extension
        const fileName = file.name.replace(/\.[^/.]+$/, '');

        // Process the PDF with Neo4j Graph RAG
        const graphRagEngine = new Neo4jGraphRAGEngine();
        
        const result = await graphRagEngine.processPdfDocument(
            buffer,
            fileName,
            {
                originalFileName: file.name,
                uploadedBy: CURRENT_USER,
                uploadedAt: CURRENT_TIMESTAMP
            }
        );

        return NextResponse.json({
            success: true,
            documentId: result.documentId,
            title: result.title,
            nodeCount: result.nodeCount,
            edgeCount: result.edgeCount,
            metadata: {
                ...result.metadata,
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER,
                processType: 'neo4j-graph-rag'
            }
        });
    } catch (error) {
        console.error('Neo4j Graph RAG PDF processing failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Neo4j Graph RAG PDF processing failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}