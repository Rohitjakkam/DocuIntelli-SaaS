import { GoogleGenAI, Type, Part, GenerateContentConfig, Content } from "@google/genai";
import { ChatMessage, Source } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

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
- If you use Google Search to find information, cite your sources.
- After every response, you MUST provide 3-4 relevant, insightful follow-up questions a user might have. These suggestions should help guide the conversation and explore the document more deeply.

- Format your response as follows: First, provide your detailed answer in Markdown. Then, add a separator line '---'. After the separator, list your suggested follow-up questions, one per line.
`;


export const continueChat = async (history: ChatMessage[], files: Part[]): Promise<{ response: string, suggestions: string[], sources: Source[] }> => {
    const config: GenerateContentConfig = {
        systemInstruction: systemInstruction,
        tools: [{googleSearch: {}}],
    };
    
    const modelContents: Content[] = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    const lastMessage = modelContents[modelContents.length - 1];
    if (files.length > 0 && lastMessage && lastMessage.role === 'user') {
        lastMessage.parts.unshift(...files);
    }

    const response = await ai.models.generateContent({
        model: model,
        contents: modelContents,
        config: config
    });
    
    const responseText = response.text;

    const sources: Source[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web && { uri: chunk.web.uri, title: chunk.web.title })
        .filter(Boolean) || [];
    
    let mainResponse = responseText;
    let suggestions: string[] = [];
    const parts = responseText.split('\n---\n');
    
    if (parts.length > 1) {
        mainResponse = parts[0];
        suggestions = parts.slice(1).join('\n').split('\n').filter(s => s.trim() !== '');
    } else {
         // Fallback if the model doesn't include suggestions
        suggestions = [];
    }
    
    return { response: mainResponse.trim(), suggestions, sources };
};

export const summarizeFilesForVoiceChat = async (files: Part[]): Promise<string> => {
      const model = 'gemini-2.5-flash';
      const prompt = "Concisely summarize the key information, topics, and entities from the following document(s) in 500 words or less. This summary will be used as context for a real-time voice conversation. Focus on providing a solid foundation for answering questions about the document content.";
    
      const modelContents: Content[] = [{
        role: 'user',
        parts: [...files, { text: prompt }]
      }];

      const response = await ai.models.generateContent({
        model: model,
        contents: modelContents,
      });

      return response.text;
    };
