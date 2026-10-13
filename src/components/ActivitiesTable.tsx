import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Filter,
  Layers,
  Search,
  Sparkles,
  Table,
  Zap,
} from 'lucide-react';
import { ActivityItem } from '../types/dashboard';

interface ActivitiesTableProps {
  activities: ActivityItem[];
  selectedGerenciaName: string;
}

export const ActivitiesTable: React.FC<ActivitiesTableProps> = ({
  activities,
  selectedGerenciaName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDigitalizado, setFilterDigitalizado] = useState<string>('ALL');
  const [filterAutomatizable, setFilterAutomatizable] = useState<string>('ALL');
  const [filterFrecuencia, setFilterFrecuencia] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof ActivityItem>('horasManuales');
  const [sortAsc, setSortAsc] = useState(false);

  // Filter list
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      // Gerencia filter
      if (selectedGerenciaName && item.gerencia !== selectedGerenciaName) {
        return false;
      }

      // Digitalizado
      if (filterDigitalizado !== 'ALL' && item.digitalizado !== filterDigitalizado) {
        return false;
      }

      // Automatizable
      if (filterAutomatizable !== 'ALL' && item.esAutomatizable !== filterAutomatizable) {
        return false;
      }

      // Frecuencia
      if (filterFrecuencia !== 'ALL' && item.frecuencia !== filterFrecuencia) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          item.actividadProceso.toLowerCase().includes(query) ||
          item.procesoMacro.toLowerCase().includes(query) ||
          item.areaSubArea.toLowerCase().includes(query) ||
          item.puesto.toLowerCase().includes(query) ||
          item.responsableFuncional.toLowerCase().includes(query) ||
          item.herramienta.toLowerCase().includes(query) ||
          item.gerencia.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [activities, selectedGerenciaName, filterDigitalizado, filterAutomatizable, filterFrecuencia, searchTerm]);

  // Sort list
  const sortedActivities = useMemo(() => {
    return [...filteredActivities].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredActivities, sortField, sortAsc]);

  const handleSort = (field: keyof ActivityItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      'Area / Sub Area',
      'TIPO DE PROCESO',
      'PROCESO MACRO',
      'ACTIVIDAD / PROCESO',
      'FRECUENCIA',
      'PUESTO',
      'REPONSABLE FUNCIONAL',
      '¿DIGITALIZADO?',
      '¿ES AUTOMATIZABLE?',
      'HERRAMIENTA',
      '% AUTOMATIZADO',
      'Horas mensuales Actividad (Total)',
      'Horas mensuales Automatizadas (Total)',
      'Horas manuales (Total)',
      'Gerencia (Hoja)',
    ];

    const rows = sortedActivities.map((a) => [
      `"${a.areaSubArea}"`,
      `"${a.tipoProceso}"`,
      `"${a.procesoMacro}"`,
      `"${a.actividadProceso}"`,
      `"${a.frecuencia}"`,
      `"${a.puesto}"`,
      `"${a.responsableFuncional}"`,
      `"${a.digitalizado}"`,
      `"${a.esAutomatizable}"`,
      `"${a.herramienta}"`,
      `${a.porcentajeAutomatizado}%`,
      a.horasMensualesActividad,
      a.horasMensualesAutomatizadas,
      a.horasManuales,
      `"${a.gerencia}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Liverpool_Levantamiento_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-[#E1197E] text-[10px] font-bold uppercase tracking-wider">
              Nivel 3 • Matriz Completa
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Table className="w-5 h-5 text-[#E1197E]" />
            Detalle de Actividades y Subprocesos
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Las 14 columnas del levantamiento de procesos en alta resolución. Puedes filtrar, ordenar por cualquier columna y exportar a Excel / CSV.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Exportar a CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por actividad, responsable, rol..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E1197E] focus:bg-white transition"
            />
          </div>

          {/* Digitalizado */}
          <div>
            <select
              value={filterDigitalizado}
              onChange={(e) => setFilterDigitalizado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-[#E1197E]"
            >
              <option value="ALL">¿Digitalizado? (Todos)</option>
              <option value="SÍ">Digitalizado: SÍ</option>
              <option value="NO">Digitalizado: NO</option>
            </select>
          </div>

          {/* Automatizable */}
          <div>
            <select
              value={filterAutomatizable}
              onChange={(e) => setFilterAutomatizable(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-[#E1197E]"
            >
              <option value="ALL">¿Es Viable? (Todos)</option>
              <option value="SÍ">Viable: SÍ</option>
              <option value="NO">Criterio Humano: NO</option>
            </select>
          </div>

          {/* Frecuencia */}
          <div>
            <select
              value={filterFrecuencia}
              onChange={(e) => setFilterFrecuencia(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-[#E1197E]"
            >
              <option value="ALL">Frecuencia (Todas)</option>
              <option value="Diaria">Diaria</option>
              <option value="Semanal">Semanal</option>
              <option value="Quincenal">Quincenal</option>
              <option value="Mensual">Mensual</option>
            </select>
          </div>
        </div>

        {/* Quick summary line */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-medium">
          <span>
            Mostrando <b>{sortedActivities.length}</b> de <b>{activities.length}</b> actividades
          </span>
          <span className="text-[11px] text-slate-500">
            Haz clic en cualquier encabezado de columna para ordenar
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('gerencia')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Gerencia / Hoja <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('areaSubArea')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Area / Sub Area <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('procesoMacro')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Proceso Macro <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('actividadProceso')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    Actividad / Proceso <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('puesto')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Puesto <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('responsableFuncional')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    Responsable <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('frecuencia')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-center"
                >
                  Frecuencia
                </th>
                <th
                  onClick={() => handleSort('digitalizado')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-center"
                >
                  ¿Digital?
                </th>
                <th
                  onClick={() => handleSort('esAutomatizable')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-center"
                >
                  ¿Viable?
                </th>
                <th className="py-3 px-3">Herramienta</th>
                <th
                  onClick={() => handleSort('porcentajeAutomatizado')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    % Auto <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('horasMensualesActividad')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Hrs Tot. <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('horasMensualesAutomatizadas')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Hrs Auto <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('horasManuales')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Hrs Man. <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {sortedActivities.map((act) => {
                const isViable = act.esAutomatizable === 'SÍ';
                const isDigit = act.digitalizado === 'SÍ';

                return (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold text-[#E1197E] bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                        {act.gerencia}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                      {act.areaSubArea}
                    </td>

                    <td className="py-2.5 px-3 text-indigo-700 font-bold whitespace-nowrap">
                      {act.procesoMacro}
                    </td>

                    <td className="py-2.5 px-3 text-slate-900 font-bold">
                      {act.actividadProceso}
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                      {act.puesto}
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                      {act.responsableFuncional}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {act.frecuencia}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDigit
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {act.digitalizado}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isViable
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                        title={
                          isViable
                            ? 'Viable para automatización'
                            : 'Descartada del KPI (Juicio humano)'
                        }
                      >
                        {act.esAutomatizable}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                      {act.herramienta}
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                      {act.porcentajeAutomatizado}%
                    </td>

                    <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {act.horasMensualesActividad}h
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                      {act.horasMensualesAutomatizadas}h
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-amber-700 whitespace-nowrap">
                      {act.horasManuales}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
