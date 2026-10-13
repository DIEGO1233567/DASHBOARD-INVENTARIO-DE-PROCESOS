import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FileSpreadsheet,
  Filter,
  Layers,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ActivityItem, GerenciaSummary, ProcesoMacroSummary } from '../types/dashboard';

interface MacroProcessesViewProps {
  gerencias: GerenciaSummary[];
  selectedGerenciaName: string;
  onSelectGerencia: (gerencia: string) => void;
  onSelectActivity?: (activity: ActivityItem) => void;
}

export const MacroProcessesView: React.FC<MacroProcessesViewProps> = ({
  gerencias,
  selectedGerenciaName,
  onSelectGerencia,
  onSelectActivity,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMacro, setExpandedMacro] = useState<string | null>(null);

  // Filter gerencias
  const activeGerencias = selectedGerenciaName
    ? gerencias.filter((g) => g.gerencia === selectedGerenciaName)
    : gerencias;

  const allMacros: ProcesoMacroSummary[] = activeGerencias.flatMap((g) => g.procesosMacro);

  const filteredMacros = allMacros.filter(
    (m) =>
      m.procesoMacro.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.gerencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.actividades.some((a) =>
        a.actividadProceso.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const toggleExpand = (macroKey: string) => {
    setExpandedMacro(expandedMacro === macroKey ? null : macroKey);
  };

  return (
    <div className="space-y-6">
      {/* View Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-[#E1197E] text-[10px] font-bold uppercase tracking-wider">
                Nivel 2 • De lo General a lo Particular
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              Procesos Macro por Gerencia
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Revisa los procesos macro que integran cada área, cuántas actividades contienen y su estatus de automatización.
            </p>
          </div>

          {/* Gerencia Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => onSelectGerencia('')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                !selectedGerenciaName
                  ? 'bg-[#E1197E] text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Todas las Gerencias ({allMacros.length})
            </button>
            {gerencias.map((g) => (
              <button
                key={g.gerencia}
                onClick={() => onSelectGerencia(g.gerencia)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedGerenciaName === g.gerencia
                    ? 'bg-[#E1197E] text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {g.gerencia}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por proceso macro, actividad, tarea..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E1197E] focus:bg-white transition"
          />
        </div>
      </div>

      {/* List of Macro Processes */}
      <div className="space-y-4">
        {filteredMacros.map((macro, idx) => {
          const macroKey = `${macro.gerencia}-${macro.procesoMacro}-${idx}`;
          const isExpanded = expandedMacro === macroKey || allMacros.length <= 4;
          const isAutomated = macro.kpiAutomatizacion >= 80;

          return (
            <div
              key={macroKey}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs hover:shadow-sm transition"
            >
              {/* Macro Process Header Row */}
              <div
                onClick={() => toggleExpand(macroKey)}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-1 p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E1197E] bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                        {macro.gerencia}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isAutomated
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isAutomated ? '🟢 Meta 80% Cumplida' : '🟡 En Desarrollo (< 80%)'}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      {macro.procesoMacro}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      {macro.actividades.length} {macro.actividades.length === 1 ? 'actividad' : 'actividades'} • {macro.horasActividadTotal} horas totales al mes
                    </p>
                  </div>
                </div>

                {/* KPI & Hours indicators on the right */}
                <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                  {/* KPI Bar */}
                  <div className="min-w-[140px] text-right">
                    <div className="flex items-baseline justify-end gap-1.5 mb-1">
                      <span className="text-xl font-black text-slate-900">
                        {macro.kpiAutomatizacion}%
                      </span>
                      <span className="text-xs text-slate-500 font-bold">KPI Viable</span>
                    </div>
                    <div className="relative w-36 h-2.5 bg-slate-100 rounded-full overflow-hidden ml-auto border border-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          isAutomated ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, macro.kpiAutomatizacion)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60"
                        style={{ left: '80%' }}
                      />
                    </div>
                  </div>

                  {/* Hours badge */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 min-w-[70px]">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Total</span>
                      <span className="font-black text-slate-900">{macro.horasActividadTotal}h</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 min-w-[70px]">
                      <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-bold block">Auto</span>
                      <span className="font-black text-emerald-800">{macro.horasAutomatizadasTotal}h</span>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 min-w-[70px]">
                      <span className="text-[9px] uppercase tracking-wider text-amber-800 font-bold block">Manual</span>
                      <span className="font-black text-amber-800">{macro.horasManualesTotal}h</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Subprocesses / Activities Table */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2 font-medium">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Subprocesos y Tareas de: <span className="text-slate-900 font-black">{macro.procesoMacro}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Regla APQC: Tareas marcadas como "¿Es Automatizable? = NO" no penalizan la métrica tecnológica
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600 bg-slate-50 font-bold">
                          <th className="py-2.5 px-3">Actividad / Tarea</th>
                          <th className="py-2.5 px-3">Puesto / Responsable</th>
                          <th className="py-2.5 px-3">Frecuencia</th>
                          <th className="py-2.5 px-3 text-center">¿Digital?</th>
                          <th className="py-2.5 px-3 text-center">¿Es Viable?</th>
                          <th className="py-2.5 px-3">Herramienta</th>
                          <th className="py-2.5 px-3 text-right">% Auto</th>
                          <th className="py-2.5 px-3 text-right">Horas Tot.</th>
                          <th className="py-2.5 px-3 text-right">Horas Auto</th>
                          <th className="py-2.5 px-3 text-right">Horas Man.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {macro.actividades.map((act) => {
                          const isViable = act.esAutomatizable === 'SÍ';
                          const isDigit = act.digitalizado === 'SÍ';

                          return (
                            <tr
                              key={act.id}
                              className="hover:bg-slate-50/80 transition"
                            >
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{act.actividadProceso}</div>
                                <div className="text-[11px] text-slate-500">{act.areaSubArea}</div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="text-slate-800 font-semibold">{act.puesto}</div>
                                <div className="text-[11px] text-slate-500">{act.responsableFuncional}</div>
                              </td>

                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                                  {act.frecuencia}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isDigit
                                      ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}
                                >
                                  {act.digitalizado}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isViable
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-50 text-rose-800 border border-rose-300'
                                  }`}
                                  title={
                                    isViable
                                      ? 'Tarea viable tecnológicamente'
                                      : 'Descartada de la meta (criterio y juicio humano)'
                                  }
                                >
                                  {isViable ? 'SÍ (Viable)' : 'NO (Criterio Humano)'}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <span className="text-slate-700 font-medium">
                                  {act.herramienta}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-right font-black text-slate-900">
                                {act.porcentajeAutomatizado}%
                              </td>

                              <td className="py-3 px-3 text-right font-bold text-slate-800">
                                {act.horasMensualesActividad}h
                              </td>

                              <td className="py-3 px-3 text-right font-black text-emerald-700">
                                {act.horasMensualesAutomatizadas}h
                              </td>

                              <td className="py-3 px-3 text-right font-black text-amber-700">
                                {act.horasManuales}h
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
