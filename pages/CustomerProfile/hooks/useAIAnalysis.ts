import { useState, useCallback } from 'react';
import { Customer, ForkliftServiceEntry } from '../../../types';
import { generateCustomerAnalysis } from '../../../services/geminiService';
import { showToast } from '../../../services/toastService';

interface UseAIAnalysisResult {
  aiAnalysis: string;
  generatingAI: boolean;
  handleGenerateAnalysis: () => Promise<void>;
  clearAnalysis: () => void;
}

/**
 * Hook for managing AI-powered customer analysis
 */
export function useAIAnalysis(
  customer: Customer | null,
  jobs: ForkliftServiceEntry[]
): UseAIAnalysisResult {
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [generatingAI, setGeneratingAI] = useState(false);

  const handleGenerateAnalysis = useCallback(async () => {
    if (!customer || jobs.length === 0) return;
    
    setGeneratingAI(true);
    try {
      const analysis = await generateCustomerAnalysis(customer, jobs);
      setAiAnalysis(analysis);
    } catch (error) {
      setAiAnalysis('Unable to generate analysis at this time.');
      showToast.error('AI analysis failed');
    } finally {
      setGeneratingAI(false);
    }
  }, [customer, jobs]);

  const clearAnalysis = useCallback(() => {
    setAiAnalysis('');
  }, []);

  return {
    aiAnalysis,
    generatingAI,
    handleGenerateAnalysis,
    clearAnalysis,
  };
}
