import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@ouro/ds";
import { mono } from "~/components/site";
import { SHARE_CARD, SHARE_CARD_FONTS, drawShareCard, type ShareCardData, type ShareCardRow } from "~/lib/shareCard";

/* ────────────────────────────────────────────────────────────────────────────
   "Share" on the airdrops figure: a dialog holding the card, and the three ways off the page.

   What is on screen is the canvas that gets saved, so the preview cannot drift from the file. The
   card is painted in lib/shareCard.ts; this owns the dialog, the choices a reader gets (balance, QR,
   printed wallet address), and the save, copy and share paths, each shown only where the browser
   has it. A native <dialog> rather than a div: Escape, the backdrop, focus trapping and returning
   focus to the button afterwards all come with it.

   Client-only, like everything else under components/portfolio that is not the frame: the trigger
   reaches the page as `metrics.received.action`, built in PortfolioLive.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ShareCardProps {
  /** The card, with the rows that are always on it. */
  card: ShareCardData;
  /** Wallet balance row, offered behind a toggle (vault deposits print on the card when present). */
  holdingRow: ShareCardRow | null;
  /** Goes in the saved file's name, e.g. "ouro-airdrops-2026-09-11.png". */
  fileStem: string;
}

type Note = { kind: "ok" | "bad"; text: string } | null;

export function ShareCardTrigger({ card, holdingRow, fileStem }: ShareCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Share
      </Button>
      <ShareCardDialog card={card} holdingRow={holdingRow} fileStem={fileStem} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ShareCardDialog({ card, holdingRow, fileStem, open, onClose }: ShareCardProps & { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showHolding, setShowHolding] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const shown: ShareCardData = useMemo(
    () => (holdingRow && showHolding ? { ...card, rows: [holdingRow, ...card.rows] } : card),
    [card, holdingRow, showHolding],
  );
  // The card is rebuilt on every poll of the wallet, so the effect below watches its CONTENT: an
  // identical card must not force a repaint, and a changed figure must. Options are part of the
  // fingerprint so toggling QR / address repaints too.
  const fingerprint = useMemo(() => JSON.stringify({ shown, showQr, showAddress }), [shown, showQr, showAddress]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNote(null);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    let alive = true;
    const paint = () => {
      if (alive) drawShareCard(ctx, shown, { showQr, showAddress });
    };
    paint();
    // Painted again once the faces are in: a canvas asked for a font it does not have yet falls
    // back to a system one without saying so, and the card comes out looking like another product.
    if (document.fonts?.load) {
      void Promise.all(SHARE_CARD_FONTS.map((f) => document.fonts.load(f).catch(() => undefined))).then(paint);
    }
    return () => {
      alive = false;
    };
    // `fingerprint` stands in for `shown` + options, see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fingerprint]);

  const render = useCallback(async (): Promise<Blob> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("The card is not ready yet.");
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The image could not be made.");
    return blob;
  }, []);

  const run = useCallback(async (job: () => Promise<Note>) => {
    setBusy(true);
    try {
      setNote(await job());
    } catch (e) {
      setNote({ kind: "bad", text: (e as Error).message || "That did not work." });
    } finally {
      setBusy(false);
    }
  }, []);

  const save = () =>
    run(async () => {
      const url = URL.createObjectURL(await render());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileStem}.png`;
      a.click();
      // Revoked on the next frame: revoking straight away races the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { kind: "ok", text: "Saved to your downloads." };
    });

  const copy = () =>
    run(async () => {
      // The promise form, not an awaited blob: Safari only honours a clipboard write made in the
      // same turn as the click, and takes the pending blob instead.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": render() })]);
      return { kind: "ok", text: "Copied. Paste it anywhere." };
    });

  const send = () =>
    run(async () => {
      const file = new File([await render()], `${fileStem}.png`, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) return { kind: "bad", text: "This browser will not share an image. Save it instead." };
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        // Dismissing the sheet is not a failure.
        if ((e as Error).name === "AbortError") return null;
        throw e;
      }
      return null;
    });

  const [canCopy, setCanCopy] = useState(false);
  const [canSend, setCanSend] = useState(false);
  useEffect(() => {
    setCanCopy(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function");
    setCanSend(typeof navigator.canShare === "function" && typeof navigator.share === "function");
  }, []);

  const hint = showQr
    ? "The code on the card opens this wallet's portfolio. Anyone who scans it can see the same figures."
    : showAddress
      ? "The wallet address is printed on the card. Turn on the code if you want it to open the portfolio."
      : "No code or address on the card — only the airdrop figures.";

  return (
    <dialog
      ref={dialogRef}
      className="pf-share"
      aria-labelledby="pf-share-title"
      onClose={onClose}
      onCancel={onClose}
      // A click that lands on the element itself, rather than on anything inside it, is a click on the backdrop.
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="pf-share__inner">
        <canvas
          ref={canvasRef}
          className="pf-share__canvas"
          width={SHARE_CARD.width}
          height={SHARE_CARD.height}
          role="img"
          aria-label={`${card.kicker}: ${card.hero}. ${shown.rows.map((r) => `${r.label}, ${r.value}`).join(". ")}.`}
        />

        <div className="pf-share__side">
          <div className="pf-share__head">
            <div>
              <h2 id="pf-share-title" className="pf-share__title">
                Share your airdrops
              </h2>
              <p className="pf-share__lede">A picture of what this wallet has been paid. Choose what else goes on it.</p>
            </div>
            <button type="button" className="pf-share__close" onClick={onClose} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="pf-share__toggles">
            {holdingRow && (
              <label className="pf-share__toggle">
                <input type="checkbox" checked={showHolding} onChange={(e) => setShowHolding(e.target.checked)} />
                <span>
                  Show {holdingRow.label.toLowerCase()}{" "}
                  <span style={{ ...mono, color: "var(--text-muted)" }}>({holdingRow.value})</span>
                </span>
              </label>
            )}
            <label className="pf-share__toggle">
              <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
              <span>Show QR code</span>
            </label>
            <label className="pf-share__toggle">
              <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />
              <span>
                Show wallet address <span style={{ ...mono, color: "var(--text-muted)" }}>({card.cta.address})</span>
              </span>
            </label>
          </div>

          <div className="pf-share__actions">
            <Button size="sm" onClick={save} disabled={busy}>
              Save image
            </Button>
            {canCopy && (
              <Button size="sm" variant="secondary" onClick={copy} disabled={busy}>
                Copy
              </Button>
            )}
            {canSend && (
              <Button size="sm" variant="secondary" onClick={send} disabled={busy}>
                Share
              </Button>
            )}
          </div>

          <p className="pf-share__note" style={{ color: note?.kind === "bad" ? "var(--text-negative)" : "var(--text-muted)" }} aria-live="polite">
            {note ? note.text : hint}
          </p>
        </div>
      </div>
    </dialog>
  );
}
