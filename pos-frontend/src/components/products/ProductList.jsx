import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";
import { FaShoppingCart } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../https";
import { enqueueSnackbar } from "notistack";

const ProductList = () => {
  const [itemQuantities, setItemQuantities] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);

  // Helper function to calculate available stock
  const getAvailableStock = (product) => {
    // Unlimited products have infinite stock
    if (product.unlimited) {
      return Infinity;
    }
    const sold = product.sold || 0;
    const total = product.quantity || 0;
    return Math.max(0, total - sold); // Ensure we don't show negative stock
  };

  // Helper function to get current quantity in cart for a product
  const getCartQuantity = (productId) => {
    const cartItem = cartItems.find(item => item.id === productId);
    return cartItem ? cartItem.quantity : 0;
  };
  
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

  const increment = (id, maxAvailable, isUnlimited = false) => {
    setItemQuantities(prev => {
      const currentQuantity = prev[id] || 0;
      const cartQuantity = getCartQuantity(id);
      const totalQuantityAfterIncrement = currentQuantity + 1 + cartQuantity;

      // Skip stock validation for unlimited products
      if (!isUnlimited) {
        // Don't allow incrementing beyond available stock for limited products
        if (totalQuantityAfterIncrement > maxAvailable) {
          enqueueSnackbar(`Cannot add more. Only ${maxAvailable} available in stock. You already have ${cartQuantity} in cart.`, { variant: "warning" });
          return prev;
        }
      }

      // Respect the max of 10 limit for UI purposes (even for unlimited products)
      const maxAllowed = isUnlimited ? 10 : Math.min(maxAvailable || 10, 10);
      if (currentQuantity >= maxAllowed) {
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
    const availableStock = getAvailableStock(product);
    const cartQuantity = getCartQuantity(product._id);
    const totalQuantityAfterAdd = quantityToAdd + cartQuantity;

    // Skip stock validation for unlimited products
    if (!product.unlimited) {
      // Check if total quantity (new + existing in cart) exceeds available stock for limited products
      if (totalQuantityAfterAdd > availableStock) {
        const remainingStock = Math.max(0, availableStock - cartQuantity);
        if (remainingStock === 0) {
          enqueueSnackbar(
            `Cannot add more ${product.name}. You already have ${cartQuantity} in cart and only ${availableStock} available.`,
            { variant: "error" }
          );
        } else {
          enqueueSnackbar(
            `Cannot add ${quantityToAdd} ${product.name}. You can only add ${remainingStock} more (${cartQuantity} already in cart, ${availableStock} available).`,
            { variant: "error" }
          );
        }
        return;
      }

      // Check if limited product is available and has stock
      if (product.available === false || availableStock === 0) {
        enqueueSnackbar(`${product.name} is currently out of stock!`, { variant: "error" });
        return;
      }
    } else {
      // For unlimited products, only check if the product is available (not stock)
      if (product.available === false) {
        enqueueSnackbar(`${product.name} is currently not available!`, { variant: "error" });
        return;
      }
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

  // Extract unique categories from products with counts
  const categories = useMemo(() => {
    if (!productsData?.data?.data) return [];
    const uniqueCategories = [...new Set(productsData.data.data.map(product => product.category))];
    return ["All", ...uniqueCategories.sort()];
  }, [productsData]);

  // Get product count for each category
  const getCategoryCount = (category) => {
    if (!productsData?.data?.data) return 0;
    if (category === "All") return productsData.data.data.length;
    return productsData.data.data.filter(product => product.category === category).length;
  };

  // Filter products based on selected category
  const filteredProducts = useMemo(() => {
    if (!productsData?.data?.data) return [];
    if (selectedCategory === "All") {
      return productsData.data.data;
    }
    return productsData.data.data.filter(product => product.category === selectedCategory);
  }, [productsData, selectedCategory]);

  // Group filtered products by category (for display when "All" is selected)
  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {});
  }, [filteredProducts]);

  if (isLoading) {
    return <div className="text-center py-10 text-white">Loading products...</div>;
  }

  // If we have no products from the API, use the static menu data
  const hasProducts = productsData?.data?.data?.length > 0;

  return (
    <div className="p-4 min-h-screen bg-[#f2f3f5]">
      <h1 className="text-2xl font-bold text-black mb-6">Products</h1>

      {/* Category Filter Buttons */}
      {hasProducts && categories.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-red-600 text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                {category} ({getCategoryCount(category)})
              </button>
            ))}
          </div>
        </div>
      )}

      {hasProducts ? (
        selectedCategory === "All" ? (
          // Render all products grouped by category
          Object.entries(groupedProducts).map(([category, products]) => (
            <div key={category} className="mb-8">
              <h2 className="text-xl font-bold text-black mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => {
                const availableStock = getAvailableStock(product);
                const isOutOfStock = product.available === false || (availableStock === 0 && !product.unlimited);

                return (
                  <div
                    key={product._id}
                    className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
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
                            increment(product._id, availableStock, product.unlimited);
                          }}
                          className="text-white text-xl"
                          disabled={isOutOfStock}
                        >
                          &#43;
                        </button>
                      </div> */}
                    </div>

                    {/* Stock information */}
                    <div className="mt-2 flex justify-between items-center text-xs">
                      <span className="text-gray-500">
                        Available: {product.unlimited ? "Unlimited" : availableStock}
                      </span>
                      {/* <div className="flex gap-2">
                        {getCartQuantity(product._id) > 0 && (
                          <span className="text-blue-600 font-medium">
                            In Cart: {getCartQuantity(product._id)}
                          </span>
                        )}
                        {product.sold > 0 && (
                          <span className="text-gray-500">
                            Sold: {product.sold}
                          </span>
                        )}
                      </div> */}
                    </div>

                    {isOutOfStock && (
                      <div className="mt-2 bg-red-100 text-red-600 text-xs py-1 px-2 rounded text-center">
                        Out of Stock
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
        ) : (
          // Render filtered products for specific category
          <div className="mb-8">
            <h2 className="text-xl font-bold text-black mb-4">{selectedCategory}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const availableStock = getAvailableStock(product);
                const isOutOfStock = product.available === false || (availableStock === 0 && !product.unlimited);

                return (
                  <div
                    key={product._id}
                    className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="text-black font-medium text-lg">{product.name}</h3>
                    </div>

                    {product.description && (
                      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    )}

                    <div className="flex justify-between items-center mt-4" onClick={(e) => e.stopPropagation()}>
                      <p className="text-black font-bold">₹{product.price}</p>
                    </div>

                    {/* Stock information */}
                    <div className="mt-2 flex justify-between items-center text-xs">
                      <span className="text-gray-500">
                        Available: {product.unlimited ? "Unlimited" : availableStock}
                      </span>
                    </div>

                    {isOutOfStock && (
                      <div className="mt-2 bg-red-100 text-red-600 text-xs py-1 px-2 rounded text-center">
                        Out of Stock
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-10 text-white">
          <p>No products available. Please add products to the inventory.</p>
        </div>
      )}
    </div>
  );
};

export default ProductList;
