"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import { obtenerDashboard } from "@/services/dashboardService";
import type { DashboardData } from "@/types/dashboard";



export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        setCargando(true);

        const datos = await obtenerDashboard();

        setDashboard(datos);
        setError(null);
      } catch (err) {
        console.error("Error al cargar dashboard:", err);

        setError("No se pudieron cargar los datos del dashboard.");
      } finally {
        setCargando(false);
      }
    };

    cargarDashboard();
  }, []);

  if (cargando) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ferro-black mb-6">
          Dashboard
        </h1>

        <p className="text-gray-500">
          Cargando información...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ferro-black mb-6">
          Dashboard
        </h1>

        <p className="text-red-500">
          {error}
        </p>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const stats = [
    {
      title: "Productos",
      value: dashboard.resumen.total_productos,
      change: "",
      changeType: "neutral" as const,
      icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    },
    {
      title: "Categorías",
      value: dashboard.resumen.total_categorias,
      change: "",
      changeType: "neutral" as const,
      icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
    },
    {
      title: "Stock bajo",
      value: dashboard.resumen.productos_stock_bajo,
      change: "",
      changeType: "negative" as const,
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    },
    {
      title: "Movimientos",
      value: dashboard.resumen.total_movimientos,
      change: "",
      changeType: "neutral" as const,
      icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ferro-black mb-6">Dashboard</h1>
      <p className="text-gray-500 mb-6">Resumen general del sistema</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Movimientos recientes</h2>
          <div className="space-y-4">
            {dashboard.movimientos_recientes.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No hay movimientos registrados.
              </p>
            ) : (
              dashboard.movimientos_recientes.map((movement) => (
                <div
                  key={movement.id_movimiento}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {movement.producto}
                    </p>

                    <p className="text-xs text-gray-500">
                      {new Date(movement.fecha_movimiento).toLocaleDateString()}
                    </p>

                    <p className="text-xs text-gray-400">
                      {movement.usuario}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        movement.tipo_movimiento === "entrada"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {movement.tipo_movimiento === "entrada"
                        ? "Entrada"
                        : "Salida"}
                    </span>

                    <span className="text-sm font-medium">
                      {movement.cantidad}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Productos con stock bajo</h2>
          <div className="space-y-4">
            {dashboard.stock_bajo.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No hay productos con stock bajo.
              </p>
            ) : (
              <div className="space-y-4">
                {dashboard.stock_bajo.map((producto) => (
                  <div
                    key={producto.id_producto}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {producto.nombre}
                      </p>

                      <p className="text-xs text-gray-500">
                        Stock mínimo: {producto.stock_minimo}
                      </p>
                    </div>

                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                      {producto.stock_actual} disponibles
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
