import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-[#3e3e42]">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Waiting...' : 'Ask about this PR... (Enter to send, Shift+Enter for new line)'}
          disabled={disabled}
          rows={3}
          className="flex-1 bg-[#1e1e1e] text-[#ccc] border border-[#3e3e42] rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 placeholder-[#858585] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#3e3e42] disabled:text-[#858585] text-white rounded text-sm font-medium transition-colors"
          title="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      <div className="mt-2 text-xs text-[#858585]">
        💡 Tip: Use <kbd className="px-1 py-0.5 bg-[#3e3e42] rounded">Cmd+K</kbd> to toggle chat
      </div>
    </div>
  );
}
