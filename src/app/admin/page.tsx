'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';


export default function AdminDashboard() {
  const [file, setFile] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [documentList, setDocumentList] = useState<Array<{id: string, title: string, createdAt: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setStatusMessage('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setStatusMessage('Uploading document...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData && typeof errorData === 'object' && 'message' in errorData
          ? errorData.message
          : 'Failed to upload document';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setUploadStatus('success');
      const successMsg = `Document uploaded successfully! Document ID: ${result?.documentId || 'Unknown'}`;
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
      const errorMsg = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setStatusMessage(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/admin/documents');
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
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  onChange={handleFileChange} 
                  className="mb-4" 
                  accept=".pdf,.docx,.txt" 
                />
                <p className="text-sm text-gray-500 mb-4">
                  Supported formats: PDF, DOCX, TXT
                </p>
              </div>
              
              <Button 
                onClick={handleUpload} 
                disabled={!file || uploading}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
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
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documentList.length > 0 ? (
              <ul className="space-y-2">
                {documentList.map(doc => (
                  <li key={doc.id} className="p-3 border rounded-md flex justify-between items-center">
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-500">{new Date(doc.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge>{doc.id}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No documents uploaded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
