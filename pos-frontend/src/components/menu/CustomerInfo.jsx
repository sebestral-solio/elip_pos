import React, { useState } from "react";
import { useSelector } from "react-redux";
import { formatDate } from "../../utils";
import { FaShoppingBag } from "react-icons/fa";

const CustomerInfo = () => {
  const [dateTime, setDateTime] = useState(new Date());
  const customerData = useSelector((state) => state.customer);
  const cartItems = useSelector((state) => state.cart?.items || []);
  const itemCount = cartItems.length;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col items-start">
        <h1 className="text-md text-[#fffff] font-semibold tracking-wide">
          Quick Checkout
        </h1>
        <p className="text-xs text-[#fffff] font-medium mt-1">
          #{customerData.orderId || "New Order"} / Take Away
        </p>
        <p className="text-xs text-[#fffff] font-medium mt-2">
          {formatDate(dateTime)}
        </p>
      </div>
      <div className="bg-[red] p-3 text-[white] rounded-lg flex items-center justify-center">
        <FaShoppingBag size={20} />
        {itemCount > 0 && (
          <span className="ml-2 text-sm">{itemCount}</span>
        )}
      </div>
    </div>
  );
};

export default CustomerInfo;
