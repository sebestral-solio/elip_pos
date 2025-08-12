import React, { useEffect, useRef } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { FaNotesMedical } from "react-icons/fa6";
import { useDispatch, useSelector } from "react-redux";
import { removeItem, updateItemQuantity } from "../../redux/slices/cartSlice";
import { enqueueSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../https";

const CartInfo = () => {
  const cartItems = useSelector((state) => state.cart.items);
  const scrolLRef = useRef();
  const dispatch = useDispatch();

  // Fetch products data to get current stock information
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      return await getProducts();
    }
  });

  // Helper function to calculate available stock
  const getAvailableStock = (productId) => {
    const products = productsData?.data?.data || [];
    const product = products.find(p => p._id === productId);
    if (!product) return 0;

    const sold = product.sold || 0;
    const total = product.quantity || 0;
    return Math.max(0, total - sold);
  };

  // Helper function to get product name
  const getProductName = (productId) => {
    const products = productsData?.data?.data || [];
    const product = products.find(p => p._id === productId);
    return product ? product.name : 'Unknown Product';
  };

  useEffect(() => {
    if(scrolLRef.current){
      scrolLRef.current.scrollTo({
        top: scrolLRef.current.scrollHeight,
        behavior: "smooth"
      })
    }
  },[cartItems]);

  const handleRemove = (itemId) => {
    dispatch(removeItem(itemId));
  }

  const incrementQuantity = (item) => {
    const availableStock = getAvailableStock(item.id);
    const newQuantity = item.quantity + 1;

    // Check if the new quantity would exceed available stock
    if (newQuantity > availableStock) {
      const productName = getProductName(item.id);
      enqueueSnackbar(
        `Cannot add more ${productName}. Only ${availableStock} available in stock.`,
        { variant: "error" }
      );
      return;
    }

    dispatch(updateItemQuantity({
      id: item.id,
      quantity: newQuantity
    }));
  }

  const decrementQuantity = (item) => {
    if (item.quantity > 1) {
      dispatch(updateItemQuantity({
        id: item.id,
        quantity: item.quantity - 1
      }));
    } else {
      // If quantity is 1, remove the item
      dispatch(removeItem(item.id));
      enqueueSnackbar(`${item.name} removed from cart`, { variant: "info" });
    }
  }

  return (
    <div className="px-4 py-2">
      <h1 className="text-lg text-gray-800 font-semibold tracking-wide">
        Order Details
      </h1>
      <div className="mt-4 overflow-y-scroll scrollbar-hide h-[380px] pb-20" ref={scrolLRef} >
        {cartItems.length === 0 ? (
          <p className="text-gray-500 text-sm flex justify-center items-center h-full">Your cart is empty. Start adding items!</p>
        ) : cartItems.map((item) => {
          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-4 mb-2">
              <div className="flex items-center justify-between">
                <h1 className="text-gray-800 font-semibold tracking-wide text-md">
                  {item.name}
                </h1>
                <p className="text-gray-700 font-semibold">x{item.quantity}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <RiDeleteBin2Fill
                    onClick={() => handleRemove(item.id)}
                    className="text-red-600 cursor-pointer hover:text-red-700"
                    size={20}
                  />
                  <FaNotesMedical
                    className="text-teal-600 cursor-pointer hover:text-teal-700"
                    size={20}
                  />
                </div>
                <p className="text-gray-800 text-md font-bold">₹{item.price}</p>
              </div>
              
              {/* Quantity adjustment controls */}
              <div className="flex justify-between items-center mt-3">
                <p className="text-gray-600 text-sm">Adjust quantity:</p>
                <div className="flex items-center bg-red-600 px-3 py-1 rounded-lg">
                  <button
                    onClick={() => decrementQuantity(item)}
                    className="text-white text-xl"
                  >
                    &minus;
                  </button>
                  <span className="text-white mx-3">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => incrementQuantity(item)}
                    className="text-white text-xl"
                  >
                    &#43;
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartInfo;
