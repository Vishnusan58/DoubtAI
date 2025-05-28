import { NextResponse } from 'next/server';
import { GraphRAGEngine } from '@/services/rag/graph-engine';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

/**
 * API endpoint for Graph RAG queries
 * This endpoint allows users to query the Graph RAG system
 */
export async function POST(req: Request) {
    try {
        const { query, tenantId, options = {} } = await req.json();

        if (!query) {
            return NextResponse.json({
                success: false,
                error: 'Query is required',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({
                success: false,
                error: 'Tenant ID is required',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        const graphRagEngine = new GraphRAGEngine();
        
        const result = await graphRagEngine.generateResponse(
            tenantId,
            query,
            {
                topK: options.topK || 3,
                expansionSteps: options.expansionSteps || 1,
                temperature: options.temperature || 0.2
            }
        );

        return NextResponse.json({
            success: true,
            response: result.response,
            metadata: {
                ...result.metadata,
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER,
                model: 'gemini-1.5-flash-latest',
                retrievalMethod: 'graph-rag'
            }
        });
    } catch (error) {
        console.error('Graph RAG query failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Graph RAG query failed',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}

/**
 * API endpoint for processing documents with Graph RAG
 * This endpoint allows users to process documents and create knowledge graphs
 */
export async function PUT(req: Request) {
    try {
        const { documentId, content, metadata = {} } = await req.json();

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

        if (!content) {
            return NextResponse.json({
                success: false,
                error: 'Document content is required',
                metadata: {
                    timestamp: CURRENT_TIMESTAMP,
                    user: CURRENT_USER
                }
            }, { status: 400 });
        }

        const graphRagEngine = new GraphRAGEngine();
        
        const result = await graphRagEngine.processDocument(
            documentId,
            content,
            metadata
        );

        return NextResponse.json({
            success: true,
            documentId: result.documentId,
            nodeCount: result.nodeCount,
            edgeCount: result.edgeCount,
            metadata: {
                ...result.metadata,
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER,
                processType: 'graph-rag'
            }
        });
    } catch (error) {
        console.error('Graph RAG document processing failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Graph RAG document processing failed',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}