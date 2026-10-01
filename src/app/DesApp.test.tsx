import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("DES app registration", () => {
  it("prioritizes the real API when both DES flags are enabled", async () => {
    vi.stubEnv("VITE_ENABLE_HILL", "true");
    vi.stubEnv("VITE_ENABLE_DES", "true");
    vi.stubEnv("VITE_ENABLE_DES_DEMO", "true");
    vi.resetModules();
    const { App: ApiApp } = await import("./App");
    render(<ApiApp />);
    expect(screen.getByRole("tab", { name: /Hill.*Khả dụng/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /DES.*Khả dụng/ }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Định dạng DES")).toBeInTheDocument();
    expect(screen.getByLabelText("Chế độ mã khối DES")).toHaveValue("ECB");
  });
  it("keeps DES hidden by default", () => {
    vi.stubEnv("VITE_ENABLE_DES_DEMO", "false");
    render(<App />);
    expect(screen.queryByRole("tab", { name: /DES/ })).not.toBeInTheDocument();
  });

  it("enables labeled demo, preserves drafts across tabs and includes global reset", async () => {
    vi.stubEnv("VITE_ENABLE_DES_DEMO", "true");
    vi.resetModules();
    const { App: DemoApp } = await import("./App");
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("tab", { name: /DES.*Demo/ }));
    expect(screen.getByLabelText("Nội dung đầu vào DES")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Nội dung đầu vào DES"), {
      target: { value: "DES draft" },
    });
    fireEvent.change(screen.getByLabelText("Khóa DES"), { target: { value: "any key" } });
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
    await screen.findByText("Đã nhận kết quả mô phỏng.");
    fireEvent.click(screen.getByRole("tab", { name: /Caesar/ }));
    fireEvent.click(screen.getByRole("tab", { name: /DES.*Demo/ }));
    expect(screen.getByLabelText("Nội dung đầu vào DES")).toHaveValue("DES draft");
    expect(screen.getByLabelText("Khóa DES")).toHaveValue("any key");
    expect(screen.queryByLabelText("Nội dung kết quả DES")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Làm mới/ }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Caesar/ })).toHaveAttribute("aria-selected", "true"),
    );
    fireEvent.click(screen.getByRole("tab", { name: /DES.*Demo/ }));
    expect(screen.getByLabelText("Nội dung đầu vào DES")).toHaveValue("");
    expect(screen.getByLabelText("Khóa DES")).toHaveValue("");
  });
});
