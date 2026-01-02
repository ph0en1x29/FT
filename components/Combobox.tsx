import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';

export interface ComboboxOption {
  id: string;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  label?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onAddNew?: (query: string) => void;
  addNewLabel?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({ 
  label, options, value, onChange, placeholder = "Select...", onAddNew, addNewLabel = "Add New"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Find selected item label for display
  const selectedItem = options.find(o => o.id === value);

  useEffect(() => {
    // If we have a value, ensure the query matches (optional, mostly for initial load)
    // But usually we only want to set query on open or just show selected label
  }, [value, options]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(query.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(query.toLowerCase()))
  );

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}
      
      <div className="relative">
        <input 
          type="text"
          className={`${inputClassName} pr-10 cursor-pointer`}
          placeholder={selectedItem ? selectedItem.label : placeholder}
          value={isOpen ? query : (selectedItem?.label || '')}
          onChange={(e) => {
             setQuery(e.target.value);
             if (!isOpen) setIsOpen(true);
             if (e.target.value === '') onChange(''); // Clear value if cleared
          }}
          onClick={() => {
            setIsOpen(true);
            setQuery(''); // Reset query on click to show all
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
           {isOpen ? <Search className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            <ul>
              {filteredOptions.map(opt => (
                <li 
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 hover:text-blue-700 flex justify-between items-center group border-b border-slate-50 last:border-0"
                >
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    {opt.subLabel && <div className="text-xs text-slate-400 group-hover:text-blue-400">{opt.subLabel}</div>}
                  </div>
                  {value === opt.id && <Check className="w-4 h-4 text-blue-600" />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              No results for "{query}"
            </div>
          )}

          {onAddNew && query && (
             <div 
               onClick={() => {
                 onAddNew(query);
                 setIsOpen(false);
               }}
               className="border-t border-slate-100 p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-2 text-blue-600 font-medium transition-colors"
             >
               <Plus className="w-4 h-4" />
               {addNewLabel} "{query}"
             </div>
          )}
        </div>
      )}
    </div>
  );
};