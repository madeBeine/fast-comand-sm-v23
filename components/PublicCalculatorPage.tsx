
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { AppSettings, Currency, CompanyInfo } from '../types';
import QuickCalculator from './QuickCalculator';
import { Loader2, Share2, Calculator } from 'lucide-react';
import Logo from './Logo';

const PublicCalculatorPage: React.FC = () => {
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) return;
            try {
                const [settingsRes, currenciesRes, companyRes] = await Promise.all([
                    supabase.from('AppSettings').select('*').limit(1).maybeSingle(),
                    supabase.from('Currencies').select('*'),
                    supabase.from('CompanyInfo').select('*').limit(1).maybeSingle()
                ]);

                if (settingsRes.data) setSettings(settingsRes.data as unknown as AppSettings);
                if (currenciesRes.data) setCurrencies(currenciesRes.data as Currency[]);
                if (companyRes.data) {
                    const info = companyRes.data as unknown as CompanyInfo;
                    setCompanyInfo(info);
                    if (info.logo) {
                        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
                        link.type = 'image/x-icon';
                        link.rel = 'icon';
                        link.href = info.logo;
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                }

            } catch (e) {
                console.error("Error fetching public data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleShare = async () => {
        const linkToShare = (settings as any)?.calculator_short_link || window.location.href;
        try {
            await navigator.clipboard.writeText(linkToShare);
            setCopiedLink(true);
        } catch (err) {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = linkToShare;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedLink(true);
            } catch (e) {
                console.error('Copy failed', e);
            }
            document.body.removeChild(textArea);
        }
        setTimeout(() => setCopiedLink(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-blue-500"/>
                    <p>جاري تحميل الحاسبة...</p>
                </div>
            </div>
        );
    }

    if (!settings) {
        return <div className="min-h-screen flex items-center justify-center">خطأ في تحميل الإعدادات.</div>;
    }

    // Map settings manually since QuickCalculator expects camelCase
    const mappedSettings: AppSettings = {
        ...settings,
        commissionRate: (settings as any).commission_rate ?? settings.commissionRate,
        shippingRates: (settings as any).shipping_rates ?? settings.shippingRates,
        deliveryDays: (settings as any).delivery_days ?? settings.deliveryDays,
        defaultCurrency: (settings as any).default_currency ?? settings.defaultCurrency,
        defaultShippingType: (settings as any).default_shipping_type ?? settings.defaultShippingType,
        paymentMethods: (settings as any).payment_methods ?? settings.paymentMethods,
        orderIdPrefix: (settings as any).order_id_prefix ?? settings.orderIdPrefix,
        viewOrder: (settings as any).view_order ?? settings.viewOrder,
        whatsappTemplates: (settings as any).whatsapp_templates ?? settings.whatsappTemplates,
        calculatorShortLink: (settings as any).calculator_short_link ?? settings.calculatorShortLink
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 relative" dir="rtl">
            
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md space-y-6 relative z-10">
                
                {/* Header */}
                <div className="text-center space-y-4 mb-8">
                    <div className="flex justify-center">
                        {companyInfo?.logo ? (
                            <img src={companyInfo.logo} alt="Logo" className="h-20 w-auto object-contain drop-shadow-xl"/>
                        ) : (
                            <Logo className="h-20 w-20"/>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-white">حاسبة التكاليف</h1>
                    <p className="text-slate-400 text-sm">احسب تكلفة طلبك بدقة وسهولة</p>
                </div>

                {/* Calculator */}
                <div className="shadow-2xl rounded-2xl overflow-hidden border border-slate-700">
                    <QuickCalculator 
                        currencies={currencies} 
                        settings={mappedSettings} 
                        isFloating={false} // Use full block style
                    />
                </div>

                {/* Actions: Removed Login, Only Share */}
                <div className="flex gap-3 pt-4 justify-center">
                    <button 
                        onClick={handleShare}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold shadow-lg"
                    >
                        {copiedLink ? <span className="font-bold">تم النسخ!</span> : (
                            <>
                                <Share2 size={18}/>
                                <span>مشاركة رابط الحاسبة</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="text-center text-slate-500 text-xs mt-8">
                    © {new Date().getFullYear()} {companyInfo?.name || 'Fast Comand SM'}
                </div>
            </div>
        </div>
    );
};

export default PublicCalculatorPage;
