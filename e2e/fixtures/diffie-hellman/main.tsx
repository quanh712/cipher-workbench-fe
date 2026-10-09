import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/app/styles.css";
import { DiffieHellmanWorkspace } from "../../../src/features/diffieHellman/components/DiffieHellmanWorkspace";
import { useDiffieHellman } from "../../../src/features/diffieHellman/hooks/useDiffieHellman";
import { gateway } from "./gateway";

function Fixture() {
  const cipher = useDiffieHellman(gateway, true);
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <DiffieHellmanWorkspace cipher={cipher} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
