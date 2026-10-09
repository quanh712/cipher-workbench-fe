import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createDhPresetRequest,
  createDhPresetResult,
  createDhSwappedResult,
} from "../test/fixtures";
import { DiffieHellmanAnalysis } from "./DiffieHellmanAnalysis";

const snapshot = createDhPresetRequest();

describe("Diffie–Hellman analysis", () => {
  it("shows substituted formulas, equality proof and four initially collapsed traces", async () => {
    const result = createDhPresetResult();
    const { container } = render(<DiffieHellmanAnalysis snapshot={snapshot} result={result} />);
    expect(screen.getByText("Y_A = α^X_A mod q = 5^6 mod 23 = 8")).toBeVisible();
    expect(screen.getByText("Y_B = α^X_B mod q = 5^15 mod 23 = 19")).toBeVisible();
    expect(screen.getByText("K_A = Y_B^X_A mod q = 19^6 mod 23 = 2")).toBeVisible();
    expect(screen.getByText("K_B = Y_A^X_B mod q = 8^15 mod 23 = 2")).toBeVisible();
    expect(screen.getByText("5^(6·15) mod 23 = 5^(15·6) mod 23 = 2")).toBeVisible();
    const disclosures = [...container.querySelectorAll("details")];
    expect(disclosures).toHaveLength(4);
    const user = userEvent.setup();
    for (const [i, trace] of Object.values(result.traces!).entries()) {
      expect(disclosures[i].open).toBe(false);
      const summary = disclosures[i].querySelector("summary")!;
      await user.click(summary);
      expect(disclosures[i].open).toBe(true);
      const table = within(disclosures[i]).getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(trace.steps.length);
      for (const [index, row] of rows.entries()) {
        const step = trace.steps[index];
        expect([...row.children].map((cell) => cell.textContent)).toEqual([
          String(step.index),
          String(step.bit),
          step.exponentPrefix,
          step.squared,
          step.multiplied ?? "—",
          step.result,
        ]);
      }
      expect(within(disclosures[i]).getByRole("region")).toHaveAttribute("tabindex", "0");
    }
  });

  it("closes traces and replaces formulas when the successful snapshot changes", async () => {
    const { container, rerender } = render(
      <DiffieHellmanAnalysis snapshot={snapshot} result={createDhPresetResult()} />,
    );
    await userEvent.click(screen.getByText("Trace Y_A · 3 bước"));
    expect(container.querySelector("details")!.open).toBe(true);
    rerender(
      <DiffieHellmanAnalysis
        snapshot={{ ...snapshot, privateA: "15", privateB: "6" }}
        result={createDhSwappedResult()}
      />,
    );
    expect(screen.getByText("Y_A = α^X_A mod q = 5^15 mod 23 = 19")).toBeVisible();
    expect([...container.querySelectorAll("details")].every((detail) => !detail.open)).toBe(true);
  });

  it("explains missing trace without inventing rows", () => {
    const { container } = render(
      <DiffieHellmanAnalysis snapshot={snapshot} result={createDhPresetResult(false)} />,
    );
    expect(screen.getByText("Kết quả này không có dữ liệu trace.")).toBeVisible();
    expect(container.querySelector("table")).toBeNull();
  });
});
