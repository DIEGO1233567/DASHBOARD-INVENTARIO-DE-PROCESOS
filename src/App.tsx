import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  RefreshCw,
  Sliders,
  Sparkles,
  Table,
  Users,
  Zap,
} from 'lucide-react';
import { ActivitiesTable } from './components/ActivitiesTable';
import { CredentialsModal } from './components/CredentialsModal';
import { ExecutiveKpiSummary } from './components/ExecutiveKpiSummary';
import { GerenciasOverview } from './components/GerenciasOverview';
import { Header } from './components/Header';
import { ImpactSimulator } from './components/ImpactSimulator';
import { MacroProcessesView } from './components/MacroProcessesView';
import { PasteDataModal } from './components/PasteDataModal';
import { WorkloadAnalysis } from './components/WorkloadAnalysis';
import { INITIAL_ACTIVITIES } from './data/initialData';
import {
  DEFAULT_SPREADSHEET_ID,
  fetchSpreadsheetData,
  GoogleApiDisabledError,
  GOOGLE_PROJECT_ID,
  parseCsvText,
  parseExcelBuffer,
  parseRowsToActivities,
  requestGoogleAccessToken,
  SHEETS_API_ENABLE_URL,
  shouldIgnoreSheet,
} from './services/googleDriveService';
import { ActivityItem, GoogleDriveAuthState } from './types/dashboard';
import {
  calculateGerenciaSummary,
  calculateOverallMetrics,
} from './utils/kpiCalculator';

