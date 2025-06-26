import { NextResponse } from 'next/server';
import { Neo4jGraphRAGEngine } from '@/services/rag/neo4j-graph-engine';

const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Vishnusan58';

/**
 * API endpoint for querying the Neo4j graph database with Graph RAG
 * This endpoint allows users to query the graph database and get responses
 */
export async function POST(req: Request) {
    try {
        const { query, documentId, tenantId = 'admin', options = {} } = await req.json();

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

        const graphRagEngine = new Neo4jGraphRAGEngine();
        
        const result = await graphRagEngine.generateResponse(
            query,
            {
                documentId,
                tenantId,
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
                retrievalMethod: 'neo4j-graph-rag'
            }
        });
    } catch (error) {
        console.error('Neo4j Graph RAG query failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Neo4j Graph RAG query failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}