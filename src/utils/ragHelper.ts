// lib/ragHelper.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai";

// Import the local JSON data (now an array of service objects)
// Make sure this path is correct relative to your ragHelper.ts file.
// If ragHelper.ts is in src/utils/ and plan_details.json is in src/data/,
// the path would be '../data/plan_details.json'
import planServicesData from '@/data/plan_details.json';

interface ChatMessageForHistory {
    type: 'user' | 'bot' | 'ai_response' | 'system' | 'function';
    content: string;
}

// Define the structure of a single service entry from your JSON
interface PlanServiceEntry {
    Plan: string;
    Service: string;
    In_Network_Cost: string;
    Out_of_Network_Coverage: string;
    Prior_Authorization_Required: string;
    Other_Notes: string;
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'your_google_api_key_env_variable_name';

if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_env_variable_name') {
    console.warn("Google API Key for Gemini is not set or is using the default placeholder.");
}

interface RAGResponse {
    type: 'ai_response' | 'error';
    message: string;
    metadata?: {
        context?: string;
        confidence?: number;
        planName?: string;
    };
}

// Simplified PlanConfig, primarily for display name.
// The actual plan details will be filtered from the JSON array.
interface PlanConfig {
    displayName: string;
    // No planKey or description needed here if we always filter by displayName
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);

// Function to get a "plan configuration" (mainly the display name)
// and to check if any data exists for the given plan name in the JSON.
function getPlanConfigFromServiceArray(planName?: string): PlanConfig | undefined {
    const targetPlanName = planName || (planServicesData.length > 0 ? planServicesData[0].Plan : undefined);
    if (!targetPlanName) {
        console.warn("No plan name provided and JSON data is empty or has no 'Plan' field in the first item.");
        return undefined;
    }

    // Check if any service entries exist for this plan name
    const servicesForPlan = (planServicesData as PlanServiceEntry[]).filter(
        service => service.Plan.toLowerCase() === targetPlanName.toLowerCase()
    );

    if (servicesForPlan.length > 0) {
        // Return the display name (assuming it's consistent in the JSON for that plan)
        return {
            displayName: servicesForPlan[0].Plan // Use the exact casing from the first found entry
        };
    }

    console.warn(`No service entries found for plan name "${targetPlanName}" in JSON data.`);
    return undefined;
}


function formatChatHistoryForGemini(chatHistory: ChatMessageForHistory[]): Content[] {
    const geminiReadyHistory: Content[] = [];
    const recentHistory = chatHistory.slice(-10); // Keep last 10 turns (5 user, 5 bot)
    let currentRoleExpected: 'user' | 'model' = 'user';

    for (const msg of recentHistory) {
        const msgRole = (msg.type === 'user') ? 'user' : 'model';
        if (geminiReadyHistory.length === 0) {
            if (msgRole === 'user') {
                geminiReadyHistory.push({ role: msgRole, parts: [{ text: msg.content }] });
                currentRoleExpected = 'model';
            }
        } else {
            if (msgRole === currentRoleExpected) {
                geminiReadyHistory.push({ role: msgRole, parts: [{ text: msg.content }] });
                currentRoleExpected = (currentRoleExpected === 'user') ? 'model' : 'user';
            } else {
                console.warn(`Skipping message in history due to role sequence: expected ${currentRoleExpected}, got ${msgRole}`);
            }
        }
    }
    return geminiReadyHistory;
}

