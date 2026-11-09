import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  ListChecks,
  Clock,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Database,
  Lock,
  ArrowRight,
  Filter,
  LayoutDashboard,
  TableProperties,
  CalendarCheck,
} from 'lucide-react';
import { INITIAL_RECORDS } from './data/initialData';
import { ProcessRecord, SheetSyncConfig } from './types/sheets';
import {
  computeGerenciaSummaries,
  computeColaboradorSummaries,
  computeSubdireccionSummaries,
  inferSubdireccion,
  convertActivitiesToRecords,
  normalizeNumber,
  formatThousands,
  formatHours,
} from './utils/sheetsParser';
import { exportExecutiveSummaryXlsx } from './utils/executiveExport';
import {
  DEFAULT_SPREADSHEET_ID,
  fetchSpreadsheetData,
  GoogleApiDisabledError,
  requestGoogleAccessToken,
} from './services/googleDriveService';
import { GerenciasChartSection } from './components/GerenciasChartSection';
import { GerenciaPivotSection } from './components/GerenciaPivotSection';
import { ColaboradoresByGerenciaSection } from './components/ColaboradoresByGerenciaSection';
import { SubdireccionSummarySection } from './components/SubdireccionSummarySection';
import { DynamicCatalogSection } from './components/DynamicCatalogSection';
import { UniqueActivitiesStatusSheet } from './components/UniqueActivitiesStatusSheet';
import { WorkPlanSimulationSheet } from './components/WorkPlanSimulationSheet';

const DEFAULT_GERENCIA_SHEETS = [
  'Activo Fijo',
  'AVE',
  'CE/GDP',
  'Conciliaciones Bancarias',
  'Consolidación Información Financiera',
  'Consolidación Operaciones',
  'CXP',
  'Depósito Bancario',
  'Eficiencia de Procesos',
  'Facturación',
  'Nómina',
  'Sbb, Importadoras y Extranjeras LPC',
  'Servicios',
  'Validaciones',
];

