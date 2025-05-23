import { NextRequest, NextResponse } from 'next/server';
import { AzureStorageService } from '@/services/storage/azure-storage';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Initialize storage service
    const storage = await AzureStorageService.getInstance();

    // Get all documents from the storage
    const documents = await storage.listDocuments();

    return NextResponse.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
        contentType: doc.contentType,
        size: doc.size
      }))
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
