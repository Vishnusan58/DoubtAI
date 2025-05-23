/**
 * Service for handling PDF document processing
 */
export class PDFProcessor {
  private static instance: PDFProcessor;

  private constructor() {
    console.log(`[${new Date().toISOString()}] PDF processor initialized`);
  }

  public static getInstance(): PDFProcessor {
    if (!PDFProcessor.instance) {
      PDFProcessor.instance = new PDFProcessor();
    }
    return PDFProcessor.instance;
  }

  /**
   * Extract text from a PDF file
   * This is an improved implementation that attempts to extract some basic information from the PDF
   * For production use, you should install a proper PDF parsing library like pdf-parse
   * npm install pdf-parse
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      console.log(`[${new Date().toISOString()}] Extracting text from PDF`);

      // Basic PDF structure check and metadata extraction
      // This is not a full PDF parser but can extract basic information
      let pdfContent = "";

      // Check for PDF signature
      const isPdf = pdfBuffer.slice(0, 5).toString() === '%PDF-';
      if (!isPdf) {
        throw new Error('The provided buffer does not appear to be a valid PDF');
      }

      // Extract basic metadata and text from the buffer
      const bufferString = pdfBuffer.toString('utf-8', 0, Math.min(10000, pdfBuffer.length));

      // Extract PDF version
      const pdfVersion = bufferString.substring(5, 8);
      pdfContent += `PDF Version: ${pdfVersion}\n\n`;

      // Try to extract some text content (very basic approach)
      // Look for text objects in the PDF
      const textMatches = bufferString.match(/\(([^)]+)\)/g);
      if (textMatches && textMatches.length > 0) {
        pdfContent += "Extracted Text Content:\n";
        const uniqueTexts = new Set(textMatches.map(match => match.slice(1, -1)));
        pdfContent += Array.from(uniqueTexts)
          .filter(text => text.length > 3) // Filter out very short strings
          .join('\n');
      }

      // Extract metadata if available
      const titleMatch = bufferString.match(/\/Title\s*\(([^)]+)\)/);
      const authorMatch = bufferString.match(/\/Author\s*\(([^)]+)\)/);
      const subjectMatch = bufferString.match(/\/Subject\s*\(([^)]+)\)/);

      if (titleMatch || authorMatch || subjectMatch) {
        pdfContent += "\n\nDocument Metadata:\n";
        if (titleMatch) pdfContent += `Title: ${titleMatch[1]}\n`;
        if (authorMatch) pdfContent += `Author: ${authorMatch[1]}\n`;
        if (subjectMatch) pdfContent += `Subject: ${subjectMatch[1]}\n`;
      }

      // Add PDF file size
      pdfContent += `\nDocument Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`;

      // Add recommendations for better parsing
      pdfContent += "\n\nNote: This is a basic text extraction. For better results, install a proper PDF parsing library.";

      console.log(`[${new Date().toISOString()}] PDF text extraction completed`);

      if (pdfContent.length < 100) {
        // If we couldn't extract much useful content, include this message
        pdfContent += `\n\nThe document contains ${pdfBuffer.length} bytes of binary data that could not be fully extracted as text. For complete text extraction, please install a PDF parsing library like pdf-parse.`;
      }

      return pdfContent;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error extracting text from PDF:`, error);
      throw error;
    }
  }
}
