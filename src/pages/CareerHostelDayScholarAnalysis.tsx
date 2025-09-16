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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter } from 'lucide-react';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No','Dept','Total','PI','Total Hostl','PI Hostl','Placed Hostl','Placed Days','Hostl Placed %','Days Placed %','Total %','Hosteller/Day Scholar'
];
const OPTIONAL_COLUMNS = ['Batch','Incharge','Package'];
const TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerHostelDayScholarAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [hostelType, setHostelType] = useState<string>('all'); // Hosteller | Day Scholar
  const [placed, setPlaced] = useState<string>('all');

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
    XLSX.writeFile(wb, 'career_hostel_day_scholar_template.xlsx');
  };

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }
      let data: RowData[] = [];
      let headers: string[] = [];
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const parsed = result.data as RowData[];
        data = parsed.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        headers = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        headers = Object.keys(json[0] || {}).map(normalize);
      }
      const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
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
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const matchesIncharge = incharge === 'all' ? true : String(r['Incharge']) === incharge;
      const typeVal = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      const matchesType = hostelType === 'all' ? true : hostelType === 'Hosteller' ? typeVal.includes('hostel') : typeVal.includes('day');
      const placedSum = toNumber(r['Placed Hostl']) + toNumber(r['Placed Days']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedSum > 0 : placedSum === 0;
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesType && matchesPlaced;
    });
  }, [rows, search, dept, batch, pi, incharge, hostelType, placed]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const incharges = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);

  const metrics = useMemo(() => {
    // Dept aggregates
    const deptMap = new Map<string, { hostl: number; days: number; placedHostl: number; placedDays: number; pctHostl: number; pctDays: number; count: number; pkgHostl: number[]; pkgDays: number[] }>();
    filtered.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const cur = deptMap.get(d) || { hostl: 0, days: 0, placedHostl: 0, placedDays: 0, pctHostl: 0, pctDays: 0, count: 0, pkgHostl: [], pkgDays: [] };
      cur.hostl += toNumber(r['Total Hostl']);
      cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl']));
      cur.placedHostl += toNumber(r['Placed Hostl']);
      cur.placedDays += toNumber(r['Placed Days']);
      cur.pctHostl += toNumber(r['Hostl Placed %']);
      cur.pctDays += toNumber(r['Days Placed %']);
      const pkg = toNumber(r['Package']);
      const typeVal = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      if (typeVal.includes('hostel')) cur.pkgHostl.push(pkg); else if (typeVal.includes('day')) cur.pkgDays.push(pkg);
      cur.count += 1; deptMap.set(d, cur);
    });

    const deptStrength = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.hostl, days: v.days }));
    const deptPlacedStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.placedHostl, days: v.placedDays }));
    const deptPctBars = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostlPct: v.count? Math.round(v.pctHostl/v.count):0, daysPct: v.count? Math.round(v.pctDays/v.count):0 }));
    const avgPkgByDeptType = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.pkgHostl.length? Math.round(v.pkgHostl.reduce((a,b)=>a+b,0)/v.pkgHostl.length):0, days: v.pkgDays.length? Math.round(v.pkgDays.reduce((a,b)=>a+b,0)/v.pkgDays.length):0 }));

    // Overall totals
    const totalHostl = deptStrength.reduce((s,d)=>s+d.hostl,0);
    const totalDays = deptStrength.reduce((s,d)=>s+d.days,0);
    const placedHostl = deptPlacedStack.reduce((s,d)=>s+d.hostl,0);
    const placedDays = deptPlacedStack.reduce((s,d)=>s+d.days,0);
    const overallRatio = [ { name: 'Hosteller', value: totalHostl }, { name: 'Day Scholar', value: totalDays } ];
    const totalVsPlacedByType = [ { type: 'Hosteller', total: totalHostl, placed: placedHostl }, { type: 'Day Scholar', total: totalDays, placed: placedDays } ];

    // PI-wise ratio
    const piMap = new Map<string, { hostl: number; days: number }>();
    filtered.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { hostl: 0, days: 0 }; cur.hostl += toNumber(r['Total Hostl']); cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl'])); piMap.set(p, cur); });
    const piRatio = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, hostl: v.hostl, days: v.days }));

    // Batch distribution and growth trend
    const batchMap = new Map<string, { hostl: number; days: number; placedHostl: number; placedDays: number }>();
    filtered.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { hostl: 0, days: 0, placedHostl: 0, placedDays: 0 }; cur.hostl += toNumber(r['Total Hostl']); cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl'])); cur.placedHostl += toNumber(r['Placed Hostl']); cur.placedDays += toNumber(r['Placed Days']); batchMap.set(b, cur); });
    const batchDist = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, hostl: v.hostl, days: v.days }));
    const growthTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, hostl: v.placedHostl, days: v.placedDays }));

    // Top 5 depts by placement percent
    const topHostlPct = [...deptPctBars].sort((a,b)=>b.hostlPct - a.hostlPct).slice(0,5).map(x=>({ dept: x.dept, value: x.hostlPct }));
    const topDaysPct = [...deptPctBars].sort((a,b)=>b.daysPct - a.daysPct).slice(0,5).map(x=>({ dept: x.dept, value: x.daysPct }));

    // Avg package by type (overall)
    const overallPkg = filtered.reduce((acc, r) => {
      const pkg = toNumber(r['Package']);
      const t = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      if (t.includes('hostel')) acc.hostl.push(pkg); else if (t.includes('day')) acc.days.push(pkg);
      return acc;
    }, { hostl: [] as number[], days: [] as number[] });
    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s,x)=>s+x,0)/a.length) : 0;
    const avgPkgByType = [ { type: 'Hosteller', avg: avg(overallPkg.hostl) }, { type: 'Day Scholar', avg: avg(overallPkg.days) } ];

    // Overall summary gauge
    const overallTotal = totalHostl + totalDays;
    const overallPlaced = placedHostl + placedDays;
    const overallPct = overallTotal ? Math.round((overallPlaced / overallTotal) * 100) : 0;

    // Heatmap like data: dept vs type percentages
    const heatMatrix = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostlPct: v.count? Math.round(v.pctHostl/v.count):0, daysPct: v.count? Math.round(v.pctDays/v.count):0 }));

    return { deptStrength, deptPlacedStack, deptPctBars, overallRatio, totalVsPlacedByType, piRatio, batchDist, growthTrend, topHostlPct, topDaysPct, avgPkgByType, avgPkgByDeptType, overallPct, heatMatrix };
  }, [filtered]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_hostel_day_scholar_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - Hostel/Day Scholar Analysis (Filtered)', margin, y); y += 20;
    doc.setFontSize(9);
    const cols = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
    let x = margin;
    cols.forEach(h => { doc.text(String(h), x, y); x += 80; }); y += 14;
    doc.setLineWidth(0.5); doc.line(margin, y, 555, y); y += 8;
    filtered.slice(0, 60).forEach(r => {
      let cx = margin;
      cols.forEach(h => { const txt = String(r[h] ?? ''); doc.text(txt.length > 14 ? txt.slice(0, 14) + '…' : txt, cx, y); cx += 80; });
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });
    doc.save('career_hostel_day_scholar_filtered.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Hostel/Day Scholar Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze hostel vs day scholar</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f);} } />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-7 gap-4">
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
          <div className="space-y-2">
            <Label>Incharge</Label>
            <Select value={incharge} onValueChange={setIncharge}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {incharges.map(i => (<SelectItem key={i} value={String(i)}>{String(i)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hosteller/Day Scholar</Label>
            <Select value={hostelType} onValueChange={setHostelType}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Hosteller">Hosteller</SelectItem>
                <SelectItem value="Day Scholar">Day Scholar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
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
                    {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(h => (
                      <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 400).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(h => (
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

      {filtered.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle>Dept-wise Hostel vs Day Scholar Strength</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptStrength}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hostl" fill="#3b82f6" />
                  <Bar dataKey="days" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Placed Hostel vs Placed Day Scholar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptPlacedStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hostl" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="days" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hostel vs Day Scholar Placement Percentage</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie dataKey="value" data={[{ name: 'Hosteller %', value: metrics.totalVsPlacedByType[0] ? Math.round((metrics.totalVsPlacedByType[0].placed/(metrics.totalVsPlacedByType[0].total||1))*100) : 0 }, { name: 'Day Scholar %', value: metrics.totalVsPlacedByType[1] ? Math.round((metrics.totalVsPlacedByType[1].placed/(metrics.totalVsPlacedByType[1].total||1))*100) : 0 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {[0,1].map((_,idx)=>(<Cell key={idx} fill={idx===0?'#3b82f6':'#ef4444'} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie dataKey="value" data={[{ name: 'Hosteller', value: metrics.totalVsPlacedByType[0]?.total || 0 }, { name: 'Day Scholar', value: metrics.totalVsPlacedByType[1]?.total || 0 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {[0,1].map((_,idx)=>(<Cell key={idx} fill={idx===0?'#3b82f6':'#ef4444'} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Hostel vs Day Scholar Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.batchDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hostl" fill="#3b82f6" />
                  <Bar dataKey="days" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>PI vs Hostel/Day Scholar Ratio</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.piRatio}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hostl" fill="#3b82f6" />
                  <Bar dataKey="days" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Hostel% vs Day Scholar%</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptPctBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="hostlPct" fill="#3b82f6" />
                  <Bar dataKey="daysPct" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Students vs Placed Students by Type</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.totalVsPlacedByType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#06b6d4" />
                  <Bar dataKey="placed" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Package Trends: Hostel vs Day Scholar (Average)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.avgPkgByType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Average Package by Type</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.avgPkgByDeptType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hostl" fill="#3b82f6" />
                  <Bar dataKey="days" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest Hostel Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.topHostlPct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest Day Scholar Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.topDaysPct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Growth Trend Hostel vs Day Scholar Across Batches</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.growthTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="hostl" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="days" stroke="#ef4444" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Summary Gauge</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed %', value: metrics.overallPct }, { name: 'Remaining', value: 100 - metrics.overallPct }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                    {[0,1].map((_, idx) => (<Cell key={idx} fill={idx===0 ? '#10b981' : '#e5e7eb'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Heatmap: Dept vs Hostel/Day Scholar Placement %</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Dept</th>
                      <th className="p-2">Hosteller %</th>
                      <th className="p-2">Day Scholar %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.heatMatrix.map((r:any, idx:number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{r.dept}</td>
                        <td className="p-2"><span className="inline-block w-24 h-4" style={{ backgroundColor: `hsl(${120 * (r.hostlPct/100)}, 70%, 60%)` }} /> {r.hostlPct}%</td>
                        <td className="p-2"><span className="inline-block w-24 h-4" style={{ backgroundColor: `hsl(${120 * (r.daysPct/100)}, 70%, 60%)` }} /> {r.daysPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerHostelDayScholarAnalysis;


