import StatCard from "@/components/StatCard";

const stats = [
  { title: "Productos", value: 120, change: "+12%", changeType: "positive" as const, icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { title: "Categorías", value: 8, change: "+0%", changeType: "neutral" as const, icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
  { title: "Stock bajo", value: 5, change: "-20%", changeType: "negative" as const, icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { title: "Movimientos", value: 42, change: "+15%", changeType: "positive" as const, icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
];

const recentMovements = [
  { product: "Taladro Inalámbrico", type: "entrada", quantity: 10, date: "16 Sep 2026" },
  { product: "Martillo Profesional", type: "salida", quantity: 5, date: "15 Sep 2026" },
  { product: "Sierra Circular", type: "entrada", quantity: 3, date: "14 Sep 2026" },
  { product: "Destornillador Set", type: "salida", quantity: 8, date: "13 Sep 2026" },
];

const topProducts = [
  { name: "Taladro Inalámbrico", consultas: 45 },
  { name: "Martillo", consultas: 32 },
  { name: "Sierra Circular", consultas: 28 },
  { name: "Destornillador", consultas: 25 },
];

export default function DashboardPage() {
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
            {recentMovements.map((movement, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-sm">{movement.product}</p>
                  <p className="text-xs text-gray-500">{movement.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    movement.type === "entrada"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {movement.type === "entrada" ? "Entrada" : "Salida"}
                  </span>
                  <span className="text-sm font-medium">{movement.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Productos más consultados</h2>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-ferro-yellow/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-ferro-yellow font-bold">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{product.name}</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-ferro-yellow h-2 rounded-full"
                      style={{ width: `${(product.consultas / 45) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-500">{product.consultas} consultas</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
