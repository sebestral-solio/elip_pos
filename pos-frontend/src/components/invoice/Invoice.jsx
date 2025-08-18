import React, { useRef } from "react";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { FaCheck } from "react-icons/fa6";

const Invoice = ({ orderInfo, setShowInvoice }) => {
  const invoiceRef = useRef(null);
  const taxRate = useSelector((state) => state.config.taxRate);

  const handlePrint = () => {
    const printContent = invoiceRef.current.innerHTML;
    const WinPrint = window.open("", "", "width=900,height=650");

    // WinPrint.document.write(`
    //         <html>
    //           <head>
    //             <title>Order Receipt</title>
    //             <style>
    //               body { font-family: Arial, sans-serif; padding: 20px; }
    //               .receipt-container { width: 300px; border: 1px solid #ddd; padding: 10px; }
    //               h2 { text-align: center; }
    //             </style>
    //           </head>
    //           <body>
    //             ${printContent}
    //           </body>
    //         </html>
    //       `);

    WinPrint.document.write(`
  <html>
    <head>
      <title>Order Receipt</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          padding: 15px;
          margin: 0;
          font-size: 12px;
          line-height: 1.3;
          width: 300px;
        }
        .dashed-line {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .receipt-header {
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          margin: 8px 0;
        }
        .receipt-info {
          text-align: center;
          font-size: 11px;
          margin: 5px 0;
        }
        .customer-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin: 3px 0;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          margin: 15px 0;
          font-size: 12px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
        }
        .company-name {
          font-weight: bold;
          font-size: 12px;
          margin: 10px 0;
        }
        .thank-you {
          font-weight: bold;
          font-size: 14px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="dashed-line"></div>
      <div class="receipt-header">RECEIPT</div>
      <div class="dashed-line"></div>

      <div class="receipt-info">
        <div>Terminal # N/A&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date: ${new Date().toLocaleDateString('en-GB')}</div>
        <div>${new Date().toLocaleDateString('en-US', { weekday: 'long' })}, ${new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      <div class="customer-row">
        <span>Customer Name</span>
        <span>${orderInfo.customerDetails.name}</span>
      </div>
      <div class="customer-row">
        <span>ID</span>
        <span>${orderInfo.orderId}</span>
      </div>

      <div class="dashed-line"></div>

      ${orderInfo.items.map((item, index) =>
        `<div class="item-row">
          <span>${index + 1}. ${item.name}</span>
          <span>${item.price}SGD </span>
        </div>`
      ).join('')}

      <div class="dashed-line"></div>

      <div class="total-row">
        <span>Tax(${taxRate}%)</span>
        <span>${Math.round(orderInfo.bills.tax)}SGD </span>
      </div>
      <div class="dashed-line"></div>
      <div class="total-row">
        <span>Total</span>
        <span>${Math.round(orderInfo.bills.totalWithTax)}SGD </span>
      </div>
      <div class="dashed-line"></div>
      <div class="footer">
        <div class="company-name">Company Name</div>
        <div class="thank-you">THANK YOU!</div>
      </div>
    </body>
  </html>
`);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-4 rounded-lg shadow-lg w-[400px]">
        {/* Receipt Content for Printing */}

        <div ref={invoiceRef} className="p-4">
          {/* Receipt Header */}
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
              className="w-12 h-12 border-8 border-green-500 rounded-full flex items-center justify-center shadow-lg bg-green-500"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-2xl"
              >
                <FaCheck className="text-white" />
              </motion.span>
            </motion.div>
          </div>

          <h2 className="text-xl font-bold text-center mb-2">Order Receipt</h2>
          <p className="text-gray-600 text-center">Thank you for your order!</p>

          {/* Order Details */}

          <div className="mt-4 border-t pt-4 text-sm text-gray-700">
            <p>
              <strong>Order ID:</strong>{" "}
              {orderInfo.orderId}
            </p>
            <p>
              <strong>Name:</strong> {orderInfo.customerDetails.name}
            </p>
            {/* <p>
              <strong>Phone:</strong> {orderInfo.customerDetails.phone}
            </p> */}
            {/* <p>
              <strong>Guests:</strong> {orderInfo.customerDetails.guests}
            </p> */}
          </div>

          {/* Items Summary */}

          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Items Ordered</h3>
            <ul className="text-sm text-gray-700">
              {orderInfo.items.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center text-xs"
                >
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>SGD {item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bills Summary */}

          <div className="mt-4 border-t pt-4 text-sm">
            <p>
              <strong>Subtotal:</strong> SGD {orderInfo.bills.total.toFixed(2)}
            </p>
            <p>
              <strong>Tax:</strong> SGD {orderInfo.bills.tax.toFixed(2)}
            </p>
            <p className="text-md font-semibold">
              <strong>Grand Total:</strong> SGD 
              {orderInfo.bills.totalWithTax.toFixed(2)}
            </p>
          </div>

          {/* Payment Details */}

          <div className="mb-2 mt-2 text-xs">
            {orderInfo.paymentMethod === "Cash" ? (
              <p>
                <strong>Payment Method:</strong> {orderInfo.paymentMethod}
              </p>
            ) : (
              <>
                <p>
                  <strong>Payment Method:</strong> {orderInfo.paymentMethod}
                </p>
                {/* <p>
                  <strong>Stripe Order ID:</strong>{" "}
                  {orderInfo.paymentData?.stripe_order_id || "N/A"}
                </p> */}
                <p>
                  <strong>Stripe Payment ID:</strong>{" "}
                  {orderInfo.paymentData?.stripe_payment_intent_id || "N/A"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-4">
          <button
            onClick={handlePrint}
            className="text-blue-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            Print Receipt
          </button>
          <button
            onClick={() => setShowInvoice(false)}
            className="text-red-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
