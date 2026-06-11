"use client";

import { useActionState, useRef, useState } from "react";
import { importStockCSV, type ImportResult } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, Download } from "lucide-react";
import Link from "next/link";

const TEMPLATE_ROWS = [
  "brand,model,category,name,grade,cost_price,selling_price,qty,threshold",
  "Samsung,Galaxy S21,Display,LCD Display,ORIGINAL,12000,18000,10,3",
  "iPhone,iPhone 13,Battery,Battery 3227mAh,ORIGINAL,8500,13000,5,2",
  "Redmi,Note 10,Display,AMOLED Display,COPY_A,3500,6000,8,3",
].join("\n");

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_ROWS], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stock-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const [result, formAction, pending] = useActionState<ImportResult | undefined, FormData>(
    importStockCSV,
    undefined
  );
  const [filename, setFilename] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const success = result && !("error" in result);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Bulk Stock Import</h1>
          <p className="text-slate-400 text-sm mt-0.5">Upload a CSV to add multiple products at once</p>
        </div>
        <Link href="/stock" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Back to Stock
        </Link>
      </div>

      {/* Template download */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">CSV Format</p>
        <div className="overflow-x-auto">
          <table className="text-xs text-slate-300 w-full">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                {["brand*", "model", "category*", "name*", "grade", "cost_price*", "selling_price*", "qty", "threshold"].map((h) => (
                  <th key={h} className="text-left py-1.5 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-400">
                <td className="py-1.5 pr-4">Samsung</td>
                <td className="py-1.5 pr-4">Galaxy S21</td>
                <td className="py-1.5 pr-4">Display</td>
                <td className="py-1.5 pr-4">LCD Display</td>
                <td className="py-1.5 pr-4">ORIGINAL</td>
                <td className="py-1.5 pr-4">12000</td>
                <td className="py-1.5 pr-4">18000</td>
                <td className="py-1.5 pr-4">10</td>
                <td className="py-1.5 pr-4">3</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Grades: <span className="text-slate-300">ORIGINAL · COPY_A · COPY_B · OTHER</span>
          &nbsp;· Fields marked <span className="text-red-400">*</span> are required
          &nbsp;· Brand/model/category auto-created if not found
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="h-9 border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Upload form */}
      <form action={formAction} className="space-y-4">
        <input
          ref={fileRef}
          name="csv"
          type="file"
          accept=".csv"
          className="sr-only"
          id="csv-input"
          onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
        />
        <label
          htmlFor="csv-input"
          className={`flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-colors
            ${filename ? "border-blue-600 bg-blue-950/20" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
        >
          <FileSpreadsheet className={`h-9 w-9 mb-2 ${filename ? "text-blue-400" : "text-slate-500"}`} />
          {filename ? (
            <>
              <span className="text-sm font-medium text-blue-300">{filename}</span>
              <span className="text-xs text-slate-400 mt-1">Tap to change file</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-slate-400">Tap to choose CSV file</span>
              <span className="text-xs text-slate-500 mt-1">Only .csv files accepted</span>
            </>
          )}
        </label>

        {result && "error" in result && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
            {result.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending || !filename}
          className="w-full h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl font-semibold text-base"
        >
          <Upload className="h-5 w-5 mr-2" />
          {pending ? "Importing…" : "Import Products"}
        </Button>
      </form>

      {/* Results */}
      {success && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-white font-semibold">Import complete</p>
              <p className="text-slate-400 text-sm">
                {result.created} of {result.total} products created
                {result.errors.length > 0 && ` · ${result.errors.length} errors`}
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Errors</p>
              {result.errors.map((e) => (
                <div key={e.row} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">
                    Row {e.row}: <span className="text-red-300">{e.error}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/stock"
            className="inline-flex items-center h-10 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            View Stock →
          </Link>
        </div>
      )}
    </div>
  );
}
