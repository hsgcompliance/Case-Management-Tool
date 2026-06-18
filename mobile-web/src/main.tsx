import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { maybeHandleOAuthPopupCallback } from "./lib/oauthPopup";
import App from "./App";
import "./index.css";

// If this page is an OAuth connect popup coming back from Google, hand the result
// to the opener and close — don't mount the app inside the popup.
if (!maybeHandleOAuthPopupCallback()) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
