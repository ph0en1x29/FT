import React, { useState, useRef } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { isLikelyLiquid } from '../../../types/inventory.types';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportPartsModalProps {
  show: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  currentUser: { user_id: string; name: string };
  existingPartCodes: string[];
}

interface ParsedPart {
  part_code: string;
  part_name: string;
  category?: string;
  cost_price?: number;
  sell_price?: number;
  stock_quantity?: number;
  min_stock?: number;
  warranty_months?: number;
  supplier?: string;
  location?: string;
  unit?: string;
}

export default function ImportPartsModal({
  show,
  onClose,
  onImportComplete,
  currentUser,
  existingPartCodes,
}: ImportPartsModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ParsedPart[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ succeeded: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setProgress(0);
    setResults(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const parseCSV = (text: string): ParsedPart[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const parts: ParsedPart[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const part: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index];
        // Map CSV headers to snake_case
        switch (header.toLowerCase()) {
          case 'part code':
            part.part_code = value;
            break;
          case 'part name':
            part.part_name = value;
            break;
          case 'category':
            part.category = value;
            break;
          case 'cost price':
            part.cost_price = value ? parseFloat(value) : undefined;
            break;
          case 'sell price':
            part.sell_price = value ? parseFloat(value) : undefined;
            break;
          case 'stock qty':
            part.stock_quantity = value ? parseInt(value) : undefined;
            break;
          case 'min stock':
            part.min_stock = value ? parseInt(value) : undefined;
            break;
          case 'warranty':
            part.warranty_months = value ? parseInt(value) : undefined;
            break;
          case 'supplier':
            part.supplier = value;
            break;
          case 'location':
            part.location = value;
            break;
          case 'unit':
            part.unit = value;
            break;
        }
      });
      
      if (part.part_code && part.part_name) {
        parts.push(part);
      }
    }
    
    return parts;
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setResults(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      let parsedParts: ParsedPart[] = [];
      
      try {
        if (selectedFile.name.endsWith('.json')) {
          parsedParts = JSON.parse(text);
        } else if (selectedFile.name.endsWith('.csv')) {
          parsedParts = parseCSV(text);
        }
        
        setPreviewData(parsedParts.slice(0, 5));
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing file. Please check the format.');
      }
    };
    
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setIsImporting(true);
    setProgress(0);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      let allParts: ParsedPart[] = [];
      
      try {
        if (file.name.endsWith('.json')) {
          allParts = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          allParts = parseCSV(text);
        }
        
        const results = await Promise.allSettled(
          allParts.map(async (part, index) => {
            const isExisting = existingPartCodes.includes(part.part_code);
            const isLiquid = isLikelyLiquid(part.part_name);
            
            const partData = {
              part_code: part.part_code,
              part_name: part.part_name,
              category: part.category || '',
              cost_price: part.cost_price || 0,
              sell_price: part.sell_price || 0,
              stock_quantity: part.stock_quantity || 0,
              min_stock: part.min_stock || 0,
              warranty_months: part.warranty_months || 0,
              supplier: part.supplier || '',
              location: part.location || '',
              unit: part.unit || '',
              is_liquid: isLiquid,
              last_updated_by: currentUser.user_id,
              last_updated_by_name: currentUser.name,
              updated_at: new Date().toISOString(),
            };
            
            let partId: string;
            
            if (isExisting) {
              // Update existing part
              const { data, error } = await supabase
                .from('inventory_parts')
                .update(partData)
                .eq('part_code', part.part_code)
                .select('part_id')
                .single();
              
              if (error) throw error;
              partId = data.part_id;
            } else {
              // Insert new part
              const { data, error } = await supabase
                .from('inventory_parts')
                .insert(partData)
                .select('part_id')
                .single();
              
              if (error) throw error;
              partId = data.part_id;
            }
            
            // Log to inventory_movements
            await supabase.from('inventory_movements').insert({
              part_id: partId,
              movement_type: 'initial_stock',
              container_qty_change: part.stock_quantity || 0,
              performed_by: currentUser.user_id,
              performed_by_name: currentUser.name,
              notes: 'Bulk import',
            });
            
            setProgress(((index + 1) / allParts.length) * 100);
            return { success: true };
          })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        setResults({ succeeded, failed });
        setIsImporting(false);
        
        if (succeeded > 0) {
          onImportComplete();
        }
      } catch (error) {
        console.error('Error during import:', error);
        setIsImporting(false);
        alert('Error during import. Please try again.');
      }
    };
    
    reader.readAsText(file);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Parts
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag & Drop Area */}
        {!file && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">
              Drag and drop your file here, or
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Accepts .csv and .json files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* File Selected */}
        {file && !results && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{file.name}</span>
              {!isImporting && (
                <button
                  onClick={resetState}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Preview Table */}
            {previewData.length > 0 && !isImporting && (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Preview (first 5 rows):
                </p>
                <table className="w-full text-xs border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left border-b">Code</th>
                      <th className="px-2 py-1 text-left border-b">Name</th>
                      <th className="px-2 py-1 text-left border-b">Category</th>
                      <th className="px-2 py-1 text-right border-b">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((part, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-2 py-1 border-b">{part.part_code}</td>
                        <td className="px-2 py-1 border-b">{part.part_name}</td>
                        <td className="px-2 py-1 border-b">{part.category || '-'}</td>
                        <td className="px-2 py-1 border-b text-right">
                          {part.stock_quantity || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Progress Bar */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Importing...</span>
                  <span className="text-gray-800 font-medium">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Import Button */}
            {!isImporting && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Import Parts
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{file?.name}</span>
            </div>

            <div className="space-y-3">
              {results.succeeded > 0 && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">
                      {results.succeeded} parts imported successfully
                    </p>
                  </div>
                </div>
              )}

              {results.failed > 0 && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">
                      {results.failed} parts failed to import
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Check console for error details
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={resetState}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Import Another File
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
