import { NextRequest, NextResponse } from 'next/server';
import { queryRAGSystem } from '@/utils/ragHelper';

export async function POST(req: NextRequest) {
    try {
        const { message, userId, selectedPlan } = await req.json();
        console.log('API received selectedPlan:', selectedPlan);
        const response = await queryRAGSystem(message, undefined, selectedPlan);
        return NextResponse.json(response);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}