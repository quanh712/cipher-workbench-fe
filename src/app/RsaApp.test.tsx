import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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

  it("shows the labeled workspace behind the review flag", async () => {
    vi.stubEnv("VITE_ENABLE_RSA", "true");
    vi.resetModules();
    const { App: FlaggedApp } = await import("./App");
    render(<FlaggedApp />);
    fireEvent.click(screen.getByRole("tab", { name: /RSA minh họa.*Chờ API/ }));
    expect(screen.getByRole("heading", { name: "RSA từng bước" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sinh khóa" })).toBeDisabled();
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
});
