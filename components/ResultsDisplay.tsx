import React from 'react';
import { ClipboardCopy, FileDown, History } from 'lucide-react';

interface ResultsDisplayProps {
  isLoading: boolean;
  error: string | null;
  result: string | object | null;
  fileName?: string;
  workflow?: string;
  hasHistory?: boolean;
}

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Placeholder: React.FC<{ hasHistory?: boolean }> = ({ hasHistory }) => (
    <div className="text-center p-4">
        {hasHistory ? (
            <>
                <History className="mx-auto h-12 w-12 text-slate-600" />
                <h3 className="mt-2 text-sm font-medium text-slate-300">View Past Results</h3>
                <p className="mt-1 text-sm text-slate-500">Select an item from your history to display its results here.</p>
            </>
        ) : (
            <>
                <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-slate-300">No results yet</h3>
                <p className="mt-1 text-sm text-slate-500">Upload a document and select a workflow to begin.</p>
            </>
        )}
    </div>
);

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ isLoading, error, result, fileName, workflow, hasHistory }) => {
  const [copied, setCopied] = React.useState(false);

  const formattedResult = React.useMemo(() => {
    if (!result) return '';
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  }, [result]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedResult).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExport = () => {
    if (!result || !fileName) return;

    const isJson = typeof result === 'object';
    const fileExtension = isJson ? 'json' : 'txt';
    const mimeType = isJson ? 'application/json' : 'text/plain';
    
    const content = isJson ? JSON.stringify(result, null, 2) : String(result);

    const baseFileName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const workflowSlug = workflow ? workflow.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'result';
    const downloadFileName = `${baseFileName}-${workflowSlug}.${fileExtension}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoadingSpinner />
          <p className="mt-4 text-slate-400">Analyzing document...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg">
            <h4 className="font-bold">Error</h4>
            <p>{error}</p>
          </div>
        </div>
      );
    }
    if (result) {
      return (
        <div className="relative h-full">
          <div className="absolute top-2 right-2 z-10 flex space-x-2">
             <button onClick={handleCopy} className="p-2 rounded-md bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors">
               <ClipboardCopy size={16} />
               <span className="sr-only">{copied ? 'Copied!' : 'Copy to clipboard'}</span>
             </button>
             <button onClick={handleExport} className="p-2 rounded-md bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors">
                <FileDown size={16} />
                <span className="sr-only">Export results</span>
             </button>
          </div>
          <pre className="p-6 pt-14 text-sm text-slate-300 whitespace-pre-wrap break-words h-full overflow-y-auto">
            <code>{formattedResult}</code>
          </pre>
        </div>
      );
    }
    return (
        <div className="flex items-center justify-center h-full"><Placeholder hasHistory={hasHistory}/></div>
    );
  };
  
  return <div className="h-full">{renderContent()}</div>;
};