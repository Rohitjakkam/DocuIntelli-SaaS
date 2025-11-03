import { GoogleGenAI, Type, Part, GenerateContentConfig, Content } from "@google/genai";
import { ChatMessage } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-pro';

export const fileToGenerativePart = async (file: File): Promise<{mimeType: string, data: string}> => {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  return {
    mimeType: file.type,
    data: base64Data,
  };
};

const systemInstruction = `You are an expert legal assistant named DocuIntelli. Your capabilities include:
1.  **Summarization**: Provide concise summaries of legal documents.
2.  **Metadata Extraction**: Extract key information like case names, judges, dates, etc.
3.  **Q&A**: Answer specific questions about the document content.
4.  **Drafting**: Draft legal notices or other documents based on the provided context.
5.  **Analysis**: Analyze contracts for missing clauses or other potential issues.

- When a user uploads a document and asks a question, perform the requested task.
- Be accurate, professional, and cite information from the document where possible.
- After every response, you MUST provide 3-4 relevant, insightful follow-up questions a user might have. These suggestions should help guide the conversation and explore the document more deeply.
- Always format your entire output as a single, valid JSON object with two keys: "response" (a string containing your full, formatted answer, using Markdown for readability) and "suggestions" (an array of strings).

Example response format:
{
  "response": "## Summary\\n\\nThe document is a ruling on a motion to dismiss...",
  "suggestions": [
    "What was the final verdict?",
    "Who were the judges in this case?",
    "Explain the primary legal argument."
  ]
}`;


export const continueChat = async (history: ChatMessage[], files: Part[]): Promise<{ response: string, suggestions: string[] }> => {
    const config: GenerateContentConfig = {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                response: { type: Type.STRING, description: "The model's detailed, user-facing answer, formatted in Markdown." },
                suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 3-4 suggested follow-up questions."
                },
            }
        }
    };
    
    // FIX: Refactored `continueChat` to correctly pass chat history to the `generateContent` API.
    // This avoids using the unsupported `history` parameter and `findLast` method. The full
    // conversation, including files in the first user message, is now constructed and
    // passed in the `contents` parameter as required by the Gemini API.
    const modelContents: Content[] = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    // Attach files to the last user message in the history if they exist.
    // This is sent only on the first turn from the UI.
    const lastMessage = modelContents[modelContents.length - 1];
    if (files.length > 0 && lastMessage && lastMessage.role === 'user') {
        // Prepend file parts to the existing parts array of the last message.
        lastMessage.parts.unshift(...files);
    }

    const response = await ai.models.generateContent({
        model: model,
        contents: modelContents,
        config: config
    });
    
    const responseText = response.text;
    
    try {
        const parsedResponse = JSON.parse(responseText);
        if (typeof parsedResponse.response === 'string' && Array.isArray(parsedResponse.suggestions)) {
            return parsedResponse;
        }
        throw new Error("Invalid JSON structure received from model.");
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText, e);
        // Fallback for when the model fails to return valid JSON
        return {
            response: "I apologize, but I encountered an issue generating a complete response. The raw output was: \n\n" + responseText,
            suggestions: ["Can you try that again?", "Please rephrase your request.", "Start a new chat."]
        }
    }
};