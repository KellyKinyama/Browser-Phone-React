import { useMemo, useState } from "react";
import clsx from "clsx";
import { useAppStore } from "../state/store";
import { useLang } from "../hooks/useLang";
import { arrangeBuddies, filterBuddies } from "../services/buddies";
import { buddyAvatar } from "../services/avatars";
import { Menu, type MenuItem } from "./ui/Menu";
import { confirmDialog, toast } from "../services/dialogs";
import styles from "./BuddyList.module.scss";
import common from "./common.module.scss";

function formatActivity(s: string | null): string {
  if (!s) return "";
  const t = Date.parse(s.replace(" UTC", "Z").replace(" ", "T"));
  if (Number.isNaN(t) || new Date(t).getFullYear() < 2000) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  if (min < 10080) return `${Math.floor(min / 1440)}d`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function BuddyList() {
  const t = useLang();
  const buddies = useAppStore((s) => s.buddies);
  const lines = useAppStore((s) => s.lines);
  const dial = useAppStore((s) => s.dial);
  const searchTerm = useAppStore((s) => s.searchTerm);
  const sortBy = useAppStore((s) => s.sortBy);
  const selectedBuddyId = useAppStore((s) => s.selectedBuddyId);
  const selectBuddy = useAppStore((s) => s.selectBuddy);
  const togglePin = useAppStore((s) => s.togglePin);
  const removeBuddy = useAppStore((s) => s.removeBuddy);
  const openContactForm = useAppStore((s) => s.openContactForm);

  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const visible = useMemo(
    () => arrangeBuddies(filterBuddies(buddies, searchTerm), sortBy),
    [buddies, searchTerm, sortBy]
  );

  if (buddies.length === 0) {
    return (
      <div className={styles.emptyState}>
        <i className="fa fa-user-plus" />
        <p>No contacts yet</p>
        <span>{t("find_someone")}</span>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className={styles.emptyState}>
        <i className="fa fa-search" />
        <p>No matches</p>
      </div>
    );
  }

  const menuBuddy = menu ? buddies.find((b) => b.identity === menu.id) ?? null : null;
  const menuItems: MenuItem[] = menuBuddy
    ? [
        { label: "Edit", icon: "fa-pencil", onClick: () => openContactForm(menuBuddy) },
        {
          label: menuBuddy.pinned ? "Unpin" : "Pin",
          icon: "fa-thumb-tack",
          onClick: () => void togglePin(menuBuddy.identity)
        },
        {
          label: "Delete",
          icon: "fa-trash",
          danger: true,
          onClick: async () => {
            const name = menuBuddy.callerIdName || menuBuddy.extNo || "this contact";
            if (await confirmDialog(`Remove ${name}?`, "Remove contact", "Delete", "Cancel")) {
              await removeBuddy(menuBuddy.identity);
              toast("success", "Contact removed");
            }
          }
        }
      ]
    : [];

  return (
    <>
      <ul className={styles.buddyList}>
        {visible.map((b) => {
          const line = lines.find((l) => l.buddyId === b.identity);
          const call = line ? (line.isOnHold ? "held" : "active") : null;
          const number = b.extNo || b.mobileNumber || b.contactNumber1;
          const activity = formatActivity(b.lastActivity);
          return (
            <li
              key={b.identity}
              className={clsx(
                styles.buddyItem,
                b.identity === selectedBuddyId && styles.selected,
                call === "active" && styles.activeCall,
                call === "held" && styles.heldCall
              )}
              onClick={() => selectBuddy(b.identity)}
            >
              <div className={styles.avatarWrap}>
                <img className={styles.avatar} src={buddyAvatar(b)} alt="" />
                <span className={clsx(common.statusDot, common[b.devState], styles.avatarDot)} />
              </div>
              <div className={styles.buddyText}>
                <div className={styles.buddyName}>
                  {b.pinned && <i className={clsx("fa fa-thumb-tack", styles.pin)} />}
                  {b.callerIdName || b.extNo}
                </div>
                <div className={styles.buddyPresence}>
                  {b.presenceText || (b.extNo ? `Ext. ${b.extNo}` : b.type)}
                </div>
              </div>
              <div className={styles.meta}>
                {activity && <span className={styles.activity}>{activity}</span>}
                {b.missed > 0 && <span className={styles.missedBadge}>{b.missed}</span>}
              </div>
              <div className={styles.actions}>
                {number && (
                  <>
                    <button
                      type="button"
                      className={styles.quick}
                      aria-label="Audio call"
                      title="Audio call"
                      onClick={(e) => {
                        e.stopPropagation();
                        void dial(number, false, { buddyId: b.identity, displayName: b.callerIdName });
                      }}
                    >
                      <i className="fa fa-phone" />
                    </button>
                    <button
                      type="button"
                      className={styles.quick}
                      aria-label="Video call"
                      title="Video call"
                      onClick={(e) => {
                        e.stopPropagation();
                        void dial(number, true, { buddyId: b.identity, displayName: b.callerIdName });
                      }}
                    >
                      <i className="fa fa-video-camera" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={styles.kebab}
                  aria-label="Contact actions"
                  title="More"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu({ id: b.identity, x: e.clientX, y: e.clientY });
                  }}
                >
                  <i className="fa fa-ellipsis-v" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {menu && menuBuddy && (
        <Menu anchor={{ x: menu.x, y: menu.y }} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
