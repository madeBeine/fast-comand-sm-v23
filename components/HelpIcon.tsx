
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Info, Check, Lightbulb } from 'lucide-react';

interface HelpIconProps {
  content: { title: string; desc: string };
  className?: string;
}

const HelpIcon: React.FC<HelpIconProps> = ({ content, className = "" }) => {
  const [show, setShow] = useState(false);

  // التحكم في منع التمرير عند فتح النافذة
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [show]);

  const toggleModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // منع وصول الضغطة للبطاقة الأم
    
    // Safety check: if content is missing, don't show the modal to avoid crash
    if (!content) {
      console.warn("HelpIcon: Content is missing for this trigger.");
      return;
    }
    
    setShow(!show);
  };

  // If content is completely missing, don't render the icon at all
  if (!content) return null;

  // المكون الفعلي للنافذة المنبثقة
  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-300"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => { e.stopPropagation(); setShow(false); }}
    >
      {/* خلفية معتمة بضبابية عالية جداً */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" />

      {/* محتوى النافذة المنبثقة بتصميم احترافي */}
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden border border-white/10 animate-in zoom-in-95 duration-300 ease-out-expo" 
        onClick={e => e.stopPropagation()}
      >
        {/* الديكور العلوي */}
        <div className="h-2 w-full bg-gradient-to-r from-primary via-indigo-500 to-primary-light" />

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-primary/10 rounded-[1.5rem] text-primary">
              <Lightbulb size={32} strokeWidth={2} />
            </div>
            <button 
              onClick={() => setShow(false)} 
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all active:scale-90"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {content.title}
            </h4>
            <div className="h-1 w-12 bg-primary rounded-full mb-4" />
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400 font-bold">
              {content.desc}
            </p>
          </div>
        </div>

        <div className="px-8 pb-8">
          <button 
            onClick={() => setShow(false)} 
            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl dark:shadow-white/10"
          >
            <Check size={18} strokeWidth={3} />
            فهمت ذلك
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button 
        type="button"
        onClick={toggleModal}
        className={`inline-flex items-center justify-center w-6 h-6 text-slate-400 hover:text-primary transition-all rounded-full bg-slate-100 dark:bg-slate-800/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 group ${className}`}
      >
        <HelpCircle size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
      </button>

      {/* رندر النافذة في الـ Portal لضمان وجودها فوق كل شيء في الـ DOM */}
      {show && createPortal(modalContent, document.body)}
    </>
  );
};

export default HelpIcon;
