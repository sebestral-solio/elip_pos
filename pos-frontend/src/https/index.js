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
export const createCheckoutSession = (data) =>
  axiosWrapper.post("/api/payment/create-checkout-session", data);
export const verifyCheckoutSession = (sessionId, orderId) =>
  axiosWrapper.get(`/api/payment/verify-checkout/${sessionId}/${orderId}`);
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
export const getOrders = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return axiosWrapper.get(`/api/order${queryString ? `?${queryString}` : ''}`);
};
export const getOrderByOrderId = (orderId) => axiosWrapper.get(`/api/order/by-order-id/${orderId}`);
export const updateOrderStatus = ({ orderId, paymentStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { paymentStatus });

// Product Endpoints
export const getProducts = () => axiosWrapper.get("/api/products");
export const getProductById = (productId) => axiosWrapper.get(`/api/products/${productId}`);
export const addProduct = (data) => axiosWrapper.post("/api/products", data);
export const updateProduct = ({ productId, ...productData }) =>
  axiosWrapper.put(`/api/products/${productId}`, productData);
export const deleteProduct = (productId) => axiosWrapper.delete(`/api/products/${productId}`);

// Configuration Endpoints
export const updateTaxRate = (data) => axiosWrapper.put("/api/configuration/tax-rate", data);
export const updatePlatformFeeRate = (data) => axiosWrapper.put("/api/configuration/platform-fee-rate", data);

// Terminal Management Endpoints
export const verifyTerminal = (data) => axiosWrapper.post("/api/configuration/terminals/verify", data);
export const addTerminal = (data) => axiosWrapper.post("/api/configuration/terminals", data);
export const getTerminals = () => axiosWrapper.get("/api/configuration/terminals");
export const getTerminal = (terminalId) => axiosWrapper.get(`/api/configuration/terminals/${terminalId}`);
export const updateTerminal = ({ terminalId, ...terminalData }) => 
  axiosWrapper.put(`/api/configuration/terminals/${terminalId}`, terminalData);
export const deleteTerminal = (terminalId) => axiosWrapper.delete(`/api/configuration/terminals/${terminalId}`);
export const updateTerminalStatus = ({ terminalId, ...statusData }) => 
  axiosWrapper.patch(`/api/configuration/terminals/${terminalId}/status`, statusData);
export const assignTerminalToStall = (terminalId, data) => 
  axiosWrapper.put(`/api/configuration/terminals/${terminalId}/assign`, data);
export const unassignTerminalFromStall = (terminalId) => 
  axiosWrapper.put(`/api/configuration/terminals/${terminalId}/unassign`);
export const getTerminalAssignments = () => axiosWrapper.get("/api/configuration/terminals/assignments");
export const getTaxRate = () => axiosWrapper.get("/api/configuration/tax-rate");
export const getPlatformFeeRate = () => axiosWrapper.get("/api/configuration/platform-fee-rate");

// Stall Manager Endpoints
export const getStallManagers = () => axiosWrapper.get("/api/stall-managers");
export const createStallManager = (data) => axiosWrapper.post("/api/stall-managers", data);
export const updateStallManager = ({ managerId, ...managerData }) =>
  axiosWrapper.put(`/api/stall-managers/${managerId}`, managerData);
export const deleteStallManager = (managerId) => axiosWrapper.delete(`/api/stall-managers/${managerId}`);
export const stallManagerLogin = (data) => axiosWrapper.post("/api/stall-managers/login", data);

// Stall Endpoints
export const getStalls = () => axiosWrapper.get("/api/stalls");
export const getStallById = (stallId) => axiosWrapper.get(`/api/stalls/${stallId}`);
export const createStall = (data) => axiosWrapper.post("/api/stalls", data);
export const updateStall = ({ stallId, ...stallData }) =>
  axiosWrapper.put(`/api/stalls/${stallId}`, stallData);
export const deleteStall = (stallId) => axiosWrapper.delete(`/api/stalls/${stallId}`);
