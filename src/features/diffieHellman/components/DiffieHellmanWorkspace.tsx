import { useEffect, useId, useRef } from "react";
import type { DiffieHellmanController } from "../hooks/useDiffieHellman";
import type { DhField } from "../types/cipher";
import { DiffieHellmanAnalysis } from "./DiffieHellmanAnalysis";
import { DiffieHellmanResult } from "./DiffieHellmanResult";
import { DhOperationsPanel } from "./DhOperationsPanel";
import "./diffieHellman.css";

const fields: Record<DhField, { label: string; hint: string }> = {
  q: { label: "Số nguyên tố q", hint: "Số nguyên tố từ 5 đến 10¹² khi nhập tham số thủ công." },
  alpha: { label: "Căn nguyên thủy α", hint: "Từ 2 đến q−2; là căn nguyên thủy modulo q." },
  privateA: {
    label: "Số mũ riêng X_A",
    hint: "Từ 2 đến q−2; để trống để Backend sinh. Chỉ bên A giữ trong giao thức thực tế.",
  },
  privateB: {
    label: "Số mũ riêng X_B",
    hint: "Từ 2 đến q−2; để trống để Backend sinh. Chỉ bên B giữ trong giao thức thực tế.",
  },
};

function ParameterField({
  field,
  prefix,
  cipher,
}: {
  field: DhField;
  prefix: string;
  cipher: DiffieHellmanController;
}) {
  const id = `${prefix}-${field}`;
  const error = cipher.fieldErrors[field];
  return (
    <div className="dh__field">
      <label htmlFor={id}>{fields[field].label}</label>
      <input
        id={id}
        name={field}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        required={field === "q" || field === "alpha"}
        value={cipher.draft[field]}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint ${prefix}-format${error ? ` ${id}-error` : ""}`}
        onChange={(event) => cipher.setParameter(field, event.target.value)}
      />
      <p id={`${id}-hint`} className="dh__help">
        {fields[field].hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="dh__field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Backend-driven form, results and analysis from the successful snapshot. */
export function DiffieHellmanWorkspace({ cipher }: { cipher: DiffieHellmanController }) {
  const prefix = useId();
  const form = useRef<HTMLFormElement>(null);
  const ready = cipher.hasGateway && !cipher.isBusy;

  useEffect(() => {
    if (cipher.status === "error") {
      form.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    }
  }, [cipher.status, cipher.fieldErrors]);

  return (
    <div className="cipher-workspace dh">
      <header className="dh__intro">
        <h2>Diffie–Hellman minh họa</h2>
        <p>Nhập tham số để hai bên A và B thiết lập cùng một bí mật chung.</p>
      </header>
      <p className="dh__notice">
        Mô phỏng học tập; Backend biết cả hai số mũ riêng. Tham số nhỏ và DH chưa xác thực không
        dùng để bảo vệ dữ liệu thực tế.
      </p>
      <form
        ref={form}
        className="dh__form"
        aria-label="Thiết lập Diffie–Hellman"
        aria-busy={cipher.isBusy}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) void cipher.exchange();
        }}
      >
        <div className="dh__preset-bar">
          <p className="dh__help">Nhập tham số hoặc bấm Tạo ví dụ để điền dữ liệu mẫu.</p>
          <div className="button-group" role="group" aria-label="Dữ liệu mẫu Diffie–Hellman">
            <button className="button button--secondary" type="button" onClick={cipher.loadExample}>
              Tạo ví dụ
            </button>
            <button className="button button--secondary" type="button" onClick={cipher.resetAll}>
              Đặt lại
            </button>
          </div>
        </div>
        <p id={`${prefix}-format`} className="dh__help">
          Dùng chữ số 0–9, tối đa 39 chữ số trước khi bỏ số 0 đầu. Không dùng dấu, số thập phân hoặc
          ký hiệu khoa học. Khoảng trắng hai đầu được bỏ qua.
        </p>
        <section className="panel" aria-labelledby={`${prefix}-public-title`}>
          <div className="panel__header">
            <h2 id={`${prefix}-public-title`}>Tham số chung công khai</h2>
          </div>
          <div className="dh__fields dh__panel-body">
            <ParameterField field="q" prefix={prefix} cipher={cipher} />
            <ParameterField field="alpha" prefix={prefix} cipher={cipher} />
          </div>
        </section>
        <div className="dh__parties">
          <fieldset className="dh__party">
            <legend>Bên A</legend>
            <ParameterField field="privateA" prefix={prefix} cipher={cipher} />
          </fieldset>
          <fieldset className="dh__party">
            <legend>Bên B</legend>
            <ParameterField field="privateB" prefix={prefix} cipher={cipher} />
          </fieldset>
        </div>
        <div className="button-group dh__actions" role="group" aria-label="Thao tác Diffie–Hellman">
          <button className="button button--primary" type="submit" disabled={!ready}>
            {cipher.isBusy && cipher.task === "exchange"
              ? "Đang thiết lập…"
              : "Thiết lập bí mật chung"}
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!ready}
            onClick={() => void cipher.generatePrivateValues()}
          >
            {cipher.isBusy && cipher.task === "random"
              ? "Đang sinh số mũ…"
              : "Sinh số mũ ngẫu nhiên"}
          </button>
        </div>
        {!cipher.hasGateway && (
          <p className="dh__help">
            Chưa kết nối dịch vụ xử lý. Bạn vẫn có thể nhập tham số và chọn ví dụ.
          </p>
        )}
      </form>
      {/* Outside the busy form so loading/errors can be announced immediately. */}
      <div className="dh__feedback" aria-live="polite" aria-atomic="true">
        {cipher.status === "loading" && (
          <p role="status" aria-label="Trạng thái trao đổi DH" className="dh__message">
            {cipher.task === "random"
              ? "Đang sinh hai số mũ riêng…"
              : "Đang thiết lập bí mật chung…"}
          </p>
        )}
        {cipher.status === "error" && (
          <p role="alert" className="dh__message dh__message--error">
            {cipher.error}
          </p>
        )}
        {cipher.status === "success" && (
          <p
            role="status"
            aria-label="Trạng thái trao đổi DH"
            className="dh__message dh__message--success"
          >
            {cipher.task === "random"
              ? "Đã điền hai số mũ riêng. Bấm Thiết lập bí mật chung để tiếp tục."
              : "Hai bên đã thiết lập cùng bí mật chung."}
          </p>
        )}
      </div>
      {cipher.status === "success" && cipher.result && cipher.snapshot && (
        <>
          <DiffieHellmanResult result={cipher.result} snapshot={cipher.snapshot} />
          <DiffieHellmanAnalysis result={cipher.result} snapshot={cipher.snapshot} />
        </>
      )}
      {cipher.hasGateway && <DhOperationsPanel key={cipher.resetVersion} cipher={cipher} />}
    </div>
  );
}
