import React, { useState } from 'react';
import { Check, Clipboard, Sparkles, Table, Upload, X } from 'lucide-react';
import { parseCsvText, parseRowsToActivities } from '../services/googleDriveService';
import { ActivityItem } from '../types/dashboard';

interface PasteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportActivities: (activities: ActivityItem[], gerenciaName: string, mode: 'merge' | 'replace') => void;
  availableGerencias: string[];
}

export const PasteDataModal: React.FC<PasteDataModalProps> = ({
  isOpen,
  onClose,
  onImportActivities,
  availableGerencias,
}) => {
  const [pastedText, setPastedText] = useState('');
  const [targetGerencia, setTargetGerencia] = useState('Gerencia de Nómina');
  const [customGerencia, setCustomGerencia] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('replace');
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handlePreview = () => {
    if (!pastedText.trim()) return;
    const gerenciaName = customGerencia.trim() || targetGerencia;
    const rows = parseCsvText(pastedText);
    const parsed = parseRowsToActivities(rows, gerenciaName);
    setPreviewCount(parsed.length);
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;

    const gerenciaName = customGerencia.trim() || targetGerencia;
    const rows = parseCsvText(pastedText);
    const parsed = parseRowsToActivities(rows, gerenciaName);

    if (parsed.length > 0) {
      onImportActivities(parsed, gerenciaName, importMode);
      setPastedText('');
      setPreviewCount(null);
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
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Pegar Datos de Hoja de Cálculo
              </h3>
              <p className="text-xs text-slate-500">
                Copia y pega directamente celdas desde Google Sheets o Excel
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

        {/* Form Body */}
        <form onSubmit={handleImport} className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Gerencia selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Gerencia de Destino (Hoja)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={targetGerencia}
                onChange={(e) => {
                  setTargetGerencia(e.target.value);
                  setCustomGerencia('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-[#E1197E]"
              >
                <option value="Facturación">Facturación</option>
                <option value="Pagos">Pagos</option>
                <option value="CXC">CXC</option>
                <option value="Importaciones">Importaciones</option>
                <option value="Gastos de Viaje">Gastos de Viaje</option>
                <option value="REP & NC">REP & NC</option>
                <option value="ARCHIVO GRAL">ARCHIVO GRAL</option>
                <option value="Coordinación">Coordinación</option>
                <option value="Gerencia">Gerencia</option>
                <option value="Control Interno">Control Interno</option>
                <option value="KPI y Reportes">KPI y Reportes</option>
                {availableGerencias.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="O escribe otro nombre de Gerencia..."
                value={customGerencia}
                onChange={(e) => setCustomGerencia(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#E1197E]"
              />
            </div>
          </div>

          {/* Paste Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pega aquí las filas copiadas (con encabezados)
              </label>
              <span className="text-[11px] text-slate-400">
                Soporta tabulaciones (\t) y comas (CSV/TSV)
              </span>
            </div>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                setPreviewCount(null);
              }}
              placeholder={`Area / Sub Area\tTIPO DE PROCESO\tPROCESO MACRO\tACTIVIDAD / PROCESO\tFRECUENCIA\tPUESTO\tREPONSABLE FUNCIONAL\t¿DIGITALIZADO?\t¿ES AUTOMATIZABLE?\tHERRAMIENTA\t% AUTOMATIZADO\tHoras mensuales Actividad (Total)\tHoras mensuales Automatizadas (Total)\tHoras manuales (Total)\nNomina\tOPERATIVO\tTermidor\tRegistro y timbrado...\tMENSUAL\tEspecialista de Nómina\tDiana Alvarez\tNO\tNO\tN/A\t0%\t6\t0\t6`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 focus:outline-none focus:border-[#E1197E] focus:bg-white resize-y"
            />
          </div>

          {/* Import Mode Options */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="accent-[#E1197E]"
              />
              <span>Reemplazar actividades de esta Gerencia</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
                className="accent-[#E1197E]"
              />
              <span>Agregar a las existentes</span>
            </label>
          </div>

          {/* Preview button */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePreview}
              className="text-xs text-indigo-700 font-bold hover:underline"
            >
              Probar análisis de datos
            </button>
            {previewCount !== null && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                ✓ {previewCount} actividades detectadas con éxito
              </span>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!pastedText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E1197E] hover:bg-[#c9146f] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar en el Tablero</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
