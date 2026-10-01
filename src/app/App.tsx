import { useEffect, useRef, useState, type ReactNode } from "react";
import { AffineWorkspace } from "../features/affine/components/AffineWorkspace";
import { useAffineCipher } from "../features/affine/hooks/useAffineCipher";
import { affineApi } from "../features/affine/services/affineApi";
import { CaesarWorkspace } from "../features/caesar/components/CaesarWorkspace";
import { useCaesarCipher } from "../features/caesar/hooks/useCaesarCipher";
import { ColumnarWorkspace } from "../features/columnar/components/ColumnarWorkspace";
import { useColumnarCipher } from "../features/columnar/hooks/useColumnarCipher";
import { columnarApi } from "../features/columnar/services/columnarApi";
import { HillWorkspace } from "../features/hill/components/HillWorkspace";
import { useHillCipher } from "../features/hill/hooks/useHillCipher";
import { hillApi } from "../features/hill/services/hillApi";
import { PlayfairWorkspace } from "../features/playfair/components/PlayfairWorkspace";
import { usePlayfairCipher } from "../features/playfair/hooks/usePlayfairCipher";
import { VigenereWorkspace } from "../features/vigenere/components/VigenereWorkspace";
import { useVigenereCipher } from "../features/vigenere/hooks/useVigenereCipher";
import { HistoryWorkspace } from "../features/history/components/HistoryWorkspace";
import { canShowServerHistory, getHealthStatus } from "../features/history/services/historyApi";
import { CipherAlgorithmSelector } from "../shared/components/CipherAlgorithmSelector";
import { AppHeader } from "../shared/components/AppHeader";
import { getCipherAlgorithms } from "../shared/config/cipherAlgorithms";
import type { CipherAlgorithm } from "../shared/types/cipher";

export function App() {
  const cipher = useCaesarCipher();
  const vigenere = useVigenereCipher();
  const playfair = usePlayfairCipher();
  const affine = useAffineCipher(affineApi);
  const columnar = useColumnarCipher(columnarApi);
  const [algorithm, setAlgorithm] = useState<CipherAlgorithm>("caesar");
  const [showHistory, setShowHistory] = useState(false);
  const hill = useHillCipher(hillApi, algorithm === "hill" && !showHistory);
  const hillOpened = useRef(false);
  const cipherAlgorithms = getCipherAlgorithms();
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const isLoading =
    cipher.isLoading ||
    vigenere.isLoading ||
    playfair.isLoading ||
    affine.isBusy ||
    columnar.isBusy ||
    hill.isBusy;

  useEffect(() => {
    const controller = new AbortController();
    void getHealthStatus(controller.signal)
      .then((health) => {
        if (!controller.signal.aborted) setHistoryAvailable(canShowServerHistory(health));
      })
      .catch(() => {
        // History is optional; a failed health check must not block cipher workspaces.
      });
    return () => controller.abort();
  }, []);

  function resetWorkspace() {
    setShowHistory(false);
    setAlgorithm("caesar");
    cipher.resetAll();
    vigenere.resetAll();
    playfair.resetAll();
    affine.resetAll();
    columnar.resetAll();
    hill.resetAll();
    hillOpened.current = false;
  }

  function changeAlgorithm(nextAlgorithm: CipherAlgorithm) {
    if (isLoading || nextAlgorithm === algorithm) return;
    cipher.clearResult();
    cipher.setNotice(null);
    vigenere.clearResult();
    playfair.clearResult();
    affine.clearResult();
    affine.setNotice(null);
    columnar.clearResult();
    hill.clearResult();
    if (nextAlgorithm === "hill" && !hillOpened.current) {
      const drafts = { caesar: cipher, vigenere, playfair, affine, columnar };
      const current = algorithm === "hill" ? null : drafts[algorithm];
      hill.seedText(current?.inputType === "text" ? current.text : "");
      hillOpened.current = true;
    }
    setAlgorithm(nextAlgorithm);
  }

  const workspaces: Record<CipherAlgorithm, ReactNode> = {
    caesar: <CaesarWorkspace cipher={cipher} />,
    playfair: <PlayfairWorkspace cipher={playfair} />,
    vigenere: <VigenereWorkspace cipher={vigenere} />,
    affine: <AffineWorkspace cipher={affine} />,
    columnar: <ColumnarWorkspace cipher={columnar} />,
    hill: <HillWorkspace cipher={hill} />,
  };

  return (
    <>
      <AppHeader disabled={isLoading} onReset={resetWorkspace} />
      <main className="page">
        <header className="hero">
          <div className="hero__title">
            <h1>Cipher Workbench</h1>
          </div>
          <p>
            Mã hóa và giải mã Caesar, Vigenère, Playfair, Affine,
            {cipherAlgorithms.some(({ value }) => value === "hill")
              ? " Hệ mã hàng hoặc Hill"
              : " hoặc Hệ mã hàng"}{" "}
            bằng kết quả từ Backend.
          </p>
        </header>
        <div className="workspace">
          {historyAvailable && (
            <div className="view-switch" role="group" aria-label="Khu vực làm việc">
              <button
                type="button"
                className={!showHistory ? "view-switch__active" : ""}
                aria-pressed={!showHistory}
                onClick={() => setShowHistory(false)}
              >
                Công cụ
              </button>
              <button
                type="button"
                className={showHistory ? "view-switch__active" : ""}
                aria-pressed={showHistory}
                onClick={() => setShowHistory(true)}
              >
                Lịch sử thao tác
              </button>
            </div>
          )}
          {showHistory && historyAvailable ? (
            <HistoryWorkspace />
          ) : (
            <>
              <CipherAlgorithmSelector
                value={algorithm}
                disabled={isLoading}
                onChange={changeAlgorithm}
              />
              {cipherAlgorithms.map(({ value: panelAlgorithm }) => (
                <div
                  id={`algorithm-panel-${panelAlgorithm}`}
                  key={panelAlgorithm}
                  role="tabpanel"
                  aria-labelledby={`algorithm-tab-${panelAlgorithm}`}
                  hidden={algorithm !== panelAlgorithm}
                >
                  {algorithm === panelAlgorithm ? workspaces[panelAlgorithm] : null}
                </div>
              ))}
            </>
          )}
        </div>
      </main>
    </>
  );
}
