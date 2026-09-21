interface ProductCardProps {
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  rating?: number;
  badge?: string;
}

export default function ProductCard({ name, price, originalPrice, image, rating = 0, badge }: ProductCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative bg-ferro-light p-6 flex items-center justify-center h-48">
        {badge && (
          <span className="absolute top-3 left-3 bg-ferro-yellow text-ferro-black text-xs font-bold px-2 py-1 rounded">
            {badge}
          </span>
        )}
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-24 h-24 bg-ferro-gray/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-12 h-12 text-ferro-gray"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-ferro-black mb-2">{name}</h3>
        <div className="flex items-center gap-2 mb-2">
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
          )}
          <span className="text-lg font-bold text-ferro-yellow">${price.toFixed(2)}</span>
        </div>
        {rating > 0 && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < rating ? "text-ferro-yellow" : "text-gray-300"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
