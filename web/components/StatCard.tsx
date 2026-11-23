interface StatCardProps {
  title: string;
  value: number | string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: string;
}

export default function StatCard({ title, value, change, changeType = "neutral", icon }: StatCardProps) {
  const changeColor = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
  }[changeType];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-ferro-black truncate">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${changeColor}`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ferro-yellow/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-ferro-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}
