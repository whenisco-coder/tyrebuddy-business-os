import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Task } from '../../types';
import { CheckSquare, Square, Plus, Trash2, Calendar, Repeat, AlertCircle } from 'lucide-react';

export const TasksView: React.FC = () => {
  const { tasks, addTask, toggleTask, deleteTask, products, orders } = useStore();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [recurring, setRecurring] = useState('None');
  const [isAdding, setIsAdding] = useState(false);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title,
      dueDate,
      priority,
      recurring: recurring !== 'None' ? recurring : undefined,
      completed: false,
    });

    setTitle('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
            Operational Tasks & Reminders
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            {tasks.filter(t => !t.completed).length} pending tasks · Scheduled audits & follow-ups
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Task Creation Drawer */}
      {isAdding && (
        <form
          onSubmit={handleCreateTask}
          className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs"
        >
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1">
              Task Title:
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Follow up on MRF consignment docket, perform 9pm stock audit"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1">
                Due Date:
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full p-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1">
                Priority:
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full p-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1">
                Recurring Schedule:
              </label>
              <select
                value={recurring}
                onChange={e => setRecurring(e.target.value)}
                className="w-full p-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
              >
                <option value="None">None (One-time)</option>
                <option value="Daily at 9:00 PM: Closing Audit">Daily at 9:00 PM</option>
                <option value="Every Monday: Check Low Stock">Every Monday (Low Stock Check)</option>
                <option value="Monthly 1st: Reconcile GST Return">Monthly (GST Reconciliation)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold"
            >
              Save Task
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
        {tasks.map(t => (
          <div
            key={t.id}
            className={`p-3.5 flex items-center justify-between transition-colors ${
              t.completed ? 'opacity-50 bg-neutral-50 dark:bg-neutral-850' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleTask(t.id)}
                className="text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white"
              >
                {t.completed ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>

              <div>
                <span
                  className={`text-xs font-medium text-neutral-900 dark:text-neutral-100 ${
                    t.completed ? 'line-through text-neutral-400' : ''
                  }`}
                >
                  {t.title}
                </span>

                <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-mono mt-0.5">
                  <span>Due: {t.dueDate}</span>
                  <span
                    className={`font-semibold ${
                      t.priority === 'High'
                        ? 'text-red-600'
                        : t.priority === 'Medium'
                        ? 'text-amber-600'
                        : 'text-neutral-400'
                    }`}
                  >
                    {t.priority} Priority
                  </span>
                  {t.recurring && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Repeat className="w-3 h-3" />
                      {t.recurring}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => deleteTask(t.id)}
              className="text-neutral-400 hover:text-red-500 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
