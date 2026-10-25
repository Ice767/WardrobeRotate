import {configureStore, createSlice, type PayloadAction} from "@reduxjs/toolkit";
import {useDispatch, useSelector} from "react-redux";

import {api} from "./api/api";
import type {QuoteRequest} from "./api/types";

// The last search the client ran. Lives outside the page so it survives a trip
// to the sign-in screen and back.
const searchSlice = createSlice({
    name: "search",
    initialState: {lastRequest: null as QuoteRequest | null},
    reducers: {
        searched: (state, action: PayloadAction<QuoteRequest>) => {
            state.lastRequest = action.payload;
        },
    },
});

export const {searched} = searchSlice.actions;

export const store = configureStore({
    reducer: {
        search: searchSlice.reducer,
        [api.reducerPath]: api.reducer,
    },
    middleware: (getDefault) => getDefault().concat(api.middleware),
});

type RootState = ReturnType<typeof store.getState>;

export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
