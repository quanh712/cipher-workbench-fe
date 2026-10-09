import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/app/styles.css";
import { App } from "../../../src/app/App";
import { gateway } from "./gateway";

// Test-only entry: production App has no fixture gateway.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App diffieHellmanGateway={gateway} />
  </StrictMode>,
);
