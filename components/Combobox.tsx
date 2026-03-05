import { Check,ChevronDown,Plus,Search } from 'lucide-react';
import React,{ useCallback,useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';

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
  /** Compact mode for filter bars — smaller, frosted glass style */
  compact?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({ 
  label, options, value, onChange, placeholder = "Select...", onAddNew, addNewLabel = "Add New", compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, bottom: 0, left: 0, width: 0 });
  const [opensUpward, setOpensUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Find selected item label for display
  const selectedItem = options.find(o => o.id === value);

  useEffect(() => {
    // If we have a value, ensure the query matches (optional, mostly for initial load)
    // But usually we only want to set query on open or just show selected label
  }, [value, options]);

  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) return;
    const rect = inputWrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpward = spaceBelow < 250;
    setOpensUpward(shouldOpenUpward);
    setDropdownPosition({
      top: rect.bottom,
      bottom: window.innerHeight - rect.top,
      left: rect.left,
      width: rect.width
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideContainer && !clickedInsideDropdown) {
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

  const inputClassName = compact
    ? "w-full px-2.5 py-1.5 text-xs rounded-xl border border-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400/50 placeholder-slate-400"
    : "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  const inputStyle = compact ? {
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'var(--text)',
  } : undefined;

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}
      
      <div className="relative" ref={inputWrapperRef}>
        <input 
          type="text"
          className={`${inputClassName} ${compact ? 'pr-7' : 'pr-10'} cursor-pointer`}
          style={inputStyle}
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
        <div className={`absolute ${compact ? 'right-2' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}>
           {isOpen ? <Search className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> : <ChevronDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />}
        </div>
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed ${compact ? 'rounded-xl border border-white/30' : 'rounded-lg border border-slate-200'} shadow-xl max-h-60 overflow-y-auto z-[9999]${opensUpward ? ' mb-1' : ' mt-1'}`}
          style={opensUpward ? {
            bottom: `${dropdownPosition.bottom}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            ...(compact ? { background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : { background: 'var(--surface)' }),
          } : {
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            ...(compact ? { background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : { background: 'var(--surface)' }),
          }}
        >
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
                  className={compact
                    ? "px-3 py-2 hover:bg-blue-500/10 cursor-pointer flex justify-between items-center group border-b border-white/20 last:border-0 text-xs"
                    : "px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 hover:text-blue-700 flex justify-between items-center group border-b border-slate-50 last:border-0"
                  }
                  style={{ color: 'var(--text)' }}
                >
                  <div>
                    <div className={compact ? 'font-medium text-xs' : 'font-medium'}>{opt.label}</div>
                    {opt.subLabel && <div className={`text-xs ${compact ? 'text-slate-400' : 'text-slate-400 group-hover:text-blue-400'}`}>{opt.subLabel}</div>}
                  </div>
                  {value === opt.id && <Check className={compact ? 'w-3 h-3 text-blue-500' : 'w-4 h-4 text-blue-600'} />}
                </li>
              ))}
            </ul>
          ) : (
            <div className={`${compact ? 'p-3 text-xs' : 'p-4 text-sm'} text-center text-slate-500`}>
              No results for &ldquo;{query}&rdquo;
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
        </div>,
        document.body
      )}
    </div>
  );
};
