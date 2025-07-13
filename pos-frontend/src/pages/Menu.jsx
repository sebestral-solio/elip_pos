import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdShoppingBasket } from "react-icons/md";
import ProductList from "../components/products/ProductList";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";
import { useSelector } from "react-redux";

const Menu = () => {

    useEffect(() => {
      document.title = "POS | Food Store"
    }, [])

  const customerData = useSelector((state) => state.customer);

  return (
    <section className="bg-white h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* Left Div */}
      <div className="flex-[3] overflow-y-auto">
        {/* <div className="flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-gray-800 text-2xl font-bold tracking-wider">
              Products
            </h1>
          </div>
          <div className="flex items-center justify-around gap-4">
            <div className="flex items-center gap-3 cursor-pointer">
              <MdShoppingBasket className="text-[#fffff] text-4xl" />
              <div className="flex flex-col items-start">
                <h1 className="text-md text-[#fffff] font-semibold tracking-wide">
                  Quick Checkout
                </h1>
                <p className="text-xs text-[#fffff] font-medium">
                  Food Store POS
                </p>
              </div>
            </div>
          </div>
        </div> */}

        <ProductList />
      </div>
      {/* Right Div */}
      <div className="flex-[1] bg-[#f2f3f5] mt-4 mr-3 h-[calc(100vh-10rem)] rounded-lg pt-2 relative">
        {/* Customer Info */}
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Cart Items */}
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Bills */}
        <Bill />
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;
