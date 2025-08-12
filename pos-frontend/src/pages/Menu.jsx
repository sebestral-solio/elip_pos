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
      <div className="flex-[3] overflow-y-auto pt-20">
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
      <div className="flex-[1] relative flex flex-col">
        {/* Customer Info - Fixed at the top */}
        <div className="flex-none mt-2">
          <CustomerInfo/>
        </div>
        {/* Cart Items - Scrollable middle section */}
        <div className="flex-grow" style={{backgroundColor: "#f2f3f5", minHeight: "300px", maxHeight: "calc(100vh - 300px)", borderTop: "3px solid black", borderBottom: "3px solid black",}}>
          <CartInfo />
        </div>
        {/* Bills - Fixed at the bottom */}
        <div className="flex-none" style={{backgroundColor: "#f2f3f5",}}>
          <Bill />
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;
