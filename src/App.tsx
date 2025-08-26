import React, { useState, useRef, useEffect } from 'react';
import { Factory, Settings, User, MessageSquare, Zap, LogIn, UserPlus, ArrowRight, LogOut, Menu, X } from 'lucide-react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { RoleSelector } from './components/RoleSelector';
import { ChatHistoryList } from './components/ChatHistoryList';
import { LoadingMessage } from './components/LoadingMessage';
import { ErrorMessage } from './components/ErrorMessage';
import { LoginScreen } from './components/LoginScreen';
import { AuthScreen } from './components/AuthScreen';
import { useAuth } from './contexts/AuthContext';
import { useChatHistory } from './contexts/ChatHistoryContext';
import { generateResponse } from './utils/gemini';
import type { Message, UserRole, ChatState, ChatHistory } from './types';

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const { saveChatHistory, loadChatHistory, setCurrentChatId } = useChatHistory();
  const [showLogin, setShowLogin] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    selectedRole: 'Operations',
    uploadedFiles: []
  });
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Changed default to false for mobile-first
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, chatState.isLoading]);

  // Check authentication status on mount
  useEffect(() => {
    if (isAuthenticated) {
      setShowLogin(false);
      setShowAuth(false);
    }
  }, [isAuthenticated]);

  // Check if API key is available
  useEffect(() => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('GEMINI_API_KEY is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.');
    }
  }, []);

  // Close sidebar when clicking outside on mobile/tablet
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const hamburger = document.getElementById('hamburger-menu');
      
      if (sidebarOpen && sidebar && !sidebar.contains(event.target as Node) && 
          hamburger && !hamburger.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Auto-close sidebar on mobile when resizing
      if (window.innerWidth < 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  const handleLogin = () => {
    setShowLogin(false);
    setShowAuth(true);
  };

  const handleGuestAccess = () => {
    setShowLogin(false);
    setShowAuth(false);
  };

  const handleAuthComplete = () => {
    setShowAuth(false);
  };

  const handleLogout = () => {
    logout();
    setChatState({
      messages: [],
      isLoading: false,
      selectedRole: 'Operations',
      uploadedFiles: []
    });
    setCurrentChatId(null);
    setShowLogoutConfirm(false);
    setShowLogin(true);
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string) => {
    if (error) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));

    // Close sidebar on mobile after sending message
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }

    try {
      const aiResponse = await generateResponse(content, chatState.selectedRole);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false
      }));
    } catch (err) {
      setChatState(prev => ({ ...prev, isLoading: false }));
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  // Auto-save chat when messages change (for authenticated users)
  useEffect(() => {
    if (isAuthenticated && chatState.messages.length >= 2) {
      const hasUserMessage = chatState.messages.some(m => m.role === 'user');
      const hasAIResponse = chatState.messages.some(m => m.role === 'assistant');
      
      if (hasUserMessage && hasAIResponse) {
        saveChatHistory({
          messages: chatState.messages,
          role: chatState.selectedRole
        });
      }
    }
  }, [chatState.messages, isAuthenticated, chatState.selectedRole, saveChatHistory]);

  const handleRoleChange = (role: UserRole | 'General AI') => {
    setChatState(prev => ({ ...prev, selectedRole: role }));
    // Close sidebar on mobile after role change
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleLoadChat = (history: ChatHistory) => {
    setChatState(prev => ({
      ...prev,
      messages: history.messages,
      selectedRole: history.role,
      isLoading: false
    }));
    setCurrentChatId(history.id);
    // Close sidebar on mobile after loading chat
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChat = () => {
    setChatState(prev => ({
      ...prev,
      messages: [],
      isLoading: false
    }));
    setCurrentChatId(null);
    // Close sidebar on mobile after new chat
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const clearError = () => setError(null);

  if (showLogin && !isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} onGuestAccess={handleGuestAccess} />;
  }

  if (showAuth) {
    return <AuthScreen onComplete={handleAuthComplete} />;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 flex overflow-hidden relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        id="sidebar"
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:relative z-50 lg:z-auto
          w-80 h-full
          bg-gradient-to-b from-slate-800 to-slate-900 
          border-r-4 border-yellow-500 
          flex flex-col shadow-2xl
          transition-transform duration-300 ease-in-out
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 lg:p-6 border-b-2 border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 lg:p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg">
                <Factory className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide">CemtrAS AI</h1>
                <p className="text-yellow-400 text-xs lg:text-sm font-semibold">AI-Driven Engineering for Cement Excellence</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="text-slate-300" size={20} />
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="p-4 lg:p-6 border-b-2 border-slate-700 flex-shrink-0">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center border-4 border-yellow-500 shadow-lg">
                <User className="text-white" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-sm lg:text-lg truncate">{user.fullName}</h3>
                <p className="text-yellow-400 text-xs lg:text-sm font-semibold">Authenticated User</p>
                <p className="text-slate-400 text-xs truncate">{user.email}</p>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-red-400 flex-shrink-0"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full overflow-hidden border-4 border-yellow-500 shadow-lg flex-shrink-0">
                <img 
                  src="/untitled (10).jpeg" 
                  alt="CemtrAS AI"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-bold text-sm lg:text-lg">Vipul Sharma</h3>
                <p className="text-yellow-400 text-xs lg:text-sm font-semibold">Founder of CemtrAS AI</p>
                <p className="text-slate-400 text-xs">Guest Mode Active</p>
              </div>
            </div>
          )}
          
          {/* Role Selector */}
          <div className="space-y-3">
            <h4 className="text-slate-300 font-semibold text-xs lg:text-sm uppercase tracking-wide">Select Expertise Area:</h4>
            <RoleSelector 
              selectedRole={chatState.selectedRole}
              onRoleChange={handleRoleChange}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-4 lg:space-y-6">
            {/* Chat History */}
            {isAuthenticated && (
              <ChatHistoryList 
                onLoadChat={handleLoadChat}
                onNewChat={handleNewChat}
              />
            )}

            {/* Stats */}
            <div className="bg-slate-800/80 rounded-lg p-3 lg:p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 lg:gap-3 mb-2">
                <MessageSquare className="text-blue-400" size={16} />
                <span className="text-slate-300 text-xs lg:text-sm font-semibold">QUERIES PROCESSED</span>
              </div>
              <p className="text-white text-xl lg:text-2xl font-bold">{chatState.messages.length}</p>
            </div>
            
            <div className="bg-slate-800/80 rounded-lg p-3 lg:p-4 border-l-4 border-yellow-500">
              <div className="flex items-center gap-2 lg:gap-3 mb-2">
                <Zap className="text-yellow-400" size={16} />
                <span className="text-slate-300 text-xs lg:text-sm font-semibold">SYSTEM STATUS</span>
              </div>
              <p className={`text-xs lg:text-sm font-bold ${chatState.isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
                {chatState.isLoading ? 'ANALYZING...' : 'READY'}
              </p>
            </div>

            {!isAuthenticated && (
              <div className="bg-yellow-500/20 rounded-lg p-3 lg:p-4 border border-yellow-500">
                <p className="text-yellow-300 text-xs font-semibold mb-2">GUEST MODE</p>
                <p className="text-slate-300 text-xs">Login to save chats & access detailed reports</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 lg:p-4 border-t-2 border-slate-700 flex-shrink-0">
          <div className="text-center">
            <p className="text-slate-400 text-xs">
              Powered by <span className="text-yellow-400 font-bold">AI Technology</span>
            </p>
            <p className="text-slate-500 text-xs mt-1">© 2024 Cement Plant Expert</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm border-b-4 border-blue-600 p-4 lg:p-6 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              {/* Hamburger Menu for Mobile/Tablet */}
              <button
                id="hamburger-menu"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <Menu className="text-slate-700" size={24} />
              </button>
              
              <div className="p-2 lg:p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg flex-shrink-0">
                <Factory className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-slate-800 font-bold text-lg lg:text-xl truncate">👷 Cement Plant Expert AI</h2>
                <p className="text-slate-600 text-xs lg:text-sm font-semibold truncate">
                  Expertise: <span className="text-blue-600 font-bold">{chatState.selectedRole}</span>
                  {!isAuthenticated && <span className="ml-2 text-yellow-600">(Guest Mode)</span>}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              <div className="w-2 h-2 lg:w-3 lg:h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
              <span className="text-slate-700 text-xs lg:text-sm font-semibold hidden sm:inline">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 flex-shrink-0">
            <ErrorMessage 
              message={error} 
              onRetry={error.includes('GEMINI_API_KEY') ? undefined : clearError}
            />
          </div>
        )}

        {/* Messages Container - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-100 to-white">
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 min-h-full">
            {chatState.messages.length === 0 && !error ? (
              <div className="text-center py-8 lg:py-12">
                <div className="p-6 lg:p-8 bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-3xl w-24 h-24 lg:w-32 lg:h-32 mx-auto mb-6 lg:mb-8 flex items-center justify-center border-4 border-blue-200 shadow-xl">
                  <Factory className="text-blue-600 w-12 h-12 lg:w-16 lg:h-16" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-3 lg:mb-4">Welcome to CemtrAS AI</h3>
                <p className="text-slate-600 mb-6 lg:mb-8 max-w-2xl mx-auto text-base lg:text-lg leading-relaxed px-4">
                  AI-powered Cement Plant Operations, Safety & Efficiency Expert — your trusted partner in building and optimizing world-class cement plants.<br/>
                  Choose your area of expertise to get tailored guidance for cement plant operations, maintenance, and performance improvement.
                  {isAuthenticated && <span className="text-green-600 font-semibold"><br/>✅ You have access to General AI mode and chat history!</span>}
                </p>
                <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-4xl mx-auto border-4 border-slate-200 shadow-xl">
                  <h4 className="text-lg lg:text-xl font-bold text-slate-800 mb-4 lg:mb-6">🔧 Available Expertise Areas:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 text-sm">
                    <div className="text-left space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Plant Operations & Maintenance</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Project Management</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Sales & Marketing</p>
                      </div>
                    </div>
                    <div className="text-left space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Procurement & Supply Chain</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Erection & Commissioning</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0"></div>
                        <p className="text-slate-700 font-semibold">Engineering & Design</p>
                      </div>
                    </div>
                    {isAuthenticated && (
                      <div className="text-left space-y-3 sm:col-span-2">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-purple-500 rounded-full flex-shrink-0"></div>
                          <p className="text-slate-700 font-semibold">🤖 General AI Assistant</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {!isAuthenticated && (
                    <div className="mt-4 lg:mt-6 p-3 lg:p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                      <p className="text-yellow-800 font-semibold text-sm">
                        🔓 Login to unlock General AI mode, file uploads, and chat history!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {chatState.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {chatState.isLoading && <LoadingMessage />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Fixed at Bottom */}
        <div className="border-t-4 border-blue-600 bg-white/95 backdrop-blur-sm p-4 lg:p-6 shadow-lg flex-shrink-0">
          <ChatInput 
            onSend={handleSendMessage}
            isLoading={chatState.isLoading || !!error}
            placeholder={`Ask about cement plant operations (${chatState.selectedRole} expertise)...`}
          />
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-4 border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Confirm Logout</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to logout? Your chat history will be preserved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;