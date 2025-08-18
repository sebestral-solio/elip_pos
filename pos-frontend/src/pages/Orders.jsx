import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import { formatDateAndTime } from "../utils";
import { FaSearch, FaChevronLeft, FaChevronRight, FaEye } from "react-icons/fa";
import { useSelector } from "react-redux";

const Orders = () => {
  // Get user info from Redux store
  const { _id: userId, role } = useSelector(state => state.user);
  
  // State management
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stallFilter, setStallFilter] = useState("");
  const [stallManagerFilter, setStallManagerFilter] = useState("");

  useEffect(() => {
    document.title = "POS | Orders"
  }, [])

  // Prepare query parameters for API call
  const queryParams = useMemo(() => {
    const params = {};
    
    // Admin users can filter by stall or stall manager
    if (role === "Admin") {
      if (stallFilter) params.stallId = stallFilter;
      if (stallManagerFilter) params.stallManagerId = stallManagerFilter;
    }
    
    return params;
  }, [role, stallFilter, stallManagerFilter]);

  // Fetch orders data with dynamic query key based on user and filters
  const { data: resData, isError, isLoading } = useQuery({
    queryKey: ["orders", userId, role, queryParams],
    queryFn: async () => {
      return await getOrders(queryParams);
    },
    placeholderData: keepPreviousData,
    enabled: !!userId // Only fetch when user ID is available
  });

  // Note: Payment status is read-only as it's controlled by payment webhooks
  // Only order preparation status should be manually editable

  if(isError) {
    enqueueSnackbar("Something went wrong!", {variant: "error"})
  }

  // Get orders data
  const orders = resData?.data?.data || [];

  // Filter and search logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      const statusMatch = statusFilter === "all" ||
        (statusFilter === "pending" && order.status === "Pending") ||
        (statusFilter === "completed" && order.status === "Completed") ||
        (statusFilter === "failed" && order.status === "Failed");

      // Payment status filter
      const paymentMatch = paymentStatusFilter === "all" ||
        (paymentStatusFilter === "pending" && order.paymentStatus === "Pending") ||
        (paymentStatusFilter === "completed" && order.paymentStatus === "Completed") ||
        (paymentStatusFilter === "failed" && order.paymentStatus === "Failed");

      // Search filter
      const searchMatch = searchTerm === "" ||
        order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerDetails?.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      return statusMatch && paymentMatch && searchMatch;
    }).sort((a, b) => {
      // Sort by date in descending order (most recent first)
      const dateA = new Date(a.orderDate || a.createdAt);
      const dateB = new Date(b.orderDate || b.createdAt);
      return dateB - dateA;
    });
  }, [orders, statusFilter, paymentStatusFilter, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to first page when filters or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, paymentStatusFilter, searchTerm, itemsPerPage]);

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Payment status is read-only - controlled by payment system

  // Handle order details view
  const handleViewOrder = (order) => {
    setSelectedOrder(order);
  };

  return (
    <section className="bg-white min-h-screen flex flex-col pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-gray-800 text-2xl font-bold tracking-wider">
            Orders Management
          </h1>
        </div>
        <div className="text-sm text-gray-600">
          Total: {filteredOrders.length} orders
        </div>
      </div>

      {/* Filters and Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Payment:</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Payments</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Admin-only filters */}
          {role === "Admin" && (
            <>
              {/* Stall Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Stall:</label>
                <input
                  type="text"
                  placeholder="Stall ID (optional)"
                  value={stallFilter}
                  onChange={(e) => setStallFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-40"
                />
              </div>

              {/* Stall Manager Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Manager:</label>
                <input
                  type="text"
                  placeholder="Manager ID (optional)"
                  value={stallManagerFilter}
                  onChange={(e) => setStallManagerFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-40"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto max-h-[calc(100vh-250px)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading orders...</div>
          </div>
        ) : currentOrders.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  S.No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentOrders.map((order, index) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{order.orderId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.customerDetails?.name || 'Guest'}
                    </div>
                    {order.customerDetails?.phone && (
                      <div className="text-sm text-gray-500">
                        {order.customerDetails.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.items?.length || 0} items
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    SGD {order.bills?.totalWithTax?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'Failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.paymentStatus === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : order.paymentStatus === 'Failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(() => {
                      // Show zero revenue for failed or pending payments
                      if (order.paymentStatus === 'Failed' || order.paymentStatus === 'Pending') {
                        return 'SGD 0.00';
                      }
                      
                      const orderTotal = order.bills?.totalWithTax || 0;
                      const platformFeeAmount = order.bills?.platformFeeAmount || 0;
                      const netRevenue = orderTotal - platformFeeAmount;
                      return `SGD ${netRevenue.toFixed(2)}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateAndTime(order.orderDate || order.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="text-red-600 hover:text-red-900 flex items-center gap-1"
                    >
                      <FaEye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-gray-500 text-lg">No orders found</div>
              <div className="text-gray-400 text-sm mt-1">
                {searchTerm || statusFilter !== 'all' || paymentStatusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No orders have been placed yet'
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        // <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        //   <div className={`flex items-center ${totalPages > 1 ? 'justify-between' : 'justify-start'}`}>
        //     <div className="flex items-center gap-4">
        //       <div className="text-sm text-gray-700">
        //         Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
        //       </div>

          <div className="fixed bottom-[60px] left-0 right-0 bg-gray-50 border-t border-gray-200 px-6 py-4 z-40">
    <div className={`flex items-center ${totalPages > 1 ? 'justify-between' : 'justify-start'}`}>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-700">
          Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
        </div>

              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-600">per page</span>
              </div>
            </div>

            {/* Page navigation - only show when there are multiple pages */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              <FaChevronLeft />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page =>
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                )
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm rounded-lg ${
                        currentPage === page
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))
              }
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              <FaChevronRight />
            </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Order ID</label>
                  <div className="text-lg font-semibold">#{selectedOrder.orderId}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <div>{formatDateAndTime(selectedOrder.orderDate || selectedOrder.createdAt)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer</label>
                  <div>{selectedOrder.customerDetails?.name || 'Guest'}</div>
                  {selectedOrder.customerDetails?.phone && (
                    <div className="text-sm text-gray-500">{selectedOrder.customerDetails.phone}</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="flex gap-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.status === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedOrder.status === 'Failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedOrder.status}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.paymentStatus === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedOrder.paymentStatus === 'Failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      Payment: {selectedOrder.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Items</label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm">{item.name}</td>
                          <td className="px-4 py-2 text-sm">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm">SGD {item.price?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm">SGD {(item.price * item.quantity)?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Subtotal:</span>
                  <span>SGD {selectedOrder.bills?.total?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tax:</span>
                  <span>SGD {selectedOrder.bills?.tax?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>SGD {selectedOrder.bills?.totalWithTax?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Bottom Navigation */}
      <div className="mt-auto">
        <BottomNav />
      </div>
    </section>
  );
};

export default Orders;
