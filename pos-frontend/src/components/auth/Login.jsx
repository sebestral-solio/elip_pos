import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query"
import { login, stallManagerLogin } from "../../https/index"
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
 
const Login = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [loginType, setLoginType] = useState("user"); // "user" or "stallManager"
    const [formData, setFormData] = useState({
      email: "",
      password: "",
    });
  
    const handleChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
    }

  
    const handleSubmit = (e) => {
      e.preventDefault();
      loginMutation.mutate(formData);
    }

    const loginMutation = useMutation({
      mutationFn: (reqData) => {
        // Choose the appropriate login function based on loginType
        return loginType === "stallManager" ? stallManagerLogin(reqData) : login(reqData);
      },
      onSuccess: (res) => {
          const { data } = res;
          console.log(data);
          const { _id, name, email, phone, role } = data.data;
          dispatch(setUser({ _id, name, email, phone, role }));
          console.log("role", role);

          // Redirect based on role
          if (role === "Admin") {
            navigate("/"); // Admin goes to dashboard
          } else {
            // Both Cashier and stall_manager go to menu
            navigate("/menu");
          }
      },
      onError: (error) => {
        const { response } = error;
        enqueueSnackbar(response?.data?.message || "Login failed", { variant: "error" });
      }
    })

  return (
    <div>
      {/* Login Type Toggle */}
      <div className="mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLoginType("user")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === "user"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Admin/Cashier
          </button>
          <button
            type="button"
            onClick={() => setLoginType("stallManager")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === "stallManager"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Stall Manager
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label className="block text-gray-700 mb-2 mt-3 text-sm font-medium">
            {loginType === "stallManager" ? "Stall Manager Email" : "Employee Email"}
          </label>
          <div className="flex item-center rounded-lg p-5 px-4 bg-white border border-gray-300">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={loginType === "stallManager" ? "Enter stall manager email" : "Enter employee email"}
              className="bg-transparent flex-1 text-gray-800 focus:outline-none"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-700 mb-2 mt-3 text-sm font-medium">
            Password
          </label>
          <div className="flex item-center rounded-lg p-5 px-4 bg-white border border-gray-300">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="bg-transparent flex-1 text-gray-800 focus:outline-none"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg mt-6 py-3 text-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
};

export default Login;
