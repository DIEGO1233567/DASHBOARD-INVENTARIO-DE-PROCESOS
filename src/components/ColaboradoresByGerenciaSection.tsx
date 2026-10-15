import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Clock,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { ColaboradorSummaryItem, ProcessRecord } from '../types/sheets';
import { formatThousands, formatHours } from '../utils/sheetsParser';

interface ColaboradoresByGerenciaSectionProps {
  colaboradores: ColaboradorSummaryItem[];
  records: ProcessRecord[];
  selectedGerencia: string;
  onSelectGerencia: (gerencia: string) => void;
  allGerencias: string[];
}

export function ColaboradoresByGerenciaSection({
  colaboradores,
  selectedGerencia,
  onSelectGerencia,
  allGerencias,
}: ColaboradoresByGerenciaSectionProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedColab, setExpandedColab] = useState<string | null>(null);

  // Scoped collaborators according to selected gerencia and search
  const filteredColaboradores = useMemo(() => {
    return colaboradores.filter((c) => {
      const matchGerencia = selectedGerencia === 'ALL' || c.gerencia === selectedGerencia;
      const matchSearch =
        searchTerm === '' ||
        c.colaborador.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.gerencia.toLowerCase().includes(searchTerm.toLowerCase());

      return matchGerencia && matchSearch;
    });
  }, [colaboradores, selectedGerencia, searchTerm]);

  // Aggregated workload statistics for the current scope
  const stats = useMemo(() => {
    const list =
      selectedGerencia === 'ALL'
        ? colaboradores
        : colaboradores.filter((c) => c.gerencia === selectedGerencia);

    const total = list.length;
    const totalHoras = list.reduce((acc, c) => acc + c.horasTotales, 0);
    const avgHoras = total > 0 ? (totalHoras / total).toFixed(1) : '0';
    const totalTareasMan = list.reduce((acc, c) => acc + c.tareasManuales, 0);
    const totalTareasAuto = list.reduce((acc, c) => acc + c.tareasAutomatizadas, 0);

    return { total, totalHoras, avgHoras, totalTareasMan, totalTareasAuto };
  }, [colaboradores, selectedGerencia]);

  const toggleExpand = (key: string) => {
    setExpandedColab((prev) => (prev === key ? null : key));
  };

  return (
    <section id="carga-colaborador" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-900 rounded">
              Sección 02
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-800" />
              Carga Laboral y Tareas por Colaborador (Responsable Funcional)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Carga horaria mensual, volumen de tareas manuales vs. automatizadas ejecutadas y porcentaje respecto a la jornada normal de 152 h/mes.
          </p>
        </div>

        {/* Gerencia Quick Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="gerenciaColabFilter" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Gerencia:
          </label>
          <select
            id="gerenciaColabFilter"
            value={selectedGerencia}
            onChange={(e) => onSelectGerencia(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-300 text-blue-950 px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">Todas las Gerencias</option>
            {allGerencias.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clean Stat Strip without status thresholds */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Colaboradores Asignados</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{formatThousands(stats.total)}</div>
          </div>
          <Users className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Carga Promedio</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{formatThousands(stats.avgHoras, 1)} h/mes</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {formatThousands((Number(stats.avgHoras) / 152) * 100, 0)}% de jornada (152h)
            </div>
          </div>
          <Clock className="w-6 h-6 text-blue-800" />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Horas Totales del Equipo</div>
            <div className="text-xl font-bold font-mono text-blue-950 mt-0.5">
              {formatHours(stats.totalHoras)} h
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {formatThousands(stats.totalHoras / 152, 1)} FTE totales
            </div>
          </div>
          <Layers className="w-6 h-6 text-blue-700" />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Tareas Manuales vs Auto</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              <span className="text-amber-800">{formatThousands(stats.totalTareasMan)} man</span> ·{' '}
              <span className="text-blue-800">{formatThousands(stats.totalTareasAuto)} auto</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {formatThousands(stats.totalTareasMan + stats.totalTareasAuto)} ejecuciones totales
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-blue-700" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por colaborador, puesto o gerencia..."
            className="w-full text-xs px-3 py-1.5 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Mostrando <strong className="text-slate-800">{filteredColaboradores.length}</strong> colaboradores
        </div>
      </div>

      {/* Main Table: Collaborator Workload & Task Volume without status thresholds */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-4 font-medium tracking-wide">Responsable Funcional</th>
                <th className="py-3 px-3 font-medium tracking-wide">Gerencia / Puesto</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide">Carga Actual</th>
                <th className="py-3 px-4 text-center font-medium tracking-wide min-w-[150px]">
                  % de Jornada (152h)
                </th>
                <th className="py-3 px-3 text-center font-medium tracking-wide text-amber-200">
                  Tareas Manuales
                </th>
                <th className="py-3 px-3 text-center font-medium tracking-wide text-sky-200">
                  Tareas Auto.
                </th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Manuales</th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Auto.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No se encontraron colaboradores con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredColaboradores.map((colab) => {
                  const key = `${colab.gerencia}:::${colab.colaborador}`;
                  const isExpanded = expandedColab === key;

                  return (
                    <React.Fragment key={key}>
                      <tr
                        onClick={() => toggleExpand(key)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/70 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-blue-900 cursor-pointer"
                            title="Ver actividades asignadas"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-800" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Nombre del Colaborador */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{colab.colaborador}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({colab.totalActividades} act. únicas)
                            </span>
                          </div>
                        </td>

                        {/* Gerencia & Puesto */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-medium text-slate-800">{colab.gerencia}</div>
                          <div className="text-[11px] text-slate-500">{colab.puesto}</div>
                        </td>

                        {/* Carga Actual (Horas) */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatHours(colab.horasTotales)} h
                          </span>
                        </td>

                        {/* % de Jornada (152h normal) */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                              <span className="font-bold text-slate-800">{formatThousands(colab.porcentajeJornada, 1)}%</span>
                              <span className="text-slate-400">{formatHours(colab.horasTotales)}/152 h</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, colab.porcentajeJornada)}%` }}
                                className={`h-full ${
                                  colab.porcentajeJornada > 100
                                    ? 'bg-blue-950'
                                    : 'bg-blue-700'
                                }`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Volumen Tareas Manuales Ejecutadas */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-bold">
                            {formatThousands(colab.tareasManuales)}
                          </span>
                        </td>

                        {/* Volumen Tareas Automatizadas Ejecutadas */}
                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold">
                            {formatThousands(colab.tareasAutomatizadas)}
                          </span>
                        </td>

                        {/* Horas Manuales */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatHours(colab.horasManuales)} h
                        </td>

                        {/* Horas Automatizadas */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-blue-800">
                          {formatHours(colab.horasAutomatizadas)} h
                        </td>
                      </tr>

                      {/* Expandable Collaborator Tasks Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={9} className="p-4 pl-10">
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-blue-700" />
                                  Actividades bajo la responsabilidad de {colab.colaborador} (
                                  {formatThousands(colab.actividades.length)} registros)
                                </span>
                                {colab.horasPotencialAutomatizable > 0 && (
                                  <span className="text-[11px] font-medium text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                                    Potencial automatizable identificado: {formatHours(colab.horasPotencialAutomatizable)} h/mes
                                  </span>
                                )}
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
                                                act.esAutomatizable === 'Sí' || act.esAutomatizable === 'SÍ'
                                                  ? 'bg-blue-100 text-blue-900'
                                                  : 'bg-slate-100 text-slate-600'
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
                                            {act.herramienta || 'N/A'}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
