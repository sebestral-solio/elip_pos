import React from "react";
import { FaSearch } from "react-icons/fa";
import { FaUserCircle } from "react-icons/fa";
import { FaBell } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: (data) => {
      console.log(data);
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center py-4 px-8 bg-white shadow-sm">
      {/* LOGO */}
      <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer">
        <div className="h-8 w-8 flex items-center justify-center bg-red-600 rounded-md">
          <span className="text-white font-bold text-xl">R</span>
        </div>
        <h1 className="text-lg font-semibold text-[black] tracking-wide">
          Restro
        </h1>
      </div>

      {/* SEARCH */}
      <div className="flex items-center gap-4 bg-[#f2f3f5] rounded-[15px] px-5 py-2 w-[500px]">
        <FaSearch className="text-[black]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-[#f2f3f5] outline-none text-[#f5f5f5]"
        />
      </div>

      {/* LOGGED USER DETAILS */}
      <div className="flex items-center gap-4">
        {userData.role === "Admin" && (
          <div onClick={() => navigate("/dashboard")} className="bg-[#1f1f1f] rounded-[15px] p-3 cursor-pointer">
            <MdDashboard className="text-[#f5f5f5] text-2xl" />
          </div>
        )}
        {/* <div className="bg-[#1f1f1f] rounded-[15px] p-3 cursor-pointer">
          <FaBell className="text-[#f5f5f5] text-2xl" />
        </div> */}
        <div className="flex items-center gap-3 cursor-pointer">
          <FaUserCircle className="text-[black] text-4xl" />
          <div className="flex flex-col items-start">
            <h1 className="text-md text-[black] font-semibold tracking-wide">
              {userData.name || "TEST USER"}
            </h1>
            <p className="text-xs text-[black] font-medium">
              {userData.role || "Role"}
            </p>
          </div>
          <IoLogOut
            onClick={handleLogout}
            className="text-[black] ml-2"
            size={40}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
