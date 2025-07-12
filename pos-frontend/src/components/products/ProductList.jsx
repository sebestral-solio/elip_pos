import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";
import { FaShoppingCart } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../https";
import { enqueueSnackbar } from "notistack";

const ProductList = () => {
  const [itemQuantities, setItemQuantities] = useState({});
  const dispatch = useDispatch();
  
  const { data: productsData, isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      return await getProducts();
    }
  });

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Failed to load products", { variant: "error" });
    }
  }, [isError]);

  const increment = (id, maxAvailable) => {
    setItemQuantities(prev => {
      const currentQuantity = prev[id] || 0;
      // Don't allow incrementing beyond available stock or max of 10
      const maxAllowed = Math.min(maxAvailable || 10, 10);
      if (currentQuantity >= maxAllowed) {
        if (maxAvailable && currentQuantity >= maxAvailable) {
          enqueueSnackbar(`Cannot add more. Only ${maxAvailable} in stock.`, { variant: "warning" });
        }
        return prev;
      }
      return { ...prev, [id]: currentQuantity + 1 };
    });
  };

  const decrement = (id) => {
    setItemQuantities(prev => {
      const currentQuantity = prev[id] || 0;
      if (currentQuantity <= 0) return prev;
      return { ...prev, [id]: currentQuantity - 1 };
    });
  };

  const handleAddToCart = (product) => {
    // If quantity is 0, add 1 by default
    const quantity = itemQuantities[product._id] || 0;
    const quantityToAdd = quantity === 0 ? 1 : quantity;
    
    // Check if requested quantity is available in stock
    if (product.quantity < quantityToAdd) {
      enqueueSnackbar(
        `Insufficient stock! Only ${product.quantity} ${product.name} available.`, 
        { variant: "error" }
      );
      return;
    }
    
    // Check if product is available
    if (product.available === false) {
      enqueueSnackbar(`${product.name} is currently out of stock!`, { variant: "error" });
      return;
    }

    const { name, price } = product;
    const newObj = { 
      id: product._id, 
      name, 
      pricePerQuantity: price, 
      quantity: quantityToAdd, 
      price: price * quantityToAdd 
    };

    dispatch(addItems(newObj));
    
    // Don't reset the quantity counter
    // Keep the current quantity for easier repeated additions

    enqueueSnackbar(`${name} added to cart`, { variant: "success" });
  };

  // Group products by category
  const groupedProducts = productsData?.data?.data?.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {}) || {};

  if (isLoading) {
    return <div className="text-center py-10 text-white">Loading products...</div>;
  }

  // If we have no products from the API, use the static menu data
  const hasProducts = productsData?.data?.data?.length > 0;

  return (
    <div className="p-4 min-h-screen bg-[#f2f3f5]">
      <h1 className="text-2xl font-bold text-black mb-6">Products</h1>
      {hasProducts ? (
        // Render products from API
        Object.entries(groupedProducts).map(([category, products]) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-bold text-black mb-4">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                  onClick={() => product.available && handleAddToCart(product)}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-black font-medium text-lg">{product.name}</h3>
                    {/* <div className="bg-red-500 text-white p-2 rounded-lg">
                      <FaShoppingCart size={20} />
                    </div> */}
                  </div>
                  
                  {product.description && (
                    <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                  )}
                  
                  <div className="flex justify-between items-center mt-4" onClick={(e) => e.stopPropagation()}>
                    <p className="text-black font-bold">₹{product.price}</p>
                    {/* <div className="flex items-center bg-red-500 px-3 py-2 rounded-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          decrement(product._id);
                        }}
                        className="text-white text-xl"
                      >
                        &minus;
                      </button>
                      <span className="text-white mx-3">
                        {itemQuantities[product._id] || 0}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          increment(product._id, product.quantity);
                        }}
                        className="text-white text-xl"
                        disabled={!product.available}
                      >
                        &#43;
                      </button>
                    </div> */}
                  </div>
                  
                  {product.available === false && (
                    <div className="mt-2 bg-red-100 text-red-600 text-xs py-1 px-2 rounded text-center">
                      Out of Stock
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-10 text-white">
          <p>No products available. Please add products to the inventory.</p>
        </div>
      )}
    </div>
  );
};

export default ProductList;
