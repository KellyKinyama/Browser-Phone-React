// Phase 1 ("dynamic") ambient declarations.
// These keep the ported monolith (src/phone.ts) compiling under TypeScript while
// vendor libraries remain loaded as global <script> includes. Everything is typed
// loosely as `any` here; later phases replace these with real @types/* packages.

export {};

declare global {
  // Allow arbitrary window.* access used throughout phone.ts (e.g. window.SettingsOutputAudio).
  interface Window {
    [key: string]: any;
  }

  // jQuery (loaded via CDN <script>)
  const $: any;
  const jQuery: any;

  // Vendor libraries (loaded via deferred CDN <script>)
  const SIP: any;
  const moment: any;
  const fabric: any;
  const Croppie: any;
  const Chart: any;
  const Strophe: any;

  // Runtime provisioning object defined inline in index.html
  const phoneOptions: any;

  // web_hook_* callbacks defined inline in index.html.
  // Code guards each with `typeof ... !== "undefined"` before calling.
  const web_hook_dial_out: any;
  const web_hook_disable_dnd: any;
  const web_hook_enable_dnd: any;
  const web_hook_on_add_buddy: any;
  const web_hook_on_before_init: any;
  const web_hook_on_config_menu: any;
  const web_hook_on_dtmf: any;
  const web_hook_on_edit_buddy: any;
  const web_hook_on_edit_media: any;
  const web_hook_on_expand_video_area: any;
  const web_hook_on_init: any;
  const web_hook_on_invite: any;
  const web_hook_on_language_pack_loaded: any;
  const web_hook_on_message: any;
  const web_hook_on_message_action: any;
  const web_hook_on_messages_waiting: any;
  const web_hook_on_missed_notify: any;
  const web_hook_on_modify: any;
  const web_hook_on_notify: any;
  const web_hook_on_register: any;
  const web_hook_on_registrationFailed: any;
  const web_hook_on_restore_video_area: any;
  const web_hook_on_self_notify: any;
  const web_hook_on_terminate: any;
  const web_hook_on_transportError: any;
  const web_hook_on_unregistered: any;
  const web_hook_on_userAgent_created: any;
  const web_hook_sort_and_filter: any;
}
