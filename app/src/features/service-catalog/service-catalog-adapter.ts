import {
  addStaffToService as assignStaff,
  createService as postService,
  createServiceCategory as postCategory,
  getService as fetchService,
  getServiceCategories as fetchCategories,
  getServiceStaff as fetchServiceStaff,
  getServices as fetchServices,
  getStaff as fetchStaff,
  removeStaffFromService as deleteStaffLink,
  updateService as patchService,
  updateServiceCategory as patchCategory,
} from "@/lib/api/browser";
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ServiceCategoryDTO,
  ServiceCategoryListInput,
  ServiceCategoryPageDTO,
  ServiceDTO,
  ServiceListInput,
  ServicePageDTO,
  StaffListInput,
  StaffPageDTO,
  StaffServiceListQuery,
  StaffServiceMutationDTO,
  StaffServicePageDTO,
  StaffServiceRemoveDTO,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from "@/lib/api/contracts";

export const listServiceCategories = (organizationId: string, query: ServiceCategoryListInput, signal?: AbortSignal): Promise<ServiceCategoryPageDTO> => fetchCategories(organizationId, query, signal);
export const addServiceCategory = (organizationId: string, input: CreateServiceCategoryInput): Promise<ServiceCategoryDTO> => postCategory(organizationId, input);
export const saveServiceCategory = (organizationId: string, id: string, input: UpdateServiceCategoryInput, version: number): Promise<ServiceCategoryDTO> => patchCategory(organizationId, id, input, version);
export const listServices = (organizationId: string, query: ServiceListInput, signal?: AbortSignal): Promise<ServicePageDTO> => fetchServices(organizationId, query, signal);
export const readService = (organizationId: string, id: string, signal?: AbortSignal): Promise<ServiceDTO> => fetchService(organizationId, id, signal);
export const addService = (organizationId: string, input: CreateServiceInput): Promise<ServiceDTO> => postService(organizationId, input);
export const saveService = (organizationId: string, id: string, input: UpdateServiceInput, version: number): Promise<ServiceDTO> => patchService(organizationId, id, input, version);
export const listStaff = (organizationId: string, query: StaffListInput, signal?: AbortSignal): Promise<StaffPageDTO> => fetchStaff(organizationId, query, signal);
export const listServiceStaff = (organizationId: string, serviceId: string, query: StaffServiceListQuery, signal?: AbortSignal): Promise<StaffServicePageDTO> => fetchServiceStaff(organizationId, serviceId, query, signal);
export const assignStaffToService = (organizationId: string, serviceId: string, staffMemberId: string, version: number): Promise<StaffServiceMutationDTO> => assignStaff(organizationId, serviceId, staffMemberId, version);
export const unassignStaffFromService = (organizationId: string, serviceId: string, staffMemberId: string, version: number): Promise<StaffServiceRemoveDTO> => deleteStaffLink(organizationId, serviceId, staffMemberId, version);
