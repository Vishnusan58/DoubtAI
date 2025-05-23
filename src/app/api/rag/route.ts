// app/api/rag/route.ts
import { NextResponse } from 'next/server';
import { queryRAGSystem } from '@/utils/ragHelper-enhanced'; // Adjust path if ragHelper.ts is elsewhere
// Assuming your Message type is in lib/types.ts

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            message, // The current user message (string)
            chatHistory, // Array of previous Message objects
            userId, // Optional: for logging or more advanced context
            selectedPlan // Optional: the name of the plan the user is asking about
        } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Basic validation for chatHistory
        if (chatHistory && !Array.isArray(chatHistory)) {
            return NextResponse.json({ error: 'chatHistory must be an array' }, { status: 400 });
        }

        console.log(`API Request for user: ${userId || 'anonymous'}`);
        console.log(`Selected Plan: ${selectedPlan || 'none'}`);
        // console.log('Chat History Received:', JSON.stringify(chatHistory, null, 2));

        // Call your RAG system query function
        // We'll need to modify queryRAGSystem to accept and use chatHistory
        const ragResponse = await queryRAGSystem(message, chatHistory || [], selectedPlan);

        return NextResponse.json(ragResponse);

    } catch (error) {
        console.error('API RAG Route Error:', error);
        let errorMessage = 'An unexpected error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: 'Failed to process chat message', details: errorMessage }, { status: 500 });
    }
}
