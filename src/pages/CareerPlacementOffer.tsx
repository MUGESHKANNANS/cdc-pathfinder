import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter } from 'lucide-react';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No', 'Dept', 'Total', 'PI', 'No Of Student Placed', 'Balance', 'Batch', 'OverAll Percentage', 'Package'
];

const TEMPLATE_HEADERS = REQUIRED_COLUMNS;

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerPlacementOffer: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [placed, setPlaced] = useState<string>('all'); // all | placed | not

  if (!profile || (profile.role !== 'cdc_director' && profile.role !== 'faculty')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only CDC Director and Faculty can access this page.</p>
      </div>
    );
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'career_placement_offer_template.xlsx');
  };

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }

      let data: RowData[] = [];
      let fileHeaders: string[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const parsed = result.data as RowData[];
        data = parsed.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(json[0] || {}).map(normalize);
      }

      const missing = REQUIRED_COLUMNS.filter(col => !fileHeaders.includes(col));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${missing.join(', ')}`, variant: 'destructive' });
        return;
      }

      setRows(data);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    const placedKey = 'No Of Student Placed';
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const isPlaced = toNumber(r[placedKey]) > 0;
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? isPlaced : !isPlaced;
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesPlaced;
    });
  }, [rows, search, dept, batch, pi, placed]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);

  // Aggregations for charts
  const metrics = useMemo(() => {
    const totalPlaced = filtered.reduce((s, r) => s + toNumber(r['No Of Student Placed']), 0);
    const totalStudents = filtered.reduce((s, r) => s + toNumber(r['Total']), 0);
    const totalBalance = filtered.reduce((s, r) => s + toNumber(r['Balance']), 0);

    // Dept groups
    const deptMap = new Map<string, { total: number; placed: number; balance: number; percentSum: number; count: number; pkg: number[] }>();
    filtered.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const row = deptMap.get(d) || { total: 0, placed: 0, balance: 0, percentSum: 0, count: 0, pkg: [] };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.balance += toNumber(r['Balance']);
      row.percentSum += toNumber(r['OverAll Percentage']);
      const pkgVal = toNumber(r['Package']); if (Number.isFinite(pkgVal)) row.pkg.push(pkgVal);
      row.count += 1;
      deptMap.set(d, row);
    });

    const deptTotals = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, total: v.total }));
    const deptPlaced = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, placed: v.placed }));
    const deptPercentage = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));
    const deptOverallPercent = deptPercentage; // alias for clarity
    const deptBalanceStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, placed: v.placed, balance: v.balance }));
    const avgPackageByDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, avg: v.pkg.length ? Math.round(v.pkg.reduce((a,b)=>a+b,0)/v.pkg.length) : 0 }));

    // Top 5 packages overall
    const top5Packages = [...filtered]
      .map(r => ({ dept: String(r['Dept'] || 'NA'), pkg: toNumber(r['Package']) }))
      .sort((a,b)=>b.pkg-a.pkg)
      .slice(0,5)
      .map((x, idx) => ({ rank: `#${idx+1}`, dept: x.dept, pkg: x.pkg }));

    // Batch aggregations
    const batchMap = new Map<string, { total: number; placed: number; percentSum: number; count: number; pkgSum: number; pkgCount: number }>();
    filtered.forEach(r => {
      const b = String(r['Batch'] || 'NA');
      const row = batchMap.get(b) || { total: 0, placed: 0, percentSum: 0, count: 0, pkgSum: 0, pkgCount: 0 };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.percentSum += toNumber(r['OverAll Percentage']);
      const pkgVal = toNumber(r['Package']); if (Number.isFinite(pkgVal)) { row.pkgSum += pkgVal; row.pkgCount++; }
      row.count += 1;
      batchMap.set(b, row);
    });
    const batchStrength = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, value: v.total }));
    const batchStacked = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, total: v.total, placed: v.placed }));
    const batchPercentTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));
    const batchAvgPackageTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, avgPackage: v.pkgCount ? Math.round(v.pkgSum / v.pkgCount) : 0 }));

    // PI-wise placement performance
    const piMap = new Map<string, number>();
    filtered.forEach(r => { const p = String(r['PI'] || 'NA'); piMap.set(p, (piMap.get(p)||0) + toNumber(r['No Of Student Placed'])); });
    const piPlacement = Array.from(piMap.entries()).map(([pi, value]) => ({ pi, value }));

    // Scatter Dept vs Package (use row index as x; hover shows dept)
    const deptVsPackage = filtered.map((r, idx) => ({ x: idx+1, y: toNumber(r['Package']), dept: String(r['Dept'] || 'NA') }));

    return {
      totalPlaced, totalStudents, totalBalance,
      deptTotals, deptPlaced, deptPercentage, deptOverallPercent, deptBalanceStack,
      avgPackageByDept, top5Packages,
      batchStrength, batchStacked, batchPercentTrend, batchAvgPackageTrend,
      piPlacement, deptVsPackage
    };
  }, [filtered]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_placement_offer_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - Placement Offer (Filtered)', margin, y); y += 20;
    doc.setFontSize(9);
    const cols = REQUIRED_COLUMNS;
    let x = margin;
    cols.forEach(h => { doc.text(String(h), x, y); x += 80; }); y += 14;
    doc.setLineWidth(0.5); doc.line(margin, y, 555, y); y += 8;
    filtered.slice(0, 60).forEach(r => {
      let cx = margin;
      cols.forEach(h => { const txt = String(r[h] ?? ''); doc.text(txt.length > 14 ? txt.slice(0, 14) + '…' : txt, cx, y); cx += 80; });
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });
    doc.save('career_placement_offer_filtered.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Placement Offer</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze placement offers</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f);} } />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search any text" className="pl-10 h-10 border border-indigo-300" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dept</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {departments.map(d => (<SelectItem key={d} value={String(d)}>{String(d)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batch</Label>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {batches.map(b => (<SelectItem key={b} value={String(b)}>{String(b)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PI</Label>
            <Select value={pi} onValueChange={setPi}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {pis.map(p => (<SelectItem key={p} value={String(p)}>{String(p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Placed</Label>
            <Select value={placed} onValueChange={setPlaced}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="not">Not Placed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={exportFilteredToExcel}>Export Excel</Button>
            <Button variant="outline" onClick={exportFilteredToPdf}>Export PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data ({filtered.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {REQUIRED_COLUMNS.map(h => (
                      <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 400).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      {REQUIRED_COLUMNS.map(h => (
                        <td key={h} className="p-2 whitespace-nowrap">{String(r[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Showing first 400 rows.</p>
          </CardContent>
        </Card>
      )}

      {/* Charts (15) */}
      {filtered.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle>Dept-wise Totals and Placed</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Dept-wise Total Students</p>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptPlaced}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="placed" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Dept-wise Students Placed</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Placement Percentage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={metrics.deptPercentage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="dept" width={100} />
                  <Tooltip />
                  <Bar dataKey="percentage" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Strength and Placement</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.batchStrength} cx="50%" cy="50%" outerRadius={90} label>
                      {metrics.batchStrength.map((_, idx) => (<Cell key={`b-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Batch-wise Student Strength</p>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.batchStacked}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="placed" stackId="a" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Batch vs Placement Count</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>PI-wise Placement Performance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.piPlacement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Percentage Across Batches</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.batchPercentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placed vs Balance Students</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed', value: metrics.totalPlaced }, { name: 'Balance', value: metrics.totalBalance }]} cx="50%" cy="50%" innerRadius={50} outerRadius={90} label>
                    {[0,1].map((_, idx) => (<Cell key={`p-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise OverAll Percentage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.deptOverallPercent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="percentage" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept vs Package Comparison (Scatter)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="x" name="#" />
                  <YAxis type="number" dataKey="y" name="Package" />
                  <ZAxis range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={metrics.deptVsPackage} fill="#06b6d4" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Average Package by Dept</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.avgPackageByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Highest Packages</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.top5Packages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rank" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="pkg" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Bars annotated by rank; hover to see dept</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Balance by Dept</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.deptBalanceStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" stackId="a" fill="#10b981" />
                  <Bar dataKey="balance" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Placement Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const percentPlaced = metrics.totalStudents ? Math.round((metrics.totalPlaced / metrics.totalStudents) * 100) : 0;
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="value" data={[{ name: 'Placed %', value: percentPlaced }, { name: 'Remaining', value: 100 - percentPlaced }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                        {[0,1].map((_, idx) => (<Cell key={`g-${idx}`} fill={idx===0 ? '#10b981' : '#e5e7eb'} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch vs Average Package Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.batchAvgPackageTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgPackage" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerPlacementOffer;


