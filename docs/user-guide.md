# DoubtAI User Guide

This guide provides instructions for using the DoubtAI system to query your documents.

## Getting Started

DoubtAI allows you to ask questions about your documents and receive accurate, contextually relevant answers. This guide will help you navigate the system and get the most out of it.

## Main Interface

When you access DoubtAI, you'll see a clean interface with:

- A search bar for entering your questions
- A tenant selector (if multiple tenants are configured)
- A results area where answers will be displayed

## Asking Questions

### Basic Querying

1. **Enter your question** in the search bar
   - Be specific and clear in your questions
   - You can ask in natural language, just as you would ask a person

2. **Select the appropriate tenant** (if applicable)
   - Different tenants may have different document collections
   - Selecting the correct tenant ensures you get answers from the relevant documents

3. **Submit your question** by pressing Enter or clicking the search button

4. **Review the answer**
   - The system will display the answer based on the content of your documents
   - The answer will include citations or references to the source documents

### Advanced Querying Techniques

For better results, consider these techniques:

1. **Be specific**: "What is the procedure for customer onboarding?" will yield better results than "Tell me about onboarding."

2. **Include context**: "What are the security requirements for the login page as mentioned in the design document?" provides more context than "What are the security requirements?"

3. **Follow-up questions**: You can ask follow-up questions to get more details on a topic.

## Admin Interface

If you have administrator access, you can manage documents through the admin interface:

### Accessing the Admin Interface

Navigate to `/admin` from the main URL to access the admin interface.

### Uploading Documents

1. **Select the "Upload" section** in the admin interface
2. **Choose the tenant** where you want to add the document
3. **Click "Browse"** to select a document from your computer
   - PDF documents are recommended for best results
4. **Add metadata** (optional) such as title, author, or date
5. **Click "Upload"** to start the upload process
6. **Wait for processing** to complete
   - Document processing may take some time depending on the size and complexity of the document
   - The system will extract text, generate embeddings, and build the knowledge graph

### Managing Documents

In the admin interface, you can also:

1. **View all documents** in the system
2. **Delete documents** that are no longer needed
3. **View processing status** of recently uploaded documents
4. **Manage tenants** (if you have super-admin privileges)

## Understanding Results

When you receive an answer from DoubtAI, you'll see:

1. **The generated answer** based on your documents
2. **Source references** indicating which documents and sections were used
3. **Confidence score** (if enabled) indicating the system's confidence in the answer
4. **Related questions** you might want to ask next

## Tips for Best Results

1. **Upload high-quality documents**
   - Text-based PDFs work best
   - Documents with clear structure and formatting yield better results

2. **Ask clear, specific questions**
   - Be precise about what you want to know
   - Include relevant context in your question

3. **Use the right tenant**
   - Make sure you're querying the appropriate document collection

4. **Try different phrasings**
   - If you don't get a satisfactory answer, try rephrasing your question

## Troubleshooting

### Common Issues

1. **No relevant results**
   - Check that you're using the correct tenant
   - Verify that relevant documents have been uploaded
   - Try rephrasing your question to be more specific

2. **Incomplete or incorrect answers**
   - The answer is based on the content of your documents
   - If information is missing from your documents, the system cannot provide it
   - Try asking for specific sections or documents if you know where the information should be

3. **System is slow to respond**
   - Complex queries or large document collections may take longer to process
   - Try simplifying your question or being more specific

For technical issues, please contact your system administrator or refer to the [Setup Guide](setup-guide.md) for more information.