import React, { useCallback } from 'react';
import { FileUp, X, File as FileIcon, Trash2 } from 'lucide-react';

interface FileUploadProps {
  files: File[];
  onFileChange: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ files, onFileChange }) => {
  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onFileChange(Array.from(event.dataTransfer.files));
      event.dataTransfer.clearData();
    }
  }, [onFileChange]);

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFileChange(Array.from(event.target.files));
    }
  };

  const handleRemoveFile = (event: React.MouseEvent<HTMLButtonElement>, indexToRemove: number) => {
    event.preventDefault();
    onFileChange(files.filter((_, index) => index !== indexToRemove));
  };

  const handleClearAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onFileChange([]);
  };

  return (
    <div>
      <label
        htmlFor="file-upload"
        className={`relative block w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 ease-in-out ${
          files.length > 0 ? 'border-sky-500 bg-sky-500/10' : 'border-slate-600 hover:border-sky-500 hover:bg-slate-800'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileSelect} multiple />
        {files.length > 0 ? (
          <div className="flex flex-col items-center">
             <h3 className="text-md font-semibold text-slate-200 mb-3">{files.length} file{files.length > 1 ? 's' : ''} selected</h3>
             <ul className="w-full max-h-48 overflow-y-auto space-y-2 mb-4 text-left p-1">
                {files.map((file, index) => (
                    <li key={file.name + index} className="flex items-center justify-between bg-slate-800/60 p-2 rounded-md">
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <FileIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                            <div className="truncate">
                                <p className="text-sm font-medium text-slate-200 truncate" title={file.name}>{file.name}</p>
                                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>
                        <button
                            onClick={(e) => handleRemoveFile(e, index)}
                            className="p-1 rounded-full text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                            title="Remove file"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </li>
                ))}
             </ul>
             <button
                onClick={handleClearAll}
                className="inline-flex items-center px-4 py-2 border border-slate-600 text-xs font-medium rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
             >
                <Trash2 className="-ml-0.5 mr-1.5 h-4 w-4" />
                Clear All
             </button>
             <p className="text-xs text-slate-500 mt-2">Click or drop files to replace selection</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <FileUp className="mx-auto h-12 w-12 text-slate-400" />
            <span className="mt-2 block text-sm font-medium text-slate-300">
              <span className="text-sky-400">Upload files</span> or drag and drop
            </span>
            <p className="text-xs text-slate-500">Any text-based documents or PDFs</p>
          </div>
        )}
      </label>
    </div>
  );
};