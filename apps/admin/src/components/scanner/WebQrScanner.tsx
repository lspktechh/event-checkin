import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, type CameraDevice } from "html5-qrcode";
import { CameraIcon, LockIcon, RefreshIcon } from "../Icons";

interface Props {
  onScan: (decodedText: string) => void;
  paused: boolean;
  manualMode: boolean;
  onToggleManual: () => void;
}

const CONTAINER_ID = "web-qr-scanner-viewport";

/**
 * Seleciona a melhor câmera traseira (1x / Principal), evitando câmeras Ultra-Wide (0.5x)
 * e Telefoto (3x/5x) que não conseguem focar em QR Codes a curta distância no iPhone.
 */
function pickBestBackCamera(devices: CameraDevice[]): CameraDevice | null {
  if (!devices || devices.length === 0) return null;
  if (devices.length === 1) return devices[0];

  // Filtra câmeras com indício de serem traseiras
  const backCandidates = devices.filter((d) => {
    const label = d.label.toLowerCase();
    const isBack =
      label.includes("back") ||
      label.includes("traseir") ||
      label.includes("rear") ||
      label.includes("environment");
    const isFront =
      label.includes("front") ||
      label.includes("frontal") ||
      label.includes("selfie") ||
      label.includes("truedepth");
    return isBack && !isFront;
  });

  if (backCandidates.length > 0) {
    // Entre as traseiras, prioriza a lente principal (1x / Wide) e descarta Ultra-Wide e Telefoto
    const primaryBack = backCandidates.find((d) => {
      const label = d.label.toLowerCase();
      const isUltraWide = label.includes("ultra") || label.includes("0.5") || label.includes("macro");
      const isTele = label.includes("tele") || label.includes("3x") || label.includes("5x");
      return !isUltraWide && !isTele;
    });

    if (primaryBack) return primaryBack;
    return backCandidates[0];
  }

  // Se nenhuma câmera tiver rótulo de traseira identificado (ex: antes da permissão concedida),
  // em celulares o primeiro dispositivo costuma ser a lente principal traseira ou a última
  return devices[0];
}

