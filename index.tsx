import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { SoundProvider } from './contexts/SoundContext';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// --- Global Error Boundary Component ---
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Critical App Error:", error, errorInfo);
  }

  handleClearCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center font-sans">
          <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-black mb-2">عذراً، حدث خطأ غير متوقع</h1>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              يبدو أن هناك بيانات قديمة أو تالفة في المتصفح تمنع التطبيق من العمل بشكل صحيح.
            </p>
            
            <div className="p-4 bg-black/30 rounded-xl mb-6 text-left" dir="ltr">
                <code className="text-xs text-red-300 font-mono break-words">
                    {this.state.error?.message || 'Unknown Error'}
                </code>
            </div>

            <button 
              onClick={this.handleClearCache}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20 active:scale-95"
            >
              <Trash2 size={20} />
              إصلاح المشكلة (مسح الذاكرة)
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              className="w-full mt-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={18} />
              إعادة التحميل فقط
            </button>
          </div>
        </div>
      );
    }

    // Explicit cast to avoid TS error about props not existing on ErrorBoundary
    return (this as any).props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <SoundProvider>
          <App />
        </SoundProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);