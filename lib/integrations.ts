import "server-only";
import { integrationSchema } from "./integration-config";
export const integrations = integrationSchema.parse(
  Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
);