export default function App() {
  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    try {
      const saved = localStorage.getItem('liverpool_dashboard_activities_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 50) {
          const totalHrs = parsed.reduce((sum: number, it: any) => sum + (it.horasMensualesActividad || 0), 0);
          const hasKpiSheet = parsed.some((it: any) => shouldIgnoreSheet(it.gerencia || ''));
          if (totalHrs > 100 && !hasKpiSheet) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading cached activities', e);
    }
    return INITIAL_ACTIVITIES;
  });

  const [selectedGerencia, setSelectedGerencia] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'macros' | 'table' | 'workload' | 'simulator'>('overview');
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [apiDisabledNotice, setApiDisabledNotice] = useState<{
    apiName: string;
    enableUrl: string;
    projectId: string;
  } | null>(null);

  const [authState, setAuthState] = useState<GoogleDriveAuthState>(() => {
    return {
      isConnected: false,
      userEmail: 'dmartinezp@liverpool.com.mx',
      userName: 'Diego Martínez',
      userAvatar: null,
      accessToken: null,
      lastSyncTime: null,
      isSyncing: false,
      syncError: null,
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      sheetCount: 5,
    };
  });

  // Calculate summaries for each Gerencia
  const gerenciasSummaries = useMemo(() => {
    const gerenciaMap = new Map<string, ActivityItem[]>();
    for (const a of activities) {
      // Filter out any activity belonging to an ignored KPI sheet
      if (shouldIgnoreSheet(a.gerencia)) continue;

      const g = a.gerencia || 'Gerencia General';
      if (!gerenciaMap.has(g)) {
        gerenciaMap.set(g, []);
      }
      gerenciaMap.get(g)!.push(a);
    }

    return Array.from(gerenciaMap.entries()).map(([gName, gItems]) =>
      calculateGerenciaSummary(gName, gItems)
    );
  }, [activities]);

  // Overall metrics (or filtered to selected gerencia)
  const currentMetrics = useMemo(() => {
    if (selectedGerencia) {
      const gSummary = gerenciasSummaries.find((g) => g.gerencia === selectedGerencia);
      if (gSummary) {
        return calculateOverallMetrics([gSummary]);
      }
    }
    return calculateOverallMetrics(gerenciasSummaries);
  }, [gerenciasSummaries, selectedGerencia]);

  // Toast notification helper
  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 7000);
  };

  // Live Sync trigger with access token
  const performSync = async (token: string, sheetId: string) => {
    setAuthState((prev) => ({ ...prev, isSyncing: true, syncError: null }));
    showToast('info', 'Consultando hojas de cálculo en Google Drive y Sheets API...');

    try {
      const result = await fetchSpreadsheetData(token, sheetId);
      if (result.activities.length > 0) {
        setActivities(result.activities);
        localStorage.setItem('liverpool_dashboard_activities_v3', JSON.stringify(result.activities));
        setAuthState((prev) => ({
          ...prev,
          isConnected: true,
          accessToken: token,
          isSyncing: false,
          lastSyncTime: new Date().toLocaleTimeString(),
          sheetCount: result.sheetNames.length,
          syncError: null,
        }));
        setApiDisabledNotice(null);
        showToast(
          'success',
          `¡Sincronizado con éxito (${result.source === 'drive_xlsx' ? 'Google Drive Multi-Hoja XLSX' : 'Google Sheets API'})! Se cargaron ${result.totalRows} actividades en ${result.sheetNames.length} gerencias.`
        );
      } else {
        throw new Error('El archivo no devolvió actividades con la estructura esperada.');
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      const isApiDisabled =
        err instanceof GoogleApiDisabledError ||
        String(err?.message || '').includes('SERVICE_DISABLED') ||
        String(err?.message || '').includes('has not been used in project') ||
        String(err?.message || '').includes('sheets.googleapis.com');

      if (isApiDisabled) {
        setApiDisabledNotice({
          apiName: 'Google Sheets API',
          enableUrl: SHEETS_API_ENABLE_URL,
          projectId: GOOGLE_PROJECT_ID,
        });
        const friendlyMsg = `La Google Sheets API no está habilitada en tu proyecto de Google Cloud (${GOOGLE_PROJECT_ID}). Haz clic en el botón de abajo para activarla.`;
        setAuthState((prev) => ({ ...prev, isSyncing: false, syncError: friendlyMsg }));
        showToast('error', friendlyMsg);
      } else {
        const errMsg = err?.message || 'Error al conectar con Google Sheets API.';
        setAuthState((prev) => ({ ...prev, isSyncing: false, syncError: errMsg }));
        showToast('error', `Fallo de sincronización: ${errMsg}`);
      }
    }
  };

  // Excel (.xlsx/.xls) or CSV File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const { activities: importedActivities, sheetNames } = parseExcelBuffer(buffer);
          if (importedActivities.length > 0) {
            setActivities(importedActivities);
            localStorage.setItem('liverpool_dashboard_activities_v3', JSON.stringify(importedActivities));
            showToast(
              'success',
              `¡Archivo Excel cargado con éxito! Se importaron ${importedActivities.length} actividades en ${sheetNames.length} gerencias (${sheetNames.join(', ')}).`
            );
          } else {
            showToast('error', 'El archivo Excel no contiene filas con la estructura de columnas requerida.');
          }
        } catch (err: any) {
          showToast('error', `Error al leer libro Excel: ${err?.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const rows = parseCsvText(text);
          const importedActivities = parseRowsToActivities(rows, file.name.replace(/\.[^/.]+$/, ''));
          if (importedActivities.length > 0) {
            setActivities(importedActivities);
            localStorage.setItem('liverpool_dashboard_activities_v3', JSON.stringify(importedActivities));
            showToast(
              'success',
              `¡Archivo CSV importado con éxito! Se cargaron ${importedActivities.length} actividades desde "${file.name}".`
            );
          } else {
            showToast('error', 'El archivo no contiene filas válidas según la estructura esperada.');
          }
        } catch (err: any) {
          showToast('error', `Error al leer archivo CSV: ${err?.message}`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Google OAuth button handler
  const handleConnectGoogle = () => {
    showToast('info', 'Abriendo ventana de autenticación de Google...');
    requestGoogleAccessToken(
      (token) => {
        setAuthState((prev) => ({
          ...prev,
          isConnected: true,
          accessToken: token,
        }));
        performSync(token, authState.spreadsheetId);
      },
      (error) => {
        setAuthState((prev) => ({ ...prev, syncError: error }));
        showToast('error', error);
        setIsCredentialsModalOpen(true);
      }
    );
  };

  // Manual Token submission fallback
  const handleManualToken = (token: string) => {
    setAuthState((prev) => ({ ...prev, isConnected: true, accessToken: token }));
    performSync(token, authState.spreadsheetId);
  };

  const handleUpdateSpreadsheetId = (newId: string) => {
    setAuthState((prev) => ({ ...prev, spreadsheetId: newId }));
    if (authState.accessToken) {
      performSync(authState.accessToken, newId);
    } else {
      showToast('info', `ID de Google Sheet actualizado a: ${newId}`);
    }
  };

  const handleImportActivities = (
    newActivities: ActivityItem[],
    gerenciaName: string,
    mode: 'merge' | 'replace'
  ) => {
    setActivities((prev) => {
      let updated: ActivityItem[];
      if (mode === 'replace') {
        updated = [...prev.filter((a) => a.gerencia !== gerenciaName), ...newActivities];
      } else {
        updated = [...prev, ...newActivities];
      }
      localStorage.setItem('liverpool_dashboard_activities_v3', JSON.stringify(updated));
      return updated;
    });
    setSelectedGerencia(gerenciaName);
    showToast(
      'success',
      `¡Se cargaron ${newActivities.length} actividades en "${gerenciaName}" exitosamente!`
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-[#E1197E] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 max-w-md animate-fade-in">
          <div
            className={`p-4 rounded-2xl shadow-xl border text-xs flex items-start gap-3 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-white border-indigo-200 text-indigo-950 shadow-md'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
            )}
            <div className="flex-1 leading-relaxed font-semibold">{toastMessage.text}</div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        authState={authState}
        onConnectGoogle={handleConnectGoogle}
        onSyncNow={() => authState.accessToken && performSync(authState.accessToken, authState.spreadsheetId)}
        onOpenSettings={() => setIsCredentialsModalOpen(true)}
        onOpenPasteModal={() => setIsPasteModalOpen(true)}
        totalActivitiesCount={activities.length}
        gerenciasCount={gerenciasSummaries.length}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* API Disabled Action Banner */}
        {apiDisabledNotice && (
          <div className="p-5 rounded-3xl bg-amber-50 border border-amber-300 shadow-md space-y-3 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    Acción Requerida: Habilitar Google Sheets API en tu Proyecto ({apiDisabledNotice.projectId})
                  </h3>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
                    Google Cloud requiere habilitar la <b>Google Sheets API</b> en el proyecto asociado a tu ID de cliente antes de poder consultar las hojas de cálculo. Haz clic en el botón verde para habilitarla con tu cuenta de Google.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApiDisabledNotice(null)}
                className="text-slate-400 hover:text-slate-800 p-1 font-bold"
                title="Descartar aviso"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={apiDisabledNotice.enableUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition active:scale-95"
              >
                <span>1. Habilitar Google Sheets API en Google Cloud</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {authState.accessToken && (
                <button
                  onClick={() => performSync(authState.accessToken!, authState.spreadsheetId)}
                  disabled={authState.isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 shadow-xs transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${authState.isSyncing ? 'animate-spin' : ''}`} />
                  <span>2. Ya la habilité, Reintentar</span>
                </button>
              )}

              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-xs transition cursor-pointer">
                <span>📁 O Cargar Excel / CSV (.xlsx, .csv)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setApiDisabledNotice(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline ml-auto"
              >
                Continuar con datos pre-cargados
              </button>
            </div>
          </div>
        )}

        {/* Gerencias Command Bar (TODO PARTE DE LAS GERENCIAS) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E1197E]" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Centro de Mando por Gerencias
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                (Selecciona una gerencia para navegar de lo general a lo particular)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-bold transition cursor-pointer shadow-2xs">
                <span>📂 Subir Archivo (.xlsx / .csv)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => {
                  localStorage.removeItem('liverpool_dashboard_activities_v3');
                  localStorage.removeItem('liverpool_dashboard_activities');
                  setActivities(INITIAL_ACTIVITIES);
                  setSelectedGerencia('');
                  showToast('info', 'Se restauró el catálogo oficial de Liverpool con las 11 Gerencias y 350 actividades.');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-600 font-bold transition shadow-2xs"
                title="Recargar catálogo base de Liverpool con las 11 Gerencias"
              >
                ↺ Restaurar Base (11 Gerencias)
              </button>
              {selectedGerencia && (
                <button
                  onClick={() => setSelectedGerencia('')}
                  className="px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-xs font-bold text-[#E1197E] border border-pink-200 transition"
                >
                  ✕ Ver Todas
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            <button
              onClick={() => setSelectedGerencia('')}
              className={`p-3.5 rounded-2xl border text-left transition ${
                !selectedGerencia
                  ? 'bg-[#E1197E] text-white border-[#E1197E] shadow-md ring-2 ring-[#E1197E]/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
                Consolidado
              </div>
              <div className="text-xs font-black truncate">Todas las Gerencias</div>
              <div className="text-[11px] font-bold mt-1.5 opacity-90">
                {activities.length} actividades
              </div>
            </button>

            {gerenciasSummaries.map((g) => {
              const isSel = selectedGerencia === g.gerencia;
              const isAuto = g.kpiAutomatizacion >= 80;
              return (
                <button
                  key={g.gerencia}
                  onClick={() => setSelectedGerencia(g.gerencia)}
                  className={`p-3.5 rounded-2xl border text-left transition ${
                    isSel
                      ? 'bg-[#E1197E] text-white border-[#E1197E] shadow-md ring-2 ring-[#E1197E]/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isSel
                          ? 'bg-white/20 text-white'
                          : isAuto
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {g.kpiAutomatizacion}% Viable
                    </span>
                  </div>
                  <div className="text-xs font-black truncate" title={g.gerencia}>
                    {g.gerencia.replace('Gerencia de ', '')}
                  </div>
                  <div className="text-[11px] font-semibold mt-1 opacity-80">
                    {g.totalHorasActividad}h • {g.totalTareas} tareas
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Executive KPI Summary */}
        <ExecutiveKpiSummary
          metrics={currentMetrics}
          selectedGerenciaName={selectedGerencia}
        />

        {/* Global Navigation Tabs (From General to Particular) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-1">
          <nav className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-[#E1197E] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. Gerencias (Visión General)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'overview' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {gerenciasSummaries.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('macros')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'macros'
                  ? 'bg-[#E1197E] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>2. Procesos Macro</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'table'
                  ? 'bg-[#E1197E] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>3. Matriz de Actividades</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'table' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {activities.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('workload')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'workload'
                  ? 'bg-[#E1197E] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>4. Carga Operativa de Equipos</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-[#E1197E] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>5. Simulador de Impacto (80%)</span>
            </button>
          </nav>
        </div>

        {/* Tab 1: Overview of Gerencias */}
        {activeTab === 'overview' && (
          <GerenciasOverview
            gerencias={gerenciasSummaries}
            onSelectGerencia={(gName) => {
              setSelectedGerencia(gName);
              setActiveTab('macros');
            }}
            selectedGerenciaName={selectedGerencia}
          />
        )}

        {/* Tab 2: Macro Processes Drill-Down */}
        {activeTab === 'macros' && (
          <MacroProcessesView
            gerencias={gerenciasSummaries}
            selectedGerenciaName={selectedGerencia}
            onSelectGerencia={(gName) => setSelectedGerencia(gName)}
          />
        )}

        {/* Tab 3: Detailed Activities Table */}
        {activeTab === 'table' && (
          <ActivitiesTable
            activities={activities}
            selectedGerenciaName={selectedGerencia}
          />
        )}

        {/* Tab 4: Workload Analysis */}
        {activeTab === 'workload' && (
          <WorkloadAnalysis
            activities={activities}
            selectedGerenciaName={selectedGerencia}
          />
        )}

        {/* Tab 5: Impact Simulator */}
        {activeTab === 'simulator' && (
          <ImpactSimulator
            gerencias={gerenciasSummaries}
            selectedGerenciaName={selectedGerencia || gerenciasSummaries[0]?.gerencia || ''}
            onSelectGerencia={(gName) => setSelectedGerencia(gName)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">EL PUERTO DE LIVERPOOL</span>
            <span>•</span>
            <span className="font-semibold text-slate-600">Transformación Digital & Automatización de Procesos</span>
          </div>
          <div className="text-[11px] text-slate-500 text-center sm:text-right font-medium">
            Metodología APQC & Gartner MVA (Meta 80% Viable) • Conexión en tiempo real con Google Drive API
          </div>
        </div>
      </footer>

      {/* Credentials & Redirect URIs Modal */}
      <CredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        onManualTokenSubmit={handleManualToken}
        currentSpreadsheetId={authState.spreadsheetId}
        onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
      />

      {/* Paste Sheet Data Modal */}
      <PasteDataModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImportActivities={handleImportActivities}
        availableGerencias={gerenciasSummaries.map((g) => g.gerencia)}
      />
    </div>
  );
}
