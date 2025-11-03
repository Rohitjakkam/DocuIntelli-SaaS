import { GoogleGenAI, Type, Chat, Part, GenerateContentConfig } from "@google/genai";
import { Workflow } from '../types';
import { PDFDocument } from 'pdf-lib';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const startChat = async (): Promise<Chat> => {
    // Note: The actual document context will be sent with the first message.
    // This function just initializes the chat object.
    const chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: {
            systemInstruction: "You are an expert legal assistant. Your role is to answer questions about the provided document accurately and concisely. When asked, cite specific information from the document to support your answer. Do not provide information that is not in the document. Be helpful and professional.",
        },
    });
    return chat;
};


export const runWorkflow = async (files: File[], workflow: Workflow): Promise<string | object> => {
    if (files.length === 0) {
        throw new Error("No files provided for the workflow.");
    }

    const fileParts: Part[] = await Promise.all(
        files.map(async (file) => ({
            inlineData: await fileToGenerativePart(file)
        }))
    );
    
    let promptText = '';
    let config: GenerateContentConfig = {};
    
    switch (workflow) {
        case Workflow.EXTRACT_METADATA:
            promptText = "You are a legal document analysis expert. From the provided document(s), extract the following metadata in JSON format: case name, court, judges, parties involved, key dates (filing, hearing, decision), and citations. If a piece of information is not present in the document, use 'N/A'.";
            config = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        caseName: { type: Type.STRING, description: "The name of the case." },
                        court: { type: Type.STRING, description: "The court where the case was heard." },
                        judges: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Names of the judges involved." },
                        parties: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The parties involved in the case." },
                        keyDates: {
                            type: Type.OBJECT,
                            description: "Key dates in the case.",
                            properties: {
                                filing: { type: Type.STRING, description: "Date of filing." },
                                hearing: { type: Type.STRING, description: "Date of hearing." },
                                decision: { type: Type.STRING, description: "Date of decision." },
                            }
                        },
                        citations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Legal citations mentioned in the document." }
                    }
                }
            };
            break;
        
        case Workflow.SUMMARIZE_QA:
            promptText = "You are an expert legal assistant. For the provided document(s), generate a concise summary of the key points, legal arguments, and final ruling. After the summary, generate 5-10 potential questions and answers (Q&A) that a legal professional might have about this document. Format the output with clear '## Summary' and '## Q&A' sections using Markdown.";
            break;

        case Workflow.DRAFT_NOTICE:
            promptText = "You are a paralegal expert. Based on the provided document(s), draft a formal legal notice. Pay attention to the context, parties involved, and the core legal issue. The draft should include standard legal formatting, such as recipient details, sender details, subject line, body, and a section for signature. Use placeholders like '[Your Name]' or '[Opposing Counsel]' where specific details need to be filled in. Use Markdown for formatting.";
            break;
        
        case Workflow.DETECT_MISSING_CLAUSES:
            promptText = "You are an expert in contract law. Analyze the provided contract document(s) and identify any standard or critical clauses that are missing. For example, look for force majeure, confidentiality, dispute resolution, governing law, and termination clauses. Provide a list of the missing clauses and a brief explanation of why each one is important for this type of contract. Use Markdown for formatting.";
            break;

        default:
             if (workflow === Workflow.RAG_QUERY) {
                return "This workflow is handled by the chat interface.";
            }
            throw new Error("Unsupported workflow selected.");
    }
    
    const contents: Part[] = [
        { text: promptText },
        ...fileParts
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: contents },
        config: config
    });
    
    const responseText = response.text;
    
    if (config.responseMimeType === "application/json") {
        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse JSON response:", responseText);
            throw new Error("The model returned an invalid JSON format. Please try again.");
        }
    }
    
    return responseText;
};