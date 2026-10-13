import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { GerenciaSummary } from '../types/dashboard';

interface GerenciasOverviewProps {
  gerencias: GerenciaSummary[];
  onSelectGerencia: (gerenciaName: string) => void;
  selectedGerenciaName: string;
}

export const GerenciasOverview: React.FC<GerenciasOverviewProps> = ({
  gerencias,
  onSelectGerencia,
  selectedGerenciaName,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-[#E1197E] text-[10px] font-bold uppercase tracking-wider">
              Nivel 1 • Base Estructural
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Cada Hoja de Cálculo representa una Gerencia
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#E1197E]" />
            Visión General por Gerencias
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Selecciona una gerencia para navegar de lo general a lo particular: conocer sus procesos macro, subprocesos y la carga operativa de sus colaboradores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {gerencias.map((g) => {
          const isSelected = selectedGerenciaName === g.gerencia;
          const isAutomated = g.kpiAutomatizacion >= 80;

          return (
            <div
              key={g.gerencia}
              className={`group relative rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-[#E1197E] shadow-md ring-2 ring-[#E1197E]/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                {/* Header of Card */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E1197E] bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                      Hoja / Gerencia
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-1.5 group-hover:text-[#E1197E] transition">
                      {g.gerencia}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        isAutomated
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isAutomated ? '🟢 80-100% Automatizado' : '🟡 En Desarrollo'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      Satisfacción bots: <b>{g.kpiSatisfaccion}%</b>
                    </span>
                  </div>
                </div>

                {/* Main KPI Meter */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-600 font-bold">
                      KPI de Automatización Viable
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-900">
                        {g.kpiAutomatizacion}%
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">/ 80% meta</span>
                    </div>
                  </div>

                  <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAutomated ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, g.kpiAutomatizacion)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60"
                      style={{ left: '80%' }}
                      title="Meta mínima de automatización: 80%"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium mt-1.5">
                    <span>Viables: <b>{g.horasViablesAutomatizadas}h</b> de {g.horasViablesActividad}h</span>
                    <span>Descartadas (juicio humano): <b>{g.horasDescartadasNoViables}h</b></span>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">
                      Procesos Macro
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {g.procesosMacro.length}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">
                      Actividades
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {g.totalTareas}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold block mb-0.5">
                      Horas Auto
                    </span>
                    <span className="text-lg font-black text-emerald-800">
                      {g.totalHorasAutomatizadas}h
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold block mb-0.5">
                      Horas Manual
                    </span>
                    <span className="text-lg font-black text-amber-800">
                      {g.totalHorasManuales}h
                    </span>
                  </div>
                </div>

                {/* Macro processes preview pills */}
                <div className="mb-4">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Procesos Macro de esta Gerencia ({g.procesosMacro.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {g.procesosMacro.map((pm) => (
                      <span
                        key={pm.procesoMacro}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            pm.kpiAutomatizacion >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="truncate max-w-[200px]">{pm.procesoMacro}</span>
                        <span className="text-[11px] text-slate-500 font-bold">
                          ({pm.actividades.length})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{g.puestosCount} Puestos</span>
                  <span>•</span>
                  <span>{g.responsablesCount} Responsables</span>
                </div>

                <button
                  onClick={() => onSelectGerencia(g.gerencia)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E1197E] hover:bg-[#c9146f] text-white text-xs font-bold transition shadow-sm group-hover:shadow-md"
                >
                  <span>Explorar Gerencia</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
