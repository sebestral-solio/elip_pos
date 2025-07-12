import React, { useState } from "react";
import { FaHome, FaShoppingBasket } from "react-icons/fa";
import { MdOutlineReorder, MdInventory } from "react-icons/md";
import { CiCircleMore } from "react-icons/ci";
import { BiSolidDish } from "react-icons/bi";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "./Modal";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer } from "../../redux/slices/customerSlice";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState();
  const [phone, setPhone] = useState();
  
  // Get user role from Redux store
  const { role } = useSelector((state) => state.user);
  const isAdmin = role === "Admin";
  

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const increment = () => {
    if(guestCount >= 6) return;
    setGuestCount((prev) => prev + 1);
  }
  const decrement = () => {
    if(guestCount <= 0) return;
    setGuestCount((prev) => prev - 1);
  }

  const isActive = (path) => location.pathname === path;

  const handleCreateOrder = () => {
    // send the data to store
    dispatch(setCustomer({name, phone}));
    navigate("/menu");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 h-16 flex justify-around shadow-md">
      {/* Home button - only visible to admin */}
      {isAdmin && (
        <button
          onClick={() => navigate("/")}
          className={`flex items-center justify-center font-bold ${
            isActive("/") ? "text-white bg-red-600" : "text-gray-700"
          } w-[300px] rounded-[20px]`}
        >
          <FaHome className="inline mr-2" size={20} /> <p>Home</p>
        </button>
      )}
      
      {/* Orders button - only visible to admin */}
      {isAdmin && (
        <button
          onClick={() => navigate("/orders")}
          className={`flex items-center justify-center font-bold ${
            isActive("/orders") ? "text-white bg-red-600" : "text-gray-700"
          } w-[300px] rounded-[20px]`}
        >
          <MdOutlineReorder className="inline mr-2" size={20} /> <p>Orders</p>
        </button>
      )}
      
      {/* Products button - visible to both admin and cashier */}
      <button
        onClick={() => navigate("/products")}
        className={`flex items-center justify-center font-bold ${
          isActive("/products") ? "text-white bg-red-600" : "text-gray-700"
        } w-[${isAdmin ? '300px' : '50%'}] rounded-[20px]`}
      >
        <MdInventory className="inline mr-2" size={20} /> <p>Products</p>
      </button>
      
      {/* Store button - visible to both admin and cashier */}
      <button
        onClick={() => navigate("/menu")}
        className={`flex items-center justify-center font-bold ${
          isActive("/menu") ? "text-white bg-red-600" : "text-gray-700"
        } w-[${isAdmin ? '300px' : '50%'}] rounded-[20px]`}
      >
        <FaShoppingBasket className="inline mr-2" size={20} /> <p>Store</p>
      </button>

      {/* <button
        disabled={isActive("/menu")}
        onClick={openModal}
        className="absolute bottom-6 bg-[#F6B100] text-[#f5f5f5] rounded-full p-4 items-center"
      >
        <BiSolidDish size={40} />
      </button> */}

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Create Order">
        <div>
          <label className="block text-[#ababab] mb-2 text-sm font-medium">Customer Name</label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" name="" placeholder="Enter customer name" id="" className="bg-transparent flex-1 text-white focus:outline-none"  />
          </div>
        </div>
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Customer Phone</label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="number" name="" placeholder="+91-9999999999" id="" className="bg-transparent flex-1 text-white focus:outline-none"  />
          </div>
        </div>

        <button onClick={handleCreateOrder} className="w-full bg-[#F6B100] text-[#f5f5f5] rounded-lg py-3 mt-8 hover:bg-yellow-700">
          Create Order
        </button>
      </Modal>
    </div>
  );
};

export default BottomNav;
