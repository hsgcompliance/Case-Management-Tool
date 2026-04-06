// functions/src/features/customers/schemas.ts

// Core
export { z, toArray } from "@hdb/contracts";

// Customers runtime schemas (leaf module, per contracts index policy)
export {
  Population,
  CustomerStatus,
  CustomerUpsertBody,
  CustomerPatchBody,
  CustomersListQuery,
  CustomersGetQuery,
  CustomersDeleteBody,
  CustomersAdminDeleteBody,
} from "@hdb/contracts/customers";

// Customers types
export type {
  CustomerInput,
  TCustomersListQuery,
  TCustomersGetQuery,
  TCustomerStatus,
} from "@hdb/contracts/customers";
