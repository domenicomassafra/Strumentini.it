import { useEffect, useState } from "preact/hooks";
import { createIndexedDbPersistence } from "../../../persistence/persistence";
import { createDefaultWorkProfile, type WorkProfile } from "../../../profile/work-profile";
import { createWorkbenchRepository } from "../../../workbench/repository";
import { createDefaultWorkbenchState } from "../../../workbench/state";

function initialProfile(): WorkProfile {
  return createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" });
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "en-US",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

export function useWorkProfile(): { profile: WorkProfile; ready: boolean } {
  const [profile, setProfile] = useState<WorkProfile>(initialProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = browserProfile();
    const repository = createWorkbenchRepository(createIndexedDbPersistence(), createDefaultWorkbenchState(initial));
    void repository.load().then((loaded) => {
      setProfile(loaded.state.profile);
      setReady(true);
    });
  }, []);

  return { profile, ready };
}
