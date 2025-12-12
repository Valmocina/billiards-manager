import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase'; 
import { 
  Clock, Calendar, X, Trash2, Edit2, Plus, 
  ArrowLeft, Info, AlertCircle, Infinity, User, 
  LayoutDashboard, Armchair, Settings, LogOut, 
  Search, Bell, Moon, Sun, Monitor, DollarSign,
  CheckCircle, History, TrendingUp, Receipt, Play,
  Lock, Key, LogIn, Tag, Printer, Menu, Users,
  List, CalendarDays
} from 'lucide-react';

const App = () => {
  // --- CONSTANTS ---
  const RESERVATION_FEE = 15; // UPDATED to 15
  const WAITLIST_LIMIT = 10;

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: 'admin' });
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- APP STATE ---
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [history, setHistory] = useState([]); 
  const [hourlyRate, setHourlyRate] = useState(200); 
  
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [darkMode, setDarkMode] = useState(true);
  
  // Track reservation start details
  const [startingReservationId, setStartingReservationId] = useState(null); 
  const [startingReservationType, setStartingReservationType] = useState(null); // New state to track if it's Waitlist or Reservation
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date()); 

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [modalType, setModalType] = useState(null); 
  const [formData, setFormData] = useState({
    guestName: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    duration: 1,
    isOpenTime: false,
    preferredTable: 'Any Table'
  });
  const [error, setError] = useState('');
  const [newTableName, setNewTableName] = useState('');

  // Settings State
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [newRateInput, setNewRateInput] = useState(''); 

  // --- SUPABASE FETCHING ---
  const fetchAllData = async () => {
    const { data: tablesData } = await supabase.from('tables').select('*').order('id', { ascending: true });
    if (tablesData) {
      const formattedTables = tablesData.map(t => ({
        ...t,
        occupiedUntilRaw: t.occupied_until_raw ? new Date(t.occupied_until_raw) : null,
        occupiedUntil: t.occupied_until,
        sessionType: t.session_type,
        currentGuest: t.current_guest,
        isOpenTime: t.is_open_time,
        startTime: t.start_time ? new Date(t.start_time) : null
      }));
      setTables(formattedTables);
    }

    const { data: resData } = await supabase.from('reservations').select('*').order('id', { ascending: true });
    if (resData) {
        const formattedRes = resData.map(r => ({
            ...r,
            tableName: r.table_name, 
            guestName: r.guest_name,
            rawDate: r.raw_date,
            rawTime: r.raw_time,
            displayDate: r.display_date,
            displayTime: r.display_time
        }));
        setReservations(formattedRes);
    }

    const { data: histData } = await supabase.from('history').select('*').order('id', { ascending: false });
    if (histData) {
        const formattedHist = histData.map(h => ({
            ...h,
            tableName: h.table_name,
            guestName: h.guest_name,
        }));
        setHistory(formattedHist);
    }

    const { data: settingsData } = await supabase.from('app_settings').select('*');
    if (settingsData) {
      settingsData.forEach(setting => {
        if (setting.key === 'admin_password') {
          setAdminCredentials(prev => ({ ...prev, password: setting.value }));
        }
        if (setting.key === 'hourly_rate') {
          setHourlyRate(Number(setting.value));
          setNewRateInput(setting.value); 
        }
      });
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timerInterval = setInterval(() => {
        setNow(new Date());
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // --- DERIVED LISTS ---
  const waitlistItems = useMemo(() => 
    reservations.filter(r => r.type === 'Waitlist'), 
  [reservations]);

  const reservationItems = useMemo(() => 
    reservations.filter(r => r.type === 'Reservation'), 
  [reservations]);

  const calculateBill = (minutes) => {
    if (minutes <= 5) return 15;
    if (minutes <= 30) return 50;
    if (minutes <= 60) return 100;
    return Math.ceil((minutes / 60) * hourlyRate);
  };

  // --- ACTIONS ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput.username === adminCredentials.username && loginInput.password === adminCredentials.password) {
      setIsAuthenticated(true);
      setLoginError('');
      setCurrentView('dashboard'); 
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginInput({ username: '', password: '' });
    setCurrentView('dashboard');
    setIsMobileMenuOpen(false);
  };

  const handleChangePassword = async () => {
    if (passwordForm.current !== adminCredentials.password) {
      setPasswordMsg({ text: 'Current password is incorrect.', type: 'error' });
      return;
    }
    if (passwordForm.new.length < 4) {
      setPasswordMsg({ text: 'New password must be at least 4 characters.', type: 'error' });
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }
    
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'admin_password', value: passwordForm.new })
      .select();

    if (error) {
      setPasswordMsg({ text: 'Error saving password.', type: 'error' });
    } else {
      setAdminCredentials({ ...adminCredentials, password: passwordForm.new });
      setPasswordMsg({ text: 'Password updated successfully!', type: 'success' });
      setPasswordForm({ current: '', new: '', confirm: '' });
    }
  };

  const handleUpdateRate = async () => {
    const rate = parseInt(newRateInput);
    if (isNaN(rate) || rate < 0) {
      alert("Please enter a valid number");
      return;
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'hourly_rate', value: rate.toString() }) 
      .select();

    if (error) {
      alert("Failed to update rate.");
    } else {
      setHourlyRate(rate);
      alert("Hourly rate updated permanently!");
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("CRITICAL WARNING: This will permanently delete ALL transaction history.")) {
      const { error } = await supabase.from('history').delete().gt('id', 0);
      if (error) {
        alert("Failed to clear history: " + error.message);
      } else {
        alert("History Log cleared successfully.");
        fetchAllData();
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetForm = () => {
    const now = new Date();
    // Default time to next hour
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const timeString = now.toTimeString().slice(0, 5);

    setFormData({
      guestName: '',
      date: new Date().toISOString().split('T')[0],
      time: timeString,
      duration: 1,
      isOpenTime: false,
      preferredTable: 'Any Table'
    });
    setError('');
    setStartingReservationId(null);
    setStartingReservationType(null);
  };

  const addToHistory = async (item, status, amount = 0) => {
    const newEntry = {
      table_name: item.tableName || item.name,
      guest_name: item.guestName || item.currentGuest || 'Walk-In',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      type: item.type || 'Session',
      status: status, 
      amount: amount
    };
    await supabase.from('history').insert([newEntry]);
    fetchAllData(); 
  };

  // --- CLICK HANDLERS ---

  const handleWalkInClick = (table) => {
    setSelectedTable(table);
    setModalType('walkin');
    resetForm();
    setShowModal(true);
  };

  const handleReserveClick = (table) => {
    setSelectedTable(table); 
    setModalType('reserve'); // Scheduled Reservation
    resetForm();
    setShowModal(true);
  };

  const handleJoinWaitlistClick = () => {
    if (waitlistItems.length >= WAITLIST_LIMIT) {
        alert("Waitlist is currently full (Max 10).");
        return;
    }
    setSelectedTable(null); 
    setModalType('waitlist'); // Immediate Waitlist
    resetForm();
    setShowModal(true);
  };

  const handleStartReservation = (res) => {
    let tableToSelect = null;
    if (res.tableName && res.tableName !== 'Any Table') {
        tableToSelect = tables.find(t => t.name === res.tableName);
    }
    
    if (!tableToSelect) {
        tableToSelect = tables.find(t => t.status === 'Available');
    }

    if (!tableToSelect) {
        alert("No tables are currently available to start this session.");
        return;
    }

    setSelectedTable(tableToSelect);
    setModalType('walkin');
    setFormData({
      guestName: res.guestName,
      date: new Date().toISOString().split('T')[0],
      time: '',
      duration: 1,
      isOpenTime: true, 
      preferredTable: res.tableName
    });
    setStartingReservationId(res.id); 
    setStartingReservationType(res.type); // Track if it was Waitlist or Reservation
    setShowModal(true);
  };

  const handleFinishSession = async (table) => {
    let cost = 0;
    
    if (table.sessionType === 'walkin') {
       if (table.startTime) {
         const nowTime = new Date();
         const diffMs = nowTime - table.startTime;
         const diffMinutes = diffMs / (1000 * 60); 
         cost = calculateBill(diffMinutes);
       } else {
         cost = (table.duration || 1) * hourlyRate;
       }
    }

    if (table.deductible) {
      cost = Math.max(0, cost - table.deductible);
    }
    
    cost = Math.round(cost);

    await supabase.from('tables').update({
        status: 'Available',
        occupied_until: null,
        occupied_until_raw: null,
        session_type: null,
        current_guest: null,
        duration: null,
        is_open_time: false,
        deductible: 0,
        start_time: null 
    }).eq('id', table.id);

    await addToHistory({ tableName: table.name, type: 'Walk-In', guestName: table.currentGuest }, 'Completed', cost);
    fetchAllData(); 
  };

  const handleCancelReservation = async (id, type) => {
    const res = reservations.find(r => r.id === id);
    if (res) {
      await addToHistory({ ...res, type: type }, 'Canceled', 0);
      await supabase.from('reservations').delete().eq('id', id);
      fetchAllData();
    }
  };

  const handleAddTable = async () => {
    if (!newTableName.trim()) return;
    await supabase.from('tables').insert([{ name: newTableName, status: 'Available' }]);
    setNewTableName('');
    fetchAllData();
  };

  const handleDeleteTable = async (id) => {
    const tableToDelete = tables.find(t => t.id === id);
    if (tableToDelete.status === 'Occupied') {
      alert("Cannot delete occupied table.");
      return;
    }
    await supabase.from('tables').delete().eq('id', id);
    fetchAllData();
  };

  const openEditModal = (table) => {
    setSelectedTable(table);
    setModalType('edit');
    setFormData({ ...formData, guestName: table.name });
    setShowModal(true);
  };

  // --- UTILS ---
  const formatLiveTime = (startTime) => {
      if (!startTime) return "00:00:00";
      const diff = now - startTime;
      if (diff < 0) return "00:00:00";
      const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
  };

  const convertTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const handleConfirm = async () => {
    setError('');
    
    if (modalType === 'edit') {
      if (!formData.guestName.trim()) return;
      await supabase.from('tables').update({ name: formData.guestName }).eq('id', selectedTable.id);
      closeModal();
      fetchAllData();
      return;
    }

    if ((modalType === 'reserve' || modalType === 'waitlist') && !formData.guestName.trim()) {
      setError('Please enter a name');
      return;
    }
    
    // --- WALKIN / START SESSION LOGIC ---
    if (modalType === 'walkin') {
      if (!selectedTable) { setError("Please select a table."); return; }
      if (selectedTable.status === 'Occupied') { setError("Selected table is currently occupied."); return; }
      
      let occupiedUntilStr = '';
      let occupiedUntilRaw = null; 
      const sessionStartTime = new Date();

      if (formData.isOpenTime) {
        occupiedUntilStr = 'Open Time';
      } else {
        const endTime = new Date(sessionStartTime.getTime() + Number(formData.duration) * 60 * 60 * 1000);
        occupiedUntilStr = endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        occupiedUntilRaw = endTime;
      }

      // Logic: Only deduct fee if it was a SCHEDULED RESERVATION. Waitlist has no deposit.
      const deductionAmount = (startingReservationId && startingReservationType === 'Reservation') ? RESERVATION_FEE : 0;
      
      await supabase.from('tables').update({
        status: 'Occupied',
        occupied_until: occupiedUntilStr,
        occupied_until_raw: occupiedUntilRaw ? occupiedUntilRaw.toISOString() : null,
        session_type: 'walkin',
        duration: Number(formData.duration),
        is_open_time: formData.isOpenTime,
        current_guest: formData.guestName,
        deductible: deductionAmount,
        start_time: sessionStartTime.toISOString()
      }).eq('id', selectedTable.id);
      
      if (startingReservationId) {
        await supabase.from('reservations').delete().eq('id', startingReservationId);
      }
      
      closeModal();
      fetchAllData();
    } 
    
    // --- WAITLIST LOGIC (Immediate Queue) ---
    else if (modalType === 'waitlist') {
      if (waitlistItems.length >= WAITLIST_LIMIT) {
          setError(`Waitlist is full (${WAITLIST_LIMIT} max).`);
          return;
      }

      const newWaitlist = {
        table_name: formData.preferredTable || 'Any Table',
        guest_name: formData.guestName,
        raw_date: new Date().toISOString().split('T')[0], // Today
        raw_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // Now
        display_date: 'Today',
        display_time: 'Waiting',
        type: 'Waitlist',
        amount: 0 // NO DEPOSIT FOR WAITLIST
      };
      
      await supabase.from('reservations').insert([newWaitlist]);
      await addToHistory(newWaitlist, 'Joined Waitlist', 0);
      closeModal();
      fetchAllData();
    }

    // --- RESERVATION LOGIC (Future Scheduled) ---
    else if (modalType === 'reserve') {
        if (!formData.date || !formData.time) { setError('Select date and time'); return; }

        const newReservation = {
            table_name: selectedTable ? selectedTable.name : (formData.preferredTable || 'Any Table'),
            guest_name: formData.guestName,
            raw_date: formData.date,
            raw_time: formData.time,
            display_date: new Date(formData.date).toLocaleDateString(),
            display_time: convertTo12Hour(formData.time),
            type: 'Reservation',
            amount: RESERVATION_FEE
        };
        
        await supabase.from('reservations').insert([newReservation]);
        await addToHistory(newReservation, 'Scheduled Reservation', RESERVATION_FEE);
        closeModal();
        fetchAllData();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTable(null);
    setModalType(null);
    setError('');
    setStartingReservationId(null);
    setStartingReservationType(null);
  };

  const totalEarnings = useMemo(() => {
    return history.reduce((sum, item) => item.status === 'Completed' ? sum + item.amount : sum, 0);
  }, [history]);

  const theme = {
    bg: darkMode ? 'bg-[#0f172a]' : 'bg-[#f8fafc]',
    text: darkMode ? 'text-[#f1f5f9]' : 'text-[#0f172a]',
    textMuted: darkMode ? 'text-[#94a3b8]' : 'text-[#64748b]',
    sidebar: 'bg-[#1e293b] border-[#334155]', 
    card: darkMode ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200',
    input: darkMode ? 'bg-[#0f172a] border-[#334155] text-white' : 'bg-white border-slate-200 text-[#0f172a]',
    header: darkMode ? 'bg-[#1e293b]/50 border-[#334155]' : 'bg-white/80 border-slate-200',
    subCard: darkMode ? 'bg-[#0f172a] border-[#334155]' : 'bg-slate-50 border-slate-100',
    tableHeader: darkMode ? 'bg-[#0f172a] text-[#94a3b8]' : 'bg-slate-50 text-slate-500'
  };

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 transform 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0 
        ${theme.sidebar} shadow-xl print:hidden
      `}>
        <div className="pt-10 pb-8 px-8 flex items-center gap-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-300 to-pink-300 bg-clip-text text-transparent tracking-tighter">B&C</h1>
          <div className="w-[1px] h-10 bg-slate-500/50"></div>
          <div className="flex flex-col justify-center">
            <span className="text-white font-bold leading-none text-base">Club</span>
            <span className="text-white font-bold leading-none text-base">Manager</span>
          </div>
          <button className="md:hidden ml-auto text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-6 space-y-3 mt-4 overflow-y-auto">
          <button 
            onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg ${
              currentView === 'dashboard' 
                ? 'bg-[#7dd3fc] text-[#0f172a] hover:bg-[#38bdf8]' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-6 h-6" /> Dashboard
          </button>
          
          {isAuthenticated && (
            <>
              <button 
                onClick={() => { setCurrentView('management'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base ${
                  currentView === 'management' 
                    ? 'bg-[#F8D49B] text-[#0f172a] shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Armchair className="w-6 h-6" /> Tables
              </button>

              <button 
                onClick={() => { setCurrentView('earnings'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base ${
                  currentView === 'earnings' 
                    ? 'bg-[#F89B9B] text-[#0f172a] shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <DollarSign className="w-6 h-6" /> Earnings
              </button>

              <button 
                onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base ${
                  currentView === 'settings' 
                    ? 'bg-[#cbd5e1] text-[#0f172a] shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Settings className="w-6 h-6" /> Settings
              </button>
            </>
          )}
        </nav>

        <div className="p-8 mt-auto border-t border-slate-700/50">
          {isAuthenticated ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          ) : (
            <button 
              onClick={() => { setCurrentView('login'); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 text-sky-400 hover:text-sky-300 font-medium transition-colors group"
            >
              <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> Admin Login
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        <header className={`h-20 backdrop-blur-sm border-b flex items-center justify-between px-4 md:px-8 ${theme.header} print:hidden`}>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-700/10">
                <Menu className={`w-6 h-6 ${theme.text}`} />
             </button>
             <h2 className={`text-xl md:text-2xl font-bold ${theme.text}`}>
                {currentView === 'login' ? 'Authentication' : currentView.charAt(0).toUpperCase() + currentView.slice(1)}
             </h2>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
             {currentView === 'dashboard' && (
                <button 
                    onClick={handleJoinWaitlistClick}
                    className="flex items-center gap-2 px-4 py-2 bg-[#F8D49B] hover:bg-[#F8BC9B] text-[#0f172a] rounded-full text-xs md:text-sm font-bold shadow-md transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Join Waitlist
                </button>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0">
          
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-7xl mx-auto print:hidden">
              
              {/* TABLES SECTION */}
              <div className="xl:col-span-2 space-y-6">
                <div className="flex items-center justify-between mt-2">
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                    <div className="w-1.5 h-6 bg-[#75BDE0] rounded-full"></div>
                    Floor Plan
                  </h3>
                  <span className={`text-sm ${theme.textMuted}`}>{tables.filter(t => t.status === 'Available').length} available</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {tables.map(table => (
                    <div key={table.id} className={`${theme.card} rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden border`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner ${
                            table.status === 'Available' ? 'bg-[#75BDE0]/20 text-[#75BDE0]' : 'bg-[#F89B9B]/20 text-[#F89B9B]'
                          }`}>
                            {table.id}
                          </div>
                          <div>
                            <h4 className={`font-bold text-lg ${theme.text}`}>{table.name}</h4>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              table.status === 'Available' ? 'bg-[#75BDE0]/10 text-[#75BDE0]' : 'bg-[#F89B9B]/10 text-[#F89B9B]'
                            }`}>
                              {table.status}
                            </span>
                          </div>
                        </div>
                        {table.status === 'Occupied' && (
                          <div className="text-right">
                            <p className="text-xl font-black text-[#F89B9B] tabular-nums tracking-tight">
                                {formatLiveTime(table.startTime)}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted} flex items-center justify-end gap-1`}>
                                {table.occupiedUntil === 'Open Time' ? <Infinity className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                {table.occupiedUntil}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2">
                        {table.status === 'Available' ? (
                          <>
                            <button onClick={() => handleReserveClick(table)} className="flex-1 py-2.5 rounded-lg bg-[#75BDE0] hover:bg-[#64a9cc] text-white text-sm font-bold shadow-md shadow-[#75BDE0]/20 transition-all active:scale-95">Schedule</button>
                            {isAuthenticated && (
                              <button onClick={() => handleWalkInClick(table)} className="flex-1 py-2.5 rounded-lg bg-[#F8BC9B] hover:bg-[#e6ab8c] text-white text-sm font-bold shadow-md shadow-[#F8BC9B]/20 transition-all active:scale-95">Walk-In</button>
                            )}
                          </>
                        ) : (
                          <>
                            {isAuthenticated && (
                              <button 
                                onClick={() => handleFinishSession(table)}
                                className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${darkMode ? 'border-[#94a3b8]/20 text-[#94a3b8]' : 'border-slate-300 text-slate-500'} hover:border-[#F89B9B] hover:text-[#F89B9B] hover:bg-[#F89B9B]/10`}
                              >
                                Finish
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LISTS SECTION (SPLIT) */}
              <div className="xl:col-span-1 space-y-6">
                
                {/* 1. WAITLIST CONTAINER */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                      <div className="w-1.5 h-6 bg-[#F8D49B] rounded-full"></div>
                      Waiting List ({waitlistItems.length}/{WAITLIST_LIMIT})
                    </h3>
                  </div>

                  <div className={`${theme.card} rounded-3xl p-4 border min-h-[200px]`}>
                    {waitlistItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${darkMode ? 'bg-[#334155]' : 'bg-slate-100'}`}>
                          <List className={`w-6 h-6 ${theme.textMuted}`} />
                        </div>
                        <p className={`text-sm ${theme.textMuted}`}>No active waitlist.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {waitlistItems.map(res => (
                          <div key={res.id} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${theme.subCard} hover:border-[#F8D49B]/50`}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#F8D49B] flex items-center justify-center text-[#0f172a] font-bold text-xs">
                                {res.id}
                              </div>
                              <div>
                                <p className={`font-bold text-sm ${theme.text}`}>{res.guestName}</p>
                                <p className={`text-xs ${theme.textMuted}`}>Pref: {res.tableName}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                               {isAuthenticated && (
                                <div className="flex gap-1">
                                  <button onClick={() => handleStartReservation(res)} className="text-xs text-[#0f172a] font-bold bg-[#F8BC9B] px-2 py-1 rounded shadow-sm">Start</button>
                                  <button onClick={() => handleCancelReservation(res.id, 'Waitlist')} className="text-xs text-red-400 p-1"><X className="w-4 h-4"/></button>
                                </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. RESERVATIONS CONTAINER */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                      <div className="w-1.5 h-6 bg-[#75BDE0] rounded-full"></div>
                      Upcoming Reservations
                    </h3>
                  </div>

                  <div className={`${theme.card} rounded-3xl p-4 border min-h-[200px]`}>
                    {reservationItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${darkMode ? 'bg-[#334155]' : 'bg-slate-100'}`}>
                          <CalendarDays className={`w-6 h-6 ${theme.textMuted}`} />
                        </div>
                        <p className={`text-sm ${theme.textMuted}`}>No future bookings.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reservationItems.map(res => (
                          <div key={res.id} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${theme.subCard} hover:border-[#75BDE0]/50`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${darkMode ? 'bg-[#334155]' : 'bg-slate-200'} ${theme.text}`}>
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <p className={`font-bold text-sm ${theme.text}`}>{res.guestName}</p>
                                <p className={`text-xs ${theme.textMuted}`}>{res.displayDate} @ {res.displayTime}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                               <p className="text-xs font-bold text-[#75BDE0]">{res.tableName}</p>
                               {isAuthenticated && (
                                <div className="flex gap-1">
                                  <button onClick={() => handleStartReservation(res)} className="text-xs text-white font-bold bg-[#75BDE0] px-2 py-1 rounded shadow-sm">Start</button>
                                  <button onClick={() => handleCancelReservation(res.id, 'Reservation')} className="text-xs text-red-400 p-1"><X className="w-4 h-4"/></button>
                                </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
          
          {/* ... (Existing Login, Earnings, Management, Settings Views remain unchanged) ... */}
          {currentView === 'login' && (
            <div className="flex items-center justify-center h-full">
              <div className={`w-full max-w-md p-8 rounded-3xl shadow-2xl border ${theme.card} animate-in fade-in zoom-in-95`}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#75BDE0] to-[#F8BC9B] flex items-center justify-center text-[#0f172a] font-bold text-2xl shadow-lg mx-auto mb-4">B&C</div>
                  <h1 className={`text-2xl font-bold ${theme.text}`}>Admin Login</h1>
                  <p className={theme.textMuted}>Enter your credentials to continue</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-bold mb-2 ${theme.textMuted}`}>Username</label>
                    <div className={`flex items-center px-4 py-3 rounded-xl border ${theme.subCard}`}>
                      <User className="w-5 h-5 text-[#75BDE0] mr-3" />
                      <input 
                        type="text" 
                        value={loginInput.username}
                        onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
                        className={`bg-transparent border-none outline-none flex-1 text-sm font-medium ${theme.text}`}
                        placeholder="Enter username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-2 ${theme.textMuted}`}>Password</label>
                    <div className={`flex items-center px-4 py-3 rounded-xl border ${theme.subCard}`}>
                      <Lock className="w-5 h-5 text-[#F8BC9B] mr-3" />
                      <input 
                        type="password" 
                        value={loginInput.password}
                        onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
                        className={`bg-transparent border-none outline-none flex-1 text-sm font-medium ${theme.text}`}
                        placeholder="Enter password"
                      />
                    </div>
                  </div>
                  
                  {loginError && <p className="text-red-400 text-sm text-center font-bold">{loginError}</p>}
                  
                  <button type="submit" className="w-full py-4 bg-gradient-to-r from-[#75BDE0] to-[#F89B9B] rounded-xl text-[#0f172a] font-bold shadow-lg hover:shadow-xl hover:opacity-90 transition-all mt-4">
                    Sign In
                  </button>
                  <button type="button" onClick={() => setCurrentView('dashboard')} className={`w-full py-4 rounded-xl font-bold transition-all mt-2 ${theme.textMuted} hover:${theme.text}`}>
                    Back to Dashboard
                  </button>
                </form>
              </div>
            </div>
          )}

          {currentView === 'earnings' && isAuthenticated && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
                <div className={`${theme.card} p-6 rounded-3xl border flex items-center gap-4`}>
                  <div className="w-16 h-16 rounded-full bg-[#75BDE0]/20 flex items-center justify-center">
                    <DollarSign className="w-8 h-8 text-[#75BDE0]" />
                  </div>
                  <div>
                    <p className={theme.textMuted}>Total Revenue</p>
                    <h3 className={`text-3xl font-bold ${theme.text}`}>₱{totalEarnings.toLocaleString()}</h3>
                  </div>
                </div>
                {/* ... (Existing Earnings stats) */}
                <div className={`${theme.card} p-6 rounded-3xl border flex items-center gap-4`}>
                  <div className="w-16 h-16 rounded-full bg-[#F8BC9B]/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#F8BC9B]" />
                  </div>
                  <div>
                    <p className={theme.textMuted}>Completed Sessions</p>
                    <h3 className={`text-3xl font-bold ${theme.text}`}>{history.filter(h => h.status === 'Completed').length}</h3>
                  </div>
                </div>
                <div className={`${theme.card} p-6 rounded-3xl border flex items-center gap-4`}>
                    <div className="w-16 h-16 rounded-full bg-[#F89B9B]/20 flex items-center justify-center">
                    <Users className="w-8 h-8 text-[#F89B9B]" />
                    </div>
                    <div>
                    <p className={theme.textMuted}>Total Waitlist</p>
                    <h3 className={`text-3xl font-bold ${theme.text}`}>{history.filter(h => h.type === 'Waitlist').length}</h3>
                    </div>
                </div>
              </div>

              <div className={`${theme.card} rounded-3xl p-8 border print:border-none print:p-0 print:shadow-none`}>
                <div className="flex items-center justify-between mb-6 print:mb-4">
                  <h3 className={`text-xl font-bold ${theme.text}`}>Recent Transactions</h3>
                  <div className="flex items-center gap-4 print:hidden">
                    <div className="text-red-400 text-xs font-bold flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded">
                      <AlertCircle className="w-3 h-3" /> Warning: Deletion is permanent
                    </div>
                    <button 
                      onClick={handleClearHistory} 
                      className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Clear All
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className={`${theme.tableHeader} border-b ${darkMode ? 'border-[#334155]' : 'border-slate-200'}`}>
                      <tr>
                        <th className="pb-4 pl-4">Type</th>
                        <th className="pb-4">Guest</th>
                        <th className="pb-4">Details</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 pr-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/20">
                      {history.length === 0 ? (
                        <tr><td colSpan="5" className={`py-8 text-center ${theme.textMuted}`}>No transaction history yet.</td></tr>
                      ) : history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-500/5">
                          <td className="py-4 pl-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.type === 'Waitlist' ? 'bg-[#75BDE0]/10 text-[#75BDE0]' : 'bg-[#F8BC9B]/10 text-[#F8BC9B]'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className={`py-4 ${theme.text}`}>{item.guestName}</td>
                          <td className={`py-4 ${theme.textMuted}`}>{item.tableName} • {item.date}</td>
                          <td className="py-4">
                            <span className={`text-xs font-bold ${
                              item.status === 'Completed' ? 'text-emerald-400' : 
                              item.status === 'Canceled' ? 'text-red-400' : 'text-[#75BDE0]'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className={`py-4 pr-4 text-right font-bold ${theme.text}`}>₱{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'management' && isAuthenticated && (
            <div className={`max-w-4xl mx-auto rounded-3xl p-8 border ${theme.card}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-2xl font-bold ${theme.text}`}>Table Management</h3>
                <button onClick={() => setCurrentView('dashboard')} className="text-[#75BDE0] hover:underline">Back to Dashboard</button>
              </div>
              
              <div className={`p-6 rounded-2xl border mb-8 ${theme.subCard}`}>
                <label className={`block text-sm font-bold mb-3 ${theme.textMuted}`}>Add New Table</label>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Enter table name"
                    className={`flex-1 rounded-xl px-4 focus:border-[#75BDE0] outline-none ${theme.input}`}
                  />
                  <button onClick={handleAddTable} className="bg-[#75BDE0] hover:bg-[#64a9cc] text-[#0f172a] font-bold px-6 rounded-xl transition-colors">Add</button>
                </div>
              </div>

              <div className="space-y-3">
                {tables.map(table => (
                  <div key={table.id} className={`flex items-center justify-between p-4 rounded-xl border ${theme.subCard}`}>
                    <span className={`font-bold ${theme.text}`}>{table.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(table)} className="p-2 text-[#75BDE0] hover:bg-[#75BDE0]/10 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTable(table.id)} className="p-2 text-[#F89B9B] hover:bg-[#F89B9B]/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'settings' && isAuthenticated && (
            <div className={`max-w-4xl mx-auto rounded-3xl p-8 border ${theme.card}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-2xl font-bold ${theme.text}`}>System Settings</h3>
                <button onClick={() => setCurrentView('dashboard')} className="text-[#75BDE0] hover:underline">Back to Dashboard</button>
              </div>
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl border ${theme.subCard}`}>
                  <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme.text}`}>
                    <Tag className="w-5 h-5 text-[#F89B9B]" /> Pricing Configuration
                  </h4>
                  <div className="max-w-md">
                    <p className={`text-xs mb-3 ${theme.textMuted}`}>Base rate applies after 1 hour.</p>
                    <label className={`block text-sm font-bold mb-2 ${theme.textMuted}`}>Hourly Rate (PHP)</label>
                    <div className="flex gap-4">
                      <input 
                        type="number"
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(e.target.value)}
                        className={`flex-1 p-3 rounded-xl border outline-none ${theme.input}`}
                      />
                      <button 
                        onClick={handleUpdateRate}
                        className="px-6 bg-[#F89B9B] text-[#0f172a] font-bold rounded-xl shadow-lg hover:opacity-90 transition-all"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${theme.subCard}`}>
                  <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme.text}`}>
                    <Key className="w-5 h-5 text-[#F8BC9B]" /> Change Password
                  </h4>
                   <div className="space-y-4 max-w-md">
                    <input 
                      type="password"
                      placeholder="Current Password" 
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                      className={`w-full p-3 rounded-xl border outline-none ${theme.input}`}
                    />
                    <input 
                      type="password"
                      placeholder="New Password" 
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                      className={`w-full p-3 rounded-xl border outline-none ${theme.input}`}
                    />
                    <input 
                      type="password"
                      placeholder="Confirm New Password" 
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      className={`w-full p-3 rounded-xl border outline-none ${theme.input}`}
                    />
                    {passwordMsg.text && (
                      <p className={`text-sm font-bold ${passwordMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {passwordMsg.text}
                      </p>
                    )}
                    <button 
                      onClick={handleChangePassword}
                      className="px-6 py-2 bg-[#75BDE0] text-[#0f172a] font-bold rounded-xl shadow-lg hover:opacity-90 transition-all"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
                 
                 <div className={`p-6 rounded-2xl border ${theme.subCard}`}>
                  <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme.text}`}>
                    <Monitor className="w-5 h-5 text-[#F8BC9B]" /> Appearance
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-bold ${theme.text}`}>Theme Preference</p>
                      <p className={`text-sm ${theme.textMuted}`}>Switch between light and dark mode</p>
                    </div>
                    <button 
                      onClick={() => setDarkMode(!darkMode)}
                      className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${darkMode ? 'bg-[#75BDE0]' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${darkMode ? 'translate-x-8' : 'translate-x-0'}`}>
                        {darkMode ? <Moon className="w-3 h-3 text-[#75BDE0]" /> : <Sun className="w-3 h-3 text-orange-400" />}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className={`p-6 ${modalType === 'walkin' ? 'bg-[#F8BC9B]' : 'bg-[#75BDE0]'} text-[#0f172a]`}>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-2xl font-black">
                  {modalType === 'walkin' ? 'Walk-In Session' : modalType === 'waitlist' ? 'Join Waitlist' : modalType === 'reserve' ? 'Schedule Reservation' : 'Edit Table'}
                </h3>
                <button onClick={closeModal} className="p-1 bg-black/10 rounded-full hover:bg-black/20"><X className="w-5 h-5"/></button>
              </div>
              <p className="font-medium opacity-80">{selectedTable ? selectedTable.name : 'Waitlist Entry'}</p>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  {modalType === 'edit' ? 'New Name' : 'Guest Name'}
                </label>
                <input 
                  autoFocus
                  type="text" 
                  value={formData.guestName}
                  onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#75BDE0] outline-none"
                />
              </div>

              {/* TABLE ASSIGNMENT DROPDOWN (For Walkin/Manual Start) */}
              {modalType === 'walkin' && (
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Select Table</label>
                    <select 
                        value={selectedTable?.id || ''}
                        onChange={(e) => {
                            const t = tables.find(tb => tb.id === parseInt(e.target.value));
                            setSelectedTable(t);
                        }}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#F8BC9B] outline-none"
                    >
                        <option value="" disabled>Select a table</option>
                        {tables.map(t => (
                            <option key={t.id} value={t.id} disabled={t.status === 'Occupied'}>
                                {t.name} {t.status === 'Occupied' ? '(Occupied)' : ''}
                            </option>
                        ))}
                    </select>
                 </div>
              )}

              {/* SHARED: PREFERRED TABLE FOR WAITLIST & RESERVE */}
              {(modalType === 'waitlist' || modalType === 'reserve') && (
                  <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Preferred Table</label>
                     <select 
                        value={formData.preferredTable}
                        onChange={(e) => setFormData({...formData, preferredTable: e.target.value})}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#75BDE0] outline-none"
                     >
                        <option value="Any Table">Any Table</option>
                        {tables.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                     </select>
                     <p className="text-[10px] text-red-500 font-bold mt-1 italic">* Note: Table preparation may take 5 minutes.</p>
                  </div>
              )}

              {/* SPECIFIC: RESERVE (DATE/TIME) */}
              {modalType === 'reserve' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date</label>
                    <input 
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#75BDE0] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Time</label>
                    <input 
                      type="time" 
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#75BDE0] outline-none"
                    />
                  </div>
                </div>
              )}

              {modalType === 'walkin' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Duration</label>
                  <div className={`relative transition-all ${formData.isOpenTime ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                      type="number" 
                      value={formData.duration}
                      onChange={(e) => setFormData({...formData, duration: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#F8BC9B] outline-none pl-4 pr-20"
                    />
                    <span className="absolute right-10 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">Hrs</span>
                  </div>
                  
                  <button 
                    onClick={() => setFormData({...formData, isOpenTime: !formData.isOpenTime})}
                    className={`mt-3 w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                      formData.isOpenTime 
                        ? 'border-[#F8BC9B] bg-[#F8BC9B]/10 text-[#F8BC9B]' 
                        : 'border-slate-100 text-slate-400 hover:border-[#F8BC9B]'
                    }`}
                  >
                    <Infinity className="w-5 h-5" />
                    {formData.isOpenTime ? 'Open Time Active' : 'Switch to Open Time'}
                  </button>

                  <div className="mt-4 p-3 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold">
                    <div className="flex justify-between items-center mb-1">
                         <span>Pricing Rates:</span>
                    </div>
                    <div className="flex justify-between opacity-80">
                         <span>5 mins: ₱15</span>
                         <span>30 mins: ₱50</span>
                         <span>1 hr: ₱100</span>
                    </div>
                    {/* Only show deposit deduction if it was a SCHEDULED RESERVATION */}
                    {(startingReservationId && startingReservationType === 'Reservation') && (
                      <div className="mt-2 text-green-600 bg-green-100 px-2 py-1 rounded w-fit">
                        -₱{RESERVATION_FEE} (Deposit)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4"/> {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={closeModal} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                <button 
                  onClick={handleConfirm}
                  className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${
                    modalType === 'walkin' ? 'bg-[#F8BC9B] hover:bg-[#e6ab8c]' : 'bg-[#75BDE0] hover:bg-[#64a9cc]'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
