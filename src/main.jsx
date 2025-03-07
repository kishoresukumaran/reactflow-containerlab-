import React from "react";
import ReactDOM from "react-dom/client";
import { ReactFlowProvider } from "react-flow-renderer";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </React.StrictMode>
);

