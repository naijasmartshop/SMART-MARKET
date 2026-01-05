import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './services/supabase';
import { User, UserRole, ViewState, Product } from './types';
import { ADMIN_KEY } from './constants';
import { ProductCard } from './components/ProductCard';
import { 
  LogOut, 
  Store, 
  ShoppingBag, 
  Search, 
  Plus, 
  Loader2, 
  Image as ImageIcon, 
  X, 
  Upload,
  User as UserIcon,
  ShieldCheck,
  AlertCircle,
  Terminal,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  
  // Persistent State via LocalStorage
  const [view, setView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sm_view');
      return (saved as ViewState) || 'AUTH';
    }
    return 'AUTH';
  });
  
  const [user, setUser] = useState<User>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sm_user');
      return saved ? JSON.parse(saved) : { email: '', isAuthenticated: false };
    }
    return { email: '', isAuthenticated: false };
  });

  // Persist changes
  useEffect(() => {
    localStorage.setItem('sm_view', view);
    localStorage.setItem('sm_user', JSON.stringify(user));
  }, [view, user]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // UI Helper state
  const [copiedSql, setCopiedSql] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form States - Initialize with remembered values
  const [loginEmail, setLoginEmail] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('remember_email') || '';
    return '';
  });
  const [loginPassword, setLoginPassword] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('remember_password') || '';
    return '';
  });
  
  const [buyerUsername, setBuyerUsername] = useState('');
  
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [sellerUsername, setSellerUsername] = useState('');
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
    images: [] as string[] // base64 strings
  });
  const [uploading, setUploading] = useState(false);

  // --- Handlers & Data Fetching ---

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }

      if (data) {
        // Sanitize data to ensure images is always an array
        const safeData = data.map((p: any) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : (p.images ? [p.images] : [])
        }));
        setProducts(safeData as Product[]);
      }
    } catch (err: any) {
      const msg = err.message || JSON.stringify(err);
      console.error("Error fetching products:", msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Effects ---

  // Initial fetch and Real-time subscription
  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newP = payload.new as Product;
          if (!Array.isArray(newP.images)) newP.images = newP.images ? [newP.images] : [];
          setProducts(prev => [newP, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          // If the payload has the ID, remove it. 
          if (payload.old && payload.old.id) {
             setProducts(prev => prev.filter(p => p.id !== payload.old.id));
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedP = payload.new as Product;
          if (!Array.isArray(updatedP.images)) updatedP.images = updatedP.images ? [updatedP.images] : [];
          setProducts(prev => prev.map(p => p.id === updatedP.id ? updatedP : p));
        }
      })
      .subscribe((status, err) => {
         if (status === 'CHANNEL_ERROR') {
             console.log("Realtime subscription status:", status, err);
         }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail && loginPassword) {
      // Save credentials for next time
      localStorage.setItem('remember_email', loginEmail);
      localStorage.setItem('remember_password', loginPassword);

      setUser({ email: loginEmail, isAuthenticated: true });
      setView('ROLE_SELECT');
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    if (role === UserRole.BUYER) {
      setView('BUYER_SETUP');
    } else {
      setView('SELLER_AUTH');
    }
  };

  const handleBuyerSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (buyerUsername.trim()) {
      setUser(prev => ({ ...prev, username: buyerUsername, role: UserRole.BUYER }));
      setView('BUYER_DASHBOARD');
    }
  };

  const handleSellerAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKeyInput === ADMIN_KEY && sellerUsername.trim()) {
      setUser(prev => ({ ...prev, username: sellerUsername, role: UserRole.SELLER }));
      setView('SELLER_DASHBOARD');
      setAuthError(null);
    } else {
      setAuthError("Invalid Admin Key. Please check and try again.");
    }
  };

  const handleLogout = () => {
    setUser({ email: '', isAuthenticated: false });
    // Reset view but keep inputs populated from localStorage logic if user wants to log back in
    setView('AUTH');
    setBuyerUsername('');
    setSellerUsername('');
    setAdminKeyInput('');
    setAuthError(null);
    localStorage.removeItem('sm_user');
    localStorage.removeItem('sm_view');
    // NOTE: We do NOT remove 'remember_email' or 'remember_password' so they persist for next time.
  };

  const handleRetry = () => {
    fetchProducts();
  };

  const handleCopySql = () => {
    const sql = `create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  price text not null,
  description text,
  seller_username text not null,
  images jsonb default '[]'::jsonb
);

alter publication supabase_realtime add table products;
alter table products enable row level security;
create policy "Enable all access" on products for all using (true) with check (true);`;
    
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // --- Product Management (Seller) ---

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (newProduct.images.length + files.length > 3) {
      alert("Max 3 images allowed");
      return;
    }

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        alert("Only images are allowed");
        continue;
      }
      
      if (file.size > 500 * 1024) {
        console.warn("Large image may fail upload due to DB limits");
      }

      try {
        const base64 = await convertFileToBase64(file);
        newImages.push(base64);
      } catch (err) {
        console.error("Error converting file", err);
      }
    }
    setNewProduct(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
  };

  const removeImage = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handlePublishProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.images.length === 0) {
      alert("At least one photo is required.");
      return;
    }
    
    setUploading(true);
    
    try {
      const { error } = await supabase.from('products').insert([
        {
          name: newProduct.name,
          price: newProduct.price,
          description: newProduct.description,
          images: newProduct.images,
          seller_username: user.username,
          created_at: new Date().toISOString(),
        }
      ]);

      if (error) {
        throw error;
      }
      
      setNewProduct({ name: '', price: '', description: '', images: [] });
      showNotification("Product published successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to publish: ${err.message || 'Unknown error'}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Are you sure you want to delete this listing?")) {
      // 1. Optimistic update: Remove immediately from local state
      // This ensures the item disappears instantly for the user
      setProducts(prev => prev.filter(p => p.id !== id));

      try {
        // 2. Perform DB operation
        const { error } = await supabase.from('products').delete().eq('id', id);
        
        if (error) {
          throw error;
        }

        // 3. Success feedback
        showNotification("Product removed successfully", "success");
        
      } catch (err: any) {
        console.error("Error deleting product:", err);
        showNotification(`Failed to delete: ${err.message}`, "error");
        // 4. Revert/Refresh on error
        fetchProducts();
      }
    }
  };

  // --- Views ---

  // 1. Fake Auth
  if (view === 'AUTH') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200">
              <Store className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Welcome to Smart Market</h1>
          <p className="text-center text-gray-500 mb-8">Sign in to start buying or selling</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-md shadow-blue-100"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Role Selection
  if (view === 'ROLE_SELECT') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center">
             <h2 className="text-3xl font-bold text-gray-800">Who are you?</h2>
             <p className="text-gray-500 mt-2">Select your account type to proceed</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <button 
              onClick={() => handleRoleSelect(UserRole.BUYER)}
              className="group relative bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-blue-200 transition-all duration-300 flex flex-col items-center text-center"
            >
              <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                <ShoppingBag className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">I am a Buyer</h3>
              <p className="text-gray-500 text-sm mt-2">Browse products and contact sellers directly via WhatsApp.</p>
            </button>

            <button 
              onClick={() => handleRoleSelect(UserRole.SELLER)}
              className="group relative bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-purple-200 transition-all duration-300 flex flex-col items-center text-center"
            >
              <div className="bg-purple-50 p-4 rounded-full mb-4 group-hover:bg-purple-100 transition-colors">
                <Store className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">I am a Seller</h3>
              <p className="text-gray-500 text-sm mt-2">List your products and manage your inventory in real-time.</p>
            </button>
          </div>
          
          <div className="flex justify-center mt-8">
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 flex items-center space-x-2 text-sm">
              <LogOut size={16} />
              <span>Back to Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Buyer Setup (Username)
  if (view === 'BUYER_SETUP') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Buyer Profile</h2>
          <form onSubmit={handleBuyerSetup} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Create a Shopper Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  required 
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. ShoppingFan123"
                  value={buyerUsername}
                  onChange={(e) => setBuyerUsername(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg shadow-blue-200 transition-all">
              Start Shopping
            </button>
            <button type="button" onClick={() => setView('ROLE_SELECT')} className="w-full text-gray-500 py-2 hover:text-gray-700 text-sm">
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 4. Seller Auth (Admin Key + Username)
  if (view === 'SELLER_AUTH') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Seller Verification</h2>
          
          {authError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700 animate-pulse">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm font-medium">{authError}</span>
            </div>
          )}

          <form onSubmit={handleSellerAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Key</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 w-5 h-5" />
                <input 
                  type="password" 
                  required 
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border ${authError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-purple-500'} focus:ring-2 outline-none transition-colors`}
                  placeholder="Enter Secret Key"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  required 
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="e.g. BestDeals24"
                  value={sellerUsername}
                  onChange={(e) => setSellerUsername(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold shadow-lg shadow-purple-200 transition-all">
              Access Seller Dashboard
            </button>
            <button type="button" onClick={() => setView('ROLE_SELECT')} className="w-full text-gray-500 py-2 hover:text-gray-700 text-sm">
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. Dashboards (Buyer & Seller)
  const isSeller = view === 'SELLER_DASHBOARD';
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check specifically for table missing error
  const isMissingTableError = fetchError && (
    fetchError.includes("Could not find the table") || 
    fetchError.includes('relation "public.products" does not exist') ||
    fetchError.includes('42P01')
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-24 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 transition-all duration-300 transform translate-y-0 ${
          notification.type === 'success' ? 'bg-white border-l-4 border-green-500' : 'bg-white border-l-4 border-red-500'
        }`}>
          {notification.type === 'success' ? (
             <div className="bg-green-100 p-2 rounded-full">
               <Check className="w-5 h-5 text-green-600" />
             </div>
          ) : (
             <div className="bg-red-100 p-2 rounded-full">
               <AlertCircle className="w-5 h-5 text-red-600" />
             </div>
          )}
          <div>
            <p className={`font-bold ${notification.type === 'success' ? 'text-gray-800' : 'text-red-800'}`}>
              {notification.type === 'success' ? 'Success' : 'Error'}
            </p>
            <p className="text-sm text-gray-600 font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-50 ${isSeller ? 'bg-purple-600' : 'bg-blue-600'} text-white shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              {isSeller ? <Store className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
              <span className="font-bold text-xl tracking-tight">Smart Market</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full hidden sm:inline-block">
                Hello, {user.username}
              </span>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Log Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Search Bar (Global) */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-white/50 outline-none"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        
        {/* Error Banner & Setup Instructions */}
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 animate-fade-in shadow-sm">
            <div className="flex items-start space-x-3 text-red-800">
              <AlertCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Database Connection Issue</h3>
                  <button 
                    onClick={handleRetry}
                    className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded border border-red-200 text-sm hover:bg-red-50 transition-colors"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    <span>Retry Connection</span>
                  </button>
                </div>
                <p className="mt-1 text-sm opacity-90">{fetchError}</p>
                
                {isMissingTableError && (
                  <div className="mt-4 bg-white p-4 rounded-lg border border-red-100 shadow-inner">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                      <Terminal className="w-4 h-4 mr-2" />
                      Action Required: Setup Database
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Your Supabase project is missing the 'products' table. Please run this SQL in your Supabase SQL Editor:
                    </p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono leading-relaxed">
{`create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  price text not null,
  description text,
  seller_username text not null,
  images jsonb default '[]'::jsonb
);

alter publication supabase_realtime add table products;
alter table products enable row level security;
create policy "Enable all access" on products for all using (true) with check (true);`}
                      </pre>
                      <button 
                        onClick={handleCopySql}
                        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                        title="Copy SQL"
                      >
                        {copiedSql ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seller Upload Area */}
        {isSeller && !fetchError && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-purple-600" />
              Publish New Product
            </h2>
            <form onSubmit={handlePublishProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. Vintage Camera"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
                  <input 
                    type="text" 
                    required 
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    required 
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                    placeholder="Describe your product..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Product Images (Max 3)</label>
                
                <div className="grid grid-cols-3 gap-4">
                  {newProduct.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200">
                      <img src={img} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  
                  {newProduct.images.length < 3 && (
                    <label className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors aspect-square">
                      <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Add Photo</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={handleImageUpload}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
                
                <p className="text-xs text-gray-400">
                  * At least 1 photo required. Images only, no videos.
                </p>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Publish Product
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Product Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {isSeller ? 'Your Listings & Market' : 'Latest Products'}
            </h2>
            <span className="text-sm text-gray-500">{filteredProducts.length} items found</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No products found yet.</p>
              {isSeller && <p className="text-sm text-purple-600 mt-1">Be the first to publish one!</p>}
              {!isSeller && fetchError && <p className="text-sm text-red-500 mt-1">Could not load products.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  isSellerView={isSeller}
                  currentUser={user.username}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;