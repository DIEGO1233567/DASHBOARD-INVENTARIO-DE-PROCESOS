import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { ActivityItem } from '../types/dashboard';

interface WorkloadAnalysisProps {
  activities: ActivityItem[];
  selectedGerenciaName: string;
}

export const WorkloadAnalysis: React.FC<WorkloadAnalysisProps> = ({
  activities,
  selectedGerenciaName,
}) => {
  const [viewMode, setViewMode] = useState<'puestos' | 'responsables'>('puestos');

  const filteredActivities = useMemo(() => {
    return selectedGerenciaName
      ? activities.filter((a) => a.gerencia === selectedGerenciaName)
      : activities;
  }, [activities, selectedGerenciaName]);

  // Aggregate by Puesto
  const puestosData = useMemo(() => {
    const map = new Map<
      string,
      {
        puesto: string;
        gerencia: string;
        actividadesCount: number;
        horasActividad: number;
        horasAuto: number;
        horasManual: number;
        horasViablesPendientes: number;
        responsables: Set<string>;
      }
    >();

    for (const a of filteredActivities) {
      const key = a.puesto || 'Sin Puesto Asignado';
      if (!map.has(key)) {
        map.set(key, {
          puesto: key,
          gerencia: a.gerencia,
          actividadesCount: 0,
          horasActividad: 0,
          horasAuto: 0,
          horasManual: 0,
          horasViablesPendientes: 0,
          responsables: new Set<string>(),
        });
      }
      const entry = map.get(key)!;
      entry.actividadesCount++;
      entry.horasActividad += a.horasMensualesActividad;
      entry.horasAuto += a.horasMensualesAutomatizadas;
      entry.horasManual += a.horasManuales;
      if (a.esAutomatizable === 'SÍ') {
        entry.horasViablesPendientes += Math.max(0, a.horasMensualesActividad - a.horasMensualesAutomatizadas);
      }
      if (a.responsableFuncional) {
        entry.responsables.add(a.responsableFuncional);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.horasManual - a.horasManual);
  }, [filteredActivities]);

  // Aggregate by Responsable Funcional
  const responsablesData = useMemo(() => {
    const map = new Map<
      string,
      {
        responsable: string;
        puesto: string;
        gerencia: string;
        actividadesCount: number;
        horasActividad: number;
        horasAuto: number;
        horasManual: number;
        horasViablesPendientes: number;
        herramientas: Set<string>;
      }
    >();

    for (const a of filteredActivities) {
      const key = a.responsableFuncional || 'Equipo Operativo';
      if (!map.has(key)) {
        map.set(key, {
          responsable: key,
          puesto: a.puesto,
          gerencia: a.gerencia,
          actividadesCount: 0,
          horasActividad: 0,
          horasAuto: 0,
          horasManual: 0,
          horasViablesPendientes: 0,
          herramientas: new Set<string>(),
        });
      }
      const entry = map.get(key)!;
      entry.actividadesCount++;
      entry.horasActividad += a.horasMensualesActividad;
      entry.horasAuto += a.horasMensualesAutomatizadas;
      entry.horasManual += a.horasManuales;
      if (a.esAutomatizable === 'SÍ') {
        entry.horasViablesPendientes += Math.max(0, a.horasMensualesActividad - a.horasMensualesAutomatizadas);
      }
      if (a.herramienta) {
        entry.herramientas.add(a.herramienta);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.horasManual - a.horasManual);
  }, [filteredActivities]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-[#E1197E] text-[10px] font-bold uppercase tracking-wider">
              Nivel 4 • Carga Operativa
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Carga Operativa de Equipos de Trabajo en Tiempo Real
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Monitorea el balance de horas manuales vs. horas liberadas por puesto y colaborador, identificando puntos de saturación.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setViewMode('puestos')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'puestos'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Por Puesto ({puestosData.length})</span>
          </button>
          <button
            onClick={() => setViewMode('responsables')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'responsables'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Por Responsable ({responsablesData.length})</span>
          </button>
        </div>
      </div>

      {/* Grid of Workload items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {viewMode === 'puestos'
          ? puestosData.map((item) => {
              const pctAuto =
                item.horasActividad > 0
                  ? Math.round((item.horasAuto / item.horasActividad) * 100)
                  : 0;
              const isHeavyManual = item.horasManual > 35;

              return (
                <div
                  key={item.puesto}
                  className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E1197E] bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                          {item.gerencia}
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          {item.puesto}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isHeavyManual
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {isHeavyManual ? 'Carga Manual Alta' : 'Carga Equilibrada'}
                      </span>
                    </div>

                    {/* Progress Bar of Workload */}
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 font-medium">Distribución de Horas</span>
                        <span className="text-slate-900 font-mono font-bold">
                          {item.horasActividad}h totales
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pctAuto}%` }}
                          title={`Automatizado: ${item.horasAuto}h (${pctAuto}%)`}
                        />
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${100 - pctAuto}%` }}
                          title={`Manual: ${item.horasManual}h (${100 - pctAuto}%)`}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                        <span className="text-emerald-700">Auto: {item.horasAuto}h ({pctAuto}%)</span>
                        <span className="text-amber-700">Manual: {item.horasManual}h ({100 - pctAuto}%)</span>
                      </div>
                    </div>

                    {/* Stat Badges */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Actividades</span>
                        <span className="text-base font-black text-slate-900">{item.actividadesCount}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-indigo-700 font-bold block mb-0.5">Potencial Viable</span>
                        <span className="text-base font-black text-indigo-700">
                          +{item.horasViablesPendientes}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Responsables:</span>
                    <span className="text-slate-800 font-bold truncate max-w-[160px]">
                      {Array.from(item.responsables).join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })
          : responsablesData.map((item) => {
              const pctAuto =
                item.horasActividad > 0
                  ? Math.round((item.horasAuto / item.horasActividad) * 100)
                  : 0;

              return (
                <div
                  key={item.responsable}
                  className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E1197E] bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                          {item.gerencia}
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          {item.responsable}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">{item.puesto}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {pctAuto}% auto
                      </span>
                    </div>

                    {/* Progress Bar of Workload */}
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 font-medium">Carga Mensual Asignada</span>
                        <span className="text-slate-900 font-mono font-bold">
                          {item.horasActividad}h
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pctAuto}%` }}
                        />
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${100 - pctAuto}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                        <span className="text-emerald-700">Liberadas: {item.horasAuto}h</span>
                        <span className="text-amber-700">Manuales: {item.horasManual}h</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-3 text-xs flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Oportunidad viable pendiente:</span>
                      <span className="font-bold text-indigo-700">+{item.horasViablesPendientes}h / mes</span>
                    </div>
                  </div>

                  {/* Tools used */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="block mb-1 text-[10px] uppercase text-slate-400 font-bold">
                      Herramientas en uso:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(item.herramientas).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
};
