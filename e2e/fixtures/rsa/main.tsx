import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RsaWorkspace } from "../../../src/features/rsa/components/RsaWorkspace";
import { useRsaCipher } from "../../../src/features/rsa/hooks/useRsaCipher";
import { createRsaGateway } from "../../../src/features/rsa/test/createRsaGateway";
import { ThemeToggle } from "../../../src/shared/components/ThemeToggle";
import { useTheme } from "../../../src/shared/hooks/useTheme";
import type { RsaTask } from "../../../src/features/rsa/types/cipher";
import "../../../src/app/styles.css";

// Separate Playwright entry point; never imported by the application entry point.
const failure = new URLSearchParams(globalThis.location.search).get("failure");
const tasks: RsaTask[] = ["key", "number", "text"];
const gateway = createRsaGateway({
  failOnce: tasks.find((task) => task === failure),
});

function Fixture() {
  const { theme, toggleTheme } = useTheme();
  const cipher = useRsaCipher(gateway, true);
  return (
    <main className="page">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <RsaWorkspace cipher={cipher} />
    </main>
  );
}

createRoot(globalThis.document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