export default function App() {
  const [records, setRecords] = useState<ProcessRecord[]>(() => {
    try {
      // Clear legacy storage keys if present
      localStorage.removeItem('liverpool_dashboard_activities_v3');
      localStorage.removeItem('liverpool_dashboard_records_v4');
      const saved = localStorage.getItem('liverpool_dashboard_records_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasLegacySplit = parsed.some(
            (r: any) =>
              r.gerencia === 'Sbb' ||
              r.gerencia === 'Importadoras y Extranjeras LPC' ||
              r.gerencia === 'ARCHIVO GRAL'
          );
          if (!hasLegacySplit) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading saved records', e);
    }
    return INITIAL_RECORDS;
  });

  const [hasAuthenticatedDrive, setHasAuthenticatedDrive] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('liverpool_drive_auth_synced') === 'true';
    } catch {
      return false;
    }
  });

  const [activeSheet, setActiveSheet] = useState<'hoja1' | 'hoja2' | 'hoja3'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'hoja1') return 'hoja1';
      if (tab === 'hoja2') return 'hoja2';
      if (tab === 'hoja3') return 'hoja3';
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('hoja1')) return 'hoja1';
      if (hash.includes('hoja2')) return 'hoja2';
      if (hash.includes('hoja3')) return 'hoja3';
    } catch {
      // ignore
    }
    return 'hoja3';
  });

  const handleNavigateSheet = (sheet: 'hoja1' | 'hoja2' | 'hoja3') => {
    setActiveSheet(sheet);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', sheet);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };
  const [selectedSubdireccion, setSelectedSubdireccion] = useState<string>('ALL');
  const [selectedGerencia, setSelectedGerencia] = useState<string>('ALL');
  const [showWelcomeSyncModal, setShowWelcomeSyncModal] = useState<boolean>(false);
  const [isExportingExecutive, setIsExportingExecutive] = useState<boolean>(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    actionUrl?: string;
    actionLabel?: string;
  } | null>(null);
  const [syncConfig, setSyncConfig] = useState<SheetSyncConfig>({
    spreadsheetUrl: '',
    spreadsheetId: '',
    sheetNames: DEFAULT_GERENCIA_SHEETS,
    lastSyncedAt: null,
    sourceType: 'demo',
  });

  // If not authenticated, the app displays the dedicated full-screen login gate directly.
  // The user clicks to initiate Google Drive authentication, which ensures the popup is not blocked by browsers.

  // Subdirección summaries
  const allSubdireccionSummaries = useMemo(
    () => computeSubdireccionSummaries(records),
    [records]
  );

  const allSubdirecciones = useMemo(
    () => allSubdireccionSummaries.map((s) => s.subdireccion),
    [allSubdireccionSummaries]
  );

  // All Gerencia summaries (scoped by subdirección if one is selected)
  const allGerenciaSummaries = useMemo(() => {
    const gtes = computeGerenciaSummaries(records);
    if (selectedSubdireccion === 'ALL') return gtes;
    return gtes.filter(
      (g) => (g.subdireccion || inferSubdireccion(g.gerencia)) === selectedSubdireccion
    );
  }, [records, selectedSubdireccion]);

  // Scoped records when filtering by Subdirección and/or Gerencia
  const scopedRecords = useMemo(() => {
    let list = records;
    if (selectedSubdireccion !== 'ALL') {
      list = list.filter(
        (r) => (r.subdireccion || inferSubdireccion(r.gerencia)) === selectedSubdireccion
      );
    }
    if (selectedGerencia !== 'ALL') {
      list = list.filter((r) => r.gerencia === selectedGerencia);
    }
    return list;
  }, [records, selectedSubdireccion, selectedGerencia]);

  // Collaborator summaries (scoped by subdirección if one is selected)
  const colaboradorSummaries = useMemo(() => {
    const colabs = computeColaboradorSummaries(records);
    if (selectedSubdireccion !== 'ALL') {
      return colabs.filter(
        (c) => (c.subdireccion || inferSubdireccion(c.gerencia)) === selectedSubdireccion
      );
    }
    return colabs;
  }, [records, selectedSubdireccion]);

  const allGerenciaNames = useMemo(
    () =>
      [...allGerenciaSummaries.map((g) => g.gerencia)].sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      ),
    [allGerenciaSummaries]
  );

  const fullGerenciaNames = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.gerencia).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      ),
    [records]
  );

  // Global / Scoped KPI calculations
  const kpiMetrics = useMemo(() => {
    const macroByGerenciaCount = new Set(
      scopedRecords.map((r) => `${r.gerencia}:::${r.procesoMacro}`)
    ).size;
    const actividadesCount = new Set(
      scopedRecords.map((r) => `${r.gerencia}:::${(r.actividadProceso || '').trim().toLowerCase()}`)
    ).size;
    const totalFilasCount = scopedRecords.length;
    const colaboradoresCount = new Set(
      scopedRecords.map((r) => `${r.gerencia}:::${(r.responsableFuncional || '').trim().toLowerCase()}`)
    ).size;
    const gerenciasCount = new Set(scopedRecords.map((r) => r.gerencia)).size;

    let horasTotales = 0;
    let horasManuales = 0;
    let horasAutomatizadas = 0;
    let horasPotencialAutomatizable = 0;
    let tareasManualesEjecutadas = 0;
    let tareasConAutomatizacion = 0;

    scopedRecords.forEach((r) => {
      const hTot = normalizeNumber(r.horasMensualesTotal != null ? r.horasMensualesTotal : r.horasMensualesActividad);
      const hMan = normalizeNumber(r.horasManualesTotal != null ? r.horasManualesTotal : r.horasManuales);
      const hAut = normalizeNumber(r.horasMensualesAutomatizadas);

      horasTotales += hTot;
      horasManuales += hMan;
      horasAutomatizadas += hAut;

      const esAuto = r.esAutomatizable === 'Sí' || r.esAutomatizable === 'SÍ';
      if (esAuto) {
        horasPotencialAutomatizable += hMan;
      }
      if (hMan > 0) {
        tareasManualesEjecutadas += 1;
      }
      if (hAut > 0 || (r.porcentajeAutomatizado || 0) > 0) {
        tareasConAutomatizacion += 1;
      }
    });

    const pctAutomatizadoGlobal =
      horasTotales > 0 ? (horasAutomatizadas / horasTotales) * 100 : 0;
    const pctPotencialMeta =
      horasTotales > 0
        ? ((horasAutomatizadas + horasPotencialAutomatizable) / horasTotales) * 100
        : 0;
    const fteLiberables = horasPotencialAutomatizable / 152;

    return {
      gerenciasCount,
      macroByGerenciaCount,
      actividadesCount,
      totalFilasCount,
      colaboradoresCount,
      horasTotales: Number(horasTotales.toFixed(1)),
      horasManuales: Number(horasManuales.toFixed(1)),
      horasAutomatizadas: Number(horasAutomatizadas.toFixed(1)),
      horasPotencialAutomatizable: Number(horasPotencialAutomatizable.toFixed(1)),
      tareasManualesEjecutadas,
      tareasConAutomatizacion,
      pctAutomatizadoGlobal: Number(pctAutomatizadoGlobal.toFixed(1)),
      pctPotencialMeta: Number(pctPotencialMeta.toFixed(1)),
      fteLiberables: Number(fteLiberables.toFixed(2)),
    };
  }, [scopedRecords]);

  const handleDirectGoogleConnect = () => {
    if (isSyncingGoogle) return;
    setIsSyncingGoogle(true);
    setSyncStatus({
      type: 'info',
      text: 'Abriendo selector de cuentas de Google...',
    });

    requestGoogleAccessToken(
      async (accessToken: string) => {
        try {
          setSyncStatus({
            type: 'info',
            text: 'Conexión autorizada con Google. Descargando datos de las gerencias...',
          });

          const sheetId = DEFAULT_SPREADSHEET_ID;
          const result = await fetchSpreadsheetData(accessToken, sheetId);
          if (result.activities && result.activities.length > 0) {
            const imported = convertActivitiesToRecords(result.activities);
            setSelectedSubdireccion('ALL');
            setSelectedGerencia('ALL');
            setRecords(imported);
            setSyncConfig({
              spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
              spreadsheetId: sheetId,
              sheetNames: result.sheetNames,
              lastSyncedAt: new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              sourceType: 'google-sheets-url',
            });
            try {
              sessionStorage.setItem('liverpool_drive_auth_synced', 'true');
              localStorage.setItem('liverpool_dashboard_records_v5', JSON.stringify(imported));
            } catch (e) {
              console.warn('Error saving to storage', e);
            }
            setHasAuthenticatedDrive(true);
            handleNavigateSheet('hoja3');
            setSyncStatus({
              type: 'success',
              text: `¡Sincronización exitosa! Se cargaron ${imported.length} actividades en ${result.sheetNames.length} gerencias.`,
            });
            setTimeout(() => {
              setSyncStatus(null);
            }, 6000);
          } else {
            throw new Error('No se encontraron actividades con las columnas especificadas.');
          }
        } catch (err: any) {
          console.error(err);
          if (err instanceof GoogleApiDisabledError) {
            setSyncStatus({
              type: 'error',
              text: err.message,
              actionUrl: err.enableUrl,
              actionLabel: 'Habilitar Google Sheets API en Cloud Console',
            });
          } else {
            setSyncStatus({
              type: 'error',
              text: `Error al leer hojas: ${err?.message || 'Error de permisos o formato.'}`,
            });
          }
        } finally {
          setIsSyncingGoogle(false);
        }
      },
      (errorMsg: string) => {
        setIsSyncingGoogle(false);
        setSyncStatus({
          type: 'error',
          text:
            errorMsg.includes('popup') || errorMsg.includes('cancel')
              ? 'Ventana de inicio de sesión de Google cancelada o cerrada.'
              : errorMsg,
        });
        setTimeout(() => {
          setSyncStatus(null);
        }, 5000);
      }
    );
  };

  const handleAddSingleRecord = (newRec: ProcessRecord) => {
    setRecords((prev) => {
      const updated = [newRec, ...prev];
      try {
        localStorage.setItem('liverpool_dashboard_records_v5', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error caching records', e);
      }
      return updated;
    });
  };

  // If the user is not authenticated with Google Drive yet, display the full-screen login gate
  // This prevents exploring stale or unverified data without connecting
  if (!hasAuthenticatedDrive) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-xs w-full flex flex-col items-center space-y-3">
          {/* Status feedback only if actively connecting or error */}
          {syncStatus && (
            <div
              className={`w-full rounded-xl p-3 text-xs flex items-center justify-between gap-2 border ${
                syncStatus.type === 'error'
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  : 'bg-blue-950/80 border-blue-500/50 text-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {syncStatus.type === 'info' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                )}
                {syncStatus.type === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className="font-medium text-[11px]">{syncStatus.text}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleDirectGoogleConnect}
            disabled={isSyncingGoogle}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-xl shadow-lg transition-all cursor-pointer disabled:cursor-wait"
          >
            {isSyncingGoogle ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Conectando...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-5 h-5 text-sky-300" />
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Strict 3-Zone Corporate Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Tablero Inventario de Procesos
        </a>

        {/* Zone 2: Navigation links & Sheet tabs */}
        <nav className="hidden md:flex items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleNavigateSheet('hoja1')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors font-semibold cursor-pointer ${
              activeSheet === 'hoja1'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Hoja 1: Resumen</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavigateSheet('hoja2')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors font-semibold cursor-pointer ${
              activeSheet === 'hoja2'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Hoja 2: Estatus Únicas</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavigateSheet('hoja3')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors font-semibold cursor-pointer ${
              activeSheet === 'hoja3'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Hoja 3: Plan de Trabajo</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDirectGoogleConnect}
            disabled={isSyncingGoogle}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/80 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer disabled:cursor-wait"
            title="Sincronizar las hojas en tiempo real desde Google Drive"
          >
            {isSyncingGoogle ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualizar Google Drive</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Executive Workspace */}
      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Google Sync Status Notification Banner */}
        {syncStatus && (
          <div
            className={`rounded-lg p-3 text-xs flex items-center justify-between gap-3 border shadow-xs transition-all ${
              syncStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : syncStatus.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {syncStatus.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {syncStatus.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {syncStatus.type === 'info' && (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              )}
              <span className="font-medium">{syncStatus.text}</span>
              {syncStatus.actionUrl && (
                <a
                  href={syncStatus.actionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-rose-800 underline hover:text-rose-950 ml-1"
                >
                  {syncStatus.actionLabel || 'Ver detalles'}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSyncStatus(null)}
              className="p-1 rounded hover:bg-black/5 text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Primary Sheet Selector Bar */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleNavigateSheet('hoja1')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeSheet === 'hoja1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Hoja 1: Resumen y Carga Gerencial</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigateSheet('hoja2')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeSheet === 'hoja2'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>Hoja 2: Estatus de Actividades Únicas</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigateSheet('hoja3')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeSheet === 'hoja3'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Hoja 3: Plan de Trabajo y Simulación</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-2">
            <span className="hidden sm:inline">Pestaña activa:</span>
            <span className="font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {activeSheet === 'hoja1'
                ? 'Hoja 1 · Inventario Consolidado'
                : activeSheet === 'hoja2'
                ? 'Hoja 2 · Auditoría y Estatus'
                : 'Hoja 3 · Plan de Trabajo y Simulación'}
            </span>
          </div>
        </div>

        {activeSheet === 'hoja1' && (
          <>
            {/* Context & Connection Bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Estructura Oficial Multi-Gerencia</span>
              <span aria-hidden="true">·</span>
              <span>
                Fuente activa:{' '}
                <strong className="text-slate-800">
                  {syncConfig.sourceType === 'google-sheets-url'
                    ? `Google Sheets en Vivo (${syncConfig.sheetNames.length} Hojas Oficiales)`
                    : `Google Drive Sincronizado (${allGerenciaSummaries.length} Hojas)`}
                </strong>
              </span>
              {syncConfig.lastSyncedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Última sincronización {syncConfig.lastSyncedAt}</span>
                </>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight text-balance">
              Tablero Inventario de Procesos
            </h1>
          </div>

          {/* Workspace Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Selector Subdirección */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 text-xs">
              <Layers className="w-3.5 h-3.5 text-indigo-700" />
              <label htmlFor="vistaSubdireccionSelect" className="font-semibold text-slate-700 whitespace-nowrap">
                Subdirección:
              </label>
              <select
                id="vistaSubdireccionSelect"
                value={selectedSubdireccion}
                onChange={(e) => {
                  setSelectedSubdireccion(e.target.value);
                  setSelectedGerencia('ALL');
                }}
                className="bg-transparent font-semibold text-indigo-950 focus:outline-none cursor-pointer max-w-[210px] truncate"
              >
                <option value="ALL">
                  Todas las Subdirecciones ({allSubdireccionSummaries.length})
                </option>
                {allSubdirecciones.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector Gerencia */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-900" />
              <label htmlFor="vistaGerenciaSelect" className="font-semibold text-slate-700 whitespace-nowrap">
                Gerencia:
              </label>
              <select
                id="vistaGerenciaSelect"
                value={selectedGerencia}
                onChange={(e) => setSelectedGerencia(e.target.value)}
                className="bg-transparent font-semibold text-blue-950 focus:outline-none cursor-pointer max-w-[190px] truncate"
              >
                <option value="ALL">
                  Todas las Gerencias ({allGerenciaNames.length})
                </option>
                {allGerenciaNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Limpiar Filtros */}
            <button
              type="button"
              onClick={() => {
                setSelectedSubdireccion('ALL');
                setSelectedGerencia('ALL');
              }}
              disabled={selectedSubdireccion === 'ALL' && selectedGerencia === 'ALL'}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 shadow-2xs ${
                selectedSubdireccion !== 'ALL' || selectedGerencia !== 'ALL'
                  ? 'bg-blue-50 text-blue-900 border border-blue-300 hover:bg-blue-100 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title="Restablecer filtros de Subdirección y Gerencia"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${selectedSubdireccion !== 'ALL' || selectedGerencia !== 'ALL' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span>Limpiar filtros</span>
            </button>

            {/* Botón Descargar Resumen / Reporte (.xlsx): Hoja 1 (Sec 1 + Gráfica), Hoja 2 (Zoom Macro), Hoja 3 (Base Colaboradores) */}
            <button
              type="button"
              disabled={isExportingExecutive}
              onClick={async () => {
                try {
                  setIsExportingExecutive(true);
                  await exportExecutiveSummaryXlsx(
                    kpiMetrics,
                    allGerenciaSummaries,
                    colaboradorSummaries,
                    selectedGerencia,
                    `Reporte_Sec1_y_Sec2_${selectedGerencia === 'ALL' ? 'Consolidado' : selectedGerencia.replace(/\s+/g, '_')}.xlsx`
                  );
                } catch (err) {
                  console.error('Error al exportar reporte:', err);
                } finally {
                  setIsExportingExecutive(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-950 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-2xs cursor-pointer disabled:opacity-60"
              title="Descargar libro Excel: Hoja 1 (Sección 1 + Gráfica), Hoja 2 (Zoom Procesos Macro), Hoja 3 (Desglose Actividades por Proceso Macro) y Hoja 4 (Base de datos Sección 2 en orden de Sección 1)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              {isExportingExecutive ? 'Generando .xlsx...' : 'Descargar Resumen .xlsx'}
            </button>
          </div>
        </div>

        {/* Executive KPI Grid (4 High-Impact Metric Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Conteo de Procesos Macro */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden border-t-4 border-t-blue-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Procesos Macro Evaluados
                </span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                  {formatThousands(kpiMetrics.macroByGerenciaCount)}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-mono tabular-nums">
                  en {formatThousands(kpiMetrics.gerenciasCount)} gerencia(s)
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Promedio de{' '}
              <strong className="font-mono text-slate-800 font-bold">
                {formatThousands(
                  kpiMetrics.macroByGerenciaCount / Math.max(1, kpiMetrics.gerenciasCount),
                  1
                )}
              </strong>{' '}
              procesos macro por gerencia
            </div>
          </div>

          {/* KPI 2: Conteo de ACTIVIDAD / PROCESO */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden border-t-4 border-t-indigo-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Actividades / Procesos (Únicas)
                </span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <ListChecks className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                  {formatThousands(kpiMetrics.actividadesCount)}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono tabular-nums">
                  {formatThousands(kpiMetrics.totalFilasCount)} registros
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              <strong className="font-mono text-slate-800 font-bold">
                {formatThousands(kpiMetrics.actividadesCount)}
              </strong>{' '}
              actividades únicas ·{' '}
              <strong className="font-mono text-slate-800 font-bold">
                {formatThousands(kpiMetrics.colaboradoresCount)}
              </strong>{' '}
              colaboradores
            </div>
          </div>

          {/* KPI 3: Horas Mensuales Manuales */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden border-t-4 border-t-amber-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Horas Mensuales Manuales
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline">
                  <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                    {formatHours(kpiMetrics.horasManuales)}
                  </span>
                  <span className="ml-1 text-base font-bold text-slate-500">h</span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono tabular-nums">
                  {formatThousands(kpiMetrics.horasManuales / 152, 1)} FTE manual
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Promedio{' '}
              <strong className="font-mono text-slate-800 font-bold">
                {formatThousands(
                  kpiMetrics.horasManuales / Math.max(1, kpiMetrics.colaboradoresCount),
                  1
                )}{' '}
                h/mes
              </strong>{' '}
              manuales por responsable funcional
            </div>
          </div>

          {/* KPI 4: Volumen Horas Manuales vs Automatizadas y Total */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden border-t-4 border-t-indigo-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Horas Manuales vs. Automatizadas
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono tabular-nums" title="Horas Mensuales Actividad (Total)">
                  Total: {formatHours(kpiMetrics.horasTotales)} h
                </span>
              </div>

              {/* Dual Metric Highlights */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-2 text-left">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Manuales
                  </div>
                  <div className="mt-0.5 text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-950 tracking-tight">
                    {formatHours(kpiMetrics.horasManuales)}
                    <span className="text-xs font-semibold text-amber-700 ml-0.5">h</span>
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/70 rounded-lg p-2 text-left">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Auto
                  </div>
                  <div className="mt-0.5 text-xl sm:text-2xl font-black font-mono tabular-nums text-blue-950 tracking-tight">
                    {formatHours(kpiMetrics.horasAutomatizadas)}
                    <span className="text-xs font-semibold text-blue-700 ml-0.5">h</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                <div
                  style={{ width: `${kpiMetrics.pctAutomatizadoGlobal}%` }}
                  className="bg-blue-600 h-full"
                />
                <div
                  style={{ width: `${100 - kpiMetrics.pctAutomatizadoGlobal}%` }}
                  className="bg-amber-400 h-full"
                />
              </div>
              <div className="text-[11px] font-bold flex justify-between items-center font-mono tabular-nums text-slate-600">
                <span className="text-blue-700 font-extrabold">{formatThousands(kpiMetrics.pctAutomatizadoGlobal, 1)}% auto</span>
                <span className="text-slate-500 font-semibold text-[10px] hidden sm:inline">
                  Total Actividad: <strong className="font-mono text-slate-800">{formatHours(kpiMetrics.horasTotales)} h</strong> ({formatThousands(kpiMetrics.horasTotales / 152, 1)} FTE)
                </span>
                <span className="text-amber-800 font-extrabold">{formatThousands(100 - kpiMetrics.pctAutomatizadoGlobal, 1)}% manual</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfica Comparativa por Gerencia: Horas Manuales vs. Automatizadas y Volumen de Actividades */}
        <GerenciasChartSection
          summaries={allGerenciaSummaries}
          selectedGerencia={selectedGerencia}
          onSelectGerencia={setSelectedGerencia}
        />

        {/* Cuadro Resumen a Nivel Subdirección y Filtro Organizacional */}
        <SubdireccionSummarySection
          subdirecciones={allSubdireccionSummaries}
          selectedSubdireccion={selectedSubdireccion}
          selectedGerencia={selectedGerencia}
          onSelectSubdireccion={(sub) => {
            setSelectedSubdireccion(sub);
            setSelectedGerencia('ALL');
          }}
          onSelectGerencia={(gerencia, subdireccion) => {
            setSelectedGerencia(gerencia);
            if (subdireccion && subdireccion !== 'ALL') {
              setSelectedSubdireccion(subdireccion);
            }
          }}
        />

        {/* Section 01: Consolidated Gerencia Pivot Table & Visual Indicators */}
        <GerenciaPivotSection
          summaries={allGerenciaSummaries}
          records={records}
          selectedGerencia={selectedGerencia}
          onSelectGerencia={setSelectedGerencia}
        />

        {/* Section 02: Collaborator Workload & Task Volume by Gerencia */}
        <ColaboradoresByGerenciaSection
          colaboradores={colaboradorSummaries}
          records={records}
          selectedGerencia={selectedGerencia}
          onSelectGerencia={setSelectedGerencia}
          allGerencias={allGerenciaNames}
        />

        {/* Section 03 & 04: Multi-Dimension Pivot Explorer & 14-Column Master Sheet */}
        <DynamicCatalogSection
          records={records}
          selectedSubdireccion={selectedSubdireccion}
          selectedGerencia={selectedGerencia}
          onAddRecord={handleAddSingleRecord}
        />
      </>
    )}

    {activeSheet === 'hoja2' && (
      <UniqueActivitiesStatusSheet
        records={records}
        selectedGerencia={selectedGerencia}
        onSelectGerencia={setSelectedGerencia}
        allGerencias={fullGerenciaNames}
      />
    )}

    {activeSheet === 'hoja3' && (
      <WorkPlanSimulationSheet
        records={records}
        allGerencias={fullGerenciaNames}
      />
    )}
  </main>

      {/* Quiet Corporate Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Tablero Inventario de Procesos · Estructura Multi-Hoja por Gerencia
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleDirectGoogleConnect}
              disabled={isSyncingGoogle}
              className="text-blue-800 hover:underline font-medium cursor-pointer disabled:opacity-60"
            >
              {isSyncingGoogle ? 'Conectando con Google...' : 'Sincronizar Google Sheets'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
