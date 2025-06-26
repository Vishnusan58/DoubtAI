'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function AdminGraphRAG() {
  const [file, setFile] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [documentList, setDocumentList] = useState<Array<{id: string, title: string, createdAt: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Query state
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setUploadStatus('idle');
      setStatusMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage('Please select a PDF file first');
      return;
    }

    if (file.type !== 'application/pdf') {
      setStatusMessage('Only PDF files are supported for Graph RAG');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setStatusMessage('Uploading and processing PDF with Graph RAG...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/graphrag/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData && typeof errorData === 'object' && 'message' in errorData
          ? errorData.message
          : 'Failed to process document with Graph RAG';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setUploadStatus('success');
      const successMsg = `Document processed with Graph RAG successfully! Document ID: ${result?.documentId || 'Unknown'}`;
      setStatusMessage(successMsg);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
      
      // Refresh document list
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      const errorMsg = `Graph RAG processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setStatusMessage(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      setQueryResult('Please enter a query');
      return;
    }

    setIsQuerying(true);
    setQueryResult('');

    try {
      const response = await fetch('/api/admin/graphrag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          documentId: selectedDocumentId || undefined,
          tenantId: 'admin', // Using a fixed tenant ID for admin
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to query the graph database');
      }

      const result = await response.json();
      setQueryResult(result.response || 'No response received');
    } catch (error) {
      console.error('Query error:', error);
      setQueryResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsQuerying(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/admin/graphrag/documents');
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && 'documents' in data) {
          setDocumentList(data.documents);
        }
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Graph RAG Admin</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF for Graph RAG</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  onChange={handleFileChange} 
                  className="mb-4" 
                  accept=".pdf" 
                />
                <p className="text-sm text-gray-500 mb-4">
                  Only PDF files are supported for Graph RAG processing
                </p>
              </div>
              
              <Button 
                onClick={handleUpload} 
                disabled={!file || uploading}
                className="w-full"
              >
                {uploading ? 'Processing...' : 'Process with Graph RAG'}
              </Button>
              
              {statusMessage && (
                <div className={`mt-4 p-3 rounded-md ${
                  uploadStatus === 'success' ? 'bg-green-50 text-green-700' : 
                  uploadStatus === 'error' ? 'bg-red-50 text-red-700' : 
                  'bg-blue-50 text-blue-700'
                }`}>
                  {statusMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Graph RAG Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documentList.length > 0 ? (
              <ul className="space-y-2">
                {documentList.map(doc => (
                  <li 
                    key={doc.id} 
                    className={`p-3 border rounded-md flex justify-between items-center cursor-pointer ${
                      selectedDocumentId === doc.id ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                    onClick={() => setSelectedDocumentId(doc.id)}
                  >
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-500">{new Date(doc.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge>{doc.id}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No Graph RAG documents processed yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Graph Database</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Textarea
                placeholder="Enter your query here..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            
            <Button 
              onClick={handleQuery} 
              disabled={isQuerying || !query.trim()}
              className="w-full"
            >
              {isQuerying ? 'Querying...' : 'Query Graph Database'}
            </Button>
            
            {queryResult && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h3 className="font-medium mb-2">Response:</h3>
                <div className="whitespace-pre-wrap">{queryResult}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}