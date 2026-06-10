type PeriodPoint = { label: string; revenue: number; profit: number; cost: number };
type TopProduct = { name: string; quantity: number };
type BrandSale = { brandName: string; revenue: number; count: bigint };

type AnalyticsData = {
  dailyData: PeriodPoint[];
  weeklyData: PeriodPoint[];
  monthlyData: PeriodPoint[];
  topProducts: TopProduct[];
  brandSales: BrandSale[];
};

export function AnalyticsCharts({ data: _ }: { data: AnalyticsData }) {
  return null;
}
