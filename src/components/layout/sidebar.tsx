"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  MessageCircle,
  Send,
  LogOut,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  RefreshCcw,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "OWNER", "SELLER"],
  },
  {
    label: "Stock",
    href: "/stock",
    icon: Package,
    roles: ["ADMIN", "OWNER", "SELLER"],
  },
  {
    label: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    roles: ["ADMIN", "OWNER", "SELLER"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["ADMIN", "OWNER"],
  },
  {
    label: "Performance",
    href: "/analytics/performance",
    icon: TrendingUp,
    roles: ["ADMIN", "OWNER"],
  },
  {
    label: "Reorder",
    href: "/stock/reorder",
    icon: RefreshCcw,
    roles: ["ADMIN", "OWNER"],
  },
  {
    label: "Valuation",
    href: "/stock/valuation",
    icon: Layers,
    roles: ["ADMIN", "OWNER"],
  },
  {
    label: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircle,
    roles: ["ADMIN", "OWNER"],
  },
  {
    label: "Telegram",
    href: "/telegram",
    icon: Send,
    roles: ["ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["ADMIN", "OWNER", "SELLER"],
  },
];

type Props = {
  role: Role;
  name: string;
};

export function Sidebar({ role, name }: Props) {
  const pathname = usePathname();
  const items = navItems.filter((item) => item.roles.includes(role));

  const roleLabel =
    role === "ADMIN" ? "Admin" : role === "OWNER" ? "Owner" : "Seller";
  const roleBadgeColor =
    role === "ADMIN"
      ? "bg-purple-500/20 text-purple-300 ring-purple-500/30"
      : role === "OWNER"
        ? "bg-blue-500/20 text-blue-300 ring-blue-500/30"
        : "bg-green-500/20 text-green-300 ring-green-500/30";

  return (
    <aside className="flex flex-col h-full w-60 bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-white leading-tight">HM Stocks</p>
          <p className="text-xs text-slate-300">Parts Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 flex-shrink-0",
                  isActive
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="h-3.5 w-3.5 text-blue-200" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300 uppercase">
            {name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{name}</p>
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded-full ring-1",
                roleBadgeColor
              )}
            >
              {roleLabel}
            </span>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
