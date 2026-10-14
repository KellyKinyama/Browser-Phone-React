export type BuddyType = "extension" | "xmpp" | "contact" | "group";

export type DeviceState =
  | "dotOffline"
  | "dotOnline"
  | "dotRinging"
  | "dotInUse"
  | "dotHold"
  | "dotBusy";

/**
 * A contact / presence entity. Mirrors the original `Buddy` constructor fields,
 * re-typed with camelCase names for the React rewrite.
 */
export interface Buddy {
  type: BuddyType;
  identity: string;
  jid?: string;
  callerIdName: string;
  email: string;
  desc: string;
  extNo: string;
  mobileNumber: string;
  contactNumber1: string;
  contactNumber2: string;
  /** Full date string, e.g. "1208-03-21 15:34:23 UTC", or null if never. */
  lastActivity: string | null;
  devState: DeviceState;
  presence: string;
  presenceText: string;
  missed: number;
  imageObjectUrl: string;
  enableDuringDnd: boolean;
  enableSubscribe: boolean;
  subscribeUser: string;
  allowAutoDelete: boolean;
  pinned: boolean;
}
