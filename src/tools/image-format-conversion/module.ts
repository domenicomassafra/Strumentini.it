import type { ToolModule } from "../../runtime/types";
import { convertImageFormatLocal } from "../../engines/image/visual-tools";
import { exportSvgLocal, isSvgInput, type SvgExportMime } from "../../engines/image/svg-export";

const module: ToolModule = { run(input, _context, signal) {
  const request = input as Record<string, unknown> | null;
  const file = request?.file;
  if (file instanceof Blob && isSvgInput(file as File)) {
    return exportSvgLocal({
      file,
      mime: request?.mime as SvgExportMime,
      width: request?.width as number,
      height: request?.height as number,
      scale: request?.scale as number,
      background: request?.background as string,
      ...(request?.quality === undefined ? {} : { quality: request.quality as number }),
    }, signal);
  }
  return convertImageFormatLocal(input, signal);
} };

export default module;
