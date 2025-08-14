import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, Dashboard, Configuration } from "./pages";
import Products from "./pages/Products";
import Header from "./components/shared/Header";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader"

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  const hideHeaderRoutes = ["/auth"];
  const { isAuth } = useSelector(state => state.user);

  if(isLoading) return <FullScreenLoader />

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && <Header />}
      <Routes>
        <Route
          path="/"
          element={
            <AdminRoute>
              <Home />
            </AdminRoute>
          }
        />
        <Route path="/auth" element={isAuth ? <AuthRedirect /> : <Auth />} />
        <Route
          path="/orders"
          element={
            <AdminCashierRoute>
              <Orders />
            </AdminCashierRoute>
          }
        />
        <Route
          path="/configuration"
          element={
            <AdminRoute>
              <Configuration />
            </AdminRoute>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoutes>
              <Products />
            </ProtectedRoutes>
          }
        />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </>
  );
}

function ProtectedRoutes({ children }) {
  const { isAuth } = useSelector((state) => state.user);
  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isAuth, role } = useSelector((state) => state.user);

  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  // If not an admin, redirect to menu page
  if (role !== "Admin") {
    return <Navigate to="/menu" />;
  }

  return children;
}

function AuthRedirect() {
  const { role } = useSelector((state) => state.user);

  // Redirect based on role after authentication
  if (role === "Admin") {
    return <Navigate to="/" />;
  } else {
    // Cashier and stall_manager go to menu
    return <Navigate to="/menu" />;
  }
}

function AdminCashierRoute({ children }) {
  const { isAuth, role } = useSelector((state) => state.user);

  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  // Allow Admin, Cashier, and stall_manager roles
  if (role !== "Admin" && role !== "Cashier" && role !== "stall_manager") {
    return <Navigate to="/menu" />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
