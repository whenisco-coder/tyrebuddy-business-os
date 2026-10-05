import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Shield, Search, FileText, Filter } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = auditLogs.filter(log => {
    const matchSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
            Security & Compliance Audit Journal
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            {auditLogs.length} events logged · Immutable record of all system operations
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search audit trail by description or user..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-sans"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-xs py-1.5 px-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="BACKUP">BACKUP</option>
          <option value="RESTORE">RESTORE</option>
          <option value="AUTH">AUTH</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 font-mono font-bold text-neutral-600 dark:text-neutral-300">
              <th className="p-3">Timestamp</th>
              <th className="p-3">Action</th>
              <th className="p-3">Module</th>
              <th className="p-3">Operator / Principal</th>
              <th className="p-3">Operation Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="p-3 text-neutral-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 font-bold border text-[10px] ${
                      log.action === 'CREATE'
                        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                        : log.action === 'UPDATE'
                        ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                        : log.action === 'DELETE'
                        ? 'border-red-600 text-red-600'
                        : log.action === 'BACKUP'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-neutral-400 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="p-3 font-semibold">{log.module}</td>
                <td className="p-3 text-neutral-500">{log.user}</td>
                <td className="p-3 font-sans text-neutral-800 dark:text-neutral-200">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
