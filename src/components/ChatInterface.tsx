"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Send, UserCircle, BotIcon as Bot, X, MessageCircle, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '@/components/ui/Input';
import type { Message as ChatAppMessage } from '@/lib/types'; // Import your main Message type from lib/types.ts

// Define the Message interface clearly for this component.
// It extends the ChatAppMessage from your lib/types.ts to ensure consistency.
type Message = ChatAppMessage

// Define interfaces for plan data for type safety and clarity.
interface CoverageDetail {
    label: string;
    inNetwork: string;
    outOfNetwork: string;
}

interface InsurancePlan {
    planName: string;
    summary?: string;
    coverageDetails?: CoverageDetail[];
}

// Your existing plan data (CURRENT_PLAN, AVAILABLE_PLANS)
// It's good practice to type these as well.
const CURRENT_PLAN: InsurancePlan = {
    planName: "Horizon Platinum",
    coverageDetails: [
        { label: "Physician Visit", inNetwork: "$20 Copayment / Visit", outOfNetwork: "30% Coinsurance" },
        { label: "Diagnostic Test (X-Ray, Blood Work)", inNetwork: "No Charge", outOfNetwork: "30% Coinsurance" },
        { label: "Imaging (CT/PET Scans, MRIs)", inNetwork: "No Charge", outOfNetwork: "30% Coinsurance" },
        { label: "Outpatient Surgery", inNetwork: "$150 Copayment / Visit", outOfNetwork: "30% Coinsurance" },
        { label: "Emergency Room Care", inNetwork: "$100 Copayment / Visit", outOfNetwork: "$100 Copayment / Visit (Deductible does not apply)" },
        { label: "Emergency Medical Transportation", inNetwork: "No Charge", outOfNetwork: "No Charge (Deductible does not apply)" },
        { label: "Urgent Care", inNetwork: "$75 Copayment", outOfNetwork: "$75 Copayment (Deductible does not apply)" }
    ]
};

const AVAILABLE_PLANS: InsurancePlan[] = [
    CURRENT_PLAN, // Includes the current plan as an available option
    {
        planName: "United Healthcare", // Example Plan 1
        summary: "UnitedHealthcare EPO plan offers comprehensive benefits with a focus on network providers. It typically features no overall deductible for in-network services and a fixed out-of-pocket maximum. Maternity coverage is usually robust, often with no charge for routine office visits and professional services, though facility services might incur a per-day copay. Children's vision and dental benefits are often included, making it a strong candidate for families.",
        // Add more coverageDetails if available for a richer display
    },
    {
        planName: "AmeriHealth Platinum", // Example Plan 2
        summary: "AmeriHealth Platinum EPO National Access provides broad coverage, often with no overall deductible and a defined out-of-pocket limit. Maternity care typically includes no charge for preventive visits and professional services, with a copay structure for facility services. Vision benefits for children are usually part of the plan, though dental coverage might vary.",
        // Add more coverageDetails if available
    }
];

