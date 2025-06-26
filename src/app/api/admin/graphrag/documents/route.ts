import { NextResponse } from 'next/server';
import { Neo4jGraphRAGEngine } from '@/services/rag/neo4j-graph-engine';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

/**
 * API endpoint for retrieving documents from Neo4j
 * This endpoint allows users to get a list of all documents in the graph database
 */
export async function GET(req: Request) {
    try {
        const graphRagEngine = new Neo4jGraphRAGEngine();
        
        const documents = await graphRagEngine.getAllDocuments();

        return NextResponse.json({
            success: true,
            documents,
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER,
                count: documents.length
            }
        });
    } catch (error) {
        console.error('Failed to retrieve documents from Neo4j:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to retrieve documents',
            message: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}

/**
 * API endpoint for retrieving a specific document from Neo4j
 * This endpoint allows users to get a document by ID
 */
export async function POST(req: Request) {
    try {
        const { documentId } = await req.json();

        if (!documentId) {
            return NextResponse.json({
                success: false,
                error: 'Document ID is required',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        const graphRagEngine = new Neo4jGraphRAGEngine();
        
        const document = await graphRagEngine.getDocumentById(documentId);

        if (!document) {
            return NextResponse.json({
                success: false,
                error: 'Document not found',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            document,
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        });
    } catch (error) {
        console.error('Failed to retrieve document from Neo4j:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to retrieve document',
            message: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}