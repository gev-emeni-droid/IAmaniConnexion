import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Paperclip, Send, X, FileText } from 'lucide-react';
import { supportApi } from '../../lib/api';

interface SupportModalProps {
    open: boolean;
    onClose: () => void;
    canOpen: boolean;
}

export function SupportModal({ open, onClose, canOpen }: SupportModalProps) {
    const [loading, setLoading] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [ticket, setTicket] = React.useState<any | null>(null);
    const [messages, setMessages] = React.useState<any[]>([]);
    const [text, setText] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);
    const [error, setError] = React.useState('');
    const endRef = React.useRef<HTMLDivElement | null>(null);

    const loadThread = React.useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await supportApi.getOpenTicket();
            setTicket(data.ticket || null);
            setMessages(Array.isArray(data.messages) ? data.messages : []);
        } catch (e: any) {
            setError(e?.message || 'Erreur chargement support.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (open && canOpen) {
            loadThread();
        }
    }, [open, canOpen, loadThread]);

    React.useEffect(() => {
        if (open) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && !file) return;
        try {
            setSending(true);
            setError('');

            let fileUrl: string | null = null;
            let fileName: string | null = null;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                const upload = await supportApi.uploadFile(formData);
                fileUrl = upload.file_url;
                fileName = upload.file_name || file.name;
            }

            await supportApi.sendClientMessage({
                message: text.trim() || null,
                file_url: fileUrl,
                file_name: fileName,
            });

            setText('');
            setFile(null);
            await loadThread();
        } catch (e: any) {
            setError(e?.message || 'Erreur envoi message.');
        } finally {
            setSending(false);
        }
    };

    const isImage = (url?: string) => {
        const u = (url || '').toLowerCase();
        return u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.gif') || u.endsWith('.webp') || u.endsWith('.svg');
    };

    const resolveUrl = (url: string) => (url.startsWith('http') ? url : `${window.location.origin}${url}`);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 transition-colors duration-200">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        transition={{ duration: 0.22 }}
                        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden flex flex-col transition-colors duration-200"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10 bg-slate-100 dark:bg-black transition-colors duration-200">
                            <div>
                                <h3 className="text-slate-900 dark:text-white text-lg font-bold">Support L'IAmani</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500">Conversation en cours</p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition-colors duration-200">
                                <X size={18} />
                            </button>
                        </div>

                        {!canOpen ? (
                            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-gray-500">Support indisponible</div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {loading && <div className="text-slate-500 dark:text-gray-500 text-sm">Chargement...</div>}
                                    {error && <div className="text-red-400 text-sm">{error}</div>}
                                    {!loading && messages.length === 0 && (
                                        <div className="text-center text-slate-500 dark:text-gray-500 py-10">Aucun message. Démarrez une nouvelle conversation.</div>
                                    )}

                                    {messages.map((m) => {
                                        const mine = m.sender_type !== 'admin';
                                        return (
                                            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[78%] rounded-2xl px-4 py-3 border ${mine ? 'bg-slate-100 dark:bg-[#1A1A1A] border-gray-300 dark:border-white/10 text-slate-900 dark:text-white' : 'bg-white dark:bg-black border-amber-400/40 dark:border-[#C8AA6E]/50 text-slate-900 dark:text-white'} transition-colors duration-200`}>
                                                    {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}

                                                    {m.file_url && (
                                                        <a
                                                            href={resolveUrl(m.file_url)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block mt-2 rounded-lg border border-gray-300 dark:border-white/10 p-2 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                                        >
                                                            {isImage(m.file_url) ? (
                                                                <img src={resolveUrl(m.file_url)} alt={m.file_name || 'fichier'} className="max-h-40 rounded-md object-contain mb-2" />
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                                                                    <FileText size={16} />
                                                                    <span>{m.file_name || 'Télécharger la pièce jointe'}</span>
                                                                </div>
                                                            )}
                                                            {isImage(m.file_url) && (
                                                                <p className="text-xs text-slate-500 dark:text-gray-400">{m.file_name || 'Pièce jointe image'}</p>
                                                            )}
                                                        </a>
                                                    )}

                                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={endRef} />
                                </div>

                                <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-white/10 bg-slate-100 dark:bg-black transition-colors duration-200">
                                    <div className="flex items-end gap-2">
                                        <label className="p-2 rounded-lg border border-gray-300 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer transition-colors duration-200">
                                            <Paperclip size={18} />
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                            />
                                        </label>
                                        <textarea
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            rows={2}
                                            placeholder="Votre message..."
                                            className="flex-1 resize-none px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || (!text.trim() && !file)}
                                            className="px-3 py-2 rounded-lg bg-white text-black font-bold disabled:opacity-50"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                    {file && <p className="text-xs text-slate-500 dark:text-gray-500 mt-2">Pièce jointe: {file.name}</p>}
                                    {ticket && <p className="text-[10px] text-slate-600 dark:text-gray-600 mt-1">Ticket: {ticket.id}</p>}
                                </form>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
