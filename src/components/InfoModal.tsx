import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X, Check } from 'lucide-react';

interface InfoModalProps {
    id: string;
    title: string;
    message: string;
    isOpen: boolean;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ id, title, message, isOpen, onClose }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const storageKey = `hide_modal_${id}`;

    useEffect(() => {
        const isHidden = localStorage.getItem(storageKey);
        if (isHidden !== 'true' && isOpen) {
            setShouldRender(true);
        } else if (isOpen) {
            // Si déjà caché, on ferme immédiatement via le parent
            onClose();
        }
    }, [isOpen, id, onClose, storageKey]);

    const handleConfirm = () => {
        if (dontShowAgain) {
            localStorage.setItem(storageKey, 'true');
        }
        setShouldRender(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {shouldRender && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        onClick={handleConfirm}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-white/10"
                    >
                        <div className="p-8">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                                <Info size={24} />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
                                {title}
                            </h3>
                            
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 text-lg">
                                {message}
                            </p>
                            
                            <div className="flex flex-col gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={dontShowAgain}
                                            onChange={(e) => setDontShowAgain(e.target.checked)}
                                        />
                                        <div className={`w-5 h-5 rounded border transition-all ${dontShowAgain ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-gray-300 dark:border-slate-700 group-hover:border-gray-400 dark:group-hover:border-slate-600'}`}>
                                            {dontShowAgain && <Check size={14} className="text-white absolute top-0.5 left-0.5" />}
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                                        Ne plus afficher ce message
                                    </span>
                                </label>
                                
                                <button
                                    onClick={handleConfirm}
                                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-black/10 dark:shadow-white/5"
                                >
                                    J'ai compris
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