// Sub-component for rendering individual messages (MessageItem)
const MessageItem: React.FC<{
    message: Message;
    selectedPlanName?: string;
    onPlanSelect: (planName: string) => void;
    onOptionClick: (optionText: string) => void;
}> = ({ message, selectedPlanName, onPlanSelect, onOptionClick }) => {
    const [formattedTime, setFormattedTime] = useState('');

    // Effect to format timestamp on the client side to avoid hydration mismatch
    useEffect(() => {
        if (message.timestamp) {
            setFormattedTime(new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
    }, [message.timestamp]);

    return (
        <div className={`flex mb-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* Bot Avatar */}
            {message.type === 'bot' && <Bot className="h-6 w-6 text-slate-500 mr-2 flex-shrink-0 mt-1" />}

            <div className={`max-w-[75%] md:max-w-[80%] flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Message Bubble */}
                <div
                    className={`py-2 px-3 shadow-sm text-sm ${
                        message.type === 'user'
                            ? 'bg-teal-600 text-white rounded-lg rounded-br-none' // User message style
                            : 'bg-slate-100 text-slate-800 rounded-lg rounded-bl-none' // Bot message style
                    }`}
                >
                    {/* Message Content - prose class helps with basic markdown from LLM */}
                    <div className="prose prose-sm text-inherit max-w-none" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }}></div>

                    {/* Plan Recommendations */}
                    {message.recommendations && message.recommendations.length > 0 && (
                        <div className="mt-2.5 space-y-2.5">
                            {message.recommendations.map((plan, i) => (
                                <Card
                                    key={`${plan.planName}-${message.id}-${i}`} // Unique key for each plan card
                                    className={`p-2.5 hover:shadow-md transition-shadow cursor-pointer ${
                                        selectedPlanName === plan.planName ? 'border-2 border-teal-500 bg-teal-50' : 'border border-slate-200 bg-white'
                                    }`}
                                    onClick={() => onPlanSelect(plan.planName)}
                                >
                                    <h3 className="font-semibold text-teal-700 mb-1 text-sm">{plan.planName}</h3>
                                    {/* Display plan summary or coverage details */}
                                    {plan.coverageDetails && plan.coverageDetails.length > 0 ? (
                                        <div className="text-xs space-y-0.5 text-slate-600">
                                            <div className="grid grid-cols-[auto,1fr,1fr] gap-x-1.5 mb-0.5 text-slate-700 items-center">
                                                <span className="font-medium text-xs">Service</span>
                                                <div className="text-center flex flex-col text-xs"><span>In-Network</span></div>
                                                <div className="text-center flex flex-col text-xs"><span>Out-of-Network</span></div>
                                            </div>
                                            {plan.coverageDetails.map((detail, j) => (
                                                <div key={`${plan.planName}-detail-${message.id}-${j}`} className="grid grid-cols-[auto,1fr,1fr] gap-x-1.5 border-t border-slate-100 pt-1 items-center">
                                                    <span className="text-slate-500 text-xs font-medium">{detail.label}</span>
                                                    <span className="text-center text-xs">{detail.inNetwork}</span>
                                                    <span className="text-center text-xs">{detail.outOfNetwork}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : plan.summary ? (
                                        <p className="text-slate-600 prose prose-xs max-w-none">{plan.summary}</p>
                                    ): null}
                                </Card>
                            ))}
                        </div>
                    )}
                    {/* Quick Reply Options */}
                    {message.options && message.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-1.5 border-t border-slate-200">
                            {message.options.map((option, i) => (
                                <Button
                                    key={`option-${message.id}-${i}`} // Unique key for each option
                                    variant="outline" size="sm"
                                    className="text-xs bg-white border-slate-300 text-teal-600 hover:bg-slate-50 hover:border-teal-500 h-auto py-1 px-2 rounded-md"
                                    onClick={() => onOptionClick(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Timestamp */}
                {formattedTime && (
                    <p className={`text-xs mt-0.5 ${message.type === 'user' ? 'text-slate-500 mr-1' : 'text-slate-400 ml-1'}`}>
                        {formattedTime}
                    </p>
                )}
            </div>
            {/* User Avatar */}
            {message.type === 'user' && <UserCircle className="h-6 w-6 text-slate-400 ml-2 flex-shrink-0 mt-1" />}
        </div>
    );
};

// Main Chat Interface Component
const ChatInterface: React.FC<{ onClose?: () => void, isVisible?: boolean }> = ({ onClose, isVisible = true }) => {
    // State variables
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedPlanName, setSelectedPlanName] = useState<string>('');
    const [userId] = useState(() => `user-${Math.random().toString(36).substring(2, 9)}`); // Unique user ID for the session
    const [isCurrentPlanMode, setIsCurrentPlanMode] = useState(false); // Tracks if conversation is about current plan
    const [awaitingLifeEvent, setAwaitingLifeEvent] = useState(false); // Tracks if bot is waiting for life event info
    const [planRecommendationShown, setPlanRecommendationShown] = useState(false); // Tracks if recommendations were shown
    const [isDocumentMode, setIsDocumentMode] = useState(false); // Track if conversation is about documents

    const messagesEndRef = useRef<HTMLDivElement>(null); // Ref to scroll to the latest message

    // Effect to initialize chat with a welcome message on component mount (client-side only)
    useEffect(() => {
        setMessages([
            {
                id: `bot-initial-1-${Date.now()}`, type: 'bot',
                content: "Hello! I'm your Doubt assistant. How can I help you today?",
                timestamp: new Date().toISOString() // Timestamps are crucial for ordering and display
            },
        ]);
    }, []); // Empty dependency array ensures this runs only once

    // Effect to scroll to the bottom of the chat when new messages are added or loading state changes
    useEffect(() => {
        if (isVisible) { // Only scroll if the chat widget is visible
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading, isVisible]);

    // Function to check if query is document-related
    const isDocumentQuery = (query: string): boolean => {
        const documentKeywords = [
            'document', 'documents', 'file', 'files', 'pdf', 'doc', 'docx', 'search',
            'find', 'locate', 'resume', 'paper', 'upload', 'uploaded', 'attachment',
            'report', 'read', 'content', 'information in', 'data from'
        ];

        const lowerQuery = query.toLowerCase();
        return documentKeywords.some(keyword => lowerQuery.includes(keyword));
    };

    // Function to handle document search
    const handleDocumentSearch = async (query: string): Promise<any> => {
        try {
            const response = await fetch('/api/documents/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: "Unknown error with document search" }));
                throw new Error(`Document search error: ${response.statusText}. Details: ${errorData.details || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Document search error:', error);
            return {
                error: true,
                message: "I encountered an issue when searching through documents. Please try again or refine your query."
            };
        }
    };

    // Function to handle API call to the RAG backend
    const handleRagApiCall = async (userMessageContent: string, currentChatHistory: Message[]) => {
        // Prepare chat history for the API: map to simple {role, content} objects
        const historyForAPI = currentChatHistory.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant', // Map 'bot' type to 'assistant' for OpenAI
            content: msg.content
        }));

        try {
            const response = await fetch('/api/rag', { // API endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessageContent,
                    chatHistory: historyForAPI, // Send the formatted history
                    userId: userId,
                    selectedPlan: selectedPlanName // Send name of the currently selected plan
                }),
            });
            if (!response.ok) { // Handle HTTP errors
                const errorData = await response.json().catch(() => ({details: "Unknown error structure from API"}));
                throw new Error(`Network response was not ok: ${response.statusText}. Details: ${errorData.details || response.statusText}`);
            }
            return await response.json(); // Parse JSON response from API
        } catch (error) {
            console.error('RAG API Call Error in ChatInterface:', error);
            // Return a structured error message for display in chat
            return { message: "I'm having trouble connecting to my knowledge base. Please try again.", error: true };
        }
    };

    // Function to handle form submission (when user sends a message)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission
        if (!inputValue.trim() || loading) return; // Ignore empty messages or if already loading

        const userMessageContent = inputValue;
        setInputValue(''); // Clear the input field

        // Create the new user message object
        const newUserMessage: Message = {
            id: `user-${Date.now()}`, type: 'user',
            content: userMessageContent, timestamp: new Date().toISOString()
        };

        // Add new user message to the state and then pass the *updated* list to API call
        // This ensures the history sent to the API includes the latest user message for context
        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        setLoading(true); // Set loading state for typing indicator and disabling input

        try {
            let data;

            // Check if this is a document-related query
            if (isDocumentMode || isDocumentQuery(userMessageContent)) {
                setIsDocumentMode(true);

                // Call document search API
                data = await handleDocumentSearch(userMessageContent);

                if (!data.error && data.documents?.length > 0) {
                    // Format response with document information
                    let responseContent = data.enhancedResponse || '';

                    if (!responseContent) {
                        responseContent = `I found ${data.documents.length} documents that might answer your question:\n\n`;
                        data.documents.forEach((doc: any, index: number) => {
                            responseContent += `${index + 1}. **${doc.title}**\n`;
                            if (doc.highlights?.content) {
                                responseContent += `   Excerpt: ${doc.highlights.content[0]}\n\n`;
                            }
                        });
                    }

                    // Create bot response with document results
                    const botMessage: Message = {
                        id: `bot-${Date.now()}`,
                        type: 'bot',
                        content: responseContent,
                        timestamp: new Date().toISOString(),
                        documentResults: data.documents // Store document results
                    };
                    setMessages(prev => [...prev, botMessage]);
                } else if (data.error) {
                    // Handle document search error
                    const botMessage: Message = {
                        id: `bot-${Date.now()}`,
                        type: 'bot',
                        content: data.message || "I couldn't find any relevant documents for your query.",
                        timestamp: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, botMessage]);
                } else {
                    // No documents found, fall back to regular RAG
                    data = await handleRagApiCall(userMessageContent, updatedMessages);

                    const botMessage: Message = {
                        id: `bot-${Date.now()}`,
                        type: 'bot',
                        content: data.message || "I couldn't find specific documents matching your query. Is there something else I can help with?",
                        timestamp: new Date().toISOString(),
                        recommendations: data.recommendations,
                        options: data.options,
                        confidence: data.metadata?.confidence
                    };
                    setMessages(prev => [...prev, botMessage]);
                }
            } else {
                // Regular RAG flow (non-document query)
                data = await handleRagApiCall(userMessageContent, updatedMessages);

                const botMessage: Message = {
                    id: `bot-${Date.now()}`,
                    type: 'bot',
                    content: data.message || "Sorry, I couldn't process that request at the moment.",
                    timestamp: new Date().toISOString(),
                    recommendations: data.recommendations,
                    options: data.options,
                    confidence: data.metadata?.confidence
                };
                setMessages(prev => [...prev, botMessage]);
            }
        } catch (error) { // Catch errors from handleSubmit logic or API call
            console.error('Error in handleSubmit:', error);
            const errorBotMessage: Message = {
                id: `bot-error-${Date.now()}`, type: 'bot',
                content: "Apologies, an unexpected error occurred. Please try asking your question again.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorBotMessage]);
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    // Function to handle when a user selects a plan from recommendations
    const handlePlanSelection = (planName: string) => {
        setSelectedPlanName(planName); // Set the selected plan name
        setIsCurrentPlanMode(false); // Exit "current plan only" mode
        setPlanRecommendationShown(true); // Indicate a plan is actively being discussed

        // Create a message to reflect user's selection
        const userSelectionMessage: Message = {
            id: `user-select-${Date.now()}`, type: 'user',
            content: `Tell me more about ${planName}.`, timestamp: new Date().toISOString()
        };

        // Bot's acknowledgment and prompt for further questions
        const botResponse: Message = {
            id: `bot-select-${Date.now()}`, type: 'bot',
            content: `Okay, you've selected ${planName}. What specific questions do you have about its coverage, benefits, or costs?`,
            timestamp: new Date().toISOString()
        };

        const updatedMessages = [...messages, userSelectionMessage, botResponse];
        setMessages(updatedMessages);

        // Optionally, you can trigger an immediate RAG call for the selected plan's overview
        // setLoading(true);
        // handleRagApiCall(`Overview of ${planName}`, updatedMessages)
        //   .then(data => {
        //     const overviewMessage: Message = { /* ... create message from data ... */ };
        //     setMessages(prev => [...prev, overviewMessage]);
        //   })
        //   .finally(() => setLoading(false));
    };

    // Function to handle clicks on quick reply option buttons
    const handleOptionClick = (optionText: string) => {
        // Create a user message from the clicked option
        const userMessage: Message = {
            id: `user-option-${Date.now()}`, type: 'user',
            content: optionText, timestamp: new Date().toISOString()
        };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages); // Add user's choice to messages
        setLoading(true); // Set loading state

        // Process the user's intent based on the clicked option, including history
        processUserIntent(optionText, updatedMessages);
    };

    // Helper function to process intents, especially from option clicks or specific commands
    const processUserIntent = async (intentText: string, currentHistory: Message[]) => {
        try {
            // Example: if an option click needs to hit the RAG system directly
            // You might have more specific logic here based on `intentText`
            const data = await handleRagApiCall(intentText, currentHistory); // Pass intent and history
            const botMessage: Message = {
                id: `bot-intent-${Date.now()}`, type: 'bot',
                content: data.message || "I'm processing that option for you.",
                timestamp: new Date().toISOString(),
                recommendations: data.recommendations,
                options: data.options,
                confidence: data.metadata?.confidence
            };
            setMessages(prev => [...prev, botMessage]);

        } catch (error) { // Handle errors during intent processing
            const errorBotMessage: Message = {
                id: `bot-error-intent-${Date.now()}`, type: 'bot',
                content: "There was an issue processing your selection. Please try again.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorBotMessage]);
        } finally {
            setLoading(false); // Ensure loading is reset
        }
    };

    // If the chat widget is not visible, render nothing
    if (!isVisible) {
        return null;
    }

    // Main JSX for the chat interface
    return (
        // Outermost container for the fixed floating chat window
        <div className="fixed bottom-4 right-4 w-[360px] h-[calc(100vh-80px)] max-h-[520px] md:w-[400px] md:max-h-[600px] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-300 z-50">
            {/* Chat Header */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0">
                <div className="flex items-center">
                    <MessageCircle className="h-6 w-6 mr-2 text-teal-600" /> {/* Aptia teal icon */}
                    <div>
                        <h1 className="text-sm font-semibold text-slate-700">Doubt Support</h1>
                        <p className="text-xs text-teal-600">Online</p> {/* Status indicator */}
                    </div>
                </div>
                {/* Close button for the chat widget */}
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>

            {/* Messages Area: Scrolls to show latest messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
                {messages.map((msg) => (
                    <MessageItem
                        key={msg.id} // Unique key for each message item
                        message={msg}
                        selectedPlanName={selectedPlanName}
                        onPlanSelect={handlePlanSelection}
                        onOptionClick={handleOptionClick}
                    />
                ))}
                {/* Typing Indicator: Shows when 'loading' is true */}
                {loading && messages.length > 0 && messages[messages.length -1]?.type === 'user' && (
                    <div className="flex justify-start mb-3">
                        <Bot className="h-6 w-6 text-slate-500 mr-2 flex-shrink-0 mt-1" />
                        <div>
                            <div className="bg-slate-100 text-slate-600 rounded-lg rounded-bl-none py-2 px-3 max-w-[70%] shadow-sm text-sm animate-pulse">
                                Aptia Assistant is typing...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
            </div>

            {/* Input Form Area */}
            <form onSubmit={handleSubmit} className="p-2.5 bg-slate-50 border-t border-slate-200 sticky bottom-0">
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-white border-slate-300 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 rounded-md px-3 py-2 text-sm"
                        disabled={loading} // Disable input while loading/bot is typing
                        onKeyPress={(event) => { // Allow sending message with Enter key
                            if (event.key === 'Enter' && !event.shiftKey && !loading) {
                                handleSubmit(event as any); // Type assertion for event
                            }
                        }}
                    />
                    <Button type="submit" size="icon" className="bg-teal-500 hover:bg-teal-600 text-white rounded-md w-9 h-9" disabled={loading}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;
