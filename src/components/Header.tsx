import React from 'react';
import {
  Clipboard,
  Database,
  Layers,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { GoogleDriveAuthState } from '../types/dashboard';

interface HeaderProps {
  authState: GoogleDriveAuthState;
  onConnectGoogle: () => void;
  onSyncNow: () => void;
  onOpenSettings: () => void;
  onOpenPasteModal: () => void;
  totalActivitiesCount: number;
  gerenciasCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  authState,
  onConnectGoogle,
  onSyncNow,
  onOpenSettings,
  onOpenPasteModal,
  totalActivitiesCount,
  gerenciasCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Title */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E1197E] to-[#BE185D] shadow-md shadow-[#E1197E]/20 text-white font-black text-xl tracking-wider">
              L
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-widest text-[#E1197E] uppercase bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                  LIVERPOOL
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Control de Gestión Operativa
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Tablero Inventario de Procesos
              </h1>
            </div>
          </div>

          {/* Action buttons & Connection Status */}
          <div className="flex items-center gap-3">
            {/* Quick stats pill */}
            <div className="hidden lg:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#E1197E]" />
                <span className="font-bold text-slate-900">{gerenciasCount}</span>
                <span className="text-slate-500">Gerencias</span>
              </div>
              <div className="w-px h-3 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-bold text-slate-900">{totalActivitiesCount}</span>
                <span className="text-slate-500">Actividades</span>
              </div>
            </div>

            {/* Pegar Datos de Hoja de Cálculo button */}
            <button
              onClick={onOpenPasteModal}
              title="Pegar filas copiadas de Google Sheets o Excel"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 text-xs text-[#E1197E] transition font-bold shadow-xs"
            >
              <Clipboard className="w-4 h-4" />
              <span>Pegar Hoja</span>
            </button>

            {/* Google Cloud URIs / Settings button */}
            <button
              onClick={onOpenSettings}
              title="Ver URLs de direccionamiento OAuth y configuración"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 transition font-semibold shadow-xs"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Ajustes & URLs</span>
            </button>

            {/* Sync Now button (if connected) */}
            {authState.isConnected && (
              <button
                onClick={onSyncNow}
                disabled={authState.isSyncing}
                title="Sincronizar hojas de cálculo de Drive ahora"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 transition font-semibold shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${authState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {authState.isSyncing ? 'Sincronizando...' : 'Actualizar'}
                </span>
              </button>
            )}

            {/* Single prominent Google Connect / Login Button */}
            {!authState.isConnected ? (
              <button
                onClick={onConnectGoogle}
                disabled={authState.isSyncing}
                className="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#E1197E] hover:bg-[#c9146f] text-white font-bold text-xs shadow-md shadow-[#E1197E]/20 transition-all active:scale-95 disabled:opacity-60"
              >
                {/* Google "G" icon badge */}
                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span>Conectar con Google Drive</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold truncate max-w-[140px] sm:max-w-[200px]">
                  {authState.userEmail || 'Google Drive Conectado'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
