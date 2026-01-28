import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";

export function CatalogPage() {
  const [search, setSearch] = useState("");
  const { addItem, count } = useCart();

  const productsQuery = trpc.products.list.useQuery({
    skip: 0,
    take: 20,
    search: search || undefined,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
            <Link
              to="/chef/cart"
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Cart ({count})
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          />
        </div>

        {productsQuery.isLoading && <p>Loading products...</p>}
        {productsQuery.error && <p className="text-red-600">Error loading products</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productsQuery.data?.items.map((product) =>
            product.options.map((option) => (
              <div key={option.id} className="bg-white rounded-lg shadow overflow-hidden">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{option.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Type: {option.unitType === "FIXED" ? "Fixed unit" : "By weight"}
                  </p>
                  <p className="text-lg font-bold text-primary mt-3">
                    R$ {(option.basePrice / 100).toFixed(2)}
                  </p>
                  <button
                    onClick={() =>
                      addItem({
                        productOptionId: option.id,
                        productName: product.name,
                        optionName: option.name,
                        unitType: option.unitType,
                        requestedQty: 1,
                        price: option.basePrice,
                      })
                    }
                    className="mt-4 w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
