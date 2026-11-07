import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";

import {sessionUser} from "../lib/session";
import type {
    CargoCategorySpec,
    Carrier,
    Envelope,
    PublicUser,
    Quote,
    QuoteRequest,
    Region,
    Rfq,
    Shipment,
    Tracking,
    TransportType,
} from "./types";

// Every backend response is wrapped in an envelope; screens only want `data`.
const unwrap = <T,>(response: Envelope<T>): T => response.data;

export const api = createApi({
    reducerPath: "api",
    // Same-origin "/api": Vite proxies it in dev and Amplify rewrites it in
    // production, so the auth cookie stays first-party in both.
    baseQuery: fetchBaseQuery({baseUrl: "/api", credentials: "include"}),
    tagTypes: ["Me", "Shipments", "Rfqs"],
    endpoints: (build) => ({
        regions: build.query<Region[], void>({query: () => "/regions", transformResponse: unwrap<Region[]>}),
        carriers: build.query<Carrier[], void>({query: () => "/carriers", transformResponse: unwrap<Carrier[]>}),
        cargoCategories: build.query<CargoCategorySpec[], void>({
            query: () => "/cargo-categories",
            transformResponse: unwrap<CargoCategorySpec[]>,
        }),
        quotes: build.mutation<Quote[], QuoteRequest>({
            query: (body) => ({url: "/quotes", method: "POST", body}),
            transformResponse: unwrap<Quote[]>,
        }),

        me: build.query<PublicUser, void>({query: () => "/auth/me", transformResponse: unwrap<PublicUser>, providesTags: ["Me"]}),
        login: build.mutation<PublicUser, {email: string; password: string}>({
            query: (body) => ({url: "/auth/login", method: "POST", body}),
            transformResponse: unwrap<PublicUser>,
            invalidatesTags: ["Me", "Shipments", "Rfqs"],
        }),
        register: build.mutation<PublicUser, {email: string; password: string; name: string; companyName?: string}>({
            query: (body) => ({url: "/auth/register", method: "POST", body}),
            transformResponse: unwrap<PublicUser>,
            invalidatesTags: ["Me", "Shipments", "Rfqs"],
        }),
        logout: build.mutation<void, void>({
            query: () => ({url: "/auth/logout", method: "POST"}),
            invalidatesTags: ["Me", "Shipments", "Rfqs"],
        }),

        shipments: build.query<Shipment[], void>({
            query: () => "/shipments",
            transformResponse: unwrap<Shipment[]>,
            providesTags: ["Shipments"],
        }),
        bookInstant: build.mutation<Shipment, QuoteRequest & {carrierId: string; transportType: TransportType}>({
            query: (body) => ({url: "/shipments", method: "POST", body: {source: "INSTANT", ...body}}),
            transformResponse: unwrap<Shipment>,
            invalidatesTags: ["Shipments"],
        }),
        bookFromRfq: build.mutation<Shipment, string>({
            query: (rfqId) => ({url: "/shipments", method: "POST", body: {source: "RFQ", rfqId}}),
            transformResponse: unwrap<Shipment>,
            invalidatesTags: ["Shipments"],
        }),
        track: build.query<Tracking, string>({
            query: (code) => `/track/${encodeURIComponent(code)}`,
            transformResponse: unwrap<Tracking>,
        }),

        rfqs: build.query<Rfq[], void>({query: () => "/rfqs", transformResponse: unwrap<Rfq[]>, providesTags: ["Rfqs"]}),
        createRfq: build.mutation<Rfq, QuoteRequest>({
            query: (body) => ({url: "/rfqs", method: "POST", body}),
            transformResponse: unwrap<Rfq>,
            invalidatesTags: ["Rfqs"],
        }),
        acceptRfqQuote: build.mutation<Rfq, {rfqId: string; quoteId: string}>({
            query: ({rfqId, quoteId}) => ({url: `/rfqs/${rfqId}/accept`, method: "POST", body: {quoteId}}),
            transformResponse: unwrap<Rfq>,
            invalidatesTags: ["Rfqs"],
        }),
    }),
});

export const {
    useRegionsQuery,
    useCarriersQuery,
    useCargoCategoriesQuery,
    useQuotesMutation,
    useMeQuery,
    useLoginMutation,
    useRegisterMutation,
    useLogoutMutation,
    useShipmentsQuery,
    useBookInstantMutation,
    useBookFromRfqMutation,
    useTrackQuery,
    useRfqsQuery,
    useCreateRfqMutation,
    useAcceptRfqQuoteMutation,
} = api;

/** Who is signed in right now, as opposed to who was at the last good check. */
export const useCurrentUser = (): PublicUser | undefined => {
    const {data, error} = useMeQuery();
    return sessionUser(data, error);
};

/** The backend's own error text, or a fallback for network failures. */
export const errorText = (error: unknown): string => {
    const data = (error as {data?: Partial<Envelope<unknown>>} | undefined)?.data;
    return data?.meta?.errorMessage ?? "The server could not be reached. Try again in a moment.";
};
