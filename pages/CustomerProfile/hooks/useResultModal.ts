import { useCallback,useState } from 'react';
import { ResultModalState } from '../types';

interface UseResultModalResult {
  resultModal: ResultModalState;
  setResultModal: (modal: ResultModalState) => void;
  closeResultModal: () => void;
}

/**
 * Hook for managing result modal state
 */
export function useResultModal(): UseResultModalResult {
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const closeResultModal = useCallback(() => {
    setResultModal(prev => ({ ...prev, show: false }));
  }, []);

  return {
    resultModal,
    setResultModal,
    closeResultModal,
  };
}
