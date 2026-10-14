"use client";

import { AddressBook } from "@phosphor-icons/react/dist/csr/AddressBook";
import { Briefcase } from "@phosphor-icons/react/dist/csr/Briefcase";
import { Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { IdentificationCard } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { Link as LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";

import { useAccess } from "@/features/access/access-provider";
import { getOrganization, updateOrganization } from "@/lib/api/browser";
import { toApiError } from "@/lib/api/errors";
import styles from "./organization-settings.module.css";


type OrganizationSettingsData = {
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  address: string;
  timezone: string;
  currency: string;
  slug: string;
  logoUrl?: string;
};

type RegionalConfig = {
  currencyDisplay: string;
  currencyCode: string;
  stateLabel: string;
  zipLabel: string;
  timezones: Record<string, string>;
};

const regionalData: Record<string, RegionalConfig> = {
  AR: {
    currencyDisplay: "ARS - Peso Argentino",
    currencyCode: "ARS",
    stateLabel: "Provincia",
    zipLabel: "C.P.",
    timezones: {
      "America/Argentina/Buenos_Aires": "(GMT-03:00) Buenos Aires",
      "America/Argentina/Cordoba": "(GMT-03:00) Córdoba",
      "America/Argentina/Mendoza": "(GMT-03:00) Mendoza",
    },
  },
  UY: {
    currencyDisplay: "UYU - Peso Uruguayo",
    currencyCode: "UYU",
    stateLabel: "Departamento",
    zipLabel: "C.P.",
    timezones: {
      "America/Montevideo": "(GMT-03:00) Montevideo",
    },
  },
  CL: {
    currencyDisplay: "CLP - Peso Chileno",
    currencyCode: "CLP",
    stateLabel: "Región",
    zipLabel: "C.P.",
    timezones: {
      "America/Santiago": "(GMT-04:00) Santiago",
      "America/Punta_Arenas": "(GMT-03:00) Punta Arenas",
      "Pacific/Easter": "(GMT-06:00) Isla de Pascua",
    },
  },
  BR: {
    currencyDisplay: "BRL - Real Brasileño",
    currencyCode: "BRL",
    stateLabel: "Estado",
    zipLabel: "CEP",
    timezones: {
      "America/Sao_Paulo": "(GMT-03:00) São Paulo",
      "America/Manaus": "(GMT-04:00) Manaus",
      "America/Belem": "(GMT-03:00) Belém",
      "America/Fortaleza": "(GMT-03:00) Fortaleza",
      "America/Rio_Branco": "(GMT-05:00) Rio Branco",
    },
  },
  MX: {
    currencyDisplay: "MXN - Peso Mexicano",
    currencyCode: "MXN",
    stateLabel: "Estado",
    zipLabel: "C.P.",
    timezones: {
      "America/Mexico_City": "(GMT-06:00) Ciudad de México",
      "America/Cancun": "(GMT-05:00) Cancún",
      "America/Tijuana": "(GMT-08:00) Tijuana",
      "America/Hermosillo": "(GMT-07:00) Hermosillo",
      "America/Mazatlan": "(GMT-07:00) Mazatlán",
    },
  },
  CO: {
    currencyDisplay: "COP - Peso Colombiano",
    currencyCode: "COP",
    stateLabel: "Departamento",
    zipLabel: "Código Postal",
    timezones: {
      "America/Bogota": "(GMT-05:00) Bogotá",
    },
  },
  PE: {
    currencyDisplay: "PEN - Sol Peruano",
    currencyCode: "PEN",
    stateLabel: "Departamento",
    zipLabel: "C.P.",
    timezones: {
      "America/Lima": "(GMT-05:00) Lima",
    },
  },
};

type ToastNotification = {
  id: string;
  message: string;
  type: "success" | "error";
};

const inputPremiumClass =
  "block w-full rounded-xl border border-[#E4E9E7] bg-[#F8FAF9]/50 px-4 py-3 text-sm font-medium text-[#182026] shadow-sm transition-all placeholder:text-[#667078]/50 hover:border-[#667078]/40 focus:border-[#182026] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[#182026]/10";

const inputReadonlyClass =
  "block w-full cursor-not-allowed rounded-xl border border-[#E4E9E7] bg-[#182026]/[0.02] px-4 py-3 text-sm font-medium text-[#667078] shadow-none focus:border-[#E4E9E7] focus:bg-[#182026]/[0.02] focus:outline-none focus:ring-0";

const labelBaseClass = "block text-sm font-bold text-[#182026] mb-1.5";

export function OrganizationSettingsScreen() {
  const { snapshot } = useAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTzRef = useRef<HTMLSelectElement>(null);
  const flashCurrRef = useRef<HTMLInputElement>(null);

  const activeOrg = useMemo(() => {
    return snapshot?.memberships.find(
      (m) => m.organization.id === snapshot.activeOrganizationId
    )?.organization;
  }, [snapshot]);

  const defaultInitial = useMemo<OrganizationSettingsData>(() => {
    const orgName = activeOrg?.name || "Estudio Nuari";
    const orgSlug = activeOrg?.slug || "estudio-nuari";
    return {
      name: orgName,
      description: "Estudio de diseño y consultoría estratégica.",
      email: "contacto@estudionuari.com",
      phone: "1123456789",
      website: "https://estudionuari.com",
      country: "AR",
      state: "Buenos Aires",
      city: "Palermo",
      zip: "C1414",
      address: "Av. Santa Fe 3200, Piso 3",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
      slug: orgSlug,
      logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        orgName
      )}&background=182026&color=fff&size=150`,
    };
  }, [activeOrg]);

  const currentMembership = useMemo(() => {
    return snapshot?.memberships.find(
      (m) => m.organization.id === snapshot.activeOrganizationId
    );
  }, [snapshot]);

  const isOwner = currentMembership?.role === "OWNER";
  const [initialData, setInitialData] = useState<OrganizationSettingsData>(() => defaultInitial);
  const [formData, setFormData] = useState<OrganizationSettingsData>(() => defaultInitial);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [flashTz, setFlashTz] = useState(false);
  const [flashCurr, setFlashCurr] = useState(false);

  useEffect(() => {
    if (!snapshot?.activeOrganizationId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setIsLoading(true);
    });
    getOrganization(snapshot.activeOrganizationId)
      .then(({ organization }) => {
        if (!active) return;
        const loaded: OrganizationSettingsData = {
          name: organization.name || "",
          description: organization.description || "",
          email: organization.email || "",
          phone: organization.phone || "",
          website: organization.website || "",
          country: organization.country || "AR",
          state: organization.state || "",
          city: organization.city || "",
          zip: organization.zip || "",
          address: organization.address || "",
          timezone: organization.timezone || "America/Argentina/Buenos_Aires",
          currency: organization.currency || "ARS",
          slug: organization.slug || "",
          logoUrl: organization.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(
            organization.name || "Nuari"
          )}&background=182026&color=fff&size=150`,
        };
        setInitialData(loaded);
        setFormData(loaded);
        setFieldErrors({});
      })
      .catch((err) => {
        if (active) showToast(toApiError(err).message, "error");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [snapshot?.activeOrganizationId]);

  const isDirty = useMemo(() => {
    return JSON.stringify(initialData) !== JSON.stringify(formData);
  }, [initialData, formData]);

  const slugChanged = formData.slug !== initialData.slug;

  const currentRegion = regionalData[formData.country] || regionalData.AR;

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function handleFieldChange(
    field: keyof OrganizationSettingsData,
    value: string
  ) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

    if (field === "country") {
      const nextRegion = regionalData[value] || regionalData.AR;
      const firstTz = Object.keys(nextRegion.timezones)[0] || "";
      setFormData((prev) => ({
        ...prev,
        country: value,
        currency: nextRegion.currencyCode,
        timezone: firstTz,
        state: "",
        city: "",
      }));

      setFlashTz(true);
      setFlashCurr(true);
      setTimeout(() => {
        setFlashTz(false);
        setFlashCurr(false);
      }, 1000);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleDiscard() {
    setFormData({ ...initialData });
    setFieldErrors({});
  }

  function handleSaveClick() {
    if (isSaving || isLoading) return;
    if (slugChanged) {
      setShowModal(true);
    } else {
      executeSave();
    }
  }

  async function executeSave() {
    if (!snapshot?.activeOrganizationId) return;
    setIsSaving(true);
    setFieldErrors({});

    try {
      const payload: Record<string, unknown> = {};

      if (formData.name !== initialData.name) {
        payload.name = formData.name;
      }
      if (isOwner && formData.slug !== initialData.slug) {
        payload.slug = formData.slug;
      }
      if (formData.description !== initialData.description) {
        payload.description = formData.description;
      }
      if (formData.email !== initialData.email) {
        payload.email = formData.email;
      }
      if (formData.phone !== initialData.phone) {
        payload.phone = formData.phone;
      }
      if (formData.website !== initialData.website) {
        payload.website = formData.website;
      }
      if (formData.country !== initialData.country) {
        payload.country = formData.country;
        payload.currency = formData.currency;
        payload.timezone = formData.timezone;
      } else {
        if (formData.timezone !== initialData.timezone) {
          payload.timezone = formData.timezone;
        }
        if (formData.currency !== initialData.currency) {
          payload.currency = formData.currency;
        }
      }
      if (formData.state !== initialData.state) {
        payload.state = formData.state;
      }
      if (formData.city !== initialData.city) {
        payload.city = formData.city;
      }
      if (formData.zip !== initialData.zip) {
        payload.zip = formData.zip;
      }
      if (formData.address !== initialData.address) {
        payload.address = formData.address;
      }

      const { organization } = await updateOrganization(snapshot.activeOrganizationId, payload);

      const updated: OrganizationSettingsData = {
        name: organization.name,
        description: organization.description || "",
        email: organization.email || "",
        phone: organization.phone || "",
        website: organization.website || "",
        country: organization.country || "AR",
        state: organization.state || "",
        city: organization.city || "",
        zip: organization.zip || "",
        address: organization.address || "",
        timezone: organization.timezone,
        currency: organization.currency,
        slug: organization.slug,
        logoUrl: formData.logoUrl,
      };
      setInitialData(updated);
      setFormData(updated);
      setShowModal(false);
      showToast("Configuración guardada exitosamente en el servidor", "success");
    } catch (error) {
      const err = toApiError(error);
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      showToast(err.message || "Error al guardar la configuración", "error");
    } finally {
      setIsSaving(false);
    }
  }


  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      showToast("La carga de archivos de logo estará disponible próximamente con almacenamiento en la nube.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }


  function handleRemoveLogo() {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      formData.name || "Nuari"
    )}&background=182026&color=fff&size=150`;
    setFormData((prev) => ({ ...prev, logoUrl: fallback }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const descLength = formData.description.length;
  const descExceeded = descLength > 150;

  return (
    <div className="relative mx-auto w-full max-w-4xl pb-32">
      {/* Encabezado */}
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#182026] mb-2">
            Configuración de organización
          </h1>
          <p className="text-base text-[#667078]">
            Administrá la información general y las preferencias de tu negocio.
          </p>
        </div>
        <Link
          href="/app/equipo"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E4E9E7] bg-white px-4 py-2.5 text-sm font-bold text-[#182026] shadow-xs transition-colors hover:bg-[#F8FAF9] hover:border-[#182026]/30"
        >
          <UsersThree size={18} className="text-[#182026]" />
          <span>Equipo y accesos</span>
        </Link>
      </header>


      {/* Banner de negocio con logo interactivo */}
      <div className="relative mb-12 overflow-hidden rounded-[2rem] border border-[#E4E9E7] bg-white shadow-sm">
        <div className={`relative h-32 w-full overflow-hidden ${styles.headerMesh}`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23182026' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />
        </div>

        <div className="relative px-6 pb-8 sm:px-10">
          <div className="-mt-12 mb-6 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            {/* Avatar interactivo */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Cambiar logo del negocio"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              className="group relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#F8FAF9] shadow-sm transition-transform hover:scale-105"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formData.logoUrl || defaultInitial.logoUrl}
                alt="Logo del negocio"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-[#182026]/40 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                <Camera size={26} className="text-white" />
              </div>
            </div>

            <div className="flex-1 pb-1 min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight text-[#182026]">
                {formData.name || "Sin nombre"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-[#667078]">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A997E8]/20 bg-[#F0ECFF] px-2.5 py-1 text-xs font-semibold text-[#182026]">
                  <Briefcase size={14} weight="fill" className="text-[#A997E8]" />{" "}
                  {activeOrg?.businessType === "COMMERCE"
                    ? "Comercio"
                    : activeOrg?.businessType === "HOSPITALITY"
                    ? "Gastronomía"
                    : "Servicios"}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-[#182026]" />{" "}
                  <span>{formData.city || "Ciudad"}</span>,{" "}
                  <span>{formData.state || "Provincia"}</span>
                </span>
                <span className="ml-auto hidden text-xs text-[#667078]/70 sm:flex">
                  nuari.app/
                  <span className="font-bold text-[#182026]">
                    {formData.slug || "slug"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="ml-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-[#E4E9E7] bg-[#F8FAF9] px-4 py-2 text-sm font-semibold text-[#182026] transition-all hover:bg-[#E4E9E7]/50 hover:shadow-xs"
            >
              Cambiar logo
            </button>
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="rounded-xl px-3 py-2 text-sm font-medium text-[#667078] transition-colors hover:bg-red-50 hover:text-red-600"
            >
              Eliminar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png, image/jpeg, image/svg+xml"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>
      </div>

      {/* Contenido principal del formulario */}
      <div className="space-y-10">
        {/* SECCIÓN 1: Perfil comercial */}
        <section className="flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="w-full shrink-0 pt-2 md:w-1/3">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-[#A997E8]/20 bg-[#F0ECFF] text-[#A997E8] shadow-xs">
              <IdentificationCard size={20} />
            </div>
            <h3 className="mb-1 text-base font-bold text-[#182026]">
              Perfil comercial
            </h3>
            <p className="text-sm text-[#667078]">
              La información principal que verán tus clientes en facturas y comunicaciones.
            </p>
          </div>

          <div className="w-full rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-sm sm:p-8 md:w-2/3">
            <div className="space-y-5">
              <div>
                <label htmlFor="org-name" className={labelBaseClass}>
                  Nombre de la organización
                </label>
                <input
                  type="text"
                  id="org-name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="Ej. Estudio Nuari"
                  className={inputPremiumClass}
                />
                {fieldErrors.name && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.name[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="org-desc" className={labelBaseClass}>
                  Descripción breve{" "}
                  <span className="ml-1 font-normal text-[#667078]">
                    (Opcional)
                  </span>
                </label>
                <textarea
                  id="org-desc"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="¿A qué se dedica tu negocio?"
                  className={`${inputPremiumClass} resize-none`}
                />
                {fieldErrors.description && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.description[0]}</p>
                )}
                <p
                  className={`mt-2 text-right text-xs font-medium ${
                    descExceeded ? "text-red-500 font-bold" : "text-[#667078]"
                  }`}
                >
                  {descLength}/150 caracteres
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-[#E4E9E7]/60" />

        {/* SECCIÓN 2: Contacto y Ubicación */}
        <section className="flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="w-full shrink-0 pt-2 md:w-1/3">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-[#7EA8F8]/20 bg-[#E8F0FF] text-[#7EA8F8] shadow-xs">
              <AddressBook size={20} />
            </div>
            <h3 className="mb-1 text-base font-bold text-[#182026]">
              Contacto y Ubicación
            </h3>
            <p className="text-sm text-[#667078]">
              Canales de comunicación y dirección física de tu establecimiento.
            </p>
          </div>

          <div className="w-full space-y-6 md:w-2/3">
            {/* Tarjeta de Contacto */}
            <div className="space-y-5 rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-sm sm:p-8">
              <div>
                <label htmlFor="org-email" className={labelBaseClass}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  id="org-email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="contacto@tunegocio.com"
                  className={inputPremiumClass}
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.email[0]}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="org-phone" className={labelBaseClass}>
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#667078]">
                      🇦🇷 +54
                    </span>
                    <input
                      type="tel"
                      id="org-phone"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="11 2345 6789"
                      className={`${inputPremiumClass} pl-16`}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.phone[0]}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="org-website" className={labelBaseClass}>
                    Sitio web{" "}
                    <span className="ml-1 font-normal text-[#667078]">
                      (Opcional)
                    </span>
                  </label>
                  <div className="relative">
                    <LinkIcon
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667078]"
                    />
                    <input
                      type="url"
                      id="org-website"
                      value={formData.website}
                      onChange={(e) => handleFieldChange("website", e.target.value)}
                      placeholder="tunegocio.com"
                      className={`${inputPremiumClass} pl-10`}
                    />
                  </div>
                  {fieldErrors.website && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.website[0]}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tarjeta de Ubicación */}
            <div className="space-y-5 rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-sm sm:p-8">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="org-country" className={labelBaseClass}>
                    País
                  </label>
                  <select
                    id="org-country"
                    value={formData.country}
                    onChange={(e) => handleFieldChange("country", e.target.value)}
                    className={`${inputPremiumClass} ${styles.selectPremium}`}
                  >
                    <option value="AR">Argentina</option>
                    <option value="UY">Uruguay</option>
                    <option value="CL">Chile</option>
                    <option value="BR">Brasil</option>
                    <option value="MX">México</option>
                    <option value="CO">Colombia</option>
                    <option value="PE">Perú</option>
                  </select>
                  {fieldErrors.country && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.country[0]}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="org-state" className={labelBaseClass}>
                    {currentRegion.stateLabel}
                  </label>
                  <input
                    type="text"
                    id="org-state"
                    value={formData.state}
                    onChange={(e) => handleFieldChange("state", e.target.value)}
                    placeholder={`Ej. ${currentRegion.stateLabel}`}
                    className={inputPremiumClass}
                  />
                  {fieldErrors.state && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.state[0]}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="org-city" className={labelBaseClass}>
                    Ciudad
                  </label>
                  <input
                    type="text"
                    id="org-city"
                    value={formData.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="Ej. Palermo"
                    className={inputPremiumClass}
                  />
                  {fieldErrors.city && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.city[0]}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="org-zip" className={labelBaseClass}>
                    {currentRegion.zipLabel}
                  </label>
                  <input
                    type="text"
                    id="org-zip"
                    value={formData.zip}
                    onChange={(e) => handleFieldChange("zip", e.target.value)}
                    placeholder="Ej. C1414"
                    className={inputPremiumClass}
                  />
                  {fieldErrors.zip && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.zip[0]}</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="org-address" className={labelBaseClass}>
                  Dirección exacta
                </label>
                <input
                  type="text"
                  id="org-address"
                  value={formData.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  placeholder="Calle, número, piso, depto..."
                  className={inputPremiumClass}
                />
                {fieldErrors.address && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.address[0]}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <hr className="border-[#E4E9E7]/60" />

        {/* SECCIÓN 3: Preferencias */}
        <section className="flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="w-full shrink-0 pt-2 md:w-1/3">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-[#7ED6A5]/20 bg-[#DDF6E8] text-[#7ED6A5] shadow-xs">
              <SlidersHorizontal size={20} />
            </div>
            <h3 className="mb-1 text-base font-bold text-[#182026]">
              Preferencias
            </h3>
            <p className="text-sm text-[#667078]">
              Ajustes regionales utilizados para reportes y facturación.
            </p>
          </div>

          <div className="w-full rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-sm sm:p-8 md:w-2/3">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="org-timezone" className={labelBaseClass}>
                  Zona horaria
                </label>
                <select
                  ref={flashTzRef}
                  id="org-timezone"
                  value={formData.timezone}
                  onChange={(e) => handleFieldChange("timezone", e.target.value)}
                  className={`${inputPremiumClass} ${styles.selectPremium} ${
                    flashTz ? styles.flashActive : ""
                  }`}
                >
                  {Object.entries(currentRegion.timezones).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                {fieldErrors.timezone && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.timezone[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="org-currency" className={labelBaseClass}>
                  Moneda principal
                </label>
                <input
                  ref={flashCurrRef}
                  type="text"
                  id="org-currency"
                  readOnly
                  tabIndex={-1}
                  value={currentRegion.currencyDisplay}
                  className={`${inputReadonlyClass} ${
                    flashCurr ? styles.flashActive : ""
                  }`}
                />
                {fieldErrors.currency && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.currency[0]}</p>
                )}
                <p className="mt-2 text-[11px] font-medium text-[#667078]">
                  La moneda se establece automáticamente según el país de tu negocio.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: Enlace público (Slug) */}
        <section className="mt-8 flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="w-full shrink-0 pt-2 md:w-1/3">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-[#E4E9E7] bg-white text-[#667078] shadow-xs">
              <LinkIcon size={20} />
            </div>
            <h3 className="mb-1 text-base font-bold text-[#182026]">
              Enlace público
            </h3>
            <p className="text-sm text-[#667078]">
              El identificador único de tu agenda y catálogo online.
            </p>
          </div>

          <div
            className={`relative w-full overflow-hidden rounded-[1.5rem] border bg-white p-6 shadow-sm transition-colors duration-300 sm:p-8 md:w-2/3 ${
              slugChanged
                ? "border-orange-200 bg-orange-50/20"
                : "border-[#E4E9E7]"
            }`}
          >
            <div className="relative z-10">
              <label htmlFor="org-slug" className={labelBaseClass}>
                Identificador (Slug)
              </label>
              <p className="mb-3 text-xs text-[#667078]">
                Solo podés usar minúsculas, números y guiones.
              </p>

              <div
                className={`group flex items-stretch overflow-hidden rounded-xl border bg-[#F8FAF9]/50 shadow-sm transition-all focus-within:ring-[3px] hover:border-[#667078]/40 ${
                  slugChanged
                    ? "border-orange-300 focus-within:border-orange-500 focus-within:ring-orange-500/20"
                    : "border-[#E4E9E7] focus-within:border-[#182026] focus-within:ring-[#182026]/10"
                }`}
              >
                <div className="flex items-center border-r border-[#E4E9E7]/80 bg-white/50 px-4 py-3 text-sm font-medium text-[#667078]">
                  nuari.app/
                </div>
                <input
                  type="text"
                  id="org-slug"
                  disabled={!isOwner}
                  value={formData.slug}
                  onChange={(e) =>
                    handleFieldChange(
                      "slug",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  placeholder="tu-negocio"
                  className={`w-full bg-transparent px-4 py-3 text-sm font-bold text-[#182026] placeholder-[#667078]/50 focus:outline-none ${
                    !isOwner ? "cursor-not-allowed opacity-60" : ""
                  }`}
                />
              </div>
              {fieldErrors.slug && (
                <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.slug[0]}</p>
              )}
              {!isOwner ? (
                <p className="mt-2 text-xs text-[#667078]">
                  Solo el propietario (OWNER) puede modificar el enlace permanente del negocio.
                </p>
              ) : null}


              {/* Alerta de cambio de slug */}
              {slugChanged ? (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold">
                    <WarningCircle size={18} weight="fill" className="text-orange-500" />
                    Atención
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-orange-700/90">
                    Estás modificando el enlace de tu negocio. Si guardás este cambio,
                    todos los enlaces anteriores a tu agenda dejarán de funcionar y tus
                    clientes podrían no encontrarte.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Floating Action Bar (Barra flotante de cambios sin guardar) */}
      <div
        className={`${styles.actionBar} ${
          isDirty ? styles.actionBarVisible : ""
        } fixed bottom-6 left-1/2 z-40 flex w-[90%] max-w-[500px] items-center justify-between gap-6 rounded-2xl border border-white/20 bg-[#182026] px-5 py-3.5 text-white shadow-2xl backdrop-blur-md`}
      >
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-[#FFB86B] animate-pulse" />
          <span className="text-sm font-semibold">Cambios sin guardar</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveClick}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-[#182026] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F8FAF9]"
          >
            {isSaving ? (
              <div className={styles.spinner} />
            ) : (
              <span>Guardar</span>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles.toastVisible} pointer-events-auto flex min-w-[300px] items-center gap-3 rounded-xl bg-[#182026] px-4 py-3 text-white shadow-xl`}
          >
            {toast.type === "success" ? (
              <CheckCircle size={20} weight="fill" className="text-[#7ED6A5]" />
            ) : (
              <WarningCircle size={20} weight="fill" className="text-red-400" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de confirmación para cambio de Slug */}
      <div
        className={`${styles.modalOverlay} ${
          showModal ? styles.modalOverlayActive : ""
        } fixed inset-0 z-50 flex items-center justify-center p-4`}
      >
        <div
          className="absolute inset-0 bg-[#182026]/60 backdrop-blur-xs transition-opacity"
          onClick={() => setShowModal(false)}
        />
        <div
          className={`${styles.modalContent} ${
            showModal ? styles.modalContentActive : ""
          } relative flex w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-[#E4E9E7] bg-white shadow-2xl`}
        >
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-500 shadow-xs">
              <Warning size={28} />
            </div>
            <h3 className="mb-2 text-xl font-bold text-[#182026]">
              ¿Cambiar enlace público?
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-[#667078]">
              Estás a punto de cambiar el identificador de{" "}
              <strong className="rounded border border-[#E4E9E7] bg-[#F8FAF9] px-1 text-[#182026]">
                {initialData.slug}
              </strong>{" "}
              a{" "}
              <strong className="rounded border border-[#E4E9E7] bg-[#F8FAF9] px-1 text-[#182026]">
                {formData.slug}
              </strong>
              .
            </p>
            <div className="rounded-lg border border-[#E4E9E7] bg-[#F8FAF9] p-3">
              <p className="text-xs font-medium text-[#667078]">
                <Info size={14} weight="fill" className="mr-1 inline text-[#182026]" />
                Cualquier cliente con el enlace anterior ya no podrá acceder a tu agenda
                actual. Deberás compartirles el nuevo enlace.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-3 border-t border-[#E4E9E7] bg-[#F8FAF9]/50 px-6 py-5 sm:flex-row sm:px-8">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full rounded-xl border border-[#E4E9E7] bg-white px-5 py-2.5 text-sm font-semibold text-[#182026] shadow-xs transition-colors hover:bg-[#F8FAF9] sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executeSave}
              className="w-full rounded-xl border border-transparent bg-[#182026] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#2A3742] sm:w-auto"
            >
              Sí, cambiar enlace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
