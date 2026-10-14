import { useEffect, useState, type ChangeEvent } from "react";
import { useAppStore } from "../state/store";
import { Modal } from "./ui/Modal";
import type { Buddy, BuddyType } from "../types/buddy";
import styles from "./ContactForm.module.scss";

interface FormState {
  type: BuddyType;
  callerIdName: string;
  extNo: string;
  mobileNumber: string;
  contactNumber1: string;
  contactNumber2: string;
  email: string;
  desc: string;
}

const EMPTY: FormState = {
  type: "contact",
  callerIdName: "",
  extNo: "",
  mobileNumber: "",
  contactNumber1: "",
  contactNumber2: "",
  email: "",
  desc: ""
};

function fromBuddy(b: Buddy): FormState {
  return {
    type: b.type === "extension" ? "extension" : "contact",
    callerIdName: b.callerIdName,
    extNo: b.extNo,
    mobileNumber: b.mobileNumber,
    contactNumber1: b.contactNumber1,
    contactNumber2: b.contactNumber2,
    email: b.email,
    desc: b.desc
  };
}

export function ContactForm() {
  const editing = useAppStore((s) => s.editingContact);
  const close = useAppStore((s) => s.closeContactForm);
  const addBuddy = useAppStore((s) => s.addBuddy);
  const updateBuddy = useAppStore((s) => s.updateBuddy);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    setForm(editing && editing !== "new" ? fromBuddy(editing) : EMPTY);
  }, [editing]);

  if (!editing) return null;
  const isEdit = editing !== "new";

  const bind =
    (key: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSave = form.callerIdName.trim() !== "" || form.extNo.trim() !== "";

  const save = async () => {
    if (!canSave) return;
    if (editing !== "new") await updateBuddy(editing.identity, { ...form });
    else await addBuddy(form);
    close();
  };

  const field = (label: string, key: keyof FormState, type = "text") => (
    <label className={styles.field}>
      <span>{label}</span>
      <input type={type} value={form[key]} onChange={bind(key)} />
    </label>
  );

  const footer = (
    <>
      <button type="button" className={styles.btn} onClick={close}>
        Cancel
      </button>
      <button
        type="button"
        className={styles.primary}
        onClick={() => void save()}
        disabled={!canSave}
      >
        {isEdit ? "Save" : "Add"}
      </button>
    </>
  );

  return (
    <Modal
      title={isEdit ? "Edit contact" : "Add contact"}
      onClose={close}
      footer={footer}
      width={460}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span>Type</span>
          <select value={form.type} onChange={bind("type")}>
            <option value="contact">Contact</option>
            <option value="extension">Extension</option>
          </select>
        </label>
        {field("Name", "callerIdName")}
        {field("Extension", "extNo")}
        {field("Mobile", "mobileNumber")}
        {field("Number 1", "contactNumber1")}
        {field("Number 2", "contactNumber2")}
        {field("Email", "email", "email")}
        {field("Notes", "desc")}
      </div>
    </Modal>
  );
}
