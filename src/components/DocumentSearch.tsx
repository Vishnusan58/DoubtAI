'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  title: string;
  content?: string;
  metadata?: any;
  score?: number;
  highlights?: any;
}

export default function DocumentSearchComponent() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [enhancedResponse, setEnhancedResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setSearching(true);
    setError(null);
    setEnhancedResponse(null);

    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.documents && Array.isArray(data.documents)) {
        setResults(data.documents);
      } else {
        setResults([]);
      }

      if (data.enhancedResponse) {
        setEnhancedResponse(data.enhancedResponse);
      }

      if (data.documents?.length === 0) {
        setError('No documents found matching your query');
      }

    } catch (err) {
      console.error('Error searching documents:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during search');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Document Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Input
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={searching}
              className="flex-grow"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {enhancedResponse && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-2">AI Response:</h3>
              <div className="whitespace-pre-wrap">{enhancedResponse}</div>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Found {results.length} documents</h3>
              <div className="space-y-3">
                {results.map((result) => (
                  <Card key={result.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-md">{result.title}</h4>
                        <Badge variant="outline">{result.metadata?.contentType || 'Unknown Type'}</Badge>
                      </div>

                      {result.highlights?.content && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-semibold">Excerpt: </span>
                          <div dangerouslySetInnerHTML={{ __html: result.highlights.content.join('...') }} />
                        </div>
                      )}

                      {result.score !== undefined && (
                        <div className="mt-2 text-xs text-gray-500">
                          Relevance: {(result.score * 100).toFixed(1)}%
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
