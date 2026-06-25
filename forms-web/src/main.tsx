import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CurrentCustomerProvider } from "./context/CurrentCustomer";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CurrentCustomerProvider>
        <App />
      </CurrentCustomerProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
