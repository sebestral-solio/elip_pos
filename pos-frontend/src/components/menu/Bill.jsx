import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  createOrderRazorpay,
  updateTable,
  verifyPaymentRazorpay,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomerInfo } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import { FaTimes } from "react-icons/fa";

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

const Bill = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartItems = useSelector((state) => state.cart.items);
  const total = useSelector(getTotalPrice);
  const taxRate = 5.25;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [paymentMethod, setPaymentMethod] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();
  
  // Customer information modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState(customerData.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(customerData.customerPhone || "");

  // Handle customer info submission
  const handleCustomerInfoSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!customerName.trim()) {
      enqueueSnackbar("Please enter customer name", { variant: "warning" });
      return;
    }
    
    if (!customerPhone.trim() || customerPhone.length < 10) {
      enqueueSnackbar("Please enter a valid phone number", { variant: "warning" });
      return;
    }
    
    // Save customer info to Redux state
    dispatch(setCustomerInfo({ customerName, customerPhone }));
    
    // Close modal and proceed with order
    setShowCustomerModal(false);
    proceedWithOrder();
  };

  // Show customer info modal before placing order
  const handlePlaceOrderClick = () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });
      return;
    }
    
    // Show customer info modal
    setShowCustomerModal(true);
  };
  
  // Actual order placement logic
  const proceedWithOrder = async () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });

      return;
    }

    if (paymentMethod === "Online") {
      // load the script
      try {
        const res = await loadScript(
          "https://checkout.razorpay.com/v1/checkout.js"
        );

        if (!res) {
          enqueueSnackbar("Razorpay SDK failed to load. Are you online?", {
            variant: "warning",
          });
          return;
        }

        // create order

        const reqData = {
          amount: totalPriceWithTax.toFixed(2),
        };

        const { data } = await createOrderRazorpay(reqData);

        const options = {
          key: `${import.meta.env.VITE_RAZORPAY_KEY_ID}`,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "RESTRO",
          description: "Secure Payment for Your Meal",
          order_id: data.order.id,
          handler: async function (response) {
            const verification = await verifyPaymentRazorpay(response);
            console.log(verification);
            enqueueSnackbar(verification.data.message, { variant: "success" });

            // Place the order
            const orderData = {
              customerDetails: {
                name: customerName,
                phone: customerPhone,
                guests: customerData.guests || 1,
              },
              orderStatus: "In Progress",
              bills: {
                total: total,
                tax: tax,
                totalWithTax: totalPriceWithTax,
              },
              items: cartItems,
              table: customerData.table?.tableId,
              paymentMethod: paymentMethod,
              paymentData: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
              },
            };

            setTimeout(() => {
              orderMutation.mutate(orderData);
            }, 1500);
          },
          prefill: {
            name: customerName,
            email: "",
            contact: customerPhone,
          },
          theme: { color: "#025cca" },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (error) {
        console.log(error);
        enqueueSnackbar("Payment Failed!", {
          variant: "error",
        });
      }
    } else {
      // Place the order
      const orderData = {
        customerDetails: {
          name: customerName,
          phone: customerPhone,
          guests: customerData.guests || 1,
        },
        orderStatus: "In Progress",
        bills: {
          total: total,
          tax: tax,
          totalWithTax: totalPriceWithTax,
        },
        items: cartItems,
        table: customerData.table?.tableId,
        paymentMethod: paymentMethod,
      };
      orderMutation.mutate(orderData);
    }
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;
      console.log(data);

      setOrderInfo(data);
      
      // Clear cart and customer info immediately after successful order
      dispatch(removeAllItems());
      
      // Only update table if there is a table assigned
      if (data.table) {
        const tableData = {
          status: "Booked",
          orderId: data._id,
          tableId: data.table,
        };

        setTimeout(() => {
          tableUpdateMutation.mutate(tableData);
        }, 1500);
      } else {
        // If no table to update, still remove customer info
        dispatch(removeCustomer());
      }

      enqueueSnackbar("Order Placed!", {
        variant: "success",
      });
      setShowInvoice(true);
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
    onSuccess: (resData) => {
      console.log(resData);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
    },
    onError: (error) => {
      console.log(error);
    },
  });

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 bg-[#f2f3f5] py-4 shadow-lg rounded-b-lg">
        <div className="flex items-center justify-between px-5">
          <p className="text-xs text-[black] font-medium">
            Items({cartItems.length})
          </p>
          <h1 className="text-[black] text-md font-bold">
            ₹{total.toFixed(2)}
          </h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">Tax(5.25%)</p>
          <h1 className="text-[black] text-md font-bold">₹{tax.toFixed(2)}</h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">
            Total With Tax
          </p>
          <h1 className="text-[black] text-md font-bold">
            ₹{totalPriceWithTax.toFixed(2)}
          </h1>
        </div>
        <div className="flex items-center gap-3 px-5 mt-4">
          <button
            onClick={() => setPaymentMethod("Cash")}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Cash" ? "bg-[black] text-[white]" : ""
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => setPaymentMethod("Online")}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Online" ? "bg-[black] text-[white]" : ""
            }`}
          >
            Online
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 mt-4">
          <button className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg">
            Print Receipt
          </button>
          <button
            onClick={handlePlaceOrderClick}
            className="bg-[red] px-4 py-3 w-full rounded-lg text-[white] font-semibold text-lg"
          >
            Place Order
          </button>
        </div>
      </div>

      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
      
      {/* Customer Information Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1f1f1f] rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Customer Information</h2>
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleCustomerInfoSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#383737] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter customer name"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#383737] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                  pattern="[0-9]{10}"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Enter a 10-digit phone number</p>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="mr-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#025cca] text-white rounded-md hover:bg-blue-700"
                >
                  Proceed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Bill;
