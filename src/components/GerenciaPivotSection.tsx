import React, { useState, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Layers,
  Users,
  Briefcase,
  Search,
  X,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { GerenciaSummaryItem, ProcessRecord, ColaboradorSummaryItem } from '../types/sheets';
import { computeColaboradorSummaries, formatThousands, formatHours } from '../utils/sheetsParser';

interface GerenciaPivotSectionProps {
  summaries: GerenciaSummaryItem[];
  records: ProcessRecord[];
  selectedGerencia: string;
  onSelectGerencia: (gerencia: string) => void;
}

export function GerenciaPivotSection({
  summaries,
  records,
  selectedGerencia,
  onSelectGerencia,
}: GerenciaPivotSectionProps) {
  const [expandedGerencia, setExpandedGerencia] = useState<string | null>(null);
  const [expandedMacroKey, setExpandedMacroKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [modalGerencia, setModalGerencia] = useState<string | null>(null);
  const [expandedModalColab, setExpandedModalColab] = useState<string | null>(null);

  // Map of total manual hours per collaborator across all records
  const colabManualHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      const resp = (r.responsableFuncional || 'Sin Asignar').trim();
      const hManual = Number(r.horasManualesTotal != null ? r.horasManualesTotal : (r.horasManuales || 0));
      map.set(resp, (map.get(resp) || 0) + (isNaN(hManual) ? 0 : hManual));
    }
    return map;
  }, [records]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) =>
      s.gerencia.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [summaries, searchTerm]);

  const toggleExpandGerencia = (gerencia: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGerencia((prev) => (prev === gerencia ? null : gerencia));
  };

  const toggleExpandMacro = (macroKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMacroKey((prev) => (prev === macroKey ? null : macroKey));
  };

  // Collaborators for modal when clicking on collaborators count
  const modalColaboradores: ColaboradorSummaryItem[] = useMemo(() => {
    if (!modalGerencia) return [];
    const gerenciaRecords = records.filter((r) => r.gerencia === modalGerencia);
    return computeColaboradorSummaries(gerenciaRecords);
  }, [modalGerencia, records]);

  return (
    <section id="resumen-gerencial" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-900 rounded">
              Sección 01
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-800" />
              Resumen Gerencial: Procesos Macro, Actividades y Automatización
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas clave por gerencia con desglose jerárquico de Procesos Macro y Actividades. Haz clic en el número de colaboradores para abrir su desglose.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar gerencia..."
            className="w-full text-xs px-3 py-1.5 pl-8 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <th className="py-3 px-3 w-10 text-center"></th>
                <th className="py-3 px-4 font-medium tracking-wide">Gerencia</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide">
                  Procesos Macro
                </th>
                <th className="py-3 px-3 text-center font-medium tracking-wide" title="Conteo de actividades únicas evaluadas en esta gerencia (sin duplicados)">
                  Actividades Únicas
                </th>
                <th className="py-3 px-3 text-center font-medium tracking-wide text-sky-200">
                  Colaboradores
                </th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">
                  Horas Totales
                </th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">
                  Horas Manuales
                </th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">
                  Horas Auto.
                </th>
                <th className="py-3 px-4 text-center font-medium tracking-wide w-28">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No se encontraron gerencias que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((summary) => {
                  const isSelected = selectedGerencia === summary.gerencia;
                  const isExpanded = expandedGerencia === summary.gerencia;

                  return (
                    <React.Fragment key={summary.gerencia}>
                      <tr
                        onClick={() => onSelectGerencia(isSelected ? 'ALL' : summary.gerencia)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 font-medium'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Expand Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => toggleExpandGerencia(summary.gerencia, e)}
                            className="p-1 text-slate-500 hover:text-blue-900 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Ver desglose de procesos macro y actividades"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-800" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Gerencia Name */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{summary.gerencia}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded">
                                Seleccionada
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Conteo de Procesos Macro */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-blue-950">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-100/70 text-blue-900 rounded font-semibold">
                            {formatThousands(summary.totalProcesosMacro)}
                          </span>
                        </td>

                        {/* Conteo de ACTIVIDAD / PROCESO (Únicas) */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-800">
                          <span
                            className="inline-flex items-center justify-center px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold"
                            title={`${formatThousands(summary.totalActividades)} actividades únicas (${formatThousands(summary.totalFilas)} registros totales)`}
                          >
                            {formatThousands(summary.totalActividades)}
                          </span>
                        </td>

                        {/* Conteo de Colaboradores (Clickable to open breakdown modal) */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalGerencia(summary.gerencia);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-900 border border-blue-200 transition-colors cursor-pointer"
                            title={`Ver los ${formatThousands(summary.totalColaboradores)} colaboradores de ${summary.gerencia}`}
                          >
                            <Users className="w-3 h-3 text-blue-600" />
                            <span>{formatThousands(summary.totalColaboradores)}</span>
                          </button>
                        </td>

                        {/* Horas Totales */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatHours(summary.horasTotales)} h
                        </td>

                        {/* Horas Manuales */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatHours(summary.horasManuales)} h
                        </td>

                        {/* Horas Automatizadas */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-blue-800">
                          {formatHours(summary.horasAutomatizadas)} h
                        </td>

                        {/* Botón Acción */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectGerencia(isSelected ? 'ALL' : summary.gerencia);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isSelected ? 'Ver Todas' : 'Filtrar'}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Drill-Down: Macro Processes of this Gerencia with Activities sub-breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/95 border-b border-slate-200">
                          <td colSpan={9} className="p-4 pl-10">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-blue-700" />
                                  <span>
                                    Desglose de Procesos Macro en {summary.gerencia} (
                                    {formatThousands(summary.macroProcessesList.length)} procesos)
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  Haz clic en la flecha de cada proceso para ver sus actividades detalladas
                                </span>
                              </div>

                              <div className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                                      <th className="py-2 px-3 w-8 text-center"></th>
                                      <th className="py-2 px-3 text-left">Proceso Macro</th>
                                      <th className="py-2 px-3 text-center" title="Actividades únicas evaluadas en este proceso macro">Actividades Únicas</th>
                                      <th className="py-2 px-3 text-center">Colaboradores</th>
                                      <th className="py-2 px-3 text-right">Horas Totales</th>
                                      <th className="py-2 px-3 text-right">Horas Manuales</th>
                                      <th className="py-2 px-3 text-right">Horas Auto.</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {summary.macroProcessesList.map((macro) => {
                                      const macroKey = `${summary.gerencia}:::${macro.nombre}`;
                                      const isMacroExpanded = expandedMacroKey === macroKey;

                                      return (
                                        <React.Fragment key={macroKey}>
                                          <tr
                                            onClick={(e) => toggleExpandMacro(macroKey, e)}
                                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                                          >
                                            <td className="py-2 px-2 text-center">
                                              <button
                                                type="button"
                                                className="p-0.5 text-slate-400 hover:text-blue-900 cursor-pointer"
                                                title="Ver actividades de este proceso macro"
                                              >
                                                {isMacroExpanded ? (
                                                  <ChevronDown className="w-3.5 h-3.5 text-blue-800" />
                                                ) : (
                                                  <ChevronRight className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-900">
                                              {macro.nombre}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-medium text-blue-950">
                                              {formatThousands(macro.totalActividades)}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-slate-600">
                                              {formatThousands(macro.colaboradoresCount)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                                              {formatHours(macro.horasTotales)} h
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                                              {formatHours(macro.horasManuales)} h
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-semibold text-blue-800">
                                              {formatHours(macro.horasAutomatizadas)} h
                                            </td>
                                          </tr>

                                          {/* Nested Level 2: Activities inside this Macro Process */}
                                          {isMacroExpanded && (
                                            <tr className="bg-slate-50/70">
                                              <td colSpan={7} className="p-3 pl-8">
                                                <div className="space-y-1.5 bg-white border border-slate-200 rounded p-3">
                                                  <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                    <Briefcase className="w-3.5 h-3.5 text-blue-700" />
                                                    <span>
                                                      Actividades en proceso macro "{macro.nombre}" ({formatThousands(macro.actividades?.length || 0)} actividades)
                                                    </span>
                                                  </div>
                                                  <div className="overflow-x-auto">
                                                    <table className="w-full text-[11px]">
                                                      <thead>
                                                        <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50">
                                                          <th className="py-1.5 px-2 text-left">Actividad / Proceso</th>
                                                          <th className="py-1.5 px-2 text-left">Area / Sub Area</th>
                                                          <th className="py-1.5 px-2 text-left">Responsable Funcional</th>
                                                          <th className="py-1.5 px-2 text-center">Frecuencia</th>
                                                          <th className="py-1.5 px-2 text-center">¿Auto.?</th>
                                                          <th className="py-1.5 px-2 text-left">Herramienta</th>
                                                          <th className="py-1.5 px-2 text-right">Horas Totales</th>
                                                          <th className="py-1.5 px-2 text-right">Horas Manuales</th>
                                                          <th className="py-1.5 px-2 text-right">Horas Auto.</th>
                                                          <th className="py-1.5 px-2 text-right bg-amber-50/60 text-amber-900 border-l border-amber-100 font-semibold whitespace-nowrap" title="Porcentaje de la actividad respecto a la carga del colaborador (horas manuales)">
                                                            % Carga Colab. (Manual)
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-slate-100">
                                                        {(macro.actividades || []).map((act) => {
                                                          const respName = (act.responsableFuncional || "").trim();
                                                          const colabTotalManual = colabManualHoursMap.get(respName) || 0;
                                                          const actManual = Number(act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0));
                                                          const pctColabManual = colabTotalManual > 0
                                                            ? Number(((actManual / colabTotalManual) * 100).toFixed(1))
                                                            : 0;

                                                          return (
                                                            <tr key={act.id} className="hover:bg-slate-50">
                                                            <td className="py-1.5 px-2 font-medium text-slate-900 max-w-xs truncate" title={act.actividadProceso}>
                                                              {act.actividadProceso}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                                                              {act.areaSubArea}
                                                            </td>
                                                            <td className="py-1.5 px-2 font-semibold text-blue-900 whitespace-nowrap">
                                                              {act.responsableFuncional}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-slate-500 whitespace-nowrap">
                                                              {act.frecuencia}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                                              <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                                                act.esAutomatizable === 'Sí' || act.esAutomatizable === 'SÍ'
                                                                  ? 'bg-blue-100 text-blue-900'
                                                                  : 'bg-slate-100 text-slate-600'
                                                              }`}>
                                                                {act.esAutomatizable}
                                                              </span>
                                                            </td>
                                                            <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                                                              {act.herramienta || 'N/A'}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                                                              {formatHours(act.horasMensualesTotal || act.horasMensualesActividad || 0)} h
                                                            </td>
                                                            <td className="py-1.5 px-2 text-right font-mono text-slate-600 whitespace-nowrap">
                                                              {formatHours(act.horasManualesTotal || act.horasManuales || 0)} h
                                                            </td>
                                                            <td className="py-1.5 px-2 text-right font-mono font-semibold text-blue-800 whitespace-nowrap">
                                                              {formatHours(act.horasMensualesAutomatizadas || 0)} h
                                                            </td>
                                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-900 whitespace-nowrap bg-amber-50/30 border-l border-amber-100/60 tabular-nums">
                                                              <span className="inline-flex items-center gap-1 justify-end">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                {formatThousands(pctColabManual, 1)}%
                                                              </span>
                                                            </td>
                                                          </tr>
                                                        );
                                                      })}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Collaborator Breakdown when clicking on Gerencia Colaboradores count */}
      {modalGerencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Colaboradores de {modalGerencia}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {formatThousands(modalColaboradores.length)} colaboradores activos · Base jornada normal: 152 h/mes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGerencia(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-8 text-center"></th>
                      <th className="py-2.5 px-3">Responsable Funcional</th>
                      <th className="py-2.5 px-3">Puesto</th>
                      <th className="py-2.5 px-3 text-center">Carga Actual</th>
                      <th className="py-2.5 px-3 text-center">% de Jornada (152h)</th>
                      <th className="py-2.5 px-3 text-center">Tareas Manuales</th>
                      <th className="py-2.5 px-3 text-center">Tareas Auto.</th>
                      <th className="py-2.5 px-3 text-right">Horas Manuales</th>
                      <th className="py-2.5 px-3 text-right">Horas Auto.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalColaboradores.map((colab) => {
                      const isExpanded = expandedModalColab === colab.colaborador;
                      return (
                        <React.Fragment key={colab.colaborador}>
                          <tr
                            onClick={() => setExpandedModalColab((prev) => (prev === colab.colaborador ? null : colab.colaborador))}
                            className={`cursor-pointer transition-colors ${isExpanded ? "bg-blue-50/70 font-medium" : "hover:bg-slate-50"}`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                className="p-0.5 text-slate-400 hover:text-blue-900 cursor-pointer"
                                title="Ver actividades asignadas"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-800" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{colab.colaborador}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({formatThousands(colab.totalActividades)} act.)
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{colab.puesto}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {formatHours(colab.horasTotales)} h
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                              <span className="font-semibold text-blue-950">
                                {formatThousands(colab.porcentajeJornada, 1)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                              <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded">
                                {formatThousands(colab.tareasManuales)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900">
                              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded">
                                {formatThousands(colab.tareasAutomatizadas)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {formatHours(colab.horasManuales)} h
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-800">
                              {formatHours(colab.horasAutomatizadas)} h
                            </td>
                          </tr>

                          {/* Expanded Collaborator Activities Breakdown */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={9} className="p-3 pl-8">
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-blue-700" />
                                    <span>Actividades bajo la responsabilidad de {colab.colaborador} ({formatThousands(colab.actividades.length)} registros)</span>
                                  </div>
                                  <div className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                                          <th className="py-2 px-3 text-left">Proceso Macro</th>
                                          <th className="py-2 px-3 text-left">Actividad / Proceso</th>
                                          <th className="py-2 px-3 text-center">Frecuencia</th>
                                          <th className="py-2 px-3 text-center">¿Auto.?</th>
                                          <th className="py-2 px-3 text-right">Horas Totales</th>
                                          <th className="py-2 px-3 text-right">Horas Manuales</th>
                                          <th className="py-2 px-3 text-right">Horas Auto.</th>
                                          <th className="py-2 px-3 text-left">Herramienta</th>
                                          <th className="py-2 px-3 text-right bg-amber-50/60 text-amber-900 border-l border-amber-100 font-semibold" title="Porcentaje de la actividad respecto a la carga del colaborador (horas manuales)">
                                            % Carga Colab. (Manual)
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {colab.actividades.map((act) => {
                                          const actManual = Number(act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0));
                                          const pctColabManual = colab.horasManuales > 0
                                            ? Number(((actManual / colab.horasManuales) * 100).toFixed(1))
                                            : 0;

                                          return (
                                            <tr key={act.id} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 font-semibold text-slate-800">
                                                {act.procesoMacro}
                                              </td>
                                              <td className="py-2 px-3 text-slate-900 max-w-xs truncate" title={act.actividadProceso}>
                                                {act.actividadProceso}
                                              </td>
                                              <td className="py-2 px-3 text-center text-slate-600">
                                                {act.frecuencia}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <span
                                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                    act.esAutomatizable === "Sí" || act.esAutomatizable === "SÍ"
                                                      ? "bg-blue-100 text-blue-900"
                                                      : "bg-slate-100 text-slate-600"
                                                  }`}
                                                >
                                                  {act.esAutomatizable}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-medium">
                                                {formatHours(act.horasMensualesTotal || act.horasMensualesActividad || 0)} h
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                                {formatHours(actManual)} h
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-semibold text-blue-800">
                                                {formatHours(act.horasMensualesAutomatizadas || 0)} h
                                              </td>
                                              <td className="py-2 px-3 text-slate-600">
                                                {act.herramienta || "N/A"}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-bold text-amber-900 tabular-nums bg-amber-50/30 border-l border-amber-100/60">
                                                <span className="inline-flex items-center gap-1 justify-end">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                  {formatThousands(pctColabManual, 1)}%
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-800">
                                          <td colSpan={4} className="py-2 px-3 text-right text-slate-600">
                                            Total Carga del Colaborador:
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {formatHours(colab.horasTotales)} h
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-900">
                                            {formatHours(colab.horasManuales)} h
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                                            {formatHours(colab.horasAutomatizadas)} h
                                          </td>
                                          <td className="py-2 px-3 text-slate-400">-</td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-900 bg-amber-100/50 border-l border-amber-100">
                                            100.0%
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  if (modalGerencia) onSelectGerencia(modalGerencia);
                  setModalGerencia(null);
                  const el = document.getElementById('carga-colaborador');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Ver detalles y actividades en Sección 02</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setModalGerencia(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
