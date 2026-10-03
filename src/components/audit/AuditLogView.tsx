import React from 'react';
import { History, Shield, CheckCircle2 } from 'lucide-react';
import { storageService } from '../../services/storage';

export const AuditLogView: React.FC = () => {
  const logs = storageService.getAuditLogs();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          System Audit Log
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
          Immutable event log tracking all creations, payments, prepayments, closures, and backups.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-300">
            No audit records logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity Ref</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-800 dark:text-slate-200">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
