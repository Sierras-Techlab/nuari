import {
  createCustomer as postCustomer,
  getCustomer as fetchCustomer,
  getCustomers as fetchCustomers,
  getDuplicateCustomerCandidates as fetchDuplicateCandidates,
  updateCustomer as patchCustomer,
} from "@/lib/api/browser";
import type {
  CreateCustomerInput,
  CustomerDTO,
  CustomerListInput,
  CustomerPageDTO,
  DuplicateCustomerCandidatesDTO,
  UpdateCustomerInput,
} from "@/lib/api/contracts";

export const listCustomers = (organizationId: string, query: CustomerListInput, signal?: AbortSignal): Promise<CustomerPageDTO> =>
  fetchCustomers(organizationId, query, signal);

export const readCustomer = (organizationId: string, customerId: string, signal?: AbortSignal): Promise<CustomerDTO> =>
  fetchCustomer(organizationId, customerId, signal);

export const addCustomer = (organizationId: string, input: CreateCustomerInput): Promise<CustomerDTO> =>
  postCustomer(organizationId, input);

export const saveCustomer = (organizationId: string, customerId: string, input: UpdateCustomerInput, version: number): Promise<CustomerDTO> =>
  patchCustomer(organizationId, customerId, input, version);

export const findCustomerCandidates = (organizationId: string, query: { email?: string; phone?: string; excludeId?: string }, signal?: AbortSignal): Promise<DuplicateCustomerCandidatesDTO> =>
  fetchDuplicateCandidates(organizationId, query, signal);
