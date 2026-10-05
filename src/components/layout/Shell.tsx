import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { checkBackupReminder } from '../../utils/export';
import { PinLockScreen } from './PinLockScreen';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Boxes,
  Truck,
  CreditCard,
  Users,
  Building,
  CheckSquare,
  BarChart3,
  Scan,
  ShieldCheck,
  Settings,
  Lock,
  Moon,
  Sun,
  HardDrive,
  Menu,
  X,
  AlertTriangle,
  Circle,
  MoreHorizontal,
  Receipt,
  Laptop,
  Database,
} from 'lucide-react';
import { DownloadLocalModal } from './DownloadLocalModal';

interface ShellProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ currentModule, onNavigate, children }) => {
  const { settings, isAuthenticated, lockApp, updateSettings, triggerBackup } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // Check 7-day backup reminder
  const backupStatus = checkBackupReminder(settings.lastBackupDate);

  // Auto 9:00 PM backup simulator check
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      if (now.getHours() === 21 && now.getMinutes() === 0) {
        triggerBackup('SCHEDULED_9PM');
      }
    };
    const timer = setInterval(checkSchedule, 60000);
    return () => clearInterval(timer);
  }, [triggerBackup]);

  // Clean categorized navigation structure for elevated UI
  const navCategories = [
    {
      category: 'Sales & Invoicing',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: 'Priority #1' },
        { id: 'invoices', label: '1. Invoices & CN', icon: FileText, badge: '1st' },
        { id: 'shipping', label: '2. Courier Labels', icon: Truck, badge: '2nd' },
        { id: 'credit', label: 'Credit Ledger', icon: CreditCard, badge: 'Priority #4' },
      ],
    },
    {
      category: 'Catalog & Inventory',
      items: [
        { id: 'products', label: 'Products & Variants', icon: Boxes },
        { id: 'stock', label: 'Stock & Batches', icon: HardDrive },
        { id: 'scanner', label: 'Barcode Scanner', icon: Scan },
        { id: 'tally', label: 'Tally Import & Sync', icon: Database, badge: 'Prime' },
      ],
    },
    {
      category: 'Parties & Finances',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'purchases', label: 'Purchases & Vendors', icon: Building },
        { id: 'expenses', label: 'Expenses & Overhead', icon: Receipt },
        { id: 'reports', label: 'Financial Reports', icon: BarChart3, badge: 'Priority #5' },
      ],
    },
    {
      category: 'System & Controls',
      items: [
        { id: 'tasks', label: 'Daily Tasks', icon: CheckSquare },
        { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
        { id: 'settings', label: 'Settings & Backups', icon: Settings },
      ],
    },
  ];

  const allNavItems = navCategories.flatMap(cat => cat.items);

  // Mobile Bottom Tabs (Locked spec: Home · Orders · Products · Stock · More)
  const mobileTabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'products', label: 'Products', icon: Boxes },
    { id: 'stock', label: 'Stock', icon: HardDrive },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  if (!isAuthenticated) {
    return <PinLockScreen />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col antialiased">
      {/* 7-Day Backup Reminder Banner */}
      {!backupReminderDismissed && backupStatus.isOverdue && (
        <div className="no-print bg-amber-500 text-neutral-950 px-4 py-2 text-xs font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Security Notice: Last backup was {backupStatus.daysAgo} days ago. Recommended to export
              backup regularly to ensure zero data loss.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                triggerBackup('MANUAL');
                setBackupReminderDismissed(true);
              }}
              className="px-2.5 py-0.5 bg-neutral-950 text-white font-bold text-[11px]"
            >
              Backup Now
            </button>
            <button
              type="button"
              onClick={() => setBackupReminderDismissed(true)}
              className="text-neutral-900 hover:text-black font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (Sidebar Navigation 240px-280px) */}
        <aside className="no-print hidden md:flex flex-col w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shrink-0">
          {/* Brand Zone (Single text element wordmark) */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100 block truncate">
                {settings.businessName}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Offline app · Data on this device</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-4 text-xs font-medium">
            {navCategories.map(group => (
              <div key={group.category} className="space-y-0.5">
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400 dark:text-neutral-500 px-3 py-1">
                  {group.category}
                </div>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentModule === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 transition-all ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 font-bold border-l-2 border-amber-500 shadow-2xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 hover:text-neutral-900 dark:hover:text-neutral-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && !isActive && (
                        <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 uppercase">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Sidebar Footer Controls */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 font-mono">
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-1.5 p-1.5 hover:text-neutral-900 dark:hover:text-neutral-100 text-[11px]"
              title="Download & Run Locally Guide"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Run Locally</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateSettings({ isDarkMode: !settings.isDarkMode })}
                className="p-1.5 hover:text-neutral-900 dark:hover:text-neutral-100"
                title="Toggle theme"
              >
                {settings.isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => lockApp()}
                className="p-1.5 hover:text-neutral-900 dark:hover:text-neutral-100"
                title="Lock PIN"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Viewport Canvas */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar Contract: Breadcrumb trail on left, action indicators on right */}
          <header className="no-print bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 flex items-center justify-between shrink-0">
            {/* Left: Mobile menu toggle + breadcrumb trail */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1 text-neutral-600 dark:text-neutral-400"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-xs font-mono text-neutral-500 flex items-center gap-1.5">
                <span>Tyrebuddy OS</span>
                <span className="text-neutral-400">/</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100 capitalize">
                  {currentModule}
                </span>
              </div>
            </div>

            {/* Right: Sync Indicator + Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('tally')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold transition shadow-2xs"
                title="Tally Software Migration & Import Center"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tally Import</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs"
                title="Download / Run Locally on Your Computer"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Run Locally</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Offline app · Data on this device</span>
              </div>

              <button
                type="button"
                onClick={() => lockApp()}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                title="Lock PIN"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Module Content */}
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
        </div>
      </div>

      {/* Mobile Bottom Tabs: Home · Orders · Products · Stock · More (Locked Spec) */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-5 text-center h-14">
        {mobileTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === 'more' ? isMobileMenuOpen : currentModule === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'more') {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                } else {
                  setIsMobileMenuOpen(false);
                  onNavigate(tab.id);
                }
              }}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                isActive
                  ? 'text-neutral-900 dark:text-white font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-mono mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile "More" Slide-Over Drawer */}
      {isMobileMenuOpen && (
        <div className="no-print md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-2">
                <span className="text-xs font-mono font-bold uppercase">All Modules</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-neutral-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1 text-xs font-medium">
                {allNavItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsDownloadModalOpen(true);
                }}
                className="flex items-center gap-1.5 p-1 text-neutral-700 dark:text-neutral-300 font-bold"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Run Locally</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings({ isDarkMode: !settings.isDarkMode })}
                  className="flex items-center gap-1 p-1 text-neutral-600 dark:text-neutral-400"
                >
                  {settings.isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => lockApp()}
                  className="flex items-center gap-1 p-1 text-neutral-600 dark:text-neutral-400"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run Locally & Offline Download Guide Modal */}
      <DownloadLocalModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
};
