import { useEffect } from "preact/hooks";

type PdfNativeFileFieldProps = {
  inputMode: "single" | "multi";
  label: string;
  accept: string;
  additionalMultiple: boolean;
  disabled: boolean;
  inputRef: { current: HTMLInputElement | null };
  onChoose: (event: Event) => void;
  onPicked: (files: File[]) => void;
};

export function PdfNativeFileField336({
  inputMode, label, accept, additionalMultiple, disabled, inputRef, onChoose, onPicked,
}: PdfNativeFileFieldProps) {
  useEffect(() => {
    // Astro can expose the native picker before Preact installs its change listener.
    const selected = inputRef.current?.files;
    if (selected?.length) onPicked([...selected]);
  }, []);

  return (
    <label class="field">
      <span>{inputMode === "multi" ? "File" : label}</span>
      <input ref={inputRef} type="file" accept={accept} multiple={inputMode === "multi" || additionalMultiple}
        onChange={(event) => onChoose(event)} disabled={disabled} />
      <small>Elaborazione su questo dispositivo, senza caricamenti né elaborazione remota alternativa.</small>
    </label>
  );
}
