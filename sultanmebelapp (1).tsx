import React, { useState, useEffect } from 'react';
import { 
  Armchair, 
  CheckCircle, 
  Phone, 
  Lock, 
  LogOut, 
  Plus, 
  Trash2, 
  ImageIcon, 
  Edit2,
  Info,
  Clock,
  Key
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  getDoc 
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sultan-mebel-app';

const STATUS_OPTIONS = [
  'Ожидает',
  'Чертеж',
  'Распил',
  'Кромка',
  'Присадка',
  'Упаковка',
  'Доставка',
  'Установка',
  'Готово'
];

const DEFAULT_PIN = '1234';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80';

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [view, setView] = useState('login'); // 'login', 'client', 'admin'
  const [loginMode, setLoginMode] = useState('client'); // 'client' or 'admin'
  
  const [phoneInput, setPhoneInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [clientPhone, setClientPhone] = useState('');
  const [orders, setOrders] = useState([]);
  const [adminPin, setAdminPin] = useState(DEFAULT_PIN);
  
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPinForm, setNewPinForm] = useState({ current: '', next: '', confirm: '' });
  const [pinChangeMsg, setPinChangeMsg] = useState({ type: '', text: '' });

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [formData, setFormData] = useState({
    phone: '',
    title: '',
    description: '',
    imageUrl: '',
    status: 'Ожидает'
  });

  // 1. Authentication Effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching Effect (Orders & Settings)
  useEffect(() => {
    if (!user) return;

    // Fetch Orders
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubscribeOrders = onSnapshot(ordersRef, 
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        fetchedOrders.sort((a, b) => b.createdAt - a.createdAt);
        setOrders(fetchedOrders);
      },
      (error) => {
        console.error("Firestore orders sync error:", error);
      }
    );

    // Fetch Admin Settings (PIN)
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'adminConfig');
    const unsubscribeSettings = onSnapshot(settingsDocRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().pin) {
          setAdminPin(docSnap.data().pin);
        } else {
          // Initialize default PIN in DB if missing
          setDoc(settingsDocRef, { pin: DEFAULT_PIN }, { merge: true }).catch(console.error);
        }
      },
      (error) => {
        console.error("Firestore settings sync error:", error);
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeSettings();
    };
  }, [user]);

  const handleClientLogin = (e) => {
    e.preventDefault();
    if (phoneInput.trim().length < 4) {
      setLoginError('Введите номер телефона клиента');
      return;
    }
    setClientPhone(phoneInput.trim());
    setLoginError('');
    setView('client');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pinInput === adminPin) {
      setLoginError('');
      setPinInput('');
      setView('admin');
    } else {
      setLoginError('Неверный PIN-код');
    }
  };

  const handleLogout = () => {
    setClientPhone('');
    setPhoneInput('');
    setPinInput('');
    setView('login');
    setLoginMode('client');
    setIsChangingPin(false);
    setPinChangeMsg({ type: '', text: '' });
  };

  const handleChangeAdminPin = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (newPinForm.current !== adminPin) {
      setPinChangeMsg({ type: 'error', text: 'Текущий PIN-код введен неверно' });
      return;
    }
    if (newPinForm.next.length < 4) {
      setPinChangeMsg({ type: 'error', text: 'Новый PIN должен содержать минимум 4 символа' });
      return;
    }
    if (newPinForm.next !== newPinForm.confirm) {
      setPinChangeMsg({ type: 'error', text: 'Новые PIN-коды не совпадают' });
      return;
    }

    try {
      const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'adminConfig');
      await setDoc(settingsDocRef, { pin: newPinForm.next }, { merge: true });
      setAdminPin(newPinForm.next);
      setPinChangeMsg({ type: 'success', text: 'PIN-код успешно изменен!' });
      setNewPinForm({ current: '', next: '', confirm: '' });
      setTimeout(() => {
        setIsChangingPin(false);
        setPinChangeMsg({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      console.error('Error updating pin:', err);
      setPinChangeMsg({ type: 'error', text: 'Ошибка сохранения в базе данных' });
    }
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.phone || !formData.title) {
      return;
    }

    const orderData = {
      phone: formData.phone.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      imageUrl: formData.imageUrl.trim() || DEFAULT_IMAGE,
      status: formData.status,
      updatedAt: Date.now()
    };

    try {
      const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      
      if (editingOrderId) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', editingOrderId);
        await updateDoc(docRef, orderData);
      } else {
        orderData.createdAt = Date.now();
        await addDoc(ordersRef, orderData);
      }
      
      setIsAddingOrder(false);
      setEditingOrderId(null);
      setFormData({ phone: '', title: '', description: '', imageUrl: '', status: 'Ожидает' });
    } catch (err) {
      console.error("Error saving order:", err);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting order:", err);
    }
  };

  const handleEditClick = (order) => {
    setFormData({
      phone: order.phone,
      title: order.title,
      description: order.description,
      imageUrl: order.imageUrl,
      status: order.status
    });
    setEditingOrderId(order.id);
    setIsAddingOrder(true);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
      await updateDoc(docRef, { status: newStatus, updatedAt: Date.now() });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const ProgressBar = ({ currentStatus }) => {
    const currentIndex = STATUS_OPTIONS.indexOf(currentStatus);
    
    return (
      <div className="w-full mt-5 mb-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Этап выполнения</span>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            {currentIndex + 1} из {STATUS_OPTIONS.length}: {currentStatus}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mt-3">
          {STATUS_OPTIONS.map((step, index) => {
            const isCompleted = index <= currentIndex;
            const isActive = index === currentIndex;
            
            return (
              <div 
                key={step} 
                className={`flex items-center space-x-2 p-2 rounded-xl border text-xs transition-all ${
                  isActive 
                    ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-sm' 
                    : isCompleted 
                    ? 'bg-stone-50 border-stone-200 text-stone-700 font-medium' 
                    : 'bg-white border-stone-100 text-stone-400 opacity-60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-amber-600 text-white' : isCompleted ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-500'
                }`}>
                  {isCompleted ? <CheckCircle className="w-3 h-3" /> : <span className="text-[10px]">{index + 1}</span>}
                </div>
                <span className="truncate">{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const OrderCard = ({ order, isAdmin }) => {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-4">
        <div className="h-52 w-full bg-stone-100 relative">
          {order.imageUrl ? (
            <img 
              src={order.imageUrl} 
              alt={order.title} 
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400">
              <ImageIcon className="w-12 h-12 opacity-50" />
            </div>
          )}
          <div className="absolute top-3 right-3 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {order.status}
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-bold text-lg text-stone-800">{order.title}</h3>
          {order.description && (
            <p className="text-sm text-stone-500 mt-1">{order.description}</p>
          )}
          
          <ProgressBar currentStatus={order.status} />
          
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-3">
              <div className="flex items-center text-sm font-semibold text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <Phone className="w-4 h-4 mr-2 text-amber-600" />
                Клиент: {order.phone}
              </div>
              
              <div className="flex gap-2">
                <select 
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="flex-1 bg-stone-50 border border-stone-200 text-stone-700 text-sm rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button 
                  onClick={() => handleEditClick(order)}
                  className="p-2.5 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors"
                  title="Редактировать"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteOrder(order.id)}
                  className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLoginView = () => (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-amber-600/30 mb-6 rotate-3">
          <Armchair className="w-10 h-10 text-white -rotate-3" />
        </div>
        <h1 className="text-3xl font-black text-stone-800 tracking-tight">Sultan Mebel</h1>
        <p className="text-stone-500 mt-2">Производство мебели на заказ</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-6 border border-stone-100">
        <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
          <button
            onClick={() => { setLoginMode('client'); setLoginError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              loginMode === 'client' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Клиент
          </button>
          <button
            onClick={() => { setLoginMode('admin'); setLoginError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              loginMode === 'admin' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Сотрудник
          </button>
        </div>

        {loginMode === 'client' ? (
          <form onSubmit={handleClientLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Номер телефона</label>
              <div className="relative">
                <Phone className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="+992 00 000 0000"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-base rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block pl-12 p-3.5 transition-all"
                  required
                />
              </div>
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-amber-600/20 transition-all active:scale-[0.98]">
              Войти и проверить статус
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
             <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">PIN-код доступа</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-base rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block pl-12 p-3.5 transition-all"
                  required
                />
              </div>
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-stone-900 hover:bg-stone-950 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]">
              Войти в панель
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const renderClientView = () => {
    const clientOrders = orders.filter(o => o.phone.includes(clientPhone));

    return (
      <div className="flex-1 flex flex-col bg-stone-50">
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Мои заказы</h2>
            <p className="text-xs text-stone-500">Телефон: {clientPhone}</p>
          </div>
          <button onClick={handleLogout} className="p-2.5 bg-stone-100 rounded-full text-stone-600 hover:bg-stone-200 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        
        <div className="p-4 flex-1 overflow-y-auto">
          {clientOrders.length === 0 ? (
            <div className="text-center py-20 px-4">
              <Info className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-700 mb-2">Заказы не найдены</h3>
              <p className="text-stone-500 text-sm">На данный момент по номеру <span className="font-semibold">{clientPhone}</span> заказов нет или номер указан иначе.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {clientOrders.map(order => (
                <OrderCard key={order.id} order={order} isAdmin={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminView = () => (
    <div className="flex-1 flex flex-col bg-stone-50 pb-20">
      <header className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div>
          <h2 className="text-lg font-bold">Панель администратора</h2>
          <p className="text-xs text-stone-400">Sultan Mebel</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsChangingPin(true)}
            className="p-2.5 bg-stone-800 rounded-full text-amber-400 hover:bg-stone-700 transition-colors"
            title="Изменить PIN-код"
          >
            <Key className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="p-2.5 bg-stone-800 rounded-full text-stone-300 hover:bg-stone-700 transition-colors" title="Выйти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Change PIN Modal */}
      {isChangingPin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                Изменить PIN-код входа
              </h3>
              <button 
                onClick={() => {
                  setIsChangingPin(false);
                  setPinChangeMsg({ type: '', text: '' });
                  setNewPinForm({ current: '', next: '', confirm: '' });
                }}
                className="p-2 text-stone-400 hover:text-stone-600 bg-stone-100 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeAdminPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Текущий PIN-код</label>
                <input 
                  type="password"
                  required
                  value={newPinForm.current}
                  onChange={e => setNewPinForm({...newPinForm, current: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Новый PIN-код</label>
                <input 
                  type="password"
                  required
                  value={newPinForm.next}
                  onChange={e => setNewPinForm({...newPinForm, next: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Подтвердите новый PIN-код</label>
                <input 
                  type="password"
                  required
                  value={newPinForm.confirm}
                  onChange={e => setNewPinForm({...newPinForm, confirm: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="••••"
                />
              </div>

              {pinChangeMsg.text && (
                <div className={`p-3 rounded-xl text-sm font-medium ${pinChangeMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {pinChangeMsg.text}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-amber-700 transition-colors"
              >
                Сохранить новый PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Order Form Modal */}
      {isAddingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-stone-800">
                {editingOrderId ? 'Редактировать заказ' : 'Новый заказ'}
              </h3>
              <button 
                onClick={() => {
                  setIsAddingOrder(false);
                  setEditingOrderId(null);
                  setFormData({ phone: '', title: '', description: '', imageUrl: '', status: 'Ожидает' });
                }}
                className="p-2 text-stone-400 hover:text-stone-600 bg-stone-100 rounded-full"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Телефон клиента *</label>
                <input 
                  type="text" 
                  required
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="+992..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Название мебели / изделия *</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Кухонный гарнитур"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Описание / Детали</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none resize-none h-20"
                  placeholder="Фасады МДФ, фурнитура Blum..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Ссылка на фото (URL)</label>
                <input 
                  type="url" 
                  value={formData.imageUrl}
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Текущий этап готовности</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  className="w-full border border-stone-200 rounded-xl p-3 bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              
              <button 
                type="submit"
                className="w-full bg-stone-900 text-white font-bold py-4 rounded-xl mt-4 shadow-lg hover:bg-black transition-colors"
              >
                Сохранить заказ
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-800">Все заказы ({orders.length})</h3>
        </div>
        
        {orders.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            Список заказов пуст. Нажмите кнопку ниже, чтобы добавить первый заказ.
          </div>
        ) : (
          orders.map(order => (
            <OrderCard key={order.id} order={order} isAdmin={true} />
          ))
        )}
      </div>

      <button 
        onClick={() => setIsAddingOrder(true)}
        className="fixed bottom-6 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-6 bg-amber-600 text-white p-4 rounded-full shadow-xl shadow-amber-600/40 hover:bg-amber-700 hover:scale-105 transition-all z-10 flex items-center gap-2 pr-6"
      >
        <Plus className="w-6 h-6" />
        <span className="font-bold">Новый заказ</span>
      </button>
    </div>
  );

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-200 rounded-2xl mb-4"></div>
          <div className="h-4 w-24 bg-amber-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8e6e1] sm:py-8 flex justify-center font-sans selection:bg-amber-200 text-stone-800">
      <div className="w-full max-w-md bg-white sm:rounded-[2.5rem] shadow-2xl sm:overflow-hidden min-h-screen sm:min-h-[850px] flex flex-col relative border-4 border-white ring-1 ring-stone-200/50">
        {view === 'login' && renderLoginView()}
        {view === 'client' && renderClientView()}
        {view === 'admin' && renderAdminView()}
      </div>
    </div>
  );
}