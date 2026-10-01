import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hillApi } from "../features/hill/services/hillApi";
import { exampleKey } from "../features/hill/test/createHillGateway";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Hill tab integration", () => {
  it("is absent until enabled by release configuration", () => {
    vi.stubEnv("VITE_ENABLE_HILL", "false");
    render(<App />);
    expect(screen.queryByRole("tab", { name: /Hill/ })).not.toBeInTheDocument();
  });

  it("copies only typed text on first open and retains its own draft", async () => {
    vi.stubEnv("VITE_ENABLE_HILL", "true");
    vi.spyOn(hillApi, "analyze").mockResolvedValue({
      success: true,
      result: exampleKey,
      warnings: [],
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "HELLO");
    await user.click(screen.getByRole("tab", { name: /Hill/ }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("HELLO");
    await waitFor(() =>
      expect(hillApi.analyze).toHaveBeenCalledWith(
        {
          key: [
            [3, 3],
            [2, 5],
          ],
        },
        expect.any(AbortSignal),
      ),
    );
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), " HILL");
    await user.click(screen.getByRole("tab", { name: /Caesar/ }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("HELLO");
    await user.click(screen.getByRole("tab", { name: /Hill/ }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("HELLO HILL");
  });
});
