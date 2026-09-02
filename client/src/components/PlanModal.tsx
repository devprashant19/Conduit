import React, { useState } from 'react';
import type { Plan, Project } from '../../../src/types';

interface PlanModalProps {
  project?: Project;
  plan: Plan;
  onClose: () => void;
  onResolve: (decision: 'approve' | 'reject', reason?: string) => void;
}

export default function PlanModal({ project, plan, onClose, onResolve }: PlanModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono text-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-purple-500/30 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-800 flex items-center justify-between bg-purple-900/20">
          <div className="flex items-center gap-2 text-purple-400">
            <span className="font-bold">⚠️ SUPERVISOR PLAN AWAITING APPROVAL</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <div className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Project</div>
            <div className="text-gray-200">{project?.name || plan.projectId}</div>
          </div>

          <div>
            <div className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Target Agent</div>
            <div className="text-gray-200">{plan.targetAgent}</div>
          </div>

          <div>
            <div className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Description</div>
            <div className="p-2 bg-black rounded text-gray-300">
              {plan.description}
            </div>
          </div>

          <div>
            <div className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Proposed Message</div>
            <div className="p-2 bg-black rounded text-green-400 whitespace-pre-wrap">
              {plan.proposedMessage}
            </div>
          </div>

          <div>
            <div className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Rejection Reason (Optional)</div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="Why are you rejecting this?"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 flex items-center justify-end gap-2 bg-gray-900/50">
          <button
            onClick={() => {
              onResolve('reject', reason);
              onClose();
            }}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            Reject
          </button>
          
          <button
            onClick={() => {
              onResolve('approve');
              onClose();
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded transition-colors"
          >
            Approve Plan
          </button>
        </div>
      </div>
    </div>
  );
}
