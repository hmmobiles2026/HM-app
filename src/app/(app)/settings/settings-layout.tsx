"use client";

import { useState } from "react";
import {
  Tag, Smartphone, Layers, LayoutGrid, Truck,
  Users, HardDrive, ShieldCheck, Lock, LifeBuoy,
  ChevronRight, ArrowLeft,
} from "lucide-react";

import { BrandSettings } from "./brand-settings";
import { ModelSettings } from "./model-settings";
import { PartBrandSettings } from "./part-brand-settings";
import { CategorySettings } from "./category-settings";
import { SupplierSettings } from "./supplier-settings";
import { UserSettings } from "./user-settings";
import { BackupSettings } from "./backup-settings";
import { LicenseSettings } from "./license-settings";
import { PasswordSettings } from "./password-settings";
import { SupportSettings } from "./support-settings";

import type { ComponentProps } from "react";
import type { LicenseStatus } from "@/lib/license";

type Brand = { id: string; name: string; deletedAt: Date | null; models: { id: string; name: string; deletedAt: Date | null }[] };
type Category = { id: string; name: string; partBrands: { id: string; name: string; categoryId: string; deletedAt: Date | null; createdAt: Date }[] };
type Supplier = { id: string; name: string; phone: string | null; note: string | null };
type UsersType = ComponentProps<typeof UserSettings>["users"];

type Props = {
  brands: Brand[];
  deletedBrands: Brand[];
  categories: Category[];
  suppliers: Supplier[];
  users: UsersType;
  licenseStatus: LicenseStatus | null;
  isAdmin: boolean;
  isAdminOrOwner: boolean;
};

type SectionId =
  | "brands" | "models" | "partbrands" | "categories" | "suppliers"
  | "users" | "backup" | "license" | "password" | "support";

type NavItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  adminOnly?: boolean;
  ownerOrAdmin?: boolean;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Catalog",
    items: [
      { id: "brands",     label: "Brands",      description: "Phone brands & trash",   icon: Tag,        iconColor: "text-blue-400",   ownerOrAdmin: true },
      { id: "models",     label: "Models",       description: "Models per brand",        icon: Smartphone, iconColor: "text-sky-400",    ownerOrAdmin: true },
      { id: "partbrands", label: "Part Brands",  description: "Part quality brands",     icon: Layers,     iconColor: "text-violet-400", ownerOrAdmin: true },
      { id: "categories", label: "Categories",   description: "Part categories",         icon: LayoutGrid, iconColor: "text-amber-400",  ownerOrAdmin: true },
      { id: "suppliers",  label: "Suppliers",    description: "Your stock suppliers",    icon: Truck,      iconColor: "text-emerald-400",ownerOrAdmin: true },
    ],
  },
  {
    group: "System",
    items: [
      { id: "backup",   label: "Backup",   description: "Export & Telegram backup", icon: HardDrive,   iconColor: "text-cyan-400",   ownerOrAdmin: true },
      { id: "license",  label: "License",  description: "App license status",       icon: ShieldCheck, iconColor: "text-green-400",  ownerOrAdmin: true },
      { id: "users",    label: "Users",    description: "Manage staff accounts",    icon: Users,       iconColor: "text-rose-400",   adminOnly: true },
    ],
  },
  {
    group: "Account",
    items: [
      { id: "password", label: "Password", description: "Change your password",     icon: Lock,     iconColor: "text-orange-400" },
      { id: "support",  label: "Support",  description: "Help & contact",           icon: LifeBuoy, iconColor: "text-slate-400"  },
    ],
  },
];

const SECTION_TITLES: Record<SectionId, string> = {
  brands: "Brands", models: "Models", partbrands: "Part Brands",
  categories: "Categories", suppliers: "Suppliers", users: "Users",
  backup: "Backup", license: "License", password: "Password", support: "Support",
};

export function SettingsLayout({
  brands, deletedBrands, categories, suppliers, users,
  licenseStatus, isAdmin, isAdminOrOwner,
}: Props) {
  const [active, setActive] = useState<SectionId | null>(null);

  function visibleGroups() {
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.adminOnly) return isAdmin;
        if (item.ownerOrAdmin) return isAdminOrOwner;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }

  function renderContent(id: SectionId) {
    switch (id) {
      case "brands":     return <BrandSettings brands={brands} deletedBrands={deletedBrands} isAdmin={isAdminOrOwner} />;
      case "models":     return <ModelSettings brands={brands} isAdmin={isAdminOrOwner} />;
      case "partbrands": return <PartBrandSettings categories={categories} isAdmin={isAdminOrOwner} />;
      case "categories": return <CategorySettings categories={categories} isAdmin={isAdminOrOwner} />;
      case "suppliers":  return <SupplierSettings suppliers={suppliers} isAdmin={isAdminOrOwner} />;
      case "users":      return <UserSettings users={users} />;
      case "backup":     return <BackupSettings />;
      case "license":    return licenseStatus ? <LicenseSettings status={licenseStatus} isAdmin={isAdmin} /> : null;
      case "password":   return <PasswordSettings />;
      case "support":    return <SupportSettings />;
    }
  }

  const groups = visibleGroups();

  // ── Nav list (shared by mobile header and desktop sidebar) ──────────────
  const NavList = () => (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-1 mb-1">
            {g.group}
          </p>
          <div className="rounded-xl overflow-hidden border border-slate-800 divide-y divide-slate-800">
            {g.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    isActive
                      ? "bg-blue-600/15 border-l-2 border-blue-500"
                      : "bg-slate-900 hover:bg-slate-800/70"
                  }`}
                >
                  <span className={`p-1.5 rounded-lg bg-slate-800 shrink-0 ${item.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isActive ? "text-blue-300" : "text-white"}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{item.description}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400" : "text-slate-600"}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ── Desktop: sidebar + content ─────────────────────────────────────── */}
      <div className="hidden md:flex gap-6 items-start">
        <aside className="w-64 shrink-0 sticky top-4">
          <NavList />
        </aside>
        <div className="flex-1 min-w-0">
          {active ? (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">{SECTION_TITLES[active]}</h2>
              {renderContent(active)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
              <ShieldCheck className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Select a section from the left</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: drill-down ──────────────────────────────────────────────── */}
      <div className="md:hidden">
        {active ? (
          <div>
            <button
              onClick={() => setActive(null)}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Settings
            </button>
            <h2 className="text-base font-bold text-white mb-3">{SECTION_TITLES[active]}</h2>
            {renderContent(active)}
          </div>
        ) : (
          <NavList />
        )}
      </div>
    </>
  );
}
