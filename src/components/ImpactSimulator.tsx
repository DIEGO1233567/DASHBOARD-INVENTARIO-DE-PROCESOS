import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ActivityItem, GerenciaSummary } from '../types/dashboard';
import { calculateGerenciaSummary, isTaskViable } from '../utils/kpiCalculator';

interface ImpactSimulatorProps {
  gerencias: GerenciaSummary[];
  selectedGerenciaName: string;
  onSelectGerencia: (name: string) => void;
}

export const ImpactSimulator: React.FC<ImpactSimulatorProps> = ({
  gerencias,
  selectedGerenciaName,
  onSelectGerencia,
}) => {
  const currentGerencia = useMemo(() => {
    return gerencias.find((g) => g.gerencia === selectedGerenciaName) || gerencias[0];
  }, [gerencias, selectedGerenciaName]);

  // Track simulated automation adjustments (map of activityId -> simulated new percent)
  const [simulatedOverrides, setSimulatedOverrides] = useState<Record<string, number>>({});

  const handleSimulatePercent = (activityId: string, newPercent: number) => {
    setSimulatedOverrides((prev) => ({
      ...prev,
      [activityId]: newPercent,
    }));
  };

  const handleResetSimulation = () => {
    setSimulatedOverrides({});
  };

  // Compute simulated activities for this gerencia
  const simulatedActivities: ActivityItem[] = useMemo(() => {
    if (!currentGerencia) return [];

    return currentGerencia.actividades.map((act) => {
      if (simulatedOverrides[act.id] !== undefined) {
        const simulatedPct = simulatedOverrides[act.id];
        const newAutoHrs = Math.round((act.horasMensualesActividad * (simulatedPct / 100)) * 10) / 10;
        const newManHrs = Math.max(0, Math.round((act.horasMensualesActividad - newAutoHrs) * 10) / 10);
        return {
          ...act,
          porcentajeAutomatizado: simulatedPct,
          horasMensualesAutomatizadas: newAutoHrs,
          horasManuales: newManHrs,
          digitalizado: simulatedPct > 0 ? 'SÍ' : act.digitalizado,
        };
      }
      return act;
    });
  }, [currentGerencia, simulatedOverrides]);

  const simulatedSummary = useMemo(() => {
    if (!currentGerencia) return null;
    return calculateGerenciaSummary(currentGerencia.gerencia, simulatedActivities);
  }, [currentGerencia, simulatedActivities]);

  if (!currentGerencia || !simulatedSummary) return null;

  const kpiDiff = Math.round((simulatedSummary.kpiAutomatizacion - currentGerencia.kpiAutomatizacion) * 10) / 10;
  const hoursFreed = Math.round((simulatedSummary.totalHorasAutomatizadas - currentGerencia.totalHorasAutomatizadas) * 10) / 10;

  const viablePendingActivities = currentGerencia.actividades.filter(
    (a) => isTaskViable(a) && a.porcentajeAutomatizado < 100
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-[#E1197E] text-[10px] font-bold uppercase tracking-wider">
              Nivel 5 • Simulación Predictiva
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Simulador de Impacto de Automatizaciones
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Mueve los controles deslizantes de tareas viables para ver cómo escala el KPI hacia la meta del 80% y cuántas horas manuales se liberan.
          </p>
        </div>

        {/* Gerencia Selector */}
        <div className="flex items-center gap-2">
          <select
            value={currentGerencia.gerencia}
            onChange={(e) => onSelectGerencia(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-[#E1197E]"
          >
            {gerencias.map((g) => (
              <option key={g.gerencia} value={g.gerencia}>
                {g.gerencia}
              </option>
            ))}
          </select>

          {Object.keys(simulatedOverrides).length > 0 && (
            <button
              onClick={handleResetSimulation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-bold transition border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Restablecer</span>
            </button>
          )}
        </div>
      </div>

      {/* Comparison Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI Actual vs Simulado */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Impacto en KPI de Automatización
          </span>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block font-semibold">Actual</span>
              <span className="text-2xl font-black text-slate-700">
                {currentGerencia.kpiAutomatizacion}%
              </span>
            </div>
            <ArrowRight className="w-5 h-5 text-[#E1197E]" />
            <div>
              <span className="text-xs text-[#E1197E] block font-bold">Simulado</span>
              <span className="text-3xl font-black text-slate-900">
                {simulatedSummary.kpiAutomatizacion}%
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Variación proyectada:</span>
            <span
              className={`font-black ${
                kpiDiff > 0 ? 'text-emerald-700 font-mono' : 'text-slate-500'
              }`}
            >
              {kpiDiff > 0 ? `+${kpiDiff}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Estatus vs Meta 80% */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Estatus Frente a Meta del 80%
          </span>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                simulatedSummary.kpiAutomatizacion >= 80
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {simulatedSummary.kpiAutomatizacion >= 80
                ? '🟢 Meta Cumplida (>= 80%)'
                : '🟡 En Desarrollo (< 80%)'}
            </span>
          </div>

          <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                simulatedSummary.kpiAutomatizacion >= 80
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, simulatedSummary.kpiAutomatizacion)}%` }}
            />
            <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60" style={{ left: '80%' }} />
          </div>
          <div className="text-[10px] text-slate-500 flex justify-between font-bold">
            <span>0%</span>
            <span className="text-emerald-700">Meta: 80%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Horas Liberadas */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Horas Mensuales Liberadas
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">
              +{hoursFreed}h
            </span>
            <span className="text-xs text-slate-500 font-semibold">/ mes para el equipo</span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium">
            Carga manual residual estimada: <b>{simulatedSummary.totalHorasManuales}h</b> (antes {currentGerencia.totalHorasManuales}h).
          </p>
        </div>
      </div>

      {/* Interactive Activity Sliders */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#E1197E]" />
            Oportunidades Viables en {currentGerencia.gerencia} ({viablePendingActivities.length})
          </h3>
          <span className="text-xs text-slate-500 font-semibold">
            Ajusta los deslizadores para proyectar el avance
          </span>
        </div>

        <div className="space-y-4">
          {viablePendingActivities.map((act) => {
            const currentVal =
              simulatedOverrides[act.id] !== undefined
                ? simulatedOverrides[act.id]
                : act.porcentajeAutomatizado;

            return (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {act.procesoMacro}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {act.puesto} • {act.responsableFuncional}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {act.actividadProceso}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-600 font-semibold">
                      Carga: <b>{act.horasMensualesActividad}h</b>
                    </span>
                    <button
                      onClick={() => handleSimulatePercent(act.id, 100)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs"
                    >
                      100% Auto
                    </button>
                  </div>
                </div>

                {/* Slider */}
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentVal}
                    onChange={(e) => handleSimulatePercent(act.id, Number(e.target.value))}
                    className="flex-1 accent-[#E1197E] h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="w-14 text-right font-mono font-black text-sm text-slate-900">
                    {currentVal}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
