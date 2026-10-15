import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Link,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Info,
} from 'lucide-react';
import { ProcessRecord, SheetSyncConfig } from '../types/sheets';
import {
  DEFAULT_SPREADSHEET_ID,
  extractSpreadsheetId,
  fetchSpreadsheetData,
  GoogleApiDisabledError,
  GOOGLE_PROJECT_ID,
  parseExcelBuffer,
  requestGoogleAccessToken,
  SHEETS_API_ENABLE_URL,
} from '../services/googleDriveService';
import { normalizeNumber, parsePastedTableText } from '../utils/sheetsParser';

interface ConnectSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRecords: ProcessRecord[];
  syncConfig: SheetSyncConfig;
  onImportSuccess: (
    importedRecords: ProcessRecord[],
    config: SheetSyncConfig,
    mode: 'replace' | 'merge'
  ) => void;
}

export function ConnectSheetsModal({
  isOpen,
  onClose,
  syncConfig,
  onImportSuccess,
}: ConnectSheetsModalProps) {
  const [activeTab, setActiveTab] = useState<'oauth' | 'upload' | 'url' | 'paste'>('oauth');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(
    syncConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`
  );
  const [pastedText, setPastedText] = useState<string>('');
  const [defaultGerenciaName, setDefaultGerenciaName] = useState<string>('Gerencia de Operaciones');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    actionUrl?: string;
    actionLabel?: string;
  } | null>(null);

  if (!isOpen) return null;

  // Convert ActivityItem[] from googleDriveService into ProcessRecord[]
  const convertActivitiesToRecords = (acts: any[]): ProcessRecord[] => {
    return acts.map((a, idx) => {
      const hTot = normalizeNumber(a.horasMensualesTotal != null ? a.horasMensualesTotal : a.horasMensualesActividad);
      const hMan = normalizeNumber(a.horasManualesTotal != null ? a.horasManualesTotal : a.horasManuales);
      const hAut = normalizeNumber(a.horasMensualesAutomatizadas);

      return {
        id: a.id || `rec-${idx}-${Date.now()}`,
        gerencia: (a.gerencia || 'General').trim(),
        areaSubArea: (a.areaSubArea || a.gerencia || 'General').trim(),
        tipoProceso: a.tipoProceso || 'OPERATIVO',
        procesoMacro: a.procesoMacro || 'General',
        actividadProceso: a.actividadProceso || 'Actividad',
        frecuencia: a.frecuencia || 'Mensual',
        puesto: a.puesto || 'Especialista',
        responsableFuncional: (a.responsableFuncional || 'Sin Asignar').replace(/\s+/g, ' ').trim(),
        digitalizado: a.digitalizado === 'SÍ' || a.digitalizado === 'Sí' ? 'Sí' : 'No',
        esAutomatizable: a.esAutomatizable === 'SÍ' || a.esAutomatizable === 'Sí' ? 'Sí' : 'No',
        herramienta: a.herramienta || 'N/A',
        porcentajeAutomatizado: typeof a.porcentajeAutomatizado === 'number' ? a.porcentajeAutomatizado : 0,
        horasMensualesTotal: hTot,
        horasMensualesActividad: hTot,
        horasMensualesAutomatizadas: hAut,
        horasManualesTotal: hMan,
        horasManuales: hMan,
        satisfaccionOperativa: a.satisfaccionOperativa,
      };
    });
  };

  // 1. Google OAuth Live Connect
  const handleGoogleAuthConnect = () => {
    setIsLoading(true);
    setStatusMessage({
      type: 'info',
      text: 'Abriendo ventana de inicio de sesión con Google...',
    });

    requestGoogleAccessToken(
      async (accessToken: string) => {
        try {
          const sheetId = extractSpreadsheetId(spreadsheetInput);
          setStatusMessage({
            type: 'info',
            text: 'Conexión autorizada. Descargando todas las pestañas por Gerencia...',
          });

          const result = await fetchSpreadsheetData(accessToken, sheetId);
          if (result.activities && result.activities.length > 0) {
            const records = convertActivitiesToRecords(result.activities);
            onImportSuccess(
              records,
              {
                spreadsheetUrl: spreadsheetInput,
                spreadsheetId: sheetId,
                sheetNames: result.sheetNames,
                lastSyncedAt: new Date().toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                sourceType: 'google-sheets-url',
              },
              importMode
            );
            setStatusMessage({
              type: 'success',
              text: `¡Sincronización exitosa! Se cargaron ${records.length} actividades en ${result.sheetNames.length} gerencias.`,
            });
            setTimeout(() => onClose(), 1200);
          } else {
            throw new Error('No se encontraron actividades con las columnas especificadas.');
          }
        } catch (err: any) {
          console.error(err);
          if (err instanceof GoogleApiDisabledError) {
            setStatusMessage({
              type: 'error',
              text: err.message,
              actionUrl: err.enableUrl,
              actionLabel: 'Habilitar Google Sheets API en Cloud Console',
            });
          } else {
            setStatusMessage({
              type: 'error',
              text: `Error al leer hojas: ${err?.message || 'Error de permisos o formato.'}`,
            });
          }
        } finally {
          setIsLoading(false);
        }
      },
      (error: string) => {
        setIsLoading(false);
        setStatusMessage({
          type: 'error',
          text: error,
        });
      }
    );
  };

  // 2. Upload Excel .XLSX
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Procesando libro "${file.name}"...` });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const { activities, sheetNames } = parseExcelBuffer(buffer);
        if (activities.length > 0) {
          const records = convertActivitiesToRecords(activities);
          onImportSuccess(
            records,
            {
              spreadsheetUrl: '',
              spreadsheetId: '',
              sheetNames,
              lastSyncedAt: new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              sourceType: 'xlsx-upload',
              fileName: file.name,
            },
            importMode
          );
          setStatusMessage({
            type: 'success',
            text: `¡Cargado con éxito! Se importaron ${records.length} actividades distribuidas en ${sheetNames.length} gerencias (${sheetNames.join(', ')}).`,
          });
          setTimeout(() => onClose(), 1200);
        } else {
          setStatusMessage({
            type: 'error',
            text: 'El archivo Excel no contiene hojas operativas con las columnas requeridas.',
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: `Error al leer el archivo Excel: ${err?.message || 'Archivo corrupto.'}`,
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 3. Paste Clipboard Table
  const handleProcessPastedData = () => {
    if (!pastedText.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor pega los datos de la tabla.' });
      return;
    }

    try {
      const records = parsePastedTableText(pastedText, defaultGerenciaName);
      if (records.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No se detectaron filas válidas. Asegúrate de incluir el encabezado con las columnas.',
        });
        return;
      }

      onImportSuccess(
        records,
        {
          spreadsheetUrl: '',
          spreadsheetId: '',
          sheetNames: [defaultGerenciaName],
          lastSyncedAt: new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sourceType: 'clipboard',
        },
        importMode
      );
      setStatusMessage({
        type: 'success',
        text: `¡Se importaron ${records.length} actividades correctamente!`,
      });
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error al procesar texto: ${err?.message}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Conectar Fuente de Datos Multi-Gerencia
              </h2>
              <p className="text-xs text-slate-300">
                Sincroniza en tiempo real con Google Drive, Google Sheets o archivos .XLSX
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('oauth')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'oauth'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
            Google Drive & Sheets en Vivo
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            Subir Archivo .XLSX
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-blue-700" />
            Pegar Portapapeles
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Mode Selector */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="font-semibold text-slate-700">Modo de actualización:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-800">Reemplazar tablero actual</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-800">Combinar con existentes</span>
              </label>
            </div>
          </div>

          {/* TAB 1: Google OAuth & Sheets API */}
          {activeTab === 'oauth' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Enlace o ID de la Hoja de Google Sheets
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1_8MYUUiNlDN.../edit"
                    className="w-full text-xs px-3 py-2.5 pl-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <Link className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-500">
                  El libro debe contener pestañas nombradas por cada gerencia con las 14 columnas de análisis.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-950">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Conexión Segura con Google Identity:</span>
                    <p className="mt-0.5 text-blue-900/90 leading-relaxed">
                      Al presionar el botón se abrirá el cuadro oficial de Google para autenticar tu cuenta institucional de Liverpool. La lectura se realiza directamente en tu navegador hacia Google Sheets API.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuthConnect}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sincronizando con Google Sheets...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    Iniciar Sesión con Google y Sincronizar
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: XLSX Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition-colors bg-slate-50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="excelFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="p-3 bg-blue-100 text-blue-800 rounded-full">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 block">
                      Haz clic para seleccionar o arrastra tu archivo Excel (.xlsx / .xls)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Soporta libros multi-pestaña por Gerencia con las 14 columnas
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Paste from Clipboard */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nombre de Gerencia Asignada (si no viene en la columna)
                </label>
                <input
                  type="text"
                  value={defaultGerenciaName}
                  onChange={(e) => setDefaultGerenciaName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Pega los renglones copiados de tu hoja de cálculo
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={6}
                  placeholder={`Area / Sub Area\tTIPO DE PROCESO\tPROCESO MACRO\tACTIVIDAD / PROCESO\tFRECUENCIA\tPUESTO\tREPONSABLE FUNCIONAL\t¿DIGITALIZADO?\t¿ES AUTOMATIZABLE?\tHERRAMIENTA\t% AUTOMATIZADO\tHoras mensuales Actividad (Total)\tHoras mensuales Automatizadas (Total)\tHoras manuales (Total)`}
                  className="w-full text-xs p-3 font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={handleProcessPastedData}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Procesar e Incorporar al Tablero
              </button>
            </div>
          )}

          {/* Status / Feedback Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div>{statusMessage.text}</div>
                {statusMessage.actionUrl && (
                  <a
                    href={statusMessage.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline pt-1"
                  >
                    <span>{statusMessage.actionLabel || 'Ver solución'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
