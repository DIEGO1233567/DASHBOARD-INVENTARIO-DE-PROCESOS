import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  HelpCircle,
  Info,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { OverallKpiMetrics } from '../types/dashboard';

interface ExecutiveKpiSummaryProps {
  metrics: OverallKpiMetrics;
  selectedGerenciaName?: string;
}

export const ExecutiveKpiSummary: React.FC<ExecutiveKpiSummaryProps> = ({
  metrics,
  selectedGerenciaName,
}) => {
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const isAutomated = metrics.kpiAutomatizacionGlobal >= 80;
  const isSatisfactory = metrics.kpiSatisfaccionGlobal >= 96;

  return (
    <div className="space-y-4">
      {/* Scope banner if filtered */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E1197E]" />
          <span className="font-bold text-slate-900">Gerencia en Análisis:</span>
          <span className="text-[#E1197E] font-bold text-sm">
            {selectedGerenciaName ? selectedGerenciaName : 'Consolidado Global (Todas las Gerencias)'}
          </span>
        </div>
        <button
          onClick={() => setShowFormulaInfo(!showFormulaInfo)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
        >
          <Info className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold underline">¿Cómo se calculan estos KPIs? (Estándar APQC / Gartner)</span>
        </button>
      </div>

      {/* Explanatory banner if opened */}
      {showFormulaInfo && (
        <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 animate-fade-in space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Regla Oficial para el Cálculo del KPI de Automatización
            </span>
            <button
              onClick={() => setShowFormulaInfo(false)}
              className="text-slate-500 hover:text-slate-900 font-bold px-2 py-0.5 rounded bg-white border border-slate-200"
            >
              Cerrar ✕
            </button>
          </div>
          <p className="text-slate-700 leading-relaxed">
            El KPI de automatización se mide considerando únicamente el potencial de desarrollo viable de cada área.
            Las actividades marcadas como <b>¿Es Automatizable? = NO</b> se descartan del cálculo (basado en el estándar de
            gestión de TI y APQC, donde el criterio y juicio humano no deben penalizar la métrica de capacidad tecnológica).
            De esta manera, el 100% de la meta se adapta únicamente al universo de tareas viables.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
              <div className="font-bold text-emerald-700 mb-1">🟢 Umbral de Automatización Viable:</div>
              <div><b>80% a 100%: Verde (Meta Cumplida).</b> El proceso alcanza madurez operativa esperada liberando la mayor parte del trabajo repetitivo.</div>
              <div className="text-amber-800 mt-1"><b>&lt; 80%: Amarillo (En Desarrollo).</b> Existen oportunidades pendientes por automatizar.</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
              <div className="font-bold text-emerald-700 mb-1">🟢 Funcionamiento Operativo Mensual:</div>
              <div><b>96% a 100%: Verde (Satisfactorio).</b> Línea base histórica garantizada.</div>
              <div className="text-rose-700 mt-1"><b>&lt; 96%: Rojo (Crítico).</b> Requiere atención inmediata ante desvíos o incidencias.</div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: KPI de Automatización Viable */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-600" />
                KPI Automatización
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isAutomated
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {isAutomated ? '🟢 Meta Cumplida' : '🟡 En Desarrollo'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-black text-slate-900 tracking-tight">
                {metrics.kpiAutomatizacionGlobal}%
              </span>
              <span className="text-xs text-slate-500 font-semibold">de universo viable</span>
            </div>

            {/* Threshold Progress Bar */}
            <div className="space-y-1 mb-3">
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-700 rounded-full ${
                    isAutomated ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.kpiAutomatizacionGlobal)}%` }}
                />
                {/* 80% Threshold Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60"
                  style={{ left: '80%' }}
                  title="Meta de Industria: 80%"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>0%</span>
                <span className="text-emerald-700">Meta: 80%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Viable: {metrics.horasViablesAutomatizadas}h de {metrics.horasViablesActividad}h</span>
            <span className="text-slate-400 font-medium">Estándar APQC</span>
          </div>
        </div>

        {/* KPI 2: Funcionamiento Operativo Mensual */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Operatividad Mensual
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isSatisfactory
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                {isSatisfactory ? '🟢 Satisfactorio' : '🔴 Crítico'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-black text-slate-900 tracking-tight">
                {metrics.kpiSatisfaccionGlobal}%
              </span>
              <span className="text-xs text-slate-500 font-semibold">confirmación</span>
            </div>

            {/* Threshold Progress Bar */}
            <div className="space-y-1 mb-3">
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-700 rounded-full ${
                    isSatisfactory ? 'bg-indigo-600' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.kpiSatisfaccionGlobal)}%` }}
                />
                {/* 96% Threshold Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60"
                  style={{ left: '96%' }}
                  title="Línea base histórica: 96%"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>0%</span>
                <span className="text-indigo-700">Línea base: 96%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Continuidad y satisfacción bots</span>
            <span className="text-slate-400 font-medium">Histórico 96%</span>
          </div>
        </div>

        {/* KPI 3: Carga Operativa Mensual (Horas) */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#E1197E]" />
                Carga Operativa Total
              </span>
              <span className="text-xs text-slate-500 font-bold">
                {metrics.totalTareas} actividades
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-black text-slate-900 tracking-tight">
                {metrics.totalHorasActividad.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">horas / mes</span>
            </div>

            {/* Breakdown Pills */}
            <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Liberadas (Auto)</div>
                <div className="text-sm font-black text-emerald-900">
                  {metrics.totalHorasAutomatizadas.toLocaleString()}h
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Carga Manual</div>
                <div className="text-sm font-black text-amber-900">
                  {metrics.totalHorasManuales.toLocaleString()}h
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Juicio humano no automatizable:</span>
            <span className="text-slate-700 font-bold">{metrics.horasDescartadasNoViables}h</span>
          </div>
        </div>

        {/* KPI 4: Digitalización de Procesos */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                Digitalización
              </span>
              <span className="text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                {metrics.totalDigitalizadas} de {metrics.totalTareas}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-black text-slate-900 tracking-tight">
                {metrics.porcentajeDigitalizacionTotal}%
              </span>
              <span className="text-xs text-slate-500 font-semibold">digitalizado</span>
            </div>

            {/* Split bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-3 border border-slate-200">
              <div
                className="h-full bg-purple-600"
                style={{ width: `${metrics.porcentajeDigitalizacionTotal}%` }}
                title={`Digitalizado: ${metrics.porcentajeDigitalizacionTotal}%`}
              />
              <div
                className="h-full bg-slate-200"
                style={{ width: `${100 - metrics.porcentajeDigitalizacionTotal}%` }}
                title={`Por digitalizar: ${100 - metrics.porcentajeDigitalizacionTotal}%`}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1 text-purple-700">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              Digitalizadas: {metrics.totalDigitalizadas}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Pendientes: {metrics.totalNoDigitalizadas}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
