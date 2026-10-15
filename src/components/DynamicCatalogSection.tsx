import React, { useState, useMemo } from 'react';
import {
  Table,
  Plus,
  Search,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { ProcessRecord } from '../types/sheets';
import { formatThousands, formatHours } from '../utils/sheetsParser';

interface DynamicCatalogSectionProps {
  records: ProcessRecord[];
  selectedGerencia: string;
  onAddRecord: (newRec: ProcessRecord) => void;
}

export function DynamicCatalogSection({
  records,
  selectedGerencia,
  onAddRecord,
}: DynamicCatalogSectionProps) {
  const [activeTab, setActiveTab] = useState<'pivot' | 'master'>('master');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDigitalizado, setFilterDigitalizado] = useState<string>('ALL');
  const [filterAutomatizable, setFilterAutomatizable] = useState<string>('ALL');
  const [filterTipoProceso, setFilterTipoProceso] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  // New Record Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newRecordForm, setNewRecordForm] = useState({
    gerencia: selectedGerencia !== 'ALL' ? selectedGerencia : 'Gerencia de Operaciones',
    areaSubArea: '',
    tipoProceso: 'OPERATIVO',
    procesoMacro: '',
    actividadProceso: '',
    frecuencia: 'Mensual',
    puesto: 'Especialista',
    responsableFuncional: '',
    digitalizado: 'No',
    esAutomatizable: 'Sí',
    herramienta: 'Excel',
    porcentajeAutomatizado: 0,
    horasMensualesTotal: 20,
    horasMensualesAutomatizadas: 0,
    horasManualesTotal: 20,
  });

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchGerencia = selectedGerencia === 'ALL' || r.gerencia === selectedGerencia;
      const matchSearch =
        searchTerm === '' ||
        r.actividadProceso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.responsableFuncional.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.procesoMacro.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.herramienta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.areaSubArea.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDig =
        filterDigitalizado === 'ALL' ||
        (filterDigitalizado === 'Sí' && (r.digitalizado === 'Sí' || r.digitalizado === 'SÍ')) ||
        (filterDigitalizado === 'No' && (r.digitalizado === 'No' || r.digitalizado === 'NO'));

      const matchAuto =
        filterAutomatizable === 'ALL' ||
        (filterAutomatizable === 'Sí' && (r.esAutomatizable === 'Sí' || r.esAutomatizable === 'SÍ')) ||
        (filterAutomatizable === 'No' && (r.esAutomatizable === 'No' || r.esAutomatizable === 'NO'));

      const matchTipo = filterTipoProceso === 'ALL' || r.tipoProceso === filterTipoProceso;

      return matchGerencia && matchSearch && matchDig && matchAuto && matchTipo;
    });
  }, [records, selectedGerencia, searchTerm, filterDigitalizado, filterAutomatizable, filterTipoProceso]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  // Pivot Aggregations by Proceso Macro
  const pivotByMacro = useMemo(() => {
    const map = new Map<string, ProcessRecord[]>();
    for (const r of filteredRecords) {
      const macro = r.procesoMacro || 'General';
      if (!map.has(macro)) map.set(macro, []);
      map.get(macro)!.push(r);
    }

    return Array.from(map.entries())
      .map(([macro, items]) => {
        const totalHoras = items.reduce(
          (sum, it) => sum + (it.horasMensualesTotal || it.horasMensualesActividad || 0),
          0
        );
        const totalManuales = items.reduce(
          (sum, it) => sum + (it.horasManualesTotal || it.horasManuales || 0),
          0
        );
        const totalAuto = items.reduce((sum, it) => sum + (it.horasMensualesAutomatizadas || 0), 0);
        const colabs = new Set(items.map((it) => it.responsableFuncional)).size;
        const pctAuto = totalHoras > 0 ? (totalAuto / totalHoras) * 100 : 0;

        return {
          macro,
          gerencia: items[0]?.gerencia || '',
          tareasCount: items.length,
          colaboradoresCount: colabs,
          totalHoras: Number(totalHoras.toFixed(1)),
          totalManuales: Number(totalManuales.toFixed(1)),
          totalAuto: Number(totalAuto.toFixed(1)),
          pctAuto: Number(pctAuto.toFixed(1)),
        };
      })
      .sort((a, b) => b.totalHoras - a.totalHoras);
  }, [filteredRecords]);

  const handleSaveNewRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordForm.actividadProceso || !newRecordForm.responsableFuncional) return;

    const hTot = Number(newRecordForm.horasMensualesTotal) || 0;
    const hAuto = Number(newRecordForm.horasMensualesAutomatizadas) || 0;
    const hMan = Math.max(0, hTot - hAuto);
    const pct = hTot > 0 ? Number(((hAuto / hTot) * 100).toFixed(1)) : 0;

    const newRecord: ProcessRecord = {
      id: `custom-${Date.now()}`,
      gerencia: newRecordForm.gerencia,
      areaSubArea: newRecordForm.areaSubArea || newRecordForm.gerencia,
      tipoProceso: newRecordForm.tipoProceso,
      procesoMacro: newRecordForm.procesoMacro || 'General',
      actividadProceso: newRecordForm.actividadProceso,
      frecuencia: newRecordForm.frecuencia,
      puesto: newRecordForm.puesto,
      responsableFuncional: newRecordForm.responsableFuncional,
      digitalizado: newRecordForm.digitalizado,
      esAutomatizable: newRecordForm.esAutomatizable,
      herramienta: newRecordForm.herramienta || 'N/A',
      porcentajeAutomatizado: pct,
      horasMensualesTotal: hTot,
      horasMensualesActividad: hTot,
      horasMensualesAutomatizadas: hAuto,
      horasManualesTotal: hMan,
      horasManuales: hMan,
    };

    onAddRecord(newRecord);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Target for Header anchor #matriz-dinamica */}
      <div id="matriz-dinamica" className="scroll-mt-20" />

      {/* Target for Header anchor #catalogo-actividades */}
      <div id="catalogo-actividades" className="scroll-mt-20" />

      <section className="space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-900 rounded">
                Sección 03 & 04
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-800" />
                Matriz Dinámica y Catálogo Maestro (14 Columnas)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Exploración detallada de todas las filas y columnas del Google Sheets corporativo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('master')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'master'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Catálogo 14 Columnas ({formatThousands(filteredRecords.length)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pivot')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'pivot'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriz Pivot por Macro ({formatThousands(pivotByMacro.length)})
              </button>
            </div>

            {/* Add Record Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Actividad
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar actividad, responsable, macro, herramienta..."
              className="w-full text-xs px-3 py-1.5 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">¿Digitalizado?:</span>
              <select
                value={filterDigitalizado}
                onChange={(e) => {
                  setFilterDigitalizado(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded focus:outline-none"
              >
                <option value="ALL">Todos</option>
                <option value="Sí">Sí</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">¿Automatizable?:</span>
              <select
                value={filterAutomatizable}
                onChange={(e) => {
                  setFilterAutomatizable(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded focus:outline-none"
              >
                <option value="ALL">Todos</option>
                <option value="Sí">Sí</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">Tipo:</span>
              <select
                value={filterTipoProceso}
                onChange={(e) => {
                  setFilterTipoProceso(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded focus:outline-none"
              >
                <option value="ALL">Todos los Tipos</option>
                <option value="OPERATIVO">OPERATIVO</option>
                <option value="SEGUIMIENTO / GESTIÓN">SEGUIMIENTO / GESTIÓN</option>
                <option value="ESTRATÉGICO">ESTRATÉGICO</option>
              </select>
            </div>
          </div>
        </div>

        {/* TAB 1: 14-Column Master Sheet */}
        {activeTab === 'master' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800 whitespace-nowrap">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Gerencia</th>
                    <th className="py-2.5 px-3">Area / Sub Area</th>
                    <th className="py-2.5 px-3">TIPO DE PROCESO</th>
                    <th className="py-2.5 px-3">PROCESO MACRO</th>
                    <th className="py-2.5 px-4 min-w-[240px]">ACTIVIDAD / PROCESO</th>
                    <th className="py-2.5 px-3 text-center">FRECUENCIA</th>
                    <th className="py-2.5 px-3">PUESTO</th>
                    <th className="py-2.5 px-3 font-bold text-sky-200">REPONSABLE FUNCIONAL</th>
                    <th className="py-2.5 px-3 text-center">¿DIGITALIZADO?</th>
                    <th className="py-2.5 px-3 text-center">¿ES AUTOMATIZABLE?</th>
                    <th className="py-2.5 px-3">HERRAMIENTA</th>
                    <th className="py-2.5 px-3 text-center">% AUTO.</th>
                    <th className="py-2.5 px-3 text-right">Horas Actividad</th>
                    <th className="py-2.5 px-3 text-right">Horas Auto.</th>
                    <th className="py-2.5 px-3 text-right">Horas Manuales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-8 text-center text-slate-500">
                        No se encontraron actividades con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r, idx) => {
                      const rowNum = (page - 1) * pageSize + idx + 1;
                      const hTot = r.horasMensualesTotal || r.horasMensualesActividad || 0;
                      const hAuto = r.horasMensualesAutomatizadas || 0;
                      const hMan = r.horasManualesTotal || r.horasManuales || 0;

                      return (
                        <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-mono">{rowNum}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {r.gerencia}
                          </td>
                          <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{r.areaSubArea}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                              {r.tipoProceso}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-blue-950 whitespace-nowrap">
                            {r.procesoMacro}
                          </td>
                          <td className="py-2 px-4 text-slate-900 font-medium">
                            {r.actividadProceso}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap text-slate-600">
                            {r.frecuencia}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{r.puesto}</td>
                          <td className="py-2 px-3 font-semibold text-blue-900 whitespace-nowrap">
                            {r.responsableFuncional}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.digitalizado === 'Sí' || r.digitalizado === 'SÍ'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {r.digitalizado}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.esAutomatizable === 'Sí' || r.esAutomatizable === 'SÍ'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {r.esAutomatizable}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {r.herramienta || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold whitespace-nowrap text-blue-800">
                            {formatThousands(r.porcentajeAutomatizado, 1)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-medium">
                            {formatHours(hTot)} h
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-blue-800 font-semibold">
                            {formatHours(hAuto)} h
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                            {formatHours(hMan)} h
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Mostrando{' '}
                <strong className="text-slate-900 font-mono">
                  {formatThousands(Math.min(filteredRecords.length, (page - 1) * pageSize + 1))}-
                  {formatThousands(Math.min(filteredRecords.length, page * pageSize))}
                </strong>{' '}
                de <strong className="text-slate-900 font-mono">{formatThousands(filteredRecords.length)}</strong>{' '}
                actividades
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-300 rounded hover:bg-white disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs">
                  Página {formatThousands(page)} de {formatThousands(totalPages)}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 border border-slate-300 rounded hover:bg-white disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic Pivot View by Proceso Macro */}
        {activeTab === 'pivot' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                    <th className="py-3 px-4 font-medium tracking-wide">Proceso Macro</th>
                    <th className="py-3 px-3 font-medium tracking-wide">Gerencia</th>
                    <th className="py-3 px-3 text-center font-medium tracking-wide">Actividades</th>
                    <th className="py-3 px-3 text-center font-medium tracking-wide">Colaboradores</th>
                    <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Totales</th>
                    <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Manuales</th>
                    <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Auto.</th>
                    <th className="py-3 px-4 text-center font-medium tracking-wide min-w-[140px]">
                      % Automatizado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pivotByMacro.map((item) => (
                    <tr key={item.macro} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.macro}</td>
                      <td className="py-3 px-3 text-slate-700">{item.gerencia}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-950">
                        {formatThousands(item.tareasCount)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {formatThousands(item.colaboradoresCount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatHours(item.totalHoras)} h
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatHours(item.totalManuales)} h
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-blue-800">
                        {formatHours(item.totalAuto)} h
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${item.pctAuto}%` }}
                              className="bg-blue-700 h-full"
                            />
                          </div>
                          <span className="font-mono tabular-nums text-[11px] font-bold text-slate-800 w-10 text-right">
                            {formatThousands(item.pctAuto, 1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Add Single Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <h3 className="text-sm font-bold">Agregar Nueva Actividad / Proceso</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Gerencia</label>
                  <input
                    type="text"
                    required
                    value={newRecordForm.gerencia}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, gerencia: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Area / Sub Area</label>
                  <input
                    type="text"
                    value={newRecordForm.areaSubArea}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, areaSubArea: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Proceso Macro</label>
                  <input
                    type="text"
                    required
                    value={newRecordForm.procesoMacro}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, procesoMacro: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tipo de Proceso</label>
                  <select
                    value={newRecordForm.tipoProceso}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, tipoProceso: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="OPERATIVO">OPERATIVO</option>
                    <option value="SEGUIMIENTO / GESTIÓN">SEGUIMIENTO / GESTIÓN</option>
                    <option value="ESTRATÉGICO">ESTRATÉGICO</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Actividad / Proceso</label>
                <textarea
                  required
                  rows={2}
                  value={newRecordForm.actividadProceso}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, actividadProceso: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Responsable Funcional</label>
                  <input
                    type="text"
                    required
                    value={newRecordForm.responsableFuncional}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, responsableFuncional: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Puesto</label>
                  <input
                    type="text"
                    value={newRecordForm.puesto}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, puesto: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Frecuencia</label>
                  <input
                    type="text"
                    value={newRecordForm.frecuencia}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, frecuencia: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">¿Digitalizado?</label>
                  <select
                    value={newRecordForm.digitalizado}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, digitalizado: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  >
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">¿Es Automatizable?</label>
                  <select
                    value={newRecordForm.esAutomatizable}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, esAutomatizable: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  >
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Horas Mensuales (Total)</label>
                  <input
                    type="number"
                    min="0"
                    value={newRecordForm.horasMensualesTotal}
                    onChange={(e) =>
                      setNewRecordForm({
                        ...newRecordForm,
                        horasMensualesTotal: Number(e.target.value),
                        horasManualesTotal: Math.max(0, Number(e.target.value) - newRecordForm.horasMensualesAutomatizadas),
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Horas Automatizadas</label>
                  <input
                    type="number"
                    min="0"
                    value={newRecordForm.horasMensualesAutomatizadas}
                    onChange={(e) =>
                      setNewRecordForm({
                        ...newRecordForm,
                        horasMensualesAutomatizadas: Number(e.target.value),
                        horasManualesTotal: Math.max(0, newRecordForm.horasMensualesTotal - Number(e.target.value)),
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 text-white rounded font-semibold hover:bg-blue-800"
                >
                  Guardar Actividad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
