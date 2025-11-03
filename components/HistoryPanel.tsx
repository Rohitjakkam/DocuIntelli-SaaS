import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  selectedId: number | null;
  onItemClick: (id: number) => void;
  onClear: () => void;
}

const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return "just now";
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, selectedId, onItemClick, onClear }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-semibold text-slate-200">Processing History</h3>
        {history.length > 0 && (
          <button 
            onClick={onClear} 
            className="flex items-center text-xs text-slate-400 hover:text-red-400 transition-colors"
            title="Clear all history"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </button>
        )}
      </div>
      <div className="flex-grow overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <History className="h-12 w-12 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No history yet</p>
            <p className="text-xs text-slate-500">Your processed documents will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick(item.id)}
                  className={`w-full text-left p-4 transition-colors duration-150 ${
                    item.id === selectedId ? 'bg-sky-500/20' : 'hover:bg-slate-700/50'
                  }`}
                >
                  <p 
                    className={`font-medium truncate ${
                      item.id === selectedId ? 'text-sky-300' : 'text-slate-200'
                    }`}
                    title={item.fileName}
                  >
                    {item.fileName}
                  </p>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span 
                      className={`px-2 py-0.5 rounded-full ${
                        item.id === selectedId ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {item.workflowTitle}
                    </span>
                    <span 
                      className="text-slate-500" 
                      title={new Date(item.timestamp).toLocaleString()}
                    >
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};