import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { updateTaxRate as updateTaxRateAPI, getTaxRate as getTaxRateAPI } from "../../https/index";

// Async thunks for API calls
export const fetchTaxRate = createAsyncThunk(
  'config/fetchTaxRate',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getTaxRateAPI();
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch tax rate');
    }
  }
);

export const updateTaxRateAsync = createAsyncThunk(
  'config/updateTaxRate',
  async (taxRate, { rejectWithValue }) => {
    try {
      const response = await updateTaxRateAPI({ taxRate });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update tax rate');
    }
  }
);

const initialState = {
  taxRate: 5.25, // Default tax rate
  platformFeeRate: 0, // Default platform fee rate
  isAdmin: false,
  canModify: false,
  lastUpdated: null,
  loading: false,
  error: null
};

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setTaxRate: (state, action) => {
      state.taxRate = action.payload;
    },

    setPlatformFeeRate: (state, action) => {
      state.platformFeeRate = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },

    resetConfig: (state) => {
      state.taxRate = 5.25;
      state.platformFeeRate = 0;
      state.isAdmin = false;
      state.canModify = false;
      state.lastUpdated = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tax rate cases
      .addCase(fetchTaxRate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTaxRate.fulfilled, (state, action) => {
        state.loading = false;
        state.taxRate = action.payload.taxRate;
        state.isAdmin = action.payload.isAdmin;
        state.canModify = action.payload.canModify;
        state.lastUpdated = action.payload.lastUpdated;
        state.error = null;
      })
      .addCase(fetchTaxRate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update tax rate cases
      .addCase(updateTaxRateAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTaxRateAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.taxRate = action.payload.taxRate;
        state.lastUpdated = action.payload.lastUpdated;
        state.error = null;
      })
      .addCase(updateTaxRateAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { setTaxRate, setPlatformFeeRate, clearError, resetConfig } = configSlice.actions;
export default configSlice.reducer;
