import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { checkForUpdate, dismissUpdate, type ReleaseInfo } from "../lib/updates";
import { APP_VERSION } from "../lib/version";

export function UpdateNotice() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    let active = true;
    void checkForUpdate().then((result) => {
      if (active) setRelease(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!release) return null;

  return (
    <div className="flex h-[26px] shrink-0 items-center gap-2 border-b border-acid/20 bg-acid/[0.05] px-3 font-mono text-[9px]">
      <span className="shrink-0 border border-acid/40 bg-acid/[0.12] px-1 py-[1px] text-[7.5px] uppercase tracking-[0.12em] text-acid">
        update
      </span>
      <span className="min-w-0 truncate text-zinc-400">
        AcidMade <span className="text-acid">v{release.version}</span> is available
        <span className="hidden text-zinc-600 sm:inline"> · you are on v{APP_VERSION}</span>
      </span>
      <a
        href={release.url}
        target="_blank"
        rel="noreferrer"
        className="ml-auto flex shrink-0 items-center gap-0.5 text-acid hover:underline"
      >
        View release
        <ArrowUpRight size={9} />
      </a>
      <button
        type="button"
        onClick={() => {
          dismissUpdate(release.version);
          setRelease(null);
        }}
        aria-label="Dismiss update notification"
        title="Hide this release"
        className="grid h-4 w-4 shrink-0 place-items-center text-zinc-600 transition-colors hover:text-zinc-200"
      >
        <X size={10} />
      </button>
    </div>
  );
}
