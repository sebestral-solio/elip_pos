import React, { useEffect, useRef } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { FaNotesMedical } from "react-icons/fa6";
import { useDispatch, useSelector } from "react-redux";
import { removeItem, updateItemQuantity } from "../../redux/slices/cartSlice";
import { enqueueSnackbar } from "notistack";

const CartInfo = () => {
  const cartItems = useSelector((state) => state.cart.items);
  const scrolLRef = useRef();
  const dispatch = useDispatch();

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
    dispatch(updateItemQuantity({
      id: item.id,
      quantity: item.quantity + 1
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
      <div className="mt-4 overflow-y-scroll scrollbar-hide h-[380px] pb-40" ref={scrolLRef} >
        {cartItems.length === 0 ? (
          <p className="text-gray-500 text-sm flex justify-center items-center h-[380px]">Your cart is empty. Start adding items!</p>
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
