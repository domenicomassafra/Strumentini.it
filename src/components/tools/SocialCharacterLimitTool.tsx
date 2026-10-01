import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function SocialCharacterLimitTool() {
  const [platform, setPlatform] = useState("x");
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("social-character-limit", { platform, text }, {}, signal), { formatError: () => "Scegli una piattaforma supportata e inserisci il testo." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Piattaforma</span><select aria-label="Piattaforma" value={platform} onChange={(event) => setPlatform(event.currentTarget.value)}><option value="x">X / Twitter (280)</option><option value="linkedin">LinkedIn (3.000)</option><option value="instagram">Instagram (2.200)</option><option value="facebook">Facebook (63.206)</option><option value="youtube">Titolo YouTube (100)</option><option value="tiktok">TikTok (2.200)</option><option value="mastodon">Mastodon (500)</option><option value="bluesky">Bluesky (300)</option></select></label><label class="field"><span>Testo del post</span><textarea aria-label="Testo del post" rows={7} value={text} onInput={(event) => setText(event.currentTarget.value)} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Controlla lunghezza</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Controllo lunghezza" placeholder="Qui appariranno conteggio caratteri e spazio rimanente." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
