import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: []
};

const cartSlice = createSlice({
    name : "cart",
    initialState,
    reducers : {
        addItems : (state, action) => {
            const existingItemIndex = state.items.findIndex(item => item.id === action.payload.id);
            
            if (existingItemIndex !== -1) {
                // Item already exists, update quantity and price
                const existingItem = state.items[existingItemIndex];
                const newQuantity = existingItem.quantity + action.payload.quantity;
                
                state.items[existingItemIndex] = {
                    ...existingItem,
                    quantity: newQuantity,
                    price: existingItem.pricePerQuantity * newQuantity
                };
            } else {
                // Item doesn't exist, add it to cart
                state.items.push(action.payload);
            }
        },

        removeItem: (state, action) => {
            state.items = state.items.filter(item => item.id != action.payload);
        },

        removeAllItems: (state) => {
            state.items = [];
        },
        
        updateItemQuantity: (state, action) => {
            const { id, quantity } = action.payload;
            const itemIndex = state.items.findIndex(item => item.id === id);
            
            if (itemIndex !== -1) {
                const item = state.items[itemIndex];
                
                // Update quantity and recalculate price
                state.items[itemIndex] = {
                    ...item,
                    quantity: quantity,
                    price: item.pricePerQuantity * quantity
                };
                
                // Remove item if quantity is 0
                if (quantity <= 0) {
                    state.items = state.items.filter(item => item.id !== id);
                }
            }
        }
    }
})

export const getTotalPrice = (state) => state.cart.items.reduce((total, item) => total + item.price, 0);
export const { addItems, removeItem, removeAllItems, updateItemQuantity } = cartSlice.actions;
export default cartSlice.reducer;