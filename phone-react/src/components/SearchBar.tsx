import { useAppStore } from "../state/store";
import { useLang } from "../hooks/useLang";
import type { BuddySortBy } from "../services/buddies";
import styles from "./SearchBar.module.scss";
import common from "./common.module.scss";

const SORTS: { value: BuddySortBy; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "alphabetical", label: "Name" },
  { value: "extension", label: "Extension" },
  { value: "type", label: "Type" }
];

export function SearchBar() {
  const t = useLang();
  const searchTerm = useAppStore((s) => s.searchTerm);
  const setSearchTerm = useAppStore((s) => s.setSearchTerm);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const openContactForm = useAppStore((s) => s.openContactForm);

  return (
    <div className={styles.searchBar}>
      <div className={styles.searchInput}>
        <i className="fa fa-search" />
        <input
          value={searchTerm}
          placeholder={t("find_someone")}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => setSearchTerm("")}
            aria-label="Clear search"
          >
            <i className="fa fa-times" />
          </button>
        )}
      </div>
      <select
        className={styles.sort}
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as BuddySortBy)}
        title="Sort contacts"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={common.iconButton}
        title="Add contact"
        aria-label="Add contact"
        onClick={() => openContactForm()}
      >
        <i className="fa fa-user-plus" />
      </button>
    </div>
  );
}
