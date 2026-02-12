import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className }) => {
  const [isCopied, setIsCopied] = useState(false);
  const textContent = String(children).replace(/\n$/, '');

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden bg-[#1e1e1e] border border-white/10">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-[#B4B4B4] hover:text-white transition-colors"
          title="Copy code"
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <code className={`font-mono text-sm ${className || ''}`}>
          {children}
        </code>
      </div>
    </div>
  );
};

export default CodeBlock;