async function generateResponseWithGemini(
    currentQuery: string,
    planServicesContext: string, // Stringified list of services for the selected plan
    chatHistory: ChatMessageForHistory[],
    planConfig: PlanConfig // Contains displayName
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const formattedHistory = formatChatHistoryForGemini(chatHistory);

        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: 500, // Increased for potentially longer service lists
                temperature: 0.25,
            } as GenerationConfig,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                // Add other safety settings as needed
            ]
        });

        // Updated system prompt to reflect using a list of services from JSON
        const promptForCurrentTurn = `You are Aptia's Open Enrollment Assistant.
You are currently discussing the "${planConfig.displayName}" plan.
You have access to the following list of services and their details for the "${planConfig.displayName}" plan:
--- BEGIN PLAN SERVICES INFORMATION for ${planConfig.displayName} ---
${planServicesContext || "No specific service information loaded for this plan."}
--- END PLAN SERVICES INFORMATION ---

Instructions:
1.  Answer the user's "Current Question" based *ONLY* on the "PLAN SERVICES INFORMATION" provided above for the "${planConfig.displayName}" plan.
2.  If the "PLAN SERVICES INFORMATION" doesn't list the specific service or detail the user is asking about, state that you don't have information on that specific item for the "${planConfig.displayName}" plan based on the provided list. DO NOT invent answers or use external knowledge.
3.  Refer to the "CHAT HISTORY" (already part of our conversation) to understand the flow and provide contextually relevant responses.
4.  If the user asks to compare this plan with another, explain you can only provide details for the "${planConfig.displayName}" plan based on the service list you have.
5.  Keep responses concise, helpful, and easy to understand. Do not mention that your knowledge comes from a JSON file or a list. You are an AI assistant.

CHAT HISTORY:
(Chat history is implicitly part of our conversation turns)

Current Question: ${currentQuery}
Answer:`;

        // console.log("Sending to Gemini - Prompt for current turn:", promptForCurrentTurn);
        const result = await chat.sendMessage(promptForCurrentTurn);
        const response = result.response;
        const text = response.text();

        return text.trim() || "I'm unable to generate a response using Gemini at this time.";

    } catch (error) {
        console.error('Error generating Gemini response:', error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
            return "There's an issue with accessing the AI service (API key). Please contact support.";
        }
        if (error instanceof Error && error.message.includes("must be 'user'")) {
            console.error("Gemini History Error Detail: The history likely didn't start with a user message after formatting, or was malformed.");
            return "I had a problem remembering our conversation's flow. Could you try rephrasing or starting this specific query again?";
        }
        return "An error occurred while I was thinking with Gemini. Please try asking again.";
    }
}

// Main query function - RAG parts are commented out
export async function queryRAGSystem(
    query: string,
    chatHistory: ChatMessageForHistory[] = [],
    planNameFromFrontend?: string // This is the 'selectedPlanName' from the frontend
): Promise<RAGResponse> {
    try {
        if (!query.trim()) {
            return { type: 'error', message: "Query cannot be empty." };
        }

        // Determine the plan to discuss. Use planNameFromFrontend if available, otherwise try to infer or use a default.
        // For this JSON structure, planNameFromFrontend is crucial.
        const targetPlanDisplayName = planNameFromFrontend || (planServicesData.length > 0 ? (planServicesData as PlanServiceEntry[])[0].Plan : "Unknown Plan");

        const currentPlanConfig = getPlanConfigFromServiceArray(targetPlanDisplayName);

        if (!currentPlanConfig) {
            const errorMsg = `Plan information for "${targetPlanDisplayName}" not found in the provided JSON data. Cannot proceed.`;
            console.error(errorMsg);
            return { type: 'error', message: "I couldn't find information for the specified plan. Please select or mention a valid plan." };
        }

        console.log(`Direct LLM (Gemini) - Querying for plan: "${currentPlanConfig.displayName}" using local JSON (array of services).`);

        // Filter all service entries for the selected plan from the JSON data
        const servicesForSelectedPlan = (planServicesData as PlanServiceEntry[]).filter(
            service => service.Plan.toLowerCase() === currentPlanConfig.displayName.toLowerCase()
        );

        let planContextForLLM = "No specific service details found for this plan in the provided data.";
        if (servicesForSelectedPlan.length > 0) {
            // Format the list of services into a string for the LLM
            planContextForLLM = servicesForSelectedPlan.map(service =>
                `- Service: ${service.Service}\n` +
                `  In-Network Cost: ${service.In_Network_Cost}\n` +
                `  Out-of-Network Coverage: ${service.Out_of_Network_Coverage}\n` +
                `  Prior Authorization Required: ${service.Prior_Authorization_Required}\n` +
                `  Other Notes: ${service.Other_Notes}`
            ).join("\n\n");
        }

        // Call Gemini directly with context from the filtered JSON services
        const llmResponse = await generateResponseWithGemini(
            query,
            planContextForLLM,
            chatHistory,
            currentPlanConfig // Pass the PlanConfig (mainly for displayName)
        );

        return {
            type: 'ai_response',
            message: llmResponse,
            metadata: {
                context: planContextForLLM.substring(0, 400) + (planContextForLLM.length > 400 ? "..." : ""), // Context is from JSON
                planName: currentPlanConfig.displayName,
                confidence: servicesForSelectedPlan.length > 0 ? 0.9 : 0.2
            }
        };

    } catch (error) {
        console.error('Critical System Error (JSON Array Context & Gemini Chat):', error);
        const errorMessage = error instanceof Error ? error.message : 'Unexpected critical error in the system.';
        return {
            type: 'error',
            message: "I'm sorry, I encountered a major problem trying to answer your question.",
            metadata: { confidence: 0 }
        };
    }
}

export const _test = {
    // generateEmbeddings, // Commented out
    // retrieveSingleBestContext, // Commented out
    generateResponseWithGemini,
    getPlanConfigFromServiceArray,
    formatChatHistoryForGemini
};
