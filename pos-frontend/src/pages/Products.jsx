import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../https";
import BottomNav from "../components/shared/BottomNav";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";

const Products = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    quantity: 0,
    available: true,
    image: ""
  });

  const queryClient = useQueryClient();

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      return await getProducts();
    }
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      enqueueSnackbar("Product added successfully", { variant: "success" });
      resetForm();
    },
    onError: (error) => {
      enqueueSnackbar(`Error adding product: ${error.message}`, { variant: "error" });
    }
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      enqueueSnackbar("Product updated successfully", { variant: "success" });
      resetForm();
    },
    onError: (error) => {
      enqueueSnackbar(`Error updating product: ${error.message}`, { variant: "error" });
    }
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      enqueueSnackbar("Product deleted successfully", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(`Error deleting product: ${error.message}`, { variant: "error" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      category: "",
      description: "",
      quantity: 0,
      available: true,
      image: ""
    });
    setIsModalOpen(false);
    setIsEditMode(false);
    setCurrentProduct(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name || !formData.price || !formData.category) {
      enqueueSnackbar("Please fill all required fields", { variant: "error" });
      return;
    }

    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity)
    };

    if (isEditMode && currentProduct) {
      updateProductMutation.mutate({
        productId: currentProduct._id,
        ...productData
      });
    } else {
      addProductMutation.mutate(productData);
    }
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      description: product.description || "",
      quantity: product.quantity || 0,
      available: product.available !== false, // Default to true if not set
      image: product.image || ""
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (productId) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(productId);
    }
  };

  const products = productsData?.data?.data || [];

  return (
    <div className="bg-white min-h-screen pb-16">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Product Management</h1>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <FaPlus /> Add New Product
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-800">Loading products...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.length > 0 ? (
              products.map((product) => (
                <div
                  key={product._id}
                  className="bg-white border border-gray-200 shadow-md rounded-lg p-4 relative"
                >
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FaTrash />
                    </button>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mt-2">{product.name}</h2>
                  <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-gray-800 font-bold">₹{product.price}</span>
                    <span className="text-gray-600 text-sm">{product.category}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600 text-sm">
                      Stock: {product.quantity || 0}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        product.available
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {product.available ? "Available" : "Out of Stock"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-10 text-gray-800">
                No products available. Add some products to get started.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-300 rounded-lg p-6 w-full max-w-md shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {isEditMode ? "Edit Product" : "Add New Product"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Price *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Category *</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                  rows="3"
                ></textarea>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                  min="0"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Image URL</label>
                <input
                  type="text"
                  name="image"
                  value={formData.image}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 text-gray-800 p-2 rounded-lg"
                />
              </div>
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  name="available"
                  checked={formData.available}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <label className="text-gray-700">Available</label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  {isEditMode ? "Update" : "Add"} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Products;
