import { GoogleGenAI } from "@google/genai";
import { Job, Customer } from "../types";

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

export const generateCustomerAnalysis = async (customer: Customer, jobs: Job[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key missing. Cannot generate AI analysis.";
  }

  if (jobs.length === 0) {
    return "No service history available for analysis.";
  }

  try {
    const jobsSummary = jobs.map(j => 
      `- ${j.title} (${j.status}): ${j.description}. Parts: ${j.parts_used.map(p => p.part_name).join(', ') || 'None'}`
    ).join('\n');

    const prompt = `
      You are a field service analytics expert. Analyze the service history for this customer and provide insights.
      
      Customer: ${customer.name}
      Location: ${customer.address}
      Total Service Calls: ${jobs.length}
      
      Service History:
      ${jobsSummary}
      
      Provide a professional analysis covering:
      1. Common issues and patterns (2-3 sentences)
      2. Service trends and frequency (1-2 sentences)
      3. Preventive maintenance recommendations (2-3 sentences)
      4. Equipment health assessment based on service history (1-2 sentences)
      
      Keep it concise, actionable, and customer-focused. Total output: 6-10 sentences maximum.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating analysis. Please check connection.";
  }
};