import { useState } from 'react';
import { useGraphStore } from '@/store/graphStore';

/**
 * Name search: matching nodes glow in the graph as you type;
 * Enter reveals + focuses the first match (expanding its ancestors).
 */
export function SearchBar() {
  const setSearch = useGraphStore((state) => state.setSearch);
  const focusNode = useGraphStore((state) => state.focusNode);
  const matchedIds = useGraphStore((state) => state.matchedIds);
  const [value, setValue] = useState('');

  const handleChange = (next: string) => {
    setValue(next);
    setSearch(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const first = matchedIds.values().next().value;
      if (first) focusNode(first);
    }
    if (e.key === 'Escape') {
      handleChange('');
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 shadow-glass">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-ink-1">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search files…"
        spellCheck={false}
        className="w-40 bg-transparent text-xs text-ink-0 placeholder-ink-2 outline-none"
      />
      {value && (
        <span className="text-[10px] font-medium text-accent">{matchedIds.size}</span>
      )}
    </div>
  );
}