export function WebQrScanner({ onScan, paused, manualMode, onToggleManual }: Props) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const observerRef = useRef<MutationObserver | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checa se a origem é segura (HTTPS ou localhost)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSecure =
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      setIsInsecureOrigin(!isSecure);
    }
  }, []);

  // Observa a inserção do elemento <video> no DOM para injetar playsinline ANTES que o Safari inicie o playback
  const attachVideoObserver = () => {
    if (observerRef.current) return;
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    const configureVideo = (video: HTMLVideoElement) => {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("muted", "true");
      video.muted = true;
      video.setAttribute("autoplay", "true");

      // No Android Chrome, o navegador pausa o vídeo quando elementos cobrem a tela ou há perda transitória de foco.
      // Este listener garante que qualquer pausa involuntária seja desfeita enquanto a câmera estiver ativa.
      video.onpause = () => {
        if (!document.hidden && isRunningRef.current && !manualMode) {
          video.play().catch(() => {});
        }
      };
    };

    // Aplica em qualquer vídeo já presente
    const existing = container.querySelectorAll("video");
    existing.forEach(configureVideo);

    observerRef.current = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            configureVideo(node);
          } else if (node instanceof HTMLElement) {
            const nested = node.querySelectorAll("video");
            nested.forEach(configureVideo);
          }
        });
      });
    });

    observerRef.current.observe(container, { childList: true, subtree: true });
  };

  const detachVideoObserver = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  };

  /**
   * Força a parada e liberação total de todos os tracks de MediaStream associados à câmera.
   * Evita que o hardware da câmera continue travado em segundo plano no Safari / iOS.
   */
  async function stopScanner() {
    detachVideoObserver();

    // Libera qualquer stream nativo ativo no elemento video do container
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      const videos = container.querySelectorAll("video");
      videos.forEach((v) => {
        if (v.srcObject && "getTracks" in v.srcObject) {
          const stream = v.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // Ignora
            }
          });
          v.srcObject = null;
        }
      });
    }

    if (scannerRef.current) {
      if (isRunningRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.warn("Aviso ao parar scanner:", err);
        }
      }
      try {
        await scannerRef.current.clear();
      } catch {
        // Ignora
      }
    }

    isRunningRef.current = false;
    isStartingRef.current = false;
    setCameraStarted(false);
    setInitializing(false);
    setTorchOn(false);
    setHasTorch(false);
  }

  async function startCamera(fromUserGesture = true) {
    if (isStartingRef.current || isRunningRef.current) return;
    isStartingRef.current = true;
    setInitializing(true);
    setCameraError(null);
    setIsPermissionDenied(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Câmera ao vivo indisponível neste navegador ou contexto inseguro. Acesse via HTTPS seguro ou use 'Foto com Câmera Nativa'."
        );
      }

      // Garante que o observer capture a criação do elemento de vídeo antes do start
      attachVideoObserver();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(CONTAINER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
      }

      const scanner = scannerRef.current;

      const isIOS =
        typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

      // Configuração de scan: NÃO define aspectRatio nem qrbox restritivo.
      // Sem aspectRatio: 1.0, o sensor da câmera não sofre corte digital/zoom artificial no Android/iOS.
      // Sem qrbox reduzido, o leitor decodifica o frame inteiro da câmera (de perto ou de longe).
      const scanConfig: { fps: number } = {
        fps: 10,
      };

      const handleDecoded = (decodedText: string) => {
        if (!pausedRef.current) {
          onScan(decodedText);
        }
      };

      // Obtém lista de câmeras e identifica a melhor câmera traseira
      let detectedDevices: CameraDevice[] = [];
      try {
        detectedDevices = await Html5Qrcode.getCameras();
        setCameras(detectedDevices);
      } catch (err) {
        console.warn("Aviso ao listar câmeras:", err);
      }

      const preferredBackCam = pickBestBackCamera(detectedDevices);
      let started = false;

      // 1. No iOS/iPhone, prioriza a lente traseira principal identificada por ID ("Back Camera")
      // para descartar a Ultra-Wide (0.5x) que não foca de perto.
      if (isIOS && preferredBackCam) {
        try {
          setCurrentCameraId(preferredBackCam.id);
          await scanner.start(preferredBackCam.id, scanConfig, handleDecoded, () => {});
          started = true;
        } catch (idErr) {
          console.warn("Falha ao iniciar por ID no iOS, tentando constraint:", idErr);
        }
      }

      // 2. No Android e fallback no iOS: inicia com constraint ideal de facingMode "environment".
      // No Android, isto instrui o HAL a escolher a câmera traseira padrão 1x wide com autofocus nativo.
      if (!started) {
        try {
          await scanner.start(
            { facingMode: { ideal: "environment" } },
            scanConfig,
            handleDecoded,
            () => {}
          );
          started = true;
        } catch (envIdealErr) {
          console.warn("Falha com ideal environment, tentando environment direto:", envIdealErr);
          try {
            await scanner.start(
              { facingMode: "environment" },
              scanConfig,
              handleDecoded,
              () => {}
            );
            started = true;
          } catch (envDirectErr) {
            console.warn("Falha com facingMode environment:", envDirectErr);
          }
        }
      }

      // 3. Fallback adicional se não iniciou: tenta preferredBackCam por ID
      if (!started && preferredBackCam) {
        try {
          setCurrentCameraId(preferredBackCam.id);
          await scanner.start(preferredBackCam.id, scanConfig, handleDecoded, () => {});
          started = true;
        } catch (camIdErr) {
          console.warn("Falha com preferredBackCam:", camIdErr);
        }
      }

      // 4. Último recurso: qualquer câmera disponível
      if (!started && detectedDevices.length > 0) {
        await scanner.start(detectedDevices[0].id, scanConfig, handleDecoded, () => {});
        setCurrentCameraId(detectedDevices[0].id);
        started = true;
      }

      if (!started) {
        throw new Error("Não foi possível acessar a câmera do aparelho.");
      }

      // Garante atributos de reprodução inline no iOS WebKit / Safari
      const vidElem = document.querySelector(`#${CONTAINER_ID} video`) as HTMLVideoElement | null;
      if (vidElem) {
        vidElem.setAttribute("playsinline", "true");
        vidElem.setAttribute("webkit-playsinline", "true");
        vidElem.setAttribute("muted", "true");
        vidElem.muted = true;
        vidElem.setAttribute("autoplay", "true");
        vidElem.play().catch(() => {});

        // Reseta qualquer zoom digital forçado pelo hardware do Android
        try {
          const stream = vidElem.srcObject as MediaStream | null;
          const tracks = stream?.getVideoTracks() || [];
          if (tracks.length > 0) {
            const track = tracks[0];
            const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
            if (caps && caps.zoom) {
              const minZoom = caps.zoom.min ?? 1.0;
              await track.applyConstraints({
                advanced: [{ zoom: minZoom } as any],
              }).catch(() => {});
            }
          }
        } catch (zoomErr) {
          console.warn("Aviso ao resetar zoom do sensor:", zoomErr);
        }
      }

      isRunningRef.current = true;
      isStartingRef.current = false;
      setCameraStarted(true);
      setInitializing(false);

      // Atualiza lista de câmeras se não estavam disponíveis antes da permissão
      if (detectedDevices.length === 0) {
        try {
          const devs = await Html5Qrcode.getCameras();
          setCameras(devs);
          const best = pickBestBackCamera(devs);
          if (best) setCurrentCameraId(best.id);
        } catch {
          // Ignora
        }
      }

      // Verifica suporte a lanterna
      try {
        const capabilities = scanner.getRunningTrackCameraCapabilities();
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        }
      } catch {
        // Ignora
      }
    } catch (err) {
      isStartingRef.current = false;
      setInitializing(false);
      setCameraStarted(false);
      isRunningRef.current = false;

      const msg = err instanceof Error ? err.message : String(err);
      const isDenied =
        msg.includes("Permission denied") ||
        msg.includes("NotAllowedError") ||
        msg.includes("PermissionDeniedError") ||
        msg.includes("permission");

      if (isDenied) {
        setIsPermissionDenied(true);
        if (fromUserGesture) {
          setCameraError(
            "Permissão da câmera bloqueada pelo navegador. No iPhone, acesse Ajustes > Safari > Câmera e marque 'Permitir', ou use o botão 'Foto com Câmera Nativa'."
          );
        } else {
          // Se falhou sem gesto do usuário, não exibe erro alarmante
          setCameraError(null);
        }
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        setCameraError("Nenhuma câmera encontrada neste aparelho.");
      } else {
        setCameraError(msg || "Não foi possível iniciar a câmera de vídeo ao vivo.");
      }
    }
  }

  // Tenta iniciar câmera ao carregar (se estiver em HTTPS)
  useEffect(() => {
    if (manualMode) {
      void stopScanner();
      return;
    }

    if (typeof window !== "undefined" && window.isSecureContext) {
      void startCamera(false);
    } else {
      setCameraError(
        "Navegadores de celular bloqueiam a câmera em conexões HTTP. Acesse via HTTPS seguro para ler ao vivo ou use o botão de foto."
      );
    }

    return () => {
      void stopScanner();
    };
  }, [manualMode]);

  // Gerencia visibilidade da aba (quando o usuário minimiza o Safari ou troca de app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isRunningRef.current) {
          void stopScanner();
        }
      } else {
        if (!manualMode && !isRunningRef.current && window.isSecureContext) {
          void startCamera(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", () => {
      void stopScanner();
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [manualMode]);

  // Watchdog para Android Chrome: se o vídeo pausar inadvertidamente enquanto a câmera deve estar ativa, força play()
  useEffect(() => {
    if (!cameraStarted || manualMode) return;
    const interval = setInterval(() => {
      const vidElem = document.querySelector(`#${CONTAINER_ID} video`) as HTMLVideoElement | null;
      if (vidElem && vidElem.paused && !document.hidden && isRunningRef.current) {
        vidElem.play().catch(() => {});
      }
    }, 800);
    return () => clearInterval(interval);
  }, [cameraStarted, manualMode]);

  // Alternar entre câmeras disponíveis
  async function handleSwitchCamera() {
    if (cameras.length <= 1 || !scannerRef.current) return;
    const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    try {
      await stopScanner();
      setCurrentCameraId(nextCamera.id);
      attachVideoObserver();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(CONTAINER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
      }

      await scannerRef.current.start(
        nextCamera.id,
        {
          fps: 10,
        },
        (decodedText) => {
          if (!pausedRef.current) onScan(decodedText);
        },
        () => {}
      );

      const vidElem = document.querySelector(`#${CONTAINER_ID} video`) as HTMLVideoElement | null;
      if (vidElem) {
        vidElem.setAttribute("playsinline", "true");
        vidElem.setAttribute("webkit-playsinline", "true");
        vidElem.muted = true;
        vidElem.play().catch(() => {});
      }

      isRunningRef.current = true;
      setCameraStarted(true);
    } catch (err) {
      console.warn("Erro ao alternar câmera:", err);
    }
  }

  // Alternar lanterna
  async function handleToggleTorch() {
    if (!scannerRef.current || !isRunningRef.current) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      setHasTorch(false);
    }
  }

  // Escanear arquivo de imagem ou foto direta
  async function handleFileScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("temp-qr-file-scan");
      const decoded = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      onScan(decoded);
    } catch {
      alert("Nenhum QR Code legível foi encontrado nesta imagem. Aproxime mais o celular e tente novamente.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScan(manualInput.trim());
    setManualInput("");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div id="temp-qr-file-scan" style={{ display: "none" }} />

      {/* Aviso de HTTP não seguro */}
      {isInsecureOrigin && (
        <div
          style={{
            width: "100%",
            backgroundColor: "rgba(234, 179, 8, 0.14)",
            border: "1px solid rgba(234, 179, 8, 0.4)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}><LockIcon size="1.1em" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--warning)" }}>
                Câmera ao vivo exige HTTPS
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                No iPhone e Android, o navegador só pede permissão de câmera em conexão segura.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: 12 }}
            >
              <CameraIcon size="1.1em" /> Ou usar Câmera do Aparelho (Foto)
            </button>
          </div>
        </div>
      )}

      {!manualMode ? (
        <div
          style={{
            width: "100%",
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#000000",
            position: "relative",
            minHeight: 340,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            border: "2px solid var(--border)",
          }}
        >
          {/* Elemento que recebe o vídeo da câmera */}
          <div
            id={CONTAINER_ID}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 340,
            }}
          />

          {/* Mira e Laser decorativo (sobre o vídeo quando rodando) */}
          {cameraStarted && !initializing && !cameraError && (
            <div
              style={
                {
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                } as CSSProperties
              }
            >
              <div
                style={{
                  width: "76%",
                  aspectRatio: "1/1",
                  maxWidth: 280,
                  position: "relative",
                  borderRadius: 16,
                  border: "2px dashed rgba(255, 255, 255, 0.2)",
                  opacity: paused ? 0.4 : 1,
                  transition: "opacity 0.2s ease",
                }}
              >
                {/* 4 cantos estilizados */}
                <div style={{ ...cornerStyle, top: -2, left: -2, borderTop: "3px solid #22c55e", borderLeft: "3px solid #22c55e" }} />
                <div style={{ ...cornerStyle, top: -2, right: -2, borderTop: "3px solid #22c55e", borderRight: "3px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: -2, left: -2, borderBottom: "3px solid #22c55e", borderLeft: "3px solid #22c55e" }} />
                <div style={{ ...cornerStyle, bottom: -2, right: -2, borderBottom: "3px solid #22c55e", borderRight: "3px solid #22c55e" }} />

                {/* Linha laser verde animada quando ativo */}
                {!paused && <div className="laser-line" />}
              </div>
            </div>
          )}

          {/* Estado: Carregando / Inicializando Câmera */}
          {initializing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#000000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "#ffffff",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(255, 255, 255, 0.2)",
                  borderTopColor: "var(--primary)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)" }}>
                Iniciando câmera traseira...
              </span>
            </div>
          )}

          {/* Estado: Erro ao abrir câmera ou permissão pendente */}
          {cameraError && !initializing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "var(--surface)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 14,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  backgroundColor: isPermissionDenied ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)",
                  color: isPermissionDenied ? "var(--danger)" : "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                <CameraIcon size="1.2em" />
              </div>

              <div>
                <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                  {isPermissionDenied ? "Permissão de Câmera Necessária" : "Iniciar Câmera de Leitura"}
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4, maxWidth: 320 }}>
                  {cameraError}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 260 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => startCamera(true)}
                  style={{ width: "100%", fontSize: 14, padding: "10px 16px" }}
                >
                  <RefreshIcon size="1.1em" /> Tentar Novamente
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: "100%", fontSize: 13, padding: "8px 14px" }}
                >
                  <CameraIcon size="1.1em" /> Foto com Câmera Nativa
                </button>

                <button
                  type="button"
                  onClick={onToggleManual}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: 13,
                    cursor: "pointer",
                    padding: "6px 8px",
                  }}
                >
                  Digitar código manualmente
                </button>
              </div>
            </div>
          )}

          {/* Botões flutuantes sobre o vídeo (Lanterna e Alternar Câmera) */}
          {cameraStarted && !initializing && !cameraError && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                display: "flex",
                gap: 8,
                zIndex: 5,
              }}
            >
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  style={{
                    ...cameraControlBtn,
                    backgroundColor: torchOn ? "var(--warning)" : "rgba(0, 0, 0, 0.65)",
                    color: torchOn ? "#000000" : "#ffffff",
                  }}
                  title="Alternar lanterna"
                >
                  {torchOn ? "Lanterna ligada" : "Lanterna"}
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  style={cameraControlBtn}
                  title="Alternar câmera"
                >
                  <RefreshIcon size="1.1em" /> Lente
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Modo Manual (digitar ou colar token) */
        <form
          onSubmit={handleManualSubmit}
          className="card"
          style={{
            width: "100%",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Entrada Manual</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
              Digite ou cole o token do participante (ex: <code>evt_...</code>)
            </p>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Cole ou digite evt_..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              style={{
                fontSize: 16,
                padding: "12px 14px",
                fontFamily: "monospace",
              }}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={!manualInput.trim()}
            style={{ padding: 12, fontSize: 15 }}
          >
            CONFIRMAR CREDENCIAMENTO
          </button>
        </form>
      )}

      {/* Input oculto nativo que abre a câmera traseira do sistema em qualquer celular */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileScan}
      />

      {/* Barra de alternância de modo (Câmera / Foto / Manual) */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          padding: "4px 8px",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onToggleManual}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--primary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 8px",
          }}
        >
          {manualMode ? "Voltar para Câmera" : "Digitar código manual"}
        </button>

        {!manualMode && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              padding: "6px 8px",
            }}
          >
            <CameraIcon size="1.1em" /> Foto com Câmera Nativa
          </button>
        )}
      </div>

      <style>{`
        #${CONTAINER_ID} video {
          object-fit: cover !important;
          border-radius: 14px;
          width: 100% !important;
          height: 100% !important;
        }
        #qr-shaded-region {
          display: none !important;
        }
        .laser-line {
          position: absolute;
          width: 100%;
          height: 2px;
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e, 0 0 20px #22c55e;
          top: 0;
          animation: scanAnimation 2.2s infinite ease-in-out;
        }
        @keyframes scanAnimation {
          0% { top: 4%; opacity: 0.8; }
          50% { top: 96%; opacity: 1; }
          100% { top: 4%; opacity: 0.8; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const cornerStyle: CSSProperties = {
  position: "absolute",
  width: 20,
  height: 20,
  borderRadius: 2,
};

const cameraControlBtn: CSSProperties = {
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 8,
  color: "#ffffff",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
