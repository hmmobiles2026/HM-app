import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  brandName: string;
  modelName: string | null;
};

export function LowStockAlert({ products }: { products: Product[] }) {
  return (
    <Card className="bg-slate-900 border-slate-800 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Low Stock Alerts
          </CardTitle>
          <Link
            href="/stock?filter=low"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-slate-300 text-sm">All stock levels are good</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/stock/${p.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate group-hover:text-blue-300">
                    {p.brandName} {p.modelName ? `${p.modelName} ` : ""}{p.name}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Min: {p.lowStockThreshold} units
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    p.stockQty === 0
                      ? "border-red-800 bg-red-950 text-red-400"
                      : "border-amber-800 bg-amber-950 text-amber-400"
                  }
                >
                  {p.stockQty} left
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
