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
  'S.No','Dept','Total','PI','Quota','Total MQ','PI MQ','Total GQ','PI GQ','Total International','PI International','Placed MQ','Placed GQ','Placed International','MQ Placed %','GQ Placed %','International Placed %','Total %'
];

const OPTIONAL_COLUMNS = ['Batch','Incharge','Package'];

const TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerQuotaAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [quota, setQuota] = useState<string>('all'); // MQ | GQ | International
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
    XLSX.writeFile(wb, 'career_quota_analysis_template.xlsx');
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
      const matchesQuota = quota === 'all' ? true : String(r['Quota']).toLowerCase() === quota.toLowerCase();
      const placedSum = toNumber(r['Placed MQ']) + toNumber(r['Placed GQ']) + toNumber(r['Placed International']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedSum > 0 : placedSum === 0;
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesQuota && matchesPlaced;
    });
  }, [rows, search, dept, batch, pi, incharge, quota, placed]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const incharges = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);

  const metrics = useMemo(() => {
    // Totals
    const overall = filtered.reduce((acc, r) => {
      acc.totalMQ += toNumber(r['Total MQ']);
      acc.totalGQ += toNumber(r['Total GQ']);
      acc.totalIntl += toNumber(r['Total International']);
      acc.placedMQ += toNumber(r['Placed MQ']);
      acc.placedGQ += toNumber(r['Placed GQ']);
      acc.placedIntl += toNumber(r['Placed International']);
      acc.total += toNumber(r['Total']);
      const pkg = toNumber(r['Package']);
      if (String(r['Quota']).toLowerCase().includes('mq')) { acc.pkgMQ.push(pkg); }
      else if (String(r['Quota']).toLowerCase().includes('gq')) { acc.pkgGQ.push(pkg); }
      else if (String(r['Quota']).toLowerCase().includes('intern')) { acc.pkgIntl.push(pkg); }
      return acc;
    }, { totalMQ: 0, totalGQ: 0, totalIntl: 0, placedMQ: 0, placedGQ: 0, placedIntl: 0, total: 0, pkgMQ: [] as number[], pkgGQ: [] as number[], pkgIntl: [] as number[] });

    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s,x)=>s+x,0)/a.length) : 0;

    // Dept aggregates
    const deptMap = new Map<string, { totalMQ: number; totalGQ: number; totalIntl: number; placedMQ: number; placedGQ: number; placedIntl: number; mqPct: number; gqPct: number; intlPct: number; count: number; pkgMQ: number[]; pkgGQ: number[]; pkgIntl: number[] }>();
    filtered.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const cur = deptMap.get(d) || { totalMQ: 0, totalGQ: 0, totalIntl: 0, placedMQ: 0, placedGQ: 0, placedIntl: 0, mqPct: 0, gqPct: 0, intlPct: 0, count: 0, pkgMQ: [], pkgGQ: [], pkgIntl: [] };
      cur.totalMQ += toNumber(r['Total MQ']);
      cur.totalGQ += toNumber(r['Total GQ']);
      cur.totalIntl += toNumber(r['Total International']);
      cur.placedMQ += toNumber(r['Placed MQ']);
      cur.placedGQ += toNumber(r['Placed GQ']);
      cur.placedIntl += toNumber(r['Placed International']);
      cur.mqPct += toNumber(r['MQ Placed %']);
      cur.gqPct += toNumber(r['GQ Placed %']);
      cur.intlPct += toNumber(r['International Placed %']);
      const pkg = toNumber(r['Package']);
      const quotaVal = String(r['Quota'] || '').toLowerCase();
      if (quotaVal.includes('mq')) cur.pkgMQ.push(pkg);
      if (quotaVal.includes('gq')) cur.pkgGQ.push(pkg);
      if (quotaVal.includes('intern')) cur.pkgIntl.push(pkg);
      cur.count += 1;
      deptMap.set(d, cur);
    });

    const deptTotals = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mq: v.totalMQ, gq: v.totalGQ, intl: v.totalIntl }));
    const deptPlacedStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mq: v.placedMQ, gq: v.placedGQ, intl: v.placedIntl }));
    const deptPctBars = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mqPct: v.count? Math.round(v.mqPct/v.count):0, gqPct: v.count? Math.round(v.gqPct/v.count):0, intlPct: v.count? Math.round(v.intlPct/v.count):0 }));
    const avgPkgByDeptQuota = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mq: avg(v.pkgMQ), gq: avg(v.pkgGQ), intl: avg(v.pkgIntl) }));

    // PI-wise strength by quota
    const piMap = new Map<string, { mq: number; gq: number; intl: number }>();
    filtered.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { mq: 0, gq: 0, intl: 0 }; cur.mq += toNumber(r['PI MQ']); cur.gq += toNumber(r['PI GQ']); cur.intl += toNumber(r['PI International']); piMap.set(p, cur); });
    const piStrength = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, mq: v.mq, gq: v.gq, intl: v.intl }));

    // Batch trends
    const batchMap = new Map<string, { placedMQ: number; placedGQ: number; placedIntl: number; totalMQ: number; totalGQ: number; totalIntl: number }>();
    filtered.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { placedMQ: 0, placedGQ: 0, placedIntl: 0, totalMQ: 0, totalGQ: 0, totalIntl: 0 }; cur.placedMQ += toNumber(r['Placed MQ']); cur.placedGQ += toNumber(r['Placed GQ']); cur.placedIntl += toNumber(r['Placed International']); cur.totalMQ += toNumber(r['Total MQ']); cur.totalGQ += toNumber(r['Total GQ']); cur.totalIntl += toNumber(r['Total International']); batchMap.set(b, cur); });
    const batchTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, mq: v.placedMQ, gq: v.placedGQ, intl: v.placedIntl }));
    const batchQuotaDist = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, value: v.totalMQ + v.totalGQ + v.totalIntl }));

    // Quota comparison totals
    const totalVsPlacedByQuota = [
      { quota: 'MQ', total: overall.totalMQ, placed: overall.placedMQ },
      { quota: 'GQ', total: overall.totalGQ, placed: overall.placedGQ },
      { quota: 'International', total: overall.totalIntl, placed: overall.placedIntl },
    ];

    const quotaRatio = [
      { name: 'MQ', value: overall.totalMQ },
      { name: 'GQ', value: overall.totalGQ },
      { name: 'International', value: overall.totalIntl },
    ];

    const quotaPctDonut = [
      { name: 'MQ %', value: overall.totalMQ ? Math.round((overall.placedMQ/overall.totalMQ)*100) : 0 },
      { name: 'GQ %', value: overall.totalGQ ? Math.round((overall.placedGQ/overall.totalGQ)*100) : 0 },
      { name: 'Intl %', value: overall.totalIntl ? Math.round((overall.placedIntl/overall.totalIntl)*100) : 0 },
    ];

    // Top 5 by placement percent per quota
    const topMQ = [...deptPctBars].sort((a,b)=>b.mqPct - a.mqPct).slice(0,5).map(x=>({ dept: x.dept, value: x.mqPct }));
    const topGQ = [...deptPctBars].sort((a,b)=>b.gqPct - a.gqPct).slice(0,5).map(x=>({ dept: x.dept, value: x.gqPct }));
    const topIntl = [...deptPctBars].sort((a,b)=>b.intlPct - a.intlPct).slice(0,5).map(x=>({ dept: x.dept, value: x.intlPct }));

    // Avg package by quota (overall)
    const avgPkgByQuota = [
      { quota: 'MQ', avg: avg(overall.pkgMQ) },
      { quota: 'GQ', avg: avg(overall.pkgGQ) },
      { quota: 'International', avg: avg(overall.pkgIntl) },
    ];

    // Overall summary
    const overallPlaced = overall.placedMQ + overall.placedGQ + overall.placedIntl;
    const overallPct = overall.total ? Math.round((overallPlaced / overall.total) * 100) : 0;

    return { deptTotals, deptPlacedStack, quotaPctDonut, batchQuotaDist, piStrength, deptPctBars, totalVsPlacedByQuota, quotaRatio, avgPkgByQuota, avgPkgByDeptQuota, topMQ, topGQ, topIntl, batchTrend, overallPct };
  }, [filtered]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_quota_analysis_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - Quota Analysis (Filtered)', margin, y); y += 20;
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
    doc.save('career_quota_analysis_filtered.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Quota Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze quota-wise placements</p>
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
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
            <Label>Quota</Label>
            <Select value={quota} onValueChange={setQuota}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="MQ">MQ</SelectItem>
                <SelectItem value="GQ">GQ</SelectItem>
                <SelectItem value="International">International</SelectItem>
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
            <CardHeader><CardTitle>Dept-wise MQ vs GQ vs International Student Count</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mq" fill="#3b82f6" />
                  <Bar dataKey="gq" fill="#ef4444" />
                  <Bar dataKey="intl" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Placed MQ vs Placed GQ vs Placed International</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptPlacedStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mq" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="gq" stackId="a" fill="#ef4444" />
                  <Bar dataKey="intl" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quota-wise Placement Percentage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.quotaPctDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                    {metrics.quotaPctDonut.map((_,idx)=>(<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Quota Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.batchQuotaDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>PI vs Quota Strength</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.piStrength}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mq" fill="#3b82f6" />
                  <Bar dataKey="gq" fill="#ef4444" />
                  <Bar dataKey="intl" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise MQ% vs GQ% vs International%</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptPctBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="mqPct" fill="#3b82f6" />
                  <Bar dataKey="gqPct" fill="#ef4444" />
                  <Bar dataKey="intlPct" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Students vs Placed Students by Quota</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.totalVsPlacedByQuota}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quota" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#06b6d4" />
                  <Bar dataKey="placed" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Quota Ratio</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.quotaRatio} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                    {metrics.quotaRatio.map((_,idx)=>(<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quota-wise Package Trends (Average)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.avgPkgByQuota}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quota" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Average Package by Quota</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.avgPkgByDeptQuota}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mq" fill="#3b82f6" />
                  <Bar dataKey="gq" fill="#ef4444" />
                  <Bar dataKey="intl" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest MQ Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.topMQ}>
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
            <CardHeader><CardTitle>Top 5 Depts with Highest GQ Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.topGQ}>
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
            <CardHeader><CardTitle>Top 5 Depts with Highest International Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.topIntl}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Growth Trend by Quota Across Batches</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.batchTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="mq" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="gq" stroke="#ef4444" />
                  <Line type="monotone" dataKey="intl" stroke="#10b981" />
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
        </>
      )}
    </div>
  );
};

export default CareerQuotaAnalysis;


