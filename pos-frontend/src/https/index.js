import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/api/table/", data);
export const getTables = () => axiosWrapper.get("/api/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/api/table/${tableId}`, tableData);

// Payment Endpoints
export const createPaymentIntent = (data) =>
  axiosWrapper.post("/api/payment/create-payment-intent", data);
export const confirmPayment = (data) =>
  axiosWrapper.post("/api/payment/confirm-payment", data);
export const getTerminalReaders = () =>
  axiosWrapper.get("/api/payment/terminal/readers");
export const createTerminalLocation = (data) =>
  axiosWrapper.post("/api/payment/terminal/location", data);
export const createConnectionToken = () =>
  axiosWrapper.post("/api/payment/connection-token");
export const checkPaymentStatus = (paymentIntentId) =>
  axiosWrapper.get(`/api/payment/status/${paymentIntentId}`);
export const capturePaymentIntent = (data) =>
  axiosWrapper.post("/api/payment/capture", data);
export const processPaymentOnReader = (data) =>
  axiosWrapper.post("/api/payment/process-on-reader", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = () => axiosWrapper.get("/api/order");
export const updateOrderStatus = ({ orderId, paymentStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { paymentStatus });

// Product Endpoints
export const getProducts = () => axiosWrapper.get("/api/products");
export const getProductById = (productId) => axiosWrapper.get(`/api/products/${productId}`);
export const addProduct = (data) => axiosWrapper.post("/api/products", data);
export const updateProduct = ({ productId, ...productData }) =>
  axiosWrapper.put(`/api/products/${productId}`, productData);
export const deleteProduct = (productId) => axiosWrapper.delete(`/api/products/${productId}`);
