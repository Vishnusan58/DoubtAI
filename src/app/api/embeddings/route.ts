import { NextResponse } from 'next/server';
import { GeminiEmbeddingService } from '@/services/embeddings/gemini-embeddings';

const CURRENT_TIMESTAMP = '2025-05-17 06:22:25';
const CURRENT_USER = 'Vishnusan58';

export async function POST(req: Request) {
    try {
        const { texts, isBatch = false } = await req.json();

        const embedder = GeminiEmbeddingService.getInstance();

        const embeddings = isBatch
            ? await embedder.generateBatchEmbeddings(texts)
            : await embedder.generateEmbedding(texts);

        return NextResponse.json({
            success: true,
            embeddings,
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER,
                model: 'text-embedding-004',
                type: isBatch ? 'batch' : 'single'
            }
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Embedding generation failed',
            metadata: {
                timestamp: CURRENT_TIMESTAMP,
                user: CURRENT_USER
            }
        }, { status: 500 });
    }
}