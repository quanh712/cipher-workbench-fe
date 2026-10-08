import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../features/rsa/services/rsaApi", async () => {
  const { createRsaGateway } = await import("../features/rsa/test/createRsaGateway");
  return { rsaApi: createRsaGateway() };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("RSA app registration", () => {
  it("keeps RSA hidden by default", () => {
    vi.stubEnv("VITE_ENABLE_RSA", "false");
    render(<App />);
    expect(screen.queryByRole("tab", { name: /RSA minh họa/ })).not.toBeInTheDocument();
  });

  it("connects the workspace to the gateway behind the release flag", async () => {
    vi.stubEnv("VITE_ENABLE_RSA", "true");
    vi.resetModules();
    const { App: FlaggedApp } = await import("./App");
    render(<FlaggedApp />);
    fireEvent.click(screen.getByRole("tab", { name: /RSA minh họa.*Khả dụng/ }));
    expect(screen.getByRole("heading", { name: "RSA từng bước" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tạo khóa" }));
    expect(await screen.findByText("{7, 187}", { exact: true })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("Xin chao");
  });

  it("keeps RSA drafts across tab changes and clears them with the header reset", async () => {
    vi.stubEnv("VITE_ENABLE_RSA", "true");
    vi.resetModules();
    const { App: FlaggedApp } = await import("./App");
    render(<FlaggedApp />);
    const rsaTab = screen.getByRole("tab", { name: /RSA minh họa/ });
    fireEvent.click(rsaTab);
    fireEvent.change(screen.getByRole("textbox", { name: "Thông điệp" }), {
      target: { value: "Nội dung mới 😀" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "p · số nguyên tố" }), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /Caesar/ }));
    fireEvent.click(rsaTab);
    expect(screen.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("Nội dung mới 😀");
    expect(screen.getByRole("textbox", { name: "p · số nguyên tố" })).toHaveValue("101");
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(screen.getByRole("tab", { name: /Caesar/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(rsaTab);
    expect(screen.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("Xin chao");
    expect(screen.getByRole("textbox", { name: "p · số nguyên tố" })).toHaveValue("17");
  });

  it("never enables local computation through the removed mock flag", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ENABLE_RSA", "false");
    vi.stubEnv("VITE_ENABLE_RSA_MOCK", "true");
    vi.resetModules();
    const { App: PreviewApp } = await import("./App");
    const { unmount } = render(<PreviewApp />);
    expect(screen.queryByRole("tab", { name: /RSA minh họa/ })).not.toBeInTheDocument();
    unmount();
    vi.stubEnv("VITE_ENABLE_RSA", "true");
    render(<PreviewApp />);
    fireEvent.click(screen.getByRole("tab", { name: /RSA minh họa.*Khả dụng/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo khóa" }));
    expect(await screen.findByText("{7, 187}", { exact: true })).toBeVisible();
  });
});
