import { MockSipService, type SipService } from "../services/sip";
import { SipJsService } from "../services/sipjs/SipJsService";

// Real SIP.js by default. Set localStorage "sipEngine" = "mock" to use the
// in-memory mock for UI development without an Asterisk PBX.
function createSipService(): SipService {
  const engine =
    typeof localStorage !== "undefined" ? localStorage.getItem("sipEngine") : null;
  return engine === "mock" ? new MockSipService() : new SipJsService();
}

export const sip: SipService = createSipService();
