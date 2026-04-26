import { Search } from 'lucide-react';

interface StoreQueueSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function StoreQueueSearch({ value, onChange }: StoreQueueSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        type="text"
        placeholder="Search by tech, job, customer, part..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-premium pl-10 text-sm w-full"
      />
    </div>
  );
}
