import React, { useState, useRef } from 'react';
import { recordInventoryMovement } from '../../../services/inventoryMovementsService';
import { supabase } from '../../../services/supabaseClient';
import { isLikelyLiquid } from '../../../types/inventory.types';
import { Upload, X, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react';

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

interface PreviewStats {
  totalRows: number;
  newCount: number;
  existingCount: number;
  skippedCount: number;
  liquidCount: number;
  skippedItems: string[];
}

type CSVFormat = 'acwer' | 'standard' | 'unknown';

// Category mapping for ACWER Item Group
const ACWER_CATEGORY_MAP: Record<string, string> = {
  'LUBRICAN': 'Oils & Fluids',
  'TYRE': 'Tyres',
  'WHEEL': 'Wheels & Rims',
  'ATTACH': 'Attachments',
  'S/PARTS': 'Auto', // Will be auto-categorized by name
};

// False positive keywords to exclude from liquid detection
const LIQUID_FALSE_POSITIVES = [
  'oil seal', 'oil filter', 'oil pump', 'oil pan',
  'fuel filter', 'fuel pump', 'fuel gauge',
  'grease cap'
];

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
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<CSVFormat>('unknown');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [results, setResults] = useState<{ succeeded: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setPreviewStats(null);
    setDetectedFormat('unknown');
    setProgress(0);
    setProgressText('');
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

  // RFC 4180 compliant CSV parser
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const detectFormat = (lines: string[]): CSVFormat => {
    if (lines.length < 4) return 'unknown';
    
    // Check for ACWER format: Row 4 should have "Item Code" header
    const possibleHeaderRow = parseCSVLine(lines[3]);
    if (possibleHeaderRow.some(h => h.toLowerCase().includes('item code'))) {
      return 'acwer';
    }
    
    // Check for standard format: Row 1 should have "Part Code"
    const firstRow = parseCSVLine(lines[0]);
    if (firstRow.some(h => h.toLowerCase().includes('part code'))) {
      return 'standard';
    }
    
    return 'unknown';
  };

  const isJunkRow = (partName: string): boolean => {
    const lower = partName.toLowerCase();
    return lower.startsWith('empty bin') || lower.startsWith('loose parts');
  };

  const isLiquidWithFiltering = (partName: string): boolean => {
    const lower = partName.toLowerCase();
    
    // Check for false positives first
    for (const fp of LIQUID_FALSE_POSITIVES) {
      if (lower.includes(fp)) {
        return false;
      }
    }
    
    // Then check if it's liquid
    return isLikelyLiquid(partName);
  };

  const autoCategorize = (partName: string): string => {
    const lower = partName.toLowerCase();
    
    if (lower.includes('brake') || lower.includes('clutch')) return 'Brakes & Clutch';
    if (lower.includes('battery') || lower.includes('alternator') || lower.includes('starter')) return 'Electrical';
    if (lower.includes('engine') || lower.includes('piston') || lower.includes('cylinder')) return 'Engine Parts';
    if (lower.includes('filter')) return 'Filters';
    if (lower.includes('bearing') || lower.includes('bushing')) return 'Bearings & Bushings';
    if (lower.includes('seal') || lower.includes('gasket')) return 'Seals & Gaskets';
    if (lower.includes('hose') || lower.includes('pipe')) return 'Hoses & Pipes';
    if (lower.includes('bolt') || lower.includes('nut') || lower.includes('screw')) return 'Fasteners';
    
    return 'General Parts';
  };

  const parseACWERCSV = (lines: string[]): ParsedPart[] => {
    const parts: ParsedPart[] = [];
    
    // Row 4 (index 3) is headers
    const headers = parseCSVLine(lines[3]);
    
    // Find column indices
    const binIdx = headers.findIndex(h => h.toLowerCase() === 'bin');
    const codeIdx = headers.findIndex(h => h.toLowerCase() === 'item code');
    const descIdx = headers.findIndex(h => h.toLowerCase() === 'description');
    const qtyIdx = headers.findIndex(h => h.toLowerCase().includes('total bal'));
    const costIdx = headers.findIndex(h => h.toLowerCase() === 'cost');
    const groupIdx = headers.findIndex(h => h.toLowerCase().includes('item group'));
    
    // Parse data rows (starting from row 5, index 4)
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      
      const partCode = values[codeIdx] || '';
      const partName = values[descIdx] || '';
      const itemGroup = values[groupIdx] || '';
      
      // Skip junk rows
      if (!partCode || !partName || isJunkRow(partName)) {
        continue;
      }
      
      // Parse quantity (default 0 if empty)
      const qtyStr = values[qtyIdx] || '0';
      const stockQuantity = qtyStr ? parseInt(qtyStr.replace(/,/g, '')) || 0 : 0;
      
      // Parse cost (default null if empty)
      const costStr = values[costIdx] || '';
      const costPrice = costStr ? parseFloat(costStr.replace(/,/g, '')) || undefined : undefined;
      
      // Map category
      let category = ACWER_CATEGORY_MAP[itemGroup.toUpperCase()];
      if (category === 'Auto') {
        category = autoCategorize(partName);
      }
      
      parts.push({
        part_code: partCode,
        part_name: partName,
        category: category || 'General Parts',
        cost_price: costPrice,
        stock_quantity: stockQuantity,
        location: values[binIdx] || '',
      });
    }
    
    return parts;
  };

  const parseStandardCSV = (lines: string[]): ParsedPart[] => {
    const parts: ParsedPart[] = [];
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const part: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        switch (header) {
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
          case 'stock quantity':
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
      
      if (part.part_code && part.part_name && !isJunkRow(part.part_name)) {
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
          setDetectedFormat('standard');
        } else if (selectedFile.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          const format = detectFormat(lines);
          setDetectedFormat(format);
          
          if (format === 'acwer') {
            parsedParts = parseACWERCSV(lines);
          } else if (format === 'standard') {
            parsedParts = parseStandardCSV(lines);
          } else {
            alert('Unable to detect CSV format. Please check the file structure.');
            return;
          }
        }
        
        // Generate preview stats
        const skippedItems: string[] = [];
        let newCount = 0;
        let existingCount = 0;
        let liquidCount = 0;
        
        parsedParts.forEach(part => {
          if (existingPartCodes.includes(part.part_code)) {
            existingCount++;
          } else {
            newCount++;
          }
          
          if (isLiquidWithFiltering(part.part_name)) {
            liquidCount++;
          }
        });
        
        setPreviewStats({
          totalRows: parsedParts.length,
          newCount,
          existingCount,
          skippedCount: skippedItems.length,
          liquidCount,
          skippedItems,
        });
        
        setPreviewData(parsedParts.slice(0, 10));
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
    setProgressText('Starting import...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      let allParts: ParsedPart[] = [];
      
      try {
        if (file.name.endsWith('.json')) {
          allParts = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          
          if (detectedFormat === 'acwer') {
            allParts = parseACWERCSV(lines);
          } else if (detectedFormat === 'standard') {
            allParts = parseStandardCSV(lines);
          }
        }
        
        const BATCH_SIZE = 100;
        let succeeded = 0;
        let failed = 0;
        
        // Process in batches
        for (let i = 0; i < allParts.length; i += BATCH_SIZE) {
          const batch = allParts.slice(i, i + BATCH_SIZE);
          
          setProgressText(`Importing ${i + batch.length} / ${allParts.length}...`);
          
          const batchResults = await Promise.allSettled(
            batch.map(async (part) => {
              const isExisting = existingPartCodes.includes(part.part_code);
              const isLiquid = isLiquidWithFiltering(part.part_name);
              
              const partData = {
                part_code: part.part_code,
                part_name: part.part_name,
                category: part.category || '',
                cost_price: part.cost_price || 0,
                sell_price: part.sell_price || part.cost_price || 0,
                stock_quantity: part.stock_quantity || 0,
                min_stock: part.min_stock || 0,
                warranty_months: part.warranty_months || 0,
                supplier: part.supplier || '',
                location: part.location || '',
                unit: part.unit || 'pcs',
                is_liquid: isLiquid,
                last_updated_by: currentUser.user_id,
                last_updated_by_name: currentUser.name,
                updated_at: new Date().toISOString(),
              };
              
              let partId: string;
              let stockChanged = false;

              if (isExisting) {
                // Check existing stock
                const { data: existingPart } = await supabase
                  .from('parts')
                  .select('part_id, stock_quantity')
                  .eq('part_code', part.part_code)
                  .single();

                if (existingPart) {
                  partId = existingPart.part_id;
                  const oldStock = existingPart.stock_quantity || 0;
                  stockChanged = oldStock !== (part.stock_quantity || 0);
                  
                  // Update existing part
                  const { error } = await supabase
                    .from('parts')
                    .update(partData)
                    .eq('part_code', part.part_code);
                  
                  if (error) throw error;
                }
              } else {
                // Insert new part
                const { data, error } = await supabase
                  .from('parts')
                  .insert(partData)
                  .select('part_id')
                  .single();
                
                if (error) throw error;
                partId = data.part_id;
              }
              
              // Create audit trail
              const movementType = isExisting
                ? (stockChanged ? 'adjustment' : 'purchase')
                : 'purchase';
              
              await recordInventoryMovement({
                part_id: partId!,
                movement_type: movementType,
                container_qty_change: part.stock_quantity || 0,
                bulk_qty_change: 0,
                store_container_qty_after: part.stock_quantity || 0,
                performed_by: currentUser.user_id,
                performed_by_name: currentUser.name,
                notes: 'CSV import from ACWER',
                created_at: new Date().toISOString(),
                performed_at: new Date().toISOString(),
              });
              
              return { success: true };
            })
          );
          
          batchResults.forEach(r => {
            if (r.status === 'fulfilled') {
              succeeded++;
            } else {
              failed++;
            }
          });
          
          setProgress(((i + batch.length) / allParts.length) * 100);
        }
        
        setResults({ succeeded, failed });
        setIsImporting(false);
        setProgressText('');
        
        if (succeeded > 0) {
          onImportComplete();
        }
      } catch (error) {
        console.error('Error during import:', error);
        setIsImporting(false);
        setProgressText('');
        alert('Error during import. Please try again.');
      }
    };
    
    reader.readAsText(file);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
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
              
              {/* Format Detection Badge */}
              {detectedFormat !== 'unknown' && (
                <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                  detectedFormat === 'acwer'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {detectedFormat === 'acwer' ? 'ACWER Format' : 'Standard Format'}
                </span>
              )}
              
              {!isImporting && (
                <button
                  onClick={resetState}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Preview Stats */}
            {previewStats && !isImporting && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-blue-600 font-medium">Total Rows</div>
                  <div className="text-lg font-bold text-blue-700">{previewStats.totalRows}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xs text-green-600 font-medium">New Items</div>
                  <div className="text-lg font-bold text-green-700">{previewStats.newCount}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-xs text-yellow-600 font-medium">Existing</div>
                  <div className="text-lg font-bold text-yellow-700">{previewStats.existingCount}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xs text-purple-600 font-medium">Liquid Items</div>
                  <div className="text-lg font-bold text-purple-700">{previewStats.liquidCount}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 font-medium">Skipped</div>
                  <div className="text-lg font-bold text-gray-700">{previewStats.skippedCount}</div>
                </div>
              </div>
            )}

            {/* Preview Table */}
            {previewData.length > 0 && !isImporting && (
              <div className="overflow-x-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-medium text-gray-700">
                    Preview (first 10 rows):
                  </p>
                </div>
                <table className="w-full text-xs border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left border-b">Code</th>
                      <th className="px-2 py-2 text-left border-b">Name</th>
                      <th className="px-2 py-2 text-left border-b">Category</th>
                      <th className="px-2 py-2 text-right border-b">Stock</th>
                      <th className="px-2 py-2 text-right border-b">Cost</th>
                      <th className="px-2 py-2 text-left border-b">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((part, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-2 py-2 border-b font-mono text-xs">{part.part_code}</td>
                        <td className="px-2 py-2 border-b">{part.part_name}</td>
                        <td className="px-2 py-2 border-b">
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {part.category || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2 border-b text-right font-medium">
                          {part.stock_quantity || 0}
                        </td>
                        <td className="px-2 py-2 border-b text-right">
                          {part.cost_price ? `RM ${part.cost_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-2 py-2 border-b text-gray-600">
                          {part.location || '-'}
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
                  <span className="text-gray-600">{progressText}</span>
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
                  Import {previewStats?.totalRows || 0} Parts
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
              
              {detectedFormat !== 'unknown' && (
                <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                  detectedFormat === 'acwer'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {detectedFormat === 'acwer' ? 'ACWER Format' : 'Standard Format'}
                </span>
              )}
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
