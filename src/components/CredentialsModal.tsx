import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Key, ShieldCheck, X } from 'lucide-react';
import { DEFAULT_SPREADSHEET_ID, GOOGLE_CLIENT_ID } from '../services/googleDriveService';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManualTokenSubmit?: (token: string) => void;
  currentSpreadsheetId: string;
  onUpdateSpreadsheetId: (id: string) => void;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
  onManualTokenSubmit,
  currentSpreadsheetId,
  onUpdateSpreadsheetId,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [sheetInput, setSheetInput] = useState(currentSpreadsheetId);

  if (!isOpen) return null;

  const originUrlDev = 'https://ais-dev-ylnqieyu5egdkf3cikutu5-19967028807.us-west1.run.app';
  const originUrlPre = 'https://ais-pre-ylnqieyu5egdkf3cikutu5-19967028807.us-west1.run.app';

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleApplySheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetInput.trim()) {
      onUpdateSpreadsheetId(sheetInput.trim());
    }
  };

  const handleApplyToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim() && onManualTokenSubmit) {
      onManualTokenSubmit(manualToken.trim());
      setManualToken('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-50 text-[#E1197E] border border-pink-200">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Configuración Google Cloud & OAuth</h3>
              <p className="text-xs text-slate-500">
                Habilitación de APIs, URLs de redireccionamiento y orígenes autorizados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700">
          {/* Direct API Activation Section */}
          <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#E1197E]" />
                Habilitar APIs Requeridas en tu Proyecto (1761125251)
              </span>
              <span className="text-[11px] font-bold text-[#E1197E] bg-pink-100 px-2.5 py-0.5 rounded-full">
                Requerido
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Para que tu ID de cliente pueda descargar los datos de Google Sheets, la API debe estar habilitada en la consola de Google Cloud de tu proyecto. Haz clic en el botón para activarla en 1 paso:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=1761125251"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E1197E] hover:bg-[#c9146f] text-white font-bold text-xs shadow-sm transition"
              >
                <span>Habilitar Google Sheets API</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=1761125251"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
              >
                <span>Habilitar Google Drive API</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* URIs Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                1. Orígenes de JavaScript autorizados (Authorized JavaScript Origins)
              </span>
              <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">Google Cloud</span>
            </div>
            <p className="text-xs text-slate-500">
              Ingresa estas URLs en tu cliente OAuth de Google Cloud en <b>Orígenes de JavaScript autorizados</b>:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
                <span className="truncate select-all text-slate-800">{originUrlDev}</span>
                <button
                  onClick={() => copyToClipboard(originUrlDev, 'dev-origin')}
                  className="ml-2 px-2.5 py-1 text-xs font-sans font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                >
                  {copiedField === 'dev-origin' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
                <span className="truncate select-all text-slate-800">{originUrlPre}</span>
                <button
                  onClick={() => copyToClipboard(originUrlPre, 'pre-origin')}
                  className="ml-2 px-2.5 py-1 text-xs font-sans font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                >
                  {copiedField === 'pre-origin' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Redirect URIs */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                2. URIs de redireccionamiento autorizados (Authorized Redirect URIs)
              </span>
              <span className="text-[11px] text-indigo-800 font-bold bg-indigo-50 px-2 py-0.5 rounded">Redirect URIs</span>
            </div>
            <p className="text-xs text-slate-500">
              Registra estas URLs en la sección de <b>URIs de redireccionamiento autorizados</b>:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
                <span className="truncate select-all text-slate-800">{originUrlDev}</span>
                <button
                  onClick={() => copyToClipboard(originUrlDev, 'dev-redirect')}
                  className="ml-2 px-2.5 py-1 text-xs font-sans font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                >
                  {copiedField === 'dev-redirect' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
                <span className="truncate select-all text-slate-800">{originUrlPre}</span>
                <button
                  onClick={() => copyToClipboard(originUrlPre, 'pre-redirect')}
                  className="ml-2 px-2.5 py-1 text-xs font-sans font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                >
                  {copiedField === 'pre-redirect' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Client ID info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ID de Cliente Google configurado
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
              <span className="truncate text-slate-800">{GOOGLE_CLIENT_ID}</span>
              <button
                onClick={() => copyToClipboard(GOOGLE_CLIENT_ID, 'client-id')}
                className="ml-2 px-2.5 py-1 text-xs font-sans font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
              >
                {copiedField === 'client-id' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Google Spreadsheet Link & ID */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Archivo de Google Sheets Vinculado
              </div>
              <a
                href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#E1197E] hover:underline font-bold flex items-center gap-1 transition"
              >
                Abrir en Google Sheets <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <form onSubmit={handleApplySheet} className="flex gap-2">
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="ID o URL de Google Spreadsheet"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:border-[#E1197E]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Actualizar ID
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#E1197E] hover:bg-[#c9146f] text-white font-bold rounded-xl text-xs transition shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
