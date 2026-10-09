import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/app/styles.css";
import { App } from "../../../src/app/App";
import { diffieHellmanApi } from "../../../src/features/diffieHellman/services/diffieHellmanApi";

// Test-only entry uses the real adapter. Playwright intercepts every DH HTTP request.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App diffieHellmanGateway={diffieHellmanApi} />
  </StrictMode>,
);
