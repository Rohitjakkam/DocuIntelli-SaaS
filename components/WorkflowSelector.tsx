import React from 'react';
import { Workflow, WorkflowOption } from '../types';

interface WorkflowSelectorProps {
  options: WorkflowOption[];
  selected: Workflow | null;
  onSelect: (workflow: Workflow) => void;
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({ options, selected, onSelect }) => {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300 mb-2">Select a Workflow</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                isSelected 
                  ? 'bg-sky-500/20 border-sky-500 ring-2 ring-sky-500' 
                  : 'bg-slate-800 border-slate-700 hover:border-sky-600 hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`mt-1 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-700 text-sky-400'}`}>
                   <option.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className={`font-semibold ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>{option.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};