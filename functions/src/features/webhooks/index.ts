// functions/src/features/webhooks/index.ts
// Cloud Function export surface for inbound webhooks (experimental).
export {
  jotformWebhook_http as jotformWebhook,
  listWebhookEvents_http as listWebhookEvents,
  formsWebhookConfig_http as formsWebhookConfig,
  listFormsRegistry_http as listFormsRegistry,
  formsAuthInfo_http as formsAuthInfo,
  formsRegistryUpdate_http as formsRegistryUpdate,
  formSchema_http as formSchema,
} from "./http";
