import React, { useState, useMemo } from 'react';
import { Shop, Invoice, Language } from '../types';
import { strings } from '../utils/strings';
import { openWhatsAppUrl, createInvoiceWhatsAppMessage, createReadyWhatsAppMessage, shareInvoicePngToWhatsApp } from '../utils/whatsapp';
import { generateInvoiceImageUriAsync } from '../utils/invoiceImage';
import {
  FileText,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Download,
  Upload,
  Ruler,
  Phone,
  Calendar,
  MessageSquareText,
  Share2,
  FolderTree,
  Settings,
  Sparkles,
  Users,
  Clock,
  CheckCircle2,
  Wallet,
  Receipt,
  LayoutGrid,
  Table as TableIcon,
  Check,
} from 'lucide-react';

interface DashboardScreenProps {
  shop: Shop;
  invoices: Invoice[];
  catalogItems?: any[];
  tailorRecords?: any[];
  expenses?: any[];
  lang: Language;
  onNavigateToAiManager?: () => void;
  onNavigateToNewOrder: () => void;
  onNavigateToInvoiceDetail: (id: string) => void;
  onNavigateToEditInvoice?: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onNavigateToSettings?: () => void;
  onOpenPaymentModal: (invoice: Invoice) => void;
  onOpenPrintModal?: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  onOpenVisualGuide?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (file: File) => void;
  onUpdateStatus?: (invoiceId: string, status: Invoice['orderStatus']) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  shop,
  invoices,
  catalogItems = [],
  tailorRecords = [],
  expenses = [],
  lang,
  onNavigateToAiManager,
  onNavigateToNewOrder,
  onNavigateToInvoiceDetail,
  onNavigateToEditInvoice,
  onEditInvoice,
  onNavigateToSettings,
  onOpenPaymentModal,
  onOpenPrintModal,
  onDeleteInvoice,
  onOpenVisualGuide,
  onExportBackup,
  onImportBackup,
  onUpdateStatus,
}) => {
  const t = strings[lang] || strings.BN;
  const isEn = lang === 'EN';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const restoreFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleRestoreClick = () => {
    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.click();
    }
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportBackup) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  const handleSendReadyWhatsApp = (inv: Invoice) => {
    const msg = createReadyWhatsAppMessage(inv, shop, lang);
    openWhatsAppUrl(inv.customerPhone, msg);
  };

  const handleSendInvoicePng = async (inv: Invoice) => {
    setSendingInvoiceId(inv.id);
    try {
      const uri = await generateInvoiceImageUriAsync(inv, shop, lang);
      if (uri) {
        await shareInvoicePngToWhatsApp(inv, shop, uri, false, lang);
      }
    } catch (e) {
      console.warn(e);
      const msg = createInvoiceWhatsAppMessage(inv, shop, lang);
      openWhatsAppUrl(inv.customerPhone, msg);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  // Reliable calculations strictly from existing data
  const totalInvoices = invoices.length;
  const totalPieces = invoices.reduce(
    (acc, inv) => acc + (inv.items ? inv.items.reduce((s, it) => s + it.quantity, 0) : 1),
    0
  );
  const totalSales = invoices.reduce((acc, inv) => acc + (Number(inv.netTotal) || 0), 0);
  const totalAdvance = invoices.reduce((acc, inv) => acc + (Number(inv.advanceDeposit) || 0), 0);
  const remainingDue = invoices.reduce((acc, inv) => acc + (Number(inv.remainingDue) || 0), 0);

  // 1. Total Customers (Unique by phone or name)
  const totalCustomers = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.customerPhone && inv.customerPhone.trim()) {
        set.add(inv.customerPhone.trim());
      } else if (inv.customerName && inv.customerName.trim()) {
        set.add(inv.customerName.trim().toLowerCase());
      }
    });
    return set.size;
  }, [invoices]);

  // 2. Today's Orders & Today's Sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDateStr = new Date().toDateString();

  const { todayOrdersCount, todaySales } = useMemo(() => {
    let count = 0;
    let sales = 0;
    invoices.forEach((inv) => {
      const isToday =
        inv.orderDate === todayStr ||
        (inv.createdAt && new Date(inv.createdAt).toDateString() === todayDateStr);
      if (isToday) {
        count += 1;
        sales += Number(inv.advanceDeposit) || 0;
      }
      // Also count any due collection made today
      if (inv.payments && Array.isArray(inv.payments)) {
        inv.payments.forEach((p) => {
          if (
            p.paymentDate === todayStr ||
            (p.createdAt && new Date(p.createdAt).toDateString() === todayDateStr)
          ) {
            if (!isToday) sales += Number(p.amount) || 0;
          }
        });
      }
    });
    return { todayOrdersCount: count, todaySales: sales };
  }, [invoices, todayStr, todayDateStr]);

  // 3. Pending and In Progress Orders
  const pendingOrdersCount = useMemo(() => {
    return invoices.filter((inv) => inv.orderStatus === 'Pending' || inv.orderStatus === 'In Progress')
      .length;
  }, [invoices]);

  // 4. Ready for Pickup
  const readyOrdersCount = useMemo(() => {
    return invoices.filter((inv) => inv.orderStatus === 'Ready for Pickup').length;
  }, [invoices]);

  // 5. Total Expenses
  const totalExpensesSum = useMemo(() => {
    return (expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // 6. Reliable Cash Balance
  const cashBalance = useMemo(() => {
    let totalCashCollected = 0;
    invoices.forEach((inv) => {
      if (inv.payments && inv.payments.length > 0) {
        totalCashCollected += inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      } else {
        totalCashCollected += Number(inv.advanceDeposit) || 0;
      }
    });
    const tailorPaid = (tailorRecords || []).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    return totalCashCollected - totalExpensesSum - tailorPaid;
  }, [invoices, totalExpensesSum, tailorRecords]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerPhone.includes(searchQuery) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.dressType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' || inv.orderStatus.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Invoice['orderStatus']) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Ready for Pickup':
        return 'bg-teal-100 text-teal-900 border-teal-300 ring-1 ring-teal-400 font-black';
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-900 border-slate-300';
    }
  };

  const getStatusLabel = (status: Invoice['orderStatus']) => {
    if (isEn) {
      return status;
    }
    switch (status) {
      case 'Pending':
        return 'পেন্ডিং';
      case 'In Progress':
        return 'কাজ চলছে';
      case 'Ready for Pickup':
        return '✨ কাপড় রেডি';
      case 'Delivered':
        return 'ডেলিভারি সম্পন্ন';
      case 'Cancelled':
        return 'বাতিল';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Shop Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30">
                {isEn ? `${shop.currency} Official Tailoring Management` : `${shop.currency} অফিসিয়াল টেইলার্স ম্যানেজমেন্ট`}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-white">{shop.name}</h1>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">{shop.address} • 📞 {shop.phone}</p>
            <p className="text-xs font-semibold text-amber-300/90 mt-0.5">
              {isEn ? `Trade License / CR No: ${shop.crNumber}` : `ট্রেড লাইসেন্স / CR নং: ${shop.crNumber}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            {onNavigateToAiManager && (
              <button
                onClick={onNavigateToAiManager}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black px-4 py-2.5 text-xs sm:text-sm shadow-lg transition active:scale-95 border border-emerald-300"
              >
                <Sparkles className="h-4 w-4 text-slate-950 animate-pulse" />
                <span>{isEn ? 'AI Business Manager' : 'AI বিজনেস ম্যানেজার ✨'}</span>
              </button>
            )}
            <button
              onClick={onNavigateToNewOrder}
              className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2.5 text-xs sm:text-sm shadow-lg transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {t.newOrder}
            </button>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                title="Root Directory & Categories"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 text-xs border border-emerald-500/50 shadow-sm transition"
              >
                <FolderTree className="h-4 w-4 text-emerald-200" />
                <span>{isEn ? 'Settings & Categories' : 'সেটিংস ও ক্যাটাগরি'}</span>
              </button>
            )}
            <button
              onClick={onExportBackup}
              title="Download full JSON Database Backup"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-2.5 text-xs border border-white/20 transition"
            >
              <Download className="h-4 w-4 text-emerald-300" />
              {t.downloadBackup}
            </button>
            <button
              onClick={handleRestoreClick}
              title="Restore Data from Backup File"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-2.5 text-xs border border-white/20 transition"
            >
              <Upload className="h-4 w-4 text-amber-300" />
              {t.restoreData}
            </button>
            <input
              type="file"
              ref={restoreFileInputRef}
              onChange={handleRestoreFileChange}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              onClick={onOpenVisualGuide}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-2.5 text-xs border border-white/20 transition"
            >
              <Ruler className="h-4 w-4 text-teal-300" />
              {t.visualGuide}
            </button>
          </div>
        </div>
      </div>

      {/* Professional Desktop Dashboard: 2-Tier KPI Metrics Grid */}
      <div className="space-y-3">
        {/* Tier 1: Today & Active Operations */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Customers */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{isEn ? "Total Customers" : "মোট কাস্টমার"}</span>
              <div className="rounded-xl bg-purple-100 p-2 text-purple-800">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{totalCustomers}</div>
            <span className="text-[11px] text-slate-500 font-medium">{isEn ? "Active contacts" : "গ্রাহক সংখ্যা"}</span>
          </div>

          {/* Today's Orders */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{isEn ? "Today's Orders" : "আজকের অর্ডার"}</span>
              <div className="rounded-xl bg-blue-100 p-2 text-blue-800">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-blue-950">{todayOrdersCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">{isEn ? "Placed today" : "আজ বুকিং হয়েছে"}</span>
          </div>

          {/* Today's Sales */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{isEn ? "Today's Sales" : "আজকের কালেকশন"}</span>
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-black text-emerald-900">
              {shop.currency} {todaySales.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">{isEn ? "Cash received today" : "আজ জমা হয়েছে"}</span>
          </div>

          {/* Pending Orders */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 sm:p-4 shadow-xs hover:border-amber-300 transition">
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-xs font-bold">{isEn ? "Pending Orders" : "চলমান কাজ"}</span>
              <div className="rounded-xl bg-amber-200/80 p-2 text-amber-900">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-950">{pendingOrdersCount}</div>
            <span className="text-[11px] text-amber-700 font-medium">{isEn ? "In production" : "পেন্ডিং ও কাটিং চলছে"}</span>
          </div>

          {/* Ready for Pickup */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5 sm:p-4 shadow-xs hover:border-teal-300 transition">
            <div className="flex items-center justify-between text-teal-900">
              <span className="text-xs font-bold">{isEn ? "Ready for Pickup" : "কাপড় রেডি"}</span>
              <div className="rounded-xl bg-teal-200/80 p-2 text-teal-900">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-teal-950">{readyOrdersCount}</div>
            <span className="text-[11px] text-teal-700 font-medium">{isEn ? "Ready for delivery" : "ডেলিভারির জন্য তৈরি"}</span>
          </div>
        </div>

        {/* Tier 2: Financial Overview & Shop Balance */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Invoices */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{t.totalInvoices}</span>
              <div className="rounded-lg bg-slate-100 p-1.5 text-slate-700">
                <FileText className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-black text-slate-900">{totalInvoices}</div>
            <span className="text-[10px] text-slate-500 font-medium">{totalPieces} {isEn ? "pieces" : "পিস পোশাক"}</span>
          </div>

          {/* Total Sales Value */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{t.totalSales}</span>
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-lg font-black text-emerald-950">
              {shop.currency} {totalSales.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{isEn ? "Total order value" : "মোট বিক্রয় মূল্য"}</span>
          </div>

          {/* Total Advance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{t.totalAdvance}</span>
              <div className="rounded-lg bg-teal-100 p-1.5 text-teal-800">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-lg font-black text-teal-950">
              {shop.currency} {totalAdvance.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{isEn ? "Advance deposit" : "মোট অগ্রিম জমা"}</span>
          </div>

          {/* Total Expenses */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">{isEn ? "Total Expenses" : "মোট খরচ"}</span>
              <div className="rounded-lg bg-amber-100 p-1.5 text-amber-800">
                <Receipt className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-lg font-black text-amber-950">
              {shop.currency} {totalExpensesSum.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{isEn ? "Shop expenses" : "দোকানের সর্বমোট ব্যয়"}</span>
          </div>

          {/* Cash Balance */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-emerald-900">
              <span className="text-xs font-bold">{isEn ? "Cash Balance" : "ক্যাশ ব্যালেন্স"}</span>
              <div className="rounded-lg bg-emerald-200 p-1.5 text-emerald-900">
                <Wallet className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className={`mt-1.5 text-lg font-black ${cashBalance >= 0 ? 'text-emerald-900' : 'text-rose-700'}`}>
              {shop.currency} {cashBalance.toFixed(0)}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">{isEn ? "Net cash in hand" : "হাতে নগদ ব্যালেন্স"}</span>
          </div>

          {/* Remaining Due */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-xs font-bold">{t.remainingDue}</span>
              <div className="rounded-lg bg-rose-200 p-1.5 text-rose-900">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-lg font-black text-rose-800">
              {shop.currency} {remainingDue.toFixed(0)}
            </div>
            <span className="text-[10px] text-rose-600 font-medium">{isEn ? "Total receivable" : "কাস্টমারদের বকেয়া"}</span>
          </div>
        </div>
      </div>

      {/* Orders List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <span>{t.recentOrders}</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-900 font-black">
                {filteredInvoices.length}
              </span>
            </h2>

            {/* View Mode Toggle: Grid vs Table */}
            <div className="hidden sm:flex items-center rounded-xl bg-slate-200/80 p-0.5 border border-slate-300">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isEn ? "Card Grid View" : "কার্ড ভিউ"}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{isEn ? "Cards" : "কার্ড"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isEn ? "Desktop Table View" : "টেবিল ভিউ"}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>{isEn ? "Table" : "টেবিল"}</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-4 text-xs font-bold text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 shadow-sm"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', 'Pending', 'In Progress', 'Ready for Pickup', 'Delivered', 'Cancelled'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-emerald-900 text-white shadow-sm ring-1 ring-emerald-800'
                    : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {st === 'All'
                  ? isEn
                    ? 'All Orders'
                    : 'সকল অর্ডার'
                  : st === 'Pending'
                  ? isEn
                    ? 'Pending'
                    : 'পেন্ডিং'
                  : st === 'In Progress'
                  ? isEn
                    ? 'In Progress'
                    : 'কাজ চলছে'
                  : st === 'Ready for Pickup'
                  ? isEn
                    ? '✨ Ready'
                    : '✨ কাপড় রেডি'
                  : st === 'Delivered'
                  ? isEn
                    ? 'Delivered'
                    : 'ডেলিভারি'
                  : isEn
                  ? 'Cancelled'
                  : 'বাতিল'}
              </button>
            )
          )}
        </div>

        {/* Invoices List Display */}
        {filteredInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-600">
            <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <p className="font-black text-slate-900 text-base">{t.noOrdersFound}</p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {isEn ? 'Click on "+ New Order" to create a new invoice.' : '+ নতুন অর্ডার বাটনে চাপ দিয়ে ইনভয়েস তৈরি করুন।'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Desktop Table View */
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3.5 px-4">{isEn ? 'Invoice #' : 'ইনভয়েস #'}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Customer' : 'কাস্টমার'}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Dress Type' : 'পোশাক'}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Order Date' : 'অর্ডার তারিখ'}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Delivery Date' : 'ডেলিভারি তারিখ'}</th>
                  <th className="py-3.5 px-4 text-right">{isEn ? 'Total' : 'মোট মূল্য'}</th>
                  <th className="py-3.5 px-4 text-right">{isEn ? 'Due' : 'বকেয়া'}</th>
                  <th className="py-3.5 px-4 text-center">{isEn ? 'Status' : 'স্ট্যাটাস'}</th>
                  <th className="py-3.5 px-4 text-right">{isEn ? 'Actions' : 'অ্যাকশন'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-black text-emerald-950">
                      #{inv.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-900">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        {inv.customerPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800 border border-slate-200">
                        {inv.dressType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {inv.orderDate}
                    </td>
                    <td className="py-3 px-4 text-slate-900 whitespace-nowrap font-black">
                      {inv.deliveryDate}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {shop.currency} {inv.netTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className={`font-black ${inv.remainingDue > 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                        {shop.currency} {inv.remainingDue.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${getStatusBadge(inv.orderStatus)}`}>
                        {getStatusLabel(inv.orderStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onNavigateToInvoiceDetail(inv.id)}
                          className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition"
                          title={t.view}
                        >
                          <Eye className="h-4 w-4 text-emerald-800" />
                        </button>
                        <button
                          onClick={() => {
                            if (onNavigateToEditInvoice) onNavigateToEditInvoice(inv);
                            else if (onEditInvoice) onEditInvoice(inv);
                          }}
                          className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition"
                          title={t.edit}
                        >
                          <Edit2 className="h-4 w-4 text-blue-700" />
                        </button>
                        {inv.remainingDue > 0 && (
                          <button
                            onClick={() => onOpenPaymentModal(inv)}
                            className="rounded-md bg-amber-400 hover:bg-amber-500 px-2 py-1 text-[11px] font-black text-slate-950 transition"
                            title={isEn ? "Record Due Payment" : "বকেয়া জমা নিন"}
                          >
                            + বকেয়া
                          </button>
                        )}
                        {inv.orderStatus === 'Ready for Pickup' ? (
                          <button
                            onClick={() => handleSendReadyWhatsApp(inv)}
                            className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-50 transition"
                            title={isEn ? 'Send Dress Ready WhatsApp Message' : 'কাপড় রেডি WhatsApp মেসেজ পাঠান'}
                          >
                            <MessageSquareText className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendInvoicePng(inv)}
                            disabled={sendingInvoiceId === inv.id}
                            className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 transition"
                            title={isEn ? 'Send PNG Invoice to WhatsApp' : 'WhatsApp এ PNG ইনভয়েস পাঠান'}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteInvoice(inv)}
                          className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-100 transition"
                          title={isEn ? 'Delete Invoice' : 'মুছুন'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Responsive Cards Grid (1 col mobile, 2 col tablet, 3 col desktop) */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-300 bg-white p-5 shadow-xs transition hover:border-emerald-600 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: ID + Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-950 text-base">#{inv.id}</span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 border border-slate-200">
                        {inv.dressType}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-0.5 text-xs font-black ${getStatusBadge(
                        inv.orderStatus
                      )}`}
                    >
                      {getStatusLabel(inv.orderStatus)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="mt-3">
                    <h3 className="text-base font-black text-slate-950 group-hover:text-emerald-950 transition">
                      {inv.customerName}
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mt-0.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-700" />
                      {inv.customerPhone}
                    </p>
                  </div>

                  {/* Dates & Financials Grid */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-100/90 p-3 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-700 font-bold block">{t.deliveryDateLabel}</span>
                      <p className="font-black text-slate-950 mt-0.5 flex items-center gap-1 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
                        {inv.deliveryDate}
                      </p>
                    </div>
                    <div className="text-center border-x border-slate-200 px-1">
                      <span className="text-[11px] text-slate-700 font-bold block">{t.netTotal}</span>
                      <p className="font-black text-slate-950 mt-0.5 text-xs">
                        {shop.currency} {inv.netTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-700 font-bold block">{t.remainingDue}</span>
                      <p
                        className={`font-black mt-0.5 text-xs ${
                          inv.remainingDue > 0 ? 'text-rose-700' : 'text-emerald-800'
                        }`}
                      >
                        {shop.currency} {inv.remainingDue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onNavigateToInvoiceDetail(inv.id)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100 transition"
                    >
                      <Eye className="h-4 w-4 text-emerald-800" />
                      {t.view}
                    </button>
                    <button
                      onClick={() => {
                        if (onNavigateToEditInvoice) onNavigateToEditInvoice(inv);
                        else if (onEditInvoice) onEditInvoice(inv);
                      }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100 transition"
                    >
                      <Edit2 className="h-4 w-4 text-blue-700" />
                      {t.edit}
                    </button>
                    <button
                      onClick={() => onDeleteInvoice(inv)}
                      className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-100 transition"
                      title={isEn ? 'Delete Invoice' : 'মুছুন'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {inv.remainingDue > 0 && (
                      <button
                        onClick={() => onOpenPaymentModal(inv)}
                        className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-black text-slate-950 shadow-xs transition"
                      >
                        {isEn ? '+ Due Pay' : '+ বকেয়া'}
                      </button>
                    )}

                    {/* Ready WhatsApp alert button - Text only */}
                    {inv.orderStatus === 'Ready for Pickup' ? (
                      <button
                        onClick={() => handleSendReadyWhatsApp(inv)}
                        className="flex items-center gap-1 rounded-lg bg-teal-700 hover:bg-teal-800 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95"
                        title={isEn ? 'Send Dress Ready WhatsApp Message' : 'কাপড় রেডি WhatsApp মেসেজ পাঠান'}
                      >
                        <MessageSquareText className="h-3.5 w-3.5" />
                        <span>
                          {isEn ? 'Ready WhatsApp' : 'কাপড় রেডি WhatsApp'}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendInvoicePng(inv)}
                        disabled={sendingInvoiceId === inv.id}
                        className="flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95"
                        title={isEn ? 'Send PNG Invoice to WhatsApp' : 'WhatsApp এ PNG ইনভয়েস পাঠান'}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>
                          {sendingInvoiceId === inv.id
                            ? isEn
                              ? 'Generating...'
                              : 'তৈরি হচ্ছে...'
                            : 'WhatsApp (PNG)'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
