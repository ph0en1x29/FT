import { GoogleGenAI } from "@google/genai";
import { Job } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateJobSummary = async (job: Job): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key missing. Cannot generate AI summary.";
  }

  try {
    const prompt = `
      You are a field service assistant. Summarize the following job for a customer invoice and handover report.
      Use a professional, polite tone.
      
      Job Details:
      Title: ${job.title}
      Description: ${job.description}
      Notes Log: ${job.notes.join('; ')}
      Parts Used: ${job.parts_used.map(p => `${p.quantity}x ${p.part_name}`).join(', ')}
      Status: ${job.status}
      
      Output a concise 3-4 sentence summary of work performed.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating summary. Please check connection.";
  }
};