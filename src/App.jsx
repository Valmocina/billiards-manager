import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase'; 
import { 
  Clock, Calendar, X, Trash2, Edit2, Plus, 
  ArrowLeft, Info, AlertCircle, Infinity, User, 
  LayoutDashboard, Armchair, Settings, LogOut, 
  Search, Bell, Moon, Sun, Monitor, DollarSign,
  CheckCircle, History, TrendingUp, Receipt, Play,
  Lock, Key, LogIn, Tag, Printer, Menu, Timer,
  ListPlus, Users
} from 'lucide-react';

const App = () => {
  // --- CONSTANTS ---
  const RESERVATION_FEE = 50;
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
  const [hourlyRate, setHourlyRate] = useState(100); 
  
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [darkMode, setDarkMode] = useState(true);
  const [startingReservationId, setStartingReservationId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Timer State
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

  // --- DERIVED STATE ---
  const waitlistQueue = useMemo(() => 
    reservations.filter(r => r.type === 'Waitlist'), 
  [reservations]);

  const scheduledReservations = useMemo(() => 
    reservations.filter(r => r.type === 'Reservation'), 
  [reservations]);

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

  // --- LIVE TIMER LOGIC ---
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = (startTime) => {
    if (!startTime) return '00:00:00';
    const diff = now - new Date(startTime);
    if (diff < 0) return '00:00:00';
    
    const seconds = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
    const minutes = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
    const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  };

  // --- AUTO-START RESERVATIONS LOGIC ---
  useEffect(() => {
    const checkAutoStart = async () => {
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeVal = now.getHours() * 60 + now.getMinutes();

      for (const res of reservations) {
        if (res.type === 'Waitlist') continue;

        if (res.rawDate === todayStr) {
          const [h, m] = res.rawTime.split(':').map(Number);
          const resTimeVal = h * 60 + m;

          if (currentTimeVal >= resTimeVal && (currentTimeVal - resTimeVal) < 15) {
            const table = tables.find(t => t.name === res.tableName);
            if (table && table.status === 'Available') {
              const sessionStartTime = new Date();
              await supabase.from('tables').update({
                status: 'Occupied',
                occupied_until: 'Open Time',
                occupied_until_raw: null,
                session_type: 'walkin',
                duration: 0,
                is_open_time: true,
                current_guest: res.guestName,
                deductible: RESERVATION_FEE,
                start_time: sessionStartTime.toISOString()
              }).eq('id', table.id);

              await supabase.from('reservations').delete().eq('id', res.id);
              fetchAllData();
            }
          }
        }
      }
    };
    const interval = setInterval(checkAutoStart, 5000);
    return () => clearInterval(interval);
  }, [reservations, tables, now]);

  // --- PRICING LOGIC ---
  const calculateSessionCost = (startTime) => {
    if (!startTime) return 0;
    
    const diffMs = new Date() - new Date(startTime);
    const totalMinutes = Math.ceil(diffMs / (1000 * 60)); 
    
    const hours = Math.floor(totalMinutes / 60);
    const remainder = totalMinutes % 60;
    
    let remainderCost = 0;
    
    if (remainder > 0) {
      if (remainder <= 5) remainderCost = 15;
      else if (remainder <= 10) remainderCost = 20;
      else if (remainder <= 15) remainderCost = 25;
      else if (remainder <= 20) remainderCost = 30;
      else if (remainder <= 25) remainderCost = 40;
      else if (remainder <= 30) remainderCost = 50;
      else if (remainder <= 35) remainderCost = 60;
      else if (remainder <= 40) remainderCost = 70;
      else if (remainder <= 45) remainderCost = 75;
      else if (remainder <= 50) remainderCost = 80;
      else if (remainder <= 55) remainderCost = 90;
      else remainderCost = 100;
    }

    return (hours * 100) + remainderCost;
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

  const handleNavClick = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  }

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
    if (window.confirm("CRITICAL WARNING: This will permanently delete ALL transaction history. This action cannot be undone. Are you sure?")) {
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
    setFormData({
      guestName: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      duration: 1,
      isOpenTime: false,
      preferredTable: 'Any Table'
    });
    setError('');
    setStartingReservationId(null);
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

  const handleWalkInClick = (table) => {
    setSelectedTable(table);
    setModalType('walkin');
    resetForm();
    setShowModal(true);
  };

  const handleReserveClick = (table) => {
    setSelectedTable(table);
    setModalType('reserve');
    resetForm();
    setShowModal(true);
  };

  const handleWaitlistClick = () => {
    if (waitlistQueue.length >= WAITLIST_LIMIT) {
      alert("The waitlist is full (Max 10). Please wait for a spot to clear.");
      return;
    }
    setModalType('waitlist');
    resetForm();
    setShowModal(true);
  };

  const handleStartReservation = (res) => {
    // If it is a Waitlist item (Any Table OR Specific Preference)
    // Always open assignment modal to allow flexibility
    if (res.type === 'Waitlist') {
      setStartingReservationId(res.id);
      setFormData({
        ...formData,
        guestName: res.guestName,
        duration: 1,
        isOpenTime: true
      });
      setModalType('assign'); 
      setShowModal(true);
      return;
    }
    
    // Logic for specific scheduled reservations
    const table = tables.find(t => t.name === res.tableName);
    if (!table) return;

    if (table.status === 'Occupied') {
      alert(`Cannot start reservation. ${table.name} is currently occupied.`);
      return;
    }

    setSelectedTable(table);
    setModalType('walkin');
    setFormData({
      guestName: res.guestName,
      date: new Date().toISOString().split('T')[0],
      time: '',
      duration: 1,
      isOpenTime: true 
    });
    setStartingReservationId(res.id); 
    setShowModal(true);
  };

  const handleFinishSession = async (table) => {
    let cost = 0;
    
    if (table.sessionType === 'walkin') {
       if (table.isOpenTime && table.startTime) {
         cost = calculateSessionCost(table.startTime);
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

  const handleCancelReservation = async (id) => {
    const res = reservations.find(r => r.id === id);
    if (res) {
      await addToHistory({ ...res, type: 'Reservation' }, 'Canceled', 0);
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

  const getNextTodayReservation = (table) => {
    if (!table) return null;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todaysReservations = reservations
      .filter(r => r.tableName === table.name && r.rawDate === todayStr)
      .map(res => {
        const [h, m] = res.rawTime.split(':').map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);
        return { ...res, startObj: start };
      })
      .filter(res => res.startObj > now)
      .sort((a, b) => a.startObj - b.startObj);
    return todaysReservations.length > 0 ? todaysReservations[0] : null;
  };

  const formatDuration = (diffMs) => {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0 && minutes > 0) return `${hours}H ${minutes}M`;
    if (hours > 0) return `${hours}H`;
    return `${minutes}M`;
  };

  const checkWalkInConflict = (table, durationHours, isOpenTime) => {
    const now = new Date();
    const nextRes = getNextTodayReservation(table);

    if (isOpenTime) {
      if (nextRes) {
        const diffMs = nextRes.startObj - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 1) return `Less than 1 hour (${formatDuration(diffMs)}) available before reservation.`;
        return null; 
      }
      return null;
    }

    const walkInEnd = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const todaysReservations = reservations.filter(r => r.tableName === table.name && r.rawDate === todayStr);
    
    for (const res of todaysReservations) {
      const [h, m] = res.rawTime.split(':').map(Number);
      const resStart = new Date(now);
      resStart.setHours(h, m, 0, 0);
      if (walkInEnd > resStart && resStart > now) {
         return `Conflict! Only ${formatDuration(resStart - now)} available.`;
      }
    }
    return null;
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

    if (modalType === 'waitlist') {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const newReservation = {
        table_name: formData.preferredTable, // Use the selected preferred table
        guest_name: formData.guestName,
        raw_date: now.toISOString().split('T')[0],
        raw_time: timeStr,
        display_date: now.toLocaleDateString(),
        display_time: convertTo12Hour(timeStr),
        type: 'Waitlist',
        amount: 0 
      };
      
      await supabase.from('reservations').insert([newReservation]);
      closeModal();
      fetchAllData();
      return;
    }
    
    if (modalType === 'walkin') {
      const conflictMsg = checkWalkInConflict(selectedTable, Number(formData.duration), formData.isOpenTime);
      if (conflictMsg) { setError(conflictMsg); return; }
      
      let occupiedUntilStr = '';
      let occupiedUntilRaw = null; 

      const sessionStartTime = new Date();

      if (formData.isOpenTime) {
        const nextRes = getNextTodayReservation(selectedTable);
        occupiedUntilStr = nextRes ? convertTo12Hour(nextRes.rawTime) : 'Open Time';
        occupiedUntilRaw = nextRes ? nextRes.startObj : null; 
      } else {
        const endTime = new Date(sessionStartTime.getTime() + Number(formData.duration) * 60 * 60 * 1000);
        occupiedUntilStr = endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        occupiedUntilRaw = endTime;
      }

      const deductionAmount = startingReservationId ? RESERVATION_FEE : 0;
      
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
    else if (modalType === 'reserve') {
      if (!formData.date || !formData.time) { setError('Select date and time'); return; }
      
      if (selectedTable.status === 'Occupied' && selectedTable.occupiedUntilRaw) {
        const reservationStart = new Date(`${formData.date}T${formData.time}`);
        const isToday = new Date().toDateString() === new Date(formData.date).toDateString();
        
        if (isToday && reservationStart < selectedTable.occupiedUntilRaw) {
          setError(`Conflict! Table is occupied until ${selectedTable.occupiedUntil}.`);
          return;
        }
      }

      const isTimeTaken = reservations.some(r => 
        r.tableName === selectedTable.name && 
        r.rawDate === formData.date && 
        r.rawTime === formData.time
      );

      if (isTimeTaken) {
        setError(`Time slot ${convertTo12Hour(formData.time)} is already reserved.`);
        return;
      }

      const newResTime = new Date(`${formData.date}T${formData.time}`);
      const conflictReservation = reservations.find(r => {
        if (r.tableName !== selectedTable.name || r.rawDate !== formData.date) return false;
        const existingResTime = new Date(`${r.rawDate}T${r.rawTime}`);
        const diffInMs = Math.abs(newResTime - existingResTime);
        return (diffInMs / (1000 * 60)) < 60;
      });

      if (conflictReservation) {
        setError(`Conflict! Too close to reservation at ${conflictReservation.displayTime}. Must be 1 hour apart.`);
        return;
      }

      const newReservation = {
        table_name: selectedTable.name,
        guest_name: formData.guestName,
        raw_date: formData.date,
        raw_time: formData.time,
        display_date: new Date(formData.date).toLocaleDateString(),
        display_time: convertTo12Hour(formData.time),
        type: 'Reservation',
        amount: RESERVATION_FEE
      };
      
      await supabase.from('reservations').insert([newReservation]);
      await addToHistory(newReservation, 'Reserved', RESERVATION_FEE);
      closeModal();
      fetchAllData();
    }
  };

  const handleOpenTimeToggle = () => {
    if (!formData.isOpenTime) {
      const nextRes = getNextTodayReservation(selectedTable);
      if (nextRes) {
        const diffHours = (nextRes.startObj - new Date()) / (1000 * 60 * 60);
        if (diffHours < 1) {
          setError(`Only ${formatDuration(nextRes.startObj - new Date())} available.`);
          return;
        }
      }
    }
    setError('');
    setFormData({...formData, isOpenTime: !formData.isOpenTime});
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTable(null);
    setModalType(null);
    setError('');
    setStartingReservationId(null);
  };

  const totalEarnings = useMemo(() => {
    return history.reduce((sum, item) => item.status !== 'Canceled' ? sum + item.amount : sum, 0);
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
      
      {/* --- MOBILE OVERLAY --- */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 flex flex-col 
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${theme.sidebar} shadow-xl print:hidden
      `}>
        <div className="pt-10 pb-8 px-8 flex items-center gap-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-300 to-pink-300 bg-clip-text text-transparent tracking-tighter">B&C</h1>
          <div className="w-[1px] h-10 bg-slate-500/50"></div>
          <div className="flex flex-col justify-center">
            <span className="text-white font-bold leading-none text-base">Club</span>
            <span className="text-white font-bold leading-none text-base">Manager</span>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-3 mt-4">
          <button 
            onClick={() => handleNavClick('dashboard')}
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
                onClick={() => handleNavClick('management')}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base ${
                  currentView === 'management' 
                    ? 'bg-[#F8D49B] text-[#0f172a] shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Armchair className="w-6 h-6" /> Tables
              </button>

              <button 
                onClick={() => handleNavClick('earnings')}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold text-base ${
                  currentView === 'earnings' 
                    ? 'bg-[#F89B9B] text-[#0f172a] shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <DollarSign className="w-6 h-6" /> Earnings
              </button>

              <button 
                onClick={() => handleNavClick('settings')}
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

      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        
        {/* --- HEADER --- */}
        <header className={`h-16 md:h-20 backdrop-blur-sm border-b flex items-center justify-between px-4 md:px-8 ${theme.header} print:hidden`}>
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 md:hidden rounded-lg hover:bg-black/10 transition-colors"
            >
              <Menu className={`w-6 h-6 ${theme.text}`} />
            </button>
            
            <h2 className={`text-xl md:text-2xl font-bold ${theme.text}`}>
              {currentView === 'login' ? 'Authentication' : currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden sm:block">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.textMuted}`} />
              <input 
                type="text" 
                placeholder="Search..." 
                className={`${theme.input} text-sm rounded-full pl-10 pr-4 py-2 focus:outline-none focus:border-[#75BDE0] w-48 md:w-64 transition-colors`}
              />
            </div>
          </div>
        </header>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0">
          
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-7xl mx-auto print:hidden">
              <div className="xl:col-span-2 space-y-6">
                <div className="text-center mb-6 xl:text-left xl:mb-0">
                  <p className={`${theme.textMuted} text-lg`}>Reserve your table for the perfect game</p>
                </div>

                <div className="flex items-center justify-between mt-4 md:mt-8">
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                    <div className="w-1.5 h-6 bg-[#75BDE0] rounded-full"></div>
                    Available Tables
                  </h3>
                  <span className={`text-sm ${theme.textMuted}`}>{tables.filter(t => t.status === 'Available').length} available now</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
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
                            {/* LIVE TIMER */}
                            <div className="mb-1">
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>Time Elapsed</p>
                                <p className="text-lg font-bold font-mono text-[#75BDE0] flex items-center justify-end gap-1">
                                    <Timer className="w-4 h-4 text-[#75BDE0]" />
                                    {getElapsedTime(table.startTime)}
                                </p>
                            </div>
                            
                            {/* Occupied Until */}
                            <div className="opacity-75">
                                <p className="text-xs font-bold text-[#F89B9B] flex items-center justify-end gap-1">
                                    {table.occupiedUntil === 'Open Time' ? <Infinity className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                    {table.occupiedUntil}
                                </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2">
                        {table.status === 'Available' ? (
                          <>
                            <button onClick={() => handleReserveClick(table)} className="flex-1 py-2.5 rounded-lg bg-[#75BDE0] hover:bg-[#64a9cc] text-white text-sm font-bold shadow-md shadow-[#75BDE0]/20 transition-all active:scale-95">Reserve</button>
                            {isAuthenticated && (
                              <button onClick={() => handleWalkInClick(table)} className="flex-1 py-2.5 rounded-lg bg-[#F8BC9B] hover:bg-[#e6ab8c] text-white text-sm font-bold shadow-md shadow-[#F8BC9B]/20 transition-all active:scale-95">Walk-In</button>
                            )}
                          </>
                        ) : (
                          <>
                            {table.occupiedUntil !== 'Open Time' && (
                               <button 
                                 onClick={() => handleReserveClick(table)}
                                 className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${darkMode ? 'border-[#75BDE0]/50 text-[#75BDE0]' : 'border-slate-300 text-slate-500'} hover:bg-[#75BDE0]/10`}
                               >
                                 Reserve
                               </button>
                            )}
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

              {/* RIGHT COLUMN - SPLIT CONTAINERS */}
              <div className="xl:col-span-1 space-y-6">
                
                {/* CONTAINER 1: WAITLIST */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                      <div className="w-1.5 h-6 bg-[#F8D49B] rounded-full"></div>
                      Waitlist
                    </h3>
                    
                    {/* ADD TO WAITLIST BUTTON - PUBLICLY ACCESSIBLE */}
                    <button 
                      onClick={handleWaitlistClick}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F8D49B] hover:bg-[#e6c48f] text-[#0f172a] text-sm font-bold shadow-md transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Join Waitlist
                    </button>
                  </div>

                  <div className={`${theme.card} rounded-3xl p-6 border min-h-[200px]`}>
                    {waitlistQueue.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${darkMode ? 'bg-[#334155]' : 'bg-slate-100'}`}>
                          <Users className={`w-6 h-6 ${theme.textMuted}`} />
                        </div>
                        <p className={`text-sm ${theme.textMuted}`}>Queue is empty.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {waitlistQueue.map((res, index) => (
                          <div key={res.id} className={`flex items-center justify-between p-3 rounded-xl border ${theme.subCard}`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-lg font-bold ${theme.textMuted} w-6`}>#{index + 1}</span>
                              <div>
                                <p className={`font-bold ${theme.text}`}>{res.guestName}</p>
                                <p className={`text-xs ${theme.textMuted}`}>
                                  {res.tableName === 'Any Table' ? (
                                    <span className="text-[#F8D49B] font-bold">Any Table</span>
                                  ) : (
                                    <span><span className="text-[#F8D49B] font-bold">{res.tableName}</span> • {res.displayTime}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {isAuthenticated && (
                              <div className="flex gap-2">
                                <button onClick={() => handleStartReservation(res)} className="p-2 bg-[#75BDE0]/20 text-[#75BDE0] hover:bg-[#75BDE0]/40 rounded-lg"><Play className="w-3 h-3" /></button>
                                <button onClick={() => handleCancelReservation(res.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg"><X className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTAINER 2: UPCOMING RESERVATIONS */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
                      <div className="w-1.5 h-6 bg-[#F89B9B] rounded-full"></div>
                      Reservations
                    </h3>
                  </div>

                  <div className={`${theme.card} rounded-3xl p-6 border min-h-[200px]`}>
                    {scheduledReservations.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${darkMode ? 'bg-[#334155]' : 'bg-slate-100'}`}>
                          <Calendar className={`w-6 h-6 ${theme.textMuted}`} />
                        </div>
                        <p className={`text-sm ${theme.textMuted}`}>No upcoming bookings.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {scheduledReservations.map(res => (
                          <div key={res.id} className={`flex items-center justify-between p-3 rounded-xl border ${theme.subCard}`}>
                            <div>
                              <p className={`font-bold ${theme.text}`}>{res.guestName}</p>
                              <p className={`text-xs ${theme.textMuted}`}>{res.tableName} • {res.displayTime}</p>
                            </div>
                            {isAuthenticated && (
                              <div className="flex gap-2">
                                <button onClick={() => handleStartReservation(res)} className="p-2 bg-[#F89B9B]/20 text-[#F89B9B] hover:bg-[#F89B9B]/40 rounded-lg"><Play className="w-3 h-3" /></button>
                                <button onClick={() => handleCancelReservation(res.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg"><X className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className={`p-6 ${modalType === 'walkin' ? 'bg-[#F8BC9B]' : 'bg-[#75BDE0]'} text-[#0f172a]`}>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-2xl font-black">
                  {modalType === 'walkin' ? 'Walk-In Session' : modalType === 'reserve' ? 'New Reservation' : modalType === 'waitlist' ? 'Join Waitlist' : modalType === 'assign' ? 'Assign Table' : 'Edit Table'}
                </h3>
                <button onClick={closeModal} className="p-1 bg-black/10 rounded-full hover:bg-black/20"><X className="w-5 h-5"/></button>
              </div>
              <p className="font-medium opacity-80">{modalType === 'waitlist' ? 'Add guest to queue' : modalType === 'assign' ? `Guest: ${formData.guestName}` : selectedTable?.name}</p>
            </div>
            
            <div className="p-6 space-y-5">
              
              {modalType === 'assign' && (() => {
                const res = reservations.find(r => r.id === startingReservationId);
                const preference = res?.tableName || 'Any Table';
                
                return (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Assign <strong>{formData.guestName}</strong> to a table.
                    {preference !== 'Any Table' && <span className="block text-xs text-[#F8D49B] font-bold mt-1">Prefers: {preference}</span>}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {tables.filter(t => t.status === 'Available').length === 0 ? (
                      <p className="col-span-2 text-center text-red-400 font-bold py-4">No tables available.</p>
                    ) : (
                      tables.filter(t => t.status === 'Available').map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSelectedTable(t);
                            setModalType('walkin');
                            setFormData(prev => ({
                              ...prev,
                              date: new Date().toISOString().split('T')[0],
                              time: '',
                              duration: 1,
                              isOpenTime: true
                            }));
                          }}
                          className="p-4 rounded-xl border-2 border-slate-100 hover:border-[#75BDE0] hover:bg-[#75BDE0]/10 transition-all font-bold text-[#0f172a]"
                        >
                          {t.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                );
              })()}

              {modalType !== 'assign' && (
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
              )}

              {modalType === 'waitlist' && (
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Preferred Table</label>
                   <div className="relative">
                     <select 
                       value={formData.preferredTable}
                       onChange={(e) => setFormData({...formData, preferredTable: e.target.value})}
                       className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-[#0f172a] focus:border-[#75BDE0] outline-none appearance-none"
                     >
                       <option value="Any Table">Any Table</option>
                       {tables.map(t => (
                         <option key={t.id} value={t.name}>{t.name}</option>
                       ))}
                     </select>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                       <ArrowLeft className="w-4 h-4 -rotate-90" />
                     </div>
                   </div>
                </div>
              )}

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
                  <div className="col-span-2 p-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex justify-between">
                    <span>Reservation Fee:</span>
                    <span>₱{RESERVATION_FEE}</span>
                  </div>
                  {/* Reservation Note */}
                  <div className="col-span-2 mt-2 p-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>Note: There will be at least a 5-minute table preparation time before your session starts.</p>
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
                    onClick={handleOpenTimeToggle}
                    className={`mt-3 w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                      formData.isOpenTime 
                        ? 'border-[#F8BC9B] bg-[#F8BC9B]/10 text-[#F8BC9B]' 
                        : 'border-slate-100 text-slate-400 hover:border-[#F8BC9B]'
                    }`}
                  >
                    <Infinity className="w-5 h-5" />
                    {formData.isOpenTime ? 'Open Time Active' : 'Switch to Open Time'}
                  </button>

                  <div className="mt-4 p-3 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold flex justify-between items-center">
                    <div>
                      <span>Hourly Rate:</span>
                      <span className="ml-2">₱{hourlyRate}/hr</span>
                    </div>
                    {startingReservationId && (
                      <span className="text-green-600 bg-green-100 px-2 py-1 rounded">
                        -₱{RESERVATION_FEE} (Rsrv)
                      </span>
                    )}
                  </div>
                  
                  {modalType === 'walkin' && (() => {
                      const nextRes = getNextTodayReservation(selectedTable);
                      if (nextRes) {
                        const now = new Date();
                        const diffMs = nextRes.startObj - now;
                        return (
                          <div className="mt-3 p-3 bg-[#75BDE0]/20 border border-[#75BDE0] rounded-xl text-xs text-[#0f172a]">
                            <p className="font-bold flex items-center gap-1"><Info className="w-3 h-3"/> Upcoming Reservation</p>
                            <p>Next reservation is at <strong>{convertTo12Hour(nextRes.rawTime)}</strong>.</p>
                            <p>You have <strong>{formatDuration(diffMs)}</strong> available to play.</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4"/> {error}
                </div>
              )}

              {modalType !== 'assign' && (
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
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
